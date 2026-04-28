/**
 * File: index.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Main route aggregator. Mounts all sub-routers under their respective paths:
 *   users, groups, stocks, trade, balance, positions, transactions, statistics, admin,
 *   about, and messages.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const router = express.Router()

router.use('/users', require('./users'))
router.use('/groups', require('./groups'))
router.use('/stocks', require('./stocks'))
router.use('/trade', require('./trade'))
router.use('/balance', require('./balance'))
router.use('/positions', require('./positions'))
router.use('/transactions', require('./transactions'))
router.use('/statistics', require('./statistics'))
router.use('/admin', require('./admin'))
router.use('/about', require('./about'))
router.use('/messages', require('./messages'))

module.exports = router