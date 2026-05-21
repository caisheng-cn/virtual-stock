ALTER TABLE ai_llm_configs ADD COLUMN timeout INT DEFAULT 30 COMMENT '超时时间(秒)' AFTER temperature;
