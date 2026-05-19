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

const AUTH_ERRORS = ['未授权', 'Token无效', '无效的Token']

function redirectLogin(url) {
  localStorage.removeItem('token')
  localStorage.removeItem('adminToken')
  window.location.href = url?.startsWith('/admin') ? '/admin-login' : '/login'
}

request.interceptors.response.use(
  response => {
    if (response.data.code === 0) {
      return response.data
    }
    if (AUTH_ERRORS.includes(response.data.message)) {
      redirectLogin(response.config?.url)
    }
    return Promise.reject(new Error(response.data.message))
  },
  error => {
    if (error.response?.status === 401) {
      redirectLogin(error.config?.url)
    }
    return Promise.reject(error)
  }
)

export default request