const { pinyin } = require('pinyin-pro')
const { Sequelize } = require('sequelize')
const config = require('../config/database')

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
})

async function run() {
  const [rows] = await sequelize.query('SELECT id, stock_name FROM stock_pools')
  console.log(`Found ${rows.length} stocks to update`)

  for (const row of rows) {
    const abbr = pinyin(row.stock_name, { pattern: 'first', type: 'array' }).join('').toUpperCase()
    await sequelize.query('UPDATE stock_pools SET pinyin_abbr = ? WHERE id = ?', {
      replacements: [abbr, row.id]
    })
  }
  console.log('Done')
  await sequelize.close()
}

run().catch(err => { console.error(err.message); process.exit(1) })
