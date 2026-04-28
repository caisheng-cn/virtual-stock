const axios = require('axios')
const { spawn } = require('child_process')
const path = require('path')
const { StockPool, StockPrice, StockPricesCache, sequelize } = require('../models')

const SINA_REFERER = 'http://finance.sina.com.cn'

const BASE_DIR = path.resolve(__dirname, '../../')

function runPythonFetch(action, symbol, marketType) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process')
    const jsonArgs = JSON.stringify({ action, symbol, market_type: marketType })
    const pythonCode = action === 'kline' ? `
import sys
import json
import os
sys.path.insert(0, '${BASE_DIR.replace(/\\/g, '/')}')
from fetch_kline_yfinance import fetch_kline
args = json.loads('''${jsonArgs}''')
result = fetch_kline(args['symbol'], args['market_type'], '')
print(json.dumps(result))
` : `
import sys
import json
import os
sys.path.insert(0, '${BASE_DIR.replace(/\\/g, '/')}')
from fetch_kline_yfinance import fetch_quote
args = json.loads('''${jsonArgs}''')
result = fetch_quote(args['symbol'], args['market_type'])
print(json.dumps(result))
`
    const proc = spawn('python3', ['-c', pythonCode])

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

async function getAStockQuote(code) {
  const url = `http://hq.sinajs.cn/list=sh${code}`
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

async function getHKStockQuote(code) {
  try {
    const data = await runPythonFetch('quote', code, 2)
    if (data.error) throw new Error(data.error)
    return {
      stockCode: code,
      stockName: data.stockName || code,
      marketType: 2,
      openPrice: data.openPrice || 0,
      prevClose: data.prevClose || 0,
      price: data.price || 0,
      highPrice: data.highPrice || 0,
      lowPrice: data.lowPrice || 0,
      volume: data.volume || 0,
      tradeDate: new Date().toISOString().split('T')[0],
      tradeTime: ''
    }
  } catch (err) {
    throw new Error('港股行情获取失败: ' + err.message)
  }
}

async function getUSStockQuote(code) {
  try {
    const data = await runPythonFetch('quote', code, 3)
    if (data.error) throw new Error(data.error)
    return {
      stockCode: code,
      stockName: data.stockName || code,
      marketType: 3,
      prevClose: data.prevClose || 0,
      price: data.price || 0,
      highPrice: data.highPrice || 0,
      lowPrice: data.lowPrice || 0,
      openPrice: data.openPrice || 0,
      volume: data.volume || 0,
      tradeDate: new Date().toISOString().split('T')[0]
    }
  } catch (err) {
    throw new Error('美股行情获取失败: ' + err.message)
  }
}

async function fetchQuoteFromAPI(code, marketType) {
  if (marketType == 1) return getAStockQuote(code)
  if (marketType == 2) return getHKStockQuote(code)
  if (marketType == 3) return getUSStockQuote(code)
  throw new Error('不支持的市场类型')
}

async function getQuote(code, marketType) {
  const today = new Date().toISOString().split('T')[0]
  
  try {
    const cached = await StockPricesCache.findOne({
      where: { stock_code: code, market_type: marketType }
    })
    
    if (cached && cached.trade_date === today) {
      return {
        stockCode: cached.stock_code,
        stockName: cached.stock_name || code,
        marketType: cached.market_type,
        prevClose: parseFloat(cached.prev_close) || 0,
        price: parseFloat(cached.close_price) || 0,
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
    try {
      const cached = await StockPricesCache.findOne({
        where: { stock_code: code, market_type: marketType }
      })
      if (cached) {
        return {
          stockCode: cached.stock_code,
          stockName: cached.stock_name || code,
          marketType: cached.market_type,
          prevClose: parseFloat(cached.prev_close) || 0,
          price: parseFloat(cached.close_price) || 0,
          tradeDate: cached.trade_date,
          fromCache: true,
          fallback: true
        }
      }
    } catch (cacheErr) {}
    throw err
  }
}

async function getHistory(code, marketType, startDate, endDate) {
  if (marketType == 1) {
    const url = `http://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=sh${code}&scale=240&ma=no&datalen=365`
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

  if (marketType == 2 || marketType == 3) {
    try {
      const klineData = await runPythonFetch('kline', code, marketType)
      if (klineData.error) {
        console.error('K线获取失败:', klineData.error)
        return []
      }
      let data = klineData || []
      
      if (startDate || endDate) {
        data = data.filter(d => {
          if (startDate && d.trade_date < startDate) return false
          if (endDate && d.trade_date > endDate) return false
          return true
        })
      }
      
      return data.map(d => ({
        tradeDate: d.trade_date,
        openPrice: d.open_price || 0,
        highPrice: d.high_price || 0,
        lowPrice: d.low_price || 0,
        closePrice: d.close_price || 0,
        volume: d.volume || 0
      }))
    } catch (err) {
      console.error('K线获取失败:', err.message)
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
  getBatchQuotes
}