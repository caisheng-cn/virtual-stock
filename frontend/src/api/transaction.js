/**
 * File: transaction.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Transaction API module. Provides functions for querying transaction history
 *              and fund flow data filtered by date range and trade type.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * getTransactions
 * Description: GET /transactions — Retrieves a paginated list of transactions filtered by date range and trade type.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} tradeType - Trade type filter (buy/sell)
 * @param {number} page - Page number
 * @param {number} pageSize - Number of items per page
 * @returns {Promise<Object>} Response containing transaction list
 */
export const getTransactions = (startDate, endDate, tradeType, page, pageSize) =>
  request.get('/transactions', { params: { start_date: startDate, end_date: endDate, trade_type: tradeType, page, pageSize } })

/**
 * getFundFlow
 * Description: GET /transactions/fund-flow — Retrieves fund flow data within a date range.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Object>} Response containing fund flow data
 */
export const getFundFlow = (startDate, endDate) =>
  request.get('/transactions/fund-flow', { params: { start_date: startDate, end_date: endDate } })