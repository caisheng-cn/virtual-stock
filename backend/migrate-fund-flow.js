const { sequelize, UserBalance, Transaction } = require('./src/models')

async function migrate() {
  try {
    const balances = await UserBalance.findAll()
    let added = 0

    for (const b of balances) {
      const existing = await Transaction.findOne({
        where: { user_id: b.user_id, trade_type: 5 }
      })
      if (existing) continue

      const initCash = parseFloat(b.init_cash) || parseFloat(b.cash) || 7000000

      await Transaction.create({
        user_id: b.user_id,
        group_id: 0,
        stock_code: '',
        stock_name: '',
        market_type: 0,
        trade_type: 5,
        price: 0,
        shares: 0,
        amount: initCash,
        commission: 0,
        commission_rate: 0,
        balance_after: initCash,
        profit: 0,
        trade_date: new Date().toISOString().split('T')[0],
        status: 1
      })
      added++
    }

    console.log(`Migration complete: added ${added} initial fund records`)
  } catch (err) {
    console.error('Migration error:', err.message)
  } finally {
    await sequelize.close()
  }
}

migrate()
