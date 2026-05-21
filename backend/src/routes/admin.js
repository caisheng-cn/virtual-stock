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
const { sequelize, AdminUser, Group, User, UserGroup, UserBalance, Position, Transaction, StockPool, StockPricesCache, InviteCode, CommissionConfig, LoginHistory, MarketConfig, CommissionHistory, GroupMessage, StockSyncRecord, OptionWhitelist, OptionContract, OptionPrice, OptionPosition, SchedulerConfig, AiLlmConfig, AiTradeLog, AdminAnnouncement } = require('../models')
const optionService = require('../services/option')
const optionSync = require('../services/optionSync')
const syncProgress = require('../services/syncProgress')
const { toCNY } = require('../utils/currency')
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
 * Query: { page?, pageSize?, market_type?, keyword? }
 * Response: { code, data: { list: StockPool[], total } }
 */
router.get('/stocks', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, market_type, keyword } = req.query
    const where = {}
    if (market_type) where.market_type = market_type
    if (keyword) {
      where[sequelize.Sequelize.Op.or] = [
        { stock_name: { [sequelize.Sequelize.Op.like]: `%${keyword}%` } },
        { stock_code: { [sequelize.Sequelize.Op.like]: `%${keyword}%` } }
      ]
    }

    const { count, rows } = await StockPool.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * parseInt(pageSize),
      order: [['id', 'ASC']]
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
 * Update market configuration (refresh_time, forbid_start, forbid_end, enabled).
 * Body: { refresh_time?, forbid_start?, forbid_end?, enabled? }
 * Response: { code, message }
 */
router.put('/market-config/:id', async (req, res) => {
  try {
    const { refresh_time, forbid_start, forbid_end, enabled } = req.body
    const config = await MarketConfig.findByPk(req.params.id)
    if (!config) {
      return res.json({ code: -1, message: '配置不存在' })
    }

    await config.update({ refresh_time, forbid_start, forbid_end, enabled })
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

// ============================================
// 期权管理
// ============================================

/**
 * GET /api/v1/admin/options/whitelist - Option whitelist list
 */
router.get('/options/whitelist', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const { rows, count } = await OptionWhitelist.findAndCountAll({
      order: [['id', 'DESC']],
      offset,
      limit: parseInt(pageSize),
      raw: true
    })
    res.json({ code: 0, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/options/whitelist - Add stock to whitelist
 */
router.post('/options/whitelist', async (req, res) => {
  try {
    const { stock_code, market_type, stock_name, underlying_type, exchange, exercise_type, contract_multiplier } = req.body
    if (!stock_code) {
      return res.json({ code: -1, message: '参数不完整' })
    }
    const [record, created] = await OptionWhitelist.findOrCreate({
      where: { stock_code, market_type: parseInt(market_type || 1) },
      defaults: {
        stock_code,
        market_type: parseInt(market_type || 1),
        stock_name: stock_name || stock_code,
        underlying_type: parseInt(underlying_type || 1),
        exchange: exchange || 'SSE',
        exercise_type: parseInt(exercise_type || 1),
        contract_multiplier: parseInt(contract_multiplier || 10000),
        underlying_code: stock_code,
      }
    })
    if (!created) {
      await record.update({
        underlying_type: parseInt(underlying_type || record.underlying_type || 1),
        exchange: exchange || record.exchange || 'SSE',
        exercise_type: parseInt(exercise_type || record.exercise_type || 1),
        contract_multiplier: parseInt(contract_multiplier || record.contract_multiplier || 10000),
      })
    }
    res.json({ code: 0, data: record })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * DELETE /api/v1/admin/options/whitelist/:id - Remove from whitelist
 */
router.delete('/options/whitelist/:id', async (req, res) => {
  try {
    await OptionWhitelist.destroy({ where: { id: req.params.id } })
    res.json({ code: 0, message: '已移除' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/options/whitelist/:id/status - Toggle whitelist status
 */
router.put('/options/whitelist/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    await OptionWhitelist.update({ status: parseInt(status) }, { where: { id: req.params.id } })
    res.json({ code: 0, message: '状态已更新' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/options/contracts - List all option contracts
 */
router.get('/options/contracts', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, stock_code } = req.query
    const where = {}
    if (status) where.status = parseInt(status)
    if (stock_code) where.stock_code = stock_code
    const offset = (parseInt(page) - 1) * parseInt(pageSize)
    const { rows, count } = await OptionContract.findAndCountAll({
      where,
      order: [['expiration_date', 'ASC'], ['strike_price', 'ASC']],
      offset,
      limit: parseInt(pageSize),
      raw: true
    })
    res.json({ code: 0, data: { list: rows, total: count, page: parseInt(page), pageSize: parseInt(pageSize) } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/options/contracts/generate - Generate contracts for a stock
 */
router.post('/options/contracts/generate', async (req, res) => {
  try {
    const { stock_code, market_type } = req.body
    if (!stock_code || !market_type) {
      return res.json({ code: -1, message: '参数不完整' })
    }
    const whitelist = await OptionWhitelist.findOne({ where: { stock_code, market_type: parseInt(market_type) } })
    if (!whitelist) return res.json({ code: -1, message: '该股票不在白名单中' })
    const underlyingPrice = await optionService.getUnderlyingPrice(stock_code, parseInt(market_type))
    if (!underlyingPrice) return res.json({ code: -1, message: '无法获取标的股价' })
    await optionService.ensureContracts(stock_code, parseInt(market_type), whitelist.stock_name, underlyingPrice)
    await optionService.refreshPrices(stock_code, parseInt(market_type))
    res.json({ code: 0, message: '合约生成成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/options/settlement - Manual settlement for expired contracts
 */
router.post('/options/settlement', async (req, res) => {
  try {
    const { expiration_date } = req.body
    if (!expiration_date) return res.json({ code: -1, message: '缺少到期日参数' })
    const expiredContracts = await OptionContract.findAll({
      where: { expiration_date, status: 1 },
      raw: true
    })
    let settled = 0
    for (const contract of expiredContracts) {
      const positions = await OptionPosition.findAll({
        where: { contract_id: contract.id, status: 1 }
      })
      if (!positions.length) continue
      const priceRow = await OptionPrice.findOne({
        where: { contract_id: contract.id, trade_date: expiration_date },
        raw: true
      })
      const underlyingPrice = priceRow ? parseFloat(priceRow.underlying_price) : 0
      const strike = parseFloat(contract.strike_price)
      const multiplier = contract.contract_multiplier || 100
      for (const pos of positions) {
        let settlementAmount = 0
        if (contract.option_type === 'call') {
          settlementAmount = Math.max(underlyingPrice - strike, 0) * pos.quantity * multiplier
        } else {
          settlementAmount = Math.max(strike - underlyingPrice, 0) * pos.quantity * multiplier
        }
        if (settlementAmount > 0) {
          const settlementCNY = toCNY(settlementAmount, contract.market_type)
          const costPerUnit = parseFloat(pos.total_cost) / pos.quantity
          const profit = settlementCNY - (costPerUnit * pos.quantity)
          await UserBalance.increment('cash', { by: settlementCNY, where: { user_id: pos.user_id, group_id: pos.group_id } })
          await OptionTransaction.create({
            user_id: pos.user_id,
            group_id: pos.group_id,
            contract_id: contract.id,
            stock_code: contract.stock_code,
            stock_name: contract.stock_name,
            option_type: contract.option_type,
            strike_price: strike,
            expiration_date: contract.expiration_date,
            trade_type: 4,
            quantity: pos.quantity,
            price: 0,
            premium: settlementAmount,
            profit,
            balance_after: 0,
            trade_date: expiration_date,
            settlement_amount: settlementAmount,
            status: 1
          })
        }
        await OptionPosition.update({ status: 4 }, { where: { id: pos.id } })
        settled++
      }
      await OptionContract.update({ status: 2 }, { where: { id: contract.id } })
    }
    res.json({ code: 0, message: `结算完成，处理了 ${settled} 笔持仓` })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

// ============================================
// AKShare 数据同步接口
// ============================================

/**
 * POST /api/v1/admin/options/sync - 触发AKShare数据同步
 * GET /api/v1/admin/options/sync/progress - 查询同步进度
 */
router.post('/options/sync', async (req, res) => {
  if (syncProgress.getStatus().running) {
    return res.json({ code: -1, message: '已有同步任务正在执行，请等待完成' })
  }

  const { action } = req.body
  const stepCounts = { contracts: 1, prices: 1, daily_close: 1, greeks: 1, backfill: 1, all: 4 }
  const total = stepCounts[action] || 1
  syncProgress.reset(action, total)

  res.json({ code: 0, message: '同步已启动' })

  setImmediate(async () => {
    try {
      switch (action) {
        case 'contracts': {
          const r = await optionSync.batchSaveContractsToDB()
          syncProgress.step(`合约同步完成: ${r} 个`)
          syncProgress.finish(`合约同步完成: ${r} 个`)
          break
        }
        case 'prices': {
          const r = await optionSync.updateRealtimePrices()
          syncProgress.step(`行情更新完成: ${r} 条`)
          syncProgress.finish(`行情更新完成: ${r} 条`)
          break
        }
        case 'daily_close': {
          const r = await optionSync.syncAllDailyClose()
          syncProgress.step(`收盘价同步完成: ${r} 条`)
          syncProgress.finish(`收盘价同步完成: ${r} 条`)
          break
        }
        case 'greeks': {
          const r = await optionSync.syncGreeks()
          syncProgress.step(`Greeks同步完成: ${r.length} 条`)
          syncProgress.finish(`Greeks同步完成: ${r.length} 条`)
          break
        }
        case 'backfill': {
          const r = await optionSync.initBackfill('510050', '50ETF')
          syncProgress.step(`历史回填完成: ${r.length} 条`)
          syncProgress.finish(`历史回填完成: ${r.length} 条`)
          break
        }
        case 'all': {
          const c = await optionSync.batchSaveContractsToDB()
          syncProgress.step(`合约同步完成: ${c} 个`)

          const p = await optionSync.updateRealtimePrices()
          syncProgress.step(`行情更新完成: ${p} 条`)

          const d = await optionSync.syncAllDailyClose()
          syncProgress.step(`收盘价同步完成: ${d} 条`)

          const g = await optionSync.syncGreeks()
          syncProgress.step(`Greeks同步完成: ${g.length} 条`)

          syncProgress.finish(`全量同步完成: 合约${c}个, 行情${p}条, 收盘${d}条, Greeks${g.length}条`)
          break
        }
      }
    } catch (e) {
      syncProgress.fail(e.message)
    }
  })
})

router.get('/options/sync/progress', async (req, res) => {
  res.json({ code: 0, data: syncProgress.getStatus() })
})

// ============================================
// 调度任务配置管理
// ============================================

/**
 * GET /api/v1/admin/scheduler/configs - 获取所有调度任务配置
 */
router.get('/scheduler/configs', async (req, res) => {
  try {
    const list = await SchedulerConfig.findAll({ order: [['id', 'ASC']], raw: true })
    res.json({ code: 0, data: list })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/scheduler/configs/:id - 更新调度任务配置
 * body: { cron_expression?, enabled? }
 */
router.put('/scheduler/configs/:id', async (req, res) => {
  try {
    const { cron_expression, enabled } = req.body
    const update = {}
    if (cron_expression !== undefined) update.cron_expression = cron_expression
    if (enabled !== undefined) update.enabled = parseInt(enabled)

    await SchedulerConfig.update(update, { where: { id: req.params.id } })
    // 热重载调度器
    try {
      const scheduler = require('../scheduler/optionScheduler')
      await scheduler.reload()
    } catch (e) {
      console.log('调度器热重载:', e.message)
    }
    res.json({ code: 0, message: '调度配置已更新' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/scheduler/reload - 热重载调度任务
 */
router.post('/scheduler/reload', async (req, res) => {
  try {
    const scheduler = require('../scheduler/optionScheduler')
    await scheduler.reload()
    res.json({ code: 0, message: '调度器已重载' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

// ============================================
// AI 配置管理
// ============================================

/**
 * GET /api/v1/admin/ai/config - 获取所有LLM配置
 */
router.get('/ai/config', async (req, res) => {
  try {
    const configs = await AiLlmConfig.findAll({ order: [['id', 'ASC']], raw: true })
    const safe = configs.map(c => ({
      ...c,
      api_key: c.api_key ? '***' : '',
      personality_prompts: c.personality_prompts ? JSON.parse(c.personality_prompts) : null
    }))
    res.json({ code: 0, data: safe })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/ai/config - 新增LLM配置
 */
router.post('/ai/config', async (req, res) => {
  try {
    const { config_name, api_url, api_key, model_name, max_tokens, temperature, timeout, personality_prompts } = req.body
    if (!config_name || !api_url || !api_key) {
      return res.json({ code: -1, message: '参数不完整' })
    }
    const config = await AiLlmConfig.create({
      config_name, api_url, api_key,
      model_name: model_name || 'gpt-3.5-turbo',
      max_tokens: parseInt(max_tokens) || 2000,
      temperature: parseFloat(temperature) || 0.7,
      timeout: parseInt(timeout) || 30,
      personality_prompts: personality_prompts ? JSON.stringify(personality_prompts) : null
    })
    res.json({ code: 0, data: config })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/ai/config/:id - 更新LLM配置
 */
router.put('/ai/config/:id', async (req, res) => {
  try {
    const { config_name, api_url, api_key, model_name, max_tokens, temperature, timeout, status, personality_prompts } = req.body
    const update = {}
    if (config_name !== undefined) update.config_name = config_name
    if (api_url !== undefined) update.api_url = api_url
    if (api_key !== undefined) update.api_key = api_key
    if (model_name !== undefined) update.model_name = model_name
    if (max_tokens !== undefined) update.max_tokens = parseInt(max_tokens)
    if (temperature !== undefined) update.temperature = parseFloat(temperature)
    if (timeout !== undefined) update.timeout = parseInt(timeout)
    if (status !== undefined) update.status = parseInt(status)
    if (personality_prompts !== undefined) update.personality_prompts = JSON.stringify(personality_prompts)

    await AiLlmConfig.update(update, { where: { id: req.params.id } })
    res.json({ code: 0, message: '更新成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * DELETE /api/v1/admin/ai/config/:id - 删除LLM配置
 */
router.delete('/ai/config/:id', async (req, res) => {
  try {
    await AiLlmConfig.destroy({ where: { id: req.params.id } })
    res.json({ code: 0, message: '删除成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/ai/config/test - 测试LLM连接
 */
router.post('/ai/config/test', async (req, res) => {
  try {
    const { api_url, api_key, model_name } = req.body
    if (!api_url || !api_key) {
      return res.json({ code: -1, message: '参数不完整' })
    }
    const { testConnection } = require('../services/llmClient')
    const result = await testConnection({ api_url, api_key, model_name: model_name || 'gpt-3.5-turbo' })
    res.json({ code: result.success ? 0 : -1, data: result })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/ai/users - 获取所有AI用户
 */
router.get('/ai/users', async (req, res) => {
  try {
    const aiUserService = require('../services/aiUserService')
    const users = await aiUserService.getAllAIUsers()
    res.json({ code: 0, data: users })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/ai/generate/:groupId - 为群组生成AI用户
 */
router.post('/ai/generate/:groupId', async (req, res) => {
  try {
    const { config_id, count } = req.body
    const groupId = req.params.groupId
    if (!config_id) {
      return res.json({ code: -1, message: '请选择LLM配置' })
    }
    const aiUserService = require('../services/aiUserService')
    const users = await aiUserService.generateAIUsers(parseInt(groupId), parseInt(config_id), parseInt(count) || 3)
    res.json({ code: 0, data: users })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/ai/regenerate/:groupId - 重新生成AI用户（先删后建）
 */
router.post('/ai/regenerate/:groupId', async (req, res) => {
  try {
    const { config_id, count } = req.body
    const groupId = req.params.groupId
    if (!config_id) {
      return res.json({ code: -1, message: '请选择LLM配置' })
    }
    const aiUserService = require('../services/aiUserService')
    await aiUserService.removeAIUsers(parseInt(groupId))
    const users = await aiUserService.generateAIUsers(parseInt(groupId), parseInt(config_id), parseInt(count) || 3)
    res.json({ code: 0, data: users })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/ai/trigger - 手动触发一次AI交易
 */
router.post('/ai/trigger', async (req, res) => {
  try {
    const aiUsers = await User.findAll({
      where: { is_ai: 1, status: 1, trade_enabled: 1 },
      raw: true
    })
    const aiTrade = require('../services/aiTradeService')
    const aiSocial = require('../services/aiSocialService')
    const results = []
    for (const user of aiUsers) {
      const ug = await UserGroup.findOne({ where: { user_id: user.id }, raw: true })
      if (!ug) continue
      const tradeResult = await aiTrade.processAIUser(user.id, ug.group_id)
      results.push({ userId: user.id, trade: tradeResult })
      await new Promise(r => setTimeout(r, 1000))
      const socialResult = await aiSocial.processAISocialInteraction(user.id, ug.group_id)
      results[results.length - 1].social = socialResult
      await new Promise(r => setTimeout(r, 500))
    }
    res.json({ code: 0, data: results })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/ai/users/:id - 编辑AI用户昵称或提示词
 */
router.put('/ai/users/:id', async (req, res) => {
  try {
    const { nickname, personality_prompt, status } = req.body
    const updateData = {}
    if (nickname !== undefined) {
      if (!nickname) {
        return res.json({ code: -1, message: '昵称不能为空' })
      }
      updateData.nickname = nickname
    }
    if (personality_prompt !== undefined) {
      updateData.personality_prompt = personality_prompt
    }
    if (status !== undefined) {
      updateData.status = parseInt(status)
    }
    if (Object.keys(updateData).length === 0) {
      return res.json({ code: -1, message: '没有需要更新的字段' })
    }
    const user = await User.findByPk(req.params.id)
    if (!user || !user.is_ai) {
      return res.json({ code: -1, message: 'AI用户不存在' })
    }
    await User.update(updateData, { where: { id: req.params.id } })
    res.json({ code: 0, message: '已更新' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/ai/logs - 查看AI交易日志
 */
router.get('/ai/logs', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, user_id } = req.query
    const where = {}
    if (user_id) where.user_id = user_id

    const { count, rows } = await AiTradeLog.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      limit: parseInt(pageSize),
      offset: (parseInt(page) - 1) * parseInt(pageSize),
      raw: true
    })

    const userIds = [...new Set(rows.map(r => r.user_id))]
    const users = userIds.length > 0
      ? await User.findAll({ where: { id: userIds }, attributes: ['id', 'username', 'nickname'], raw: true })
      : []
    const userMap = {}
    for (const u of users) userMap[u.id] = u

    const list = rows.map(r => ({
      ...r,
      username: userMap[r.user_id]?.username || '',
      nickname: userMap[r.user_id]?.nickname || ''
    }))

    res.json({ code: 0, data: { list, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/admin/announcement
 * Get the current admin announcement.
 * Response: { code, data: AdminAnnouncement|null }
 */
router.get('/announcement', async (req, res) => {
  try {
    const ann = await AdminAnnouncement.findOne({ order: [['id', 'DESC']] })
    res.json({ code: 0, data: ann })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * PUT /api/v1/admin/announcement
 * Create or update the admin announcement.
 * Body: { content_zh_cn?, content_zh_tw?, content_en?, enabled? }
 */
router.put('/announcement', async (req, res) => {
  try {
    const { content_zh_cn, content_zh_tw, content_en, enabled } = req.body
    let ann = await AdminAnnouncement.findOne({ order: [['id', 'DESC']] })
    if (ann) {
      const updates = {}
      if (content_zh_cn !== undefined) updates.content_zh_cn = content_zh_cn
      if (content_zh_tw !== undefined) updates.content_zh_tw = content_zh_tw
      if (content_en !== undefined) updates.content_en = content_en
      if (enabled !== undefined) updates.enabled = enabled
      await ann.update(updates)
    } else {
      ann = await AdminAnnouncement.create({
        content_zh_cn: content_zh_cn || '',
        content_zh_tw: content_zh_tw || '',
        content_en: content_en || '',
        enabled: enabled !== undefined ? enabled : 1
      })
    }
    res.json({ code: 0, data: ann, message: '保存成功' })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/admin/announcement/translate
 * Translate announcement content to other languages using LLM.
 * Body: { source_lang, content } where source_lang is 'zh_cn', 'zh_tw', or 'en'
 * Response: { code, data: { content_zh_cn, content_zh_tw, content_en } }
 */
router.post('/announcement/translate', async (req, res) => {
  try {
    const { source_lang, content } = req.body
    if (!content) {
      return res.json({ code: -1, message: '请提供要翻译的内容' })
    }

    const config = await AiLlmConfig.findOne({ where: { status: 1 }, order: [['id', 'ASC']] })
    if (!config) {
      return res.json({ code: -1, message: '请先配置并启用 LLM' })
    }

    const langNames = { zh_cn: '简体中文', zh_tw: '繁體中文', en: 'English' }
    const targets = ['zh_cn', 'zh_tw', 'en'].filter(l => l !== source_lang)
    const targetNames = targets.map(l => langNames[l]).join('、')

    const { callLLM } = require('../services/llmClient')
    const result = await callLLM(config, [
      { role: 'system', content: `你是一个翻译助手。将${langNames[source_lang]}内容翻译成${targetNames}。直接返回翻译结果，不要解释，不要加任何前缀后缀。使用JSON格式。` },
      { role: 'user', content: `请将以下${langNames[source_lang]}内容翻译成${targetNames}，返回JSON格式：\n{\n${targets.map(t => `  "${t}": ""`).join(',\n')}\n}\n\n内容：${content}` }
    ], { maxTokens: 4096, temperature: 0.3 })

    let translated
    try {
      translated = JSON.parse(result.content)
    } catch {
      return res.json({ code: -1, message: 'LLM 返回格式异常，请重试' })
    }

    const response = { content_zh_cn: '', content_zh_tw: '', content_en: '' }
    response[`content_${source_lang}`] = content
    for (const t of targets) {
      response[`content_${t}`] = translated[t] || ''
    }

    res.json({ code: 0, data: response })
  } catch (err) {
    res.json({ code: -1, message: err.message || '翻译失败' })
  }
})

module.exports = router