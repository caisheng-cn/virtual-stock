const EXCHANGE_RATES = {
  USD_TO_CNY: 7,
  HKD_TO_CNY: 0.9
}

function toCNY(price, marketType) {
  if (marketType === 3) {
    return price * EXCHANGE_RATES.USD_TO_CNY
  }
  if (marketType === 2) {
    return price * EXCHANGE_RATES.HKD_TO_CNY
  }
  return price
}

function fromCNY(cnyAmount, marketType) {
  if (marketType === 3) {
    return cnyAmount / EXCHANGE_RATES.USD_TO_CNY
  }
  if (marketType === 2) {
    return cnyAmount / EXCHANGE_RATES.HKD_TO_CNY
  }
  return cnyAmount
}

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