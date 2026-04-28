-- 新增 profit 字段用于记录已实现收益
ALTER TABLE transactions ADD COLUMN profit DECIMAL(15, 2) DEFAULT 0 COMMENT '已实现收益';