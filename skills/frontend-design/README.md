# Frontend Design Skill 使用文档

## GitHub 仓库

**URL**: https://github.com/anthropics/claude-code

**Stars**: 116K+

## Skill 位置

`./plugins/frontend-design/skills/frontend-design/SKILL.md`

## 安装方法

由于当前环境没有AI skill工具，已将skill内容保存到本地目录：

```
/mnt/d/caisheng/code/web/skills/frontend-design/SKILL.md
```

## 使用方法

### 设计原则

1. **Design Thinking (设计思考)**
   - 理解需求目的和用户群体
   - 选择明确的风格方向（极简、复古未来、奢华、杂志风、装饰艺术等）
   - 考虑技术约束和可访问性
   - 思考差异化：什么让人印象深刻？

2. **Frontend Aesthetics Guidelines (前端美学准则)**

   **字体选择**
   - 避免通用字体（Arial, Inter, Roboto）
   - 选择独特、有特色的字体
   - 搭配：醒目的展示字体 + 优雅的正文字体

   **颜色与主题**
   - 明确的美学风格方向
   - 使用CSS变量保持一致性
   - 主色+锐利 accent 优于平淡均匀的配色

   **动画**
   - 页面加载时的交错入场动画
   - 滚动触发和悬停效果
   - 优先使用CSS解决方案

   **空间布局**
   - 不对称布局
   - 重叠效果
   - 对角线流动
   - 大胆的负空间

   **背景与细节**
   - 渐变网格、噪点纹理、几何图案
   - 层叠透明效果
   - 戏剧性阴影、装饰边框

### 禁止的"AI Slop"美学

- ❌ 通用字体 (Inter, Roboto, Arial, system fonts)
- ❌  cliched配色 (白底紫色渐变)
- ❌ 可预测的布局和组件模式
- ❌ 缺乏上下文特色的设计

### 实现要求

- 生产级可用代码
- 视觉引人注目且令人难忘
- 清晰的美学观点
- 每个细节精致打磨

## 本地文件

- Skill文件: `skills/frontend-design/SKILL.md`

使用此 skill 时，请在对话中提及 "使用 frontend-design skill"。