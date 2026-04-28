-- 虚拟炒股平台数据库迁移脚本 v1.2
-- 日期: 2026-04-25
-- 说明: 持仓与资金独立于群组，添加股票缓存机制

-- ============================================
-- 1. 修改 positions 表 - 移除 group_id 字段
-- ============================================
-- 注意: 如果已有持仓数据需要先迁移

-- 检查是否需要迁移数据
-- 如果 positions 表中有数据，执行迁移（将多条记录合并）
-- 暂时先删除 group_id 索引，添加新的唯一索引

-- 方式1: 如果表为空或可以清空，直接修改
-- ALTER TABLE positions DROP COLUMN group_id;
-- ALTER TABLE positions ADD UNIQUE INDEX idx_user_stock (user_id, stock_code);

-- 方式2: 如果需要保留数据，创建新表并迁移
-- 这个脚本采用方式1，假设测试环境可以清空数据

-- ============================================
-- 2. 修改 user_balance 表 - 移除 group_id 字段
-- ============================================

-- 方式1: 直接修改
-- ALTER TABLE user_balance DROP COLUMN group_id;
-- ALTER TABLE user_balance ADD UNIQUE INDEX idx_user (user_id);

-- ============================================
-- 3. 添加 stock_prices_cache 表的 stock_name 字段
-- ============================================
-- ALTER TABLE stock_prices_cache ADD COLUMN stock_name VARCHAR(100) DEFAULT '';

-- ============================================
-- 执行步骤 (按顺序执行)
-- ============================================
-- 建议: 直接运行 init-test.js 重新初始化数据库

-- 如果数据库已有重要数据，建议先备份:
-- mysqldump -u root -p virtual_stock > backup_$(date +%Y%m%d).sql

-- 然后清空相关表并重新初始化:
-- TRUNCATE TABLE positions;
-- TRUNCATE TABLE user_balance;
-- TRUNCATE TABLE transactions;
-- TRUNCATE TABLE stock_prices;
-- TRUNCATE TABLE stock_prices_cache;

-- 最后运行初始化脚本:
-- cd backend && node init-test.js