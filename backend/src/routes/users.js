const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { User, UserGroup, Group, UserBalance, InviteCode, LoginHistory, Transaction } = require('../models')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || 'virtual-stock-secret-key-2024'

router.post('/register', async (req, res) => {
   try {
     const { username, password, nickname, invite_code, language } = req.body
     if (!username || !password || !invite_code) {
       return res.json({ code: -1, message: res.t('trade.parameter_missing') })
     }

     const existUser = await User.findOne({ where: { username } })
     if (existUser) {
       return res.json({ code: -1, message: res.t('auth.user_exists') })
     }

     const invite = await InviteCode.findOne({ where: { code: invite_code, status: 1 } })
     if (!invite) {
       return res.json({ code: -1, message: res.t('auth.invalid_invite_code') })
     }

     if (invite.expire_date && new Date(invite.expire_date) < new Date()) {
       return res.json({ code: -1, message: res.t('auth.invite_code_expired') })
     }

     if (invite.use_limit && invite.used_count >= invite.use_limit) {
       return res.json({ code: -1, message: res.t('auth.invite_code_used_up') })
     }

     const hashedPassword = await bcrypt.hash(password, 10)
     const user = await User.create({
       username,
       password: hashedPassword,
       nickname: nickname || username,
       language: language || 'zh-CN',
       status: 1
     })

     await InviteCode.increment('used_count', { where: { id: invite.id } })

     const userGroup = await UserGroup.create({
       user_id: user.id,
       group_id: invite.group_id
     })

      const group = await Group.findByPk(invite.group_id)
       if (!group) {
         return res.json({ code: -1, message: res.t('auth.group_not_found') })
       }
       const initCash = parseFloat(group.init_cash) || 0
       await UserBalance.create({
         user_id: user.id,
         group_id: invite.group_id,
         cash: initCash,
         frozen_cash: 0,
         total_cost: 0,
         init_cash: initCash
       })

      await Transaction.create({
        user_id: user.id,
        group_id: invite.group_id,
        stock_code: '',
        stock_name: '',
        market_type: 0,
        trade_type: 5,
        price: 0,
        shares: 0,
        amount: initCash,
        commission: 0,
        commission_rate: 0,
        balance_after: initCash,
        profit: 0,
        trade_date: new Date().toISOString().split('T')[0],
        status: 1
      })

     res.json({ code: 0, message: res.t('common.success'), data: { userId: user.id, username: user.username, nickname: user.nickname } })
   } catch (err) {
     console.error(err)
     res.json({ code: -1, message: res.t('common.error') })
   }
 })

router.post('/login', async (req, res) => {
   try {
     const { username, password } = req.body
     if (!username || !password) {
       return res.json({ code: -1, message: res.t('trade.parameter_missing') })
     }

     const user = await User.findOne({ where: { username } })
     if (!user) {
       return res.json({ code: -1, message: res.t('auth.user_not_found') })
     }

     if (user.status === 0) {
       return res.json({ code: -1, message: res.t('auth.user_disabled') })
     }

     const isValid = await bcrypt.compare(password, user.password)
     if (!isValid) {
       return res.json({ code: -1, message: res.t('auth.invalid_credentials') })
     }

     const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' })
     const isAdmin = user.username === 'admin'

     await LoginHistory.create({
       user_id: user.id,
       login_time: new Date(),
       ip_address: req.ip || req.connection.remoteAddress || 'unknown',
       user_agent: req.headers['user-agent'] || 'unknown'
     })

     res.json({
       code: 0,
       message: res.t('common.success'),
       data: { token, userId: user.id, username: user.username, nickname: user.nickname, language: user.language, isAdmin }
     })
   } catch (err) {
     console.error(err)
     res.json({ code: -1, message: res.t('common.error') })
   }
 })

router.get('/info', require('../utils/auth'), async (req, res) => {
   try {
     const user = await User.findByPk(req.userId, { attributes: ['id', 'username', 'nickname', 'email', 'phone', 'status', 'language', 'created_at'] })
     res.json({ code: 0, message: 'success', data: user })
   } catch (err) {
     res.json({ code: -1, message: err.message })
   }
 })

router.put('/info', require('../utils/auth'), async (req, res) => {
   try {
     const { nickname, email, phone, language } = req.body
     const updateData = { nickname, email, phone }
     if (language !== undefined) {
       updateData.language = language
     }
     await User.update(updateData, { where: { id: req.userId } })
     res.json({ code: 0, message: res.t('common.success') })
   } catch (err) {
     console.error(err)
     res.json({ code: -1, message: res.t('common.error') })
   }
 })

module.exports = router