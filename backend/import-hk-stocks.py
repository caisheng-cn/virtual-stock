#
# File: import-hk-stocks.py
# Created: 2024-01-01
# Author: CAISHENG <caisheng.cn@gmail.com>
# Description: Fetches HK stock list from Sina via akshare, imports into stock_pools table,
#              then fetches daily K-line data for the past year and inserts into stock_prices.
# Version History:
#   1.0 - Initial version with full HK stock data import pipeline
#

import akshare as ak
import pymysql
import json
from datetime import datetime, timedelta, date
import time

SOCKET_PATH = '/var/run/mysqld/mysqld.sock'
DB_NAME = 'virtual_stock'
ONE_YEAR_AGO = (datetime.now() - timedelta(days=365)).date()

conn = pymysql.connect(
    unix_socket=SOCKET_PATH,
    user='root',
    password='',
    database=DB_NAME,
    charset='utf8mb4'
)
cursor = conn.cursor()

print('=== 港股数据导入 ===\n')

# Step 1: Get HK stock list from Sina
print('Step 1: 获取港股列表...')
spot_df = ak.stock_hk_spot()
stocks = spot_df[['代码', '中文名称']].values.tolist()
print(f'港股数量: {len(stocks)}\n')

# Step 2: Import stock list into stock_pools
print('Step 2: 导入股票池...')
imported = 0
for code, name in stocks:
    code_str = str(code).zfill(5)
    name_str = str(name).strip() if name else code_str
    cursor.execute(
        'INSERT IGNORE INTO stock_pools (stock_code, stock_name, market_type, status) VALUES (%s, %s, 2, 1)',
        (code_str, name_str)
    )
    imported += 1
    if imported % 500 == 0:
        print(f'  {imported}/{len(stocks)}')
        conn.commit()
conn.commit()
print(f'stock_pools: {imported}\n')

# Step 3: Get stocks without K-line data
cursor.execute('''
    SELECT sp.stock_code, sp.stock_name
    FROM stock_pools sp
    LEFT JOIN (SELECT DISTINCT stock_code FROM stock_prices WHERE market_type = 2) sk
      ON sk.stock_code = sp.stock_code
    WHERE sp.market_type = 2 AND sk.stock_code IS NULL
    ORDER BY sp.id
''')
missing = cursor.fetchall()
print(f'Step 3: 获取K线数据 (待处理: {len(missing)})...\n')

if len(missing) == 0:
    print('全部已完成！')
    cursor.close()
    conn.close()
    exit(0)

total_inserted = 0
total_failed = 0
total_skipped = 0

for i, (code, name) in enumerate(missing):
    symbol = str(code).zfill(5)
    name_str = str(name).strip() if name else symbol
    try:
        df = ak.stock_hk_daily(symbol=symbol)
        if df is None or df.empty:
            total_skipped += 1
            print(f'[{i+1}/{len(missing)}] {symbol} {name_str} - 无数据')
            continue

        # Filter to last 1 year
        df_filtered = df[df['date'] >= ONE_YEAR_AGO]
        if df_filtered.empty:
            total_skipped += 1
            print(f'[{i+1}/{len(missing)}] {symbol} {name_str} - 近1年无数据')
            continue

        rows = []
        for _, row in df_filtered.iterrows():
            trade_date = row['date'].strftime('%Y-%m-%d') if hasattr(row['date'], 'strftime') else str(row['date'])
            rows.append((
                symbol, name_str, 2, trade_date,
                float(row['open']), float(row['high']), float(row['low']),
                float(row['close']), int(row['volume'])
            ))

        cursor.executemany('''
            INSERT INTO stock_prices
            (stock_code, stock_name, market_type, trade_date, open_price, high_price, low_price, close_price, volume)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
            open_price = VALUES(open_price), high_price = VALUES(high_price),
            low_price = VALUES(low_price), close_price = VALUES(close_price),
            volume = VALUES(volume)
        ''', rows)
        conn.commit()

        total_inserted += len(rows)
        print(f'[{i+1}/{len(missing)}] {symbol} {name_str} - {len(rows)}条')

    except Exception as e:
        total_failed += 1
        print(f'[{i+1}/{len(missing)}] {symbol} {name_str} - {str(e)[:100]}')
        conn.rollback()

    if (i + 1) % 100 == 0:
        conn.commit()

    time.sleep(0.2)

conn.commit()

print(f'\n=== 完成 ===')
print(f'新增K线: {total_inserted} 条')
print(f'失败: {total_failed}')
print(f'跳过(无近1年数据): {total_skipped}')

cursor.execute('SELECT COUNT(*) as cnt, COUNT(DISTINCT stock_code) as stocks FROM stock_prices WHERE market_type = 2')
cnt = cursor.fetchone()
print(f'数据库港股K线: {cnt[0]} 条, {cnt[1]} 只股票')

cursor.close()
conn.close()
