import request from '@/utils/request'

export const getWhitelist = () => request.get('/options/whitelist')

export const getExpirations = (stockCode, marketType, exchange) =>
  request.get('/options/expirations', { params: { stock_code: stockCode, market_type: marketType, exchange } })

export const getOptionChain = (stockCode, marketType, expiration) =>
  request.get('/options/contracts', {
    params: { stock_code: stockCode, market_type: marketType, expiration },
    timeout: 30000
  })

export const buyOption = (data) => request.post('/options/buy', data)

export const sellOption = (data) => request.post('/options/sell', data)

export const exerciseOption = (data) => request.post('/options/exercise', data)

export const getOptionPositions = (groupId) =>
  request.get('/options/positions', { params: { group_id: groupId } })

export const getOptionTransactions = (params) =>
  request.get('/options/transactions', { params })
