import request from '@/utils/request'

export const getStockList = (params) => request.get('/stocks', { params })
export const getStockQuote = (code, marketType) => request.get(`/stocks/${code}/quote`, { params: { market_type: marketType } })
export const getStockHistory = (code, marketType, options = {}) => {
  const params = { market_type: marketType }
  if (options.source) params.source = options.source
  if (options.start_date) params.start_date = options.start_date
  if (options.end_date) params.end_date = options.end_date
  return request.get(`/stocks/${code}/history`, { params })
}

export const getCommissionConfigs = () => request.get('/stocks/commission-configs')