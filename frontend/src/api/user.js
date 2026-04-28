import request from '@/utils/request'

export const login = (data) => request.post('/users/login', data)
export const register = (data) => request.post('/users/register', data)
export const getUserInfo = () => request.get('/users/info')