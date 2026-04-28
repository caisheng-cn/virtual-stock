/**
 * File: trade.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Trade API module. Provides functions for buying/selling stocks, viewing
 *              current positions, and retrieving transaction records.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * buyStock
 * Description: POST /trade/buy — Places a buy order for a specified stock.
 * @param {Object} data - Buy order payload (stock code, quantity, price, etc.)
 * @returns {Promise<Object>} Response containing order result
 */
export const buyStock = (data) => request.post('/trade/buy', data)

/**
 * sellStock
 * Description: POST /trade/sell — Places a sell order for a specified stock.
 * @param {Object} data - Sell order payload (stock code, quantity, price, etc.)
 * @returns {Promise<Object>} Response containing order result
 */
export const sellStock = (data) => request.post('/trade/sell', data)

/**
 * getPositions
 * Description: GET /positions — Retrieves the current user's stock positions.
 * @returns {Promise<Object>} Response containing position list
 */
export const getPositions = () => request.get('/positions')

/**
 * getTransactions
 * Description: GET /transactions — Retrieves a paginated list of the user's transactions.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing transaction list
 */
export const getTransactions = (params) => request.get('/transactions', { params })