import request from '@/utils/request'

export const buyStock = (data) => request.post('/trade/buy', data)
export const sellStock = (data) => request.post('/trade/sell', data)
export const getPositions = () => request.get('/positions')
export const getTransactions = (params) => request.get('/transactions', { params })