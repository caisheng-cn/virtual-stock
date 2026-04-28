/**
 * File: currency.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Currency conversion utilities. Converts stock prices in USD/HKD to CNY
 *   and vice versa. Market types: 1 = A-share (CNY), 2 = HK (HKD), 3 = US (USD).
 * Version History:
 *   v1.0 - Initial version
 */

const EXCHANGE_RATES = {
  USD_TO_CNY: 7,
  HKD_TO_CNY: 0.9
}

/**
 * Convert a stock price to CNY based on market type
 * @param {number} price - The stock price in its original currency
 * @param {number} marketType - Market type: 1 (A-share, CNY), 2 (HK, HKD), 3 (US, USD)
 * @returns {number} The price converted to CNY
 */
function toCNY(price, marketType) {
  if (marketType === 3) {
    return price * EXCHANGE_RATES.USD_TO_CNY
  }
  if (marketType === 2) {
    return price * EXCHANGE_RATES.HKD_TO_CNY
  }
  return price
}

/**
 * Convert a CNY amount back to the original currency of a market type
 * @param {number} cnyAmount - The amount in CNY
 * @param {number} marketType - Market type: 1 (A-share), 2 (HK), 3 (US)
 * @returns {number} The amount converted from CNY to the target currency
 */
function fromCNY(cnyAmount, marketType) {
  if (marketType === 3) {
    return cnyAmount / EXCHANGE_RATES.USD_TO_CNY
  }
  if (marketType === 2) {
    return cnyAmount / EXCHANGE_RATES.HKD_TO_CNY
  }
  return cnyAmount
}

/**
 * Get the currency symbol / code for a given market type
 * @param {number} marketType - Market type: 1 (A-share), 2 (HK), 3 (US)
 * @returns {string} Currency code: 'RMB', 'HKD', or 'USD'
 */
function getCurrencySymbol(marketType) {
  if (marketType === 3) return 'USD'
  if (marketType === 2) return 'HKD'
  return 'RMB'
}

module.exports = {
  EXCHANGE_RATES,
  toCNY,
  fromCNY,
  getCurrencySymbol
}