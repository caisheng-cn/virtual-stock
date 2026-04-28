-- 后台管理界面数据库迁移
-- 执行日期: 2026-04-26

-- 1. users表新增字段
ALTER TABLE users ADD COLUMN trade_enabled TINYINT DEFAULT 1;
ALTER TABLE users ADD COLUMN admin_access TINYINT DEFAULT 0;

-- 2. 登录历史表
CREATE TABLE IF NOT EXISTS login_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  login_time DATETIME DEFAULT NOW(),
  ip_address VARCHAR(50),
  user_agent VARCHAR(255),
  INDEX idx_user_login (user_id, login_time),
  INDEX idx_user (user_id)
);

-- 3. 市场配置表
CREATE TABLE IF NOT EXISTS market_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  market_type TINYINT NOT NULL,
  refresh_time VARCHAR(10),
  trade_start VARCHAR(10),
  trade_end VARCHAR(10),
  enabled TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT NOW(),
  UNIQUE KEY uk_market (market_type)
);

-- 初始化市场配置
INSERT INTO market_config (market_type, refresh_time, trade_start, trade_end) VALUES
(1, '09:00', '09:30', '15:00'),
(2, '09:30', '09:30', '16:00'),
(3, '04:00', '09:30', '16:00')
ON DUPLICATE KEY UPDATE refresh_time = VALUES(refresh_time);

-- 4. 佣金历史表
CREATE TABLE IF NOT EXISTS commission_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  market_type TINYINT NOT NULL,
  trade_type TINYINT NOT NULL,
  old_rate DECIMAL(10,6) NOT NULL,
  new_rate DECIMAL(10,6) NOT NULL,
  changed_by INT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  remark VARCHAR(200),
  INDEX idx_market_trade_time (market_type, trade_type, changed_at),
  INDEX idx_changed_at (changed_at)
);