/**
 * File: group.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Group API module. Provides functions for managing trading groups, including
 *              retrieval, joining, leaving, balances, rankings, and member details.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * getMyGroups
 * Description: GET /groups/my — Retrieves all groups the current user belongs to.
 * @returns {Promise<Object>} Response containing list of user's groups
 */
export const getMyGroups = () => request.get('/groups/my')

/**
 * getGroupList
 * Description: GET /groups — Retrieves a paginated list of available groups.
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing group list
 */
export const getGroupList = (params) => request.get('/groups', { params })

/**
 * getGroupInfo
 * Description: GET /groups/:id — Fetches detailed information for a specific group.
 * @param {number|string} id - Group ID
 * @returns {Promise<Object>} Response containing group details
 */
export const getGroupInfo = (id) => request.get(`/groups/${id}`)

/**
 * joinGroup
 * Description: POST /groups/join — Submits a request to join a group using an invite code.
 * @param {Object} data - Join payload (invite code, etc.)
 * @returns {Promise<Object>} Response containing join result
 */
export const joinGroup = (data) => request.post('/groups/join', data)

/**
 * leaveGroup
 * Description: POST /groups/leave — Leaves a group the user is currently a member of.
 * @param {Object} data - Leave payload (group ID, etc.)
 * @returns {Promise<Object>} Response confirming departure
 */
export const leaveGroup = (data) => request.post('/groups/leave', data)

/**
 * getBalance
 * Description: GET /balance — Retrieves the current user's balance within a group.
 * @param {number|string} groupId - Group ID
 * @returns {Promise<Object>} Response containing balance data
 */
export const getBalance = (groupId) => request.get('/balance', { params: { group_id: groupId } })

/**
 * getGroupRanking
 * Description: GET /groups/:groupId/ranking — Retrieves the ranking of members within a group.
 * @param {number|string} groupId - Group ID
 * @returns {Promise<Object>} Response containing ranking list
 */
export const getGroupRanking = (groupId) => request.get(`/groups/${groupId}/ranking`)

/**
 * getMemberDetails
 * Description: GET /groups/:groupId/members/:userId/details — Retrieves detailed information for a specific member.
 * @param {number|string} groupId - Group ID
 * @param {number|string} userId - User ID
 * @param {Object} params - Query parameters (page, pageSize, start_date, end_date)
 * @returns {Promise<Object>} Response containing member details
 */
export const getMemberDetails = (groupId, userId, params) => request.get(`/groups/${groupId}/members/${userId}/details`, { params })