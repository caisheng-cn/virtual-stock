const mysql = require('mysql2/promise')
const fs = require('fs')

async function runMigration() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'virtual_stock',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  }

  const connection = await mysql.createConnection(config)

  try {
    const sql = fs.readFileSync('./migration-admin.sql', 'utf8')
    const statements = sql.split(';').filter(s => s.trim())

    for (const stmt of statements) {
      if (stmt.trim()) {
        console.log('Executing:', stmt.substring(0, 50) + '...')
        await connection.query(stmt)
      }
    }

    console.log('Migration completed successfully!')
  } catch (err) {
    console.error('Migration error:', err.message)
  } finally {
    await connection.end()
  }
}

runMigration()