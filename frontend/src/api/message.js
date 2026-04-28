import request from '@/utils/request'

export const getGroupMessages = (groupId, params) => request.get(`/messages/${groupId}`, { params })
export const toggleLike = (messageId) => request.post(`/messages/${messageId}/like`)
export const replyMessage = (messageId, data) => request.post(`/messages/${messageId}/reply`, data)
export const getUnreadCount = () => request.get('/messages/unread/count')
