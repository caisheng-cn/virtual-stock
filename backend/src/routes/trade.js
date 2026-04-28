/**
 * File: trade.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Stock trading routes. Handles buy and sell orders with balance validation,
 *   position tracking, commission calculation, and transaction recording. All trades are
 *   wrapped in database transactions for consistency.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { Transaction, Position, UserBalance, User, StockPricesCache, MarketConfig, GroupMessage, UserGroup, sequelize } = require('../models')
const auth = require('../utils/auth')
const stockService = require('../services/stock')
const commissionService = require('../services/commission')
const { toCNY } = require('../utils/currency')

const router = express.Router()

/**
 * Create a group message after a trade (buy/sell/dividend/allotment).
 * Broadcasts the trade event to all groups the user belongs to.
 * @param {number} userId - The user making the trade
 * @param {number} mType - Message type: 1 (buy), 2 (sell), 3 (dividend), 4 (allotment)
 * @param {string} code - Stock code
 * @param {string} name - Stock name
 * @param {number} marketType - Market type
 * @param {number} shares - Number of shares traded
 * @param {number} price - Trade price per share
 * @param {number} amount - Total trade amount
 * @returns {Promise<void>}
 */
async function createGroupMessage(userId, mType, code, name, marketType, shares, price, amount) {
  try {
    const userGroups = await UserGroup.findAll({ where: { user_id: userId } })
    if (userGroups.length === 0) return
    const typeLabels = { 1: '买入', 2: '卖出', 3: '分红', 4: '配股' }
    const label = typeLabels[mType] || ''
    const content = `${label} ${name}(${code}) ${shares}股, 单价¥${parseFloat(price || 0).toFixed(2)}`
    for (const ug of userGroups) {
      await GroupMessage.create({
        group_id: ug.group_id,
        user_id: userId,
        message_type: mType,
        stock_code: code,
        stock_name: name,
        market_type: marketType,
        shares,
        price: parseFloat(price || 0),
        amount: parseFloat(amount || 0),
        content
      })
    }
  } catch (e) {
    console.log('Create group message error:', e.message)
  }
}

/**
 * Check if the user's account is enabled and trade-enabled.
 * @param {Object} user - User model instance
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<Object|null>} JSON response if blocked, null if allowed
 */
const checkTradeEnabled = async (user, res) => {
   if (user.status === 0) {
     return res.json({ code: -1, message: res.t('auth.user_disabled') })
   }
   if (user.trade_enabled === 0) {
     return res.json({ code: -1, message: res.t('auth.trade_disabled') })
   }
   return null
 }

/**
 * Check if the current time is within the allowed trading window for a market type.
 * If the market config has trading time restrictions disabled, the check is skipped.
 * @param {number} marketType - Market type
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<Object|null>} JSON response if outside trading hours, null if allowed
 */
const checkTradeTime = async (marketType, res) => {
   const config = await MarketConfig.findOne({ where: { market_type: marketType } })
   if (!config) {
     return res.json({ code: -1, message: res.t('trade.market_config_missing') })
   }
   // If trading time restriction is disabled (enabled: 0), skip time check
   if (config.enabled === 0) {
     return null
   }
   // If enabled, check time
   const now = new Date()
   // Format current time as HH:mm (24-hour)
   const currentTime = now.toTimeString().slice(0, 5)
   // Assuming trade_start and trade_end are in HH:mm format
   if (currentTime < config.trade_start || currentTime > config.trade_end) {
     return res.json({ code: -1, message: res.t('trade.trade_disabled_time') })
   }
   return null
 }

/**
 * POST /api/v1/trade/buy
 * Execute a buy order. Validates user status, trading time, available balance,
 * creates/updates position, deducts cash, records transaction, and broadcasts group message.
 * Body: { stock_code, market_type, shares }
 * Response: { code, message, data: { tradeId, stockCode, price, shares, amount, commission, ... } }
 */
router.post('/buy', auth, async (req, res) => {
   const t = await sequelize.transaction()
   try {
     const { stock_code, market_type, shares } = req.body
     if (!stock_code || !market_type || !shares) {
       return res.json({ code: -1, message: res.t('trade.parameter_missing') })
     }

     const user = await User.findByPk(req.userId)
     if (!user) {
       return res.json({ code: -1, message: res.t('auth.user_not_found') })
     }
    const check = await checkTradeEnabled(user, res)
    if (check) return

    const tradeCheck = await checkTradeTime(market_type, res)
    if (tradeCheck) return

    const quote = await stockService.getQuote(stock_code, market_type)
    const priceInCNY = toCNY(quote.price, market_type)
    const amount = priceInCNY * shares

    const commissionRate = await commissionService.getCommissionRate(market_type, 1)
    const commission = commissionService.calculateCommission(amount, commissionRate)
    const totalDeduct = amount + commission

     const balance = await UserBalance.findOne({ where: { user_id: req.userId } })
     if (!balance) {
       return res.json({ code: -1, message: res.t('trade.account_not_exist') })
     }
     if (parseFloat(balance.cash) < totalDeduct) {
       return res.json({ code: -1, message: res.t('trade.insufficient_balance_with_commission') })
     }

    const today = new Date().toISOString().split('T')[0]

    const existingPosition = await Position.findOne({ where: { user_id: req.userId, stock_code } })
    if (existingPosition) {
      const newShares = existingPosition.shares + shares
      const newTotalCost = parseFloat(existingPosition.total_cost) + amount + commission
      const newAvgCost = newTotalCost / newShares
      await Position.update({
        shares: newShares,
        avg_cost: newAvgCost,
        total_cost: newTotalCost
      }, { where: { id: existingPosition.id }, transaction: t })
    } else {
      await Position.create({
        user_id: req.userId,
        stock_code,
        market_type,
        shares,
        avg_cost: (amount + commission) / shares,
        total_cost: amount + commission
      }, { transaction: t })
    }

    await UserBalance.decrement('cash', { by: totalDeduct, where: { user_id: req.userId }, transaction: t })
    await UserBalance.increment('total_cost', { by: amount, where: { user_id: req.userId }, transaction: t })

    const currentBalance = await UserBalance.findOne({ where: { user_id: req.userId }, transaction: t })
    const balanceAfterBuy = parseFloat(currentBalance.cash)

    await Transaction.create({
      user_id: req.userId,
      group_id: 0,
      stock_code,
      stock_name: quote.stockName,
      market_type,
      trade_type: 1,
      price: quote.price,
      shares,
      amount,
      commission,
      commission_rate: commissionRate,
      balance_after: balanceAfterBuy,
      trade_date: today,
      status: 1
    }, { transaction: t })

     await t.commit()
      createGroupMessage(req.userId, 1, stock_code, quote.stockName, market_type, shares, quote.price, amount)
      res.json({
        code: 0,
        message: res.t('common.success'),
        data: {
          tradeId: Date.now(),
          userId: req.userId,
          stockCode: stock_code,
          stockName: quote.stockName,
          price: quote.price,
          priceInCNY,
          shares,
          amount,
          commission,
          commissionRate,
          totalDeduct,
          tradeDate: today,
          status: 1
        }
      })
    } catch (err) {
      await t.rollback()
      res.json({ code: -1, message: res.t('common.error') })
    }
});

/**
 * POST /api/v1/trade/sell
 * Execute a sell order. Validates user status, trading time, position sufficiency,
 * updates/deletes position, adds cash, records transaction with realized profit, broadcasts message.
 * Body: { stock_code, market_type, shares }
 * Response: { code, message, data: { tradeId, stockCode, price, shares, amount, commission, netAmount, ... } }
 */
router.post('/sell', auth, async (req, res) => {
   const t = await sequelize.transaction()
   try {
     const { stock_code, market_type, shares } = req.body
     if (!stock_code || !market_type || !shares) {
       return res.json({ code: -1, message: res.t('trade.parameter_missing') })
     }

     const user = await User.findByPk(req.userId)
     if (!user) {
       return res.json({ code: -1, message: res.t('auth.user_not_found') })
     }
    const check = await checkTradeEnabled(user, res)
    if (check) return

    const tradeCheck = await checkTradeTime(market_type, res)
    if (tradeCheck) return

    const quote = await stockService.getQuote(stock_code, market_type)
    const priceInCNY = toCNY(quote.price, market_type)
    const amount = priceInCNY * shares

    const commissionRate = await commissionService.getCommissionRate(market_type, 2)
    const commission = commissionService.calculateCommission(amount, commissionRate)
    const netAmount = amount - commission

     const position = await Position.findOne({ where: { user_id: req.userId, stock_code } })
     if (!position || position.shares < shares) {
       return res.json({ code: -1, message: res.t('trade.position_not_enough') })
     }

    const avgCost = parseFloat(position.avg_cost)
    const realizedProfit = netAmount - (shares * avgCost)

    const today = new Date().toISOString().split('T')[0]

    const sharesToDecrement = shares
    const costToDecrement = position.shares === shares 
      ? parseFloat(position.total_cost) 
      : (parseFloat(position.avg_cost) * shares)

    await UserBalance.increment('cash', { by: netAmount, where: { user_id: req.userId }, transaction: t })
    await UserBalance.decrement('total_cost', { by: costToDecrement, where: { user_id: req.userId }, transaction: t })

    if (position.shares === shares) {
      await Position.destroy({ where: { id: position.id }, transaction: t })
    } else {
      const newShares = position.shares - shares
      const newTotalCost = parseFloat(position.total_cost) - costToDecrement
      const newAvgCost = newTotalCost / newShares
      await Position.update({
        shares: newShares,
        avg_cost: newAvgCost,
        total_cost: newTotalCost
      }, { where: { id: position.id }, transaction: t })
    }

    const currentBalance = await UserBalance.findOne({ where: { user_id: req.userId }, transaction: t })
    const balanceAfterSell = parseFloat(currentBalance.cash)

    await Transaction.create({
      user_id: req.userId,
      group_id: 0,
      stock_code,
      stock_name: quote.stockName,
      market_type,
      trade_type: 2,
      price: quote.price,
      shares,
      amount,
      commission,
      commission_rate: commissionRate,
      balance_after: balanceAfterSell,
      trade_date: today,
      status: 1,
      profit: realizedProfit
     }, { transaction: t })

      await t.commit()
      createGroupMessage(req.userId, 2, stock_code, quote.stockName, market_type, shares, quote.price, amount)
      res.json({
        code: 0,
        message: res.t('common.success'),
        data: {
          tradeId: Date.now(),
          userId: req.userId,
          stockCode: stock_code,
          stockName: quote.stockName,
          price: quote.price,
          priceInCNY,
          shares,
          amount,
          commission,
          commissionRate,
          netAmount,
          tradeDate: today,
          status: 1
        }
     })
  } catch (err) {
    await t.rollback()
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router