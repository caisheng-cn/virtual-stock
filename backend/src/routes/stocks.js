/**
 * File: stocks.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Stock information routes. Provides stock pool listing, real-time quotes,
 *   historical K-line data, batch quotes, and commission rate configuration retrieval.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { StockPool, StockPrice, StockPricesCache, sequelize, CommissionConfig, MarketConfig, AdminAnnouncement } = require('../models')
const auth = require('../utils/auth')
const stockService = require('../services/stock')
const { EXCHANGE_RATES } = require('../utils/currency')

const router = express.Router()

const MARKET_LABELS = { 1: 'A股', 2: '港股', 3: '美股' }

function getNextEvent(fs, fe) {
  const now = new Date()
  const current = now.toTimeString().slice(0, 5)
  const isCrossDay = fs > fe

  let isBlocked
  if (isCrossDay) {
    isBlocked = current >= fs || current <= fe
  } else {
    isBlocked = current >= fs && current <= fe
  }

  let nextTime, nextType
  if (isBlocked) {
    nextTime = fe
    nextType = 'unblock'
    if (isCrossDay && current >= fs) {
      nextTime = '明天 ' + fe
    }
  } else {
    nextTime = fs
    nextType = 'block_start'
    if (!isCrossDay && current > fe) {
      nextTime = '明天 ' + fs
    }
  }

  return { isBlocked, isCrossDay, nextTime, nextType }
}

/**
 * GET /api/v1/stocks
 * List stocks from the stock pool with optional filtering by market_type and keyword search.
 * Query: { market_type?, page?, pageSize?, keyword? }
 * Response: { code, data: { list: StockPool[], total } }
 */
router.get('/', auth, async (req, res) => {
  try {
    const { market_type, page = 1, pageSize = 20, keyword } = req.query
    const where = { status: 1 }
    if (market_type) where.market_type = market_type
    if (keyword) {
      const { Op } = sequelize.Sequelize
      where[Op.or] = [
        { stock_name: { [Op.like]: `%${keyword}%` } },
        { stock_code: { [Op.like]: `%${keyword}%` } },
        { pinyin_abbr: { [Op.like]: `%${keyword}%` } }
      ]
    }

    const { count, rows } = await StockPool.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize,
      order: [['id', 'ASC']]
    })

    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/stocks/:stockCode/quote
 * Get a real-time stock quote. Requires market_type query parameter.
 * Query: { market_type }
 * Response: { code, data: { stockCode, stockName, price, ... } }
 */
router.get('/:stockCode/quote', auth, async (req, res) => {
  try {
    const { stockCode } = req.params
    const { market_type } = req.query

    if (!market_type) {
      return res.json({ code: -1, message: '请指定市场类型' })
    }

    const quote = await stockService.getQuote(stockCode, market_type)
    res.json({ code: 0, data: quote })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/stocks/:stockCode/history
 * Get historical K-line data. Supports date filtering and optional db source.
 * Query: { market_type, start_date?, end_date?, source? }
 * Response: { code, data: Array<{ tradeDate, openPrice, highPrice, lowPrice, closePrice, volume }> }
 */
router.get('/:stockCode/history', auth, async (req, res) => {
  try {
    const { stockCode } = req.params
    const { market_type, start_date, end_date, source } = req.query

    if (!market_type) {
      return res.json({ code: -1, message: '请指定市场类型' })
    }

    if (source === 'db') {
      const where = { stock_code: stockCode, market_type: parseInt(market_type) }
      if (start_date) where.trade_date = { ...where.trade_date, [require('sequelize').Op.gte]: start_date }
      if (end_date) where.trade_date = { ...where.trade_date, [require('sequelize').Op.lte]: end_date }

      const data = await StockPrice.findAll({
        where,
        order: [['trade_date', 'ASC']]
      })

      const result = data.map(d => ({
        tradeDate: d.trade_date,
        openPrice: parseFloat(d.open_price),
        highPrice: parseFloat(d.high_price),
        lowPrice: parseFloat(d.low_price),
        closePrice: parseFloat(d.close_price),
        volume: parseInt(d.volume)
      }))

      return res.json({ code: 0, data: result })
    }

    const history = await stockService.getHistory(stockCode, market_type, start_date, end_date)
    res.json({ code: 0, data: history })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/stocks/quotes
 * Get quotes for multiple stocks in one request.
 * Body: { stocks: Array<{ stock_code, market_type }> }
 * Response: { code, data: Array<quote objects> }
 */
router.post('/quotes', auth, async (req, res) => {
  try {
    const { stocks } = req.body
    if (!stocks || stocks.length === 0) {
      return res.json({ code: -1, message: '请提供股票列表' })
    }

    const quotes = await stockService.getBatchQuotes(stocks)
    res.json({ code: 0, data: quotes })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/stocks/commission-configs
 * Get all commission rate configurations (public, no auth required).
 * Response: { code, data: CommissionConfig[] }
 */
router.get('/commission-configs', async (req, res) => {
  try {
    const configs = await CommissionConfig.findAll()
    res.json({ code: 0, data: configs })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/stocks/market-config
 * Get market forbidden trading hours and refresh times (public).
 * Response: { code, data: MarketConfig[] }
 */
router.get('/market-config', async (req, res) => {
  try {
    const configs = await MarketConfig.findAll()
    res.json({ code: 0, data: configs })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/stocks/exchange-rates
 * Get current exchange rates (public).
 * Response: { code, data: { USD_TO_CNY, HKD_TO_CNY } }
 */
router.get('/exchange-rates', async (req, res) => {
  res.json({ code: 0, data: EXCHANGE_RATES })
})

/**
 * GET /api/v1/stocks/announcement
 * Get the latest enabled admin announcement (public).
 * Response: { code, data: AdminAnnouncement|null }
 */
router.get('/announcement', async (req, res) => {
  try {
    const ann = await AdminAnnouncement.findOne({ where: { enabled: 1 }, order: [['id', 'DESC']] })
    res.json({ code: 0, data: ann })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/stocks/market-status
 * Get real-time trading status per market (public).
 * Response: { code, data: Array<{ market_type, market_label, enabled, forbid_start, forbid_end, is_cross_day, is_blocked, next_event_time, next_event_type }> }
 */
router.get('/market-status', async (req, res) => {
  try {
    const configs = await MarketConfig.findAll()
    const data = configs.map(c => {
      const { isBlocked, isCrossDay, nextTime, nextType } = getNextEvent(c.forbid_start, c.forbid_end)
      return {
        market_type: c.market_type,
        market_label: MARKET_LABELS[c.market_type] || `Market ${c.market_type}`,
        enabled: c.enabled,
        forbid_start: c.forbid_start,
        forbid_end: c.forbid_end,
        is_cross_day: isCrossDay,
        is_blocked: isBlocked,
        next_event_time: nextTime,
        next_event_type: nextType
      }
    })
    res.json({ code: 0, data })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router