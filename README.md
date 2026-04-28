# 虚拟炒股平台

一个基于 Vue 3 + Node.js 的虚拟股票交易平台。

## 项目结构

```
virtual-stock/
├── frontend/           # Vue前端项目
│   ├── src/
│   │   ├── api/       # API请求
│   │   ├── views/     # 页面组件
│   │   ├── store/     # 状态管理
│   │   ├── router/    # 路由配置
│   │   ├── utils/     # 工具函数
│   │   └── assets/    # 静态资源
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── backend/           # Node.js后端项目
│   ├── src/
│   │   ├── routes/   # 路由
│   │   ├── models/    # 数据模型
│   │   ├── services/  # 业务逻辑
│   │   └── utils/     # 工具函数
│   ├── config/        # 配置文件
│   ├── init.sql      # 数据库初始化脚本
│   ├── package.json
│   └── .env.example
├── doc/              # 设计文档
│   ├── 数据库设计文档.md
│   ├── API接口文档.md
│   ├── 常用股票清单.md
│   ├── 股价数据获取测试文档.md
│   └── 高级设计文档HLD.md
└── README.md
```

## 技术栈

### 前端
- Vue 3
- Vite
- Element Plus
- Pinia
- Vue Router
- Axios

### 后端
- Node.js
- Express
- MySQL
- Sequelize ORM
- JWT

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p < backend/init.sql
```

### 2. 配置后端

```bash
cd backend
cp .env.example .env
# 编辑 .env 配置数据库连接
npm install
npm start
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 默认管理员账号

- 用户名: admin
- 密码: admin123

## 默认邀请码

- 邀请码: DEFAULT2024