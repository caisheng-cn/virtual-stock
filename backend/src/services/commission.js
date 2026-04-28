/**
 * File: commission.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Commission calculation service. Provides functions to retrieve commission
 *   rates from the database (with in-memory caching) and calculate commission amounts.
 * Version History:
 *   v1.0 - Initial version
 */

const { CommissionConfig } = require('../models')

const cache = new Map()

/**
 * Get the commission rate for a given market type and trade type.
 * Results are cached in memory to reduce database queries. If no config exists,
 * a default rate of 0.5 is created and persisted.
 * @param {number} marketType - Market type: 1 (A-share), 2 (HK), 3 (US)
 * @param {number} tradeType - Trade type: 1 (buy), 2 (sell)
 * @returns {Promise<number>} The commission rate (e.g., 0.5 = 0.5‰)
 */
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

/**
 * Calculate the commission amount from a trade amount and rate
 * The rate is in per-mille (‰), so the formula is: amount * rate / 1000, rounded to 2 decimals
 * @param {number} amount - The trade amount in CNY
 * @param {number} rate - The commission rate (e.g., 0.5 = 0.5‰)
 * @returns {number} The calculated commission, rounded to 2 decimal places
 */
function calculateCommission(amount, rate) {
  return Math.round(amount * rate / 1000 * 100) / 100
}

/**
 * Clear the in-memory commission rate cache.
 * Should be called after any admin updates to commission configs.
 * @returns {void}
 */
function clearCache() {
  cache.clear()
}

module.exports = {
  getCommissionRate,
  calculateCommission,
  clearCache
}