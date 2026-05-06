const { sequelize, StockPool, StockPrice, StockPricesCache, StockSyncRecord } = require('../models')
const { getHistory, runPythonBatchHKAKShare, runPythonBatchUSAKShare } = require('./stock')

const cancelFlags = new Map()

async function isCancelled(recordId) {
  if (cancelFlags.get(recordId)) return true
  const record = await StockSyncRecord.findByPk(recordId)
  return record && record.status === 'cancelled'
}

function setCancelled(recordId) {
  cancelFlags.set(recordId, true)
}

async function updateProgress(recordId, total, completed, success, fail, failedStocks, currentStock) {
  try {
    await StockSyncRecord.update({
      total_count: total,
      completed_count: completed,
      success_count: success,
      fail_count: fail,
      failed_stocks: JSON.stringify(failedStocks),
      current_stock: currentStock
    }, { where: { id: recordId } })
  } catch (err) {
    console.error('Update progress error:', err.message)
  }
}

async function updateCache(stock, marketType) {
  const latestTwo = await StockPrice.findAll({
    where: { stock_code: stock.stock_code, market_type: marketType },
    order: [['trade_date', 'DESC']],
    limit: 2
  })
  if (latestTwo.length > 0) {
    const last = latestTwo[0]
    const prev = latestTwo.length > 1 ? latestTwo[1] : null
    const prevClose = prev ? parseFloat(prev.close_price) : 0
    const closePrice = parseFloat(last.close_price) || 0
    await StockPricesCache.upsert({
      stock_code: stock.stock_code,
      market_type: marketType,
      stock_name: stock.stock_name,
      trade_date: last.trade_date,
      close_price: closePrice,
      prev_close: prevClose,
      change_percent: prevClose > 0 ? ((closePrice - prevClose) / prevClose * 100) : 0
    })
  }
}

async function startSync(marketType, recordId) {
  const startTime = Date.now()
  const today = new Date().toISOString().split('T')[0]

  try {
    const stocks = await StockPool.findAll({ where: { market_type: marketType } })
    const total = stocks.length
    await StockSyncRecord.update({ total_count: total }, { where: { id: recordId } })

    const rows = await sequelize.query(
      `SELECT stock_code, MAX(trade_date) as max_date FROM stock_prices WHERE market_type = ? GROUP BY stock_code`,
      { replacements: [marketType], type: sequelize.QueryTypes.SELECT }
    )
    const latestDateMap = {}
    for (const r of rows) {
      latestDateMap[r.stock_code] = r.max_date
    }

    const toSync = []
    for (const stock of stocks) {
      const maxDate = latestDateMap[stock.stock_code]
      if (maxDate) {
        const nextDay = new Date(maxDate)
        nextDay.setDate(nextDay.getDate() + 1)
        const startStr = nextDay.toISOString().split('T')[0]
        if (startStr > today) continue
        toSync.push({ ...stock.dataValues, startDate: startStr })
      } else {
        const oneYearAgo = new Date()
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        toSync.push({ ...stock.dataValues, startDate: oneYearAgo.toISOString().split('T')[0] })
      }
    }

    const upToDateCount = stocks.length - toSync.length
    let completed = upToDateCount, success = 0, fail = 0
    const failedStocks = []

    if (marketType === 1) {
      const CONCURRENCY = 8
      const queueA = [...toSync]
      let cancelledA = false
      await Promise.all(Array(CONCURRENCY).fill().map(async () => {
        while (queueA.length > 0 && !cancelledA) {
          if (await isCancelled(recordId)) { cancelledA = true; break }
          const stock = queueA.shift()
          try {
            const historyData = await getHistory(stock.stock_code, 1, stock.startDate, today)
            if (historyData && historyData.length > 0) {
              const records = historyData.map(d => ({
                stock_code: stock.stock_code,
                stock_name: stock.stock_name,
                market_type: 1,
                trade_date: d.tradeDate,
                open_price: d.openPrice,
                high_price: d.highPrice,
                low_price: d.lowPrice,
                close_price: d.closePrice,
                volume: d.volume
              }))
              await StockPrice.bulkCreate(records, { ignoreDuplicates: true, validate: false })
              await updateCache(stock, 1)
            }
            success++
          } catch (err) {
            fail++
            failedStocks.push({ stock_code: stock.stock_code, stock_name: stock.stock_name, error: err.message })
          }
          completed++
          await updateProgress(recordId, total, completed, success, fail, failedStocks, stock.stock_code)
        }
      }))
      if (cancelledA) {
        for (const s of queueA) {
          fail++
          failedStocks.push({ stock_code: s.stock_code, stock_name: s.stock_name, error: '任务已取消' })
          completed++
        }
        await updateProgress(recordId, total, completed, success, fail, failedStocks, '')
        throw new Error('SYNC_CANCELLED')
      }
    } else {
      const BATCH_SIZE = 5
      const CONCURRENCY = 3
      let abortReason = null
      const isHK = marketType === 2
      const batches = []
      for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
        batches.push(toSync.slice(i, i + BATCH_SIZE))
      }
      const queueB = [...batches]
      await Promise.all(Array(CONCURRENCY).fill().map(async () => {
        while (queueB.length > 0 && !abortReason) {
          if (await isCancelled(recordId)) { abortReason = 'cancelled'; break }
          const batch = queueB.shift()
          try {
            let results
            if (isHK) {
              const batchStocks = batch.map(s => ({ symbol: s.stock_code, start_date: s.startDate, end_date: today }))
              results = await runPythonBatchHKAKShare(batchStocks)
            } else {
              const batchStocks = batch.map(s => ({ symbol: s.stock_code, start_date: s.startDate, end_date: today }))
              results = await runPythonBatchUSAKShare(batchStocks)
            }
            for (const r of results) {
              const stock = batch.find(s => s.stock_code === r.symbol)
              if (!stock) { fail++; continue }
              const data = r.data
              if (data && data.error && /too many requests/i.test(data.error)) {
                abortReason = 'rate_limit'
                fail++
                failedStocks.push({ stock_code: stock.stock_code, stock_name: stock.stock_name, error: data.error })
                continue
              }
              if (data && Array.isArray(data) && data.length > 0) {
                const records = data.map(d => ({
                  stock_code: stock.stock_code,
                  stock_name: stock.stock_name,
                  market_type: marketType,
                  trade_date: d.trade_date,
                  open_price: d.open_price,
                  high_price: d.high_price,
                  low_price: d.low_price,
                  close_price: d.close_price,
                  volume: d.volume
                }))
                await StockPrice.bulkCreate(records, { ignoreDuplicates: true, validate: false })
                await updateCache(stock, marketType)
                success++
              } else if (data && data.error) {
                fail++
                failedStocks.push({ stock_code: stock.stock_code, stock_name: stock.stock_name, error: data.error })
              } else {
                success++
              }
            }
            if (abortReason) {
              const msg = abortReason === 'cancelled' ? '任务已取消' : '任务因限流终止'
              for (const s of batch) {
                if (!failedStocks.find(f => f.stock_code === s.stock_code)) {
                  fail++
                  failedStocks.push({ stock_code: s.stock_code, stock_name: s.stock_name, error: msg })
                }
              }
            }
          } catch (err) {
            for (const s of batch) {
              fail++
              failedStocks.push({ stock_code: s.stock_code, stock_name: s.stock_name, error: err.message })
            }
          }
          completed += batch.length
          await updateProgress(recordId, total, completed, success, fail, failedStocks, batch[batch.length - 1].stock_code)
        }
      }))
      if (abortReason) {
        for (const batch of queueB) {
          const msg = abortReason === 'cancelled' ? '任务已取消' : '任务因限流终止'
          for (const s of batch) {
            fail++
            failedStocks.push({ stock_code: s.stock_code, stock_name: s.stock_name, error: msg })
          }
          completed += batch.length
        }
        await updateProgress(recordId, total, completed, success, fail, failedStocks, '')
        throw new Error(abortReason === 'cancelled' ? 'SYNC_CANCELLED' : '请求频率过高被限流，任务终止')
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    await StockSyncRecord.update({
      status: 'completed',
      completed_count: completed,
      success_count: success,
      fail_count: fail,
      failed_stocks: JSON.stringify(failedStocks),
      current_stock: '',
      finished_at: new Date(),
      duration_sec: duration
    }, { where: { id: recordId } })
  } catch (err) {
    const isCancelledErr = err.message === 'SYNC_CANCELLED'
    if (!isCancelledErr) console.error('Sync error:', err.message)
    const duration = Math.floor((Date.now() - startTime) / 1000)
    await StockSyncRecord.update({
      status: isCancelledErr ? 'cancelled' : 'failed',
      finished_at: new Date(),
      duration_sec: duration
    }, { where: { id: recordId } })
  } finally {
    cancelFlags.delete(recordId)
  }
}

module.exports = { startSync, setCancelled }