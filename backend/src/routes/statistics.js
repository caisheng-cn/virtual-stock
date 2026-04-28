/**
 * File: statistics.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: User statistics routes. Provides profit analysis (floating vs realized),
 *   position summary statistics, and trade activity overview for the authenticated user.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { Transaction, UserBalance, Position, Group, sequelize } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')
const { toCNY } = require('../utils/currency')

const router = express.Router()
const INIT_CASH = 7000000

/**
 * GET /api/v1/statistics/profit
 * Get profit statistics: floating profit/loss from current positions and realized
 * profit from closed trades.
 * Response: { code, data: { period, floatingProfit, floatingProfitRate, realizedProfit, positionCount } }
 */
router.get('/profit', auth, async (req, res) => {
  try {
    const balance = await UserBalance.findOne({ where: { user_id: req.userId } })
    if (!balance) {
      return res.json({ code: -1, message: '数据不存在' })
    }

    const cash = parseFloat(balance.cash)
    const totalCost = parseFloat(balance.total_cost)

    const positions = await Position.findAll({ where: { user_id: req.userId, shares: { [Op.gt]: 0 } } })
    let totalMarketValue = 0
    let totalPositionCost = 0
    for (const p of positions) {
      const stockService = require('../services/stock')
      try {
        const quote = await stockService.getQuote(p.stock_code, p.market_type)
        const priceInCNY = toCNY(quote.price, p.market_type)
        totalMarketValue += p.shares * priceInCNY
        totalPositionCost += parseFloat(p.total_cost)
      } catch (err) {
        totalMarketValue += p.shares * parseFloat(p.avg_cost)
        totalPositionCost += parseFloat(p.total_cost)
      }
    }

    const floatingProfit = totalMarketValue - totalPositionCost
    const floatingProfitRate = totalPositionCost > 0 ? (floatingProfit / totalPositionCost) * 100 : 0

    const realizedProfitResult = await Transaction.findAll({
      where: { user_id: req.userId, trade_type: 2, profit: { [Op.ne]: null } }
    })
    let realizedProfit = 0
    for (const t of realizedProfitResult) {
      realizedProfit += parseFloat(t.profit) || 0
    }

    res.json({
      code: 0,
      data: {
        period: 'all',
        floatingProfit,
        floatingProfitRate,
        realizedProfit,
        positionCount: positions.length
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/statistics/positions
 * Get summary statistics for all current positions: total market value, total cost,
 * floating profit, and position count.
 * Response: { code, data: { totalMarketValue, totalPositionCost, floatingProfit, floatingProfitRate, positionCount } }
 */
router.get('/positions', auth, async (req, res) => {
  try {
    const positions = await Position.findAll({ where: { user_id: req.userId, shares: { [Op.gt]: 0 } } })
    const stockService = require('../services/stock')

    let totalMarketValue = 0
    let totalPositionCost = 0
    let totalFloatingProfit = 0
    for (const p of positions) {
      try {
        const quote = await stockService.getQuote(p.stock_code, p.market_type)
        const priceInCNY = toCNY(quote.price, p.market_type)
        const marketValue = p.shares * priceInCNY
        totalMarketValue += marketValue
        totalPositionCost += parseFloat(p.total_cost)
        totalFloatingProfit += marketValue - parseFloat(p.total_cost)
      } catch (err) {
        totalMarketValue += p.shares * parseFloat(p.avg_cost)
        totalPositionCost += parseFloat(p.total_cost)
      }
    }

    const floatingProfitRate = totalPositionCost > 0 ? (totalFloatingProfit / totalPositionCost) * 100 : 0

    res.json({
      code: 0,
      data: {
        totalMarketValue,
        totalPositionCost,
        floatingProfit: totalFloatingProfit,
        floatingProfitRate,
        positionCount: positions.length
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/statistics/trades
 * Get trade activity statistics: total trades, buy/sell breakdown, and total turnover.
 * Response: { code, data: { totalTrades, buyTrades, sellTrades, totalAmount } }
 */
router.get('/trades', auth, async (req, res) => {
  try {
    const where = { user_id: req.userId }

    const trades = await Transaction.findAll({ where, order: [['trade_date', 'DESC']] })
    const buyTrades = trades.filter(t => t.trade_type === 1)
    const sellTrades = trades.filter(t => t.trade_type === 2)
    
    let totalAmount = 0
    for (const t of trades) {
      const amountInCNY = toCNY(parseFloat(t.amount), t.market_type)
      totalAmount += amountInCNY
    }

    res.json({
      code: 0,
      data: {
        totalTrades: trades.length,
        buyTrades: buyTrades.length,
        sellTrades: sellTrades.length,
        totalAmount
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router