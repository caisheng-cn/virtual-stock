-- 虚拟期权交易功能 - 数据库迁移
-- 日期: 2026-05-13
-- 说明: 新增 5 张期权相关表

-- ============================================
-- 1. option_whitelist - 期权标的白名单
-- ============================================
CREATE TABLE IF NOT EXISTS option_whitelist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_code VARCHAR(20) NOT NULL COMMENT '股票代码',
  market_type TINYINT NOT NULL COMMENT '市场类型 1=A股 2=港股 3=美股',
  stock_name VARCHAR(100) NOT NULL COMMENT '股票名称',
  status TINYINT DEFAULT 1 COMMENT '状态 1=启用 0=停用',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_market (stock_code, market_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权标的白名单';

-- ============================================
-- 2. option_contracts - 期权合约
-- ============================================
CREATE TABLE IF NOT EXISTS option_contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_code VARCHAR(20) NOT NULL COMMENT '标的股票代码',
  market_type TINYINT NOT NULL COMMENT '市场类型',
  stock_name VARCHAR(100) NOT NULL COMMENT '标的股票名称',
  option_type ENUM('call', 'put') NOT NULL COMMENT '期权类型',
  strike_price DECIMAL(12,2) NOT NULL COMMENT '行权价',
  expiration_date DATE NOT NULL COMMENT '到期日',
  contract_code VARCHAR(50) NOT NULL COMMENT '合约代码',
  contract_multiplier INT DEFAULT 100 COMMENT '合约乘数',
  status TINYINT DEFAULT 1 COMMENT '状态 1=交易中 2=已到期 3=已下架',
  underlying_price DECIMAL(12,2) DEFAULT 0 COMMENT '生成时的标的价',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_contract_code (contract_code),
  INDEX idx_stock_expiry (stock_code, expiration_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权合约';

-- ============================================
-- 3. option_positions - 用户期权持仓
-- ============================================
CREATE TABLE IF NOT EXISTS option_positions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  group_id INT NOT NULL COMMENT '群组ID',
  contract_id INT NOT NULL COMMENT '合约ID',
  quantity INT NOT NULL DEFAULT 0 COMMENT '持仓张数',
  avg_cost DECIMAL(12,4) NOT NULL DEFAULT 0 COMMENT '平均成本（每张权利金）',
  total_cost DECIMAL(14,2) NOT NULL DEFAULT 0 COMMENT '总成本（含手续费）',
  status TINYINT DEFAULT 1 COMMENT '状态 1=持仓中 2=已平仓 3=已行权 4=已到期',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_group_contract (user_id, group_id, contract_id),
  INDEX idx_user_group (user_id, group_id),
  INDEX idx_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户期权持仓';

-- ============================================
-- 4. option_transactions - 期权交易记录
-- ============================================
CREATE TABLE IF NOT EXISTS option_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  group_id INT NOT NULL COMMENT '群组ID',
  contract_id INT NOT NULL COMMENT '合约ID',
  stock_code VARCHAR(20) NOT NULL COMMENT '标的代码',
  stock_name VARCHAR(100) NOT NULL COMMENT '标的名称',
  option_type ENUM('call', 'put') NOT NULL COMMENT '期权类型',
  strike_price DECIMAL(12,2) NOT NULL COMMENT '行权价',
  expiration_date DATE NOT NULL COMMENT '到期日',
  trade_type TINYINT NOT NULL COMMENT '交易类型 1=买入开仓 2=卖出平仓 3=行权 4=到期结算',
  quantity INT NOT NULL COMMENT '张数',
  price DECIMAL(12,4) NOT NULL COMMENT '成交价（每张权利金）',
  premium DECIMAL(14,2) NOT NULL COMMENT '权利金总额',
  commission DECIMAL(12,2) DEFAULT 0 COMMENT '手续费',
  commission_rate DECIMAL(6,4) DEFAULT 0 COMMENT '手续费率',
  profit DECIMAL(14,2) DEFAULT 0 COMMENT '盈亏',
  balance_after DECIMAL(14,2) DEFAULT 0 COMMENT '交易后现金余额',
  trade_date DATE NOT NULL COMMENT '交易日期',
  settlement_amount DECIMAL(14,2) DEFAULT 0 COMMENT '结算金额',
  status TINYINT DEFAULT 1 COMMENT '状态 1=正常',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_group (user_id, group_id),
  INDEX idx_trade_date (trade_date),
  INDEX idx_contract (contract_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权交易记录';

-- ============================================
-- 5. option_prices - 期权每日行情
-- ============================================
CREATE TABLE IF NOT EXISTS option_prices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contract_id INT NOT NULL COMMENT '合约ID',
  trade_date DATE NOT NULL COMMENT '日期',
  premium DECIMAL(12,4) NOT NULL COMMENT '权利金',
  intrinsic_value DECIMAL(12,4) DEFAULT 0 COMMENT '内在价值',
  time_value DECIMAL(12,4) DEFAULT 0 COMMENT '时间价值',
  delta DECIMAL(6,4) DEFAULT 0 COMMENT 'Delta',
  implied_volatility DECIMAL(6,4) DEFAULT 0 COMMENT '隐含波动率',
  underlying_price DECIMAL(12,2) NOT NULL COMMENT '当日标的收盘价',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_contract_date (contract_id, trade_date),
  INDEX idx_trade_date (trade_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权每日行情';

-- ============================================
-- 6. 扩展 group_messages 表 - 增加期权字段
-- ============================================
ALTER TABLE group_messages
  ADD COLUMN option_type ENUM('call', 'put') DEFAULT NULL COMMENT '期权类型（期权消息专用）',
  ADD COLUMN strike_price DECIMAL(12,2) DEFAULT NULL COMMENT '行权价（期权消息专用）',
  ADD COLUMN expiration_date DATE DEFAULT NULL COMMENT '到期日（期权消息专用）',
  ADD COLUMN quantity INT DEFAULT NULL COMMENT '张数（期权消息专用）';
