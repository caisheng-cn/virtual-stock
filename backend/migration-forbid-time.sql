-- 迁移: 重命名 trade_start/trade_end 为 forbid_start/forbid_end
ALTER TABLE market_config CHANGE COLUMN trade_start forbid_start VARCHAR(10);
ALTER TABLE market_config CHANGE COLUMN trade_end forbid_end VARCHAR(10);

-- 删除 scheduler_configs 中已废弃的 stock_data_sync 记录
DELETE FROM scheduler_configs WHERE task_key = 'stock_data_sync';
