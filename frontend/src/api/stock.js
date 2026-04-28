/**
 * File: stock.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Stock API module. Provides functions for retrieving stock lists, quotes,
 *              historical data, and commission configuration.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * getStockList
 * Description: GET /stocks — Retrieves a paginated list of available stocks.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing stock list
 */
export const getStockList = (params) => request.get('/stocks', { params })

/**
 * getStockQuote
 * Description: GET /stocks/:code/quote — Retrieves the latest quote for a specific stock.
 * @param {string} code - Stock code
 * @param {string} marketType - Market type (e.g., 'A', 'HK', 'US')
 * @returns {Promise<Object>} Response containing stock quote data
 */
export const getStockQuote = (code, marketType) => request.get(`/stocks/${code}/quote`, { params: { market_type: marketType } })

/**
 * getStockHistory
 * Description: GET /stocks/:code/history — Retrieves historical price data for a stock.
 * @param {string} code - Stock code
 * @param {string} marketType - Market type
 * @param {Object} [options] - Optional filters (source, start_date, end_date)
 * @returns {Promise<Object>} Response containing historical data
 */
export const getStockHistory = (code, marketType, options = {}) => {
  const params = { market_type: marketType }
  if (options.source) params.source = options.source
  if (options.start_date) params.start_date = options.start_date
  if (options.end_date) params.end_date = options.end_date
  return request.get(`/stocks/${code}/history`, { params })
}

/**
 * getCommissionConfigs
 * Description: GET /stocks/commission-configs — Retrieves all commission configuration rules.
 * @returns {Promise<Object>} Response containing commission configs
 */
export const getCommissionConfigs = () => request.get('/stocks/commission-configs')