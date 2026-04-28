const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const { User, UserGroup, Group, UserBalance, InviteCode, sequelize } = require('../../../src/models')

const app = express()
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET || 'virtual-stock-secret-key'

const setupApp = () => {
  app.use('/users', require('../../../src/routes/users'))
  return app
}

describe('Users Routes - 用户注册登录', () => {
  let testApp

  beforeAll(async () => {
    testApp = setupApp()
  })

  afterAll(async () => {
    await sequelize.close()
  })

  describe('POST /users/register - 用户注册', () => {
    describe('Given 完整的注册信息', () => {
      const validRegisterData = {
        username: 'newuser_' + Date.now(),
        password: '123456',
        nickname: '新用户',
        invite_code: 'DEFAULT2024'
      }

      describe('When 提交注册请求', () => {
        it('Then 应返回code=0和用户ID', async () => {
          const res = await request(testApp)
            .post('/users/register')
            .send(validRegisterData)

          expect(res.body.code).toBe(0)
          expect(res.body.data.userId).toBeDefined()
          expect(res.body.data.username).toBe(validRegisterData.username)
        })
      })
    })

    describe('Given 无效的邀请码', () => {
      const invalidInviteData = {
        username: 'testuser_invalid',
        password: '123456',
        invite_code: 'WRONGCODE'
      }

      describe('When 提交注册请求', () => {
        it('Then 应返回邀请码无效错误', async () => {
          const res = await request(testApp)
            .post('/users/register')
            .send(invalidInviteData)

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('邀请码')
        })
      })
    })

    describe('Given 已存在的用户名', () => {
      const existingUserData = {
        username: 'testuser',
        password: '123456',
        invite_code: 'DEFAULT2024'
      }

      describe('When 提交注册请求', () => {
        it('Then 应返回用户名已存在错误', async () => {
          const res = await request(testApp)
            .post('/users/register')
            .send(existingUserData)

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('已存在')
        })
      })
    })

    describe('Given 缺少必填参数', () => {
      const incompleteData = {
        username: 'incomplete'
      }

      describe('When 提交注册请求', () => {
        it('Then 应返回参数不完整错误', async () => {
          const res = await request(testApp)
            .post('/users/register')
            .send(incompleteData)

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('参数')
        })
      })
    })
  })

  describe('POST /users/login - 用户登录', () => {
    describe('Given 正确的用户名和密码', () => {
      const validLoginData = {
        username: 'testuser',
        password: '123456'
      }

      describe('When 提交登录请求', () => {
        it('Then 应返回code=0和Token', async () => {
          const res = await request(testApp)
            .post('/users/login')
            .send(validLoginData)

          expect(res.body.code).toBe(0)
          expect(res.body.data.token).toBeDefined()
          expect(res.body.data.userId).toBeDefined()
        })

        it('Then Token应可被正确验证', async () => {
          const res = await request(testApp)
            .post('/users/login')
            .send(validLoginData)

          const token = res.body.data.token
          const decoded = jwt.verify(token, JWT_SECRET)
          expect(decoded.userId).toBeDefined()
        })
      })
    })

    describe('Given 错误的密码', () => {
      const wrongPasswordData = {
        username: 'testuser',
        password: 'wrongpass'
      }

      describe('When 提交登录请求', () => {
        it('Then 应返回密码错误', async () => {
          const res = await request(testApp)
            .post('/users/login')
            .send(wrongPasswordData)

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('密码')
        })
      })
    })

    describe('Given 不存在的用户', () => {
      const nonExistData = {
        username: 'nonexist_user_' + Date.now(),
        password: '123456'
      }

      describe('When 提交登录请求', () => {
        it('Then 应返回用户不存在', async () => {
          const res = await request(testApp)
            .post('/users/login')
            .send(nonExistData)

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('不存在')
        })
      })
    })

    describe('Given 缺少参数', () => {
      const missingData = {
        username: 'testuser'
      }

      describe('When 提交登录请求', () => {
        it('Then 应返回参数不完整', async () => {
          const res = await request(testApp)
            .post('/users/login')
            .send(missingData)

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('参数')
        })
      })
    })
  })

  describe('GET /users/info - 获取用户信息', () => {
    let authToken

    beforeAll(async () => {
      const res = await request(testApp)
        .post('/users/login')
        .send({ username: 'testuser', password: '123456' })
      authToken = res.body.data.token
    })

    describe('Given 有效的Token', () => {
      describe('When 获取用户信息', () => {
        it('Then 应返回用户基本信息', async () => {
          const res = await request(testApp)
            .get('/users/info')
            .set('Authorization', `Bearer ${authToken}`)

          expect(res.body.code).toBe(0)
          expect(res.body.data.username).toBe('testuser')
        })
      })
    })

    describe('Given 无Token', () => {
      describe('When 获取用户信息', () => {
        it('Then 应返回未授权', async () => {
          const res = await request(testApp)
            .get('/users/info')

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('未授权')
        })
      })
    })

    describe('Given 无效的Token', () => {
      describe('When 获取用户信息', () => {
        it('Then 应返回Token无效', async () => {
          const res = await request(testApp)
            .get('/users/info')
            .set('Authorization', 'Bearer invalid.token')

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('Token')
        })
      })
    })
  })
})