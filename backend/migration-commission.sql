-- 佣金配置表
CREATE TABLE IF NOT EXISTS commission_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  market_type TINYINT NOT NULL,
  trade_type TINYINT NOT NULL,
  commission_rate DECIMAL(10,6) NOT NULL DEFAULT 0.5,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_market_trade (market_type, trade_type)
);

-- 交易记录表添加佣金字段
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS commission DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(10,6) DEFAULT 0;

-- 初始化佣金配置数据 (rate = 千分比 ‰)
-- A股: 千分之0.5 | 港股: 千分之1 | 美股: 千分之5
INSERT INTO commission_configs (market_type, trade_type, commission_rate) VALUES
(1, 1, 0.5),
(1, 2, 0.5),
(2, 1, 1),
(2, 2, 1),
(3, 1, 5),
(3, 2, 5)
ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate);