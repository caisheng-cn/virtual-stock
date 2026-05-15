-- AKShare 期权数据改造 - 数据库迁移
-- 日期: 2026-05-15
-- 说明: 对现有期权表增加字段以适配中国真实期权市场数据

-- ============================================
-- 1. option_whitelist - 扩展标的类型
-- ============================================
ALTER TABLE option_whitelist
  ADD COLUMN underlying_type TINYINT DEFAULT 1 COMMENT '标的类型 1=ETF 2=股指 3=商品',
  ADD COLUMN exchange VARCHAR(10) DEFAULT '' COMMENT '交易所 SSE/SZSE/CFFEX/DCE/SHFE/CZCE/GFEX',
  ADD COLUMN underlying_code VARCHAR(20) DEFAULT '' COMMENT '标的实际代码(如510050)',
  ADD COLUMN contract_multiplier INT DEFAULT 10000 COMMENT '合约单位(张)',
  ADD COLUMN exercise_type TINYINT DEFAULT 1 COMMENT '行权方式 1=美式 2=欧式';

-- ============================================
-- 2. option_contracts - 增加真实合约字段
-- ============================================
ALTER TABLE option_contracts
  ADD COLUMN exchange VARCHAR(10) DEFAULT '' COMMENT '交易所 SSE/SZSE/CFFEX/DCE/SHFE/CZCE/GFEX',
  ADD COLUMN contract_name VARCHAR(100) DEFAULT '' COMMENT '合约简称(如50ETF购6月2800)',
  ADD COLUMN exercise_type TINYINT DEFAULT 1 COMMENT '行权方式 1=美式 2=欧式',
  ADD COLUMN contract_code_sse VARCHAR(20) DEFAULT '' COMMENT '上交所内部合约编码(如10011251)',
  ADD COLUMN contract_code_ctp VARCHAR(50) DEFAULT '' COMMENT 'openCTP合约ID(如510050C2606A03000)',
  ADD COLUMN prev_settle DECIMAL(12,4) DEFAULT 0 COMMENT '昨结算价',
  ADD COLUMN listing_date DATE DEFAULT NULL COMMENT '上市日期',
  ADD COLUMN last_trade_date DATE DEFAULT NULL COMMENT '最后交易日',
  ADD COLUMN delivery_date DATE DEFAULT NULL COMMENT '交割日',
  ADD COLUMN underlying_code VARCHAR(20) DEFAULT '' COMMENT '标的代码(冗余，方便查询)';

ALTER TABLE option_contracts
  ADD INDEX idx_exchange (exchange),
  ADD INDEX idx_expiration_status (expiration_date, status);

-- ============================================
-- 3. option_prices - 增加真实行情字段
-- ============================================
ALTER TABLE option_prices
  ADD COLUMN settle DECIMAL(14,4) DEFAULT 0 COMMENT '结算价',
  ADD COLUMN prev_settle DECIMAL(14,4) DEFAULT 0 COMMENT '昨结算价',
  ADD COLUMN open_interest INT DEFAULT 0 COMMENT '持仓量',
  ADD COLUMN volume INT DEFAULT 0 COMMENT '成交量',
  ADD COLUMN gamma DECIMAL(10,6) DEFAULT 0 COMMENT 'Gamma',
  ADD COLUMN theta DECIMAL(10,6) DEFAULT 0 COMMENT 'Theta',
  ADD COLUMN vega DECIMAL(10,6) DEFAULT 0 COMMENT 'Vega',
  ADD COLUMN rho DECIMAL(10,6) DEFAULT 0 COMMENT 'Rho',
  ADD COLUMN bid_price DECIMAL(12,4) DEFAULT 0 COMMENT '买一价',
  ADD COLUMN ask_price DECIMAL(12,4) DEFAULT 0 COMMENT '卖一价',
  ADD COLUMN change_percent DECIMAL(8,4) DEFAULT 0 COMMENT '涨跌幅(%)';

-- 扩展字段精度适配中国市场（如股指期权数值大）
ALTER TABLE option_prices
  MODIFY COLUMN premium DECIMAL(14,4) NOT NULL COMMENT '权利金',
  MODIFY COLUMN intrinsic_value DECIMAL(14,4) DEFAULT 0 COMMENT '内在价值',
  MODIFY COLUMN time_value DECIMAL(14,4) DEFAULT 0 COMMENT '时间价值',
  MODIFY COLUMN underlying_price DECIMAL(14,2) NOT NULL COMMENT '当日标的收盘价';

ALTER TABLE option_prices
  ADD INDEX idx_trade_date_only (trade_date);
