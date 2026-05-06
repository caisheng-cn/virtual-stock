const axios = require('axios')
const { spawn } = require('child_process')
const path = require('path')
const { StockPool, StockPrice, StockPricesCache, sequelize } = require('../models')

const SINA_REFERER = 'http://finance.sina.com.cn'
const BASE_DIR = path.resolve(__dirname, '../../')

function getSinaPrefix(code) {
  return code.startsWith('6') ? 'sh' : 'sz'
}

function runPythonScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, JSON.stringify(args)])
    let output = ''
    let errorOutput = ''
    proc.stdout.on('data', data => { output += data.toString() })
    proc.stderr.on('data', data => { errorOutput += data.toString() })
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Python error: ${errorOutput}`))
      } else {
        try {
          resolve(JSON.parse(output.trim()))
        } catch (e) {
          reject(new Error(`Parse error: ${output}`))
        }
      }
    })
  })
}

const PYTHON_SCRIPT = path.join(BASE_DIR, 'fetch_kline.py')

function runPythonBatchHKAKShare(stocks) {
  return runPythonScript(PYTHON_SCRIPT, { action: 'hk_kline_batch_akshare', stocks })
}

function runPythonBatchUSAKShare(stocks) {
  return runPythonScript(PYTHON_SCRIPT, { action: 'us_kline_batch_akshare', stocks })
}

function runPythonABatch(stocks) {
  return runPythonScript(PYTHON_SCRIPT, { action: 'a_share_batch', stocks })
}

async function getAStockQuote(code) {
  const url = `http://hq.sinajs.cn/list=${getSinaPrefix(code)}${code}`
  const response = await axios.get(url, { headers: { Referer: SINA_REFERER } })
  const text = response.data
  const match = text.match(/="([^"]+)"/)
  if (!match) throw new Error('获取数据失败')

  const data = match[1].split(',')
  return {
    stockCode: code,
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

async function fetchQuoteFromAPI(code, marketType) {
  if (marketType == 1) return getAStockQuote(code)
  // HK/US stocks: fallback to DB in getQuote
  throw new Error('API not available')
}

async function getQuote(code, marketType) {
  const today = new Date().toISOString().split('T')[0]
  
  try {
    const cached = await StockPricesCache.findOne({
      where: { stock_code: code, market_type: marketType }
    })
    
    if (cached && cached.trade_date === today) {
      let ohlc = { openPrice: 0, highPrice: 0, lowPrice: 0 }
      try {
        const todayRecord = await StockPrice.findOne({
          where: { stock_code: code, market_type: marketType, trade_date: today }
        })
        if (todayRecord) {
          ohlc = {
            openPrice: parseFloat(todayRecord.open_price) || 0,
            highPrice: parseFloat(todayRecord.high_price) || 0,
            lowPrice: parseFloat(todayRecord.low_price) || 0
          }
        }
      } catch (e) {}

      return {
        stockCode: cached.stock_code,
        stockName: cached.stock_name || code,
        marketType: cached.market_type,
        prevClose: parseFloat(cached.prev_close) || 0,
        price: parseFloat(cached.close_price) || 0,
        ...ohlc,
        tradeDate: cached.trade_date,
        fromCache: true
      }
    }
  } catch (err) {
    console.log('Cache read error:', err.message)
  }
  
  try {
    const quote = await fetchQuoteFromAPI(code, marketType)
    
    try {
      await StockPricesCache.upsert({
        stock_code: code,
        market_type: marketType,
        stock_name: quote.stockName,
        trade_date: today,
        close_price: quote.price,
        prev_close: quote.prevClose,
        change_percent: quote.prevClose > 0 ? ((quote.price - quote.prevClose) / quote.prevClose * 100) : 0
      })
      
      try {
        await StockPrice.create({
          stock_code: code,
          stock_name: quote.stockName,
          market_type: marketType,
          trade_date: quote.tradeDate || today,
          open_price: quote.openPrice,
          high_price: quote.highPrice,
          low_price: quote.lowPrice,
          close_price: quote.price,
          prev_close: quote.prevClose,
          volume: quote.volume || 0,
          amount: quote.amount || 0
        })
      } catch (err) {
        console.log('History save error:', err.message)
      }
    } catch (err) {
      console.log('Cache save error:', err.message)
    }
    
    return quote
  } catch (err) {
    // Fallback: try StockPricesCache
    try {
      const cached = await StockPricesCache.findOne({
        where: { stock_code: code, market_type: marketType }
      })
      if (cached) {
        let ohlc = { openPrice: 0, highPrice: 0, lowPrice: 0 }
        try {
          const dayRecord = await StockPrice.findOne({
            where: { stock_code: code, market_type: marketType, trade_date: cached.trade_date }
          })
          if (dayRecord) {
            ohlc = {
              openPrice: parseFloat(dayRecord.open_price) || 0,
              highPrice: parseFloat(dayRecord.high_price) || 0,
              lowPrice: parseFloat(dayRecord.low_price) || 0
            }
          }
        } catch (e) {}

        return {
          stockCode: cached.stock_code,
          stockName: cached.stock_name || code,
          marketType: cached.market_type,
          prevClose: parseFloat(cached.prev_close) || 0,
          price: parseFloat(cached.close_price) || 0,
          ...ohlc,
          tradeDate: cached.trade_date,
          fromCache: true,
          fallback: true
        }
      }
    } catch (cacheErr) {}
    // Last resort: get latest from stock_prices
    try {
      const latest = await StockPrice.findOne({
        where: { stock_code: code, market_type: marketType },
        order: [['trade_date', 'DESC']]
      })
      if (latest) {
        return {
          stockCode: code,
          stockName: latest.stock_name || code,
          marketType: marketType,
          prevClose: parseFloat(latest.prev_close) || 0,
          price: parseFloat(latest.close_price) || 0,
          openPrice: parseFloat(latest.open_price) || 0,
          highPrice: parseFloat(latest.high_price) || 0,
          lowPrice: parseFloat(latest.low_price) || 0,
          tradeDate: latest.trade_date,
          fromCache: true,
          fallback: true
        }
      }
    } catch (latestErr) {}
    throw err
  }
}

async function getHistory(code, marketType, startDate, endDate) {
  if (marketType == 1) {
    const url = `http://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${getSinaPrefix(code)}${code}&scale=240&ma=no&datalen=365`
    const response = await axios.get(url, { headers: { Referer: 'http://finance.sina.com.cn' } })
    let data = response.data
    
    if (startDate || endDate) {
      data = data.filter(d => {
        if (startDate && d.day < startDate) return false
        if (endDate && d.day > endDate) return false
        return true
      })
    }
    
    return data.map(d => ({
      tradeDate: d.day,
      openPrice: parseFloat(d.open),
      highPrice: parseFloat(d.high),
      lowPrice: parseFloat(d.low),
      closePrice: parseFloat(d.close),
      volume: parseInt(d.volume)
    }))
  }

  if (marketType == 2) {
    try {
      const defaultStart = startDate || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
      const defaultEnd = endDate || new Date().toISOString().split('T')[0]
      const data = await runPythonBatchHKAKShare([{ symbol: code, start_date: defaultStart, end_date: defaultEnd }])
      const records = data && data[0] && Array.isArray(data[0].data) ? data[0].data : []
      return records.map(d => ({
        tradeDate: d.trade_date,
        openPrice: d.open_price || 0,
        highPrice: d.high_price || 0,
        lowPrice: d.low_price || 0,
        closePrice: d.close_price || 0,
        volume: d.volume || 0
      }))
    } catch (err) {
      console.error('港股K线获取失败:', err.message)
      return []
    }
  }

  if (marketType == 3) {
    try {
      const defaultStart = startDate || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0]
      const defaultEnd = endDate || new Date().toISOString().split('T')[0]
      const data = await runPythonBatchUSAKShare([{ symbol: code, start_date: defaultStart, end_date: defaultEnd }])
      const records = data && data[0] && Array.isArray(data[0].data) ? data[0].data : []
      return records.map(d => ({
        tradeDate: d.trade_date,
        openPrice: d.open_price || 0,
        highPrice: d.high_price || 0,
        lowPrice: d.low_price || 0,
        closePrice: d.close_price || 0,
        volume: d.volume || 0
      }))
    } catch (err) {
      console.error('美股K线获取失败:', err.message)
      return []
    }
  }

  return []
}

async function getBatchQuotes(stocks) {
  const results = []
  for (const s of stocks) {
    try {
      const quote = await getQuote(s.stock_code, s.market_type)
      results.push(quote)
    } catch (err) {
      results.push({ stock_code: s.stock_code, error: err.message })
    }
  }
  return results
}

module.exports = {
  getQuote,
  getHistory,
  getBatchQuotes,
  runPythonABatch,
  runPythonBatchHKAKShare,
  runPythonBatchUSAKShare
}
