/**
 * File: about.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Application info routes. Provides version information and health check
 *   endpoints by reading from the version.json file.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const fs = require('fs')
const path = require('path')

const router = express.Router()

const VERSION_FILE = path.join(__dirname, '../../../../version.json')

/**
 * Read the version.json file and return version information.
 * @returns {{ version: string, copyright: string, changelog: Array }} Version data object
 */
function getVersion() {
  try {
    const data = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'))
    return data
  } catch (e) {
    return { version: '1.0.5', copyright: 'CAI', changelog: [] }
  }
}

/**
 * GET /api/v1/about
 * Get full application version information.
 * Response: { code, data: { version, copyright, changelog } }
 */
router.get('/', async (req, res) => {
  const version = getVersion()
  res.json({ code: 0, data: version })
})

/**
 * GET /api/v1/about/check
 * Health check endpoint returning just the version number.
 * Response: { code, data: { version } }
 */
router.get('/check', async (req, res) => {
  const version = getVersion()
  res.json({ code: 0, data: { version: version.version } })
})

module.exports = router