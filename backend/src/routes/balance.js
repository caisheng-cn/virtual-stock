/**
 * File: balance.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Account balance routes. Returns the authenticated user's cash balance,
 *   frozen cash, total market value of positions, total assets, and profit/loss.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { UserBalance, Position, Group, sequelize } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')
const stockService = require('../services/stock')
const { toCNY } = require('../utils/currency')

const router = express.Router()

/**
 * GET /api/v1/balance
 * Get the authenticated user's account balance, including cash, frozen cash, total
 * market value of positions, total assets, and overall profit/loss.
 * Response: { code, data: { initCash, cash, frozenCash, totalMarketValue, totalAssets, profit, profitRate } }
 */
router.get('/', auth, async (req, res) => {
  try {
    const balance = await UserBalance.findOne({ where: { user_id: req.userId } })
    if (!balance) {
      return res.json({ code: -1, message: '账户不存在' })
    }

    const positions = await Position.findAll({ where: { user_id: req.userId, shares: { [Op.gt]: 0 } } })

    let totalMarketValue = 0
    
    for (const p of positions) {
      try {
        const quote = await stockService.getQuote(p.stock_code, p.market_type)
        const priceInCNY = toCNY(quote.price, p.market_type)
        const marketValue = p.shares * priceInCNY
        totalMarketValue += marketValue
      } catch (err) {
        console.log('Quote error for', p.stock_code, ':', err.message)
      }
    }

    const initCash = parseFloat(balance.init_cash) || 7000000
    const cash = parseFloat(balance.cash)
    const totalAssets = cash + totalMarketValue
    const profit = totalAssets - initCash
    const profitRate = initCash > 0 ? (profit / initCash) * 100 : 0

    res.json({
      code: 0,
      data: {
        initCash,
        cash,
        frozenCash: parseFloat(balance.frozen_cash),
        totalMarketValue,
        totalAssets,
        profit,
        profitRate
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router