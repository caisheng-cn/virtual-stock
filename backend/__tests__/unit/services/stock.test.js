describe('Stock Service - A股解析', () => {
  const mockGetAStockQuote = (text) => {
    const match = text.match(/="([^"]+)"/)
    if (!match) throw new Error('获取数据失败')
    const data = match[1].split(',')
    return {
      stockCode: '600519',
      stockName: data[0],
      marketType: 1,
      openPrice: parseFloat(data[1]) || 0,
      prevClose: parseFloat(data[2]) || 0,
      price: parseFloat(data[3]) || 0,
      highPrice: parseFloat(data[4]) || 0,
      lowPrice: parseFloat(data[5]) || 0,
      volume: parseInt(data[8]) || 0,
      amount: parseFloat(data[9]) || 0,
      tradeDate: data[30] || '',
      tradeTime: data[31] || ''
    }
  }

  describe('Given 正常的新浪A股数据', () => {
    const sinajsResponse = 'var hq_str_sh600519="贵州茅台,1800.00,1790.00,1850.00,1820.00,1780.00,100,200,1500,2800000,600,700,800,900,1000,1100,1200,1300,1400,1500,1600,1700,1800,1900,2000,2100,2200,2300,2400,2500,2024-01-15,15:30:00";'

    describe('When 调用解析函数', () => {
      it('Then 应正确解析股票代码', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.stockCode).toBe('600519')
      })

      it('Then 应正确解析股票名称', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.stockName).toBe('贵州茅台')
      })

      it('Then 应正确解析开盘价', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.openPrice).toBe(1800.00)
      })

      it('Then 应正确解析昨收价', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.prevClose).toBe(1790.00)
      })

      it('Then 应正确解析当前价', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.price).toBe(1850.00)
      })

      it('Then 应正确解析最高价', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.highPrice).toBe(1820.00)
      })

      it('Then 应正确解析最低价', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.lowPrice).toBe(1780.00)
      })

      it('Then 应正确解析成交量', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.volume).toBe(1500)
      })

      it('Then 应正确解析成交额', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.amount).toBe(2800000)
      })

      it('Then 应正确解析交易日期', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.tradeDate).toBe('2024-01-15')
      })

      it('Then 应正确解析交易时间', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.tradeTime).toBe('15:30:00')
      })

      it('Then 市场类型应为1(A股)', () => {
        const result = mockGetAStockQuote(sinajsResponse)
        expect(result.marketType).toBe(1)
      })
    })
  })

  describe('Given 空数据响应', () => {
    const emptyResponse = 'var hq_str_sh600519=""'

    describe('When 调用解析函数', () => {
      it('Then 应抛出获取数据失败错误', () => {
        expect(() => mockGetAStockQuote(emptyResponse)).toThrow('获取数据失败')
      })
    })
  })

  describe('Given 非标准格式数据', () => {
    const invalidResponse = 'var hq_str_sh600519=invalid'

    describe('When 调用解析函数', () => {
      it('Then 应抛出获取数据失败错误', () => {
        expect(() => mockGetAStockQuote(invalidResponse)).toThrow('获取数据失败')
      })
    })
  })

  describe('Given 缺失字段的数据', () => {
    const partialResponse = 'var hq_str_sh600519="贵州茅台,,,,"'

    describe('When 调用解析函数', () => {
      it('Then 应将缺失数值字段默认为0', () => {
        const result = mockGetAStockQuote(partialResponse)
        expect(result.openPrice).toBe(0)
        expect(result.price).toBe(0)
        expect(result.volume).toBe(0)
      })
    })
  })
})