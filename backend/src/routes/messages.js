/**
 * File: messages.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Group message routes. Provides message listing (with pagination and user
 *   details), like/unlike toggling, reply creation, and unread message counting.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { GroupMessage, MessageLike, MessageReply, User, UserGroup, sequelize } = require('../models')
const auth = require('../utils/auth')
const { Op } = require('sequelize')

const router = express.Router()

/**
 * GET /api/v1/messages/:groupId
 * Get paginated messages for a group with user details, likes, and replies.
 * Updates the user's last_read_message_id for the group.
 * Query: { page?, pageSize?, start_date?, end_date? }
 * Response: { code, data: { list: GroupMessage[], total } }
 */
router.get('/:groupId', auth, async (req, res) => {
  try {
    const { groupId } = req.params
    const { page = 1, pageSize = 20, start_date, end_date } = req.query

    const where = { group_id: groupId }
    if (start_date || end_date) {
      where.created_at = {}
      if (start_date) where.created_at[Op.gte] = start_date
      if (end_date) where.created_at[Op.lte] = end_date + ' 23:59:59'
    }

    const { count, rows } = await GroupMessage.findAndCountAll({
      where,
      limit: parseInt(pageSize),
      offset: (page - 1) * parseInt(pageSize),
      order: [['created_at', 'DESC']]
    })

    const userIds = [...new Set(rows.map(r => r.user_id))]
    const users = await User.findAll({ where: { id: userIds }, attributes: ['id', 'username', 'nickname'] })
    const userMap = {}
    for (const u of users) userMap[u.id] = { nickname: u.nickname || u.username, username: u.username }

    const messageIds = rows.map(r => r.id)

    const likes = await MessageLike.findAll({ where: { message_id: messageIds } })
    const likeMap = {}
    for (const l of likes) {
      if (!likeMap[l.message_id]) likeMap[l.message_id] = []
      likeMap[l.message_id].push(l.user_id)
    }

    const replies = await MessageReply.findAll({ where: { message_id: messageIds }, order: [['created_at', 'ASC']] })
    const replyMap = {}
    for (const r of replies) {
      if (!replyMap[r.message_id]) replyMap[r.message_id] = []
      replyMap[r.message_id].push({
        id: r.id,
        user_id: r.user_id,
        nickname: userMap[r.user_id]?.nickname || 'User',
        content: r.content,
        created_at: r.created_at
      })
    }

    const list = rows.map(m => ({
      id: m.id,
      group_id: m.group_id,
      user_id: m.user_id,
      nickname: userMap[m.user_id]?.nickname || 'User',
      message_type: m.message_type,
      stock_code: m.stock_code,
      stock_name: m.stock_name,
      market_type: m.market_type,
      shares: m.shares,
      price: parseFloat(m.price || 0),
      amount: parseFloat(m.amount || 0),
      content: m.content,
      created_at: m.created_at,
      likeCount: likeMap[m.id]?.length || 0,
      liked: (likeMap[m.id] || []).includes(req.userId),
      likers: (likeMap[m.id] || []).map(uid => ({ user_id: uid, nickname: userMap[uid]?.nickname || 'User' })),
      replies: replyMap[m.id] || []
    }))

    // Update last read message id
    const latestMessageId = rows.length > 0 ? rows[0].id : 0
    if (latestMessageId > 0) {
      await UserGroup.update(
        { last_read_message_id: latestMessageId },
        { where: { user_id: req.userId, group_id: groupId } }
      )
    }

    res.json({ code: 0, data: { list, total: count } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/messages/:messageId/like
 * Toggle like/unlike on a group message.
 * Response: { code, data: { liked: boolean } }
 */
router.post('/:messageId/like', auth, async (req, res) => {
  try {
    const { messageId } = req.params
    const existing = await MessageLike.findOne({ where: { message_id: messageId, user_id: req.userId } })
    if (existing) {
      await existing.destroy()
      res.json({ code: 0, data: { liked: false } })
    } else {
      await MessageLike.create({ message_id: messageId, user_id: req.userId })
      res.json({ code: 0, data: { liked: true } })
    }
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * POST /api/v1/messages/:messageId/reply
 * Reply to a group message.
 * Body: { content }
 * Response: { code, data: { id, created_at } }
 */
router.post('/:messageId/reply', auth, async (req, res) => {
  try {
    const { messageId } = req.params
    const { content } = req.body
    if (!content || !content.trim()) {
      return res.json({ code: -1, message: '回复内容不能为空' })
    }
    const reply = await MessageReply.create({
      message_id: messageId,
      user_id: req.userId,
      content: content.trim()
    })
    res.json({ code: 0, data: { id: reply.id, created_at: reply.created_at } })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * GET /api/v1/messages/unread/count
 * Get the total count of unread messages across all groups the user belongs to.
 * Response: { code, data: number }
 */
router.get('/unread/count', auth, async (req, res) => {
  try {
    const userGroups = await UserGroup.findAll({ where: { user_id: req.userId } })
    if (userGroups.length === 0) return res.json({ code: 0, data: 0 })

    let totalUnread = 0
    for (const ug of userGroups) {
      const lastReadId = ug.last_read_message_id || 0
      const count = await GroupMessage.count({
        where: { group_id: ug.group_id, id: { [Op.gt]: lastReadId } }
      })
      totalUnread += count
    }
    res.json({ code: 0, data: totalUnread })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

module.exports = router
