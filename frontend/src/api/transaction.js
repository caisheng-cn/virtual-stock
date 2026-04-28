import request from '@/utils/request'

export const getTransactions = (startDate, endDate, tradeType, page, pageSize) =>
  request.get('/transactions', { params: { start_date: startDate, end_date: endDate, trade_type: tradeType, page, pageSize } })

export const getFundFlow = (startDate, endDate) =>
  request.get('/transactions/fund-flow', { params: { start_date: startDate, end_date: endDate } })