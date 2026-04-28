const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const { i18nMiddleware } = require('./i18n/index.js')

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(i18nMiddleware)

app.use('/api/v1', require('./routes'))

app.use((err, req, res, next) => {
  console.error(err.stack)
  const message = res.t ? res.t('common.error') : 'Error'
  res.status(500).json({ code: -1, message: message })
})

const PORT = process.env.PORT || 3006
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})