/**
 * File: index.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Application entry point. Configures Express middleware (CORS, JSON parsing,
 *   i18n), mounts API routes under /api/v1, and registers a global error handler.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const path = require('path')
const compression = require('compression')
const cors = require('cors')
const dotenv = require('dotenv')
const { i18nMiddleware } = require('./i18n/index.js')

dotenv.config()

const app = express()

app.use(compression())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(i18nMiddleware)

// 生产环境托管前端静态文件
const distPath = path.join(__dirname, '../../frontend/dist')
app.use(express.static(distPath))

app.use('/api/v1', require('./routes'))

// SPA 路由回退: 非 API 请求返回 index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'))
  }
})

app.use((err, req, res, next) => {
  console.error(err.stack)
  const message = res.t ? res.t('common.error') : 'Error'
  res.status(500).json({ code: -1, message: message })
})

// 启动调度管理器（从 DB 读取配置）
if (process.env.ENABLE_OPTION_SCHEDULER !== 'false') {
  try {
    require('./scheduler/optionScheduler').start()
    console.log('调度管理器已启动')
  } catch (e) {
    console.log('调度器启动失败:', e.message)
  }
}

const PORT = process.env.PORT || 3006
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})