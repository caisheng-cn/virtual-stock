#
# File: fetch_kline_yfinance.py
# Created: 2024-01-01
# Author: CAISHENG <caisheng.cn@gmail.com>
# Description: Fetches stock quotes and K-line (candlestick) data from Yahoo Finance (yfinance).
#              Supports HK stocks (market_type=2) and US stocks (market_type=3).
# Version History:
#   1.0 - Initial version with fetch_quote and fetch_kline functions
#

import yfinance as yf
import json
import sys
import os

os.environ['HOME'] = '/home/cai'


def get_hk_code(code):
    """Convert a HK stock code to Yahoo Finance format.

    @param code: str - Raw HK stock code (e.g., "00700" or "700").
    @return: str - Formatted code with ".HK" suffix (e.g., "0700.HK").
    """
    code = code.lstrip('0')
    if len(code) < 4:
        code = code.zfill(4)
    return f"{code}.HK"


def get_us_code(code):
    """Return US stock code as-is for Yahoo Finance.

    @param code: str - US stock ticker symbol (e.g., "AAPL" or "BRK.B").
    @return: str - The same code, passed through unchanged.
    """
    if '.' in code:
        return code
    return code

def fetch_quote(symbol, market_type, max_retries=3):
    """Fetch real-time quote data for a stock.

    @param symbol: str - Stock code/symbol.
    @param market_type: int - 2 for HK stocks, 3 for US stocks.
    @param max_retries: int - Maximum retry attempts on failure (default 3).
    @return: dict - Quote data with keys: stockCode, stockName, marketType, price,
                    prevClose, openPrice, highPrice, lowPrice, volume, (tradeDate for US).
                    Returns {'error': str} on failure.
    """
    for attempt in range(max_retries):
        try:
            if market_type == 2:
                ticker = yf.Ticker(get_hk_code(symbol))
            else:
                ticker = yf.Ticker(get_us_code(symbol))
            
            info = ticker.info
            
            if market_type == 2:
                return {
                    'stockCode': symbol,
                    'stockName': info.get('shortName', symbol),
                    'marketType': market_type,
                    'price': info.get('currentPrice') or info.get('regularMarketPrice') or 0,
                    'prevClose': info.get('previousClose') or info.get('regularMarketPreviousClose') or 0,
                    'openPrice': info.get('open') or 0,
                    'highPrice': info.get('dayHigh') or info.get('regularMarketDayHigh') or 0,
                    'lowPrice': info.get('dayLow') or info.get('regularMarketDayLow') or 0,
                    'volume': info.get('volume') or 0,
                }
            else:
                return {
                    'stockCode': symbol,
                    'stockName': info.get('shortName', symbol),
                    'marketType': market_type,
                    'price': info.get('currentPrice') or info.get('regularMarketPrice') or 0,
                    'prevClose': info.get('previousClose') or info.get('regularMarketPreviousClose') or 0,
                    'openPrice': info.get('open') or 0,
                    'highPrice': info.get('dayHigh') or info.get('regularMarketDayHigh') or 0,
                    'lowPrice': info.get('dayLow') or info.get('regularMarketDayLow') or 0,
                    'volume': info.get('volume') or 0,
                    'tradeDate': info.get('regularMarketTime', 0) and os.popen('date +%Y-%m-%d').read().strip()
                }
        except Exception as e:
            if attempt < max_retries - 1:
                import time
                time.sleep(2)
            else:
                return {'error': str(e)}
    return {'error': 'max retries exceeded'}

def fetch_kline(symbol, market_type, stock_name, period='1y', max_retries=3):
    """Fetch historical K-line (candlestick) data for a stock.

    @param symbol: str - Stock code/symbol.
    @param market_type: int - 2 for HK stocks, 3 for US stocks.
    @param stock_name: str - Human-readable stock name (unused, kept for interface consistency).
    @param period: str - Time period (e.g., "1y", "6mo", "3mo"). Default "1y".
    @param max_retries: int - Maximum retry attempts on failure (default 3).
    @return: list[dict] - List of K-line entries with keys: trade_date, open_price,
                          high_price, low_price, close_price, volume.
                          Returns [] if no data, {'error': str} on failure.
    """
    for attempt in range(max_retries):
        try:
            if market_type == 2:
                ticker = yf.Ticker(get_hk_code(symbol))
            else:
                ticker = yf.Ticker(get_us_code(symbol))
            
            df = ticker.history(period=period, auto_adjust=True)
            
            if df.empty:
                return []
            
            data = []
            for idx, row in df.iterrows():
                data.append({
                    'trade_date': idx.strftime('%Y-%m-%d'),
                    'open_price': round(float(row['Open']), 4),
                    'high_price': round(float(row['High']), 4),
                    'low_price': round(float(row['Low']), 4),
                    'close_price': round(float(row['Close']), 4),
                    'volume': int(row['Volume'])
                })
            
            return data
        except Exception as e:
            if attempt < max_retries - 1:
                import time
                time.sleep(2)
            else:
                return {'error': str(e)}
    return {'error': 'max retries exceeded'}

def fetch_a_share_kline(symbol, start_date, end_date):
    """Fetch A-share daily K-line data via AKShare (East Money source).
    @param symbol: str - Stock code (e.g., '000001', '600519', '300750').
    @param start_date: str - Start date in YYYY-MM-DD format.
    @param end_date: str - End date in YYYY-MM-DD format.
    @return: list[dict] - List of K-line entries with keys: trade_date, open_price,
                          high_price, low_price, close_price, volume.
                          Returns [] if no data, {'error': str} on failure.
    """
    try:
        import akshare as ak
        start = start_date.replace('-', '')
        end = end_date.replace('-', '')
        df = ak.stock_zh_a_hist(symbol=symbol, period='daily',
                                start_date=start, end_date=end,
                                adjust='qfq')
        if df is None or df.empty:
            return []
        data = []
        for _, row in df.iterrows():
            data.append({
                'trade_date': str(row['日期']),
                'open_price': round(float(row['开盘']), 4),
                'high_price': round(float(row['最高']), 4),
                'low_price': round(float(row['最低']), 4),
                'close_price': round(float(row['收盘']), 4),
                'volume': int(row['成交量'])
            })
        return data
    except Exception as e:
        return {'error': str(e)}

def fetch_a_share_batch(stocks):
    """Fetch A-share daily K-line for multiple stocks concurrently.
    stocks: list of {symbol, start_date, end_date}
    Returns: list of {symbol, data}
    """
    import concurrent.futures
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        fut_map = {}
        for s in stocks:
            f = executor.submit(fetch_a_share_kline, s['symbol'], s['start_date'], s['end_date'])
            fut_map[f] = s['symbol']
        for future in concurrent.futures.as_completed(fut_map):
            symbol = fut_map[future]
            try:
                results[symbol] = future.result()
            except Exception as e:
                results[symbol] = {'error': str(e)}
    return [{'symbol': sym, 'data': results.get(sym, [])} for sym in [s['symbol'] for s in stocks]]

def fetch_kline_batch(stocks, period='1y'):
    """Fetch K-line data for multiple stocks concurrently.
    stocks: list of {symbol, market_type, stock_name}
    Returns: list of {symbol, data} — data is [] or {'error': msg} on failure
    """
    import concurrent.futures
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        fut_map = {}
        for s in stocks:
            f = executor.submit(fetch_kline, s['symbol'], s['market_type'], s.get('stock_name', ''), period)
            fut_map[f] = s['symbol']
        for future in concurrent.futures.as_completed(fut_map):
            symbol = fut_map[future]
            try:
                data = future.result()
                results[symbol] = data
            except Exception as e:
                results[symbol] = {'error': str(e)}
    return [{'symbol': sym, 'data': results.get(sym, [])} for sym in [s['symbol'] for s in stocks]]

if __name__ == '__main__':
    args = json.loads(sys.argv[1])
    action = args.get('action', 'kline')
    period = args.get('period', '1y')
    if action == 'kline_batch':
        result = fetch_kline_batch(args.get('stocks', []), period)
    elif action == 'a_share':
        result = fetch_a_share_kline(args['symbol'], args['start_date'], args['end_date'])
    elif action == 'a_share_batch':
        result = fetch_a_share_batch(args.get('stocks', []))
    elif action == 'quote':
        result = fetch_quote(args['symbol'], args['market_type'])
    else:
        result = fetch_kline(args['symbol'], args['market_type'], args.get('stock_name', ''), period=period)
    print(json.dumps(result))