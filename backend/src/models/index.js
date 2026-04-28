const { Sequelize, DataTypes } = require('sequelize')
const config = require('../../config/database')

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  pool: config.pool,
  logging: false
})

const User = sequelize.define('User', {
   id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
   username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
   password: { type: DataTypes.STRING(255), allowNull: false },
   nickname: { type: DataTypes.STRING(50) },
   email: { type: DataTypes.STRING(100) },
   phone: { type: DataTypes.STRING(20) },
   status: { type: DataTypes.TINYINT, defaultValue: 1 },
   trade_enabled: { type: DataTypes.TINYINT, defaultValue: 1 },
   admin_access: { type: DataTypes.TINYINT, defaultValue: 0 },
   last_trade_date: { type: DataTypes.DATEONLY },
   language: { type: DataTypes.STRING(10), defaultValue: 'zh-CN' },
   created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
   updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'users', timestamps: false })

const Group = sequelize.define('Group', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  description: { type: DataTypes.STRING(500) },
  init_cash: { type: DataTypes.DECIMAL(15, 2), defaultValue: 100000.00 },
  currency: { type: DataTypes.STRING(10), defaultValue: 'USD' },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'groups', timestamps: false })

const UserGroup = sequelize.define('UserGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  group_id: { type: DataTypes.INTEGER, allowNull: false },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  last_read_message_id: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'user_groups', timestamps: false })

const UserBalance = sequelize.define('UserBalance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  group_id: { type: DataTypes.INTEGER, allowNull: false },
  cash: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  frozen_cash: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  total_cost: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  init_cash: { type: DataTypes.DECIMAL(15, 2), defaultValue: 7000000 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'user_balance', timestamps: false })

const Position = sequelize.define('Position', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  stock_code: { type: DataTypes.STRING(20), allowNull: false },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  group_id: { type: DataTypes.INTEGER, defaultValue: 0 },
  shares: { type: DataTypes.INTEGER, defaultValue: 0 },
  avg_cost: { type: DataTypes.DECIMAL(15, 4), defaultValue: 0 },
  total_cost: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'positions', timestamps: false })

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  group_id: { type: DataTypes.INTEGER, defaultValue: 0 },
  stock_code: { type: DataTypes.STRING(20), allowNull: false },
  stock_name: { type: DataTypes.STRING(100) },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  trade_type: { type: DataTypes.TINYINT, allowNull: false },
  price: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  shares: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  commission: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  commission_rate: { type: DataTypes.DECIMAL(10, 6), defaultValue: 0 },
  balance_after: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  profit: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  trade_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'transactions', timestamps: false })

const StockPool = sequelize.define('StockPool', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code: { type: DataTypes.STRING(20), allowNull: false },
  stock_name: { type: DataTypes.STRING(100), allowNull: false },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'stock_pools', timestamps: false })

const StockPrice = sequelize.define('StockPrice', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  stock_code: { type: DataTypes.STRING(20), allowNull: false },
  stock_name: { type: DataTypes.STRING(100) },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  trade_date: { type: DataTypes.DATEONLY, allowNull: false },
  open_price: { type: DataTypes.DECIMAL(15, 4) },
  high_price: { type: DataTypes.DECIMAL(15, 4) },
  low_price: { type: DataTypes.DECIMAL(15, 4) },
  close_price: { type: DataTypes.DECIMAL(15, 4) },
  prev_close: { type: DataTypes.DECIMAL(15, 4) },
  volume: { type: DataTypes.BIGINT },
  amount: { type: DataTypes.DECIMAL(20, 2) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'stock_prices', timestamps: false })

const StockPricesCache = sequelize.define('StockPricesCache', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code: { type: DataTypes.STRING(20), allowNull: false },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  trade_date: { type: DataTypes.DATEONLY, allowNull: false },
  close_price: { type: DataTypes.DECIMAL(15, 4) },
  prev_close: { type: DataTypes.DECIMAL(15, 4) },
  change_percent: { type: DataTypes.DECIMAL(10, 4) },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'stock_prices_cache', timestamps: false })

const InviteCode = sequelize.define('InviteCode', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  group_id: { type: DataTypes.INTEGER, allowNull: false },
  expire_date: { type: DataTypes.DATEONLY },
  use_limit: { type: DataTypes.INTEGER },
  used_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'invite_codes', timestamps: false })

const AdminUser = sequelize.define('AdminUser', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  permissions: { type: DataTypes.STRING(500), defaultValue: '' },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'admin_users', timestamps: false })

const CommissionConfig = sequelize.define('CommissionConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  trade_type: { type: DataTypes.TINYINT, allowNull: false },
  commission_rate: { type: DataTypes.DECIMAL(10, 6), allowNull: false, defaultValue: 0.5 },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'commission_configs', timestamps: false })

const LoginHistory = sequelize.define('LoginHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  login_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ip_address: { type: DataTypes.STRING(50) },
  user_agent: { type: DataTypes.STRING(255) }
}, { tableName: 'login_history', timestamps: false })

const MarketConfig = sequelize.define('MarketConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  refresh_time: { type: DataTypes.STRING(10) },
  trade_start: { type: DataTypes.STRING(10) },
  trade_end: { type: DataTypes.STRING(10) },
  enabled: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'market_config', timestamps: false })

const CommissionHistory = sequelize.define('CommissionHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  trade_type: { type: DataTypes.TINYINT, allowNull: false },
  old_rate: { type: DataTypes.DECIMAL(10, 6), allowNull: false },
  new_rate: { type: DataTypes.DECIMAL(10, 6), allowNull: false },
  changed_by: { type: DataTypes.INTEGER, allowNull: false },
  changed_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  remark: { type: DataTypes.STRING(200) }
}, { tableName: 'commission_history', timestamps: false })

const GroupMessage = sequelize.define('GroupMessage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  group_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  message_type: { type: DataTypes.TINYINT, allowNull: false },
  stock_code: { type: DataTypes.STRING(20) },
  stock_name: { type: DataTypes.STRING(100) },
  market_type: { type: DataTypes.TINYINT },
  shares: { type: DataTypes.INTEGER },
  price: { type: DataTypes.DECIMAL(15, 4) },
  amount: { type: DataTypes.DECIMAL(15, 2) },
  content: { type: DataTypes.STRING(500) },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'group_messages', timestamps: false })

const MessageLike = sequelize.define('MessageLike', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  message_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'message_likes', timestamps: false })

const MessageReply = sequelize.define('MessageReply', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  message_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.STRING(500), allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'message_replies', timestamps: false })

module.exports = {
  sequelize,
  User,
  Group,
  UserGroup,
  UserBalance,
  Position,
  Transaction,
  StockPool,
  StockPrice,
  StockPricesCache,
  InviteCode,
  AdminUser,
  CommissionConfig,
  LoginHistory,
  MarketConfig,
  CommissionHistory,
  GroupMessage,
  MessageLike,
  MessageReply
}