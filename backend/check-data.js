/**
 * File: check-data.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Data integrity check utility. Queries user balance and positions,
 *              sums total costs, and outputs results for verification.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const { UserBalance, Position } = require('./src/models')
const { Op } = require('sequelize')

/**
 * Checks data integrity by fetching user balance and active positions,
 * then summing position costs for verification.
 * @returns {Promise<void>}
 */
async function check() {
  try {
    const balance = await UserBalance.findOne({ where: { user_id: 1 } })
    console.log('Balance - cash:', balance.cash, 'total_cost:', balance.total_cost)
    
    const positions = await Position.findAll({ where: { user_id: 1, shares: { [Op.gt]: 0 } } })
    console.log('Position count:', positions.length)
    
    let totalCost = 0
    for (const p of positions) {
      console.log('Position:', p.stock_code, 'shares:', p.shares, 'cost:', p.total_cost)
      totalCost += parseFloat(p.total_cost)
    }
    console.log('Sum of positions cost:', totalCost)
    process.exit(0)
  } catch(e) {
    console.log('Error:', e.message)
    process.exit(1)
  }
}

check()