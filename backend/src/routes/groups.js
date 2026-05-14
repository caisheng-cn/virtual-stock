/**
 * File: groups.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Group management routes. Supports listing all groups, user's groups,
 *   group details, join/leave operations, group ranking, and member asset details.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { Group, UserGroup, User, UserBalance, Position, StockPrice, StockPool, Transaction, sequelize } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')
const { toCNY, fromCNY, getCurrencySymbol } = require('../utils/currency')

const router = express.Router()

/**
 * GET /api/v1/groups
 * List all groups with optional status filter. Includes member count for each group.
 * Query: { page?, pageSize?, status? }
 * Response: { code, data: { list: Group[], total } }
 */
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status } = req.query
    const where = {}
    if (status !== undefined) where.status = status

    const { count, rows } = await Group.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })

    for (const g of rows) {
      const memberCount = await UserGroup.count({ where: { group_id: g.id } })
      g.dataValues.memberCount = memberCount
    }

    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/groups/my
 * List all groups the authenticated user is a member of.
 * Response: { code, data: Array<{ groupId, groupName, description, initCash, currency, memberCount }> }
 */
router.get('/my', auth, async (req, res) => {
  try {
    const userGroups = await UserGroup.findAll({ where: { user_id: req.userId } })
    const groupIds = userGroups.map(ug => ug.group_id)

    if (groupIds.length === 0) {
      return res.json({ code: 0, data: [] })
    }

    const groups = await Group.findAll({ 
      where: { id: groupIds },
      order: [['id', 'ASC']]
    })

    const result = await Promise.all(groups.map(async g => {
      const memberCount = await UserGroup.count({ where: { group_id: g.id } })
      return {
        groupId: g.id,
        groupName: g.name,
        description: g.description,
        initCash: parseFloat(g.init_cash),
        currency: g.currency,
        memberCount
      }
    }))

    res.json({ code: 0, data: result })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/groups/:id
 * Get a single group's details by ID. Includes member count.
 * Response: { code, data: Group }
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id)
    if (!group) {
      return res.json({ code: -1, message: '群组不存在' })
    }
    const memberCount = await UserGroup.count({ where: { group_id: group.id } })
    group.dataValues.memberCount = memberCount
    res.json({ code: 0, data: group })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/groups/join
 * Join a group. The user must not already be a member of the target group.
 * Body: { group_id }
 * Response: { code, message }
 */
router.post('/join', auth, async (req, res) => {
  try {
    const { group_id } = req.body
    if (!group_id) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    const group = await Group.findByPk(group_id)
    if (!group) {
      return res.json({ code: -1, message: '群组不存在' })
    }

    const exist = await UserGroup.findOne({ where: { user_id: req.userId, group_id } })
    if (exist) {
      return res.json({ code: -1, message: '已在群组中' })
    }

    await UserGroup.create({ user_id: req.userId, group_id })

    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/groups/leave
 * Leave a group. Removes the UserGroup membership record.
 * Body: { group_id }
 * Response: { code, message }
 */
router.post('/leave', auth, async (req, res) => {
  try {
    const { group_id } = req.body
    if (!group_id) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    await UserGroup.destroy({ where: { user_id: req.userId, group_id } })

    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * Calculate a member's total assets, cash, market value, and profit within a group.
 * @param {number} userId - The user ID
 * @param {number} groupId - The group ID
 * @returns {Promise<{cash: number, initCash: number, totalMarketValue: number, totalAssets: number, profit: number, profitRate: number}>}
 */
async function getMemberAssets(userId, groupId) {
  let balance = await UserBalance.findOne({ where: { user_id: userId, group_id: groupId } })
  if (!balance) {
    balance = await UserBalance.findOne({ where: { user_id: userId } })
  }
  const balanceGroupId = balance ? balance.group_id : groupId
  const cash = balance ? parseFloat(balance.cash) : 0
  let initCash = balance ? parseFloat(balance.init_cash) : 0
  if (!initCash) {
    const group = await Group.findByPk(balanceGroupId)
    initCash = group ? parseFloat(group.init_cash) : 0
  }
  if (!initCash) initCash = 0

  const positions = await Position.findAll({ where: { user_id: userId, group_id: { [Op.in]: [balanceGroupId, 0] }, shares: { [Op.gt]: 0 } } })
  let totalMarketValue = 0
  for (const p of positions) {
    const lastPrice = await StockPrice.findOne({
      where: { stock_code: p.stock_code, market_type: p.market_type },
      order: [['trade_date', 'DESC']]
    })
    if (lastPrice) {
      totalMarketValue += p.shares * toCNY(parseFloat(lastPrice.close_price), p.market_type)
    } else {
      totalMarketValue += p.shares * parseFloat(p.avg_cost)
    }
  }

  const totalAssets = cash + totalMarketValue
  const profit = totalAssets - initCash
  const profitRate = initCash > 0 ? (profit / initCash) * 100 : 0

  return { cash, initCash, totalMarketValue, totalAssets, profit, profitRate }
}

/**
 * GET /api/v1/groups/:groupId/ranking
 * Get the profit ranking for all members in a group. Sorted by total assets descending.
 * Response: { code, data: Array<{ userId, nickname, rank, totalAssets, profit, profitRate }> }
 */
router.get('/:groupId/ranking', auth, async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId)
    const members = await UserGroup.findAll({ where: { group_id: groupId } })
    const userIds = members.map(m => m.user_id)
    const users = await User.findAll({ where: { id: userIds }, attributes: ['id', 'nickname', 'username'] })
    const userMap = {}
    for (const u of users) userMap[u.id] = u.nickname || u.username

    const ranking = []
    for (const m of members) {
      const assets = await getMemberAssets(m.user_id, groupId)
      ranking.push({
        userId: m.user_id,
        nickname: userMap[m.user_id] || 'User',
        rank: 0,
        totalAssets: assets.totalAssets,
        profit: assets.profit,
        profitRate: assets.profitRate
      })
    }

    ranking.sort((a, b) => b.totalAssets - a.totalAssets)
    for (let i = 0; i < ranking.length; i++) {
      ranking[i].rank = i + 1
    }

    res.json({ code: 0, data: ranking })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/groups/:groupId/members/:userId/details
 * Get detailed information about a specific group member, including balance, positions,
 * and recent transactions (defaults to last 30 days).
 * Query: { page?, pageSize?, start_date?, end_date? }
 * Response: { code, data: { userId, nickname, balance, positions, transactions, totalTransactions } }
 */
router.get('/:groupId/members/:userId/details', auth, async (req, res) => {
  try {
    const { groupId, userId } = req.params

    const memberInGroup = await UserGroup.findOne({ where: { user_id: userId, group_id: groupId } })
    if (!memberInGroup) {
      return res.json({ code: -1, message: '该用户不在当前群组' })
    }

    const user = await User.findByPk(userId, { attributes: ['id', 'nickname', 'username'] })
    if (!user) {
      return res.json({ code: -1, message: '用户不存在' })
    }

    const assets = await getMemberAssets(parseInt(userId), parseInt(groupId))

    let memberBalance = await UserBalance.findOne({ where: { user_id: userId, group_id: groupId } })
    if (!memberBalance) {
      memberBalance = await UserBalance.findOne({ where: { user_id: userId } })
    }
    const memberGroupId = memberBalance ? memberBalance.group_id : parseInt(groupId)
  const positions = await Position.findAll({ where: { user_id: userId, group_id: { [Op.in]: [memberGroupId, 0] }, shares: { [Op.gt]: 0 } } })
    const positionList = []
    for (const p of positions) {
      let stockName = ''
      try {
        const pool = await StockPool.findOne({ where: { stock_code: p.stock_code, market_type: p.market_type } })
        if (pool) stockName = pool.stock_name
      } catch (e) {}
      const lastPrice = await StockPrice.findOne({
        where: { stock_code: p.stock_code, market_type: p.market_type },
        order: [['trade_date', 'DESC']]
      })
      const currentPriceOriginal = lastPrice ? parseFloat(lastPrice.close_price) : fromCNY(parseFloat(p.avg_cost), p.market_type)
      const priceInCNY = toCNY(currentPriceOriginal, p.market_type)
      const marketValueCNY = p.shares * priceInCNY
      const avgCostCNY = parseFloat(p.avg_cost) || 0
      const avgCostOriginal = fromCNY(avgCostCNY, p.market_type)
      const floatingProfitCNY = marketValueCNY - (p.shares * avgCostCNY)
      const currency = getCurrencySymbol(p.market_type)
      positionList.push({
        stockCode: p.stock_code,
        stockName: stockName || p.stock_code,
        marketType: p.market_type,
        currency,
        shares: p.shares,
        avgCost: avgCostOriginal,
        avgCostCNY,
        currentPrice: currentPriceOriginal,
        currentPriceCNY: priceInCNY,
        marketValue: marketValueCNY,
        floatingProfit: floatingProfitCNY,
        totalCost: parseFloat(p.total_cost) || 0
      })
    }

    const { page = 1, pageSize = 20, start_date, end_date } = req.query
    const where = { user_id: userId, trade_type: { [Op.in]: [1, 2] } }
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const defaultStart = oneMonthAgo.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]
    where.trade_date = {
      [Op.gte]: start_date || defaultStart,
      [Op.lte]: end_date || today
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
      order: [['created_at', 'DESC']]
    })

    const transactionList = await Promise.all(rows.map(async t => {
      let stockName = ''
      try {
        const pool = await StockPool.findOne({ where: { stock_code: t.stock_code, market_type: t.market_type } })
        if (pool) stockName = pool.stock_name
      } catch (e) {}
      if (!stockName) stockName = t.stock_name
      return {
        id: t.id,
        stockCode: t.stock_code,
        stockName: stockName || t.stock_code,
        marketType: t.market_type,
        tradeType: t.trade_type,
        price: parseFloat(t.price) || 0,
        shares: t.shares,
        amount: parseFloat(t.amount) || 0,
        tradeDate: t.trade_date
      }
    }))

    res.json({
      code: 0,
      data: {
        userId: user.id,
        nickname: user.nickname || user.username,
        balance: assets,
        positions: positionList,
        transactions: transactionList,
        totalTransactions: count
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
