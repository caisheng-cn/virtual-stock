import request from '@/utils/request'

export const getVersion = () => request.get('/about')