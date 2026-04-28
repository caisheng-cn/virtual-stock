const jwt = require('jsonwebtoken')
const JWT_SECRET = process.env.JWT_SECRET || 'virtual-stock-secret-key'

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET)
}

describe('Auth Utils - JWT验证', () => {
  describe('Given 有效的用户信息', () => {
    const userPayload = { userId: 1, username: 'testuser' }

    describe('When 生成Token', () => {
      it('Then 应返回有效Token字符串', () => {
        const token = generateToken(userPayload)
        expect(typeof token).toBe('string')
        expect(token.length).toBeGreaterThan(0)
      })

      it('Then Token应包含三个部分(使用点分隔)', () => {
        const token = generateToken(userPayload)
        expect(token.split('.').length).toBe(3)
      })
    })
  })

  describe('Given 生成的Token', () => {
    const userPayload = { userId: 1, username: 'testuser' }
    const token = generateToken(userPayload)

    describe('When 验证Token', () => {
      it('Then 应正确解析出userId', () => {
        const decoded = verifyToken(token)
        expect(decoded.userId).toBe(1)
      })

      it('Then 应正确解析出username', () => {
        const decoded = verifyToken(token)
        expect(decoded.username).toBe('testuser')
      })

      it('Then 应包含iat字段(签发时间)', () => {
        const decoded = verifyToken(token)
        expect(decoded.iat).toBeDefined()
        expect(typeof decoded.iat).toBe('number')
      })

      it('Then 应包含exp字段(过期时间)', () => {
        const decoded = verifyToken(token)
        expect(decoded.exp).toBeDefined()
        expect(typeof decoded.exp).toBe('number')
        expect(decoded.exp).toBeGreaterThan(decoded.iat)
      })
    })
  })

  describe('Given 无效的Token', () => {
    const invalidToken = 'invalid.token.here'

    describe('When 验证Token', () => {
      it('Then 应抛出JsonWebTokenError', () => {
        expect(() => verifyToken(invalidToken)).toThrow()
      })
    })
  })

  describe('Given 过期的Token', () => {
    const expiredToken = jwt.sign(
      { userId: 1, username: 'testuser' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    )

    describe('When 验证Token', () => {
      it('Then 应抛出TokenExpiredError', () => {
        expect(() => verifyToken(expiredToken)).toThrow('jwt expired')
      })
    })
  })

  describe('Given 使用错误密钥签名的Token', () => {
    const wrongSecretToken = jwt.sign({ userId: 1 }, 'wrong-secret')

    describe('When 验证Token', () => {
      it('Then 应抛出JsonWebTokenError', () => {
        expect(() => verifyToken(wrongSecretToken)).toThrow()
      })
    })
  })

  describe('Given 空Token', () => {
    const emptyToken = ''

    describe('When 验证Token', () => {
      it('Then 应抛出错误', () => {
        expect(() => verifyToken(emptyToken)).toThrow()
      })
    })
  })

  describe('Given Bearer Token格式', () => {
    const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
    const token = authHeader.substring(7)

    describe('When 提取Token', () => {
      it('Then 应正确提取Token部分', () => {
        expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test')
      })
    })
  })

  describe('Given 不带Bearer前缀的Header', () => {
    const invalidHeader = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'

    describe('When 验证Header格式', () => {
      it('Then 应识别为无效格式', () => {
        const isValid = invalidHeader.startsWith('Bearer ')
        expect(isValid).toBe(false)
      })
    })
  })
})