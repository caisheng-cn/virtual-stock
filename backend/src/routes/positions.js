/**
 * File: positions.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: User position routes. Lists all positions (holdings) for the authenticated
 *   user with current market value, floating profit/loss, and currency conversion.
 * Version History:
 *   v1.0 - Initial version
 */

const express = require('express')
const { Position, UserBalance, StockPool, sequelize } = require('../models')
const { Op } = require('sequelize')
const auth = require('../utils/auth')
const stockService = require('../services/stock')
const { toCNY, fromCNY, getCurrencySymbol } = require('../utils/currency')

const router = express.Router()

/**
 * GET /api/v1/positions
 * List all positions (holdings) for the authenticated user with current market values.
 * Each position includes floating profit/loss, currency symbol, and cost basis in both
 * original and CNY denominations.
 * Response: { code, data: Array<{ stockCode, stockName, shares, avgCost, currentPrice, marketValue, floatingProfit, ... }> }
 */
router.get('/', auth, async (req, res) => {
  try {
    const hasCreatedAt = await checkColumnExists('positions', 'created_at')
    
    const positions = await Position.findAll({ 
      where: { user_id: req.userId, shares: { [Op.gt]: 0 } },
      order: hasCreatedAt ? [['created_at', 'DESC']] : [['id', 'DESC']]
    })

    const result = []
    for (const p of positions) {
      let stockName = p.stock_code
      try {
        const pool = await StockPool.findOne({ where: { stock_code: p.stock_code, market_type: p.market_type } })
        if (pool && pool.stock_name) {
          stockName = pool.stock_name
        }
      } catch (e) {}

      try {
        const quote = await stockService.getQuote(p.stock_code, p.market_type)
        if (quote.stockName && quote.stockName.length > 3 && quote.stockName !== p.stock_code) {
          stockName = quote.stockName
        }
        
        const priceInCNY = toCNY(quote.price, p.market_type)
        const marketValue = p.shares * priceInCNY
        const marketValueOriginal = p.shares * quote.price
        
        const floatingProfit = marketValue - parseFloat(p.total_cost)
        const floatingProfitRate = parseFloat(p.total_cost) > 0 ? (floatingProfit / parseFloat(p.total_cost)) * 100 : 0
        const currency = getCurrencySymbol(p.market_type)

        const avgCostOriginal = p.market_type === 1 ? parseFloat(p.avg_cost) : fromCNY(parseFloat(p.avg_cost), p.market_type)
        const totalCostOriginal = p.market_type === 1 ? parseFloat(p.total_cost) : fromCNY(parseFloat(p.total_cost), p.market_type)

        result.push({
          id: p.id,
          stockCode: p.stock_code,
          stockName: stockName,
          marketType: p.market_type,
          currency,
          shares: p.shares,
          avgCost: avgCostOriginal,
          totalCost: totalCostOriginal,
          avgCostCNY: parseFloat(p.avg_cost),
          totalCostCNY: parseFloat(p.total_cost),
          currentPrice: quote.price,
          currentPriceCNY: priceInCNY,
          marketValue: marketValue,
          marketValueOriginal: marketValueOriginal,
          floatingProfit: floatingProfit,
          floatingProfitRate: floatingProfitRate,
          createdAt: hasCreatedAt && p.created_at ? p.created_at : new Date()
        })
      } catch (err) {
        console.log('Position quote error:', err.message, p.stock_code)
        const currency = getCurrencySymbol(p.market_type)
        const avgCostOriginal = p.market_type === 1 ? parseFloat(p.avg_cost) : fromCNY(parseFloat(p.avg_cost), p.market_type)
        const totalCostOriginal = p.market_type === 1 ? parseFloat(p.total_cost) : fromCNY(parseFloat(p.total_cost), p.market_type)
        result.push({
          id: p.id,
          stockCode: p.stock_code,
          stockName: stockName,
          marketType: p.market_type,
          currency,
          shares: p.shares,
          avgCost: avgCostOriginal,
          totalCost: totalCostOriginal,
          avgCostCNY: parseFloat(p.avg_cost),
          totalCostCNY: parseFloat(p.total_cost),
          currentPrice: 0,
          currentPriceCNY: 0,
          marketValue: 0,
          marketValueOriginal: 0,
          floatingProfit: -parseFloat(p.total_cost),
          floatingProfitRate: -100,
          createdAt: hasCreatedAt && p.created_at ? p.created_at : new Date()
        })
      }
    }

    res.json({ code: 0, data: result })
  } catch (err) {
    res.json({ code: -1, message: err.message })
  }
})

/**
 * Check whether a column exists in a database table by attempting a SELECT query.
 * @param {string} table - The table name
 * @param {string} column - The column name
 * @returns {Promise<boolean>} True if the column exists
 */
async function checkColumnExists(table, column) {
  try {
    const [results] = await sequelize.query(`SELECT ${column} FROM ${table} LIMIT 1`)
    return true
  } catch (e) {
    return false
  }
}

module.exports = router