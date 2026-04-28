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