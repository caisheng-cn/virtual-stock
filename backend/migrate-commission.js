const mysql = require('mysql2/promise')

async function runMigration() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'virtual_stock',
    multipleStatements: true
  })

  console.log('=== 佣金功能数据库迁移 ===\n')

  console.log('1. 创建 commission_configs 表...')
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS commission_configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        market_type TINYINT NOT NULL,
        trade_type TINYINT NOT NULL,
        commission_rate DECIMAL(10,6) NOT NULL DEFAULT 0.005,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_market_trade (market_type, trade_type)
      )
    `)
    console.log('[+] commission_configs 表创建成功')
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('[=] commission_configs 表已存在')
    } else {
      throw err
    }
  }

  console.log('\n2. 修改 transactions 表添加佣金字段...')
  try {
    await connection.query(`
      ALTER TABLE transactions 
      ADD COLUMN commission DECIMAL(15,2) DEFAULT 0,
      ADD COLUMN commission_rate DECIMAL(10,6) DEFAULT 0
    `)
    console.log('[+] transactions 表字段添加成功')
  } catch (err) {
    if (err.message.includes('Duplicate')) {
      console.log('[=] transactions 表字段已存在')
    } else {
      console.log('[!] 错误:', err.message)
    }
  }

  console.log('\n3. 初始化佣金配置数据...')
  const commissionRates = [
    { market: 1, trade: 1, rate: 0.0005, desc: 'A股买入 万分之5' },
    { market: 1, trade: 2, rate: 0.0005, desc: 'A股卖出 万分之5' },
    { market: 2, trade: 1, rate: 0.001, desc: '港股买入 千分之1' },
    { market: 2, trade: 2, rate: 0.001, desc: '港股卖出 千分之1' },
    { market: 3, trade: 1, rate: 0.005, desc: '美股买入 千分之5' },
    { market: 3, trade: 2, rate: 0.005, desc: '美股卖出 千分之5' }
  ]

  for (const c of commissionRates) {
    try {
      await connection.query(
        'INSERT INTO commission_configs (market_type, trade_type, commission_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate)',
        [c.market, c.trade, c.rate]
      )
      console.log(`[+] ${c.desc}`)
    } catch (err) {
      console.log(`[!] ${c.desc}: ${err.message}`)
    }
  }

  console.log('\n4. 验证数据...')
  const [configs] = await connection.query('SELECT * FROM commission_configs ORDER BY market_type, trade_type')
  console.log('\n当前佣金配置:')
  console.table(configs.map(c => ({
    市场: c.market_type === 1 ? 'A股' : c.market_type === 2 ? '港股' : '美股',
    交易类型: c.trade_type === 1 ? '买入' : '卖出',
    佣金比例: (c.commission_rate * 100).toFixed(4) + '%',
    比例值: c.commission_rate
  })))

  await connection.end()
  console.log('\n=== 迁移完成 ===')
}

runMigration().catch(console.error)