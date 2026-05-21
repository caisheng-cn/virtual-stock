const { MarketConfig } = require('../models')

async function isTradeTimeBlocked(marketType) {
  const config = await MarketConfig.findOne({ where: { market_type: marketType } })
  if (!config || config.enabled === 0) return null
  const now = new Date()
  const currentTime = now.toTimeString().slice(0, 5)
  const fs = config.forbid_start
  const fe = config.forbid_end
  if (fs <= fe) {
    if (currentTime >= fs && currentTime <= fe) return config
  } else {
    if (currentTime >= fs || currentTime <= fe) return config
  }
  return null
}

module.exports = { isTradeTimeBlocked }
