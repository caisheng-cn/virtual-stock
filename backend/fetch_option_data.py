#!/usr/bin/env python3
"""
AKShare 期权数据同步脚本
通过 stdin/stdout 与 Node.js 通信，返回 JSON 数据
"""
import sys
import json
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import akshare as ak
except ImportError:
    print(json.dumps({"error": "akshare not installed, run: pip install akshare"}))
    sys.exit(1)


# ============================================================
# 合约代码解析工具
# ============================================================

def parse_etf_option_code(code):
    """解析上交所ETF期权合约代码
    格式: 510050C2606A03000
         标的  C/P  年月 序列 行权价*1000
    或 CTP格式: HO2605-C-2500
    """
    result = {
        "underlying": "",
        "option_type": "",
        "expiry_year": "",
        "expiry_month": "",
        "strike": 0,
        "raw": code
    }
    # CTP格式: HO2605-C-2500
    m = re.match(r'^([A-Z]+)(\d{2})(\d{2})-([CP])-(\d+\.?\d*)$', code)
    if m:
        result["underlying"] = m.group(1)
        result["expiry_year"] = "20" + m.group(2)
        result["expiry_month"] = m.group(3)
        result["option_type"] = "call" if m.group(4) == 'C' else 'put'
        result["strike"] = float(m.group(5))
        return result

    # 上交所ETF格式: 510050C2606A03000
    m = re.match(r'^(\d{6})([CP])(\d{2})(\d{2})([A-Z])(\d{5,8})$', code)
    if m:
        result["underlying"] = m.group(1)
        result["option_type"] = "call" if m.group(2) == 'C' else 'put'
        result["expiry_year"] = "20" + m.group(3)
        result["expiry_month"] = m.group(4)
        # 行权价: 最后5-8位，除以1000或10000
        strike_str = m.group(6)
        if len(strike_str) >= 6:
            result["strike"] = float(strike_str) / 10000
        elif len(strike_str) == 5:
            result["strike"] = float(strike_str) / 1000
        else:
            result["strike"] = float(strike_str) / 100
        return result

    return result


def parse_cffex_code(code):
    """解析中金所股指期权代码
    格式: IO2606C3400 或 HO2605C2500
        品种 年月 C/P 行权价
    """
    result = {"underlying": "", "option_type": "", "expiry_year": "", "expiry_month": "", "strike": 0}
    m = re.match(r'^([A-Z]+)(\d{2})(\d{2})([CP])(\d+)$', code)
    if m:
        result["underlying"] = m.group(1)
        result["expiry_year"] = "20" + m.group(2)
        result["expiry_month"] = m.group(3)
        result["option_type"] = "call" if m.group(4) == 'C' else 'put'
        result["strike"] = float(m.group(5))
    return result


def parse_sse_expiry_month(month_code):
    """解析上交所到期月代码 '202606' -> {'year': 2026, 'month': 6}"""
    if len(month_code) == 6:
        return {
            "year": int(month_code[:4]),
            "month": int(month_code[4:6])
        }
    # 兼容旧格式 '2506'
    return {
        "year": int("20" + month_code[:2]),
        "month": int(month_code[2:4])
    }


# ============================================================
# AKShare 接口封装
# ============================================================

SSE_ETF_MAP = {
    "华夏上证50ETF期权": {"code": "510050", "etf": "50ETF", "index": "sh510050", "exchange": "SSE"},
    "华泰柏瑞沪深300ETF期权": {"code": "510300", "etf": "300ETF", "index": "sh510300", "exchange": "SSE"},
    "南方中证500ETF期权": {"code": "510500", "etf": "500ETF", "index": "sh510500", "exchange": "SSE"},
    "华夏科创50ETF期权": {"code": "588000", "etf": "588000", "index": "sh588000", "exchange": "SSE"},
    "易方达科创50ETF期权": {"code": "588080", "etf": "588080", "index": "sh588080", "exchange": "SSE"},
}

SZSE_ETF_MAP = {
    "嘉实沪深300ETF期权": {"code": "159919", "etf": "300ETF", "exchange": "SZSE"},
}

CFFEX_MAP = {
    "沪深300股指期权": {"code": "000300", "prefix": "io", "list_fn": ak.option_cffex_hs300_list_sina,
                     "daily_fn": ak.option_cffex_hs300_daily_sina, "spot_fn": ak.option_cffex_hs300_spot_sina},
    "上证50股指期权": {"code": "000016", "prefix": "ho", "list_fn": ak.option_cffex_sz50_list_sina,
                     "daily_fn": ak.option_cffex_sz50_daily_sina, "spot_fn": ak.option_cffex_sz50_spot_sina},
    "中证1000股指期权": {"code": "000852", "prefix": "mo", "list_fn": ak.option_cffex_zz1000_list_sina,
                      "daily_fn": ak.option_cffex_zz1000_daily_sina, "spot_fn": ak.option_cffex_zz1000_spot_sina},
}


def sync_all_contracts():
    """从 openCTP 获取全市场合约列表"""
    print("[sync_all_contracts] 开始获取...", file=sys.stderr)
    df = ak.option_contract_info_ctp()
    contracts = []
    for _, row in df.iterrows():
        exchange = row.get("交易所ID", "")
        contract_id = row.get("合约ID", "")
        contract_name = row.get("合约名称", "")
        product_cat = row.get("商品类别", 0)
        strike = float(row.get("行权价", 0))
        opt_type_val = str(row.get("期权类型", "0"))
        opt_type = "call" if opt_type_val in ("1", "1.0") else ("put" if opt_type_val in ("2", "2.0") else "")

        expiry_year = row.get("交割年份", 0)
        expiry_month = row.get("交割月份", 0)
        last_trade = str(row.get("最后交易日", "") or "")
        delivery = str(row.get("交割日", "") or "")
        listing = str(row.get("上市日期", "") or "")

        c = {
            "exchange": exchange,
            "contract_code_ctp": contract_id,
            "contract_name": contract_name,
            "option_type": opt_type,
            "strike_price": strike,
            "expiration_date": last_trade[:10] if last_trade else "",
            "delivery_date": delivery[:10] if delivery else "",
            "listing_date": listing[:10] if listing else "",
            "contract_multiplier": int(row.get("合约乘数", 0)),
            "prev_settle": float(row.get("做多保证金/手", 0) or 0),
            "status": 1,
            "exercise_type": 1,  # 默认美式
        }

        # 根据品种判断行权方式
        product = str(row.get("品种ID", ""))
        if exchange == "CFFEX":
            c["exercise_type"] = 2  # 欧式
            if product in ("IO", "HO", "MO"):
                c["underlying_code"] = {"IO": "000300", "HO": "000016", "MO": "000852"}.get(product, "")
        elif exchange == "SSE":
            c["exercise_type"] = 1  # 美式
            c["underlying_code"] = str(row.get("标的合约ID", "") or "")
        elif exchange == "SZSE":
            c["exercise_type"] = 1
            c["underlying_code"] = str(row.get("标的合约ID", "") or "")

        contracts.append(c)

    print(f"[sync_all_contracts] 完成: {len(contracts)} 个合约", file=sys.stderr)
    return {"contracts": contracts}


def sync_sse_board(symbol, end_month):
    """获取上交所ETF期权实时T型报价"""
    print(f"[sync_sse_board] {symbol} {end_month}", file=sys.stderr)
    df = ak.option_finance_board(symbol=symbol, end_month=end_month)
    info = SSE_ETF_MAP.get(symbol, {})
    underlying_code = info.get("code", "")
    rows = []
    if "合约交易代码" in df.columns:
        # SSE ETF格式
        for _, row in df.iterrows():
            rows.append({
                "contract_code": str(row.get("合约交易代码", "")),
                "current_price": float(row.get("当前价", 0) or 0),
                "change_percent": float(row.get("涨跌幅", 0) or 0),
                "prev_settle": float(row.get("前结价", 0) or 0),
                "strike_price": float(row.get("行权价", 0) or 0),
                "underlying_code": underlying_code,
            })
    elif "合约简称" in df.columns:
        # SZSE ETF格式
        for _, row in df.iterrows():
            rows.append({
                "contract_code": str(row.get("合约编码", "")),
                "contract_name": str(row.get("合约简称", "")),
                "strike_price": float(str(row.get("行权价", "0")).replace(",", "") or 0),
                "option_type": "call" if "购" in str(row.get("类型", "")) else "put",
                "expiration_date": str(row.get("期权行权日", "") or "")[:10],
                "underlying_code": underlying_code,
            })
    return {"board_data": rows}


def sync_cffex_board(symbol_name):
    """获取中金所股指期权实时T型报价"""
    info = CFFEX_MAP.get(symbol_name)
    if not info:
        return {"board_data": []}

    print(f"[sync_cffex_board] {symbol_name}", file=sys.stderr)
    try:
        month_list = info["list_fn"]()
        # 取第一个可用月份
        months = []
        if isinstance(month_list, dict):
            for v in month_list.values():
                if isinstance(v, list):
                    months = v
                    break
        elif isinstance(month_list, list):
            months = month_list

        if not months:
            return {"board_data": []}

        spot_df = info["spot_fn"](months[0])
        rows = []
        for _, row in spot_df.iterrows():
            strike = float(row.get("行权价", 0) or 0)
            # Call side
            call_id = str(row.get("看涨合约-标识", "") or "")
            put_id = str(row.get("看跌合约-标识", "") or "")
            if call_id:
                parsed = parse_cffex_code(call_id)
                rows.append({
                    "contract_code_ctp": call_id,
                    "option_type": "call",
                    "strike_price": strike,
                    "last_price": float(row.get("看涨合约-最新价", 0) or 0),
                    "bid_price": float(row.get("看涨合约-买价", 0) or 0),
                    "ask_price": float(row.get("看涨合约-卖价", 0) or 0),
                    "open_interest": int(row.get("看涨合约-持仓量", 0) or 0),
                    "change": float(row.get("看涨合约-涨跌", 0) or 0),
                    "underlying_code": info["code"],
                })
            if put_id:
                rows.append({
                    "contract_code_ctp": put_id,
                    "option_type": "put",
                    "strike_price": strike,
                    "last_price": float(row.get("看跌合约-最新价", 0) or 0),
                    "bid_price": float(row.get("看跌合约-买价", 0) or 0),
                    "ask_price": float(row.get("看跌合约-卖价", 0) or 0),
                    "open_interest": int(row.get("看跌合约-持仓量", 0) or 0),
                    "change": float(row.get("看跌合约-涨跌", 0) or 0),
                    "underlying_code": info["code"],
                })
        return {"board_data": rows}
    except Exception as e:
        print(f"[sync_cffex_board] 错误: {e}", file=sys.stderr)
        return {"board_data": []}


def sync_daily_close_sse(contract_codes):
    """获取上交所期权日线数据"""
    results = []
    for code in contract_codes:
        try:
            df = ak.option_sse_daily_sina(symbol=str(code))
            if df is not None and len(df) > 0:
                last = df.iloc[-1]
                results.append({
                    "contract_code_sse": str(code),
                    "trade_date": str(last.get("日期", "")),
                    "open": float(last.get("开盘", 0) or 0),
                    "high": float(last.get("最高", 0) or 0),
                    "low": float(last.get("最低", 0) or 0),
                    "close": float(last.get("收盘", 0) or 0),
                    "volume": int(last.get("成交量", 0) or 0),
                })
            time.sleep(0.3)  # 避免触发反爬
        except Exception as e:
            print(f"[sync_daily_close] {code} 错误: {e}", file=sys.stderr)
    return {"daily_data": results}


def sync_daily_close_cffex(symbol_name, month_code):
    """获取中金所股指期权日线数据"""
    info = CFFEX_MAP.get(symbol_name)
    if not info:
        return {"daily_data": []}

    try:
        spot_df = info["spot_fn"](month_code)
        rows = []
        for _, row in spot_df.iterrows():
            call_id = str(row.get("看涨合约-标识", "") or "")
            put_id = str(row.get("看跌合约-标识", "") or "")
            for contract_id in [call_id, put_id]:
                if not contract_id:
                    continue
                try:
                    df = info["daily_fn"](symbol=contract_id)
                    if df is not None and len(df) > 0:
                        last = df.iloc[-1]
                        rows.append({
                            "contract_code_ctp": contract_id,
                            "trade_date": str(last.get("date", "")),
                            "open": float(last.get("open", 0) or 0),
                            "high": float(last.get("high", 0) or 0),
                            "low": float(last.get("low", 0) or 0),
                            "close": float(last.get("close", 0) or 0),
                            "volume": int(last.get("volume", 0) or 0),
                        })
                    time.sleep(0.3)
                except Exception as e:
                    print(f"[sync_daily_close_cffex] {contract_id}: {e}", file=sys.stderr)
        return {"daily_data": rows}
    except Exception as e:
        print(f"[sync_daily_close_cffex] 错误: {e}", file=sys.stderr)
        return {"daily_data": []}


def sync_expiry_dates_50etf():
    """获取 50ETF 期权到期日"""
    try:
        months = ak.option_sse_list_sina(symbol="50ETF")
        results = []
        for m in months:
            try:
                expiry_str, days_left = ak.option_sse_expire_day_sina(
                    trade_date=m, symbol="50ETF"
                )
                parsed = parse_sse_expiry_month(m)
                results.append({
                    "underlying": "510050",
                    "underlying_name": "华夏上证50ETF",
                    "month_code": m,
                    "expiry_date": str(expiry_str)[:10] if expiry_str else "",
                    "days_left": int(days_left) if days_left else 0,
                    "year": parsed["year"],
                    "month": parsed["month"],
                })
            except Exception as e:
                print(f"[sync_expiry_dates] 50ETF {m}: {e}", file=sys.stderr)
        return {"expirations": results}
    except Exception as e:
        return {"expirations": [], "error": str(e)}


def sync_expiry_dates_all():
    """获取所有 ETF 到期日"""
    results = {"expirations": []}
    for etf_name in ["50ETF", "300ETF", "500ETF", "588000", "588080"]:
        try:
            months = ak.option_sse_list_sina(symbol=etf_name)
            for m in months:
                try:
                    expiry_str, days_left = ak.option_sse_expire_day_sina(
                        trade_date=m, symbol=etf_name
                    )
                    parsed = parse_sse_expiry_month(m)
                    results["expirations"].append({
                        "underlying": etf_name,
                        "month_code": m,
                        "expiry_date": str(expiry_str)[:10] if expiry_str else "",
                        "days_left": int(days_left) if days_left else 0,
                        "year": parsed["year"],
                        "month": parsed["month"],
                    })
                except Exception as e:
                    print(f"[sync_expiry_dates] {etf_name} {m}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"[sync_expiry_dates] {etf_name}: {e}", file=sys.stderr)
    return results


def sync_cffex_expiry_dates():
    """获取中金所股指期权到期日"""
    results = {"expirations": []}
    for name, info in CFFEX_MAP.items():
        try:
            month_dict = info["list_fn"]()
            months = []
            for v in month_dict.values():
                if isinstance(v, list):
                    months = v
            for m in months:
                results["expirations"].append({
                    "underlying": info["code"],
                    "underlying_name": name,
                    "month_code": m,
                    "prefix": info["prefix"],
                })
        except Exception as e:
            print(f"[sync_cffex_expiry] {name}: {e}", file=sys.stderr)
    return results


def sync_greeks(trade_date):
    """获取 SSE 风险指标"""
    try:
        df = ak.option_risk_indicator_sse(date=trade_date)
        rows = []
        for _, row in df.iterrows():
            rows.append({
                "contract_code_sse": str(row.get("CONTRACT_ID", "")),
                "delta": float(row.get("DELTA_VALUE", 0) or 0),
                "gamma": float(row.get("GAMMA_VALUE", 0) or 0),
                "theta": float(row.get("THETA_VALUE", 0) or 0),
                "vega": float(row.get("VEGA_VALUE", 0) or 0),
                "rho": float(row.get("RHO_VALUE", 0) or 0),
                "implied_volatility": float(row.get("IMPLC_VOLATLTY", 0) or 0),
                "trade_date": trade_date,
            })
        return {"greeks_data": rows}
    except Exception as e:
        return {"greeks_data": [], "error": str(e)}


def sync_daily_close_for_underlying(underlying_code, exchange, sse_codes, cffex_symbol, cffex_month):
    """批量获取某个标的的所有合约最近日线数据"""
    print(f"[sync_daily_close_for_underlying] {underlying_code} {exchange}", file=sys.stderr)
    result = {"prices": []}

    if exchange == "SSE":
        data = sync_daily_close_sse(sse_codes)
        result["prices"] = data.get("daily_data", [])
    elif exchange == "SZSE":
        data = sync_daily_close_sse(sse_codes)
        result["prices"] = data.get("daily_data", [])
    elif exchange == "CFFEX":
        if cffex_symbol and cffex_month:
            data = sync_daily_close_cffex(cffex_symbol, cffex_month)
            result["prices"] = data.get("daily_data", [])

    print(f"[sync_daily_close_for_underlying] 完成: {len(result['prices'])} 条", file=sys.stderr)
    return result


def sync_underlying_price(underlying_code, exchange="SSE"):
    """获取ETF或指数的实时价格"""
    try:
        if exchange in ("SSE", "SZSE"):
            # ETF 净值: 通过 sina 接口
            prefix = "sh" if exchange == "SSE" else "sz"
            url_code = f"{prefix}{underlying_code}"
            df = ak.option_sse_underlying_spot_price_sina(symbol=url_code)
            price = 0
            name = ""
            for _, row in df.iterrows():
                field = str(row.get("字段", ""))
                val = str(row.get("值", ""))
                if "最近成交价" in field:
                    price = float(val) if val else 0
                if "证券简称" in field:
                    name = val
            return {"price": price, "name": name}
        elif exchange == "CFFEX":
            # 股指: 从新浪获取指数日线数据，取最新收盘价
            prefix_map = {"000300": "sh000300", "000016": "sh000016", "000852": "sh000852"}
            symbol = prefix_map.get(underlying_code, f"sh{underlying_code}")
            df = ak.stock_zh_index_daily(symbol=symbol)
            if df is None or df.empty:
                return {"price": 0, "name": ""}
            latest = df.iloc[-1]
            return {
                "price": float(latest.get("close", 0) or 0),
                "name": str(ak.stock_individual_info_em(symbol=underlying_code).iloc[0].get("value", ""))
                if False else symbol,
                "open": float(latest.get("open", 0) or 0),
                "high": float(latest.get("high", 0) or 0),
                "low": float(latest.get("low", 0) or 0),
                "volume": int(latest.get("volume", 0) or 0),
            }
        else:
            return {"price": 0, "name": ""}
    except Exception as e:
        return {"price": 0, "error": str(e)}


def init_backfill_sse(underlying_symbol, etf_name, target_date_from="2025-05-15"):
    """批量回填上交所期权历史数据"""
    print(f"[init_backfill] 开始回填 {underlying_symbol}({etf_name}) ...", file=sys.stderr)

    months = ak.option_sse_list_sina(symbol=etf_name)

    # 对于每个月份，获取所有合约代码
    all_codes = []
    for m in months:
        for opt_type in ["看涨期权", "看跌期权"]:
            try:
                codes_df = ak.option_sse_codes_sina(
                    symbol=opt_type, trade_date=m, underlying=underlying_symbol
                )
                if codes_df is not None and "期权代码" in codes_df.columns:
                    codes = codes_df["期权代码"].tolist()
                    all_codes.extend([(str(code), m, opt_type) for code in codes])
            except Exception as e:
                print(f"[init_backfill] {m} {opt_type}: {e}", file=sys.stderr)

    print(f"[init_backfill] 共 {len(all_codes)} 个合约待回填", file=sys.stderr)

    prices = []
    # 分批并发获取
    batch_size = 5
    for i in range(0, len(all_codes), batch_size):
        batch = all_codes[i:i + batch_size]
        batch_results = []

        with ThreadPoolExecutor(max_workers=5) as executor:
            future_map = {}
            for code, m, opt in batch:
                future = executor.submit(ak.option_sse_daily_sina, symbol=code)
                future_map[future] = (code, m, opt)

            for future in as_completed(future_map):
                code, m, opt = future_map[future]
                try:
                    df = future.result()
                    if df is not None and len(df) > 0:
                        for _, row in df.iterrows():
                            trade_date = str(row.get("日期", ""))
                            if trade_date and trade_date >= target_date_from:
                                price_info = {
                                    "contract_code_sse": code,
                                    "trade_date": trade_date,
                                    "open": float(row.get("开盘", 0) or 0),
                                    "high": float(row.get("最高", 0) or 0),
                                    "low": float(row.get("最低", 0) or 0),
                                    "close": float(row.get("收盘", 0) or 0),
                                    "volume": int(row.get("成交量", 0) or 0),
                                }
                                batch_results.append(price_info)
                except Exception as e:
                    print(f"[init_backfill] {code}: {e}", file=sys.stderr)

        prices.extend(batch_results)
        print(f"[init_backfill] 进度: {min(i + batch_size, len(all_codes))}/{len(all_codes)}, 已获取 {len(prices)} 条", file=sys.stderr)
        time.sleep(0.5)

    print(f"[init_backfill] 完成: 共获取 {len(prices)} 条日线数据", file=sys.stderr)
    return {"prices": prices}


# ============================================================
# 主入口
# ============================================================

def main():
    input_data = {}

    # 从命令行参数读取（Node.js spawn方式）
    if len(sys.argv) > 1:
        try:
            input_data = json.loads(sys.argv[1])
        except (json.JSONDecodeError, IndexError):
            action = sys.argv[1]
            input_data = {"action": action}
            if action == "init_backfill":
                input_data["underlying"] = sys.argv[2] if len(sys.argv) > 2 else "510050"
                input_data["etf_name"] = sys.argv[3] if len(sys.argv) > 3 else "50ETF"

    # 从stdin读取（pipe方式，优先）
    if not input_data:
        try:
            stdin_data = sys.stdin.read()
            if stdin_data.strip():
                input_data = json.loads(stdin_data)
        except Exception:
            pass

    if not input_data:
        print(json.dumps({"error": "No input provided"}))
        return

    action = input_data.get("action", "")
    result = {}

    try:
        if action == "sync_all_contracts":
            result = sync_all_contracts()
        elif action == "sync_sse_board":
            result = sync_sse_board(
                input_data.get("symbol", "华夏上证50ETF期权"),
                input_data.get("end_month", "2506")
            )
        elif action == "sync_cffex_board":
            result = sync_cffex_board(input_data.get("symbol_name", "沪深300股指期权"))
        elif action == "sync_daily_close":
            contract_type = input_data.get("contract_type", "sse")
            if contract_type == "sse":
                result = sync_daily_close_sse(input_data.get("contract_codes", []))
            elif contract_type == "cffex":
                result = sync_daily_close_cffex(
                    input_data.get("symbol_name", "沪深300股指期权"),
                    input_data.get("month_code", "io2606")
                )
        elif action == "sync_daily_close_for_underlying":
            result = sync_daily_close_for_underlying(
                input_data.get("underlying_code", ""),
                input_data.get("exchange", ""),
                input_data.get("sse_codes", []),
                input_data.get("cffex_symbol", ""),
                input_data.get("cffex_month", ""),
            )
        elif action == "sync_expiry_dates":
            scope = input_data.get("scope", "all")
            if scope == "50etf":
                result = sync_expiry_dates_50etf()
            elif scope == "cffex":
                result = sync_cffex_expiry_dates()
            else:
                result = sync_expiry_dates_all()
        elif action == "sync_greeks":
            result = sync_greeks(input_data.get("trade_date", time.strftime("%Y%m%d")))
        elif action == "sync_underlying_price":
            result = sync_underlying_price(
                input_data.get("underlying_code", "510050"),
                input_data.get("exchange", "SSE")
            )
        elif action == "init_backfill":
            result = init_backfill_sse(
                input_data.get("underlying", "510050"),
                input_data.get("etf_name", "50ETF"),
                input_data.get("date_from", "2025-05-15")
            )
        elif action == "ping":
            result = {"pong": True, "time": time.time()}
        else:
            result = {"error": f"Unknown action: {action}"}
    except Exception as e:
        result = {"error": str(e)}

    print(json.dumps(result, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
