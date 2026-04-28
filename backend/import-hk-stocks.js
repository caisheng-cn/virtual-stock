/**
 * File: import-hk-stocks.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Imports Hong Kong stock list and K-line data. Parses HKEX stock
 *              list via Python script, imports into stock_pools, then downloads
 *              missing K-line data using yfinance with concurrent workers.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const mysql = require('mysql2/promise');
const { spawn } = require('child_process');
const path = require('path');

const SOCKET_PATH = '/var/run/mysqld/mysqld.sock';
const BASE_DIR = __dirname;
const CONCURRENCY = 8;

/**
 * Runs a Python yfinance script to fetch K-line data for a HK stock symbol.
 * @param {string} symbol - Hong Kong stock code (e.g., "00700")
 * @returns {Promise<Array>} Parsed K-line data array
 */
function runPythonFetch(symbol) {
  return new Promise((resolve, reject) => {
    const args = JSON.stringify({ symbol, market_type: 2, period: '1y' });
    const code = `
import sys, json, os
sys.path.insert(0, '${BASE_DIR}')
from fetch_kline_yfinance import fetch_kline
args = json.loads('''${args}''')
result = fetch_kline(args['symbol'], args['market_type'], '', period='1y')
print(json.dumps(result))
`;
    const proc = spawn('python3', ['-c', code]);
    let out = '', err = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => err += d.toString());
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(err || 'process failed'));
      try { resolve(JSON.parse(out.trim())); }
      catch (e) { reject(new Error(`Parse error: ${out}`)); }
    });
  });
}

/**
 * Main entry point. Parses HK stock list, imports to stock_pools, and downloads
 * K-line data for stocks missing price data.
 * @returns {Promise<void>}
 */
async function main() {
  console.log('=== 港股数据导入 ===\n');

  const conn = await mysql.createConnection({
    socketPath: SOCKET_PATH, user: 'root', password: '',
    database: 'virtual_stock'
  });

  // Step 1: Get stock list from xlsx
  console.log('Step 1: 解析HKEX股票列表...');
  const parser = spawn('python3', [path.join(BASE_DIR, 'parse_hk_xlsx.py')]);
  let out = '';
  parser.stdout.on('data', d => out += d.toString());
  await new Promise((resolve, reject) => {
    parser.on('close', code => code === 0 ? resolve() : reject(new Error('parser failed')));
  });
  const hkStocks = JSON.parse(out.trim());
  console.log(`港股数量: ${hkStocks.length}\n`);

  // Step 2: Import to stock_pools
  console.log('Step 2: 导入股票池...');
  let imported = 0;
  for (const s of hkStocks) {
    await conn.execute(
      'INSERT IGNORE INTO stock_pools (stock_code, stock_name, market_type, status) VALUES (?, ?, 2, 1)',
      [s.code, s.name]
    );
    imported++;
    if (imported % 500 === 0) console.log(`  ${imported}/${hkStocks.length}`);
  }
  console.log(`stock_pools: ${imported} 只\n`);

  // Step 3: Get stocks without K-line data
  const [missing] = await conn.query(
    `SELECT sp.id, sp.stock_code, sp.stock_name
     FROM stock_pools sp
     LEFT JOIN (SELECT DISTINCT stock_code FROM stock_prices WHERE market_type = 2) sk
       ON sk.stock_code = sp.stock_code
     WHERE sp.market_type = 2 AND sk.stock_code IS NULL
     ORDER BY sp.id`
  );
  console.log(`Step 3: 获取K线数据 (待处理: ${missing.length})...\n`);

  if (missing.length === 0) {
    console.log('全部已完成！');
    await conn.end();
    return;
  }

  let totalInserted = 0;
  let totalFailed = 0;
  let done = 0;

  /**
   * Concurrent worker that fetches K-line data for a single HK stock.
   * @returns {Promise<void>}
   */
  async function worker() {
    while (true) {
      const i = done++;
      if (i >= missing.length) break;
      const stock = missing[i];

      try {
        const klineData = await runPythonFetch(stock.stock_code);
        if (Array.isArray(klineData) && klineData.length > 0) {
          for (const item of klineData) {
            await conn.execute(
              `INSERT INTO stock_prices
               (stock_code, stock_name, market_type, trade_date, open_price, high_price, low_price, close_price, volume)
               VALUES (?, ?, 2, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
               open_price = VALUES(open_price), high_price = VALUES(high_price),
               low_price = VALUES(low_price), close_price = VALUES(close_price),
               volume = VALUES(volume)`,
              [stock.stock_code, stock.stock_name, item.trade_date,
               item.open_price, item.high_price, item.low_price, item.close_price, item.volume]
            );
          }
          totalInserted += klineData.length;
          console.log(`[${i+1}/${missing.length}] ${stock.stock_code} ${stock.stock_name} - ${klineData.length}条`);
        } else {
          console.log(`[${i+1}/${missing.length}] ${stock.stock_code} ${stock.stock_name} - 无数据`);
        }
      } catch (err) {
        totalFailed++;
        console.log(`[${i+1}/${missing.length}] ${stock.stock_code} ${stock.stock_name} - ${err.message.slice(0, 100)}`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n=== 完成 ===`);
  console.log(`本次新增K线: ${totalInserted} 条`);
  console.log(`失败: ${totalFailed}`);

  const [cnt] = await conn.query(
    'SELECT COUNT(*) as cnt, COUNT(DISTINCT stock_code) as stocks FROM stock_prices WHERE market_type = 2'
  );
  console.log(`数据库港股K线: ${cnt[0].cnt} 条, ${cnt[0].stocks} 只股票`);

  await conn.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
