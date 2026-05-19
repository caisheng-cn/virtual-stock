const cron = require('cron')
const { User, UserGroup, AiLlmConfig } = require('../models')
const { processAIUser } = require('./aiTradeService')
const { processAISocialInteraction } = require('./aiSocialService')

const RUNNING = {}
let job = null

function isMarketHours() {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const h = now.getHours()
  const m = now.getMinutes()
  const time = h * 60 + m
  return time >= 570 && time <= 1020
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

async function processSingleUser(userId, groupId, doTrade) {
  const key = `user_${userId}`
  if (RUNNING[key]) return
  RUNNING[key] = true
  try {
    if (doTrade) {
      const result = await processAIUser(userId, groupId)
      if (result.executed) {
        console.log(`[AIScheduler] AI用户${userId}交易 ${result.action}: ${result.reason?.substring(0, 50)}`)
      }
    }
    const socialResult = await processAISocialInteraction(userId, groupId)
    if (socialResult.executed) {
      console.log(`[AIScheduler] AI用户${userId}社交: 回复${socialResult.replied} 点赞${socialResult.liked}`)
    }
  } catch (err) {
    console.error(`[AIScheduler] AI用户${userId}处理失败:`, err.message)
  }
  delete RUNNING[key]
}

async function runAICycle() {
  if (RUNNING.cycle) {
    console.log('[AIScheduler] 上一轮还未完成，跳过')
    return
  }
  RUNNING.cycle = true
  console.log(`[AIScheduler] 开始AI调度轮询 ${new Date().toLocaleString('zh-CN')}`)

  try {
    const aiUsers = await User.findAll({
      where: { is_ai: 1, status: 1, trade_enabled: 1 },
      raw: true
    })

    if (aiUsers.length === 0) {
      console.log('[AIScheduler] 无活跃AI用户')
      RUNNING.cycle = false
      return
    }

    const doTrade = isMarketHours()
    const promises = []

    for (let i = 0; i < aiUsers.length; i++) {
      const user = aiUsers[i]
      const ug = await UserGroup.findOne({ where: { user_id: user.id }, raw: true })
      if (!ug) continue

      const config = await AiLlmConfig.findByPk(user.ai_config_id)
      if (!config || config.status === 0) continue

      const staggerMin = 15
      const staggerMax = 40
      const baseDelay = i * staggerMin * 60000
      const extra = randomDelay(0, (staggerMax - staggerMin) * 60000)
      const delay = baseDelay + extra

      const p = new Promise(resolve => {
        setTimeout(async () => {
          await processSingleUser(user.id, ug.group_id, doTrade)
          resolve()
        }, delay)
      })
      promises.push(p)
    }

    await Promise.all(promises)
  } catch (err) {
    console.error('[AIScheduler] 调度错误:', err.message)
  }

  console.log(`[AIScheduler] 本轮调度完成 ${new Date().toLocaleString('zh-CN')}`)
  RUNNING.cycle = false
}

function start() {
  if (job) {
    console.log('[AIScheduler] 已启动，跳过')
    return
  }

  try {
    job = new cron.CronJob('0 * * * *', async () => {
      await runAICycle()
    }, null, true)

    console.log('[AIScheduler] AI调度器已启动 (每小时轮询)')

    runAICycle()
  } catch (err) {
    console.error('[AIScheduler] 启动失败:', err.message)
  }
}

function stop() {
  if (job) {
    job.stop()
    job = null
    console.log('[AIScheduler] 已停止')
  }
}

async function triggerOnce() {
  await runAICycle()
  return { success: true }
}

module.exports = { start, stop, triggerOnce }
