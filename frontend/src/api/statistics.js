import request from '@/utils/request'

export const getProfitStats = () => request.get('/statistics/profit')
export const getPositionStats = () => request.get('/statistics/positions')
export const getTradeStats = () => request.get('/statistics/trades')