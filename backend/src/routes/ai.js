const express = require('express')
const { AiLlmConfig, AiTradeLog, User, UserGroup } = require('../models')
const auth = require('../utils/auth')
const { testConnection } = require('../services/llmClient')
const { processAIUser } = require('../services/aiTradeService')
const { processAISocialInteraction } = require('../services/aiSocialService')
const aiScheduler = require('../services/aiSchedulerService')

const router = express.Router()

router.use(auth)

router.get('/config', async (req, res) => {
  try {
    const configs = await AiLlmConfig.findAll({ raw: true })
    res.json({ code: 0, data: configs.map(c => ({ ...c, api_key: c.api_key ? '***' : '' })) })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

router.post('/config/test', async (req, res) => {
  try {
    const config = req.body
    if (!config.api_url || !config.api_key) {
      return res.json({ code: -1, message: '参数不完整' })
    }
    const result = await testConnection(config)
    res.json({ code: result.success ? 0 : -1, data: result })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

router.post('/trigger', async (req, res) => {
  try {
    const aiUsers = await User.findAll({
      where: { is_ai: 1, status: 1, trade_enabled: 1 },
      raw: true
    })
    const results = []
    for (const user of aiUsers) {
      const ug = await UserGroup.findOne({ where: { user_id: user.id }, raw: true })
      if (!ug) continue
      const tradeResult = await processAIUser(user.id, ug.group_id)
      results.push({ userId: user.id, trade: tradeResult })
      await new Promise(r => setTimeout(r, 1000))
      const socialResult = await processAISocialInteraction(user.id, ug.group_id)
      results[results.length - 1].social = socialResult
      await new Promise(r => setTimeout(r, 500))
    }
    res.json({ code: 0, data: results })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

router.get('/logs', async (req, res) => {
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

    const list = []
    for (const log of rows) {
      const user = await User.findByPk(log.user_id, { attributes: ['username', 'nickname'] })
      list.push({ ...log, username: user?.username || '', nickname: user?.nickname || '' })
    }

    res.json({ code: 0, data: { list, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
