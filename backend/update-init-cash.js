/**
 * File: update-init-cash.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Updates the initial cash balance (init_cash) for a user
 *              and displays the current balance information.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const { UserBalance, Position, Transaction } = require('./src/models')

/**
 * Updates the init_cash field for user with ID 1 to 7,000,000 CNY.
 * @returns {Promise<void>}
 */
async function updateInitCash() {
  try {
    const userId = 1
    
    await UserBalance.update(
      { init_cash: 7000000 },
      { where: { user_id: userId } }
    )
    console.log('Updated init_cash to 7000000')

    const balance = await UserBalance.findOne({ where: { user_id: userId } })
    console.log('Current balance:', balance.cash, 'init_cash:', balance.init_cash)

    process.exit(0)
  } catch(e) {
    console.log('Error:', e.message)
    process.exit(1)
  }
}

updateInitCash()