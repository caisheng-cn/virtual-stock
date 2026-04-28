/**
 * File: admin.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Admin API module. Provides comprehensive administrative functions for managing
 *              groups, users, stocks, invite codes, commission configs, market config,
 *              dividends, allotments, and platform statistics.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * adminLogin
 * Description: POST /admin/login — Authenticates an admin user and returns a JWT token.
 * @param {Object} data - Login payload (username, password)
 * @returns {Promise<Object>} Response containing admin token and info
 */
export const adminLogin = (data) => request.post('/admin/login', data)

/**
 * getStats
 * Description: GET /admin/stats — Retrieves platform-level statistics for the admin dashboard.
 * @returns {Promise<Object>} Response containing platform stats
 */
export const getStats = () => request.get('/admin/stats')

/**
 * getGroups
 * Description: GET /admin/groups — Retrieves a paginated list of all groups.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing group list
 */
export const getGroups = (params) => request.get('/admin/groups', { params })

/**
 * createGroup
 * Description: POST /admin/groups — Creates a new trading group.
 * @param {Object} data - Group creation payload
 * @returns {Promise<Object>} Response containing created group
 */
export const createGroup = (data) => request.post('/admin/groups', data)

/**
 * updateGroup
 * Description: PUT /admin/groups/:id — Updates an existing group's configuration.
 * @param {number|string} id - Group ID
 * @param {Object} data - Group update payload
 * @returns {Promise<Object>} Response containing updated group
 */
export const updateGroup = (id, data) => request.put(`/admin/groups/${id}`, data)

/**
 * deleteGroup
 * Description: DELETE /admin/groups/:id — Deletes a group by ID.
 * @param {number|string} id - Group ID
 * @param {Object} data - Additional deletion data
 * @returns {Promise<Object>} Response confirming deletion
 */
export const deleteGroup = (id, data) => request.delete(`/admin/groups/${id}`, { data })

/**
 * getGroupUsers
 * Description: GET /admin/groups/:id/users — Retrieves users belonging to a specific group.
 * @param {number|string} id - Group ID
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing user list for the group
 */
export const getGroupUsers = (id, params) => request.get(`/admin/groups/${id}/users`, { params })

/**
 * addGroupUser
 * Description: POST /admin/groups/:id/users — Adds a user to a group.
 * @param {number|string} id - Group ID
 * @param {Object} data - Payload containing user identifier
 * @returns {Promise<Object>} Response confirming user addition
 */
export const addGroupUser = (id, data) => request.post(`/admin/groups/${id}/users`, data)

/**
 * removeGroupUser
 * Description: DELETE /admin/groups/:id/users/:userId — Removes a user from a group.
 * @param {number|string} id - Group ID
 * @param {number|string} userId - User ID to remove
 * @returns {Promise<Object>} Response confirming user removal
 */
export const removeGroupUser = (id, userId) => request.delete(`/admin/groups/${id}/users/${userId}`)

/**
 * getUsers
 * Description: GET /admin/users — Retrieves a paginated list of all platform users.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing user list
 */
export const getUsers = (params) => request.get('/admin/users', { params })

/**
 * getUserDetail
 * Description: GET /admin/users/:id/detail — Retrieves detailed information for a specific user.
 * @param {number|string} id - User ID
 * @returns {Promise<Object>} Response containing user detail
 */
export const getUserDetail = (id) => request.get(`/admin/users/${id}/detail`)

/**
 * getUserLoginHistory
 * Description: GET /admin/users/:id/login-history — Retrieves the login history for a user.
 * @param {number|string} id - User ID
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing login history
 */
export const getUserLoginHistory = (id, params) => request.get(`/admin/users/${id}/login-history`, { params })

/**
 * getUserTransactions
 * Description: GET /admin/users/:id/transactions — Retrieves transaction records for a user.
 * @param {number|string} id - User ID
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing transaction list
 */
export const getUserTransactions = (id, params) => request.get(`/admin/users/${id}/transactions`, { params })

/**
 * getUserFundFlow
 * Description: GET /admin/users/:id/fund-flow — Retrieves fund flow data for a user.
 * @param {number|string} id - User ID
 * @param {Object} params - Query parameters (date range, etc.)
 * @returns {Promise<Object>} Response containing fund flow data
 */
export const getUserFundFlow = (id, params) => request.get(`/admin/users/${id}/fund-flow`, { params })

/**
 * setTradeEnabled
 * Description: PUT /admin/users/:id/trade-enabled — Enables or disables a user's trading capability.
 * @param {number|string} id - User ID
 * @param {Object} data - Payload with trade_enabled flag
 * @returns {Promise<Object>} Response confirming the update
 */
export const setTradeEnabled = (id, data) => request.put(`/admin/users/${id}/trade-enabled`, data)

/**
 * setAdminAccess
 * Description: PUT /admin/users/:id/admin-access — Grants or revokes admin access for a user.
 * @param {number|string} id - User ID
 * @param {Object} data - Payload with admin_access flag
 * @returns {Promise<Object>} Response confirming the update
 */
export const setAdminAccess = (id, data) => request.put(`/admin/users/${id}/admin-access`, data)

/**
 * toggleUserStatus
 * Description: PUT /admin/users/:id/status — Activates or deactivates a user account.
 * @param {number|string} id - User ID
 * @param {Object} data - Payload with status flag
 * @returns {Promise<Object>} Response confirming the update
 */
export const toggleUserStatus = (id, data) => request.put(`/admin/users/${id}/status`, data)

/**
 * deleteUser
 * Description: DELETE /admin/users/:id — Permanently deletes a user account.
 * @param {number|string} id - User ID
 * @param {Object} data - Additional deletion data
 * @returns {Promise<Object>} Response confirming deletion
 */
export const deleteUser = (id, data) => request.delete(`/admin/users/${id}`, { data })

/**
 * getStocks
 * Description: GET /admin/stocks — Retrieves a paginated list of all stocks.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing stock list
 */
export const getStocks = (params) => request.get('/admin/stocks', { params })

/**
 * getStockPositions
 * Description: GET /admin/stocks/:id/positions — Retrieves all user positions for a stock.
 * @param {number|string} id - Stock ID
 * @returns {Promise<Object>} Response containing position list
 */
export const getStockPositions = (id) => request.get(`/admin/stocks/${id}/positions`)

/**
 * createStock
 * Description: POST /admin/stocks — Adds a new stock to the platform.
 * @param {Object} data - Stock creation payload (code, name, market type, etc.)
 * @returns {Promise<Object>} Response containing created stock
 */
export const createStock = (data) => request.post('/admin/stocks', data)

/**
 * deleteStock
 * Description: DELETE /admin/stocks/:id — Removes a stock from the platform.
 * @param {number|string} id - Stock ID
 * @returns {Promise<Object>} Response confirming deletion
 */
export const deleteStock = (id) => request.delete(`/admin/stocks/${id}`)

/**
 * refreshStocks
 * Description: POST /admin/stocks/refresh — Triggers a refresh of stock data from external sources.
 * @param {Object} data - Refresh payload (market types, etc.)
 * @returns {Promise<Object>} Response confirming refresh
 */
export const refreshStocks = (data) => request.post('/admin/stocks/refresh', data)

/**
 * getMissingStocks
 * Description: GET /admin/stocks/missing — Retrieves stocks missing from the platform that exist in external sources.
 * @param {Object} params - Query parameters
 * @returns {Promise<Object>} Response containing missing stock list
 */
export const getMissingStocks = (params) => request.get('/admin/stocks/missing', { params })

/**
 * getInviteCodes
 * Description: GET /admin/invite-codes — Retrieves a paginated list of invite codes.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing invite code list
 */
export const getInviteCodes = (params) => request.get('/admin/invite-codes', { params })

/**
 * createInviteCode
 * Description: POST /admin/invite-codes — Generates a new invite code.
 * @param {Object} data - Invite code creation payload
 * @returns {Promise<Object>} Response containing created invite code
 */
export const createInviteCode = (data) => request.post('/admin/invite-codes', data)

/**
 * getCommissionConfigs
 * Description: GET /admin/commission-configs — Retrieves all commission configuration rules.
 * @returns {Promise<Object>} Response containing commission configs
 */
export const getCommissionConfigs = () => request.get('/admin/commission-configs')

/**
 * updateCommissionConfig
 * Description: PUT /admin/commission-configs/:id — Updates a specific commission configuration.
 * @param {number|string} id - Commission config ID
 * @param {Object} data - Updated commission config payload
 * @returns {Promise<Object>} Response confirming the update
 */
export const updateCommissionConfig = (id, data) => request.put(`/admin/commission-configs/${id}`, data)

/**
 * getCommissionHistory
 * Description: GET /admin/commission-history — Retrieves historical commission records.
 * @param {Object} params - Query parameters (pagination, date range)
 * @returns {Promise<Object>} Response containing commission history
 */
export const getCommissionHistory = (params) => request.get('/admin/commission-history', { params })

/**
 * getMarketConfig
 * Description: GET /admin/market-config — Retrieves the current market configuration.
 * @returns {Promise<Object>} Response containing market config
 */
export const getMarketConfig = () => request.get('/admin/market-config')

/**
 * updateMarketConfig
 * Description: PUT /admin/market-config/:id — Updates a specific market configuration entry.
 * @param {number|string} id - Market config ID
 * @param {Object} data - Updated market config payload
 * @returns {Promise<Object>} Response confirming the update
 */
export const updateMarketConfig = (id, data) => request.put(`/admin/market-config/${id}`, data)

/**
 * payDividend
 * Description: POST /admin/stocks/:id/dividend — Issues a dividend payment for a stock.
 * @param {number|string} id - Stock ID
 * @param {Object} data - Dividend payload (amount, etc.)
 * @returns {Promise<Object>} Response confirming dividend payment
 */
export const payDividend = (id, data) => request.post(`/admin/stocks/${id}/dividend`, data)

/**
 * doAllotment
 * Description: POST /admin/stocks/:id/allotment — Performs a stock allotment (rights issue).
 * @param {number|string} id - Stock ID
 * @param {Object} data - Allotment payload (ratio, price, etc.)
 * @returns {Promise<Object>} Response confirming allotment
 */
export const doAllotment = (id, data) => request.post(`/admin/stocks/${id}/allotment`, data)

/**
 * getGroupStatistics
 * Description: GET /admin/statistics/groups — Retrieves aggregated statistics for all groups.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing group statistics
 */
export const getGroupStatistics = (params) => request.get('/admin/statistics/groups', { params })

/**
 * getUserStatistics
 * Description: GET /admin/statistics/users — Retrieves aggregated statistics for all users.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing user statistics
 */
export const getUserStatistics = (params) => request.get('/admin/statistics/users', { params })