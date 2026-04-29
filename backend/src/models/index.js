/**
 * File: index.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Sequelize model definitions. Defines all 16 database models used by the
 *   virtual stock platform, including User, Group, Position, Transaction, StockPool,
 *   InviteCode, AdminUser, CommissionConfig, MarketConfig, GroupMessage, and more.
 *   Exports the configured sequelize instance and all model constructors.
 * Version History:
 *   v1.0 - Initial version
 */

const { Sequelize, DataTypes } = require('sequelize')
const config = require('../../config/database')

const sequelize = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  dialectOptions: config.dialectOptions,
  pool: config.pool,
  logging: false
})

/**
 * User model — table: users
 * Fields: id, username, password, nickname, email, phone, status, trade_enabled,
 *         admin_access, last_trade_date, language, created_at, updated_at
 */
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

/**
 * Group model — table: groups
 * Fields: id, name, description, init_cash, currency, status, created_at, updated_at
 */
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

/**
 * UserGroup model — table: user_groups
 * Join table linking users to groups. Fields: id, user_id, group_id, joined_at, last_read_message_id
 */
const UserGroup = sequelize.define('UserGroup', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  group_id: { type: DataTypes.INTEGER, allowNull: false },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  last_read_message_id: { type: DataTypes.INTEGER, defaultValue: 0 }
}, { tableName: 'user_groups', timestamps: false })

/**
 * UserBalance model — table: user_balance
 * Tracks each user's cash balance per group. Fields: id, user_id, group_id, cash,
 * frozen_cash, total_cost, init_cash, created_at, updated_at
 */
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

/**
 * Position model — table: positions
 * Represents a user's holding in a stock. Fields: id, user_id, stock_code, market_type,
 * group_id, shares, avg_cost, total_cost, updated_at
 */
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

/**
 * Transaction model — table: transactions
 * Records every trade or financial event (buy, sell, dividend, allotment, initial fund).
 * Fields: id, user_id, group_id, stock_code, stock_name, market_type, trade_type, price,
 * shares, amount, commission, commission_rate, balance_after, profit, trade_date, status, created_at
 */
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

/**
 * StockPool model — table: stock_pools
 * Master list of all tradable stocks. Fields: id, stock_code, stock_name, market_type, status, created_at
 */
const StockPool = sequelize.define('StockPool', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stock_code: { type: DataTypes.STRING(20), allowNull: false },
  stock_name: { type: DataTypes.STRING(100), allowNull: false },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'stock_pools', timestamps: false })

/**
 * StockPrice model — table: stock_prices
 * Historical daily price data for stocks. Fields: id, stock_code, stock_name, market_type,
 * trade_date, open_price, high_price, low_price, close_price, prev_close, volume, amount, created_at
 */
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

/**
 * StockPricesCache model — table: stock_prices_cache
 * Caches the most recent day's closing price for each stock to reduce external API calls.
 * Fields: id, stock_code, market_type, trade_date, close_price, prev_close, change_percent, updated_at
 */
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

/**
 * InviteCode model — table: invite_codes
 * One-time or limited-use invite codes linked to a group for user registration.
 * Fields: id, code, group_id, expire_date, use_limit, used_count, status, created_at
 */
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

/**
 * AdminUser model — table: admin_users
 * Administrator accounts with login credentials and permissions.
 * Fields: id, username, password, permissions, status, created_at, updated_at
 */
const AdminUser = sequelize.define('AdminUser', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  permissions: { type: DataTypes.STRING(500), defaultValue: '' },
  status: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'admin_users', timestamps: false })

/**
 * CommissionConfig model — table: commission_configs
 * Commission rate configuration per market type and trade type (buy/sell).
 * Fields: id, market_type, trade_type, commission_rate, updated_at
 */
const CommissionConfig = sequelize.define('CommissionConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  trade_type: { type: DataTypes.TINYINT, allowNull: false },
  commission_rate: { type: DataTypes.DECIMAL(10, 6), allowNull: false, defaultValue: 0.5 },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'commission_configs', timestamps: false })

/**
 * LoginHistory model — table: login_history
 * Records user and admin login events for auditing.
 * Fields: id, user_id, login_time, ip_address, user_agent
 */
const LoginHistory = sequelize.define('LoginHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  login_time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  ip_address: { type: DataTypes.STRING(50) },
  user_agent: { type: DataTypes.STRING(255) }
}, { tableName: 'login_history', timestamps: false })

/**
 * MarketConfig model — table: market_config
 * Market trading hours and refresh schedule per market type.
 * Fields: id, market_type, refresh_time, trade_start, trade_end, enabled, created_at
 */
const MarketConfig = sequelize.define('MarketConfig', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  refresh_time: { type: DataTypes.STRING(10) },
  trade_start: { type: DataTypes.STRING(10) },
  trade_end: { type: DataTypes.STRING(10) },
  enabled: { type: DataTypes.TINYINT, defaultValue: 1 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'market_config', timestamps: false })

/**
 * CommissionHistory model — table: commission_history
 * Audit log of commission rate changes. Records old and new values with the admin who made the change.
 * Fields: id, market_type, trade_type, old_rate, new_rate, changed_by, changed_at, remark
 */
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

/**
 * GroupMessage model — table: group_messages
 * Trade activity messages broadcast to groups (buy, sell, dividend, allotment events).
 * Fields: id, group_id, user_id, message_type, stock_code, stock_name, market_type,
 * shares, price, amount, content, created_at
 */
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

/**
 * MessageLike model — table: message_likes
 * Tracks which users have liked a group message.
 * Fields: id, message_id, user_id, created_at
 */
const MessageLike = sequelize.define('MessageLike', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  message_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'message_likes', timestamps: false })

/**
 * MessageReply model — table: message_replies
 * Replies to group messages by users.
 * Fields: id, message_id, user_id, content, created_at
 */
const MessageReply = sequelize.define('MessageReply', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  message_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.STRING(500), allowNull: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'message_replies', timestamps: false })

/**
 * StockSyncRecord model — table: stock_sync_records
 * Records of stock data sync operations triggered from the admin panel.
 * Fields: id, market_type, status, total_count, completed_count, success_count,
 *   fail_count, failed_stocks, current_stock, started_at, finished_at, duration_sec, created_at
 */
const StockSyncRecord = sequelize.define('StockSyncRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  market_type: { type: DataTypes.TINYINT, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'running' },
  total_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  completed_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  success_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  fail_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  failed_stocks: { type: DataTypes.TEXT('medium') },
  current_stock: { type: DataTypes.STRING(50) },
  started_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  finished_at: { type: DataTypes.DATE },
  duration_sec: { type: DataTypes.INTEGER, defaultValue: 0 },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'stock_sync_records', timestamps: false })

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
  MessageReply,
  StockSyncRecord
}