const { Op } = require('sequelize')
const {
  User, GroupMessage, MessageReply, MessageLike,
  AiLlmConfig, AiTradeLog, UserBalance, Position
} = require('../models')
const { callLLM } = require('./llmClient')

const MAX_REPLIES_PER_DAY = 15
const MAX_LIKES_PER_HOUR = 5

async function getRemainingLimits(userId) {
  const oneHourAgo = new Date(Date.now() - 3600000)
  const today = new Date().toISOString().split('T')[0]
  const [replies, likes, dailyReplies] = await Promise.all([
    AiTradeLog.count({ where: { user_id: userId, interaction_type: 'reply', created_at: { [Op.gte]: oneHourAgo } } }),
    AiTradeLog.count({ where: { user_id: userId, interaction_type: 'like', created_at: { [Op.gte]: oneHourAgo } } }),
    AiTradeLog.count({ where: { user_id: userId, interaction_type: 'reply', created_at: { [Op.gte]: today } } })
  ])
  return {
    remainingReplies: Math.max(0, MAX_REPLIES_PER_DAY - dailyReplies),
    remainingLikes: Math.max(0, MAX_LIKES_PER_HOUR - likes)
  }
}

async function buildContext(userId) {
  const [balance, positions] = await Promise.all([
    UserBalance.findOne({ where: { user_id: userId } }),
    Position.findAll({ where: { user_id: userId, shares: { [Op.gt]: 0 } }, raw: true })
  ])
  const cash = balance ? parseFloat(balance.cash) : 0
  const positionsText = positions.length > 0
    ? positions.map(p => `${p.stock_code} ${parseFloat(p.shares).toFixed(0)}股`).join(', ')
    : '暂无持仓'
  return { cash, positionsText }
}

async function processCandidate(userId, groupId, candidate, user, config, limits) {
  if (limits.remainingReplies <= 0 && limits.remainingLikes <= 0) return

  const msg = candidate.message
  const isTrade = candidate.type === 'trade'
  const realUser = await User.findByPk(msg.user_id)
  const realUserName = realUser ? (realUser.nickname || realUser.username) : '用户'

  let systemMsg
  if (isTrade) {
    const typeLabel = msg.message_type === 1 ? '买入' : '卖出'
    const { cash, positionsText } = await buildContext(userId)
    systemMsg = `你是${user.nickname || user.username}，一名股票投资者。
你的当前持仓: ${positionsText}
你的可用资金: ¥${cash.toFixed(2)}

群组中有用户的交易动态:
${realUserName} ${typeLabel} ${msg.stock_code} ${msg.stock_name || ''} ${msg.shares}股 单价¥${parseFloat(msg.price || 0).toFixed(2)}

请分析这笔交易并决定是否回复和点赞。
回复内容需要包含具体的投资逻辑分析（支持或反对的理由）。

回复格式必须是严格的JSON（不要包含其他文字）:
{"reply": true或false, "content": "回复内容（reply为true时必填）", "like": true或false}`
  } else {
    systemMsg = `你是${user.nickname || user.username}，一名股票投资者。
用户${realUserName}在你的交易下发表了评论:
"${msg.content}"

请回复这条评论，表达你的看法（感谢、解释、反驳等）。

回复格式必须是严格的JSON（不要包含其他文字）:
{"reply": true或false, "content": "回复内容（reply为true时必填）", "like": true或false}`
  }

  try {
    const result = await callLLM(config, [
      { role: 'system', content: systemMsg },
      { role: 'user', content: isTrade ? `请分析${realUserName}的这笔交易，给出你的看法。` : `请回复${realUserName}的评论。` }
    ])

    const cleaned = result.content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    let decision
    try {
      decision = JSON.parse(cleaned.substring(start, end + 1))
    } catch (e) {
      return
    }

    const msgId = isTrade ? msg.id : msg.message_id
    const typeLabel = isTrade ? (msg.message_type === 1 ? '买入' : '卖出') : '评论'

    if (decision.reply === true && decision.content && limits.remainingReplies > 0) {
      const existing = await MessageReply.findOne({
        where: { message_id: msgId, user_id: userId, content: decision.content.trim() }
      })
      if (!existing) {
        await MessageReply.create({
          message_id: msgId, user_id: userId, content: decision.content.trim()
        })
        limits.remainingReplies--
        await AiTradeLog.create({
          user_id: userId, group_id: groupId,
          interaction_type: 'reply',
          target_message_id: msgId,
          reply_content: decision.content.trim(),
          reason: isTrade ? `回复${realUserName}的${typeLabel}操作` : `回复${realUserName}的评论`,
          llm_response: result.content, executed: 1
        })
      }
    }

    if (decision.like === true && limits.remainingLikes > 0) {
      const existing = await MessageLike.findOne({
        where: { message_id: msgId, user_id: userId }
      })
      if (!existing) {
        await MessageLike.create({ message_id: msgId, user_id: userId })
        limits.remainingLikes--
        await AiTradeLog.create({
          user_id: userId, group_id: groupId,
          interaction_type: 'like',
          target_message_id: msgId,
          reason: isTrade ? `点赞${realUserName}的${typeLabel}操作` : `点赞${realUserName}的评论`,
          llm_response: result.content, executed: 1
        })
      }
    }
  } catch (err) {
    console.error(`[AISocial] LLM调用失败 userId=${userId}:`, err.message)
  }
}

async function processAISocialInteraction(userId, groupId) {
  const user = await User.findByPk(userId)
  if (!user || !user.is_ai || user.status === 0) {
    return { executed: false, reason: 'AI用户不可用' }
  }

  const config = await AiLlmConfig.findByPk(user.ai_config_id)
  if (!config || config.status === 0) {
    return { executed: false, reason: 'LLM配置不可用' }
  }

  const limits = await getRemainingLimits(userId)
  if (limits.remainingReplies <= 0 && limits.remainingLikes <= 0) {
    return { executed: false, reason: '社交互动已达上限' }
  }

  const myReplyMsgIds = (await MessageReply.findAll({
    where: { user_id: userId }, attributes: ['message_id'], raw: true
  })).map(r => r.message_id)

  const [realTradeMsgs, aiMessages] = await Promise.all([
    GroupMessage.findAll({
      where: { group_id: groupId, user_id: { [Op.ne]: userId }, message_type: { [Op.in]: [1, 2] } },
      order: [['id', 'ASC']], raw: true
    }),
    GroupMessage.findAll({
      where: { group_id: groupId, user_id: userId },
      attributes: ['id'], raw: true
    })
  ])

  const candidates = []

  for (const m of realTradeMsgs) {
    if (!myReplyMsgIds.includes(m.id)) {
      candidates.push({ type: 'trade', message: m })
    }
  }

  const aiMsgIds = aiMessages.map(m => m.id)
  if (aiMsgIds.length > 0) {
    const realRepliesOnAI = await MessageReply.findAll({
      where: { message_id: { [Op.in]: aiMsgIds }, user_id: { [Op.ne]: userId } },
      order: [['created_at', 'ASC']], raw: true
    })
    for (const r of realRepliesOnAI) {
      if (!myReplyMsgIds.includes(r.message_id)) {
        candidates.push({ type: 'reply', message: r })
      }
    }
  }

  if (candidates.length === 0) {
    return { executed: false, reason: '无可回复的消息' }
  }

  const allMsgIds = [...new Set(candidates.map(c => c.message.id))]
  const repliedMsgIds = (await MessageReply.findAll({
    where: { message_id: { [Op.in]: allMsgIds } },
    attributes: ['message_id'], raw: true
  })).map(r => r.message_id)
  candidates.sort((a, b) => {
    const aHasReplies = repliedMsgIds.includes(a.message.id) ? 1 : 0
    const bHasReplies = repliedMsgIds.includes(b.message.id) ? 1 : 0
    return aHasReplies - bHasReplies
  })

  const startReplies = limits.remainingReplies
  const startLikes = limits.remainingLikes

  for (const c of candidates) {
    await processCandidate(userId, groupId, c, user, config, limits)
    if (limits.remainingReplies <= 0 && limits.remainingLikes <= 0) break
    await new Promise(r => setTimeout(r, 500))
  }

  return {
    executed: true,
    replied: startReplies - limits.remainingReplies,
    liked: startLikes - limits.remainingLikes
  }
}

module.exports = { processAISocialInteraction }
