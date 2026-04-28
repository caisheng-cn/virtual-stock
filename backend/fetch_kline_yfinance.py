import yfinance as yf
import json
import sys
import os

os.environ['HOME'] = '/home/cai'

def get_hk_code(code):
    code = code.lstrip('0')
    if len(code) < 4:
        code = code.zfill(4)
    return f"{code}.HK"

def get_us_code(code):
    if '.' in code:
        return code
    return code

def fetch_quote(symbol, market_type, max_retries=3):
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

if __name__ == '__main__':
    args = json.loads(sys.argv[1])
    action = args.get('action', 'kline')
    period = args.get('period', '1y')
    if action == 'quote':
        result = fetch_quote(args['symbol'], args['market_type'])
    else:
        result = fetch_kline(args['symbol'], args['market_type'], args.get('stock_name', ''), period=period)
    print(json.dumps(result))