const { CommissionConfig } = require('../models')

const cache = new Map()

async function getCommissionRate(marketType, tradeType) {
  const cacheKey = `${marketType}_${tradeType}`
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }

  let config = await CommissionConfig.findOne({
    where: { market_type: marketType, trade_type: tradeType }
  })

  if (!config) {
    config = await CommissionConfig.create({
      market_type: marketType,
      trade_type: tradeType,
      commission_rate: 0.5
    })
  }

  const rate = config ? parseFloat(config.commission_rate) : 0.5
  cache.set(cacheKey, rate)

  return rate
}

function calculateCommission(amount, rate) {
  return Math.round(amount * rate / 1000 * 100) / 100
}

function clearCache() {
  cache.clear()
}

module.exports = {
  getCommissionRate,
  calculateCommission,
  clearCache
}