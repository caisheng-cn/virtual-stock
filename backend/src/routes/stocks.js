const express = require('express')
const { StockPool, StockPrice, StockPricesCache, sequelize, CommissionConfig } = require('../models')
const auth = require('../utils/auth')
const stockService = require('../services/stock')

const router = express.Router()

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

router.get('/commission-configs', async (req, res) => {
  try {
    const configs = await CommissionConfig.findAll()
    res.json({ code: 0, data: configs })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router