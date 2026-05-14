const { Op } = require('sequelize')
const { OptionContract, OptionPrice, OptionPosition, OptionWhitelist, StockPricesCache } = require('../models')
const { toCNY } = require('../utils/currency')

const VOLATILITY = 0.30
const CONTRACT_MULTIPLIER = 100
const STRIKE_STEPS = 5
const STRIKE_STEP_PCT = 0.025
const EXPIRY_LOOKAHEAD_DAYS = 5

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
  return { premium: Math.round((iv + tv) * 100) / 100, intrinsicValue: Math.round(iv * 100) / 100, timeValue: Math.round(tv * 100) / 100 }
}

function generateContractCode(stockCode, expirationDate, optionType, strikePrice) {
  const dateStr = expirationDate.replace(/-/g, '')
  const typeStr = optionType === 'call' ? 'C' : 'P'
  const strikeStr = (strikePrice * 1000).toFixed(0).padStart(8, '0')
  return `${stockCode}${dateStr}${typeStr}${strikeStr}`
}

function generateStrikePrices(underlyingPrice) {
  const step = Math.round(underlyingPrice * STRIKE_STEP_PCT * 100) / 100
  const base = Math.round(underlyingPrice / step) * step
  const strikes = []
  for (let i = -STRIKE_STEPS; i <= STRIKE_STEPS; i++) {
    strikes.push(Math.round((base + i * step) * 100) / 100)
  }
  return strikes
}

async function getUnderlyingPrice(stockCode, marketType) {
  const cache = await StockPricesCache.findOne({
    where: { stock_code: stockCode, market_type: marketType }
  })
  if (cache) return parseFloat(cache.close_price)
  return null
}

async function ensureContracts(stockCode, marketType, stockName, underlyingPrice) {
  const today = new Date().toISOString().split('T')[0]
  const todayDate = new Date(today)
  const existingDates = await OptionContract.findAll({
    where: {
      stock_code: stockCode,
      market_type: marketType,
      expiration_date: { [Op.gte]: today },
      status: 1
    },
    attributes: ['expiration_date'],
    group: ['expiration_date'],
    raw: true
  })
  const existingSet = new Set(existingDates.map(d => d.expiration_date))

  const dates = []
  for (let i = 1; i <= EXPIRY_LOOKAHEAD_DAYS; i++) {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + i * 7)
    const ds = d.toISOString().split('T')[0]
    if (!existingSet.has(ds)) {
      dates.push(ds)
    }
  }

  const strikes = generateStrikePrices(underlyingPrice)
  const created = []
  for (const expDate of dates) {
    for (const optType of ['call', 'put']) {
      for (const strike of strikes) {
        const code = generateContractCode(stockCode, expDate, optType, strike)
        try {
          const [contract] = await OptionContract.findOrCreate({
            where: { contract_code: code },
            defaults: {
              stock_code: stockCode,
              market_type: marketType,
              stock_name: stockName,
              option_type: optType,
              strike_price: strike,
              expiration_date: expDate,
              contract_code: code,
              contract_multiplier: CONTRACT_MULTIPLIER,
              status: 1,
              underlying_price: underlyingPrice
            }
          })
          created.push(contract)
        } catch (e) {}
      }
    }
  }
  return created
}

async function refreshPrices(stockCode, marketType) {
  const underlyingPrice = await getUnderlyingPrice(stockCode, marketType)
  if (!underlyingPrice) return []
  const today = new Date().toISOString().split('T')[0]
  const contracts = await OptionContract.findAll({
    where: {
      stock_code: stockCode,
      market_type: marketType,
      expiration_date: { [Op.gte]: today },
      status: 1
    }
  })
  const results = []
  for (const contract of contracts) {
    const expDate = new Date(contract.expiration_date)
    const todayDate = new Date(today)
    const daysToExpiry = Math.max(1, Math.ceil((expDate - todayDate) / (1000 * 60 * 60 * 24)))
    const { premium, intrinsicValue, timeValue } = calcPremium(
      underlyingPrice, parseFloat(contract.strike_price), contract.option_type, daysToExpiry, VOLATILITY
    )
    try {
      await OptionPrice.upsert({
        contract_id: contract.id,
        trade_date: today,
        premium,
        intrinsic_value: intrinsicValue,
        time_value: timeValue,
        underlying_price: underlyingPrice,
        delta: 0,
        implied_volatility: VOLATILITY
      })
      results.push({ contractId: contract.id, premium, intrinsicValue, timeValue })
    } catch (e) {}
  }
  return results
}

async function getOptionChain(stockCode, marketType, expirationDate) {
  const underlyingPrice = await getUnderlyingPrice(stockCode, marketType)
  if (!underlyingPrice) return null
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
  if (contracts.length === 0) return null

  const contractIds = contracts.map(c => c.id)
  const priceRows = await OptionPrice.findAll({
    where: { contract_id: { [Op.in]: contractIds }, trade_date: today },
    raw: true
  })
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
      daysToExpiry: Math.max(0, Math.ceil((new Date(c.expiration_date) - new Date(today)) / (1000 * 60 * 60 * 24)))
    }
    if (c.option_type === 'call') calls.push(item)
    else puts.push(item)
  }

  calls.sort((a, b) => a.strike - b.strike)
  puts.sort((a, b) => a.strike - b.strike)

  return {
    stockCode,
    stockName: contracts[0].stock_name,
    marketType,
    underlyingPrice,
    expirationDate: expirationDate || contracts[0].expiration_date,
    calls,
    puts
  }
}

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
  for (const p of priceRows) {
    priceMap[p.contract_id] = p
  }

  const contracts = await OptionContract.findAll({
    where: { id: { [Op.in]: contractIds } },
    raw: true
  })
  const contractMap = {}
  for (const c of contracts) {
    contractMap[c.id] = c
  }

  const results = []
  for (const p of positions) {
    const c = contractMap[p.contract_id]
    if (!c) continue
    const priceData = priceMap[c.id]
    const currentPremium = priceData ? parseFloat(priceData.premium) : 0
    const underlyingPrice = priceData ? parseFloat(priceData.underlying_price) : 0
    const marketValue = toCNY(currentPremium * p.quantity * (c.contract_multiplier || CONTRACT_MULTIPLIER), c.market_type)
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
      stockCode: c.stock_code,
      stockName: c.stock_name,
      marketType: c.market_type,
      optionType: c.option_type,
      strikePrice: parseFloat(c.strike_price),
      expirationDate: c.expiration_date,
      daysToExpiry: daysLeft,
      quantity: p.quantity,
      avgCost: parseFloat(p.avg_cost),
      totalCost,
      currentPremium,
      marketValue,
      underlyingPrice,
      moneyness,
      profit
    })
  }
  return results
}

module.exports = {
  calcPremium,
  generateContractCode,
  generateStrikePrices,
  getUnderlyingPrice,
  ensureContracts,
  refreshPrices,
  getOptionChain,
  getUserOptionPositions,
  CONTRACT_MULTIPLIER,
  VOLATILITY
}
