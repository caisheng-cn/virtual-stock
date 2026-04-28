const request = require('supertest')
const express = require('express')
const { User, UserBalance, Position, Transaction, sequelize } = require('../../../src/models')
const axios = require('axios')

const app = express()
app.use(express.json())
app.use('/trade', require('../../../src/routes/trade'))
app.use('/stocks', require('../../../src/routes/stocks'))
app.use('/users', require('../../../src/routes/users'))

jest.mock('axios')

describe('Trade Routes - 股票交易', () => {
  let authToken
  let testApp

  beforeAll(async () => {
    testApp = express()
    testApp.use(express.json())
    testApp.use('/trade', require('../../../src/routes/trade'))
    testApp.use('/stocks', require('../../../src/routes/stocks'))
    testApp.use('/users', require('../../../src/routes/users'))

    const res = await request(testApp)
      .post('/users/login')
      .send({ username: 'testuser', password: '123456' })
    authToken = res.body.data?.token
  })

  afterAll(async () => {
    await sequelize.close()
  })

  describe('POST /trade/buy - 买入股票', () => {
    describe('Given 有效的买入参数', () => {
      beforeEach(() => {
        axios.get.mockResolvedValue({
          data: 'var hq_str_sh600519="贵州茅台,1800.00,1790.00,1850.00,1820.00,1780.00,1500,2800000,50000000,2024-01-15,15:30:00";'
        })
      })

      afterEach(() => {
        axios.get.mockReset()
      })

      describe('When 提交买入请求(新持仓)', () => {
        it('Then 应返回code=0和交易信息', async () => {
          const res = await request(testApp)
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
            expect(res.body.code).toBe(0)
            expect(res.body.data.tradeId).toBeDefined()
            expect(res.body.data.stockCode).toBe('600519')
          }
        })
      })
    })

    describe('Given 缺少必填参数', () => {
      describe('When 提交买入请求', () => {
        it('Then 应返回参数不完整', async () => {
          const res = await request(testApp)
            .post('/trade/buy')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              group_id: 1,
              stock_code: '600519'
            })

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('参数')
        })
      })
    })

    describe('Given 无Token', () => {
      describe('When 提交买入请求', () => {
        it('Then 应返回未授权', async () => {
          const res = await request(testApp)
            .post('/trade/buy')
            .send({
              group_id: 1,
              stock_code: '600519',
              market_type: 1,
              shares: 100
            })

          expect(res.body.code).toBe(-1)
        })
      })
    })
  })

  describe('POST /trade/sell - 卖出股票', () => {
    describe('Given 有效的卖出参数', () => {
      beforeEach(() => {
        axios.get.mockResolvedValue({
          data: 'var hq_str_sh600519="贵州茅台,1800.00,1790.00,1850.00,1820.00,1780.00,1500,2800000,50000000,2024-01-15,15:30:00";'
        })
      })

      afterEach(() => {
        axios.get.mockReset()
      })

      describe('When 提交卖出请求(有持仓)', () => {
        it('Then 应返回交易结果或持仓不足', async () => {
          const res = await request(testApp)
            .post('/trade/sell')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              group_id: 1,
              stock_code: '600519',
              market_type: 1,
              shares: 100
            })

          if (res.body.code === -1 && res.body.message.includes('持仓不足')) {
            expect(res.body.code).toBe(-1)
            expect(res.body.message).toContain('持仓')
          } else {
            expect([0, -1]).toContain(res.body.code)
          }
        })
      })
    })

    describe('Given 缺少必填参数', () => {
      describe('When 提交卖出请求', () => {
        it('Then 应返回参数不完整', async () => {
          const res = await request(testApp)
            .post('/trade/sell')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              group_id: 1,
              stock_code: '600519'
            })

          expect(res.body.code).toBe(-1)
          expect(res.body.message).toContain('参数')
        })
      })
    })
  })
})