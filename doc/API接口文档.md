# 虚拟炒股平台 - API接口文档

## 版本历史
| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-04-24 | 初始版本 |
| v1.1 | 2026-04-26 | 拆分管理员API、独立后台登录、用户管理、股市设置、统计接口 |

---

## 1. 接口概览

### 1.1 基础信息
- **基础URL**: `/api/v1`
- **数据格式**: JSON
- **编码**: UTF-8
- **认证方式**: Bearer Token (JWT)

### 1.2 通用响应格式
```
成功响应:
{
  "code": 0,
  "message": "success",
  "data": {}
}

失败响应:
{
  "code": -1,
  "message": "错误信息",
  "data": null
}
```

### 1.3 HTTP状态码
| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 |
| 403 | 禁止访问 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

---

## 2. 用户模块

### 2.1 用户注册
**接口**: `POST /users/register`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名(4-20字符) |
| password | string | 是 | 密码(6-20字符) |
| nickname | string | 否 | 昵称 |
| invite_code | string | 是 | 邀请码 |

**请求示例**:
```json
{
  "username": "user001",
  "password": "123456",
  "nickname": "张三",
  "invite_code": "GROUP2024"
}
```

**响应示例**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "userId": 1,
    "username": "user001",
    "nickname": "张三"
  }
}
```

---

### 2.2 用户登录
**接口**: `POST /users/login`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| token | string | JWT令牌 |
| userId | int | 用户ID |
| username | string | 用户名 |
| nickname | string | 昵称 |

---

### 2.3 获取用户信息
**接口**: `GET /users/info`

**认证**: 需要

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | int | 用户ID |
| username | string | 用户名 |
| nickname | string | 昵称 |
| email | string | 邮箱 |
| phone | string | 手机号 |
| status | int | 状态 |
| createdAt | string | 创建时间 |

---

### 2.4 更新用户信息
**接口**: `PUT /users/info`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| nickname | string | 否 | 昵称 |
| email | string | 否 | 邮箱 |
| phone | string | 否 | 手机号 |

---

## 3. 群组模块

### 3.1 获取群组列表
**接口**: `GET /groups`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码(默认1) |
| pageSize | int | 每页数量(默认10) |
| status | int | 状态筛选 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | 群组ID |
| name | string | 群组名称 |
| description | string | 描述 |
| initCash | decimal | 初始化资金 |
| memberCount | int | 成员数量 |
| status | int | 状态 |
| createdAt | string | 创建时间 |

---

### 3.2 获取群组详情
**接口**: `GET /groups/:groupId`

**认证**: 需要

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | 群组ID |
| name | string | 群组名称 |
| description | string | 描述 |
| initCash | decimal | 初始化资金 |
| currency | string | 币种 |
| memberCount | int | 成员数量 |
| status | int | 状态 |
| createdAt | string | 创建时间 |

---

### 3.3 加入群组
**接口**: `POST /groups/join`

**认证**: 需要

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | 关联ID |
| userId | int | 用户ID |
| groupId | int | 群组ID |
| joinedAt | string | 加入时间 |

---

### 3.4 退出群组
**接口**: `POST /groups/leave`

**认证**: 需要

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |

---

### 3.5 获取群组成员排名
**接口**: `GET /groups/:groupId/ranking`

**认证**: 需要

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | int | 用户ID |
| nickname | string | 昵称 |
| cash | decimal | 当前现金 |
| totalAssets | decimal | 总资产 |
| profit | decimal | 收益金额 |
| profitRate | decimal | 收益率 |
| rank | int | 排名 |

---

### 3.6 获取用户加入的群组
**接口**: `GET /groups/my`

**认证**: 需要

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| groupId | int | 群组ID |
| groupName | string | 群组名称 |
| cash | decimal | 当前现金 |
| totalAssets | decimal | 总资产 |
| profit | decimal | 收益金额 |
| profitRate | decimal | 收益率 |

---

## 4. 股票模块

### 4.1 获取股票池列表
**接口**: `GET /stocks`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| market_type | int | 市场类型(1A股 2港股 3美股) |
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词搜索 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | ID |
| stockCode | string | 股票代码 |
| stockName | string | 股票名称 |
| marketType | int | 市场类型 |
| status | int | 状态 |

---

### 4.2 获取股票行情
**接口**: `GET /stocks/:stockCode/quote`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| market_type | int | 是 | 市场类型 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| stockCode | string | 股票代码 |
| stockName | string | 股票名称 |
| marketType | int | 市场类型 |
| tradeDate | string | 交易日期 |
| closePrice | decimal | 收盘价 |
| prevClose | decimal | 昨收价 |
| changePercent | decimal | 涨跌幅 |

---

### 4.3 获取历史行情
**接口**: `GET /stocks/:stockCode/history`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| market_type | int | 是 | 市场类型 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| tradeDate | string | 交易日期 |
| openPrice | decimal | 开盘价 |
| highPrice | decimal | 最高价 |
| lowPrice | decimal | 最低价 |
| closePrice | decimal | 收盘价 |
| volume | long | 成交量 |

---

### 4.4 批量获取股票行情
**接口**: `POST /stocks/quotes`

**认证**: 需要

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| stocks | array | 是 | 股票列表 |

**请求示例**:
```json
{
  "stocks": [
    {"stock_code": "600519", "market_type": 1},
    {"stock_code": "00700", "market_type": 2},
    {"stock_code": "AAPL", "market_type": 3}
  ]
}
```

---

## 5. 交易模块

### 5.1 买入股票
**接口**: `POST /trade/buy`

**认证**: 需要

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| stock_code | string | 是 | 股票代码 |
| market_type | int | 是 | 市场类型 |
| shares | int | 是 | 数量 |

**业务规则**:
- 每天只能交易一次
- 基于昨日收盘价成交
- 检查余额是否充足（含佣金）
- 佣金从账户余额中扣除

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| tradeId | long | 交易ID |
| userId | int | 用户ID |
| stockCode | string | 股票代码 |
| stockName | string | 股票名称 |
| price | decimal | 成交价格 |
| priceInCNY | decimal | 成交价格(CNY) |
| shares | int | 成交数量 |
| amount | decimal | 成交金额(CNY) |
| commission | decimal | 佣金金额(CNY) |
| commissionRate | decimal | 佣金费率 |
| totalDeduct | decimal | 实际扣款(CNY) |
| tradeDate | string | 交易日期 |
| status | int | 状态 |

---

### 5.2 卖出股票
**接口**: `POST /trade/sell`

**认证**: 需要

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |
| stock_code | string | 是 | 股票代码 |
| market_type | int | 是 | 市场类型 |
| shares | int | 是 | 数量 |

**响应参数**: 同买入

---

### 5.3 获取持仓列表
**接口**: `GET /positions`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | long | ID |
| stockCode | string | 股票代码 |
| stockName | string | 股票名称 |
| marketType | int | 市场类型 |
| shares | int | 持股数量 |
| avgCost | decimal | 平均成本 |
| totalCost | decimal | 总成本 |
| currentPrice | decimal | 当前价 |
| marketValue | decimal | 市值 |
| profit | decimal | 盈亏 |
| profitRate | decimal | 盈亏率 |

---

### 5.4 获取资金状况
**接口**: `GET /balance`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| cash | decimal | 可用现金 |
| frozenCash | decimal | 冻结资金 |
| totalCost | decimal | 已投入成本 |
| totalAssets | decimal | 总资产 |
| profit | decimal | 收益金额 |
| profitRate | decimal | 收益率 |

---

### 5.5 获取交易记录
**接口**: `GET /transactions`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| stock_code | string | 否 | 股票代码筛选 |
| start_date | string | 否 | 开始日期 (默认最近3周) |
| end_date | string | 否 | 结束日期 |
| trade_type | int | 否 | 交易类型(1买入 2卖出) |
| page | int | 否 | 页码(默认1) |
| pageSize | int | 否 | 每页数量(默认50) |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| balance | decimal | 账户余额(RMB) |
| totalCost | decimal | 累计投入(RMB) |
| total | int | 总记录数 |
| list[] | array | 交易记录列表 |
| list[].id | long | 交易ID |
| list[].stockCode | string | 股票代码 |
| list[].stockName | string | 股票名称 |
| list[].marketType | int | 市场类型(1A股 2港股 3美股) |
| list[].currency | string | 货币类型(RMB/HKD/USD) |
| list[].tradeType | int | 交易类型(1买入 2卖出) |
| list[].price | decimal | 成交价格(本币) |
| list[].priceCNY | decimal | 成交价格(CNY) |
| list[].shares | int | 成交数量 |
| list[].amount | decimal | 成交金额(本币) |
| list[].amountCNY | decimal | 成交金额(CNY) |
| list[].commission | decimal | 佣金金额(CNY) |
| list[].commissionRate | decimal | 佣金费率 |
| list[].balanceAfter | decimal | 交易后余额(CNY) |
| list[].tradeDate | string | 交易日期 |
| list[].status | int | 状态 |

---

## 6. 统计模块

### 6.1 个人收益统计
**接口**: `GET /statistics/profit`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |
| period | string | 否 | 统计周期(day/week/month) |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| period | string | 周期 |
| startDate | string | 开始日期 |
| endDate | string | 结束日期 |
| profit | decimal | 收益金额 |
| profitRate | decimal | 收益率 |
| tradeCount | int | 交易次数 |

---

### 6.2 持仓统计
**接口**: `GET /statistics/positions`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| totalMarketValue | decimal | 总市值 |
| totalProfit | decimal | 总盈亏 |
| profitRate | decimal | 盈亏率 |
| positionCount | int | 持仓数量 |

---

### 6.3 交易统计
**接口**: `GET /statistics/trades`

**认证**: 需要

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| totalTrades | int | 总交易次数 |
| buyTrades | int | 买入次数 |
| sellTrades | int | 卖出次数 |
| totalAmount | decimal | 总成交金额 |

---

## 7. 群组内用户公开信息

### 7.1 查看群组成员交易行为
**接口**: `GET /group/:groupId/users/:userId/trades`

**认证**: 需要（群组成员）

**查询参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| userId | int | 用户ID |
| nickname | string | 昵称 |
| stockCode | string | 股票代码 |
| stockName | string | 股票名称 |
| tradeType | int | 交易类型 |
| shares | int | 数量 |
| price | decimal | 价格 |
| tradeDate | string | 交易日期 |

---

### 7.2 群组成员资金排名
**接口**: `GET /group/:groupId/ranking`

**认证**: 需要（群组成员）

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| rank | int | 排名 |
| userId | int | 用户ID |
| nickname | string | 昵称 |
| totalAssets | decimal | 总资产 |
| profit | decimal | 收益 |
| profitRate | decimal | 收益率 |

---

## 8. 后台管理模块

### 8.1 管理员登录
**接口**: `POST /admin/login`

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |

---

### 8.2 群组管理

#### 8.2.1 创建群组
**接口**: `POST /admin/groups`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 群组名称 |
| description | string | 否 | 描述 |
| init_cash | decimal | 是 | 初始化资金 |
| currency | string | 否 | 币种(默认USD) |

---

#### 8.2.2 更新群组
**接口**: `PUT /admin/groups/:groupId`

**认证**: 管理员

#### 8.2.3 删除群组
**接口**: `DELETE /admin/groups/:groupId`

**认证**: 管理员

#### 8.2.4 获取群组成员列表
**接口**: `GET /admin/groups/:groupId/members`

**认证**: 管理员

---

### 8.3 用户管理

#### 8.3.1 用户列表
**接口**: `GET /admin/users`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词 |
| status | int | 状态 |

---

#### 8.3.2 禁用/启用用户
**接口**: `PUT /admin/users/:userId/status`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | int | 是 | 状态(0禁用 1正常) |

---

#### 8.3.3 删除用户
**接口**: `DELETE /admin/users/:userId`

**认证**: 管理员

---

### 8.4 股票池管理

#### 8.4.1 添加股票到股票池
**接口**: `POST /admin/stocks`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| stock_code | string | 是 | 股票代码 |
| stock_name | string | 是 | 股票名称 |
| market_type | int | 是 | 市场类型 |

---

#### 8.4.2 删除股票
**接口**: `DELETE /admin/stocks/:stockId`

**认证**: 管理员

---

#### 8.4.3 更新股票状态
**接口**: `PUT /admin/stocks/:stockId/status`

**认证**: 管理员

---

### 8.5 邀请码管理

#### 8.5.1 生成邀请码
**接口**: `POST /admin/invite-codes`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| group_id | int | 是 | 群组ID |
| expire_days | int | 否 | 过期天数 |
| use_limit | int | 否 | 使用次数限制 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| inviteCode | string | 邀请码 |
| groupId | int | 群组ID |
| expireDate | string | 过期日期 |
| useLimit | int | 使用次数限制 |
| usedCount | int | 已使用次数 |

---

#### 8.5.2 邀请码列表
**接口**: `GET /admin/invite-codes`

**认证**: 管理员

---

### 8.6 系统配置

#### 8.6.1 获取配置
**接口**: `GET /admin/configs`

**认证**: 管理员

#### 8.6.2 更新配置
**接口**: `PUT /admin/configs/:key`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| config_value | string | 是 | 配置值 |

---

### 8.7 佣金配置

#### 8.7.1 获取佣金配置列表
**接口**: `GET /admin/commission-configs`

**认证**: 管理员

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | 配置ID |
| market_type | int | 市场类型(1A股 2港股 3美股) |
| trade_type | int | 交易类型(1买入 2卖出) |
| commission_rate | decimal | 佣金比例 |
| updated_at | string | 更新时间 |

---

#### 8.7.2 更新佣金配置
**接口**: `PUT /admin/commission-configs/:id`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| commission_rate | decimal | 是 | 佣金比例 |
| remark | string | 否 | 修改备注 |

#### 8.7.3 佣金修改历史
**接口**: `GET /admin/commission-history`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| market_type | int | 否 | 市场类型 |
| trade_type | int | 否 | 交易类型 |
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | ID |
| market_type | int | 市场类型 |
| trade_type | int | 交易类型 |
| old_rate | decimal | 原比例 |
| new_rate | decimal | 新比例 |
| changed_by | int | 操作用户ID |
| changed_at | string | 修改时间 |
| remark | string | 备注 |

---

### 8.8 用户管理

#### 8.8.1 用户列表（含持仓/资金）
**接口**: `GET /admin/users`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | int | 否 | 页码(默认1) |
| pageSize | int | 否 | 每页数量(默认10) |
| keyword | string | 否 | 用户名关键词 |
| group_id | int | 否 | 群组ID筛选 |
| status | int | 否 | 状态筛选(0禁用 1正常) |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | 用户ID |
| username | string | 用户名 |
| nickname | string | 昵称 |
| status | int | 状态 |
| trade_enabled | int | 交易权限(0禁止 1允许) |
| admin_access | int | 后台权限(0否 1是) |
| groups | array | 所属群组列表 |
| cash | decimal | 可用资金 |
| total_cost | decimal | 已投入成本 |
| positions_value | decimal | 持仓市值 |
| floating_profit | decimal | 浮盈亏 |
| realized_profit | decimal | 已实现收益 |
| last_trade_date | string | 最后交易日期 |
| created_at | string | 注册时间 |

---

#### 8.8.2 用户详情
**接口**: `GET /admin/users/:userId/detail`

**认证**: 管理员

**响应参数**: 包含用户基本信息、资金、持仓、累计收益

---

#### 8.8.3 设置交易权限
**接口**: `PUT /admin/users/:userId/trade-enabled`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| trade_enabled | int | 是 | 交易权限(0禁止 1允许) |

---

#### 8.8.4 设置后台权限
**接口**: `PUT /admin/users/:userId/admin-access`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| admin_access | int | 是 | 后台权限(0否 1是) |

---

#### 8.8.5 用户登录历史
**接口**: `GET /admin/users/:userId/login-history`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| start_date | string | 否 | 开始日期(YYYY-MM-DD) |
| end_date | string | 否 | 结束日期(YYYY-MM-DD) |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| login_time | string | 登录时间 |
| ip_address | string | IP地址 |
| user_agent | string | 浏览器 |

---

#### 8.8.6 用户交易记录
**接口**: `GET /admin/users/:userId/transactions`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |
| stock_code | string | 否 | 股票代码 |
| page | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |

---

#### 8.8.7 禁/启用用户
**接口**: `PUT /admin/users/:userId/status`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| status | int | 是 | 状态(0禁用 1正常) |

---

#### 8.8.8 删除用户
**接口**: `DELETE /admin/users/:userId`

**认证**: 管理员

**说明**: 会级联删除该用户的持仓、资金、交易记录

---

### 8.9 群组管理

#### 8.9.1 群组列表
**接口**: `GET /admin/groups`

**认证**: 管理员

---

#### 8.9.2 群组成员
**接口**: `GET /admin/groups/:groupId/users`

**认证**: 管理员

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| user_id | int | 用户ID |
| username | string | 用户名 |
| nickname | string | 昵称 |
| cash | decimal | 资金 |
| total_assets | decimal | 总资产 |
| profit | decimal | 收益 |

---

#### 8.9.3 创建群组
**接口**: `POST /admin/groups`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| name | string | 是 | 群组名称 |
| description | string | 否 | 描述 |
| init_cash | decimal | 是 | 初始化资金 |

---

#### 8.9.4 更新群组
**接口**: `PUT /admin/groups/:groupId`

**认证**: 管理员

---

#### 8.9.5 删除群组
**接口**: `DELETE /admin/groups/:groupId`

**认证**: 管理员

---

### 8.10 股市设置

#### 8.10.1 手动刷新行情数据
**接口**: `POST /admin/stocks/refresh`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| market_type | int | 否 | 市场类型(1A股 2港股 3美股) |

---

#### 8.10.2 查看缺失数据
**接口**: `GET /admin/stocks/missing`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| market_type | int | 否 | 市场类型 |
| date | string | 否 | 日期(YYYY-MM-DD) |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| stock_code | string | 股票代码 |
| stock_name | string | 股票名称 |
| market_type | int | 市场类型 |
| trade_date | string | 交易日期 |
| status | string | 缺失/过期 |

---

#### 8.10.3 获取市场配置
**接口**: `GET /admin/market-config`

**认证**: 管理员

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| id | int | 配置ID |
| market_type | int | 市场类型 |
| refresh_time | string | 刷新时间 |
| trade_start | string | 交易开始 |
| trade_end | string | 交易结束 |
| enabled | int | 是否启用 |

---

#### 8.10.4 更新市场配置
**接口**: `PUT /admin/market-config/:id`

**认证**: 管理员

**请求参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| refresh_time | string | 否 | 刷新时间(HH:mm) |
| trade_start | string | 否 | 交易开始 |
| trade_end | string | 否 | 交易结束 |
| enabled | int | 否 | 是否启用 |

---

### 8.11 统计中心

#### 8.11.1 群组收益统计
**接口**: `GET /admin/statistics/groups`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |
| period | string | 否 | 周期(week/month/custom) |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| group_id | int | 群组ID |
| group_name | string | 群组名称 |
| init_cash | decimal | 初始资金 |
| total_assets | decimal | 总资产 |
| profit | decimal | 收益 |
| profit_rate | decimal | 收益率 |
| rank | int | 排名 |

---

#### 8.11.2 用户活跃度统计
**接口**: `GET /admin/statistics/users`

**认证**: 管理员

**查询参数**:
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| start_date | string | 否 | 开始日期 |
| end_date | string | 否 | 结束日期 |
| sort | string | 否 | 排序字段(trade_count/login_count) |

**响应参数**:
| 参数名 | 类型 | 说明 |
|--------|------|------|
| user_id | int | 用户ID |
| username | string | 用户名 |
| trade_count | int | 交易次数 |
| login_count | int | 登录次数 |
| total_profit | decimal | 总收益 |

---

## 9. 错误码说明

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| -1 | 通用错误 |
| 1001 | 用户名已存在 |
| 1002 | 用户不存在 |
| 1003 | 密码错误 |
| 1004 | 用户被禁用 |
| 1005 | 邀请码无效 |
| 1006 | 邀请码已过期 |
| 1007 | 邀请码已使用完毕 |
| 2001 | 群组不存在 |
| 2002 | 群组已禁用 |
| 2003 | 已在群组中 |
| 2004 | 不在群组中 |
| 3001 | 股票不存在 |
| 3002 | 股票已禁用 |
| 3003 | 超出股票池数量限制 |
| 4001 | 余额不足 |
| 4002 | 持仓不足 |
| 4003 | 今日已交易 |
| 4004 | 非交易时间 |
| 5001 | 管理员不存在 |
| 5002 | 管理员权限不足 |

---

## 10. 接口前缀说明

| 前缀 | ���明 | 认证 |
|------|------|------|
| /api/v1/users/* | 用户模块 | 部分需要 |
| /api/v1/groups/* | 群组模块 | 需要 |
| /api/v1/stocks/* | 股票模块 | 需要 |
| /api/v1/trade/* | 交易模块 | 需要 |
| /api/v1/statistics/* | 统计模块 | 需要 |
| /api/v1/admin/* | 后台管理 | 管理员 |