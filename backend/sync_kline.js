const mysql = require('mysql2/promise');
const { spawn } = require('child_process');

const BASE_DIR = '/mnt/c/CAISHENG/Code/virtual-stock/backend';
const DELAY_MS = 1500;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runPythonFetch(args) {
  return new Promise((resolve, reject) => {
    const jsonArgs = JSON.stringify(args);
    const pythonCode = `
import sys
import json
import os
sys.path.insert(0, '${BASE_DIR}')
from fetch_kline_yfinance import fetch_kline
args = json.loads('''${jsonArgs}''')
result = fetch_kline(args['symbol'], args['market_type'], '', period=args.get('period', '1y'))
print(json.dumps(result))
`;
    const proc = spawn('python3', ['-c', pythonCode]);
    let output = '', errorOutput = '';
    proc.stdout.on('data', data => { output += data.toString(); });
    proc.stderr.on('data', data => { errorOutput += data.toString(); });
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Python error: ${errorOutput}`));
      } else {
        try {
          resolve(JSON.parse(output.trim()));
        } catch (e) {
          reject(new Error(`Parse error: ${output}`));
        }
      }
    });
  });
}

async function main() {
  const conn = await mysql.createConnection({
    user: 'root',
    database: 'virtual_stock'
  });

  console.log('=== 批量同步美股和港股日K线数据 ===\n');

  // 获取股票列表
  const [usStocks] = await conn.query(
    'SELECT stock_code, stock_name FROM stock_pools WHERE market_type = 3 ORDER BY id'
  );
  const [hkStocks] = await conn.query(
    'SELECT stock_code, stock_name FROM stock_pools WHERE market_type = 2 ORDER BY id'
  );

  console.log(`美股数量: ${usStocks.length}`);
  console.log(`港股数量: ${hkStocks.length}\n`);

  let totalInserted = 0;
  let totalFailed = 0;
  let skipCount = 0;

  console.log('--- 同步美股日K线 ---');
  for (const stock of usStocks) {
    process.stdout.write(`获取 ${stock.stock_code} ${stock.stock_name}... `);
    try {
      const klineData = await runPythonFetch({
        symbol: stock.stock_code,
        market_type: 3,
        period: '1y'
      });

      if (Array.isArray(klineData) && klineData.length > 0) {
        for (const item of klineData) {
          await conn.query(`
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
          ]);
        }
        console.log(`[成功] ${klineData.length} 条`);
        totalInserted += klineData.length;
      } else if (Array.isArray(klineData) && klineData.length === 0) {
        console.log(`[跳过] 无数据`);
        skipCount++;
      } else {
        console.log(`[失败] ${klineData.error || '未知错误'}`);
        totalFailed++;
      }
    } catch (err) {
      console.log(`[失败] ${err.message}`);
      totalFailed++;
    }

    await delay(DELAY_MS);
  }

  console.log('\n--- 同步港股日K线 ---');
  for (const stock of hkStocks) {
    process.stdout.write(`获取 ${stock.stock_code} ${stock.stock_name}... `);
    try {
      const klineData = await runPythonFetch({
        symbol: stock.stock_code,
        market_type: 2,
        period: '1y'
      });

      if (Array.isArray(klineData) && klineData.length > 0) {
        for (const item of klineData) {
          await conn.query(`
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
          ]);
        }
        console.log(`[成功] ${klineData.length} 条`);
        totalInserted += klineData.length;
      } else if (Array.isArray(klineData) && klineData.length === 0) {
        console.log(`[跳过] 无数据`);
        skipCount++;
      } else {
        console.log(`[失败] ${klineData.error || '未知错误'}`);
        totalFailed++;
      }
    } catch (err) {
      console.log(`[失败] ${err.message}`);
      totalFailed++;
    }

    await delay(DELAY_MS);
  }

  console.log(`\n=== 完成 ===`);
  console.log(`总记录数: ${totalInserted}`);
  console.log(`跳过(无数据): ${skipCount}`);
  console.log(`失败数: ${totalFailed}`);

  // 统计
  const [usCount] = await conn.query('SELECT COUNT(*) as cnt FROM stock_prices WHERE market_type = 3');
  const [hkCount] = await conn.query('SELECT COUNT(*) as cnt FROM stock_prices WHERE market_type = 2');
  console.log(`\n数据库美股日K: ${usCount[0].cnt} 条`);
  console.log(`数据库港股日K: ${hkCount[0].cnt} 条`);

  await conn.end();
}

main().catch(console.error);