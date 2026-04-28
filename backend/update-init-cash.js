const { UserBalance, Position, Transaction } = require('./src/models')

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