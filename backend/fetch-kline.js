/**
 * File: fetch-kline.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Fetches A-share stock K-line data from the Sina Finance API
 *              and inserts it into the local stock_prices database table.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const axios = require('axios')
const mysql = require('mysql2/promise')

const SINA_REFERER = 'http://finance.sina.com.cn'

/**
 * Fetches daily K-line data for an A-share stock from Sina Finance API.
 * @param {string} code - Stock code (e.g., "600519")
 * @param {boolean} isShCode - Whether the stock trades on Shanghai exchange
 * @returns {Promise<Array<{stock_code: string, trade_date: string, open_price: number, high_price: number, low_price: number, close_price: number, volume: number}>>}
 */
async function fetchAKLineData(code, isShCode) {
  const prefix = isShCode ? 'sh' : 'sz'
  const url = `http://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${prefix}${code}&scale=240&ma=no&datalen=365`
  const response = await axios.get(url, { headers: { Referer: SINA_REFERER } })
  if (!response.data || !Array.isArray(response.data)) {
    return []
  }
  return response.data.map(d => ({
    stock_code: code,
    trade_date: d.day,
    open_price: parseFloat(d.open),
    high_price: parseFloat(d.high),
    low_price: parseFloat(d.low),
    close_price: parseFloat(d.close),
    volume: parseInt(d.volume)
  }))
}

/**
 * Main entry point. Fetches A-share stock list from stock_pools, downloads
 * K-line data for each, and inserts into stock_prices table.
 * @returns {Promise<void>}
 */
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'virtual_stock'
  })

  console.log('=== 批量下载A股K线数据 ===\n')

  const [stocks] = await connection.query(
    'SELECT stock_code, stock_name FROM stock_pools WHERE market_type = 1 ORDER BY id LIMIT 10'
  )

  let totalInserted = 0
  let totalSkipped = 0

  for (const stock of stocks) {
    const isShCode = stock.stock_code.startsWith('6')
    console.log(`获取 ${stock.stock_code} ${stock.stock_name}...`)
    
    try {
      const klineData = await fetchAKLineData(stock.stock_code, isShCode)
      
      if (klineData.length === 0) {
        console.log(`  [跳过] 无数据`)
        totalSkipped++
        continue
      }

      for (const item of klineData) {
        await connection.query(`
          INSERT INTO stock_prices 
          (stock_code, stock_name, market_type, trade_date, open_price, high_price, low_price, close_price, volume)
          VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          open_price = VALUES(open_price),
          high_price = VALUES(high_price),
          low_price = VALUES(low_price),
          close_price = VALUES(close_price),
          volume = VALUES(volume)
        `, [
          item.stock_code,
          stock.stock_name,
          item.trade_date,
          item.open_price,
          item.high_price,
          item.low_price,
          item.close_price,
          item.volume
        ])
      }

      console.log(`  [成功] ${klineData.length} 条数据`)
      totalInserted += klineData.length

      await new Promise(r => setTimeout(r, 500))
    } catch (err) {
      console.log(`  [失败] ${err.message}`)
      totalSkipped++
    }
  }

  console.log(`\n=== 完成 ===`)
  console.log(`总记录数: ${totalInserted}`)
  console.log(`失败数: ${totalSkipped}`)

  const [count] = await connection.query('SELECT COUNT(*) as cnt FROM stock_prices WHERE market_type = 1')
  console.log(`数据库A股票历史行情: ${count[0].cnt} 条`)

  await connection.end()
}

main().catch(console.error)