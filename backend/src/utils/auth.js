/**
 * File: auth.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: JWT authentication middleware. Extracts and verifies Bearer tokens from the
 *   Authorization header, then attaches userId / adminId and username to the request object.
 * Version History:
 *   v1.0 - Initial version
 */

const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'virtual-stock-secret-key-2024'

/**
 * Authentication middleware
 * Verifies the JWT Bearer token and sets req.userId / req.adminId and req.username.
 * Handles tokens issued to regular users (userId, id) and admin users (adminId).
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next middleware function
 * @returns {void}
 * @throws {JsonWebTokenError} If the token is invalid or expired
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ code: -1, message: '未授权' })
  }

  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    if (decoded.adminId) {
      req.adminId = decoded.adminId
      req.username = decoded.username
      next()
    } else if (decoded.userId) {
      req.userId = decoded.userId
      req.username = decoded.username
      next()
    } else if (decoded.id) {
      req.userId = decoded.id
      req.username = decoded.username
      next()
    } else {
      return res.json({ code: -1, message: '无效的Token' })
    }
  } catch (err) {
    return res.json({ code: -1, message: 'Token无效' })
  }
}