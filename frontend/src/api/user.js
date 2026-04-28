/**
 * File: user.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: User API module. Provides functions for user authentication (login, register)
 *              and fetching the current user's profile information.
 * Version History:
 *   v1.0 - Initial version
 */

import request from '@/utils/request'

/**
 * login
 * Description: POST /users/login — Authenticates user with credentials and returns a JWT token.
 * @param {Object} data - Login payload (username, password)
 * @returns {Promise<Object>} Response containing token and user info
 */
export const login = (data) => request.post('/users/login', data)

/**
 * register
 * Description: POST /users/register — Creates a new user account.
 * @param {Object} data - Registration payload (username, password, etc.)
 * @returns {Promise<Object>} Response containing registration result
 */
export const register = (data) => request.post('/users/register', data)

/**
 * getUserInfo
 * Description: GET /users/info — Fetches the profile information of the currently authenticated user.
 * @returns {Promise<Object>} Response containing user profile data
 */
export const getUserInfo = () => request.get('/users/info')