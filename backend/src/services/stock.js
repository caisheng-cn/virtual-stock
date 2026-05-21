const axios = require('axios')
const { spawn } = require('child_process')
const path = require('path')
const { StockPool, StockPrice, StockPricesCache, sequelize } = require('../models')

const SINA_REFERER = 'http://finance.sina.com.cn'
const BASE_DIR = path.resolve(__dirname, '../../')

function getSinaPrefix(code) {
  return code.startsWith('6') ? 'sh' : 'sz'
}

function runPythonScript(scriptPath, args, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [scriptPath, JSON.stringify(args)])
    let output = ''
    let errorOutput = ''
    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error(`Python script timed out after ${timeout / 1000}s`))
    }, timeout)
    proc.stdout.on('data', data => { output += data.toString() })
    proc.stderr.on('data', data => { errorOutput += data.toString() })
    proc.on('close', code => {
      clearTimeout(timer)
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

function runPythonAKlineSingle(symbol, startDate, endDate) {
  return runPythonScript(PYTHON_SCRIPT, {
    action: 'a_share',
    symbol,
    start_date: startDate || new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0],
    end_date: endDate || new Date().toISOString().split('T')[0]
  })
}

async function getQuote(code, marketType) {
  try {
    const cached = await StockPricesCache.findOne({
      where: { stock_code: code, market_type: marketType },
      order: [['trade_date', 'DESC']],
      raw: true
    })
    if (cached && parseFloat(cached.close_price) > 0) {
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
    const pool = await StockPool.findOne({
      where: { stock_code: code, market_type: marketType },
      raw: true
    })

    const latest = await StockPrice.findOne({
      where: { stock_code: code, market_type: marketType },
      order: [['trade_date', 'DESC']],
      raw: true
    })

    if (latest && parseFloat(latest.close_price) > 0) {
      return {
        stockCode: code,
        stockName: (pool && pool.stock_name) || latest.stock_name || code,
        marketType,
        prevClose: parseFloat(latest.prev_close) || 0,
        price: parseFloat(latest.close_price) || 0,
        openPrice: parseFloat(latest.open_price) || 0,
        highPrice: parseFloat(latest.high_price) || 0,
        lowPrice: parseFloat(latest.low_price) || 0,
        tradeDate: latest.trade_date,
        fromCache: true
      }
    }

    if (pool && pool.stock_name) {
      return {
        stockCode: code,
        stockName: pool.stock_name,
        marketType,
        price: 0,
        tradeDate: '',
        fromCache: true
      }
    }
  } catch (err) {}

  throw new Error(`价格数据不可用 ${code}`)
}

async function getHistory(code, marketType, startDate, endDate) {
  if (marketType == 1) {
    try {
      const data = await runPythonAKlineSingle(code, startDate, endDate)
      if (data.error) throw new Error(data.error)
      if (!Array.isArray(data)) throw new Error('返回格式异常')
      return data.map(d => ({
        tradeDate: d.trade_date,
        openPrice: parseFloat(d.open_price) || 0,
        highPrice: parseFloat(d.high_price) || 0,
        lowPrice: parseFloat(d.low_price) || 0,
        closePrice: parseFloat(d.close_price) || 0,
        volume: parseInt(d.volume) || 0
      }))
    } catch (err) {
      console.log(`[AKShare] A股K线失败 ${code}, 降级到Sina:`, err.message)
      try {
        const url = `http://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${getSinaPrefix(code)}${code}&scale=240&ma=no&datalen=365`
        const response = await axios.get(url, { headers: { Referer: SINA_REFERER }, timeout: 10000 })
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
      } catch (sinaErr) {
        console.error(`[Sina] A股K线降级也失败 ${code}:`, sinaErr.message)
        return []
      }
    }
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
  runPythonBatchUSAKShare,
  runPythonScript
}
