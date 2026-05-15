/**
 * 中国期权市场交易时段判断工具
 */
const MARKET_SESSIONS = {
  SSE: [
    { start: '09:30', end: '11:30' },
    { start: '13:00', end: '15:00' },
  ],
  SZSE: [
    { start: '09:30', end: '11:30' },
    { start: '13:00', end: '15:00' },
  ],
  CFFEX: [
    { start: '09:30', end: '11:30' },
    { start: '13:00', end: '15:00' },
  ],
  DCE:  [
    { start: '09:00', end: '10:15' },
    { start: '10:30', end: '11:30' },
    { start: '13:30', end: '15:00' },
  ],
  SHFE: [
    { start: '09:00', end: '10:15' },
    { start: '10:30', end: '11:30' },
    { start: '13:30', end: '15:00' },
  ],
  CZCE: [
    { start: '09:00', end: '10:15' },
    { start: '10:30', end: '11:30' },
    { start: '13:30', end: '15:00' },
  ],
}

function getNowMinutes() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

function parseTime(str) {
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
}

function isWeekend() {
  const d = new Date().getDay()
  return d === 0 || d === 6
}

function isTradingHours(exchange) {
  if (isWeekend()) return false
  const now = getNowMinutes()
  const sessions = MARKET_SESSIONS[exchange]
  if (!sessions) return false
  return sessions.some(s => now >= parseTime(s.start) && now <= parseTime(s.end))
}

function getCurrentSession(exchange) {
  if (isWeekend()) return null
  const now = getNowMinutes()
  const sessions = MARKET_SESSIONS[exchange]
  if (!sessions) return null
  for (const s of sessions) {
    if (now >= parseTime(s.start) && now <= parseTime(s.end)) {
      return s
    }
  }
  return null
}

function isAnyTradingHours() {
  if (isWeekend()) return false
  const now = getNowMinutes()
  for (const sessions of Object.values(MARKET_SESSIONS)) {
    if (sessions.some(s => now >= parseTime(s.start) && now <= parseTime(s.end))) {
      return true
    }
  }
  return false
}

module.exports = {
  isTradingHours,
  getCurrentSession,
  isAnyTradingHours,
  isWeekend,
}
