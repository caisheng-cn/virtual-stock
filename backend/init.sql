-- ============================================================
-- 虚拟炒股平台 - 完整数据库建表脚本
-- 数据库: virtual_stock
-- 字符集: utf8mb4
-- 说明: 合并了 init.sql + migration-commission.sql
--       + migration-profit.sql + migration-admin.sql
--       + models/index.js 中定义的所有字段
-- ============================================================

CREATE DATABASE IF NOT EXISTS virtual_stock
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE virtual_stock;

-- ============================================================
-- 1. 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(50) NOT NULL UNIQUE,
  password      VARCHAR(255) NOT NULL,
  nickname      VARCHAR(50),
  email         VARCHAR(100),
  phone         VARCHAR(20),
  status        TINYINT DEFAULT 1 COMMENT '状态: 0禁用 1正常',
  trade_enabled TINYINT DEFAULT 1 COMMENT '交易权限: 0禁用 1启用',
  admin_access  TINYINT DEFAULT 0 COMMENT '后台访问: 0无 1有',
  last_trade_date DATE,
  language      VARCHAR(10) DEFAULT 'zh-CN',
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. 群组表
-- ============================================================
CREATE TABLE IF NOT EXISTS `groups` (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(500),
  init_cash   DECIMAL(15,2) DEFAULT 100000.00 COMMENT '初始化资金',
  currency    VARCHAR(10) DEFAULT 'USD',
  status      TINYINT DEFAULT 1 COMMENT '状态: 0禁用 1正常',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. 用户群组关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS user_groups (
  id        INT PRIMARY KEY AUTO_INCREMENT,
  user_id   INT NOT NULL,
  group_id  INT NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  UNIQUE KEY uk_group_rank (group_id, `rank`),
  UNIQUE KEY uk_group_user (group_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 12. 邀请码表
-- ============================================================
CREATE TABLE IF NOT EXISTS invite_codes (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  code        VARCHAR(20) NOT NULL UNIQUE,
  group_id    INT NOT NULL,
  expire_date DATE,
  use_limit   INT,
  used_count  INT DEFAULT 0,
  status      TINYINT DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_group_id (group_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 13. 管理员表
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  username    VARCHAR(50) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  permissions VARCHAR(500) DEFAULT '',
  status      TINYINT DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 14. 系统配置表
-- ============================================================
CREATE TABLE IF NOT EXISTS system_configs (
  id           INT PRIMARY KEY AUTO_INCREMENT,
  config_key   VARCHAR(50) NOT NULL UNIQUE,
  config_value TEXT,
  description  VARCHAR(200),
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  login_time DATETIME DEFAULT NOW(),
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
  trade_start  VARCHAR(10),
  trade_end    VARCHAR(10),
  enabled      TINYINT DEFAULT 1,
  created_at   DATETIME DEFAULT NOW(),
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

-- user_groups表添加已读消息ID字段
ALTER TABLE user_groups ADD COLUMN IF NOT EXISTS last_read_message_id INT DEFAULT 0;

-- ============================================================
-- 种子数据
-- ============================================================

-- 默认管理员 (admin / admin123)
INSERT INTO admin_users (username, password, permissions, status)
VALUES ('admin', '$2a$10$saphqmfZtE7T/TAJumqw9ebPShnvSHE6IfM7ER/q6wFZjteX0krt6', 'all', 1);

-- 默认群组
INSERT INTO `groups` (name, description, init_cash, currency, status)
VALUES ('默认群组', '默认虚拟炒股群组', 100000.00, 'USD', 1);

-- 默认邀请码
INSERT INTO invite_codes (code, group_id, use_limit, status)
VALUES ('DEFAULT2024', 1, 100, 1);

-- 佣金配置 (rate = 千分比 ‰)
-- A股: 千分之0.5 (=万分之5=0.05%) | 港股: 千分之1 (=0.1%) | 美股: 千分之5 (=0.5%)
INSERT INTO commission_configs (market_type, trade_type, commission_rate) VALUES
(1, 1, 0.5),
(1, 2, 0.5),
(2, 1, 1),
(2, 2, 1),
(3, 1, 5),
(3, 2, 5)
ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate);

-- 市场时间配置
INSERT INTO market_config (market_type, refresh_time, trade_start, trade_end) VALUES
(1, '09:00', '09:30', '15:00'),
(2, '09:30', '09:30', '16:00'),
(3, '04:00', '09:30', '16:00')
ON DUPLICATE KEY UPDATE refresh_time = VALUES(refresh_time);

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
