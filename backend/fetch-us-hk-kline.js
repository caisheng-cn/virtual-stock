const { spawn } = require('child_process')
const mysql = require('mysql2/promise')

const PYTHON_PATH = 'python3'
const SCRIPT_PATH = './fetch-kline-yfinance.py'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runPython(script, args) {
  return new Promise((resolve, reject) => {
    const jsonArgs = JSON.stringify(args)
    const proc = spawn(PYTHON_PATH, ['-c', `
import sys
import json
import os
os.chdir('${__dirname.replace(/\\/g, '/')}')
sys.path.insert(0, '.')
from fetch_kline_yfinance import fetch_kline
args = json.loads('''${jsonArgs}''')
result = fetch_kline(args['symbol'], args['market_type'], args.get('stock_name', ''))
print(json.dumps(result))
`], {
      env: { ...process.env, HOME: '/home/cai' },
      cwd: __dirname
    })
    let output = ''
    let errorOutput = ''
    proc.stdout.on('data', data => { output += data.toString() })
    proc.stderr.on('data', data => { errorOutput += data.toString() })
    proc.on('close', code => {
      if (code !== 0) {
        console.error('Python error:', errorOutput)
        reject(new Error(`Python exited with code ${code}: ${errorOutput}`))
      } else {
        try {
          resolve(JSON.parse(output.trim()))
        } catch (e) {
          reject(new Error(`JSON parse error: ${output}`))
        }
      }
    })
  })
}

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'virtual_stock'
  })

  console.log('=== 使用 yfinance 批量下载美股和港股K线数据 ===\n')

  const [usStocks] = await connection.query(
    'SELECT stock_code, stock_name FROM stock_pools WHERE market_type = 3 ORDER BY id'
  )
  const [hkStocks] = await connection.query(
    'SELECT stock_code, stock_name FROM stock_pools WHERE market_type = 2 ORDER BY id'
  )

  console.log(`美股数量: ${usStocks.length}`)
  console.log(`港股数量: ${hkStocks.length}\n`)

  let totalInserted = 0
  let totalFailed = 0
  let skipCount = 0

  const delayMs = 1500

  console.log('--- 下载美股K线 ---')
  for (const stock of usStocks) {
    console.log(`获取美股 ${stock.stock_code} ${stock.stock_name}...`)
    try {
      const klineData = await runPython({
        symbol: stock.stock_code,
        market_type: 3,
        stock_name: stock.stock_name
      })
      
      if (Array.isArray(klineData) && klineData.length > 0) {
        for (const item of klineData) {
          await connection.query(`
            INSERT INTO stock_prices 
            (stock_code, stock_name, market_type, trade_date, open_price, high_price, low_price, close_price, volume)
            VALUES (?, ?, 3, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            open_price = VALUES(open_price),
            high_price = VALUES(high_price),
            low_price = VALUES(low_price),
            close_price = VALUES(close_price),
            volume = VALUES(volume)
          `, [
            stock.stock_code,
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
      } else if (Array.isArray(klineData) && klineData.length === 0) {
        console.log(`  [跳过] 无数据`)
        skipCount++
      } else {
        console.log(`  [失败] ${klineData.error || '未知错误'}`)
        totalFailed++
      }
    } catch (err) {
      console.log(`  [失败] ${err.message}`)
      totalFailed++
    }
    
    await delay(delayMs)
  }

  console.log('\n--- 下载港股K线 ---')
  for (const stock of hkStocks) {
    console.log(`获取港股 ${stock.stock_code} ${stock.stock_name}...`)
    try {
      const klineData = await runPython({
        symbol: stock.stock_code,
        market_type: 2,
        stock_name: stock.stock_name
      })
      
      if (Array.isArray(klineData) && klineData.length > 0) {
        for (const item of klineData) {
          await connection.query(`
            INSERT INTO stock_prices 
            (stock_code, stock_name, market_type, trade_date, open_price, high_price, low_price, close_price, volume)
            VALUES (?, ?, 2, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            open_price = VALUES(open_price),
            high_price = VALUES(high_price),
            low_price = VALUES(low_price),
            close_price = VALUES(close_price),
            volume = VALUES(volume)
          `, [
            stock.stock_code,
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
      } else if (Array.isArray(klineData) && klineData.length === 0) {
        console.log(`  [跳过] 无数据`)
        skipCount++
      } else {
        console.log(`  [失败] ${klineData.error || '未知错误'}`)
        totalFailed++
      }
    } catch (err) {
      console.log(`  [失败] ${err.message}`)
      totalFailed++
    }
    
    await delay(delayMs)
  }

  console.log(`\n=== 完成 ===`)
  console.log(`总记录数: ${totalInserted}`)
  console.log(`跳过(无数据): ${skipCount}`)
  console.log(`失败数: ${totalFailed}`)

  const [usCount] = await connection.query('SELECT COUNT(*) as cnt FROM stock_prices WHERE market_type = 3')
  const [hkCount] = await connection.query('SELECT COUNT(*) as cnt FROM stock_prices WHERE market_type = 2')
  console.log(`数据库美股历史行情: ${usCount[0].cnt} 条`)
  console.log(`数据库港股历史行情: ${hkCount[0].cnt} 条`)

  await connection.end()
}

main().catch(console.error)