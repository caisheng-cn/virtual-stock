# 虚拟期权 — AKShare 真实数据改造方案

> 版本: v1.0  
> 日期: 2026-05-15  
> 状态: 待实施

---

## 1. 改造目标

将当前基于模拟定价（简化 Black-Scholes，固定 30% IV）的期权交易系统，替换为基于 **AKShare** 真实市场数据的方案，全面支持中国场内期权市场。

### 1.1 范围

| 项目 | 当前 | 改造后 |
|------|------|--------|
| 标的市场 | A股 + 港股 + 美股 | **仅中国市场**（ETF/股指/商品期权） |
| 定价方式 | 模拟计算（简化BSM） | **真实市场报价** |
| 合约来源 | 自定义生成 | **交易所真实合约** |
| Greeks | 仅Delta预留 | 真实Delta/Gamma/Theta/Vega/Rho/IV |
| 行权规则 | 统一美式 | 按实际规则（ETF美式，股指欧式） |
| 币种 | 多币种(USD→CNY) | 保留多币种结构，期权交易用CNY |
| 数据同步 | 无 | 调度任务自动同步 |

---

## 2. 支持的期权标的

### 2.1 ETF 期权（上交所）

| 标的名称 | 标的代码 | 行权方式 | AKShare symbol |
|---------|---------|---------|---------------|
| 华夏上证50ETF | 510050 | 美式 | `华夏上证50ETF期权` |
| 华泰柏瑞沪深300ETF | 510300 | 美式 | `华泰柏瑞沪深300ETF期权` |
| 南方中证500ETF | 510500 | 美式 | `南方中证500ETF期权` |
| 华夏科创50ETF | 588000 | 美式 | `华夏科创50ETF期权` |
| 易方达科创50ETF | 588080 | 美式 | `易方达科创50ETF期权` |
| 嘉实沪深300ETF | 159919 | 美式 | `嘉实沪深300ETF期权` |

### 2.2 股指期权（中金所）

| 标的名称 | 标的代码 | 行权方式 | AKShare symbol |
|---------|---------|---------|---------------|
| 沪深300股指期权 | 000300 | 欧式 | `沪深300股指期权` |
| 上证50股指期权 | 000016 | 欧式 | `上证50股指期权` |
| 中证1000股指期权 | 000852 | 欧式 | `中证1000股指期权` |

### 2.3 商品期权（可选扩展）

| 交易所 | 品种 |
|--------|------|
| 大商所(DCE) | 豆粕、玉米、铁矿石、棕榈油、聚丙烯、聚乙烯、PVC、豆油、乙二醇、苯乙烯 等 |
| 上期所(SHFE) | 铜、铝、锌、铅、镍、锡、黄金、白银、螺纹钢、氧化铝 等 |
| 郑商所(CZCE) | 白糖、棉花、PTA、甲醇、菜籽粕、纯碱、尿素、玻璃、花生 等 |
| 广期所(GFEX) | 工业硅、碳酸锂、多晶硅 |

> 初始版本建议先实现 **ETF期权 + 股指期权**，商品期权作为后续扩展。

---

## 3. 数据库表结构改动

### 3.1 `option_whitelist` — 期权标的白名单

```sql
ALTER TABLE option_whitelist
  ADD COLUMN underlying_type TINYINT DEFAULT 1 COMMENT '标的类型 1=ETF 2=股指 3=商品',
  ADD COLUMN exchange VARCHAR(10) DEFAULT '' COMMENT '交易所 SSE/SZSE/CFFEX/DCE/SHFE/CZCE/GFEX',
  ADD COLUMN underlying_code VARCHAR(20) DEFAULT '' COMMENT '标的实际代码(如510050)',
  ADD COLUMN contract_multiplier INT DEFAULT 10000 COMMENT '合约单位(张)',
  ADD COLUMN exercise_type TINYINT DEFAULT 1 COMMENT '行权方式 1=美式 2=欧式';
```

字段说明：

| 字段 | 示例 | 说明 |
|------|------|------|
| `stock_code` | `510050` | 标的资产代码 |
| `stock_name` | `华夏上证50ETF` | 标的资产名称 |
| `market_type` | `1` | 固定为 1（A股市场） |
| `underlying_type` | `1` | ETF = 1, 股指 = 2, 商品 = 3 |
| `exchange` | `SSE` | 交易所标识 |
| `underlying_code` | `510050` | AKShare 中查询用的代码 |

### 3.2 `option_contracts` — 期权合约

```sql
ALTER TABLE option_contracts
  ADD COLUMN exchange VARCHAR(10) DEFAULT '' COMMENT '交易所 SSE/SZSE/CFFEX/DCE...',
  ADD COLUMN contract_name VARCHAR(100) DEFAULT '' COMMENT '合约简称(如50ETF购6月2800)',
  ADD COLUMN exercise_type TINYINT DEFAULT 1 COMMENT '行权方式 1=美式 2=欧式',
  ADD COLUMN contract_code_sse VARCHAR(20) DEFAULT '' COMMENT '上交所内部合约编码(如10011251)',
  ADD COLUMN contract_code_ctp VARCHAR(50) DEFAULT '' COMMENT 'openCTP合约ID(如510050C2606A03000)',
  ADD COLUMN prev_settle DECIMAL(12,4) DEFAULT 0 COMMENT '昨结算价',
  ADD COLUMN listing_date DATE DEFAULT NULL COMMENT '上市日期',
  ADD COLUMN last_trade_date DATE DEFAULT NULL COMMENT '最后交易日',
  ADD COLUMN delivery_date DATE DEFAULT NULL COMMENT '交割日',
  ADD COLUMN underlying_code VARCHAR(20) DEFAULT '' COMMENT '标的代码(冗余，方便查询)';
```

字段对应关系：

| 来源 | 字段 | AKShare数据源 |
|------|------|--------------|
| 上交所ETF期权 | `contract_code_sse` | `option_sse_codes_sina()` 返回的`期权代码` |
| CTP全市场 | `contract_code_ctp` | `option_contract_info_ctp()` 返回的`合约ID`（如 `510050C2606A03000`）|
| 合约简称 | `contract_name` | `option_finance_board()` SSE模式下返回的`合约交易代码`或 SZSE模式下的`合约简称` |
| 行权价 | `strike_price` | CTP的`行权价`或 board的`行权价` |
| 到期日 | `expiration_date` | CTP的`最后交易日`或 SZSE board的`期权行权日` |
| 上市日 | `listing_date` | CTP的`上市日期` |
| 交割日 | `delivery_date` | CTP的`交割日` |

**唯一约束调整**：

```sql
-- contract_code 不再作为唯一键的主字段，改为用交易所+合约代码联合唯一
ALTER TABLE option_contracts
  DROP KEY uk_contract_code,
  ADD UNIQUE KEY uk_contract_code (contract_code(50));

-- 新增强制索引
ALTER TABLE option_contracts
  ADD INDEX idx_exchange (exchange),
  ADD INDEX idx_expiration_status (expiration_date, status);
```

### 3.3 `option_prices` — 期权每日行情

```sql
ALTER TABLE option_prices
  ADD COLUMN settle DECIMAL(12,4) DEFAULT 0 COMMENT '结算价',
  ADD COLUMN prev_settle DECIMAL(12,4) DEFAULT 0 COMMENT '昨结算价',
  ADD COLUMN open_interest INT DEFAULT 0 COMMENT '持仓量',
  ADD COLUMN volume INT DEFAULT 0 COMMENT '成交量',
  ADD COLUMN gamma DECIMAL(10,6) DEFAULT 0 COMMENT 'Gamma',
  ADD COLUMN theta DECIMAL(10,6) DEFAULT 0 COMMENT 'Theta',
  ADD COLUMN vega DECIMAL(10,6) DEFAULT 0 COMMENT 'Vega',
  ADD COLUMN rho DECIMAL(10,6) DEFAULT 0 COMMENT 'Rho',
  ADD COLUMN bid_price DECIMAL(12,4) DEFAULT 0 COMMENT '买一价',
  ADD COLUMN ask_price DECIMAL(12,4) DEFAULT 0 COMMENT '卖一价',
  ADD COLUMN change_percent DECIMAL(8,4) DEFAULT 0 COMMENT '涨跌幅(%)';

-- 数据类型扩展（原DECIMAL(12,4)可能容纳不了股指期权的大数值）
ALTER TABLE option_prices
  MODIFY COLUMN premium DECIMAL(14,4) NOT NULL COMMENT '权利金',
  MODIFY COLUMN intrinsic_value DECIMAL(14,4) DEFAULT 0 COMMENT '内在价值',
  MODIFY COLUMN time_value DECIMAL(14,4) DEFAULT 0 COMMENT '时间价值',
  MODIFY COLUMN underlying_price DECIMAL(14,2) NOT NULL COMMENT '当日标的收盘价';

-- 新增索引
ALTER TABLE option_prices
  ADD INDEX idx_trade_date_status (trade_date);
```

数据来源对照：

| 字段 | ETF期权(上交所) | ETF期权(深交所) | 股指期权(中金所) | 商品期权 |
|------|----------------|----------------|----------------|---------|
| premium | `option_finance_board` → `当前价` | 待映射 | `option_cffex_*_spot_sina` → `最新价` | `option_hist_*` → `收盘价` |
| settle | `option_current_day_sse` → 待映射 | 待映射 | 待映射 | `option_hist_*` → `结算价` |
| delta/iv | `option_risk_indicator_sse` | 待映射 | 待映射 | `option_hist_shfe/czce/gfex` → `德尔塔/隐含波动率` |
| volume/oi | `option_sse_daily_sina` → `成交量` | 待映射 | `option_cffex_*_spot_sina` → `持仓量` | `option_hist_*` → `成交量/持仓量` |
| bid/ask | `option_sse_spot_price_sina` | 待映射 | `option_cffex_*_spot_sina` → `买价/卖价` | 待映射 |

### 3.4 `option_positions` — 用户持仓（无需改动）

### 3.5 `option_transactions` — 交易记录（无需改动）

---

## 4. Python 数据同步脚本

新增 `backend/fetch_option_data.py`，通过 `child_process` + `JSON` 与 Node.js 通信。

### 4.1 脚本架构

```
Python侧:
  fetch_option_data.py (Python)
    ├── main()           → 接收 action + params JSON
    ├── sync_all_contracts()
    ├── sync_sse_board()
    ├── sync_cffex_board()
    ├── sync_daily_close()
    ├── sync_expiry_dates()
    ├── sync_greeks()
    ├── init_backfill()
    └── sync_underlying_price()

Node.js侧:
  stock.js (已有 runPythonScript 模式)
    ├── runPythonScript(script, args)     → 复用现有函数
    └── optionSyncService.js (新增)       → 封装各同步动作
```

### 4.2 各动作定义

#### 4.2.1 `sync_all_contracts`

```
输入: { action: "sync_all_contracts" }
处理:
  1. 调用 option_contract_info_ctp() 获取全市场28182个合约
  2. 过滤出需要的交易所 (SSE/SZSE/CFFEX 为主，DCE/SHFE/CZCE/GFEX 可选)
  3. 清洗数据，格式化为标准JSON
输出:
  {
    contracts: [
      {
        exchange: "SSE",
        contract_code_ctp: "510050C2606A03000",
        contract_code_sse: "",        // SSE内部码需要从其他接口获取
        contract_name: "50ETF购6月2800",
        underlying_code: "510050",
        option_type: "call",
        strike_price: 2.800,
        expiration_date: "2026-06-24",
        contract_multiplier: 10000,
        exercise_type: 1,             // 美式
        listing_date: "2025-12-20",
        last_trade_date: "2026-06-24",
        delivery_date: "2026-06-25",
        ...其他CTP字段
      },
      ...
    ]
  }
```

> 注意: `option_contract_info_ctp()` 返回的 `合约名称` 是类 CTP 格式（如 `510050C2606A03000`），需要解析出 option_type, strike_price, expiration_date 等字段。
>
> 解析规则：
> - 上交所ETF期权: `510050C2606A03000` → 510050(标的) + C(看涨) + 2606(26年6月) + A(月份序列) + 03000(行权价×1000)
> - 中金所股指期权: `HO2605C2500` → HO(上证50股指) + 2605(26年5月) + C(看涨) + 2500(行权价)

#### 4.2.2 `sync_sse_board`

```
输入: { action: "sync_sse_board", underlying_type: "ETF", symbols: ["华夏上证50ETF期权"], months: ["2506"] }
处理:
  1. 对于每个标的+月份，调用 option_finance_board(symbol, end_month)
  2. 返回 SSE 格式的板数据
输出:
  {
    board_data: [
      {
        contract_code: "510050C2606A03000",
        current_price: 0.1750,
        change_percent: -0.79,
        prev_settle: 0.1764,
        strike_price: 2.923,
        timestamp: "2026051594539"
      }
    ]
  }
```

#### 4.2.3 `sync_cffex_board`

```
输入: { action: "sync_cffex_board", symbol: "io2606" }  // io=沪深300股指
处理:
  1. 调用 option_cffex_hs300_spot_sina("io2606") (同理 sz50_spot, zz1000_spot)
  2. 解析T型报价表，分别提取看涨/看跌合约
输出:
  {
    board_data: [
      {
        contract_id: "IO2606C3400",
        type: "call",
        strike: 3400,
        last_price: 1493.6,
        bid_price: 1465.0,
        ask_price: 1469.0,
        open_interest: 140,
        volume: 0
      },
      ...put合约
    ]
  }
```

#### 4.2.4 `sync_daily_close`

```
输入: { action: "sync_daily_close", contracts: [{code: "10011251", exchange: "SSE"}, ...] }
处理:
  1. 对上交所合约: option_sse_daily_sina("10011251") → 返回日线历史
  2. 对中金所合约: option_cffex_hs300_daily_sina("io2606C3400")
  3. 获取最新一条日线数据
输出:
  {
    daily_data: [
      {
        contract_code_sse: "10011251",
        trade_date: "2026-05-15",
        open: 0.1650,
        high: 0.1820,
        low: 0.1600,
        close: 0.1750,
        volume: 12345
      }
    ]
  }
```

#### 4.2.5 `sync_greeks`

```
输入: { action: "sync_greeks", date: "20260515" }
处理:
  1. 调用 option_risk_indicator_sse("20260515")
输出:
  {
    greeks_data: [
      {
        contract_id: "10011251",
        delta: 0.5234,
        gamma: 0.0123,
        theta: -0.0021,
        vega: 0.0034,
        rho: 0.0005,
        implied_volatility: 0.1856
      }
    ]
  }
```

#### 4.2.6 `sync_expiry_dates`

```
输入: { action: "sync_expiry_dates", underlying: "50ETF" }
处理:
  1. 调用 option_sse_list_sina("50ETF") → ["202605", "202606", "202609", "202612"]
  2. 对每个月份: option_sse_expire_day_sina("202606", "50ETF") → 获取精确到期日
  3. 中金所: option_cffex_hs300_list_sina() → {"沪深300指数": ["io2606", ...]}
输出:
  {
    expirations: [
      { underlying: "510050", month: "202606", expiry_date: "2026-06-24", days_left: 40 },
      ...
    ]
  }
```

#### 4.2.7 `init_backfill`

```
输入: { action: "init_backfill", underlying: "510050", exchange: "SSE" }
处理:
  1. 遍历 option_sse_codes_sina() 获取所有活跃合约
  2. 对每个合约调用 option_sse_daily_sina()
  3. 过滤近一年数据
输出:
  {
    prices: [
      { contract_code_sse: "10011251", trade_date: "2025-05-16", ... },
      ...
    ]
  }
```

> **注意**：全量回填速度较慢，因每个合约需要一次 HTTP 请求。采用分批并发：
> - 使用 Python `concurrent.futures.ThreadPoolExecutor(max_workers=5)`
> - 分批返回，每批100个合约的结果，Node.js 端分批写入

### 4.3 Node.js 调用封装

新建 `backend/src/services/optionSync.js`，复用 `stock.js` 的 `runPythonScript`：

```javascript
// backend/src/services/optionSync.js
const { runPythonScript } = require('./stock')
const path = require('path')
const { OptionContract, OptionPrice, OptionWhitelist } = require('../models')

const PYTHON_SCRIPT = path.join(__dirname, '../../fetch_option_data.py')

async function syncAllContracts() {
  const data = await runPythonScript(PYTHON_SCRIPT, { action: 'sync_all_contracts' })
  // 批量 upsert 到 option_contracts
  for (const c of data.contracts) {
    await OptionContract.upsert({
      contract_code: c.contract_code_sse || c.contract_code_ctp,
      exchange: c.exchange,
      contract_name: c.contract_name,
      option_type: c.option_type,
      strike_price: c.strike_price,
      expiration_date: c.expiration_date,
      // ... 其他字段
    })
  }
  return data.contracts.length
}

// ... 其他函数类似封装
```

---

## 5. 后端 Service 层重构

### 5.1 `backend/src/services/option.js` — 核心逻辑重写

```javascript
// 保留的常量
const CONTRACT_MULTIPLIER = 10000  // 中国期权合约单位（ETF期权每张10000份）
const OPTION_COMMISSION_RATE = 0.5 // 0.5‰ (保持不变)

// ============ 保留函数（作为非交易时段 fallback） ============

function calcPremium(underlyingPrice, strikePrice, optionType, daysToExpiry, volatility) {
  // 保留原有简化BSM定价模型，仅作为非交易时段的参考价
  // ... 原代码保持不变 ...
}

// ============ 重写函数 ============

async function ensureContracts(stockCode, marketType) {
  // 从 option_contracts 表检查是否有活跃的（未到期）合约
  const today = new Date().toISOString().split('T')[0]
  const count = await OptionContract.count({
    where: {
      stock_code: stockCode,
      status: 1,
      expiration_date: { [Op.gte]: today }
    }
  })
  if (count > 0) return count  // 已有合约，直接返回
  
  // 没有合约 → 调用 Python 同步
  const syncService = require('./optionSync')
  const synced = await syncService.syncContractsForStock(stockCode)
  return synced
}

async function refreshPrices(stockCode, marketType) {
  const { isTradingHours } = require('../utils/marketTime')
  
  if (isTradingHours('SSE')) {
    // 交易时段 → 调用实时板数据
    const data = await syncService.syncBoard(stockCode)
    // 写入 option_prices
    for (const p of data.board_data) {
      await OptionPrice.upsert({
        contract_id: ...,      // 通过 contract_code 查找 contract.id
        trade_date: today,
        premium: p.current_price,
        settle: p.current_price,  // 实时价暂作结算价
        bid_price: p.bid_price || 0,
        ask_price: p.ask_price || 0,
        change_percent: p.change_percent,
        underlying_price: await getUnderlyingPrice(stockCode, marketType)
      })
    }
  } else {
    // 非交易时段 → 方案B：使用最新收盘价 / fallback 模型
    const latestPrices = await OptionPrice.findAll({
      where: { trade_date: lastTradeDate },
      // ...
    })
    if (latestPrices.length > 0) {
      // 使用最新收盘价作为当前报价
      // ...
    } else {
      // 使用 calcPremium 模型估算
      // ...
    }
  }
}

async function getOptionChain(stockCode, marketType, expirationDate) {
  // 直接从 option_contracts + option_prices 查询
  // 按行权价升序排列，返回 Calls + Puts T型结构
  // 返回格式保持兼容前端现有结构
}

async function getUnderlyingPrice(stockCode, marketType) {
  // 优先从 StockPricesCache 获取
  const cache = await StockPricesCache.findOne({ where: { stock_code: stockCode, market_type: marketType } })
  if (cache) return parseFloat(cache.close_price)
  
  // 若没有缓存，调用 Python 获取 ETF 实时净值
  // option_sse_underlying_spot_price_sina("sh510050") → "最近成交价"
  const data = await runPythonScript(PYTHON_SCRIPT, {
    action: 'sync_underlying_price',
    underlying_code: stockCode,
    exchange: 'SSE'
  })
  return data.price
}

// ============ 新增函数 ============

async function autoSettleExpired() {
  // 获取当日到期的合约
  const today = new Date().toISOString().split('T')[0]
  const expiredContracts = await OptionContract.findAll({
    where: { expiration_date: today, status: 1 }
  })
  
  for (const contract of expiredContracts) {
    // 获取当日结算价
    const priceRow = await OptionPrice.findOne({
      where: { contract_id: contract.id, trade_date: today }
    })
    
    // 获取所有持仓
    const positions = await OptionPosition.findAll({
      where: { contract_id: contract.id, status: 1 }
    })
    
    for (const pos of positions) {
      const settlementAmount = calcSettlement(
        contract.option_type,
        parseFloat(contract.strike_price),
        priceRow ? parseFloat(priceRow.settle || priceRow.premium) : 0,
        pos.quantity,
        contract.contract_multiplier || 10000
      )
      
      if (settlementAmount > 0) {
        // 结算到用户余额
        await UserBalance.increment('cash', {
          by: settlementAmount,
          where: { user_id: pos.user_id, group_id: pos.group_id }
        })
        // 记录交易
        await OptionTransaction.create({ trade_type: 4, ... })
      }
      
      // 标记持仓已到期
      await OptionPosition.update({ status: 4 }, { where: { id: pos.id } })
    }
    
    // 标记合约已到期
    await OptionContract.update({ status: 2 }, { where: { id: contract.id } })
  }
}
```

### 5.2 交易时段判断工具

新增 `backend/src/utils/marketTime.js`：

```javascript
// 中国期权交易时段
const MARKET_HOURS = {
  SSE: {
    morning:  { start: '09:30', end: '11:30' },
    afternoon: { start: '13:00', end: '15:00' }
  },
  CFFEX: {
    morning:  { start: '09:30', end: '11:30' },
    afternoon: { start: '13:00', end: '15:00' }
  }
}

function isTradingHours(exchange = 'SSE') {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false  // 周末休市
  
  const time = now.getHours() * 100 + now.getMinutes()
  const session = MARKET_HOURS[exchange]
  if (!session) return false
  
  return (
    (time >= parseTime(session.morning.start) && time <= parseTime(session.morning.end)) ||
    (time >= parseTime(session.afternoon.start) && time <= parseTime(session.afternoon.end))
  )
}
```

---

## 6. 路由层改动

### 6.1 `backend/src/routes/options.js`

| API | 改动点 |
|-----|--------|
| `GET /whitelist` | 返回新增字段：`underlying_type`, `exchange`, `exercise_type` |
| `GET /expirations` | 改用 `option_contracts` 表的真实 `expiration_date`，支持按 `exchange` 过滤 |
| `GET /contracts` | T型报价增加字段：昨结算、涨跌幅、持仓量、成交量、Delta、IV |
| `POST /buy` | 移除 `toCNY()` 调用（已是CNY定价）；定价来源改为实时板或最新收盘价 |
| `POST /sell` | 同上 |
| `POST /exercise` | **新增行权规则判断**：欧式期权拒绝提前行权，美式保留 |
| `GET /positions` | 增加Greek数据显示；市值计算适配新的合约乘数(10000) |

**关键改动：买入定价流程**

```
原有流程:
  option.js.refreshPrices()  →  模拟计算 →  写入 option_prices
  
改造后流程:
  ┌─ 交易时段: syncService.syncBoard()  →  真实板价 →  upsert option_prices
  └─ 非交易时段: 读取最新 option_prices 收盘价 / fallback calcPremium()
```

**关键改动：行权判断**

```javascript
// POST /options/exercise
router.post('/exercise', auth, async (req, res) => {
  const contract = await OptionContract.findByPk(position.contract_id)
  
  // 欧式期权拒绝提前行权
  if (contract.exercise_type === 2) {  // 欧式
    return res.json({ code: -1, message: '该期权为欧式行权，到期自动结算，不支持提前行权' })
  }
  
  // 美式期权：和现有逻辑一致
  // ...
})
```

### 6.2 `backend/src/routes/admin.js`

| API | 改动点 |
|-----|--------|
| `POST /options/whitelist` | 新增参数: `underlying_type`, `exchange`, `exercise_type`, `contract_multiplier` |
| `POST /options/contracts/generate` | 改为调用 `optionSync.syncContractsForStock()`，不再模拟生成 |
| `POST /options/settlement` | 保持手动触发，但内部调用 `autoSettleExpired()` 服务 |
| **新增** `POST /options/sync` | 手动触发全量同步 `{ action: "all" / "contracts" / "prices" }` |
| **新增** `POST /options/sync/sse-board` | 手动刷新上交所期权实时板 |

---

## 7. 调度器（自动任务）

新增 `backend/src/scheduler/optionScheduler.js`

### 7.1 任务时间表

| 时间 | 任务 | AKShare接口 | 超时控制 |
|------|------|-------------|---------|
| 08:50 | 同步全量合约列表 | `option_contract_info_ctp()` | 120s |
| 08:55 | 同步到期日历 | `option_sse_list_sina()` + `option_cffex_*_list_sina()` | 60s |
| 09:00 | 清理已过期合约 | 数据库更新 status | 30s |
| 09:30-11:30 | 每5分钟同步实时板（上交所） | `option_finance_board()` | 30s |
| 13:00-15:00 | 每5分钟同步实时板（上交所+中金所） | `option_finance_board()` + `option_cffex_*_spot_sina()` | 60s |
| 15:05 | 同步日线收盘数据 | `option_sse_daily_sina()` + `option_cffex_*_daily_sina()` | 300s |
| 15:06 | 同步Greeks | `option_risk_indicator_sse()` | 120s |
| 15:10 | 自动到期结算 | `autoSettleExpired()` | 120s |

### 7.2 代码结构

```javascript
// backend/src/scheduler/optionScheduler.js
const cron = require('node-cron')
const optionSync = require('../services/optionSync')
const optionService = require('../services/option')

function startOptionScheduler() {
  // 每天08:50 同步合约
  cron.schedule('50 8 * * 1-5', async () => {
    console.log('[OptionScheduler] 开始同步合约...')
    try {
      const count = await optionSync.syncAllContracts()
      console.log(`[OptionScheduler] 同步完成: ${count} 个合约`)
    } catch (e) {
      console.error('[OptionScheduler] 合约同步失败:', e.message)
    }
  })
  
  // 交易时段每5分钟 同步实时价（上交所）
  cron.schedule('*/5 9,10,11,13,14 * * 1-5', async () => {
    // 判断是否在交易时段内
    // 调用 optionSync.syncAllBoards()
  })
  
  // 每天15:10 自动结算
  cron.schedule('10 15 * * 1-5', async () => {
    console.log('[OptionScheduler] 开始到期结算...')
    try {
      const result = await optionService.autoSettleExpired()
      console.log(`[OptionScheduler] 结算完成: ${result.settled} 笔`)
    } catch (e) {
      console.error('[OptionScheduler] 结算失败:', e.message)
    }
  })
}

// 仅在启用调度器时执行
if (process.env.ENABLE_OPTION_SCHEDULER !== 'false') {
  startOptionScheduler()
}

module.exports = { startOptionScheduler }
```

在 `backend/src/index.js` 引入：

```javascript
// 在文件末尾
if (process.env.ENABLE_OPTION_SCHEDULER !== 'false') {
  try {
    require('./scheduler/optionScheduler')
    console.log('期权数据调度器已启动')
  } catch (e) {
    console.log('期权调度器启动失败:', e.message)
  }
}
```

---

## 8. 前端改动

### 8.1 `frontend/src/api/options.js`

```javascript
// 新增接口
export function syncOptionData(action) {
  return request.post('/admin/options/sync', { action })
}

export function getOptionWhitelist() {
  return request.get('/options/whitelist')
  // 返回字段增加: underlying_type, exchange, exercise_type
}

export function getOptionContractsV2({ stock_code, market_type, expiration, exchange }) {
  return request.get('/options/contracts', {
    params: { stock_code, market_type, expiration, exchange }
  })
  // 返回字段增加: prevSettle, changePercent, openInterest, volume, delta, iv, bidPrice, askPrice
}
```

### 8.2 `frontend/src/views/Options.vue`

**标的选择器改动**：从 whitelist 读取预置的中国 ETF/指数列表，去掉原有美股港股搜索

```javascript
// 白名单数据格式
whitelist: [
  { stock_code: '510050', stock_name: '华夏上证50ETF', underlying_type: 1, exchange: 'SSE', exercise_type: 1 },
  { stock_code: '510300', stock_name: '华泰柏瑞沪深300ETF', underlying_type: 1, exchange: 'SSE', exercise_type: 1 },
  { stock_code: '000300', stock_name: '沪深300股指期权', underlying_type: 2, exchange: 'CFFEX', exercise_type: 2 },
  // ...
]
```

**T型报价表改动**：

```html
<!-- 当前列: 合约代码 | 行权价 | Call权利金 | ... -->
<!-- 改造后增加列: 昨结算 | 涨跌幅 | 持仓量 | 成交量 | Delta | 隐含波动率 -->

<!-- 交易时段标记 -->
<span v-if="isTradingHours" class="badge badge-success">实时价</span>
<span v-else class="badge badge-warning">参考价（非交易时段）</span>
```

**行权按钮逻辑**：

```html
<el-button 
  v-if="contract.exercise_type === 1"  <!-- 美式 -->
  @click="exerciseOption(position)" 
  :disabled="!isItm(position)">
  行权
</el-button>
<el-tooltip v-else content="欧式期权，到期自动结算">
  <el-button disabled>行权</el-button>
</el-tooltip>
```

### 8.3 `frontend/src/views/admin/Admin.vue`

**白名单管理**：新增交易所、标的类型、行权方式下拉框

**合约管理**：增加按交易所筛选，显示真实合约代码、合约简称、上市日、最后交易日等

**新增同步面板**：

```html
<el-card>
  <div slot="header">数据同步</div>
  <el-button @click="syncData('all')">全量同步</el-button>
  <el-button @click="syncData('contracts')">同步合约</el-button>
  <el-button @click="syncData('prices')">同步行情</el-button>
  <el-button @click="syncData('greeks')">同步Greeks</el-button>
  <el-progress v-if="syncing" :percentage="syncProgress"></el-progress>
</el-card>
```

---

## 9. 非交易时段定价方案（方案B）

### 9.1 定价优先级

```
getCurrentPrice(contract) {
  1. 查 option_prices 是否有当天的实时板数据（trade_date = today）
     → 如果是且数据是15分钟内更新的 → 直接返回
     
  2. 查 option_prices 最新的收盘价数据
     → 如果是当天收盘价（trade_date = today 且 settle > 0）
     → 返回 settle 作为参考价
     
  3. 查 option_prices 最近一个交易日的收盘价
     → 返回该收盘价
     
  4. 所有数据库数据都不可用
     → 调用 calcPremium() 用模型估算
     → 标记为"模型估算价"
}
```

### 9.2 前端标记

在 T 型报价表中，每行价格旁显示状态标记：

| 状态 | 显示 | 说明 |
|------|------|------|
| 交易时段实时价 | 🟢 实时 | 5分钟内从交易所获取 |
| 当日收盘参考价 | 🟡 收盘 | 当日15:00收盘价 |
| 前日收盘参考价 | 🟠 前收 | 最近交易日收盘价 |
| 模型估算价 | 🔴 估算 | 非交易时段模型估算 |

---

## 10. 初始数据回填

### 10.1 回填流程

```
第一步: sync_all_contracts → 下载所有合约列表，写入 option_contracts
第二步: init_backfill → 遍历活跃合约，下载近一年日线
第三步: 验证数据完整性

分批策略:
  每批处理 10 个合约
  每批间 sleep(2s) 避免触发反爬
  预计总耗时: ~20分钟（约200个活跃SSE合约）
```

### 10.2 触发方式

首次部署时，通过管理后台点击"初始数据回填"按钮，或在服务器直接执行：

```bash
node -e "
  const s = require('./src/services/optionSync');
  s.initBackfill().then(r => console.log('完成:', r));
"
```

---

## 11. 注意事项与风险

### 11.1 AKShare 限制

| 风险 | 说明 | 缓解措施 |
|------|------|---------|
| **请求频率限制** | AKShare 底层依赖新浪/东方财富公开API，可能触发反爬 | 每次请求间隔 ≥1s，批量时控制并发数 ≤5 |
| **数据源不稳定** | 新浪API偶有超时或返回空数据 | 重试机制（最多3次），降级到前日数据 |
| **非交易时段不可用** | `option_finance_board` 在非交易时段返回空或旧数据 | 方案B：使用最新收盘价或模型估算 |
| **接口变更** | 目标网页改版可能导致接口失效 | 监控 AKShare 版本更新，及时升级 |

### 11.2 合约代码映射

AKShare 不同接口使用不同的合约代码格式，需要在 Python 脚本中进行映射：

```
场景1: option_contract_info_ctp() → 合约ID = "510050C2606A03000"
场景2: option_sse_codes_sina()  → 期权代码 = "10011251" (上交所内部码)
场景3: option_finance_board()   → 合约交易代码 = "510050C2606A03000"
场景4: option_sse_daily_sina()  → 参数 symbol = "10011251"
场景5: option_sse_greeks_sina() → 参数 symbol = "10011251"

映射关系:
  "10011251" (SSE内部码) ↔ "510050C2606A03000" (CTP交易码)
  
  建立映射表的方式:
    从 option_sse_codes_sina() 获取 "10011251"  
    拼接生成对应的 "510050C2606A03000"
    两者都存入 option_contracts 表
```

### 11.3 合约乘数

| 品种 | 合约乘数 | 说明 |
|------|---------|------|
| 上交所ETF期权 | 10,000份/张 | 每张合约对应10000份ETF份额 |
| 深交所ETF期权 | 10,000份/张 | 同上 |
| 中金所股指期权 | 每点100元 | 沪深300/上证50/中证1000 |
| 商品期权 | 各异 | 如豆粕10吨/手，铜5吨/手 |

> 现有数据库 `contract_multiplier` 字段默认为100（美股规则），需修改为10000（中国ETF规则）。

### 11.4 数据库兼容

所有 DDL 改动采用 `ALTER TABLE ADD COLUMN`，向下兼容。现有数据不受影响，旧的美股期权合约数据状态保持不变（到期的不会再被处理）。

---

## 12. 实施步骤

| 步骤 | 内容 | 预估值 |
|------|------|--------|
| **P0** | 编写 `migration-option-akshare.sql` 并执行 | 0.5h |
| **P1** | 编写 `fetch_option_data.py`（sync_all_contracts + init_backfill） | 3h |
| **P2** | 测试 Python 脚本数据获取 + JSON 输出验证 | 1h |
| **P3** | 编写 `optionSync.js` Node.js 同步服务层 | 2h |
| **P4** | 重构 `option.js` 服务层（ensureContracts, refreshPrices, getOptionChain） | 3h |
| **P5** | 编写 `marketTime.js` 交易时段工具 + `optionScheduler.js` 调度器 | 1.5h |
| **P6** | 修改 `routes/options.js` 路由（适配参数、行权规则、定价来源） | 1.5h |
| **P7** | 修改 `routes/admin.js` 路由（白名单管理、新增同步接口） | 1h |
| **P8** | 修改 `api/options.js` + `admin.js` 前端API | 0.5h |
| **P9** | 修改 `views/Options.vue`（标的替换、T型报价增加列、行权按钮逻辑、交易时段标记） | 3h |
| **P10** | 修改 `views/admin/Admin.vue`（白名单管理、同步面板） | 1.5h |
| **P11** | 初始数据回填 + 集成测试 | 2h |
| | **总计** | **~20.5h** |
