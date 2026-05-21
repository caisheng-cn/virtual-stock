ALTER TABLE users ADD COLUMN personality_prompt TEXT COMMENT '个人提示词(覆盖配置级提示词)' AFTER ai_config_id;
