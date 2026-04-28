const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'virtual-stock-secret-key-2024'

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