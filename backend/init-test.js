/**
 * File: init-test.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Test data initialization script. Creates admin user, test users,
 *              groups, user-group associations, balances, positions, stock pools,
 *              invite codes, and commission configs in the database.
 * Version History:
 *   - 2024-01-01: Initial version
 */

const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')

/**
 * Exchange rate constants for currency conversion.
 * @constant {Object}
 * @property {number} USD_TO_CNY - US Dollar to Chinese Yuan rate
 * @property {number} HKD_TO_CNY - Hong Kong Dollar to Chinese Yuan rate
 */
const EXCHANGE_RATES = {
  USD_TO_CNY: 7,
  HKD_TO_CNY: 0.9
}

const A_STOCKS = [
  ['600519', '贵州茅台', 1],
  ['000858', '五粮液', 1],
  ['600036', '招商银行', 1],
  ['601318', '中国平安', 1],
  ['600887', '伊利股份', 1],
  ['000333', '美的集团', 1],
  ['000651', '格力电器', 1],
  ['601398', '工商银行', 1],
  ['601939', '建设银行', 1],
  ['601288', '农业银行', 1],
  ['601988', '中国银行', 1],
  ['600030', '中信证券', 1],
  ['600900', '长江电力', 1],
  ['600276', '恒瑞医药', 1],
  ['000002', '万科A', 1],
  ['600028', '中国石化', 1],
  ['600104', '上汽集团', 1],
  ['601857', '中国石油', 1],
  ['600031', '三一重工', 1],
  ['000001', '平安银行', 1],
  ['002594', '比亚迪', 1],
  ['002475', '立讯精密', 1],
  ['600309', '万华化学', 1],
  ['601888', '中国中免', 1],
  ['002415', '海康威视', 1],
  ['300750', '宁德时代', 1],
  ['300059', '东方财富', 1],
  ['002230', '科大讯飞', 1],
  ['002412', '汉森制药', 1],
  ['300015', '爱尔眼科', 1],
  ['000725', '京东方A', 1],
  ['002236', '大华股份', 1],
  ['000063', '中兴通讯', 1],
  ['300033', '同花顺', 1],
  ['300454', '网宿科技', 1],
  ['600570', '恒生电子', 1],
  ['600588', '用友网络', 1],
  ['600845', '宝信软件', 1],
  ['002410', '广联达', 1],
  ['300124', '长盈精密', 1],
  ['002439', '启明星辰', 1],
  ['300676', '华大基因', 1],
  ['002371', '北方华创', 1],
  ['002463', '沪电股份', 1],
  ['603019', '中科曙光', 1],
  ['603501', '兆易创新', 1],
  ['300761', '华测检测', 1],
  ['002456', '欧菲光', 1],
  ['300408', '三环集团', 1],
  ['002916', '深南电路', 1]
]

const HK_STOCKS = [
  ['00700', '腾讯控股', 2],
  ['09988', '阿里巴巴-SW', 2],
  ['00939', '建设银行-SW', 2],
  ['00981', '中移动-SW', 2],
  ['01398', '工商银行-SW', 2],
  ['01810', '小米集团-W', 2],
  ['03690', '美团-W', 2],
  ['02318', '中国平安-SW', 2],
  ['02269', '药明生物', 2],
  ['00005', '汇丰控股', 2],
  ['00788', '中国铁塔-SW', 2],
  ['06808', '京东健康', 2],
  ['03888', '泡泡玛特', 2],
  ['06618', '京东集团-SW', 2],
  ['09618', '百度集团-SW', 2],
  ['09868', '小鹏汽车-W', 2],
  ['02570', '理想汽车-W', 2],
  ['02018', '舜宇光学科技', 2],
  ['02331', '申洲国际', 2],
  ['01179', '中国生物制药', 2],
  ['02201', '药明康德', 2],
  ['00175', '吉利汽车', 2],
  ['02333', '长安汽车', 2],
  ['02628', '中国人寿', 2],
  ['02669', '中国财险', 2],
  ['03968', '招商银行-SW', 2],
  ['06886', '银河证券', 2],
  ['01788', '国泰君安国际', 2],
  ['01114', '友邦保险', 2],
  ['01093', '石药集团', 2],
  ['01911', '中国中铁', 2],
  ['02601', '中国太保-SW', 2],
  ['01299', '百济神州', 2],
  ['01038', '长江基建', 2],
  ['01088', '中国神华', 2],
  ['00003', '中银香���', 2],
  ['00688', '新鸿基地产', 2],
  ['00101', '恒生银行', 2],
  ['02382', '舜宇光学', 2],
  ['00178', '丘钛科技', 2],
  ['01928', '中国建筑国际', 2],
  ['02552', '维达国际', 2],
  ['00322', '维他奶国际', 2],
  ['00267', '中信股份', 2],
  ['00086', '新鸿基公司', 2],
  ['06862', '海底捞', 2],
  ['03606', '奈雪', 2],
  ['21186', '万物云', 2]
]

const US_STOCKS = [
  ['AAPL', 'Apple Inc.', 3],
  ['MSFT', 'Microsoft Corp.', 3],
  ['GOOGL', 'Alphabet Inc.', 3],
  ['AMZN', 'Amazon.com Inc.', 3],
  ['NVDA', 'NVIDIA Corp.', 3],
  ['TSLA', 'Tesla Inc.', 3],
  ['META', 'Meta Platforms Inc.', 3],
  ['BRK.B', 'Berkshire Hathaway', 3],
  ['JPM', 'JPMorgan Chase', 3],
  ['V', 'Visa Inc.', 3],
  ['JNJ', 'Johnson & Johnson', 3],
  ['WMT', 'Walmart Inc.', 3],
  ['PG', 'Procter & Gamble', 3],
  ['MA', 'Mastercard Inc.', 3],
  ['UNH', 'UnitedHealth Group', 3],
  ['HD', 'Home Depot Inc.', 3],
  ['DIS', 'Walt Disney Co.', 3],
  ['BAC', 'Bank of America', 3],
  ['NFLX', 'Netflix Inc.', 3],
  ['ADBE', 'Adobe Inc.', 3],
  ['CRM', 'Salesforce Inc.', 3],
  ['INTC', 'Intel Corp.', 3],
  ['AMD', 'AMD Inc.', 3],
  ['CSCO', 'Cisco Systems', 3],
  ['PEP', 'PepsiCo Inc.', 3],
  ['KO', 'Coca-Cola Co.', 3],
  ['NKE', 'Nike Inc.', 3],
  ['MRK', 'Merck & Co.', 3],
  ['PFE', 'Pfizer Inc.', 3],
  ['TMO', 'Thermo Fisher', 3],
  ['BA', 'Boeing Co.', 3],
  ['CAT', 'Caterpillar Inc.', 3],
  ['CVX', 'Chevron Corp.', 3],
  ['XOM', 'Exxon Mobil', 3],
  ['IBM', 'IBM Corp.', 3],
  ['GE', 'General Electric', 3],
  ['MMM', '3M Co.', 3],
  ['GS', 'Goldman Sachs', 3],
  ['MS', 'Morgan Stanley', 3],
  ['AXP', 'American Express', 3],
  ['COIN', 'Coinbase Global', 3],
  ['PYPL', 'PayPal Holdings', 3],
  ['SQ', 'Block Inc.', 3],
  ['UBER', 'Uber Technologies', 3],
  ['ABNB', 'Airbnb Inc.', 3],
  ['SNAP', 'Snap Inc.', 3],
  ['SPOT', 'Spotify Technology', 3],
  ['LYFT', 'Lyft Inc.', 3],
  ['ZM', 'Zoom Video', 3],
  ['DOCU', 'DocuSign Inc.', 3]
]

/**
 * Main initialization routine.
 * Creates admin account, test user, groups, stock pools, invite codes,
 * and commission configuration. Inserts A-share, HK, and US stock data.
 * @returns {Promise<void>}
 */
async function init() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'virtual_stock'
  })

  console.log('=== 虚拟炒股平台数据库初始化 ===\n')

  const hashedPassword = await bcrypt.hash('admin123', 10)
  const userPassword = await bcrypt.hash('123456', 10)

  const existingAdmin = await connection.query('SELECT id FROM admin_users WHERE username = ?', ['admin'])
  if (existingAdmin[0].length === 0) {
    await connection.query(
      'INSERT INTO admin_users (username, password, status) VALUES (?, ?, ?)',
      ['admin', hashedPassword, 1]
    )
    console.log('[+] 管理员账号已创建: admin / admin123')
  } else {
    await connection.query(
      'UPDATE admin_users SET password = ? WHERE username = ?',
      [hashedPassword, 'admin']
    )
    console.log('[+] 管理员密码已更新: admin / admin123')
  }

  console.log('\n--- 创建测试群组 ---')
  const group1CashUSD = 1000000
  const group1CashCNY = group1CashUSD * EXCHANGE_RATES.USD_TO_CNY
  const group2CashUSD = 500000
  const group2CashCNY = group2CashUSD * EXCHANGE_RATES.USD_TO_CNY

  const existingGroup1 = await connection.query('SELECT id FROM `groups` WHERE name = ?', ['竞赛一班'])
  if (existingGroup1[0].length === 0) {
    await connection.query(
      'INSERT INTO `groups` (name, init_cash, currency) VALUES (?, ?, ?)',
      ['竞赛一班', group1CashCNY, 'USD']
    )
    console.log(`[+] 群组1已创建: 竞赛一班 (初始化资金: ${group1CashUSD} USD = ${group1CashCNY} CNY)`)
  } else {
    console.log('[=] 群组1已存在: 竞赛一班')
  }

  const existingGroup2 = await connection.query('SELECT id FROM `groups` WHERE name = ?', ['竞赛二班'])
  if (existingGroup2[0].length === 0) {
    await connection.query(
      'INSERT INTO `groups` (name, init_cash, currency) VALUES (?, ?, ?)',
      ['竞赛二班', group2CashCNY, 'USD']
    )
    console.log(`[+] 群组2已创建: 竞赛二班 (初始化资金: ${group2CashUSD} USD = ${group2CashCNY} CNY)`)
  } else {
    console.log('[=] 群组2已存在: 竞赛二班')
  }

  console.log('\n--- 创建/更新测试用户 ---')
  const existingUser = await connection.query('SELECT id FROM users WHERE username = ?', ['testuser'])
  if (existingUser[0].length === 0) {
    await connection.query(
      'INSERT INTO users (username, password, nickname, status) VALUES (?, ?, ?, ?)',
      ['testuser', userPassword, '测试用户', 1]
    )
    console.log('[+] 测试用户已创建: testuser / 123456')
  } else {
    await connection.query(
      'UPDATE users SET password = ? WHERE username = ?',
      [userPassword, 'testuser']
    )
    console.log('[=] 测试用户已存在: testuser / 123456')
  }

  console.log('\n--- 关联测试用户到群组 ---')
  const [group1Result] = await connection.query('SELECT id FROM `groups` WHERE name = ?', ['竞赛一班'])
  const [group2Result] = await connection.query('SELECT id FROM `groups` WHERE name = ?', ['竞赛二班'])
  const [userResult] = await connection.query('SELECT id FROM users WHERE username = ?', ['testuser'])

  if (userResult.length > 0) {
    const userId = userResult[0].id
    const group1Id = group1Result[0].id
    const group2Id = group2Result[0].id

    const existingUG1 = await connection.query(
      'SELECT id FROM user_groups WHERE user_id = ? AND group_id = ?',
      [userId, group1Id]
    )
    if (existingUG1[0].length === 0) {
      await connection.query(
        'INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)',
        [userId, group1Id]
      )
      console.log(`[+] testuser 已加入群组: 竞赛一班`)
    } else {
      console.log(`[=] testuser 已在群组: 竞赛一班`)
    }

    const existingUG2 = await connection.query(
      'SELECT id FROM user_groups WHERE user_id = ? AND group_id = ?',
      [userId, group2Id]
    )
    if (existingUG2[0].length === 0) {
      await connection.query(
        'INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)',
        [userId, group2Id]
      )
      console.log(`[+] testuser 已加入群组: 竞赛二班`)
    } else {
      console.log(`[=] testuser 已在群组: 竞赛二班`)
    }

    console.log('\n--- 初始化用户资金 ---')
    const existingBalance = await connection.query(
      'SELECT id FROM user_balance WHERE user_id = ?',
      [userId]
    )
    if (existingBalance[0].length === 0) {
      await connection.query(
        'INSERT INTO user_balance (user_id, cash, frozen_cash, total_cost) VALUES (?, ?, ?, ?)',
        [userId, group1CashCNY + group2CashCNY, 0, 0]
      )
      console.log(`[+] 资金已初始化: ${group1CashCNY + group2CashCNY} CNY`)
    } else {
      console.log(`[=] 资金已存在`)
    }
  }

  console.log('\n--- 初始化股票池 ---')
  await connection.query('DELETE FROM stock_pools')
  console.log('[+] 已清空股票池')

  console.log('\n正在录入A股股票...')
  for (const stock of A_STOCKS) {
    await connection.query(
      'INSERT INTO stock_pools (stock_code, stock_name, market_type, status) VALUES (?, ?, ?, 1)',
      stock
    )
  }
  console.log(`[+] A股股票已录入: ${A_STOCKS.length} 只`)

  console.log('\n正在录入港股股票...')
  for (const stock of HK_STOCKS) {
    await connection.query(
      'INSERT INTO stock_pools (stock_code, stock_name, market_type, status) VALUES (?, ?, ?, 1)',
      stock
    )
  }
  console.log(`[+] 港股股票已录入: ${HK_STOCKS.length} 只`)

  console.log('\n正在录入美股股票...')
  for (const stock of US_STOCKS) {
    await connection.query(
      'INSERT INTO stock_pools (stock_code, stock_name, market_type, status) VALUES (?, ?, ?, 1)',
      stock
    )
  }
  console.log(`[+] 美股股票已录入: ${US_STOCKS.length} 只`)

  console.log('\n--- 创建测试邀请码 ---')
  const existingInvite = await connection.query('SELECT id FROM invite_codes WHERE code = ?', ['DEFAULT2024'])
  if (existingInvite[0].length === 0) {
    await connection.query(
      'INSERT INTO invite_codes (code, group_id, use_limit, status) VALUES (?, ?, ?, ?)',
      ['DEFAULT2024', group1Result[0].id, 100, 1]
    )
    console.log('[+] 邀请码已创建: DEFAULT2024 -> 竞赛一班')
  } else {
    console.log('[=] 邀请码已存在: DEFAULT2024')
  }

  console.log('\n--- 初始化佣金配置 ---')
  const commissionRates = [
    { market: 1, trade: 1, rate: 0.0005, desc: 'A股买入 万分之5' },
    { market: 1, trade: 2, rate: 0.0005, desc: 'A股卖出 万分之5' },
    { market: 2, trade: 1, rate: 0.001, desc: '港股买入 千分之1' },
    { market: 2, trade: 2, rate: 0.001, desc: '港股卖出 千分之1' },
    { market: 3, trade: 1, rate: 0.005, desc: '美股买入 千分之5' },
    { market: 3, trade: 2, rate: 0.005, desc: '美股卖出 千分之5' }
  ]

  for (const c of commissionRates) {
    await connection.query(
      'INSERT INTO commission_configs (market_type, trade_type, commission_rate) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE commission_rate = VALUES(commission_rate)',
      [c.market, c.trade, c.rate]
    )
    console.log(`[+] ${c.desc}`)
  }

  await connection.end()

  console.log('\n=== 初始化完成 ===')
  console.log('\n测试账号信息:')
  console.log('  用户: testuser / 123456')
  console.log('  管理员: admin / admin123')
  console.log(`  群组1: 竞赛一班 (100万美元 = ${group1CashCNY} CNY)`)
  console.log(`  群组2: 竞赛二班 (50万美元 = ${group2CashCNY} CNY)`)
  console.log(`  账户总资金: ${group1CashCNY + group2CashCNY} CNY`)
  console.log(`  股票池: A股${A_STOCKS.length}只 + 港股${HK_STOCKS.length}只 + 美股${US_STOCKS.length}只 = ${A_STOCKS.length + HK_STOCKS.length + US_STOCKS.length}只`)
}

init().catch(console.error)