/**
 * File: message.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Message API module. Provides functions for retrieving group messages,
 *              toggling likes, replying to messages, and checking unread counts.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * getGroupMessages
 * Description: GET /messages/:groupId — Retrieves messages for a specific group.
 * @param {number|string} groupId - Group ID
 * @param {Object} params - Query parameters (pagination, filters)
 * @returns {Promise<Object>} Response containing message list
 */
export const getGroupMessages = (groupId, params) => request.get(`/messages/${groupId}`, { params })

/**
 * toggleLike
 * Description: POST /messages/:messageId/like — Toggles the like status on a message.
 * @param {number|string} messageId - Message ID
 * @returns {Promise<Object>} Response confirming like toggle
 */
export const toggleLike = (messageId) => request.post(`/messages/${messageId}/like`)

/**
 * replyMessage
 * Description: POST /messages/:messageId/reply — Posts a reply to a specific message.
 * @param {number|string} messageId - Message ID
 * @param {Object} data - Reply payload (content, etc.)
 * @returns {Promise<Object>} Response containing the created reply
 */
export const replyMessage = (messageId, data) => request.post(`/messages/${messageId}/reply`, data)

/**
 * getUnreadCount
 * Description: GET /messages/unread/count — Retrieves the total count of unread messages.
 * @returns {Promise<Object>} Response containing unread count
 */
export const getUnreadCount = () => request.get('/messages/unread/count')
