-- ============================================================
-- 虚拟炒股平台 - 完整数据库建表脚本
-- 数据库: virtual_stock
-- 字符集: utf8mb4
-- 说明: 自动从当前数据库结构生成
-- ============================================================

CREATE DATABASE IF NOT EXISTS virtual_stock
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE virtual_stock;

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  username        VARCHAR(50) NOT NULL,
  password        VARCHAR(255) NOT NULL,
  nickname        VARCHAR(50),
  email           VARCHAR(100),
  phone           VARCHAR(20),
  status          TINYINT DEFAULT 1 COMMENT '状态: 0禁用 1正常',
  trade_enabled   TINYINT DEFAULT 1 COMMENT '交易权限: 0禁用 1启用',
  admin_access    TINYINT DEFAULT 0 COMMENT '后台访问: 0无 1有',
  last_trade_date DATE,
  language        VARCHAR(10) DEFAULT 'zh-CN',
  is_ai           TINYINT DEFAULT 0 COMMENT '是否AI用户: 0否 1是',
  ai_personality  VARCHAR(20) DEFAULT '' COMMENT 'AI投资风格(conservative/random/aggressive)',
  ai_config_id    INT DEFAULT 0 COMMENT '关联的LLM配置ID',
  personality_prompt TEXT COMMENT '个人提示词(覆盖配置级提示词)',
  daily_trade_count INT DEFAULT 0 COMMENT '当日已交易次数',
  daily_trade_date  DATE COMMENT '当日交易日期',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username),
  INDEX idx_username (username),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. 群组表
-- ============================================================
CREATE TABLE IF NOT EXISTS `groups` (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  init_cash   DECIMAL(15,2) DEFAULT 100000.00 COMMENT '初始化资金',
  currency    VARCHAR(10) DEFAULT 'USD',
  status      TINYINT DEFAULT 1 COMMENT '状态: 0禁用 1正常',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_name (name),
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. 用户群组关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_groups (
  id                   INT PRIMARY KEY AUTO_INCREMENT,
  user_id              INT NOT NULL,
  group_id             INT NOT NULL,
  joined_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_read_message_id INT DEFAULT 0,
  UNIQUE KEY uk_user_group (user_id, group_id),
  INDEX idx_user_id (user_id),
  INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. 用户资金表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_balance (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  group_id    INT NOT NULL,
  cash        DECIMAL(15,2) NOT NULL,
  frozen_cash DECIMAL(15,2) DEFAULT 0,
  total_cost  DECIMAL(15,2) DEFAULT 0,
  init_cash   DECIMAL(15,2) DEFAULT 7000000 COMMENT '初始资金',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_group (user_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. 持仓表
-- ============================================================
CREATE TABLE IF NOT EXISTS positions (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  group_id    INT NOT NULL,
  stock_code  VARCHAR(20) NOT NULL,
  market_type TINYINT NOT NULL COMMENT '市场类型: 1A股 2港股 3美股',
  shares      INT DEFAULT 0,
  avg_cost    DECIMAL(15,4) DEFAULT 0,
  total_cost  DECIMAL(15,2) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_group_stock (user_id, group_id, stock_code),
  INDEX idx_user_group (user_id, group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. 交易记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id         INT NOT NULL,
  group_id        INT NOT NULL,
  stock_code      VARCHAR(20) NOT NULL,
  stock_name      VARCHAR(100),
  market_type     TINYINT NOT NULL,
  trade_type      TINYINT NOT NULL COMMENT '交易类型: 1买入 2卖出 3分红 4配股 5初始资金',
  price           DECIMAL(15,4) NOT NULL,
  shares          INT NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  commission      DECIMAL(15,2) DEFAULT 0 COMMENT '手续费',
  commission_rate DECIMAL(10,6) DEFAULT 0 COMMENT '手续费率',
  balance_after   DECIMAL(15,2) DEFAULT 0 COMMENT '交易后余额',
  profit          DECIMAL(15,2) DEFAULT 0 COMMENT '已实现收益',
  trade_date      DATE NOT NULL,
  status          TINYINT DEFAULT 1 COMMENT '状态: 0失败 1成功 2待处理',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_trade_date (user_id, trade_date),
  INDEX idx_user_group (user_id, group_id),
  INDEX idx_trade_date (trade_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. 股票池表
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_pools (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  stock_code  VARCHAR(20) NOT NULL,
  stock_name  VARCHAR(100) NOT NULL,
  pinyin_abbr VARCHAR(50) DEFAULT '' COMMENT '拼音首字母缩写',
  market_type TINYINT NOT NULL,
  status      TINYINT DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code_market (stock_code, market_type),
  INDEX idx_market_status (market_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. 股票历史行情表
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_prices (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  stock_code  VARCHAR(20) NOT NULL,
  stock_name  VARCHAR(100),
  market_type TINYINT NOT NULL,
  trade_date  DATE NOT NULL,
  open_price  DECIMAL(15,4),
  high_price  DECIMAL(15,4),
  low_price   DECIMAL(15,4),
  close_price DECIMAL(15,4),
  prev_close  DECIMAL(15,4),
  volume      BIGINT,
  amount      DECIMAL(20,2),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code_market_date (stock_code, market_type, trade_date),
  INDEX idx_code_date (stock_code, trade_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. 股票行情缓存表
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_prices_cache (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  stock_code      VARCHAR(20) NOT NULL,
  market_type     TINYINT NOT NULL,
  trade_date      DATE NOT NULL,
  close_price     DECIMAL(15,4),
  prev_close      DECIMAL(15,4),
  change_percent  DECIMAL(10,4),
  stock_name      VARCHAR(100) DEFAULT '',
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code_market (stock_code, market_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. 每日资金快照表
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_balance (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id      INT NOT NULL,
  group_id     INT NOT NULL,
  trade_date   DATE NOT NULL,
  cash         DECIMAL(15,2) NOT NULL,
  total_assets DECIMAL(15,2) NOT NULL,
  profit       DECIMAL(15,2) DEFAULT 0,
  profit_rate  DECIMAL(10,4) DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_group_date (user_id, group_id, trade_date),
  INDEX idx_user_date (user_id, trade_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. 群组排名缓存表
-- ============================================================
CREATE TABLE IF NOT EXISTS group_ranking_cache (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  group_id     INT NOT NULL,
  user_id      INT NOT NULL,
  cash         DECIMAL(15,2),
  total_assets DECIMAL(15,2),
  profit       DECIMAL(15,2),
  profit_rate  DECIMAL(10,4),
  `rank`       INT,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_group_user (group_id, user_id),
  UNIQUE KEY uk_group_rank (group_id, `rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. 邀请码表
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  code        VARCHAR(20) NOT NULL,
  group_id    INT NOT NULL,
  expire_date DATE,
  use_limit   INT,
  used_count  INT DEFAULT 0,
  status      TINYINT DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_code (code),
  INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 13. 管理员表
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  username    VARCHAR(50) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  permissions VARCHAR(500) DEFAULT '',
  status      TINYINT DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 14. 系统配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS system_configs (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  config_key   VARCHAR(50) NOT NULL,
  config_value TEXT,
  description  VARCHAR(200),
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_config_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 15. 操作日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id        INT,
  operation_type VARCHAR(30) NOT NULL,
  operation_desc VARCHAR(500) NOT NULL,
  ip_address     VARCHAR(50),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_operation_type (operation_type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 16. 佣金配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_configs (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  market_type     TINYINT NOT NULL COMMENT '市场: 1A股 2港股 3美股',
  trade_type      TINYINT NOT NULL COMMENT '交易: 1买入 2卖出',
  commission_rate DECIMAL(10,6) NOT NULL DEFAULT 0.005,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_market_trade (market_type, trade_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 17. 登录历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS login_history (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  user_id    INT NOT NULL,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(50),
  user_agent VARCHAR(255),
  INDEX idx_user_login (user_id, login_time),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 18. 市场配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS market_config (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  market_type  TINYINT NOT NULL,
  refresh_time VARCHAR(10),
  forbid_start  VARCHAR(10),
  forbid_end    VARCHAR(10),
  enabled      TINYINT DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_market (market_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 19. 佣金历史表
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_history (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  market_type TINYINT NOT NULL,
  trade_type  TINYINT NOT NULL,
  old_rate    DECIMAL(10,6) NOT NULL,
  new_rate    DECIMAL(10,6) NOT NULL,
  changed_by  INT NOT NULL,
  changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  remark      VARCHAR(200),
  INDEX idx_market_trade_time (market_type, trade_type, changed_at),
  INDEX idx_changed_at (changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 20. 群组消息表
-- ============================================================
CREATE TABLE IF NOT EXISTS group_messages (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  group_id    INT NOT NULL,
  user_id     INT NOT NULL,
  message_type TINYINT NOT NULL COMMENT '1买入 2卖出 3分红 4配股',
  stock_code  VARCHAR(20),
  stock_name  VARCHAR(100),
  market_type TINYINT DEFAULT 0,
  shares      INT,
  price       DECIMAL(15,4),
  amount      DECIMAL(15,2),
  content     VARCHAR(500),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_group_time (group_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 21. 消息点赞表
-- ============================================================
CREATE TABLE IF NOT EXISTS message_likes (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  message_id  INT NOT NULL,
  user_id     INT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_message_user (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 22. 消息回复表
-- ============================================================
CREATE TABLE IF NOT EXISTS message_replies (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  message_id  INT NOT NULL,
  user_id     INT NOT NULL,
  content     VARCHAR(500) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 23. 股票同步记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_sync_records (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  market_type     TINYINT NOT NULL COMMENT '市场: 1A股 2港股 3美股',
  status          VARCHAR(20) DEFAULT 'running' COMMENT '状态: running/completed/failed',
  total_count     INT DEFAULT 0 COMMENT '待同步股票总数',
  completed_count INT DEFAULT 0 COMMENT '已处理数量',
  success_count   INT DEFAULT 0 COMMENT '成功数量',
  fail_count      INT DEFAULT 0 COMMENT '失败数量',
  failed_stocks   MEDIUMTEXT COMMENT '失败股票详情(JSON)',
  current_stock   VARCHAR(50) COMMENT '当前处理的股票代码',
  started_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at     DATETIME,
  duration_sec    INT DEFAULT 0 COMMENT '耗时秒数',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_market_status (market_type, status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 种子数据
-- ============================================================

-- 默认管理员 (admin / admin123)
INSERT IGNORE INTO admin_users (username, password, permissions, status)
VALUES ('admin', '$2a$10$saphqmfZtE7T/TAJumqw9ebPShnvSHE6IfM7ER/q6wFZjteX0krt6', 'all', 1);

-- 默认群组
INSERT IGNORE INTO `groups` (name, description, init_cash, currency, status)
VALUES ('默认群组', '默认虚拟炒股群组', 100000.00, 'USD', 1);

-- 默认邀请码
INSERT IGNORE INTO invite_codes (code, group_id, use_limit, status)
VALUES ('DEFAULT2024', 1, 100, 1);

-- 佣金配置 (rate = 千分比 ‰)
INSERT INTO commission_configs (market_type, trade_type, commission_rate) VALUES
(1, 1, 0.5),
(1, 2, 0.5),
(2, 1, 1),
(2, 2, 1),
(3, 1, 5),
(3, 2, 5)
ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate);

-- 市场时间配置
INSERT INTO market_config (market_type, refresh_time, forbid_start, forbid_end) VALUES
(1, '09:00', '15:00', '09:30'),
(2, '09:30', '16:00', '09:30'),
(3, '04:00', '04:00', '21:30')
ON DUPLICATE KEY UPDATE refresh_time = VALUES(refresh_time);

-- ============================================================
-- 24. AI LLM 配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_llm_configs (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  config_name VARCHAR(50) NOT NULL COMMENT '配置名称',
  api_url     VARCHAR(500) NOT NULL COMMENT 'LLM接口地址',
  api_key     VARCHAR(500) NOT NULL COMMENT 'API密钥',
  model_name  VARCHAR(100) DEFAULT 'gpt-3.5-turbo' COMMENT '模型名称',
  max_tokens  INT DEFAULT 2000 COMMENT '最大Token数',
  temperature          DECIMAL(3,2) DEFAULT 0.7 COMMENT '温度参数',
  timeout              INT DEFAULT 30 COMMENT '超时时间(秒)',
  personality_prompts  TEXT COMMENT '各风格自定义提示词(JSON)',
  status               TINYINT DEFAULT 1 COMMENT '状态: 0禁用 1启用',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI LLM 配置';

-- ============================================================
-- 25. AI 交易日志表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_trade_logs (
  id                BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id           INT NOT NULL COMMENT 'AI用户ID',
  group_id          INT NOT NULL COMMENT '群组ID',
  interaction_type  VARCHAR(10) DEFAULT '' COMMENT '类型: trade/reply/like',
  decision          VARCHAR(20) DEFAULT '' COMMENT '决策: buy/sell/hold',
  stock_code        VARCHAR(20) DEFAULT '',
  market_type       TINYINT DEFAULT 0,
  shares            INT DEFAULT 0,
  reason            TEXT COMMENT '决策理由',
  llm_response      TEXT COMMENT 'LLM原始回复',
  executed          TINYINT DEFAULT 0 COMMENT '是否已执行',
  trade_id          BIGINT DEFAULT 0 COMMENT '关联交易ID',
  target_message_id INT DEFAULT 0 COMMENT '关联群消息ID(社交互动)',
  reply_content     TEXT COMMENT '回复内容(社交互动)',
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_group (group_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 交易日志';

-- ============================================================
-- 26. 期权标的白名单
-- ============================================================
CREATE TABLE IF NOT EXISTS option_whitelist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_code VARCHAR(20) NOT NULL COMMENT '标的代码',
  market_type TINYINT NOT NULL DEFAULT 1 COMMENT '市场类型 1=A股',
  stock_name VARCHAR(100) NOT NULL COMMENT '标的名称',
  status TINYINT DEFAULT 1 COMMENT '状态 1=启用 0=停用',
  underlying_type TINYINT DEFAULT 1 COMMENT '标的类型 1=ETF 2=股指 3=商品',
  exchange VARCHAR(10) DEFAULT '' COMMENT '交易所 SSE/SZSE/CFFEX/DCE/SHFE/CZCE/GFEX',
  underlying_code VARCHAR(20) DEFAULT '' COMMENT '标的实际代码(如510050)',
  contract_multiplier INT DEFAULT 10000 COMMENT '合约单位(张)',
  exercise_type TINYINT DEFAULT 1 COMMENT '行权方式 1=美式 2=欧式',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_market (stock_code, market_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权标的白名单';

-- ============================================================
-- 25. 期权合约
-- ============================================================
CREATE TABLE IF NOT EXISTS option_contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  stock_code VARCHAR(20) NOT NULL COMMENT '标的代码',
  market_type TINYINT NOT NULL DEFAULT 1 COMMENT '市场类型',
  stock_name VARCHAR(100) NOT NULL DEFAULT '' COMMENT '标的名称',
  option_type ENUM('call', 'put') NOT NULL COMMENT '期权类型',
  strike_price DECIMAL(12,2) NOT NULL COMMENT '行权价',
  expiration_date DATE NOT NULL COMMENT '到期日',
  contract_code VARCHAR(50) NOT NULL COMMENT '合约代码',
  contract_multiplier INT DEFAULT 10000 COMMENT '合约乘数',
  status TINYINT DEFAULT 1 COMMENT '状态 1=交易中 2=已到期 3=已下架',
  underlying_price DECIMAL(12,2) DEFAULT 0 COMMENT '生成时的标的价',
  exchange VARCHAR(10) DEFAULT '' COMMENT '交易所 SSE/SZSE/CFFEX/DCE/SHFE/CZCE/GFEX',
  contract_name VARCHAR(100) DEFAULT '' COMMENT '合约简称(如50ETF购6月2800)',
  exercise_type TINYINT DEFAULT 1 COMMENT '行权方式 1=美式 2=欧式',
  contract_code_sse VARCHAR(20) DEFAULT '' COMMENT '上交所内部合约编码(如10011251)',
  contract_code_ctp VARCHAR(50) DEFAULT '' COMMENT 'openCTP合约ID(如510050C2606A03000)',
  prev_settle DECIMAL(12,4) DEFAULT 0 COMMENT '昨结算价',
  listing_date DATE DEFAULT NULL COMMENT '上市日期',
  last_trade_date DATE DEFAULT NULL COMMENT '最后交易日',
  delivery_date DATE DEFAULT NULL COMMENT '交割日',
  underlying_code VARCHAR(20) DEFAULT '' COMMENT '标的代码(冗余)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_contract_code (contract_code),
  INDEX idx_exchange (exchange),
  INDEX idx_stock_expiry (stock_code, expiration_date),
  INDEX idx_expiration_status (expiration_date, status),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权合约';

-- ============================================================
-- 26. 用户期权持仓
-- ============================================================
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

-- ============================================================
-- 27. 期权交易记录
-- ============================================================
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

-- ============================================================
-- 28. 期权每日行情
-- ============================================================
CREATE TABLE IF NOT EXISTS option_prices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contract_id INT NOT NULL COMMENT '合约ID',
  trade_date DATE NOT NULL COMMENT '日期',
  premium DECIMAL(14,4) NOT NULL COMMENT '权利金',
  intrinsic_value DECIMAL(14,4) DEFAULT 0 COMMENT '内在价值',
  time_value DECIMAL(14,4) DEFAULT 0 COMMENT '时间价值',
  settle DECIMAL(14,4) DEFAULT 0 COMMENT '结算价',
  prev_settle DECIMAL(14,4) DEFAULT 0 COMMENT '昨结算价',
  open_interest INT DEFAULT 0 COMMENT '持仓量',
  volume INT DEFAULT 0 COMMENT '成交量',
  delta DECIMAL(6,4) DEFAULT 0 COMMENT 'Delta',
  gamma DECIMAL(10,6) DEFAULT 0 COMMENT 'Gamma',
  theta DECIMAL(10,6) DEFAULT 0 COMMENT 'Theta',
  vega DECIMAL(10,6) DEFAULT 0 COMMENT 'Vega',
  rho DECIMAL(10,6) DEFAULT 0 COMMENT 'Rho',
  implied_volatility DECIMAL(6,4) DEFAULT 0 COMMENT '隐含波动率',
  underlying_price DECIMAL(14,2) NOT NULL COMMENT '当日标的收盘价',
  bid_price DECIMAL(12,4) DEFAULT 0 COMMENT '买一价',
  ask_price DECIMAL(12,4) DEFAULT 0 COMMENT '卖一价',
  change_percent DECIMAL(8,4) DEFAULT 0 COMMENT '涨跌幅(%)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_contract_date (contract_id, trade_date),
  INDEX idx_trade_date (trade_date),
  INDEX idx_trade_date_only (trade_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='期权每日行情';

-- ============================================================
-- 29. 调度任务配置
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduler_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_key VARCHAR(50) NOT NULL COMMENT '任务唯一标识',
  task_name VARCHAR(100) NOT NULL COMMENT '任务显示名称',
  cron_expression VARCHAR(50) NOT NULL COMMENT 'cron 表达式',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用 1=启用 0=停用',
  description VARCHAR(500) DEFAULT '' COMMENT '任务描述',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_task_key (task_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调度任务配置';

-- ============================================================
-- 扩展 users 表 - 增加AI相关字段
-- ============================================================
ALTER TABLE users
  ADD COLUMN is_ai TINYINT DEFAULT 0 COMMENT '是否AI用户: 0否 1是',
  ADD COLUMN ai_personality VARCHAR(20) DEFAULT '' COMMENT 'AI投资风格(conservative/random/aggressive)',
  ADD COLUMN ai_config_id INT DEFAULT 0 COMMENT '关联的LLM配置ID',
  ADD COLUMN daily_trade_count INT DEFAULT 0 COMMENT '当日已交易次数',
  ADD COLUMN daily_trade_date DATE COMMENT '当日交易日期';

-- ============================================================
-- 扩展 group_messages 表 - 增加期权字段
-- ============================================================
ALTER TABLE group_messages
  ADD COLUMN option_type ENUM('call', 'put') DEFAULT NULL COMMENT '期权类型（期权消息专用）',
  ADD COLUMN strike_price DECIMAL(12,2) DEFAULT NULL COMMENT '行权价（期权消息专用）',
  ADD COLUMN expiration_date DATE DEFAULT NULL COMMENT '到期日（期权消息专用）',
  ADD COLUMN quantity INT DEFAULT NULL COMMENT '张数（期权消息专用）';

-- ============================================================
-- 30. 管理员公告表
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content_zh_cn TEXT COMMENT '简体中文内容',
  content_zh_tw TEXT COMMENT '繁體中文內容',
  content_en TEXT COMMENT 'English content',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员公告';

-- ============================================================
-- 调度任务种子数据
-- ============================================================
INSERT IGNORE INTO scheduler_configs (task_key, task_name, cron_expression, enabled, description) VALUES
('option_contract_sync', '同步期权合约', '50 8 * * 1-5', 1, '每个交易日 08:50 从 AKShare 同步全量合约列表'),
('option_price_sync', '同步实时行情', '*/5 9,10,11,13,14 * * 1-5', 1, '交易时段每5分钟刷新期权实时报价'),
('option_daily_close', '同步收盘数据', '5 15 * * 1-5', 1, '每个交易日 15:05 同步日线收盘价和 Greeks'),
('option_settlement', '到期自动结算', '10 15 * * 1-5', 1, '每个交易日 15:10 自动结算当日到期的实值期权');
