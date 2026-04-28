import request from '@/utils/request'

export const adminLogin = (data) => request.post('/admin/login', data)
export const getStats = () => request.get('/admin/stats')

export const getGroups = (params) => request.get('/admin/groups', { params })
export const createGroup = (data) => request.post('/admin/groups', data)
export const updateGroup = (id, data) => request.put(`/admin/groups/${id}`, data)
export const deleteGroup = (id, data) => request.delete(`/admin/groups/${id}`, { data })
export const getGroupUsers = (id, params) => request.get(`/admin/groups/${id}/users`, { params })
export const addGroupUser = (id, data) => request.post(`/admin/groups/${id}/users`, data)
export const removeGroupUser = (id, userId) => request.delete(`/admin/groups/${id}/users/${userId}`)

export const getUsers = (params) => request.get('/admin/users', { params })
export const getUserDetail = (id) => request.get(`/admin/users/${id}/detail`)
export const getUserLoginHistory = (id, params) => request.get(`/admin/users/${id}/login-history`, { params })
export const getUserTransactions = (id, params) => request.get(`/admin/users/${id}/transactions`, { params })
export const getUserFundFlow = (id, params) => request.get(`/admin/users/${id}/fund-flow`, { params })
export const setTradeEnabled = (id, data) => request.put(`/admin/users/${id}/trade-enabled`, data)
export const setAdminAccess = (id, data) => request.put(`/admin/users/${id}/admin-access`, data)
export const toggleUserStatus = (id, data) => request.put(`/admin/users/${id}/status`, data)
export const deleteUser = (id, data) => request.delete(`/admin/users/${id}`, { data })

export const getStocks = (params) => request.get('/admin/stocks', { params })
export const getStockPositions = (id) => request.get(`/admin/stocks/${id}/positions`)
export const createStock = (data) => request.post('/admin/stocks', data)
export const deleteStock = (id) => request.delete(`/admin/stocks/${id}`)
export const refreshStocks = (data) => request.post('/admin/stocks/refresh', data)
export const getMissingStocks = (params) => request.get('/admin/stocks/missing', { params })

export const getInviteCodes = (params) => request.get('/admin/invite-codes', { params })
export const createInviteCode = (data) => request.post('/admin/invite-codes', data)

export const getCommissionConfigs = () => request.get('/admin/commission-configs')
export const updateCommissionConfig = (id, data) => request.put(`/admin/commission-configs/${id}`, data)
export const getCommissionHistory = (params) => request.get('/admin/commission-history', { params })

export const getMarketConfig = () => request.get('/admin/market-config')
export const updateMarketConfig = (id, data) => request.put(`/admin/market-config/${id}`, data)

export const payDividend = (id, data) => request.post(`/admin/stocks/${id}/dividend`, data)
export const doAllotment = (id, data) => request.post(`/admin/stocks/${id}/allotment`, data)

export const getGroupStatistics = (params) => request.get('/admin/statistics/groups', { params })
export const getUserStatistics = (params) => request.get('/admin/statistics/users', { params })