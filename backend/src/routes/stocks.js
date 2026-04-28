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
const { StockPool, StockPrice, StockPricesCache, sequelize, CommissionConfig } = require('../models')
const auth = require('../utils/auth')
const stockService = require('../services/stock')

const router = express.Router()

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
    if (keyword) where.stock_name = { [sequelize.Sequelize.Op.like]: `%${keyword}%` }

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

module.exports = router