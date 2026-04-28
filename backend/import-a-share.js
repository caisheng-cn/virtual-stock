/**
 * File: import-a-share.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Batch imports A-share stock K-line data from Sina Finance API
 *              into the stock_prices table. Processes stocks that are missing
 *              K-line data with configurable concurrency.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const mysql = require('mysql2/promise');
const axios = require('axios');

const SOCKET_PATH = '/var/run/mysqld/mysqld.sock';
const SINA_REFERER = 'http://finance.sina.com.cn';
const CONCURRENCY = 50;

const klineCache = new Map();

/**
 * Fetches K-line data for a batch of stock symbols from Sina Finance API.
 * @param {Array<{stock_code: string, stock_name: string}>} symbols - Stock symbols to fetch
 * @returns {Promise<Array<{stock_code: string, stock_name: string, data: Array|null, error?: string}>>}
 */
async function fetchKLineBatch(symbols) {
  const results = [];
  for (const { stock_code, stock_name } of symbols) {
    const isSh = stock_code.startsWith('6');
    const prefix = isSh ? 'sh' : 'sz';
    const url = `http://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${prefix}${stock_code}&scale=240&ma=no&datalen=365`;
    try {
      const res = await axios.get(url, { headers: { Referer: SINA_REFERER }, timeout: 15000 });
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        results.push({ stock_code, stock_name, data: res.data });
      } else {
        results.push({ stock_code, stock_name, data: [] });
      }
    } catch (err) {
      results.push({ stock_code, stock_name, data: null, error: err.message });
    }
  }
  return results;
}

/**
 * Main entry point. Finds stocks missing K-line data and downloads them
 * concurrently using multiple workers.
 * @returns {Promise<void>}
 */
async function main() {
  console.log('=== 批量导入A股K线数据 ===\n');

  const conn = await mysql.createConnection({
    socketPath: SOCKET_PATH, user: 'root', password: '',
    database: 'virtual_stock'
  });

  const [missing] = await conn.query(
    `SELECT sp.id, sp.stock_code, sp.stock_name
     FROM stock_pools sp
     LEFT JOIN (SELECT DISTINCT stock_code FROM stock_prices WHERE market_type = 1) sk
       ON sk.stock_code = sp.stock_code
     WHERE sp.market_type = 1 AND sk.stock_code IS NULL
     ORDER BY sp.id`
  );

  console.log(`待导入K线的股票: ${missing.length}\n`);
  if (missing.length === 0) {
    console.log('全部已完成！');
    await conn.end();
    return;
  }

  let totalInserted = 0;
  let totalFailed = 0;
  let done = 0;

  /**
   * Concurrent worker that fetches K-line data for a single stock and inserts it.
   * @returns {Promise<void>}
   */
  async function worker() {
    while (true) {
      const i = done++;
      if (i >= missing.length) break;
      const stock = missing[i];

      try {
        const isSh = stock.stock_code.startsWith('6');
        const prefix = isSh ? 'sh' : 'sz';
        const url = `http://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData?symbol=${prefix}${stock.stock_code}&scale=240&ma=no&datalen=365`;
        const res = await axios.get(url, { headers: { Referer: SINA_REFERER }, timeout: 15000 });

        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          const values = res.data.map(d => [
            stock.stock_code, stock.stock_name, 1, d.day,
            parseFloat(d.open), parseFloat(d.high), parseFloat(d.low),
            parseFloat(d.close), parseInt(d.volume)
          ]);

          // 批量插入
          const placeholders = values.map(() => '(?,?,?,?,?,?,?,?,?)').join(',');
          const flat = values.flat();
          await conn.execute(
            `INSERT INTO stock_prices
             (stock_code, stock_name, market_type, trade_date, open_price, high_price, low_price, close_price, volume)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE
             open_price = VALUES(open_price), high_price = VALUES(high_price),
             low_price = VALUES(low_price), close_price = VALUES(close_price),
             volume = VALUES(volume)`,
            flat
          );

          totalInserted += values.length;
          console.log(`[${i+1}/${missing.length}] ${stock.stock_code} ${stock.stock_name} - ${values.length}条`);
        } else {
          console.log(`[${i+1}/${missing.length}] ${stock.stock_code} ${stock.stock_name} - 无数据`);
        }
      } catch (err) {
        totalFailed++;
        console.log(`[${i+1}/${missing.length}] ${stock.stock_code} ${stock.stock_name} - ${err.message}`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log(`\n=== 完成 ===`);
  console.log(`本次新增K线记录数: ${totalInserted}`);
  console.log(`失败数: ${totalFailed}`);

  const [priceCount] = await conn.query(
    'SELECT COUNT(*) as cnt, COUNT(DISTINCT stock_code) as stocks FROM stock_prices WHERE market_type = 1'
  );
  console.log(`数据库 stock_prices (A股): ${priceCount[0].cnt} 条, ${priceCount[0].stocks} 只股票`);

  await conn.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
