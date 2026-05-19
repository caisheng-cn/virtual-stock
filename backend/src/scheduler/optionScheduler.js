/**
 * 调度管理器 — 从 DB 读取配置动态创建定时任务
 */
const cron = require('cron')
const optionSync = require('../services/optionSync')
const optionService = require('../services/option')
const stockSync = require('../services/stockSync')
const { SchedulerConfig, MarketConfig, StockSyncRecord } = require('../models')
const { isTradingHours, isWeekend } = require('../utils/marketTime')

const RUNNING = {}
const JOBS = {}

// 任务处理函数表
const HANDLERS = {
  option_contract_sync: async () => {
    if (RUNNING.contract_sync) return
    RUNNING.contract_sync = true
    console.log('[调度器] 同步合约列表...')
    try {
      const count = await optionSync.batchSaveContractsToDB()
      console.log(`[调度器] 合约同步完成: ${count} 个`)
    } catch (e) { console.error('[调度器] 合约同步失败:', e.message) }
    RUNNING.contract_sync = false
  },

  option_price_sync: async () => {
    if (RUNNING.price_sync) return
    if (isWeekend()) return
    if (!isTradingHours('SSE') && !isTradingHours('CFFEX')) return
    RUNNING.price_sync = true
    console.log('[调度器] 同步实时行情...')
    try {
      const count = await optionSync.updateRealtimePrices()
      if (count > 0) console.log(`[调度器] 实时行情更新: ${count} 条`)
    } catch (e) { console.error('[调度器] 行情同步失败:', e.message) }
    RUNNING.price_sync = false
  },

  option_daily_close: async () => {
    console.log('[调度器] 同步收盘数据...')
    try {
      const count = await optionSync.syncAllDailyClose()
      console.log(`[调度器] 收盘价同步完成: ${count} 条`)
      try {
        const g = await optionSync.syncGreeks()
        console.log(`[调度器] Greeks同步完成: ${g.length} 条`)
      } catch (e) { console.error('[调度器] Greeks同步失败:', e.message) }
    } catch (e) { console.error('[调度器] 收盘同步失败:', e.message) }
  },

  option_settlement: async () => {
    if (RUNNING.settlement) return
    RUNNING.settlement = true
    console.log('[调度器] 到期结算...')
    try {
      const result = await optionService.autoSettleExpired()
      if (result.expiredCount > 0) {
        console.log(`[调度器] 结算完成: ${result.expiredCount} 个合约, ${result.settled} 笔, 赔付 ${result.totalPayout}`)
      }
    } catch (e) { console.error('[调度器] 结算失败:', e.message) }
    RUNNING.settlement = false
  },

}

async function loadJobs() {
  // 停止所有现有任务
  for (const key of Object.keys(JOBS)) {
    try { JOBS[key].stop() } catch (e) {}
  }

  const configs = await SchedulerConfig.findAll({ where: { enabled: 1 }, raw: true })

  for (const cfg of configs) {
    const handler = HANDLERS[cfg.task_key]
    if (!handler) {
      console.log(`[调度器] 跳过未知任务: ${cfg.task_key}`)
      continue
    }
    try {
      const job = new cron.CronJob(cfg.cron_expression, handler, null, true)
      JOBS[cfg.task_key] = job
      console.log(`[调度器] 已启动: ${cfg.task_name} (${cfg.cron_expression})`)
    } catch (e) {
      console.error(`[调度器] 启动失败 ${cfg.task_name}: ${e.message}`)
    }
  }

  const marketLabel = { 1: 'A股', 2: '港股', 3: '美股' }
  const marketConfigs = await MarketConfig.findAll({ raw: true })
  for (const cfg of marketConfigs) {
    if (!cfg.refresh_time) continue
    const [h, m] = cfg.refresh_time.split(':')
    const taskKey = `stock_sync_${cfg.market_type}`
    const cronExpr = `${m} ${h} * * 1-5`
    const label = marketLabel[cfg.market_type] || `市场${cfg.market_type}`
    const handler = async () => {
      if (RUNNING[taskKey]) return
      RUNNING[taskKey] = true
      console.log(`[调度器] 同步${label}股票日线数据...`)
      try {
        const record = await StockSyncRecord.create({
          market_type: cfg.market_type,
          status: 'running',
          started_at: new Date()
        })
        await stockSync.startSync(cfg.market_type, record.id)
        console.log(`[调度器] ${label}股票同步完成`)
      } catch (e) {
        console.error(`[调度器] ${label}股票同步失败:`, e.message)
      }
      RUNNING[taskKey] = false
    }
    try {
      const job = new cron.CronJob(cronExpr, handler, null, true)
      JOBS[taskKey] = job
      console.log(`[调度器] 已启动: ${label}股票同步 (${cronExpr})`)
    } catch (e) {
      console.error(`[调度器] 启动失败 ${label}股票同步: ${e.message}`)
    }
  }

  console.log(`[调度器] 共运行 ${Object.keys(JOBS).length} 个定时任务`)
}

function start() {
  loadJobs().catch(e => console.error('[调度器] 初始化失败:', e.message))
}

// 供管理 API 热重载
async function reload() {
  await loadJobs()
}

module.exports = { start, reload, loadJobs }
