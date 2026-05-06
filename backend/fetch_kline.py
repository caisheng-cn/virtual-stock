#
# File: fetch_kline.py
# Description: Fetches stock K-line data via AKShare (A/HK/US).
#

import json
import sys


def fetch_hk_kline_akshare(symbol, start_date, end_date):
    """Fetch HK stock daily K-line data via AKShare."""
    try:
        import akshare as ak
        start = start_date.replace('-', '')
        end = end_date.replace('-', '')
        df = ak.stock_hk_hist(symbol=symbol, period='daily',
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


def fetch_hk_kline_batch_akshare(stocks):
    """Fetch HK stock K-line for multiple stocks via AKShare concurrently."""
    import concurrent.futures
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        fut_map = {}
        for s in stocks:
            f = executor.submit(fetch_hk_kline_akshare, s['symbol'], s['start_date'], s['end_date'])
            fut_map[f] = s['symbol']
        for future in concurrent.futures.as_completed(fut_map):
            symbol = fut_map[future]
            try:
                results[symbol] = future.result()
            except Exception as e:
                results[symbol] = {'error': str(e)}
    return [{'symbol': sym, 'data': results.get(sym, [])} for sym in [s['symbol'] for s in stocks]]


def fetch_us_kline_akshare(symbol, start_date, end_date):
    """Fetch US stock daily K-line data via AKShare."""
    try:
        import akshare as ak
        df = ak.stock_us_daily(symbol=symbol, adjust='qfq')
        if df is None or df.empty:
            return []
        data = []
        for _, row in df.iterrows():
            trade_date = row['date']
            if isinstance(trade_date, str):
                date_str = trade_date
            else:
                date_str = trade_date.strftime('%Y-%m-%d')
            if start_date and date_str < start_date:
                continue
            if end_date and date_str > end_date:
                continue
            data.append({
                'trade_date': date_str,
                'open_price': round(float(row['open']), 4),
                'high_price': round(float(row['high']), 4),
                'low_price': round(float(row['low']), 4),
                'close_price': round(float(row['close']), 4),
                'volume': int(row['volume'])
            })
        return data
    except Exception as e:
        return {'error': str(e)}


def fetch_us_kline_batch_akshare(stocks):
    """Fetch US stock K-line for multiple stocks via AKShare concurrently."""
    import concurrent.futures
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        fut_map = {}
        for s in stocks:
            f = executor.submit(fetch_us_kline_akshare, s['symbol'], s['start_date'], s['end_date'])
            fut_map[f] = s['symbol']
        for future in concurrent.futures.as_completed(fut_map):
            symbol = fut_map[future]
            try:
                results[symbol] = future.result()
            except Exception as e:
                results[symbol] = {'error': str(e)}
    return [{'symbol': sym, 'data': results.get(sym, [])} for sym in [s['symbol'] for s in stocks]]


def fetch_a_share_kline(symbol, start_date, end_date):
    """Fetch A-share daily K-line data via AKShare."""
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
    """Fetch A-share K-line for multiple stocks via AKShare concurrently."""
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


if __name__ == '__main__':
    args = json.loads(sys.argv[1])
    action = args.get('action', '')
    if action == 'hk_kline_akshare':
        result = fetch_hk_kline_akshare(args['symbol'], args['start_date'], args['end_date'])
    elif action == 'hk_kline_batch_akshare':
        result = fetch_hk_kline_batch_akshare(args.get('stocks', []))
    elif action == 'us_kline_batch_akshare':
        result = fetch_us_kline_batch_akshare(args.get('stocks', []))
    elif action == 'a_share':
        result = fetch_a_share_kline(args['symbol'], args['start_date'], args['end_date'])
    elif action == 'a_share_batch':
        result = fetch_a_share_batch(args.get('stocks', []))
    else:
        result = {'error': 'unknown action: ' + action}
    print(json.dumps(result))
