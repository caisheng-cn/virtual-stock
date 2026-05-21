const bcrypt = require('bcryptjs')
const { Op } = require('sequelize')
const {
  User, UserGroup, UserBalance, Group, AiLlmConfig
} = require('../models')

const NICKNAMES_CONSERVATIVE = [
  '稳健老张', '价值投资王', '长线持有李', '股息猎手', '蓝筹守护者'
]
const NICKNAMES_RANDOM = [
  '趋势小陈', '波段操作刘', '量化交易员', '市场观察者', '灵活调仓赵'
]
const NICKNAMES_AGGRESSIVE = [
  '涨停敢死队', '短线狙击手', '龙头战法孙', '热点追击周', '激进冲锋号'
]

function getRandomNickname(personality) {
  const pool = {
    conservative: NICKNAMES_CONSERVATIVE,
    random: NICKNAMES_RANDOM,
    aggressive: NICKNAMES_AGGRESSIVE
  }
  const names = pool[personality] || pool.random
  return names[Math.floor(Math.random() * names.length)]
}

async function generateAIUsers(groupId, configId, count = 3) {
  const group = await Group.findByPk(groupId)
  if (!group) {
    throw new Error('群组不存在')
  }

  const config = await AiLlmConfig.findByPk(configId)
  if (!config || config.status === 0) {
    throw new Error('LLM配置不存在或已禁用')
  }

  const personalities = ['conservative', 'random', 'aggressive']
  const createdUsers = []
  const ts = Date.now().toString().slice(-4)

  for (let i = 0; i < count; i++) {
    const personality = personalities[i % 3]
    const username = `ai_${personality[0]}_${groupId}_${ts}_${i}`
    const nickname = getRandomNickname(personality)

    const password = await bcrypt.hash('ai_user_2024', 10)
    const initCash = parseFloat(group.init_cash)

    const user = await User.create({
      username,
      password,
      nickname,
      status: 1,
      trade_enabled: 1,
      is_ai: 1,
      ai_personality: personality,
      ai_config_id: configId,
      language: 'zh-CN'
    })

    await UserGroup.create({
      user_id: user.id,
      group_id: groupId
    })

    await UserBalance.create({
      user_id: user.id,
      group_id: groupId,
      cash: initCash,
      init_cash: initCash,
      frozen_cash: 0,
      total_cost: 0
    })

    createdUsers.push(user)
  }

  return createdUsers.map(u => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    personality: u.ai_personality
  }))
}

async function removeAIUsers(groupId) {
  const ugList = await UserGroup.findAll({ where: { group_id: groupId }, raw: true })
  const userIds = ugList.map(ug => ug.user_id)
  if (userIds.length === 0) return 0

  const aiUsers = await User.findAll({ where: { id: userIds, is_ai: 1 }, raw: true })

  for (const u of aiUsers) {
    await UserGroup.destroy({ where: { user_id: u.id, group_id: groupId } })
    await UserBalance.destroy({ where: { user_id: u.id } })
    await User.destroy({ where: { id: u.id } })
  }

  return aiUsers.length
}

async function getAIUsersByGroup(groupId) {
  const ugList = await UserGroup.findAll({ where: { group_id: groupId }, raw: true })
  const userIds = ugList.map(ug => ug.user_id)
  if (userIds.length === 0) return []

  const users = await User.findAll({
    where: { id: userIds, is_ai: 1 },
    attributes: ['id', 'username', 'nickname', 'ai_personality', 'ai_config_id',
      'personality_prompt', 'status', 'trade_enabled', 'daily_trade_count', 'daily_trade_date', 'created_at'],
    raw: true
  })

  const result = []
  for (const u of users) {
    const balance = await UserBalance.findOne({ where: { user_id: u.id }, raw: true }) || {}
    result.push({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      personality: u.ai_personality,
      personality_prompt: u.personality_prompt,
      status: u.status,
      trade_enabled: u.trade_enabled,
      daily_trade_count: u.daily_trade_count,
      cash: parseFloat(balance.cash || 0),
      init_cash: parseFloat(balance.init_cash || 0),
      created_at: u.created_at
    })
  }
  return result
}

async function getAllAIUsers() {
  const users = await User.findAll({
    where: { is_ai: 1 },
    attributes: ['id', 'username', 'nickname', 'ai_personality', 'ai_config_id',
      'personality_prompt', 'status', 'trade_enabled', 'daily_trade_count', 'daily_trade_date', 'created_at'],
    raw: true
  })

  const result = []
  for (const u of users) {
    const balance = await UserBalance.findOne({ where: { user_id: u.id }, raw: true }) || {}
    const ug = await UserGroup.findOne({ where: { user_id: u.id }, raw: true })
    const group = ug ? await Group.findByPk(ug.group_id, { raw: true }) : null
    const config = u.ai_config_id ? await AiLlmConfig.findByPk(u.ai_config_id, { raw: true }) : null
    result.push({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      personality: u.ai_personality,
      personality_prompt: u.personality_prompt,
      group_id: ug ? ug.group_id : null,
      group_name: group ? group.name : '',
      config_name: config ? config.config_name : '',
      status: u.status,
      trade_enabled: u.trade_enabled,
      daily_trade_count: u.daily_trade_count,
      cash: parseFloat(balance.cash || 0),
      init_cash: parseFloat(balance.init_cash || 0),
      created_at: u.created_at
    })
  }
  return result
}

module.exports = { generateAIUsers, removeAIUsers, getAIUsersByGroup, getAllAIUsers }
