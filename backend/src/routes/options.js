const express = require('express')
const { Op } = require('sequelize')
const { User, UserBalance, UserGroup, GroupMessage, OptionContract, OptionPosition, OptionTransaction, OptionPrice, OptionWhitelist, sequelize } = require('../models')
const auth = require('../utils/auth')
const optionService = require('../services/option')
const { isTradingHours, isAnyTradingHours } = require('../utils/marketTime')

const router = express.Router()

async function broadcastOptionMessage(userId, mType, contract, quantity, price, premium, profit) {
  try {
    const userGroups = await UserGroup.findAll({ where: { user_id: userId } })
    if (!userGroups.length) return
    const typeLabels = { 5: '买入开仓', 6: '卖出平仓', 7: '行权', 8: '到期结算' }
    const label = typeLabels[mType] || ''
    const optLabel = contract.option_type === 'call' ? 'Call' : 'Put'
    const content = `${label} ${contract.stock_code || contract.underlying_code} ${contract.stock_name || contract.contract_name} | ${optLabel} 行权价${contract.strike_price} 到期${contract.expiration_date} | ${quantity}张 权利金¥${premium.toFixed(2)}`
    for (const ug of userGroups) {
      await GroupMessage.create({
        group_id: ug.group_id,
        user_id: userId,
        message_type: mType,
        stock_code: contract.stock_code || contract.underlying_code,
        stock_name: contract.stock_name || contract.contract_name,
        market_type: contract.market_type || 1,
        shares: quantity,
        price: parseFloat(price),
        amount: premium,
        content,
        option_type: contract.option_type,
        strike_price: contract.strike_price,
        expiration_date: contract.expiration_date,
        quantity
      })
    }
  } catch (e) {
    console.log('Broadcast option message error:', e.message)
  }
}

/**
 * GET /api/v1/options/whitelist - Get option underlying whitelist
 */
router.get('/whitelist', auth, async (req, res) => {
  try {
    const list = await OptionWhitelist.findAll({ where: { status: 1 }, raw: true })
    const result = list.map(w => ({
      ...w,
      isTradingHours: isTradingHours(w.exchange || 'SSE'),
    }))
    res.json({ code: 0, data: result })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/options/expirations - Get available expiration dates
 */
router.get('/expirations', auth, async (req, res) => {
  try {
    const { stock_code, market_type, exchange } = req.query
    if (!stock_code) {
      return res.json({ code: -1, message: res.t('trade.parameter_missing') })
    }
    const today = new Date().toISOString().split('T')[0]
    const where = {
      stock_code,
      expiration_date: { [Op.gte]: today },
      status: 1
    }
    if (exchange) where.exchange = exchange
    const rows = await OptionContract.findAll({
      where,
      attributes: ['expiration_date', 'exchange'],
      group: ['expiration_date', 'exchange'],
      order: [['expiration_date', 'ASC']],
      raw: true
    })
    const dates = rows.map(r => ({
      date: r.expiration_date,
      exchange: r.exchange || '',
    }))
    res.json({ code: 0, data: dates })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/options/contracts - Get option chain
 */
router.get('/contracts', auth, async (req, res) => {
  try {
    const { stock_code, market_type, expiration, exchange } = req.query
    if (!stock_code) {
      return res.json({ code: -1, message: res.t('trade.parameter_missing') })
    }
    let chain = await optionService.getOptionChain(stock_code, parseInt(market_type || 1), expiration || null)
    if (!chain) {
      const whitelist = await OptionWhitelist.findOne({
        where: { stock_code, status: 1 },
        raw: true
      })
      if (whitelist) {
        const underlyingPrice = await optionService.getUnderlyingPrice(stock_code, parseInt(market_type || 1))
        if (underlyingPrice) {
          await optionService.ensureContracts(stock_code, parseInt(market_type || 1))
          await optionService.refreshPrices(stock_code, parseInt(market_type || 1))
          chain = await optionService.getOptionChain(stock_code, parseInt(market_type || 1), expiration || null)
        }
      }
    }
    if (!chain) {
      return res.json({ code: -1, message: '暂无可用合约' })
    }
    res.json({
      code: 0,
      data: {
        ...chain,
        isTradingHours: isAnyTradingHours(),
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/options/buy - Buy to open
 */
router.post('/buy', auth, async (req, res) => {
  const t = await sequelize.transaction()
  try {
    const { contract_id, quantity, group_id: groupIdParam } = req.body
    if (!contract_id || !quantity || quantity < 1) {
      return res.json({ code: -1, message: res.t('trade.parameter_missing') })
    }
    const user = await User.findByPk(req.userId)
    if (!user) return res.json({ code: -1, message: res.t('auth.user_not_found') })
    if (user.status === 0 || user.trade_enabled === 0) {
      return res.json({ code: -1, message: res.t('auth.trade_disabled') })
    }

    const contract = await OptionContract.findByPk(contract_id)
    if (!contract || contract.status !== 1) return res.json({ code: -1, message: '合约不可用' })
    const today = new Date().toISOString().split('T')[0]
    if (contract.expiration_date <= today) return res.json({ code: -1, message: '合约已到期' })

    const priceRow = await OptionPrice.findOne({
      where: { contract_id, trade_date: today },
      raw: true
    })
    if (!priceRow) return res.json({ code: -1, message: '暂无报价，请稍后再试' })

    const multiplier = contract.contract_multiplier || 10000
    const premium = parseFloat(priceRow.premium) * quantity * multiplier
    const commission = Math.round(premium * optionService.OPTION_COMMISSION_RATE / 1000 * 100) / 100
    const totalDeduct = premium + commission

    let balance = await UserBalance.findOne({ where: { user_id: req.userId, group_id: groupIdParam || 0 } })
    if (!balance) balance = await UserBalance.findOne({ where: { user_id: req.userId } })
    if (!balance) return res.json({ code: -1, message: res.t('trade.account_not_exist') })
    const actualGroupId = balance.group_id

    if (parseFloat(balance.cash) < totalDeduct) {
      return res.json({ code: -1, message: '可用余额不足' })
    }

    const existingPos = await OptionPosition.findOne({
      where: { user_id: req.userId, group_id: actualGroupId, contract_id, status: 1 }
    })
    if (existingPos) {
      const newQty = existingPos.quantity + quantity
      const newTotalCost = parseFloat(existingPos.total_cost) + premium + commission
      await OptionPosition.update({
        quantity: newQty,
        total_cost: newTotalCost,
        avg_cost: newTotalCost / newQty
      }, { where: { id: existingPos.id }, transaction: t })
    } else {
      await OptionPosition.create({
        user_id: req.userId,
        group_id: actualGroupId,
        contract_id,
        quantity,
        avg_cost: (premium + commission) / quantity,
        total_cost: premium + commission,
        status: 1
      }, { transaction: t })
    }

    await UserBalance.decrement('cash', { by: totalDeduct, where: { user_id: req.userId, group_id: actualGroupId }, transaction: t })
    const currentBalance = await UserBalance.findOne({ where: { user_id: req.userId, group_id: actualGroupId }, transaction: t })
    const balanceAfter = currentBalance ? parseFloat(currentBalance.cash) : 0

    await OptionTransaction.create({
      user_id: req.userId,
      group_id: actualGroupId,
      contract_id,
      stock_code: contract.stock_code || contract.underlying_code,
      stock_name: contract.stock_name || contract.contract_name,
      option_type: contract.option_type,
      strike_price: contract.strike_price,
      expiration_date: contract.expiration_date,
      trade_type: 1,
      quantity,
      price: parseFloat(priceRow.premium),
      premium,
      commission,
      commission_rate: optionService.OPTION_COMMISSION_RATE,
      balance_after: balanceAfter,
      trade_date: today,
      status: 1
    }, { transaction: t })

    await t.commit()
    broadcastOptionMessage(req.userId, 5, contract, quantity, priceRow.premium, premium)
    res.json({
      code: 0,
      data: {
        transactionId: Date.now(),
        contractId: contract.id,
        optionType: contract.option_type,
        strikePrice: parseFloat(contract.strike_price),
        expiration: contract.expiration_date,
        quantity,
        price: parseFloat(priceRow.premium),
        premium,
        commission,
        totalDeduct,
        balanceAfter,
        tradeDate: today
      }
    })
  } catch (err) {
    await t.rollback()
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/options/sell - Sell to close
 */
router.post('/sell', auth, async (req, res) => {
  const t = await sequelize.transaction()
  try {
    const { position_id, quantity } = req.body
    if (!position_id || !quantity || quantity < 1) {
      return res.json({ code: -1, message: res.t('trade.parameter_missing') })
    }
    const position = await OptionPosition.findByPk(position_id)
    if (!position || position.user_id !== req.userId || position.status !== 1) {
      return res.json({ code: -1, message: '持仓不存在' })
    }
    if (position.quantity < quantity) {
      return res.json({ code: -1, message: '持仓张数不足' })
    }

    const contract = await OptionContract.findByPk(position.contract_id)
    if (!contract) return res.json({ code: -1, message: '合约不存在' })
    const today = new Date().toISOString().split('T')[0]
    const priceRow = await OptionPrice.findOne({ where: { contract_id: contract.id, trade_date: today }, raw: true })
    if (!priceRow) return res.json({ code: -1, message: '暂无报价' })

    const multiplier = contract.contract_multiplier || 10000
    const sellPrice = parseFloat(priceRow.premium)
    const premiumReceived = sellPrice * quantity * multiplier
    const commission = Math.round(premiumReceived * optionService.OPTION_COMMISSION_RATE / 1000 * 100) / 100
    const netAmount = premiumReceived - commission

    const costPerUnit = parseFloat(position.total_cost) / position.quantity
    const costOfSold = costPerUnit * quantity
    const profit = netAmount - costOfSold

    await UserBalance.increment('cash', { by: netAmount, where: { user_id: req.userId, group_id: position.group_id }, transaction: t })
    const currentBalance = await UserBalance.findOne({ where: { user_id: req.userId, group_id: position.group_id }, transaction: t })
    const balanceAfter = currentBalance ? parseFloat(currentBalance.cash) : 0

    if (position.quantity === quantity) {
      await OptionPosition.update({ status: 2, quantity: 0 }, { where: { id: position.id }, transaction: t })
    } else {
      const newQty = position.quantity - quantity
      const newTotalCost = parseFloat(position.total_cost) - costOfSold
      await OptionPosition.update({
        quantity: newQty,
        total_cost: newTotalCost,
        avg_cost: newTotalCost / newQty
      }, { where: { id: position.id }, transaction: t })
    }

    await OptionTransaction.create({
      user_id: req.userId,
      group_id: position.group_id,
      contract_id: contract.id,
      stock_code: contract.stock_code || contract.underlying_code,
      stock_name: contract.stock_name || contract.contract_name,
      option_type: contract.option_type,
      strike_price: contract.strike_price,
      expiration_date: contract.expiration_date,
      trade_type: 2,
      quantity,
      price: sellPrice,
      premium: premiumReceived,
      commission,
      commission_rate: optionService.OPTION_COMMISSION_RATE,
      profit,
      balance_after: balanceAfter,
      trade_date: today,
      status: 1
    }, { transaction: t })

    await t.commit()
    broadcastOptionMessage(req.userId, 6, contract, quantity, sellPrice, premiumReceived, profit)
    res.json({
      code: 0,
      data: {
        positionId: position.id,
        quantity,
        sellPrice,
        premiumReceived,
        costBasis: costOfSold,
        profit,
        commission,
        netAmount,
        balanceAfter,
        tradeDate: today
      }
    })
  } catch (err) {
    await t.rollback()
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/options/exercise - Exercise an option
 */
router.post('/exercise', auth, async (req, res) => {
  const t = await sequelize.transaction()
  try {
    const { position_id, quantity } = req.body
    if (!position_id || !quantity || quantity < 1) {
      return res.json({ code: -1, message: res.t('trade.parameter_missing') })
    }
    const position = await OptionPosition.findByPk(position_id)
    if (!position || position.user_id !== req.userId || position.status !== 1) {
      return res.json({ code: -1, message: '持仓不存在' })
    }
    if (position.quantity < quantity) {
      return res.json({ code: -1, message: '持仓张数不足' })
    }

    const contract = await OptionContract.findByPk(position.contract_id)
    if (!contract) return res.json({ code: -1, message: '合约不存在' })

    // 欧式期权不允许提前行权
    if (contract.exercise_type === 2) {
      return res.json({ code: -1, message: '该期权为欧式行权，到期自动结算，不支持提前行权' })
    }

    const today = new Date().toISOString().split('T')[0]
    const underlyingPrice = await optionService.getUnderlyingPrice(
      contract.stock_code || contract.underlying_code,
      contract.market_type,
      contract.exchange
    )
    if (!underlyingPrice) return res.json({ code: -1, message: '无法获取标的股价' })

    const strike = parseFloat(contract.strike_price)
    const multiplier = contract.contract_multiplier || 10000
    let settlementAmount = 0
    if (contract.option_type === 'call') {
      settlementAmount = Math.max(underlyingPrice - strike, 0) * quantity * multiplier
    } else {
      settlementAmount = Math.max(strike - underlyingPrice, 0) * quantity * multiplier
    }
    if (settlementAmount <= 0) {
      return res.json({ code: -1, message: '该期权目前为虚值，行权无收益' })
    }

    const costPerUnit = parseFloat(position.total_cost) / position.quantity
    const costOfExercised = costPerUnit * quantity
    const profit = settlementAmount - costOfExercised

    await UserBalance.increment('cash', { by: settlementAmount, where: { user_id: req.userId, group_id: position.group_id }, transaction: t })
    const currentBalance = await UserBalance.findOne({ where: { user_id: req.userId, group_id: position.group_id }, transaction: t })
    const balanceAfter = currentBalance ? parseFloat(currentBalance.cash) : 0

    if (position.quantity === quantity) {
      await OptionPosition.update({ status: 3, quantity: 0 }, { where: { id: position.id }, transaction: t })
    } else {
      const newQty = position.quantity - quantity
      const newTotalCost = parseFloat(position.total_cost) - costOfExercised
      await OptionPosition.update({
        quantity: newQty,
        total_cost: newTotalCost,
        avg_cost: newTotalCost / newQty
      }, { where: { id: position.id }, transaction: t })
    }

    await OptionTransaction.create({
      user_id: req.userId,
      group_id: position.group_id,
      contract_id: contract.id,
      stock_code: contract.stock_code || contract.underlying_code,
      stock_name: contract.stock_name || contract.contract_name,
      option_type: contract.option_type,
      strike_price: strike,
      expiration_date: contract.expiration_date,
      trade_type: 3,
      quantity,
      price: underlyingPrice,
      premium: settlementAmount,
      commission: 0,
      profit,
      balance_after: balanceAfter,
      trade_date: today,
      settlement_amount: settlementAmount,
      status: 1
    }, { transaction: t })

    await t.commit()
    broadcastOptionMessage(req.userId, 7, contract, quantity, 0, settlementAmount, profit)
    res.json({
      code: 0,
      data: {
        positionId: position.id,
        quantity,
        optionType: contract.option_type,
        strikePrice: strike,
        underlyingPrice,
        settlementAmount,
        costBasis: costOfExercised,
        profit,
        balanceAfter,
        tradeDate: today
      }
    })
  } catch (err) {
    await t.rollback()
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/options/positions - User's option positions
 */
router.get('/positions', auth, async (req, res) => {
  try {
    let groupId = req.query.group_id
    if (!groupId || groupId === '0') {
      const balance = await UserBalance.findOne({ where: { user_id: req.userId } })
      if (balance) groupId = balance.group_id
      else groupId = 0
    }
    const positions = await optionService.getUserOptionPositions(req.userId, parseInt(groupId))
    res.json({ code: 0, data: positions })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/options/transactions - Transaction history
 */
router.get('/transactions', auth, async (req, res) => {
  try {
    const { start_date, end_date, page = 1, pageSize = 20 } = req.query
    const where = { user_id: req.userId }
    if (start_date) where.trade_date = { ...where.trade_date, [Op.gte]: start_date }
    if (end_date) where.trade_date = { ...where.trade_date, [Op.lte]: end_date }
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const { rows, count } = await OptionTransaction.findAndCountAll({
      where,
      order: [['trade_date', 'DESC'], ['id', 'DESC']],
      offset,
      limit: parseInt(pageSize),
      raw: true
    })
    res.json({ code: 0, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
