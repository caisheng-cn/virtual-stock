/**
 * File: admin.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Admin panel API routes. Provides full administrative functionality
 *   including user management, group management, stock pool management, invite code
 *   management, commission configuration, market configuration, statistics, and
 *   dividend/allotment operations. All routes except /login require JWT auth.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { sequelize, AdminUser, Group, User, UserGroup, UserBalance, Position, Transaction, StockPool, StockPricesCache, InviteCode, CommissionConfig, LoginHistory, MarketConfig, CommissionHistory, GroupMessage, StockSyncRecord } = require('../models')
const { pinyin } = require('pinyin-pro')
const { Op } = require('sequelize')
const commissionService = require('../services/commission')
const stockSync = require('../services/stockSync')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'virtual-stock-secret-key-2024'

/**
 * POST /api/v1/admin/login
 * Admin login. Authenticates with username/password and returns a JWT token.
 * Body: { username, password }
 * Response: { code, data: { token, adminId, username } }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    const admin = await AdminUser.findOne({ where: { username } })
    if (!admin) {
      return res.json({ code: -1, message: '管理员不存在' })
    }

    if (admin.status === 0) {
      return res.json({ code: -1, message: '管理员已被禁用' })
    }

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return res.json({ code: -1, message: '密码错误' })
    }

    const token = jwt.sign({ adminId: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '7d' })

    await LoginHistory.create({
      user_id: admin.id,
      login_time: new Date(),
      ip_address: req.ip || req.connection.remoteAddress || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown'
    })

    res.json({ code: 0, data: { token, adminId: admin.id, username: admin.username } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

const auth = require('../utils/auth')
router.use(auth)

/**
 * GET /api/v1/admin/stats
 * Get dashboard statistics: user count, group count, stock count, new users today,
 * active users in 7 days, total transactions, total trade amount, today's transactions.
 * Response: { code, data: { userCount, groupCount, stockCount, todayNewUsers, activeUsers7d, ... } }
 */
router.get('/stats', async (req, res) => {
  try {
    const userCount = await User.count()
    const groupCount = await Group.count()
    const stockCount = await StockPool.count()

    const today = new Date().toISOString().split('T')[0]
    const todayNewUsers = await User.count({ where: { created_at: { [Op.gte]: today } } })

    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
    const activeUsers7d = await LoginHistory.count({
      where: { login_time: { [Op.gte]: weekAgo } },
      distinct: true,
      col: 'user_id'
    })

    const totalTransactions = await Transaction.count()
    const totalTradeAmount = await Transaction.sum('amount', {
      where: { trade_type: { [Op.in]: [1, 2] } }
    }) || 0
    const todayTransactions = await Transaction.count({ where: { trade_date: today } })

    res.json({
      code: 0,
      data: {
        userCount, groupCount, stockCount,
        todayNewUsers, activeUsers7d,
        totalTransactions, totalTradeAmount,
        todayTransactions
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/groups
 * List all groups with pagination.
 * Query: { page?, pageSize? }
 * Response: { code, data: { list: Group[], total } }
 */
router.get('/groups', async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query
    const { count, rows } = await Group.findAndCountAll({
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })
    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/groups
 * Create a new group. Group name must be unique.
 * Body: { name, description?, init_cash, currency? }
 * Response: { code, data: Group }
 */
router.post('/groups', async (req, res) => {
  try {
    const { name, description, init_cash, currency } = req.body
    if (!name || !init_cash) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    const exist = await Group.findOne({ where: { name } })
    if (exist) {
      return res.json({ code: -1, message: '群组名称已存在' })
    }

    const group = await Group.create({ name, description, init_cash, currency: currency || 'USD' })
    res.json({ code: 0, data: group })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/groups/:id
 * Update a group's name, description, init_cash, or status.
 * Body: { name?, description?, init_cash?, status? }
 * Response: { code, message }
 */
router.put('/groups/:id', async (req, res) => {
  try {
    const { name, description, init_cash, status } = req.body
    await Group.update({ name, description, init_cash, status }, { where: { id: req.params.id } })
    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * DELETE /api/v1/admin/groups/:id
 * Delete a group. Requires admin password confirmation. Group must have no members.
 * Body: { password }
 * Response: { code, message }
 */
router.delete('/groups/:id', async (req, res) => {
  try {
    const { password } = req.body
    const groupId = req.params.id

    if (!password) {
      return res.json({ code: -1, message: '请输入管理员密码' })
    }

    const admin = await AdminUser.findByPk(req.adminId)
    if (!admin) {
      return res.json({ code: -1, message: '管理员不存在' })
    }

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return res.json({ code: -1, message: '管理员密码错误' })
    }

    const memberCount = await UserGroup.count({ where: { group_id: groupId } })
    if (memberCount > 0) {
      return res.json({ code: -1, message: '群组中仍有成员，请先将所有成员移除后再删除' })
    }

    await Group.destroy({ where: { id: groupId } })
    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/groups/:id/users
 * List all users in a group with their balance, asset stats, login history, and last trade time.
 * Query: { page?, pageSize? }
 * Response: { code, data: { list: Array<{ user_id, username, nickname, cash, total_assets, profit, ... }>, total } }
 */
router.get('/groups/:id/users', async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query
    const groupId = req.params.id

    const userGroups = await UserGroup.findAll({
      where: { group_id: groupId },
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })

    const list = await Promise.all(userGroups.map(async ug => {
      const userId = ug.user_id
      const user = await User.findByPk(userId)
      const balance = await UserBalance.findOne({ where: { user_id: userId } }) || { cash: 0, init_cash: 0 }

      const positions = await Position.findAll({ where: { user_id: userId, shares: { [Op.gt]: 0 } } })
      let positionsValue = 0
      let positionsShares = 0
      for (const pos of positions) {
        const cache = await StockPricesCache.findOne({ where: { stock_code: pos.stock_code, market_type: pos.market_type } })
        if (cache) {
          positionsValue += parseFloat(pos.shares) * parseFloat(cache.close_price || 0)
        }
        positionsShares += parseFloat(pos.shares)
      }

      const totalAssets = parseFloat(balance.cash || 0) + positionsValue
      const initCash = parseFloat(balance.init_cash || 0)
      const profit = totalAssets - initCash
      const profitRate = initCash > 0 ? (profit / initCash) * 100 : 0

      const lastLogin = await LoginHistory.findOne({
        where: { user_id: userId },
        order: [['login_time', 'DESC']]
      })

      const loginCount = await LoginHistory.count({ where: { user_id: userId } })

      const lastTrade = await Transaction.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']]
      })

      return {
        user_id: userId,
        username: user?.username || '',
        nickname: user?.nickname || '',
        cash: balance.cash || 0,
        total_assets: totalAssets.toFixed(2),
        profit: profit.toFixed(2),
        profit_rate: profitRate.toFixed(2),
        positions_shares: positionsShares,
        login_count: loginCount,
        last_login_time: lastLogin ? lastLogin.login_time : null,
        last_trade_time: lastTrade ? lastTrade.created_at : null
      }
    }))

    res.json({ code: 0, data: { list, total: list.length } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/groups/:id/users
 * Manually add a user to a group. Creates a balance record if one doesn't exist.
 * Body: { user_id, init_cash? }
 * Response: { code, message }
 */
router.post('/groups/:id/users', async (req, res) => {
  try {
    const groupId = req.params.id
    const { user_id, init_cash } = req.body

    if (!user_id) {
      return res.json({ code: -1, message: '缺少用户ID' })
    }

    const group = await Group.findByPk(groupId)
    if (!group) {
      return res.json({ code: -1, message: '群组不存在' })
    }

    const user = await User.findByPk(user_id)
    if (!user) {
      return res.json({ code: -1, message: '用户不存在' })
    }

    const exist = await UserGroup.findOne({ where: { group_id: groupId, user_id } })
    if (exist) {
      return res.json({ code: -1, message: '用户已在群组中' })
    }

    await UserGroup.create({ group_id: groupId, user_id })

    let balance = await UserBalance.findOne({ where: { user_id } })
    if (!balance) {
      balance = await UserBalance.create({
        user_id,
        cash: init_cash || group.init_cash || 100000,
        init_cash: init_cash || group.init_cash || 100000,
        frozen_cash: 0
      })
    }

    res.json({ code: 0, message: '添加成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * DELETE /api/v1/admin/groups/:id/users/:userId
 * Remove a user from a group.
 * Response: { code, message }
 */
router.delete('/groups/:id/users/:userId', async (req, res) => {
  try {
    const groupId = req.params.id
    const userId = parseInt(req.params.userId)

    const deleted = await UserGroup.destroy({ where: { group_id: groupId, user_id: userId } })
    if (!deleted) {
      return res.json({ code: -1, message: '成员不存在' })
    }

    res.json({ code: 0, message: '移除成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/users
 * List all users with pagination, keyword search, group and status filters.
 * Each user includes group memberships, balance, position value, and profit data.
 * Query: { page?, pageSize?, keyword?, group_id?, status? }
 * Response: { code, data: { list: Array<{ id, username, nickname, status, groups, cash, ... }>, total } }
 */
router.get('/users', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword, group_id, status } = req.query
    const where = {}
    if (keyword) where.username = { [Op.like]: `%${keyword}%` }
    if (status !== undefined) where.status = status

    const { count, rows } = await User.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })

    const list = await Promise.all(rows.map(async user => {
      const balance = await UserBalance.findOne({ where: { user_id: user.id } }) || { cash: 0, total_cost: 0, init_cash: 0 }

      const positions = await Position.findAll({ where: { user_id: user.id } })
      let positionsValue = 0
      let floatingProfit = 0
      for (const pos of positions) {
        const cache = await StockPricesCache.findOne({ where: { stock_code: pos.stock_code, market_type: pos.market_type } })
        if (cache) {
          const value = parseFloat(pos.shares) * parseFloat(cache.close_price || 0)
          positionsValue += value
          floatingProfit += value - parseFloat(pos.total_cost || 0)
        }
      }

      const realizedProfit = await Transaction.sum('profit', {
        where: { user_id: user.id, trade_type: 2, profit: { [Op.ne]: null } }
      }) || 0

      // Get user groups via raw query to avoid association issues
      const userGroupRows = await sequelize.query(
        `SELECT g.id, g.name FROM \`groups\` g 
         JOIN user_groups ug ON ug.group_id = g.id 
         WHERE ug.user_id = ?`,
        { replacements: [user.id], type: sequelize.QueryTypes.SELECT }
      )

      return {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        status: user.status,
        trade_enabled: user.trade_enabled === null ? 1 : user.trade_enabled,
        admin_access: user.admin_access === null ? 0 : user.admin_access,
        groups: userGroupRows.map(g => ({ id: g.id, name: g.name })),
        cash: balance.cash || 0,
        total_cost: balance.total_cost || 0,
        positions_value: positionsValue.toFixed(2),
        floating_profit: floatingProfit.toFixed(2),
        realized_profit: realizedProfit,
        last_trade_date: user.last_trade_date,
        created_at: user.created_at
      }
    }))

    res.json({ code: 0, data: { list, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/users/:id/detail
 * Get detailed user information including profile, balance, positions with current values,
 * floating profit, and realized profit.
 * Response: { code, data: { user, balance, positions, positions_value, floating_profit, realized_profit } }
 */
router.get('/users/:id/detail', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) {
      return res.json({ code: -1, message: '用户不存在' })
    }

    const balance = await UserBalance.findOne({ where: { user_id: user.id } }) || { cash: 0, total_cost: 0, init_cash: 0 }
    const positions = await Position.findAll({ where: { user_id: user.id } })

    let positionsValue = 0
    let floatingProfit = 0
    const positionList = await Promise.all(positions.map(async pos => {
      const cache = await StockPricesCache.findOne({ where: { stock_code: pos.stock_code, market_type: pos.market_type } })
      const currentPrice = parseFloat(cache?.close_price || 0)
      const value = parseFloat(pos.shares) * currentPrice
      positionsValue += value
      const profit = value - parseFloat(pos.total_cost || 0)
      floatingProfit += profit
      return {
        stock_code: pos.stock_code,
        shares: pos.shares,
        avg_cost: pos.avg_cost,
        current_price: currentPrice,
        value: value.toFixed(2),
        profit: profit.toFixed(2)
      }
    }))

    const realizedProfit = await Transaction.sum('profit', {
      where: { user_id: user.id, trade_type: 2, profit: { [Op.ne]: null } }
    }) || 0

    res.json({
      code: 0,
      data: {
        user: {
          id: user.id,
          username: user.username,
          nickname: user.nickname,
          status: user.status,
          trade_enabled: user.trade_enabled === null ? 1 : user.trade_enabled,
          admin_access: user.admin_access === null ? 0 : user.admin_access,
          created_at: user.created_at
        },
        balance: {
          cash: balance.cash,
          total_cost: balance.total_cost,
          init_cash: balance.init_cash
        },
        positions: positionList,
        positions_value: positionsValue.toFixed(2),
        floating_profit: floatingProfit.toFixed(2),
        realized_profit: realizedProfit
      }
    })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/users/:id/trade-enabled
 * Enable or disable trading for a user.
 * Body: { trade_enabled: 0 | 1 }
 * Response: { code, message }
 */
router.put('/users/:id/trade-enabled', async (req, res) => {
  try {
    const { trade_enabled } = req.body
    await User.update({ trade_enabled }, { where: { id: req.params.id } })
    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/users/:id/admin-access
 * Grant or revoke admin panel access for a user.
 * Body: { admin_access: 0 | 1 }
 * Response: { code, message }
 */
router.put('/users/:id/admin-access', async (req, res) => {
  try {
    const { admin_access } = req.body
    await User.update({ admin_access }, { where: { id: req.params.id } })
    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/users/:id/login-history
 * Get login history for a specific user with date range and pagination.
 * Query: { start_date?, end_date?, page?, pageSize? }
 * Response: { code, data: { list: LoginHistory[], total } }
 */
router.get('/users/:id/login-history', async (req, res) => {
  try {
    const { start_date, end_date, page = 1, pageSize = 10 } = req.query
    const where = { user_id: req.params.id }
    if (start_date || end_date) {
      where.login_time = {}
      if (start_date) where.login_time[Op.gte] = start_date
      if (end_date) where.login_time[Op.lte] = end_date + ' 23:59:59'
    }

    const { count, rows } = await LoginHistory.findAndCountAll({
      where,
      order: [['login_time', 'DESC']],
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })
    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/users/:id/transactions
 * Get transaction history for a specific user with date/stock filters and pagination.
 * Query: { start_date?, end_date?, stock_code?, page?, pageSize? }
 * Response: { code, data: { list: Transaction[], total } }
 */
router.get('/users/:id/transactions', async (req, res) => {
  try {
    const { start_date, end_date, stock_code, page = 1, pageSize = 10 } = req.query
    const where = { user_id: req.params.id }
    if (start_date) where.trade_date = { [Op.gte]: start_date }
    if (end_date) where.trade_date = { ...where.trade_date, [Op.lte]: end_date }
    if (stock_code) where.stock_code = stock_code

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      order: [['trade_date', 'DESC'], ['id', 'DESC']],
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })
    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/users/:id/fund-flow
 * Get fund flow analysis for a specific user.
 * Query: { start_date?, end_date? }
 * Response: { code, data: { list: Array<{ tradeDate, tradeType, changeAmount, ... }> } }
 */
router.get('/users/:id/fund-flow', async (req, res) => {
  try {
    const { start_date, end_date } = req.query
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const defaultStart = oneMonthAgo.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const where = { user_id: req.params.id }
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
        case 5: typeLabel = 'initial_fund'; changeAmount = parseFloat(t.amount); break
        case 1: typeLabel = 'buy_stock'; changeAmount = -(parseFloat(t.amount) + parseFloat(t.commission || 0)); break
        case 2: typeLabel = 'sell_stock'; changeAmount = parseFloat(t.amount) - parseFloat(t.commission || 0); break
        case 3: typeLabel = 'dividend'; changeAmount = parseFloat(t.amount); break
        case 4: typeLabel = 'allotment'; changeAmount = 0; break
        default: typeLabel = 'unknown'
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

/**
 * PUT /api/v1/admin/users/:id/status
 * Update a user's account status (enable/disable).
 * Body: { status: 0 | 1 }
 * Response: { code, message }
 */
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    await User.update({ status }, { where: { id: req.params.id } })
    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * DELETE /api/v1/admin/users/:id
 * Permanently delete a user and all associated data (transactions, positions, balance,
 * group memberships, login history) within a database transaction. Requires admin password.
 * Body: { password }
 * Response: { code, message }
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { password } = req.body
    const userId = req.params.id

    if (!password) {
      return res.json({ code: -1, message: '请输入管理员密码' })
    }

    const admin = await AdminUser.findByPk(req.adminId)
    if (!admin) {
      return res.json({ code: -1, message: '管理员不存在' })
    }

    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return res.json({ code: -1, message: '管理员密码错误' })
    }

    const user = await User.findByPk(userId)
    if (!user) {
      return res.json({ code: -1, message: '用户不存在' })
    }

    await sequelize.transaction(async (t) => {
      await Transaction.destroy({ where: { user_id: userId }, transaction: t })
      await Position.destroy({ where: { user_id: userId }, transaction: t })
      await UserBalance.destroy({ where: { user_id: userId }, transaction: t })
      await UserGroup.destroy({ where: { user_id: userId }, transaction: t })
      await LoginHistory.destroy({ where: { user_id: userId }, transaction: t })
      await sequelize.query('DELETE FROM daily_balance WHERE user_id = ?', { replacements: [userId], transaction: t })
      await sequelize.query('DELETE FROM group_ranking_cache WHERE user_id = ?', { replacements: [userId], transaction: t })
      await sequelize.query('DELETE FROM operation_logs WHERE user_id = ?', { replacements: [userId], transaction: t })
      await User.destroy({ where: { id: userId }, transaction: t })
    })

    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/stocks
 * List all stocks in the pool with optional market type filter.
 * Query: { page?, pageSize?, market_type? }
 * Response: { code, data: { list: StockPool[], total } }
 */
router.get('/stocks', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, market_type } = req.query
    const where = {}
    if (market_type) where.market_type = market_type

    const { count, rows } = await StockPool.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })
    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/stocks
 * Add a new stock to the pool. Stock code + market type must be unique.
 * Body: { stock_code, stock_name, market_type }
 * Response: { code, data: StockPool }
 */
router.post('/stocks', async (req, res) => {
  try {
    const { stock_code, stock_name, market_type } = req.body
    if (!stock_code || !stock_name || !market_type) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    const exist = await StockPool.findOne({ where: { stock_code, market_type } })
    if (exist) {
      return res.json({ code: -1, message: '股票已存在' })
    }

    const pinyin_abbr = pinyin(stock_name, { pattern: 'first', type: 'array' }).join('').toUpperCase()
    const pool = await StockPool.create({ stock_code, stock_name, pinyin_abbr, market_type })
    res.json({ code: 0, data: pool })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/stocks/:id/positions
 * Get all user positions for a specific stock.
 * Response: { code, data: { stock_code, stock_name, positions: Array<{ user_id, username, nickname, shares }> } }
 */
router.get('/stocks/:id/positions', async (req, res) => {
  try {
    const stock = await StockPool.findByPk(req.params.id)
    if (!stock) {
      return res.json({ code: -1, message: '股票不存在' })
    }
    
    const positions = await Position.findAll({
      where: { stock_code: stock.stock_code, market_type: stock.market_type }
    })
    
    const usersWithPosition = await Promise.all(
      positions.map(async p => {
        const user = await User.findByPk(p.user_id, { attributes: ['id', 'username', 'nickname'] })
        return user ? { user_id: user.id, username: user.username, nickname: user.nickname, shares: p.shares } : null
      })
    )
    
    res.json({ code: 0, data: { stock_code: stock.stock_code, stock_name: stock.stock_name, positions: usersWithPosition.filter(Boolean) } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * DELETE /api/v1/admin/stocks/:id
 * Remove a stock from the pool.
 * Response: { code, message }
 */
router.delete('/stocks/:id', async (req, res) => {
  try {
    await StockPool.destroy({ where: { id: req.params.id } })
    res.json({ code: 0, message: 'success' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/stocks/:id/dividend
 * Issue a cash dividend for a stock. All users holding this stock receive the dividend
 * amount per share. Creates dividend transactions and group messages.
 * Body: { amount_per_share }
 * Response: { code, data: { affected_users } }
 */
router.post('/stocks/:id/dividend', async (req, res) => {
  try {
    const { amount_per_share } = req.body
    if (!amount_per_share || amount_per_share <= 0) {
      return res.json({ code: -1, message: '请输入有效的分红金额' })
    }

    const stock = await StockPool.findByPk(req.params.id)
    if (!stock) return res.json({ code: -1, message: '股票不存在' })

    const positions = await Position.findAll({ where: { stock_code: stock.stock_code, market_type: stock.market_type } })
    if (positions.length === 0) return res.json({ code: -1, message: '该股票暂无持仓用户' })

    const today = new Date().toISOString().split('T')[0]
    let affectedCount = 0

    for (const pos of positions) {
      const shares = parseInt(pos.shares)
      if (shares <= 0) continue

      const dividendAmount = parseFloat((shares * amount_per_share).toFixed(2))

      const balance = await UserBalance.findOne({ where: { user_id: pos.user_id } })
      if (!balance) continue

      const newCash = parseFloat((parseFloat(balance.cash) + dividendAmount).toFixed(2))
      await UserBalance.update({ cash: newCash }, { where: { user_id: pos.user_id } })

      await Transaction.create({
        user_id: pos.user_id,
        group_id: pos.group_id || 0,
        stock_code: stock.stock_code,
        stock_name: stock.stock_name,
        market_type: stock.market_type,
        trade_type: 3,
        price: amount_per_share,
        shares: shares,
        amount: dividendAmount,
        commission: 0,
        commission_rate: 0,
        balance_after: newCash,
        profit: 0,
        trade_date: today,
        status: 1
      })

      const userGroups = await UserGroup.findAll({ where: { user_id: pos.user_id } })
      for (const ug of userGroups) {
        await GroupMessage.create({
          group_id: ug.group_id,
          user_id: pos.user_id,
          message_type: 3,
          stock_code: stock.stock_code,
          stock_name: stock.stock_name,
          market_type: stock.market_type,
          shares,
          price: parseFloat(amount_per_share),
          amount: dividendAmount,
          content: `分红 ${stock.stock_name}(${stock.stock_code}) ${shares}股, 每股¥${parseFloat(amount_per_share).toFixed(2)}, 合计¥${dividendAmount.toFixed(2)}`
        })
      }

      affectedCount++
    }

    res.json({ code: 0, data: { affected_users: affectedCount } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/stocks/:id/allotment
 * Issue a stock allotment (bonus shares) for a stock. Users receive additional shares
 * based on the bonus_per_share ratio. Creates allotment transactions and group messages.
 * Body: { bonus_per_share }
 * Response: { code, data: { affected_users } }
 */
router.post('/stocks/:id/allotment', async (req, res) => {
  try {
    const { bonus_per_share } = req.body
    if (!bonus_per_share || bonus_per_share <= 0) {
      return res.json({ code: -1, message: '请输入有效的配股数量' })
    }

    const stock = await StockPool.findByPk(req.params.id)
    if (!stock) return res.json({ code: -1, message: '股票不存在' })

    const positions = await Position.findAll({ where: { stock_code: stock.stock_code, market_type: stock.market_type } })
    if (positions.length === 0) return res.json({ code: -1, message: '该股票暂无持仓用户' })

    const today = new Date().toISOString().split('T')[0]
    let affectedCount = 0

    for (const pos of positions) {
      const shares = parseInt(pos.shares)
      if (shares <= 0) continue

      const extraShares = Math.floor(shares * bonus_per_share)
      if (extraShares <= 0) continue

      const newShares = shares + extraShares
      await Position.update({ shares: newShares }, { where: { id: pos.id } })

      await Transaction.create({
        user_id: pos.user_id,
        group_id: pos.group_id || 0,
        stock_code: stock.stock_code,
        stock_name: stock.stock_name,
        market_type: stock.market_type,
        trade_type: 4,
        price: 0,
        shares: extraShares,
        amount: 0,
        commission: 0,
        commission_rate: 0,
        balance_after: 0,
        profit: 0,
        trade_date: today,
        status: 1
      })

      const userGroups = await UserGroup.findAll({ where: { user_id: pos.user_id } })
      for (const ug of userGroups) {
        await GroupMessage.create({
          group_id: ug.group_id,
          user_id: pos.user_id,
          message_type: 4,
          stock_code: stock.stock_code,
          stock_name: stock.stock_name,
          market_type: stock.market_type,
          shares: extraShares,
          price: 0,
          amount: 0,
          content: `配股 ${stock.stock_name}(${stock.stock_code}) 每${shares}股送${extraShares}股`
        })
      }

      affectedCount++
    }

    res.json({ code: 0, data: { affected_users: affectedCount } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/stocks/missing
 * Find stocks that are missing from the price cache for a given date.
 * Query: { market_type?, date? }
 * Response: { code, data: Array<{ stock_code, stock_name, market_type, trade_date, status }> }
 */
router.get('/stocks/missing', async (req, res) => {
  try {
    const { market_type, date } = req.query
    const targetDate = date || new Date().toISOString().split('T')[0]

    const where = { trade_date: targetDate }
    if (market_type) where.market_type = market_type

    const pools = await StockPool.findAll({ where: market_type ? { market_type } : {} })

    const missing = []
    for (const pool of pools) {
      const cache = await StockPricesCache.findOne({
        where: { stock_code: pool.stock_code, market_type: pool.market_type }
      })
      if (!cache || cache.trade_date !== targetDate) {
        missing.push({
          stock_code: pool.stock_code,
          stock_name: pool.stock_name,
          market_type: pool.market_type,
          trade_date: targetDate,
          status: cache ? '过期' : '缺失'
        })
      }
    }

    res.json({ code: 0, data: missing })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/invite-codes
 * List all invite codes with optional group filter and pagination.
 * Query: { page?, pageSize?, group_id? }
 * Response: { code, data: { list: InviteCode[], total } }
 */
router.get('/invite-codes', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, group_id } = req.query
    const where = {}
    if (group_id) where.group_id = group_id

    const { count, rows } = await InviteCode.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })
    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/invite-codes
 * Generate a new invite code for a group.
 * Body: { group_id, expire_days?, use_limit? }
 * Response: { code, data: InviteCode }
 */
router.post('/invite-codes', async (req, res) => {
  try {
    const { group_id, expire_days, use_limit } = req.body
    if (!group_id) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    const code = 'INV' + Date.now().toString().slice(-8)
    const expire_date = expire_days ? new Date(Date.now() + expire_days * 24 * 3600 * 1000).toISOString().split('T')[0] : null

    const invite = await InviteCode.create({ code, group_id, expire_date, use_limit })
    res.json({ code: 0, data: invite })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/commission-configs
 * Get all commission rate configurations sorted by market type and trade type.
 * Response: { code, data: CommissionConfig[] }
 */
router.get('/commission-configs', async (req, res) => {
  try {
    const configs = await CommissionConfig.findAll({
      order: [['market_type', 'ASC'], ['trade_type', 'ASC']]
    })
    res.json({ code: 0, data: configs })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/commission-configs/:id
 * Update a commission rate. Records the change in commission history and clears the cache.
 * Body: { commission_rate, remark? }
 * Response: { code, message }
 */
router.put('/commission-configs/:id', async (req, res) => {
  try {
    const { commission_rate, remark } = req.body
    if (commission_rate === undefined) {
      return res.json({ code: -1, message: '参数不完整' })
    }

    const config = await CommissionConfig.findByPk(req.params.id)
    if (!config) {
      return res.json({ code: -1, message: '配置不存在' })
    }

    await CommissionHistory.create({
      market_type: config.market_type,
      trade_type: config.trade_type,
      old_rate: config.commission_rate,
      new_rate: commission_rate,
      changed_by: req.adminId,
      remark: remark || ''
    })

    await config.update({ commission_rate: parseFloat(commission_rate) })
    commissionService.clearCache()
    res.json({ code: 0, message: '更新成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/commission-history
 * Get commission rate change history with filters and pagination.
 * Query: { market_type?, trade_type?, start_date?, end_date?, page?, pageSize? }
 * Response: { code, data: { list: CommissionHistory[], total } }
 */
router.get('/commission-history', async (req, res) => {
  try {
    const { market_type, trade_type, start_date, end_date, page = 1, pageSize = 10 } = req.query
    const where = {}
    if (market_type) where.market_type = market_type
    if (trade_type) where.trade_type = trade_type
    if (start_date || end_date) {
      where.changed_at = {}
      if (start_date) where.changed_at[Op.gte] = start_date
      if (end_date) where.changed_at[Op.lte] = end_date + ' 23:59:59'
    }

    const { count, rows } = await CommissionHistory.findAndCountAll({
      where,
      order: [['changed_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })
    res.json({ code: 0, data: { list: rows, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/market-config
 * Get market configuration (trading hours, refresh time) for all market types.
 * Response: { code, data: MarketConfig[] }
 */
router.get('/market-config', async (req, res) => {
  try {
    const configs = await MarketConfig.findAll()
    res.json({ code: 0, data: configs })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/market-config/:id
 * Update market configuration (refresh_time, trade_start, trade_end, enabled).
 * Body: { refresh_time?, trade_start?, trade_end?, enabled? }
 * Response: { code, message }
 */
router.put('/market-config/:id', async (req, res) => {
  try {
    const { refresh_time, trade_start, trade_end, enabled } = req.body
    const config = await MarketConfig.findByPk(req.params.id)
    if (!config) {
      return res.json({ code: -1, message: '配置不存在' })
    }

    await config.update({ refresh_time, trade_start, trade_end, enabled })
    res.json({ code: 0, message: '更新成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/statistics/groups
 * Get group performance statistics (total assets, profit, profit rate) sorted by profit.
 * Query: { start_date?, end_date?, period? ('week' | 'month') }
 * Response: { code, data: Array<{ group_id, group_name, total_assets, profit, profit_rate, rank }> }
 */
router.get('/statistics/groups', async (req, res) => {
  try {
    const { start_date, end_date, period } = req.query
    let startDate, endDate = new Date().toISOString().split('T')[0]

    if (period === 'week') {
      startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
    } else if (period === 'month') {
      startDate = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
    } else if (start_date) {
      startDate = start_date
    } else {
      startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
    }

    const groups = await Group.findAll()

    const list = await Promise.all(groups.map(async group => {
      const userGroups = await UserGroup.findAll({ where: { group_id: group.id } })

      let totalAssets = 0
      let totalProfit = 0

      for (const ug of userGroups) {
        const balance = await UserBalance.findOne({ where: { user_id: ug.user_id } }) || { cash: 0, init_cash: 0 }
        const positions = await Position.findAll({ where: { user_id: ug.user_id } })

        let positionsValue = 0
        for (const pos of positions) {
          const cache = await StockPricesCache.findOne({ where: { stock_code: pos.stock_code, market_type: pos.market_type } })
          if (cache) {
            positionsValue += parseFloat(pos.shares) * parseFloat(cache.close_price || 0)
          }
        }

        totalAssets += parseFloat(balance.cash || 0) + positionsValue
        totalProfit += positionsValue - parseFloat(balance.total_cost || 0)
      }

      const profitRate = parseFloat(group.init_cash || 0) > 0
        ? (totalProfit / parseFloat(group.init_cash || 1)) * 100
        : 0

      return {
        group_id: group.id,
        group_name: group.name,
        init_cash: group.init_cash,
        total_assets: totalAssets.toFixed(2),
        profit: totalProfit.toFixed(2),
        profit_rate: profitRate.toFixed(2)
      }
    }))

    list.sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit))
    list.forEach((item, index) => item.rank = index + 1)

    res.json({ code: 0, data: list })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/statistics/users
 * Get user activity statistics (trade count, login count, total profit) sorted by
 * trade count or login count.
 * Query: { start_date?, end_date?, sort? ('trade_count' | 'login_count') }
 * Response: { code, data: Array<{ user_id, username, trade_count, login_count, total_profit }> }
 */
router.get('/statistics/users', async (req, res) => {
  try {
    const { start_date, end_date, sort = 'trade_count' } = req.query
    const where = {}
    if (start_date || end_date) {
      where.created_at = {}
      if (start_date) where.created_at[Op.gte] = start_date
      if (end_date) where.created_at[Op.lte] = end_date + ' 23:59:59'
    }

    const users = await User.findAll({ where })

    const list = await Promise.all(users.map(async user => {
      const tradeCount = await Transaction.count({ where: { user_id: user.id } })
      const loginCount = await LoginHistory.count({ where: { user_id: user.id } })
      const totalProfit = await Transaction.sum('profit', {
        where: { user_id: user.id, trade_type: 2, profit: { [Op.ne]: null } }
      }) || 0

      return {
        user_id: user.id,
        username: user.username,
        trade_count: tradeCount,
        login_count: loginCount,
        total_profit: totalProfit
      }
    }))

    if (sort === 'login_count') {
      list.sort((a, b) => b.login_count - a.login_count)
    } else {
      list.sort((a, b) => b.trade_count - a.trade_count)
    }

    res.json({ code: 0, data: list })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/stocks/refresh
 * Trigger a refresh of stock prices for a given market type (placeholder - not yet implemented).
 * Body: { market_type? }
 * Response: { code, message }
 */
router.post('/stocks/refresh', async (req, res) => {
  try {
    const { market_type } = req.body
    res.json({ code: 0, message: '刷新功能需要实现股票服务' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/stocks/sync
 * Start syncing missing historical K-line data for a given market type.
 * Body: { market_type }
 * Response: { code, data: { id } }
 */
router.post('/stocks/sync', async (req, res) => {
  try {
    const { market_type } = req.body
    if (!market_type || ![1, 2, 3].includes(Number(market_type))) {
      return res.json({ code: -1, message: '无效的市场类型' })
    }

    const running = await StockSyncRecord.findOne({
      where: { market_type, status: 'running' }
    })
    if (running) {
      return res.json({ code: -1, message: '该市场已有正在进行的同步任务' })
    }

    const record = await StockSyncRecord.create({
      market_type: Number(market_type),
      status: 'running',
      started_at: new Date()
    })

    setTimeout(() => stockSync.startSync(Number(market_type), record.id), 0)

    res.json({ code: 0, data: { id: record.id } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/stocks/sync/progress/:id
 * Get the progress of a sync operation.
 * Response: { code, data: { id, market_type, status, total_count, completed_count,
 *   success_count, fail_count, current_stock, duration_sec, finished_at } }
 */
router.get('/stocks/sync/progress/:id', async (req, res) => {
  try {
    const record = await StockSyncRecord.findByPk(req.params.id)
    if (!record) {
      return res.json({ code: -1, message: '记录不存在' })
    }

    res.json({ code: 0, data: {
      id: record.id,
      market_type: record.market_type,
      status: record.status,
      total_count: record.total_count,
      completed_count: record.completed_count,
      success_count: record.success_count,
      fail_count: record.fail_count,
      current_stock: record.current_stock || '',
      duration_sec: record.duration_sec,
      finished_at: record.finished_at
    }})
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/stocks/sync/history
 * Get sync operation history with pagination.
 * Query: { page?, pageSize? }
 * Response: { code, data: { list, total } }
 */
router.get('/stocks/sync/history', async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query

    const { count, rows } = await StockSyncRecord.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset: (page - 1) * pageSize
    })

    const list = rows.map(r => ({
      id: r.id,
      market_type: r.market_type,
      status: r.status,
      total_count: r.total_count,
      success_count: r.success_count,
      fail_count: r.fail_count,
      duration_sec: r.duration_sec,
      started_at: r.started_at,
      finished_at: r.finished_at
    }))

    res.json({ code: 0, data: { list, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/stocks/sync/history/:id
 * Get sync record detail including failed stocks list.
 * Response: { code, data: { ...record, failed_stocks: [] } }
 */
router.get('/stocks/sync/history/:id', async (req, res) => {
  try {
    const record = await StockSyncRecord.findByPk(req.params.id)
    if (!record) {
      return res.json({ code: -1, message: '记录不存在' })
    }

    let failedStocks = []
    try {
      if (record.failed_stocks) {
        failedStocks = JSON.parse(record.failed_stocks)
      }
    } catch (e) {
      failedStocks = []
    }

    res.json({ code: 0, data: {
      id: record.id,
      market_type: record.market_type,
      status: record.status,
      total_count: record.total_count,
      completed_count: record.completed_count,
      success_count: record.success_count,
      fail_count: record.fail_count,
      failed_stocks: failedStocks,
      duration_sec: record.duration_sec,
      started_at: record.started_at,
      finished_at: record.finished_at
    }})
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/stocks/sync/cancel/:id
 * Cancel a running sync operation. Updates status to 'cancelled' and signals
 * the sync process to stop.
 * Response: { code, message }
 */
router.post('/stocks/sync/cancel/:id', async (req, res) => {
  try {
    const record = await StockSyncRecord.findByPk(req.params.id)
    if (!record) {
      return res.json({ code: -1, message: '记录不存在' })
    }
    if (record.status !== 'running') {
      return res.json({ code: -1, message: '该任务不在运行中' })
    }

    await record.update({ status: 'cancelled', finished_at: new Date() })
    stockSync.setCancelled(record.id)

    res.json({ code: 0, message: '已取消同步任务' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router