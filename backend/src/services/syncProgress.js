/**
 * 期权数据同步进度追踪器
 * 内存中维护当前同步状态，供前端轮询
 */
const syncStatus = {
  running: false,
  action: '',
  total: 0,
  completed: 0,
  current: '',
  message: '',
  error: '',
  updatedAt: null,
}

function reset(action, total) {
  syncStatus.running = true
  syncStatus.action = action
  syncStatus.total = total
  syncStatus.completed = 0
  syncStatus.current = ''
  syncStatus.message = ''
  syncStatus.error = ''
  syncStatus.updatedAt = new Date().toISOString()
}

function step(label) {
  syncStatus.current = label
  syncStatus.completed++
  syncStatus.updatedAt = new Date().toISOString()
  console.log(`[同步进度] ${syncStatus.completed}/${syncStatus.total}: ${label}`)
}

function finish(msg) {
  syncStatus.running = false
  syncStatus.message = msg
  syncStatus.completed = syncStatus.total
  syncStatus.current = '完成'
  syncStatus.updatedAt = new Date().toISOString()
  console.log(`[同步进度] 完成: ${msg}`)
}

function fail(err) {
  syncStatus.running = false
  syncStatus.error = err
  syncStatus.updatedAt = new Date().toISOString()
  console.error(`[同步进度] 失败: ${err}`)
}

function getStatus() {
  return { ...syncStatus }
}

module.exports = { reset, step, finish, fail, getStatus }
