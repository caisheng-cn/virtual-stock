-- 调度任务配置表
-- 用于管理所有定时任务的 cron 表达式和启停状态
CREATE TABLE IF NOT EXISTS scheduler_configs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_key VARCHAR(50) NOT NULL UNIQUE COMMENT '任务唯一标识',
  task_name VARCHAR(100) NOT NULL COMMENT '任务显示名称',
  cron_expression VARCHAR(50) NOT NULL COMMENT 'cron 表达式',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用 1=启用 0=停用',
  description VARCHAR(500) DEFAULT '' COMMENT '任务描述',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调度任务配置';

-- 初始数据
INSERT IGNORE INTO scheduler_configs (task_key, task_name, cron_expression, enabled, description) VALUES
('option_contract_sync', '同步期权合约', '50 8 * * 1-5', 1, '每个交易日 08:50 从 AKShare 同步全量合约列表'),
('option_price_sync', '同步实时行情', '*/5 9,10,11,13,14 * * 1-5', 1, '交易时段每5分钟刷新期权实时报价'),
('option_daily_close', '同步收盘数据', '5 15 * * 1-5', 1, '每个交易日 15:05 同步日线收盘价和 Greeks'),
('option_settlement', '到期自动结算', '10 15 * * 1-5', 1, '每个交易日 15:10 自动结算当日到期的实值期权'),
('stock_data_sync', '同步股票数据', '0 9 * * 1-5', 1, '每个交易日 09:00 同步 A 股/港股/美股日线数据');
