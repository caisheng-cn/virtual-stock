/**
 * File: transactions.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Transaction history and fund flow routes. Lists user's trade records
 *   with filtering by date, stock code, and trade type. Also provides fund flow analysis
 *   showing deposits, buy/sell amounts, dividends, and allotments.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { Transaction, StockPool, UserBalance, sequelize, CommissionConfig } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')
const { toCNY, getCurrencySymbol } = require('../utils/currency')

const router = express.Router()

/**
 * GET /api/v1/transactions
 * Get the authenticated user's transaction history with date/trade-type/stock-code filters.
 * Defaults to the last 21 days. Includes current balance and commission rates.
 * Query: { stock_code?, start_date?, end_date?, trade_type?, page?, pageSize? }
 * Response: { code, data: { currentBalance, totalCost, list: Transaction[], total } }
 */
router.get('/', auth, async (req, res) => {
  try {
    const { stock_code, start_date, end_date, trade_type, page = 1, pageSize = 50 } = req.query

    const threeWeeksAgo = new Date()
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)
    const defaultStartDate = threeWeeksAgo.toISOString().split('T')[0]

    const where = { user_id: req.userId }
    
    if (stock_code) {
      where.stock_code = stock_code
    }
    
    if (start_date || end_date) {
      where.trade_date = {}
      if (start_date) {
        where.trade_date[Op.gte] = start_date
      } else {
        where.trade_date[Op.gte] = defaultStartDate
      }
      if (end_date) {
        where.trade_date[Op.lte] = end_date
      } else {
        where.trade_date[Op.lte] = new Date().toISOString().split('T')[0]
      }
    } else {
      where.trade_date = { [Op.gte]: defaultStartDate }
    }
    
    if (trade_type) where.trade_type = parseInt(trade_type)

    // 获取当前余额
    const balance = await UserBalance.findOne({ where: { user_id: req.userId } })
    const balanceData = balance ? {
      cash: parseFloat(balance.cash),
      totalCost: parseFloat(balance.total_cost)
    } : { cash: 0, totalCost: 0 }
    
    // 获取当前页的交易记录
    const { count, rows } = await Transaction.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * parseInt(pageSize),
      order: [['id', 'DESC']]
    })

    const commissionConfigs = await CommissionConfig.findAll()
    const configMap = {}
    for (const c of commissionConfigs) {
      configMap[`${c.market_type}_${c.trade_type}`] = parseFloat(c.commission_rate)
    }

    // 构建结果 - 直接从数据库读取balance_after
    const result = []
    for (const t of rows) {
      const currency = getCurrencySymbol(t.market_type)
      const amountCNY = toCNY(parseFloat(t.amount), t.market_type)
      
      let stockName = t.stock_name || t.stock_code
      try {
        const pool = await StockPool.findOne({ 
          where: { stock_code: t.stock_code, market_type: t.market_type } 
        })
        if (pool && pool.stock_name) {
          stockName = pool.stock_name
        }
      } catch (e) {
        console.log('StockPool query error:', e.message)
      }

      let commissionRateVal = parseFloat(t.commission_rate || 0)
      if (!commissionRateVal || commissionRateVal === 0) {
        const key = `${t.market_type}_${t.trade_type}`
        const configRate = configMap[key]
        commissionRateVal = configRate ? configRate : 0.5
      }

      result.push({
        id: t.id,
        stockCode: t.stock_code,
        stockName: stockName,
        marketType: t.market_type,
        currency,
        tradeType: t.trade_type,
        price: parseFloat(t.price),
        shares: t.shares,
        amount: parseFloat(t.amount),
        amountCNY,
        commission: parseFloat(t.commission || 0),
        commissionRate: commissionRateVal,
        balanceAfter: t.balance_after ? parseFloat(t.balance_after) : 0,
        profit: t.profit ? parseFloat(t.profit) : null,
        tradeDate: t.trade_date,
        status: t.status
      })
    }

    res.json({ 
      code: 0, 
      data: { 
        currentBalance: balanceData.cash,
        totalCost: balanceData.totalCost,
        list: result, 
        total: count 
      } 
    })
  } catch (err) {
    console.log('transactions error:', err.message)
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/transactions/fund-flow
 * Get fund flow analysis showing deposits, buy/sell amounts, dividends, and allotments
 * within a date range (defaults to last month).
 * Query: { start_date?, end_date? }
 * Response: { code, data: { list: Array<{ tradeDate, tradeType, typeLabel, changeAmount, balanceAfter, ... }> } }
 */
router.get('/fund-flow', auth, async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const defaultStart = oneMonthAgo.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const where = { user_id: req.userId }
    where.trade_date = {
      [Op.gte]: start_date || defaultStart,
      [Op.lte]: end_date || today
    }

    const rows = await Transaction.findAll({
      where,
      order: [['id', 'DESC']]
    })

    const result = rows.map(t => {
      let typeLabel = ''
      let changeAmount = 0
      switch (t.trade_type) {
        case 5:
          typeLabel = 'initial_fund'
          changeAmount = parseFloat(t.amount)
          break
        case 1:
          typeLabel = 'buy_stock'
          changeAmount = -(parseFloat(t.amount) + parseFloat(t.commission || 0))
          break
        case 2:
          typeLabel = 'sell_stock'
          changeAmount = parseFloat(t.amount) - parseFloat(t.commission || 0)
          break
        case 3:
          typeLabel = 'dividend'
          changeAmount = parseFloat(t.amount)
          break
        case 4:
          typeLabel = 'allotment'
          changeAmount = 0
          break
        default:
          typeLabel = 'unknown'
      }

      return {
        id: t.id,
        tradeDate: t.trade_date,
        tradeType: t.trade_type,
        typeLabel,
        stockCode: t.stock_code || '',
        stockName: t.stock_name || '',
        shares: t.shares,
        amount: parseFloat(t.amount || 0),
        commission: parseFloat(t.commission || 0),
        changeAmount,
        balanceAfter: parseFloat(t.balance_after || 0),
        marketType: t.market_type
      }
    })

    res.json({ code: 0, data: { list: result } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router