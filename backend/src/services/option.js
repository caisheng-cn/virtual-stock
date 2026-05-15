const { Op, Sequelize } = require('sequelize')
const {
  OptionContract, OptionPrice, OptionPosition, OptionTransaction,
  OptionWhitelist, StockPricesCache, StockPrice, sequelize
} = require('../models')
const { toCNY } = require('../utils/currency')
const optionSync = require('./optionSync')

const CONTRACT_MULTIPLIER = 10000
const OPTION_COMMISSION_RATE = 0.5

// ============ 保留的 fallback 定价模型 ============

function calcPremium(underlyingPrice, strikePrice, optionType, daysToExpiry, volatility) {
  const T = daysToExpiry / 365.0
  const iv = optionType === 'call'
    ? Math.max(underlyingPrice - strikePrice, 0)
    : Math.max(strikePrice - underlyingPrice, 0)
  const moneyness = (underlyingPrice - strikePrice) / underlyingPrice
  const absM = Math.abs(moneyness)
  let timeFactor = Math.exp(-absM * 3) * 0.8 + 0.2
  if (absM < 0.01) timeFactor = 1.0
  const tv = underlyingPrice * volatility * Math.sqrt(T) * timeFactor * 0.1

  // 理论 Delta 估算
  let delta = 0
  if (optionType === 'call') {
    delta = 1 / (1 + Math.exp(-3.5 * (1 - absM)))  // ITM→1, ATM→0.5, OTM→0
  } else {
    delta = -(1 / (1 + Math.exp(-3.5 * (1 - absM))))  // ITM→-1, ATM→-0.5, OTM→0
  }
  if (underlyingPrice < strikePrice && optionType === 'call') delta = delta // already correct
  if (underlyingPrice > strikePrice && optionType === 'put') delta = -delta // adjust

  // 更准确的估算：ITM/ATM/OTM
  const std = volatility * Math.sqrt(T)
  if (std > 0.001) {
    const d1 = Math.log(underlyingPrice / strikePrice) / std + std / 2
    const nd1 = 1 / (1 + Math.exp(-1.701 * d1))  // sigmoid 近似正态CDF
    delta = optionType === 'call' ? nd1 : nd1 - 1
  }

  return {
    premium: Math.round((iv + tv) * 100) / 100,
    intrinsicValue: Math.round(iv * 100) / 100,
    timeValue: Math.round(tv * 100) / 100,
    delta: Math.round(delta * 10000) / 10000,
  }
}

// ============ 标的价获取 ============

async function getUnderlyingPrice(stockCode, marketType, exchange) {
  // 中国指数/ETF: 通过 AKShare 获取（带10秒超时）
  if (marketType === 1 && exchange) {
    try {
      const timer = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      const result = await Promise.race([optionSync.syncUnderlyingPrice(stockCode, exchange), timer])
      if (result && result.price) {
        try {
          const today = new Date().toISOString().split('T')[0]
          await StockPricesCache.upsert({
            stock_code: stockCode,
            market_type: marketType,
            trade_date: today,
            close_price: result.price,
            prev_close: result.prev_close || result.price,
            stock_name: result.name || stockCode,
          })
        } catch (e) {}
        return result.price
      }
    } catch (e) {
      console.log(`[option] 获取标的价格超时: ${stockCode}`)
    }
  }

  const cache = await StockPricesCache.findOne({
    where: { stock_code: stockCode, market_type: marketType }
  })
  if (cache) return parseFloat(cache.close_price)

  const last = await StockPrice.findOne({
    where: { stock_code: stockCode, market_type: marketType },
    order: [['trade_date', 'DESC']]
  })
  if (last) return parseFloat(last.close_price)

  // 从期权合约表中取最后一次记录的标的价
  const contract = await OptionContract.findOne({
    where: { stock_code: stockCode, market_type: marketType },
    order: [['created_at', 'DESC']],
    raw: true
  })
  if (contract && contract.underlying_price) return parseFloat(contract.underlying_price)

  return null
}

// ============ 合约确保（从已同步的DB读取） ============

async function ensureContracts(stockCode, marketType) {
  const today = new Date().toISOString().split('T')[0]
  const count = await OptionContract.count({
    where: {
      stock_code: stockCode,
      status: 1,
      expiration_date: { [Op.gte]: today }
    }
  })
  if (count > 0) return count

  try {
    const synced = await optionSync.batchSaveContractsToDB()
    return synced
  } catch (e) {
    console.log('[option] 同步合约失败:', e.message)
    return 0
  }
}

// ============ 价格刷新 ============

async function refreshPrices(stockCode, marketType) {
  const today = new Date().toISOString().split('T')[0]

  const whitelist = await OptionWhitelist.findOne({
    where: { stock_code: stockCode, status: 1 },
    raw: true
  })
  const exchange = whitelist?.exchange || 'SSE'

  // 获取标的价（带缓存兜底）
  const underlyingPrice = await getUnderlyingPrice(stockCode, marketType, exchange)
  if (!underlyingPrice) return 0

  const contracts = await OptionContract.findAll({
    where: {
      stock_code: stockCode,
      market_type: marketType,
      expiration_date: { [Op.gte]: today },
      status: 1
    }
  })
  if (!contracts.length) return 0

  // 用 calcPremium 快速填充价格（纯计算，无网络请求）
  let updated = 0
  for (const contract of contracts) {
    const expDate = new Date(contract.expiration_date)
    const todayDate = new Date(today)
    const daysToExpiry = Math.max(1, Math.ceil((expDate - todayDate) / (1000 * 60 * 60 * 24)))
    const { premium, intrinsicValue, timeValue, delta } = calcPremium(
      underlyingPrice, parseFloat(contract.strike_price), contract.option_type,
      daysToExpiry, 0.30
    )
    try {
      await OptionPrice.upsert({
        contract_id: contract.id,
        trade_date: today,
        premium,
        settle: premium,
        intrinsic_value: intrinsicValue,
        time_value: timeValue,
        underlying_price: underlyingPrice,
        delta,
        implied_volatility: 0.30
      })
      updated++
    } catch (e) {}
  }

  // 后台异步同步真实行情（下次请求命中真实数据）
  optionSync.updateRealtimePrices().catch(e => {})

  return updated
}

// ============ 期权链（T型报价） ============

async function getOptionChain(stockCode, marketType, expirationDate) {
  const today = new Date().toISOString().split('T')[0]

  let whereClause = {
    stock_code: stockCode,
    market_type: marketType,
    expiration_date: { [Op.gte]: today },
    status: 1
  }
  if (expirationDate) {
    whereClause.expiration_date = expirationDate
  }

  const contracts = await OptionContract.findAll({ where: whereClause, raw: true })
  if (!contracts.length) return null

  // 从合约中获取交易所信息，用于获取标的价
  const exchange = contracts[0].exchange || 'SSE'
  const underlyingPrice = await getUnderlyingPrice(stockCode, marketType, exchange)
  if (!contracts.length) return null

  const contractIds = contracts.map(c => c.id)
  let priceRows = await OptionPrice.findAll({
    where: { contract_id: { [Op.in]: contractIds }, trade_date: today },
    raw: true
  })

  if (!priceRows.length) {
    // 尝试刷新价格
    await refreshPrices(stockCode, marketType)
    priceRows = await OptionPrice.findAll({
      where: { contract_id: { [Op.in]: contractIds }, trade_date: today },
      raw: true
    })
  }

  // 如果当天无数据，尝试最新日期
  if (!priceRows.length) {
    const lastDate = await OptionPrice.max('trade_date', {
      where: { contract_id: { [Op.in]: contractIds } }
    })
    if (lastDate) {
      priceRows = await OptionPrice.findAll({
        where: { contract_id: { [Op.in]: contractIds }, trade_date: lastDate },
        raw: true
      })
    }
  }

  const priceMap = {}
  for (const p of priceRows) {
    priceMap[p.contract_id] = p
  }

  const calls = []
  const puts = []
  for (const c of contracts) {
    const p = priceMap[c.id]
    const item = {
      contractId: c.id,
      strike: parseFloat(c.strike_price),
      premium: p ? parseFloat(p.premium) : 0,
      intrinsicValue: p ? parseFloat(p.intrinsic_value) : 0,
      timeValue: p ? parseFloat(p.time_value) : 0,
      underlyingPrice: p ? parseFloat(p.underlying_price) : underlyingPrice,
      contractCode: c.contract_code,
      contractName: c.contract_name || '',
      exchange: c.exchange || '',
      exerciseType: c.exercise_type || 1,
      daysToExpiry: Math.max(0, Math.ceil((new Date(c.expiration_date) - new Date(today)) / (1000 * 60 * 60 * 24))),
      prevSettle: p ? parseFloat(p.prev_settle || 0) : 0,
      changePercent: p ? parseFloat(p.change_percent || 0) : 0,
      openInterest: p ? parseInt(p.open_interest || 0) : 0,
      volume: p ? parseInt(p.volume || 0) : 0,
      delta: p ? parseFloat(p.delta || 0) : 0,
      impliedVolatility: p ? parseFloat(p.implied_volatility || 0) : 0,
      bidPrice: p ? parseFloat(p.bid_price || 0) : 0,
      askPrice: p ? parseFloat(p.ask_price || 0) : 0,
    }
    if (c.option_type === 'call') calls.push(item)
    else puts.push(item)
  }

  calls.sort((a, b) => a.strike - b.strike)
  puts.sort((a, b) => a.strike - b.strike)

  return {
    stockCode,
    stockName: contracts[0].stock_name || contracts[0].underlying_code || stockCode,
    marketType,
    underlyingPrice,
    expirationDate: expirationDate || contracts[0].expiration_date,
    calls,
    puts
  }
}

// ============ 用户持仓 ============

async function getUserOptionPositions(userId, groupId) {
  const today = new Date().toISOString().split('T')[0]
  const positions = await OptionPosition.findAll({
    where: { user_id: userId, group_id: groupId, status: 1 },
    raw: true
  })
  if (!positions.length) return []

  const contractIds = positions.map(p => p.contract_id)

  const priceRows = await OptionPrice.findAll({
    where: { contract_id: { [Op.in]: contractIds }, trade_date: today },
    raw: true
  })
  const priceMap = {}
  for (const p of priceRows) priceMap[p.contract_id] = p

  const contracts = await OptionContract.findAll({
    where: { id: { [Op.in]: contractIds } },
    raw: true
  })
  const contractMap = {}
  for (const c of contracts) contractMap[c.id] = c

  const results = []
  for (const p of positions) {
    const c = contractMap[p.contract_id]
    if (!c) continue
    const priceData = priceMap[c.id]
    const currentPremium = priceData ? parseFloat(priceData.premium) : 0
    const underlyingPrice = priceData ? parseFloat(priceData.underlying_price) : 0
    const multiplier = c.contract_multiplier || CONTRACT_MULTIPLIER
    const marketValue = currentPremium * p.quantity * multiplier
    const totalCost = parseFloat(p.total_cost)
    const profit = marketValue - totalCost
    const expDate = new Date(c.expiration_date)
    const daysLeft = Math.max(0, Math.ceil((expDate - new Date(today)) / (1000 * 60 * 60 * 24)))
    const moneyness = c.option_type === 'call'
      ? (underlyingPrice > parseFloat(c.strike_price) ? 'itm' : (underlyingPrice < parseFloat(c.strike_price) ? 'otm' : 'atm'))
      : (underlyingPrice < parseFloat(c.strike_price) ? 'itm' : (underlyingPrice > parseFloat(c.strike_price) ? 'otm' : 'atm'))

    results.push({
      positionId: p.id,
      contractId: c.id,
      contractCode: c.contract_code,
      contractName: c.contract_name || '',
      stockCode: c.stock_code,
      stockName: c.stock_name || c.underlying_code || '',
      marketType: c.market_type,
      exchange: c.exchange || '',
      optionType: c.option_type,
      strikePrice: parseFloat(c.strike_price),
      expirationDate: c.expiration_date,
      daysToExpiry: daysLeft,
      exerciseType: c.exercise_type || 1,
      quantity: p.quantity,
      avgCost: parseFloat(p.avg_cost),
      totalCost,
      currentPremium,
      marketValue,
      underlyingPrice,
      moneyness,
      profit,
      delta: priceData ? parseFloat(priceData.delta || 0) : 0,
    })
  }
  return results
}

// ============ 到期自动结算 ============

async function autoSettleExpired() {
  const today = new Date().toISOString().split('T')[0]
  const expiredContracts = await OptionContract.findAll({
    where: { expiration_date: today, status: 1 },
    raw: true
  })

  let settled = 0
  let totalPayout = 0

  for (const contract of expiredContracts) {
    const priceRow = await OptionPrice.findOne({
      where: { contract_id: contract.id, trade_date: today },
      raw: true
    })

    const underlyingPrice = priceRow
      ? parseFloat(priceRow.settle || priceRow.premium || priceRow.underlying_price || 0)
      : 0
    const multiplier = contract.contract_multiplier || CONTRACT_MULTIPLIER
    const strike = parseFloat(contract.strike_price)

    const positions = await OptionPosition.findAll({
      where: { contract_id: contract.id, status: 1 },
      raw: true
    })

    for (const pos of positions) {
      let settlementAmount = 0
      if (contract.option_type === 'call') {
        settlementAmount = Math.max(underlyingPrice - strike, 0) * pos.quantity * multiplier
      } else {
        settlementAmount = Math.max(strike - underlyingPrice, 0) * pos.quantity * multiplier
      }

      if (settlementAmount > 0) {
        await UserBalance.increment('cash', {
          by: settlementAmount,
          where: { user_id: pos.user_id, group_id: pos.group_id }
        })
        totalPayout += settlementAmount

        const costPerUnit = parseFloat(pos.total_cost) / pos.quantity
        const profit = settlementAmount - (costPerUnit * pos.quantity)

        await OptionTransaction.create({
          user_id: pos.user_id,
          group_id: pos.group_id,
          contract_id: contract.id,
          stock_code: contract.stock_code,
          stock_name: contract.stock_name || '',
          option_type: contract.option_type,
          strike_price: strike,
          expiration_date: contract.expiration_date,
          trade_type: 4,
          quantity: pos.quantity,
          price: 0,
          premium: settlementAmount,
          commission: 0,
          profit,
          balance_after: 0,
          trade_date: today,
          settlement_amount: settlementAmount,
          status: 1
        })
      }

      await OptionPosition.update({ status: 4 }, { where: { id: pos.id } })
      settled++
    }

    await OptionContract.update({ status: 2 }, { where: { id: contract.id } })
  }

  return { settled, totalPayout, expiredCount: expiredContracts.length }
}

module.exports = {
  calcPremium,
  getUnderlyingPrice,
  ensureContracts,
  refreshPrices,
  getOptionChain,
  getUserOptionPositions,
  autoSettleExpired,
  CONTRACT_MULTIPLIER,
  OPTION_COMMISSION_RATE,
}
