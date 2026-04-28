const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const VERSION_FILE = path.join(__dirname, '../../../../version.json')

function getVersion() {
  try {
    const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'))
    return data
  } catch (e) {
    return { version: '1.0.5', copyright: 'CAI', changelog: [] }
  }
}

router.get('/', async (req, res) => {
  const version = getVersion()
  res.json({ code: 0, data: version })
})

router.get('/check', async (req, res) => {
  const version = getVersion()
  res.json({ code: 0, data: { version: version.version } })
})

module.exports = router