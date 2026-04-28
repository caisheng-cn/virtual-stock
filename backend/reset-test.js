const { sequelize, User, UserBalance, Position, Transaction } = require('./src/models')
const { QueryTypes } = require('sequelize')

async function resetTestUser() {
  try {
    await sequelize.authenticate()
    console.log('Database connected')

    // Find testuser
    const user = await User.findOne({ where: { username: 'testuser' } })
    if (!user) {
      console.log('User testuser not found')
      process.exit(1)
    }
    const userId = user.id
    console.log('Found testuser, id:', userId)

    // Delete transactions
    const deletedTx = await Transaction.destroy({ where: { user_id: userId } })
    console.log('Deleted transactions:', deletedTx)

    // Delete positions
    const deletedPos = await Position.destroy({ where: { user_id: userId } })
    console.log('Deleted positions:', deletedPos)

    // Reset balance to 100万 USD = 700万 CNY
    const initialBalance = 7000000
    await UserBalance.update(
      { cash: initialBalance, total_cost: 0 },
      { where: { user_id: userId } }
    )
    console.log('Reset balance to:', initialBalance, 'CNY')

    // Verify
    const balance = await UserBalance.findOne({ where: { user_id: userId } })
    console.log('Current balance:', balance.cash)
    console.log('Current total_cost:', balance.total_cost)

    console.log('\n=== Reset completed ===')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

resetTestUser()