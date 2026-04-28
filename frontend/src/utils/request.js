/**
 * File: request.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Axios HTTP client configured with baseURL '/api/v1'. Attaches Bearer token from
 *              localStorage on requests and handles errors / 401 redirects on responses.
 * Version History:
 *   v1.0 - Initial version
 */

import axios from 'axios'

const request = axios.create({
  baseURL: '/api/v1',
  timeout: 10000
})

request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  const adminToken = localStorage.getItem('adminToken')

  if (config.url.startsWith('/admin/') && adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  response => {
    if (response.data.code === 0) {
      return response.data
    }
    return Promise.reject(new Error(response.data.message))
  },
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('adminToken')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default request