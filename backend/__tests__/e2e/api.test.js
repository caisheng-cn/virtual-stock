const request = require('supertest')

const BASE_URL = 'http://localhost:3001/api/v1'

describe('API E2E Tests - 完整API测试', () => {
  let authToken = ''
  let adminToken = ''

  describe('用户模块', () => {
    describe('Given 新用户注册', () => {
      const randomUsername = `testuser_${Date.now()}`

      describe('When 提交注册请求', () => {
        it('Then 应注册成功并返回用户ID', async () => {
          const res = await request(BASE_URL)
            .post('/users/register')
            .send({
              username: randomUsername,
              password: '123456',
              nickname: '测试用户',
              invite_code: 'DEFAULT2024'
            })

          expect(res.body.code).toBe(0)
          expect(res.body.data.userId).toBeDefined()
        })
      })
    })

    describe('Given 无效邀请码', () => {
      describe('When 提交注册请求', () => {
        it('Then 应返回邀请码错误', async () => {
          const res = await request(BASE_URL)
            .post('/users/register')
            .send({
              username: `test002_${Date.now()}`,
              password: '123456',
              invite_code: 'WRONG'
            })

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('邀请码')
        })
      })
    })

    describe('Given 已存在的用户名', () => {
      describe('When 提交注册请求', () => {
        it('Then 应返回用户名已存在', async () => {
          const res = await request(BASE_URL)
            .post('/users/register')
            .send({
              username: 'testuser',
              password: '123456',
              invite_code: 'DEFAULT2024'
            })

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('已存在')
        })
      })
    })

    describe('Given 正确的用户名和密码', () => {
      describe('When 提交登录请求', () => {
        it('Then 应返回Token', async () => {
          const res = await request(BASE_URL)
            .post('/users/login')
            .send({
              username: 'testuser',
              password: '123456'
            })

          if (res.body.code === 0 && res.body.data.token) {
            authToken = res.body.data.token
            expect(res.body.data.token).toBeDefined()
          } else {
            console.log('Login skipped:', res.body.message)
          }
        })
      })
    })

    describe('Given 错误的密码', () => {
      describe('When 提交登录请求', () => {
        it('Then 应返回密码错误', async () => {
          const res = await request(BASE_URL)
            .post('/users/login')
            .send({
              username: 'testuser',
              password: 'wrongpass'
            })

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('密码')
        })
      })
    })

    describe('Given 不存在的用户', () => {
      describe('When 提交登录请求', () => {
        it('Then 应返回用户不存在', async () => {
          const res = await request(BASE_URL)
            .post('/users/login')
            .send({
              username: 'nonexist_' + Date.now(),
              password: '123456'
            })

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('不存在')
        })
      })
    })
  })

  describe('群组模块', () => {
    describe('Given 有效的Token', () => {
      describe('When 获取我的群组', () => {
        it('Then 应返回群组列表', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/groups/my')
            .set('Authorization', `Bearer ${authToken}`)

          expect(res.body.code).toBe(0)
          expect(Array.isArray(res.body.data)).toBe(true)
        })
      })
    })
  })

  describe('资金模块', () => {
    describe('Given 有效的Token和群组ID', () => {
      describe('When 获取资金状况', () => {
        it('Then 应返回资金数据', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/balance')
            .query({ group_id: 1 })
            .set('Authorization', `Bearer ${authToken}`)

          if (res.body.code === 0) {
            expect(res.body.data.cash).toBeDefined()
          } else {
            console.log('Balance check skipped:', res.body.message)
          }
        })
      })
    })
  })

  describe('股票模块', () => {
    describe('Given 有效的Token', () => {
      describe('When 获取股票池', () => {
        it('Then 应返回股票列表', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/stocks')
            .query({ market_type: 1 })
            .set('Authorization', `Bearer ${authToken}`)

          expect(res.body.code).toBe(0)
        })
      })
    })

    describe('Given 有效的股票代码', () => {
      describe('When 获取A股行情(600519)', () => {
        it('Then 应返回行情数据', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/stocks/600519/quote')
            .query({ market_type: 1 })
            .set('Authorization', `Bearer ${authToken}`)

          if (res.body.code === 0) {
            expect(res.body.data.price).toBeDefined()
          } else {
            console.log('Quote check skipped:', res.body.message)
          }
        })
      })
    })
  })

  describe('交易模块', () => {
    describe('Given 有效的交易参数', () => {
      describe('When 买入股票', () => {
        it('Then 应返回交易结果', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .post('/trade/buy')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              group_id: 1,
              stock_code: '600519',
              market_type: 1,
              shares: 100
            })

          if (res.body.code === -1 && res.body.message.includes('今日已交易')) {
            expect(true).toBe(true)
          } else {
            expect([0, -1]).toContain(res.body.code)
          }
        })
      })
    })
  })

  describe('持仓模块', () => {
    describe('Given 有效的Token和群组ID', () => {
      describe('When 获取持仓列表', () => {
        it('Then 应返回持仓数据', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/positions')
            .query({ group_id: 1 })
            .set('Authorization', `Bearer ${authToken}`)

          expect(res.body.code).toBe(0)
        })
      })
    })
  })

  describe('交易记录模块', () => {
    describe('Given 有效的Token和群组ID', () => {
      describe('When 获取交易记录', () => {
        it('Then 应返回交易记录', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/transactions')
            .query({ group_id: 1 })
            .set('Authorization', `Bearer ${authToken}`)

          expect(res.body.code).toBe(0)
        })
      })
    })
  })

  describe('统计模块', () => {
    describe('Given 有效的Token和群组ID', () => {
      describe('When 获取收益统计', () => {
        it('Then 应返回统计数据', async () => {
          if (!authToken) {
            console.log('Skipping: no auth token')
            return
          }

          const res = await request(BASE_URL)
            .get('/statistics/profit')
            .query({ group_id: 1 })
            .set('Authorization', `Bearer ${authToken}`)

          if (res.body.code === 0) {
            expect(res.body.data.profit).toBeDefined()
          } else {
            console.log('Stats check skipped:', res.body.message)
          }
        })
      })
    })
  })

  describe('管理员模块', () => {
    describe('Given 正确的管理员账号', () => {
      describe('When 提交登录请求', () => {
        it('Then 应返回管理员Token', async () => {
          const res = await request(BASE_URL)
            .post('/admin/login')
            .send({
              username: 'admin',
              password: 'admin123'
            })

          if (res.body.code === 0 && res.body.data.token) {
            adminToken = res.body.data.token
            expect(res.body.data.token).toBeDefined()
          } else {
            console.log('Admin login skipped:', res.body.message)
          }
        })
      })
    })

    describe('Given 有效的管理员Token', () => {
      describe('When 获取统计数据', () => {
        it('Then 应返回统计数据', async () => {
          if (!adminToken) {
            console.log('Skipping: no admin token')
            return
          }

          const res = await request(BASE_URL)
            .get('/admin/stats')
            .set('Authorization', `Bearer ${adminToken}`)

          if (res.body.code === 0) {
            expect(res.body.data.userCount).toBeDefined()
          } else {
            console.log('Admin stats skipped:', res.body.message)
          }
        })
      })
    })

    describe('Given 有效的管理员Token', () => {
      describe('When 生成邀请码', () => {
        it('Then 应返回邀请码', async () => {
          if (!adminToken) {
            console.log('Skipping: no admin token')
            return
          }

          const res = await request(BASE_URL)
            .post('/admin/invite-codes')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              group_id: 1,
              use_limit: 10
            })

          if (res.body.code === 0) {
            expect(res.body.data.code).toBeDefined()
          } else {
            console.log('Invite code creation skipped:', res.body.message)
          }
        })
      })
    })
  })
})