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
const { UserBalance, Position, Group, StockPrice, OptionPosition, OptionContract, OptionPrice, sequelize } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')
const stockService = require('../services/stock')
const optionService = require('../services/option')
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
    const groupId = req.query.group_id ? parseInt(req.query.group_id) : null
    let balance = groupId
      ? await UserBalance.findOne({ where: { user_id: req.userId, group_id: groupId } })
      : null
    if (!balance) {
      balance = await UserBalance.findOne({ where: { user_id: req.userId } })
    }
    if (!balance) {
      return res.json({ code: -1, message: '账户不存在' })
    }
    const actualGroupId = balance.group_id
    const positionWhere = { user_id: req.userId, shares: { [Op.gt]: 0 }, group_id: { [Op.in]: [actualGroupId, 0] } }
    const positions = await Position.findAll({ where: positionWhere })

    let totalMarketValue = 0
    
    for (const p of positions) {
      try {
        const quote = await stockService.getQuote(p.stock_code, p.market_type)
        const priceInCNY = toCNY(quote.price, p.market_type)
        totalMarketValue += p.shares * priceInCNY
      } catch (err) {
        try {
          const lastPrice = await StockPrice.findOne({
            where: { stock_code: p.stock_code, market_type: p.market_type },
            order: [['trade_date', 'DESC']]
          })
          if (lastPrice) {
            totalMarketValue += p.shares * toCNY(parseFloat(lastPrice.close_price), p.market_type)
          } else {
            totalMarketValue += p.shares * parseFloat(p.avg_cost)
          }
        } catch (e) {
          totalMarketValue += p.shares * parseFloat(p.avg_cost)
        }
      }
    }

    let optionMarketValue = 0
    try {
      const optionPositions = await OptionPosition.findAll({
        where: { user_id: req.userId, group_id: actualGroupId, status: 1 },
        raw: true
      })
      if (optionPositions.length) {
        const contractIds = optionPositions.map(p => p.contract_id)
        const contracts = await OptionContract.findAll({ where: { id: { [Op.in]: contractIds } }, raw: true })
        const contractMap = {}
        for (const c of contracts) contractMap[c.id] = c
        const today = new Date().toISOString().split('T')[0]
        const prices = await OptionPrice.findAll({ where: { contract_id: { [Op.in]: contractIds }, trade_date: today }, raw: true })
        const priceMap = {}
        for (const p of prices) priceMap[p.contract_id] = p
        for (const pos of optionPositions) {
          const c = contractMap[pos.contract_id]
          const pr = priceMap[pos.contract_id]
          if (c && pr) {
            const mv = parseFloat(pr.premium) * pos.quantity * (c.contract_multiplier || 100)
            const mvCNY = toCNY(mv, c.market_type)
            optionMarketValue += mvCNY
          }
        }
      }
    } catch (e) {}

    let initCash = parseFloat(balance.init_cash)
    if (!initCash) {
      const group = await Group.findByPk(balance.group_id)
      initCash = group ? parseFloat(group.init_cash) : 0
    }
    if (!initCash) initCash = 0
    const cash = parseFloat(balance.cash)
    const totalAssets = cash + totalMarketValue + optionMarketValue
    const profit = totalAssets - initCash
    const profitRate = initCash > 0 ? (profit / initCash) * 100 : 0

    res.json({
      code: 0,
      data: {
        initCash,
        cash,
        frozenCash: parseFloat(balance.frozen_cash),
        totalMarketValue,
        optionMarketValue,
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