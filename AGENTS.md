# 虚拟股票平台 - 开发指南

## 项目结构
- `frontend/` - Vue 3 + Vite 前端应用
- `backend/` - Node.js + Express 后端服务
- 每个目录都是独立的 npm 包，有自己的 package.json

## 关键命令

### 后端（backend/）
- 启动开发服务器: `npm run dev`（使用 --watch 自动重启）
- 生产启动: `npm start`
- 运行单元测试: `npm run test:unit`
- 运行集成测试: `npm run test:integration`
- 运行端到端测试: `npm run test:e2e`
- 运行所有测试: `npm test`
- 数据库初始化: `mysql -u root -p < backend/init.sql`

### 前端（frontend/）
- 启动开发服务器: `npm run dev`（Vite，默认端口 5173）
- 构建生产版本: `npm run build`（会自动触发版本号补丁更新）
- 预览构建: `npm run preview`
- 运行测试: `npm test`（Vitest）
- 运行测试带覆盖率: `npm run test:coverage`

### 全局命令
- 版本号更新: `node scripts/bump-version.js patch`（在 frontend 和 backend 构建时自动调用）

## 必要设置
1. 首次启动前必须初始化数据库（执行 backend/init.sql）
2. 后端需要环境变量：复制 backend/.env.example 为 backend/.env 并配置数据库连接
3. 前端和后端可以独立启动，但前端需要后端运行以获取 API 数据

## 注意事项
- 后端端口默认 3006（可通过 PORT 环境变量修改）
- 前端默认端口 5173（Vite 默认，但vite.config.js中配置了3000端口并代理API到后端）
- 构建命令会自动执行版本号更新，无需手动运行 bump-version.js
- 后端使用 CommonJS 模块系统（require），前端使用 ES 模块（import）
- 前端Vite配置已设置代理：/api 请求转发到 http://localhost:3006