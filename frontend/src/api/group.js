import request from '@/utils/request'

export const getMyGroups = () => request.get('/groups/my')
export const getGroupList = (params) => request.get('/groups', { params })
export const getGroupInfo = (id) => request.get(`/groups/${id}`)
export const joinGroup = (data) => request.post('/groups/join', data)
export const leaveGroup = (data) => request.post('/groups/leave', data)
export const getBalance = (groupId) => request.get('/balance', { params: { group_id: groupId } })
export const getGroupRanking = (groupId) => request.get(`/groups/${groupId}/ranking`)
export const getMemberDetails = (groupId, userId) => request.get(`/groups/${groupId}/members/${userId}/details`)