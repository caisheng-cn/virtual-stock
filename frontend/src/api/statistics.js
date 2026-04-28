/**
 * File: statistics.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Statistics API module. Provides functions for retrieving profit, position,
 *              and trade statistics for the authenticated user.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * getProfitStats
 * Description: GET /statistics/profit — Retrieves profit and loss statistics.
 * @returns {Promise<Object>} Response containing profit stats
 */
export const getProfitStats = () => request.get('/statistics/profit')

/**
 * getPositionStats
 * Description: GET /statistics/positions — Retrieves position distribution statistics.
 * @returns {Promise<Object>} Response containing position stats
 */
export const getPositionStats = () => request.get('/statistics/positions')

/**
 * getTradeStats
 * Description: GET /statistics/trades — Retrieves trade activity statistics.
 * @returns {Promise<Object>} Response containing trade stats
 */
export const getTradeStats = () => request.get('/statistics/trades')