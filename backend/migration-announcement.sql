-- 管理员公告表
CREATE TABLE IF NOT EXISTS admin_announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content_zh_cn TEXT COMMENT '简体中文内容',
  content_zh_tw TEXT COMMENT '繁體中文內容',
  content_en TEXT COMMENT 'English content',
  enabled TINYINT DEFAULT 1 COMMENT '是否启用',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员公告';
