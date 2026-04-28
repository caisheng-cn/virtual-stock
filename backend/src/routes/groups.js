const express = require('express')
const { Group, UserGroup, User, UserBalance, Position, StockPricesCache, Transaction, sequelize } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')

const router = express.Router()

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

async function getMemberAssets(userId, groupId) {
  const balance = await UserBalance.findOne({ where: { user_id: userId, group_id: groupId } })
  const cash = balance ? parseFloat(balance.cash) : 0
  const initCash = balance ? parseFloat(balance.init_cash) || 0 : 0

  const positions = await Position.findAll({ where: { user_id: userId, shares: { [Op.gt]: 0 } } })
  let totalMarketValue = 0
  for (const p of positions) {
    const cache = await StockPricesCache.findOne({ where: { stock_code: p.stock_code, market_type: p.market_type } })
    if (cache) {
      totalMarketValue += p.shares * parseFloat(cache.close_price)
    }
  }

  const totalAssets = cash + totalMarketValue
  const profit = totalAssets - initCash
  const profitRate = initCash > 0 ? (profit / initCash) * 100 : 0

  return { cash, initCash, totalMarketValue, totalAssets, profit, profitRate }
}

router.get('/:groupId/ranking', auth, async (req, res) => {
  try {
    const { groupId } = req.params
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

    const positions = await Position.findAll({ where: { user_id: userId, shares: { [Op.gt]: 0 } } })
    const positionList = []
    for (const p of positions) {
      const cache = await StockPricesCache.findOne({ where: { stock_code: p.stock_code, market_type: p.market_type } })
      const currentPrice = cache ? parseFloat(cache.close_price) : 0
      const marketValue = p.shares * currentPrice
      const avgCost = parseFloat(p.avg_cost) || 0
      positionList.push({
        stockCode: p.stock_code,
        stockName: p.stock_name,
        marketType: p.market_type,
        shares: p.shares,
        avgCost,
        currentPrice,
        marketValue,
        floatingProfit: marketValue - (p.shares * avgCost),
        totalCost: parseFloat(p.total_cost) || 0
      })
    }

    const { page = 1, pageSize = 20 } = req.query
    const { count, rows } = await Transaction.findAndCountAll({
      where: { user_id: userId, group_id: groupId, trade_type: { [Op.in]: [1, 2] } },
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
      order: [['created_at', 'DESC']]
    })

    const transactionList = rows.map(t => ({
      id: t.id,
      stockCode: t.stock_code,
      stockName: t.stock_name,
      tradeType: t.trade_type,
      price: parseFloat(t.price) || 0,
      shares: t.shares,
      amount: parseFloat(t.amount) || 0,
      tradeDate: t.trade_date
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
