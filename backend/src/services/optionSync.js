const path = require('path')
const { Op } = require('sequelize')
const {
  OptionContract, OptionPrice, OptionWhitelist,
  StockPricesCache, StockPrice, sequelize
} = require('../models')
const { runPythonScript } = require('./stock')

const PYTHON_SCRIPT = path.join(__dirname, '../../fetch_option_data.py')

function runOptionScript(args, timeout = 120000) {
  return runPythonScript(PYTHON_SCRIPT, args, timeout)
}

async function syncAllContracts() {
  const data = await runOptionScript({ action: 'sync_all_contracts' }, 360000)
  if (data.error) throw new Error(data.error)
  if (!data.contracts || !data.contracts.length) return 0

  let saved = 0
  for (const c of data.contracts) {
    const contractCode = c.contract_code_sse || c.contract_code_ctp
    if (!contractCode) continue

    // 只同步非商品期权（ETF + 股指）
    const validExchanges = ['SSE', 'SZSE', 'CFFEX']
    if (!validExchanges.includes(c.exchange)) continue

    try {
      // 从 CTP 合约代码解析期权类型
      let optType = c.option_type
      if (!optType && c.contract_code_ctp) {
        if (c.contract_code_ctp.includes('-C-')) optType = 'call'
        else if (c.contract_code_ctp.includes('-P-')) optType = 'put'
      }

      const strike = c.strike_price
      const expiryDate = c.expiration_date || c.delivery_date
      if (!expiryDate || !strike) continue

      const rec = {
        stock_code: c.underlying_code || contractCode.slice(0, 6),
        market_type: 1,
        stock_name: c.contract_name ? c.contract_name.replace(/ /g,'') : '',
        option_type: optType || 'call',
        strike_price: strike,
        expiration_date: expiryDate,
        contract_code: contractCode,
        contract_multiplier: c.contract_multiplier || 10000,
        status: 1,
        exchange: c.exchange || '',
        contract_name: c.contract_name ? c.contract_name.trim() : '',
        exercise_type: c.exercise_type || 1,
        contract_code_sse: c.contract_code_sse || '',
        contract_code_ctp: c.contract_code_ctp || '',
        prev_settle: c.prev_settle || 0,
        listing_date: c.listing_date || null,
        last_trade_date: expiryDate,
        delivery_date: c.delivery_date || null,
        underlying_code: c.underlying_code || '',
      }
      await OptionContract.upsert(rec)
      saved++
    } catch (e) {
      console.log('[optionSync] upsert error:', e.message, 'code:', (c.contract_code_ctp || '').slice(0,20))
    }
  }
  return saved
}

async function syncSSEBoard(symbol, endMonth) {
  const data = await runOptionScript({
    action: 'sync_sse_board',
    symbol,
    end_month: endMonth
  }, 60000)
  if (data.error) throw new Error(data.error)
  return data.board_data || []
}

async function syncCFFEXBoard(symbolName) {
  const data = await runOptionScript({
    action: 'sync_cffex_board',
    symbol_name: symbolName
  }, 60000)
  if (data.error) throw new Error(data.error)
  return data.board_data || []
}

async function syncExpiryDates(scope = 'all') {
  const data = await runOptionScript({
    action: 'sync_expiry_dates',
    scope
  }, 60000)
  if (data.error) throw new Error(data.error)
  return data.expirations || []
}

async function syncCFFEXExpiryDates() {
  const data = await runOptionScript({
    action: 'sync_expiry_dates',
    scope: 'cffex'
  }, 60000)
  return data.expirations || []
}

async function syncGreeks(tradeDate) {
  const dateStr = tradeDate || new Date().toISOString().split('T')[0].replace(/-/g, '')
  const data = await runOptionScript({
    action: 'sync_greeks',
    trade_date: dateStr
  }, 60000)

  const greeks = data.greeks_data || []
  if (!greeks.length) return greeks

  // 写入 DB
  let updated = 0
  for (const g of greeks) {
    const contract = await OptionContract.findOne({
      where: { contract_code_sse: g.contract_code_sse }
    })
    if (!contract) continue

    const tradeDateStr = g.trade_date || dateStr
    const normalizedDate = tradeDateStr.length === 8
      ? `${tradeDateStr.slice(0,4)}-${tradeDateStr.slice(4,6)}-${tradeDateStr.slice(6,8)}`
      : tradeDateStr

    try {
      const [affected] = await OptionPrice.update({
        delta: g.delta || 0,
        gamma: g.gamma || 0,
        theta: g.theta || 0,
        vega: g.vega || 0,
        rho: g.rho || 0,
        implied_volatility: g.implied_volatility || 0,
      }, {
        where: {
          contract_id: contract.id,
          trade_date: normalizedDate
        }
      })
      if (affected > 0) updated++
    } catch (e) {
      console.log(`[optionSync] Greeks写入失败 ${g.contract_code_sse}:`, e.message)
    }
  }

  console.log(`[optionSync] Greeks同步完成: ${greeks.length} 条获取, ${updated} 条写入`)
  return greeks
}

async function syncUnderlyingPrice(underlyingCode, exchange = 'SSE') {
  const data = await runOptionScript({
    action: 'sync_underlying_price',
    underlying_code: underlyingCode,
    exchange
  }, 30000)
  return data
}

async function initBackfill(underlying, etfName, dateFrom) {
  const data = await runOptionScript({
    action: 'init_backfill',
    underlying,
    etf_name: etfName,
    date_from: dateFrom || '2025-05-15'
  }, 600000)
  return data.prices || []
}

async function batchSaveContractsToDB() {
  const count = await syncAllContracts()
  console.log(`[optionSync] 同步完成: ${count} 个合约`)
  return count
}

async function updateRealtimePrices() {
  const today = new Date().toISOString().split('T')[0]
  const whitelist = await OptionWhitelist.findAll({
    where: { status: 1 },
    raw: true
  })

  let updated = 0
  for (const w of whitelist) {
    try {
      const underlyingType = w.underlying_type || 1
      if (underlyingType === 1 || underlyingType === 2) {
        // ETF 或 股指期权
        const symbolName = w.stock_name
        const exchange = w.exchange || 'SSE'

        let boardData = []
        if (exchange === 'SSE' || exchange === 'SZSE') {
          // 获取可用到期月
          const months = await syncExpiryDatesForStock(w.underlying_code || w.stock_code)
          for (const m of months.slice(0, 2)) {
            const monthCode = String(m.year).slice(2) + String(m.month).padStart(2, '0')
            const board = await syncSSEBoard(symbolName, monthCode)
            boardData = boardData.concat(board)
          }
        } else if (exchange === 'CFFEX') {
          boardData = await syncCFFEXBoard(symbolName)
        }

        for (const b of boardData) {
          const contractCode = b.contract_code || b.contract_code_ctp
          if (!contractCode) continue
          const contract = await OptionContract.findOne({
            where: {
              [Op.or]: [
                { contract_code: contractCode },
                { contract_code_ctp: contractCode },
                { contract_code_sse: contractCode }
              ]
            }
          })
          if (!contract) continue

          await OptionPrice.upsert({
            contract_id: contract.id,
            trade_date: today,
            premium: b.current_price || b.last_price || b.close || 0,
            settle: b.current_price || b.last_price || 0,
            prev_settle: b.prev_settle || 0,
            open_interest: b.open_interest || 0,
            volume: b.volume || 0,
            bid_price: b.bid_price || 0,
            ask_price: b.ask_price || 0,
            change_percent: b.change_percent || 0,
            underlying_price: w.underlying_price || 0,
          })
          updated++
        }
      }
    } catch (e) {
      console.log(`[optionSync] ${w.stock_code} 实时价更新失败:`, e.message)
    }
  }
  return updated
}

async function syncExpiryDatesForStock(underlyingCode) {
  // 判断是ETF还是CFFEX
  if (['000300', '000016', '000852'].includes(underlyingCode)) {
    return syncCFFEXExpiryDates()
  }
  return syncExpiryDates('all')
}

async function syncDailyPricesForStock(stockCode, exchange) {
  const today = new Date().toISOString().split('T')[0]
  const contracts = await OptionContract.findAll({
    where: { stock_code: stockCode, status: 1 },
    raw: true
  })
  if (!contracts.length) return 0

  const sseCodes = contracts.filter(c => c.contract_code_sse).map(c => c.contract_code_sse)
  const cffexSymbol = exchange === 'CFFEX' ? (contracts[0].stock_name || '') : ''
  const cffexMonth = exchange === 'CFFEX' && contracts[0].contract_code_ctp
    ? contracts[0].contract_code_ctp.match(/^([A-Z]+\d{4})/)?.[1] || ''
    : ''

  const data = await runOptionScript({
    action: 'sync_daily_close_for_underlying',
    underlying_code: stockCode,
    exchange,
    sse_codes: sseCodes,
    cffex_symbol: cffexSymbol,
    cffex_month: cffexMonth,
  }, 120000)

  let updated = 0
  for (const p of (data.prices || [])) {
    const contractCode = p.contract_code_sse || p.contract_code_ctp
    if (!contractCode) continue
    const contract = contracts.find(c =>
      c.contract_code_sse === contractCode || c.contract_code_ctp === contractCode
    )
    if (!contract) continue
    try {
      await OptionPrice.upsert({
        contract_id: contract.id,
        trade_date: p.trade_date || today,
        premium: p.close || 0,
        settle: p.close || 0,
        volume: p.volume || 0,
        underlying_price: 0,
      })
      updated++
    } catch (e) {}
  }
  return updated
}

async function syncAllDailyClose() {
  const whitelist = await OptionWhitelist.findAll({ where: { status: 1 }, raw: true })
  let total = 0
  for (const w of whitelist) {
    try {
      const n = await syncDailyPricesForStock(w.stock_code, w.exchange || 'SSE')
      total += n
    } catch (e) {
      console.log(`[optionSync] ${w.stock_code} 收盘价同步失败:`, e.message)
    }
  }
  return total
}

module.exports = {
  syncAllContracts,
  syncSSEBoard,
  syncCFFEXBoard,
  syncExpiryDates,
  syncCFFEXExpiryDates,
  syncGreeks,
  syncUnderlyingPrice,
  initBackfill,
  batchSaveContractsToDB,
  updateRealtimePrices,
  syncDailyPricesForStock,
  syncAllDailyClose,
  runOptionScript,
}
