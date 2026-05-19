const {
  User, UserBalance, Position, StockPool, StockPricesCache,
  MarketConfig, GroupMessage, MessageReply, UserGroup, Transaction, sequelize,
  AiLlmConfig, AiTradeLog
} = require('../models')
const { Op } = require('sequelize')
const { callLLM } = require('./llmClient')
const stockService = require('./stock')
const commissionService = require('./commission')
const stockPriceService = require('./stock')
const { toCNY } = require('../utils/currency')

const MARKET_LABELS = { 1: 'A股', 2: '港股', 3: '美股' }
const PERSONALITY_LABELS = {
  conservative: '保守型',
  random: '随机型',
  aggressive: '激进型'
}

function parseDecision(raw) {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start === -1 || end === -1) return null
    return JSON.parse(cleaned.substring(start, end + 1))
  } catch (e) {
    return null
  }
}

async function getStockCandidates() {
  const stocks = await StockPool.findAll({
    where: { status: 1 },
    raw: true
  })
  const candidates = []
  for (const s of stocks) {
    const cache = await StockPricesCache.findOne({
      where: { stock_code: s.stock_code, market_type: s.market_type },
      raw: true
    })
    if (cache && cache.close_price) {
      candidates.push({
        stock_code: s.stock_code,
        stock_name: s.stock_name,
        market_type: s.market_type,
        close_price: parseFloat(cache.close_price),
        change_percent: parseFloat(cache.change_percent || 0),
        trade_date: cache.trade_date
      })
    }
  }
  return candidates
}

async function getUserPositionsContext(userId) {
  const positions = await Position.findAll({
    where: { user_id: userId, shares: { [Op.gt]: 0 } },
    raw: true
  })
  const result = []
  for (const p of positions) {
    const cache = await StockPricesCache.findOne({
      where: { stock_code: p.stock_code, market_type: p.market_type },
      raw: true
    })
    const currentPrice = cache ? parseFloat(cache.close_price) : parseFloat(p.avg_cost)
    const costCNY = parseFloat(p.avg_cost)
    const marketValue = parseFloat(p.shares) * currentPrice
    const profit = marketValue - parseFloat(p.total_cost)
    const profitRate = parseFloat(p.total_cost) > 0 ? (profit / parseFloat(p.total_cost)) * 100 : 0
    const marketLabel = MARKET_LABELS[p.market_type] || '未知'
    result.push({
      stock_code: p.stock_code,
      stock_name: p.stock_name || p.stock_code,
      market_type: p.market_type,
      market_label: marketLabel,
      shares: p.shares,
      avg_cost: costCNY.toFixed(2),
      current_price: currentPrice.toFixed(2),
      market_value: marketValue.toFixed(2),
      profit: profit.toFixed(2),
      profit_rate: profitRate.toFixed(2)
    })
  }
  return result
}

const DEFAULT_PROMPTS = {
  conservative: '你是保守型投资者。偏好低估值蓝筹股，严格止损，分散持仓控制风险。' +
    '单只股票持仓不超过总资产30%。每次交易金额不超过可用资金25%。' +
    '优先考虑A股市场，关注市盈率低、分红稳定的公司。' +
    '不能在同一天对同一支股票进行买入又卖出。',
  random: '你是混合型投资者。综合参考技术面和基本面，灵活调仓。' +
    '单只股票持仓不超过总资产50%。每次交易金额不超过可用资金40%。' +
    'A股、港股、美股均可交易。' +
    '不能在同一天对同一支股票进行买入又卖出。',
  aggressive: '你是激进型投资者。偏好高成长股票，敢于追涨杀跌，集中持仓博取高收益。' +
    '单只股票持仓不超过总资产80%。每次交易金额不超过可用资金60%。' +
    '关注热门板块和题材股，A股、港股、美股均可交易。' +
    '不能在同一天对同一支股票进行买入又卖出。'
}

function buildPersonalityPrompt(personality, config) {
  let customPrompts
  if (config && config.personality_prompts) {
    try {
      customPrompts = typeof config.personality_prompts === 'string'
        ? JSON.parse(config.personality_prompts)
        : config.personality_prompts
    } catch (e) { /* ignore */ }
  }
  const prompts = customPrompts || DEFAULT_PROMPTS
  return prompts[personality] || prompts.random || DEFAULT_PROMPTS.random
}

async function processAIUser(userId, groupId) {
  const user = await User.findByPk(userId)
  if (!user || !user.is_ai || user.status === 0 || user.trade_enabled === 0) {
    return { executed: false, reason: '用户不可用' }
  }

  const today = new Date().toISOString().split('T')[0]
  if (user.daily_trade_date === today && user.daily_trade_count >= 6) {
    return { executed: false, reason: '今日交易已达上限(6次)' }
  }

  if (user.daily_trade_date !== today) {
    await User.update(
      { daily_trade_count: 0, daily_trade_date: today },
      { where: { id: userId } }
    )
    user.daily_trade_count = 0
    user.daily_trade_date = today
  }

  const config = await AiLlmConfig.findByPk(user.ai_config_id)
  if (!config || config.status === 0) {
    return { executed: false, reason: 'LLM配置不可用' }
  }

  const balance = await UserBalance.findOne({ where: { user_id: userId } })
  if (!balance) {
    return { executed: false, reason: '用户资金账户不存在' }
  }

  const cash = parseFloat(balance.cash)
  const initCash = parseFloat(balance.init_cash)
  const positions = await getUserPositionsContext(userId)
  const positionsValue = positions.reduce((sum, p) => sum + parseFloat(p.market_value), 0)
  const totalAssets = cash + positionsValue

  const candidates = await getStockCandidates()
  if (candidates.length === 0) {
    return { executed: false, reason: '无候选股票数据' }
  }

  const topCandidates = candidates
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)
    .map(c => `${c.stock_code} ${c.stock_name} ${MARKET_LABELS[c.market_type]} ¥${c.close_price} (涨幅${c.change_percent}%)`)

  const positionsText = positions.length > 0
    ? positions.map(p =>
        `${p.stock_code} ${p.stock_name} (${p.market_label}) ${p.shares}股 成本¥${p.avg_cost} 现价¥${p.current_price} 盈亏¥${p.profit}(${p.profit_rate}%)`
      ).join('\n')
    : '暂无持仓'

  const personalityDesc = buildPersonalityPrompt(user.ai_personality, config)

  const todayTrades = await Transaction.findAll({
    where: { user_id: userId, trade_date: today },
    attributes: ['stock_code', 'market_type', 'trade_type'],
    raw: true
  })
  const todayTradedStocks = [...new Set(todayTrades.map(t => t.stock_code))]
  const todayTradeInfo = todayTradedStocks.length > 0
    ? `今日已交易股票: ${todayTradedStocks.join(', ')}`
    : '今日尚未交易'

  const systemMsg = `你是${user.nickname || user.username}，一个${PERSONALITY_LABELS[user.ai_personality] || '普通'}股票投资者。
${personalityDesc}

当前账户概况：
- 总资产: ¥${totalAssets.toFixed(2)}
- 可用资金: ¥${cash.toFixed(2)}
- 初始资金: ¥${initCash.toFixed(2)}
- 今日已交易: ${user.daily_trade_count}/6 次
- ${todayTradeInfo}

当前持仓：
${positionsText}

候选股票（含当前价格）：
${topCandidates.join('\n')}

请分析上述候选股票和市场情况，决定是否进行交易。
回复格式必须是严格的JSON（不要包含其他文字）：
{"action": "buy" 或 "sell" 或 "hold", "stock_code": "股票代码", "market_type": 1或2或3, "shares": 股数, "reason": "详细决策理由"}

注意：
- action为"hold"时其他字段可为空
- 买入时确保金额不超过可用资金（含佣金）
- 卖出时必须持有该股票且数量充足
- 不能在同一天对同一支股票进行买入又卖出`

  const userMsg = `请分析当前市场情况，做出交易决策。当前时间: ${new Date().toLocaleString('zh-CN')}`

  try {
    const result = await callLLM(config, [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userMsg }
    ])

    const decision = parseDecision(result.content)
    if (!decision) {
      await AiTradeLog.create({
        user_id: userId, group_id: groupId,
        interaction_type: 'trade', decision: 'parse_error',
        reason: 'LLM返回格式解析失败',
        llm_response: result.content,
        executed: 0
      })
      return { executed: false, reason: '解析LLM响应失败' }
    }

    if (decision.action === 'hold') {
      await AiTradeLog.create({
        user_id: userId, group_id: groupId,
        interaction_type: 'trade', decision: 'hold',
        reason: decision.reason || '暂无交易计划',
        llm_response: result.content,
        executed: 0
      })
      return { executed: false, reason: decision.reason || 'hold' }
    }

    const targetStock = candidates.find(
      c => c.stock_code === decision.stock_code && c.market_type === parseInt(decision.market_type)
    )
    if (!targetStock) {
      await AiTradeLog.create({
        user_id: userId, group_id: groupId,
        interaction_type: 'trade', decision: 'invalid_stock',
        stock_code: decision.stock_code,
        market_type: parseInt(decision.market_type || 0),
        reason: `候选股票中找不到 ${decision.stock_code}`,
        llm_response: result.content,
        executed: 0
      })
      return { executed: false, reason: '股票不在候选列表中' }
    }

    const shares = parseInt(decision.shares)
    if (!shares || shares <= 0) {
      return { executed: false, reason: '无效的股数' }
    }

    const priceInCNY = toCNY(targetStock.close_price, targetStock.market_type)
    const amount = priceInCNY * shares

    const oppositeType = decision.action === 'buy' ? 2 : 1
    const alreadyTradedToday = todayTrades.some(t =>
      t.stock_code === decision.stock_code && t.trade_type === oppositeType
    )
    if (alreadyTradedToday) {
      await AiTradeLog.create({
        user_id: userId, group_id: groupId,
        interaction_type: 'trade', decision: 'day_trade_rejected',
        stock_code: decision.stock_code,
        market_type: targetStock.market_type,
        shares, reason: '禁止当日对冲: 该股票今日已有反向交易',
        llm_response: result.content, executed: 0
      })
      return { executed: false, reason: '禁止当日对冲交易' }
    }

    if (decision.action === 'buy') {
      const rate = await commissionService.getCommissionRate(targetStock.market_type, 1)
      const commission = commissionService.calculateCommission(amount, rate)
      const totalDeduct = amount + commission

      if (totalDeduct > cash) {
        await AiTradeLog.create({
          user_id: userId, group_id: groupId,
          interaction_type: 'trade', decision: 'insufficient_funds',
          stock_code: decision.stock_code,
          market_type: targetStock.market_type,
          shares, reason: `资金不足: 需要¥${totalDeduct.toFixed(2)}，可用¥${cash.toFixed(2)}`,
          llm_response: result.content,
          executed: 0
        })
        return { executed: false, reason: '资金不足' }
      }

      const existingPosition = await Position.findOne({
        where: { user_id: userId, stock_code: decision.stock_code, group_id: { [Op.in]: [groupId, 0] } }
      })
      const newShares = existingPosition ? existingPosition.shares + shares : shares
      const newTotalCost = existingPosition
        ? parseFloat(existingPosition.total_cost) + amount + commission
        : amount + commission
      const newAvgCost = newTotalCost / newShares
      const maxAllowedRatio = { conservative: 0.3, random: 0.5, aggressive: 0.8 }
      const ratio = maxAllowedRatio[user.ai_personality] || 0.5
      if ((newShares * priceInCNY) > totalAssets * ratio) {
        return { executed: false, reason: `超过持仓比例限制(${ratio * 100}%)` }
      }

      const trade = await executeBuy(userId, decision.stock_code, targetStock.market_type, shares, groupId, decision.reason)
      await User.increment('daily_trade_count', { by: 1, where: { id: userId } })
      await AiTradeLog.create({
        user_id: userId, group_id: groupId,
        interaction_type: 'trade', decision: 'buy',
        stock_code: decision.stock_code,
        market_type: targetStock.market_type, shares,
        reason: decision.reason || '',
        llm_response: result.content,
        executed: 1, trade_id: trade.tradeId || 0
      })
      return { executed: true, action: 'buy', data: trade, reason: decision.reason }
    }

    if (decision.action === 'sell') {
      const position = await Position.findOne({
        where: { user_id: userId, stock_code: decision.stock_code, shares: { [Op.gt]: 0 } }
      })
      if (!position || position.shares < shares) {
        await AiTradeLog.create({
          user_id: userId, group_id: groupId,
          interaction_type: 'trade', decision: 'insufficient_shares',
          stock_code: decision.stock_code,
          market_type: targetStock.market_type, shares,
          reason: `持仓不足: 需要${shares}股，持有${position ? position.shares : 0}股`,
          llm_response: result.content,
          executed: 0
        })
        return { executed: false, reason: '持仓不足' }
      }

      const trade = await executeSell(userId, decision.stock_code, targetStock.market_type, shares, groupId, decision.reason)
      await User.increment('daily_trade_count', { by: 1, where: { id: userId } })
      await AiTradeLog.create({
        user_id: userId, group_id: groupId,
        interaction_type: 'trade', decision: 'sell',
        stock_code: decision.stock_code,
        market_type: targetStock.market_type, shares,
        reason: decision.reason || '',
        llm_response: result.content,
        executed: 1, trade_id: trade.tradeId || 0
      })
      return { executed: true, action: 'sell', data: trade, reason: decision.reason }
    }

    return { executed: false, reason: '未知操作' }
  } catch (err) {
    console.error(`[AITrade] LLM调用或交易失败 userId=${userId}:`, err.message)
    await AiTradeLog.create({
      user_id: userId, group_id: groupId,
      interaction_type: 'trade', decision: 'error',
      reason: err.message, executed: 0
    })
    return { executed: false, reason: err.message }
  }
}

async function executeBuy(userId, stockCode, marketType, shares, groupId, reason) {
  const quote = await stockService.getQuote(stockCode, marketType)
  const priceInCNY = toCNY(quote.price, marketType)
  const amount = priceInCNY * shares
  const commissionRate = await commissionService.getCommissionRate(marketType, 1)
  const commission = commissionService.calculateCommission(amount, commissionRate)
  const totalDeduct = amount + commission
  const today = new Date().toISOString().split('T')[0]

  const t = await sequelize.transaction()
  try {
    let balance = await UserBalance.findOne({ where: { user_id: userId } })
    const actualGroupId = balance ? balance.group_id : groupId

    const existingPosition = await Position.findOne({
      where: { user_id: userId, stock_code: stockCode, group_id: { [Op.in]: [groupId, 0] } }
    })
    if (existingPosition) {
      const newShares = existingPosition.shares + shares
      const newTotalCost = parseFloat(existingPosition.total_cost) + amount + commission
      const newAvgCost = newTotalCost / newShares
      await Position.update({
        shares: newShares, avg_cost: newAvgCost, total_cost: newTotalCost
      }, { where: { id: existingPosition.id }, transaction: t })
    } else {
      await Position.create({
        user_id: userId, stock_code: stockCode, market_type: marketType,
        group_id: actualGroupId, shares,
        avg_cost: (amount + commission) / shares,
        total_cost: amount + commission
      }, { transaction: t })
    }

    await UserBalance.decrement('cash', { by: totalDeduct, where: { user_id: userId }, transaction: t })
    await UserBalance.increment('total_cost', { by: amount, where: { user_id: userId }, transaction: t })

    const currentBalance = await UserBalance.findOne({ where: { user_id: userId }, transaction: t })
    const balanceAfter = currentBalance ? parseFloat(currentBalance.cash) : 0

    const transaction = await Transaction.create({
      user_id: userId, group_id: actualGroupId,
      stock_code: stockCode, stock_name: quote.stockName,
      market_type: marketType, trade_type: 1,
      price: quote.price, shares, amount, commission,
      commission_rate: commissionRate,
      balance_after: balanceAfter, trade_date: today, status: 1
    }, { transaction: t })

    await t.commit()

    createGroupMessage(userId, 1, stockCode, quote.stockName, marketType, shares, quote.price, amount, reason)

    return { tradeId: transaction.id, stockCode, price: quote.price, shares, amount, commission }
  } catch (err) {
    await t.rollback()
    throw err
  }
}

async function executeSell(userId, stockCode, marketType, shares, groupId, reason) {
  const quote = await stockService.getQuote(stockCode, marketType)
  const priceInCNY = toCNY(quote.price, marketType)
  const amount = priceInCNY * shares
  const commissionRate = await commissionService.getCommissionRate(marketType, 2)
  const commission = commissionService.calculateCommission(amount, commissionRate)
  const netAmount = amount - commission
  const today = new Date().toISOString().split('T')[0]

  const t = await sequelize.transaction()
  try {
    let balance = await UserBalance.findOne({ where: { user_id: userId } })
    const actualGroupId = balance ? balance.group_id : groupId

    const position = await Position.findOne({
      where: { user_id: userId, stock_code: stockCode, shares: { [Op.gt]: 0 } }
    })
    const avgCost = parseFloat(position.avg_cost)
    const realizedProfit = netAmount - (shares * avgCost)
    const costToDecrement = position.shares === shares
      ? parseFloat(position.total_cost)
      : (parseFloat(position.avg_cost) * shares)

    await UserBalance.increment('cash', { by: netAmount, where: { user_id: userId }, transaction: t })
    await UserBalance.decrement('total_cost', { by: costToDecrement, where: { user_id: userId }, transaction: t })

    if (position.shares === shares) {
      await Position.destroy({ where: { id: position.id }, transaction: t })
    } else {
      const newShares = position.shares - shares
      const newTotalCost = parseFloat(position.total_cost) - costToDecrement
      const newAvgCost = newTotalCost / newShares
      await Position.update({
        shares: newShares, avg_cost: newAvgCost, total_cost: newTotalCost
      }, { where: { id: position.id }, transaction: t })
    }

    const currentBalance = await UserBalance.findOne({ where: { user_id: userId }, transaction: t })
    const balanceAfter = currentBalance ? parseFloat(currentBalance.cash) : 0

    const transaction = await Transaction.create({
      user_id: userId, group_id: actualGroupId,
      stock_code: stockCode, stock_name: quote.stockName,
      market_type: marketType, trade_type: 2,
      price: quote.price, shares, amount, commission,
      commission_rate: commissionRate,
      balance_after: balanceAfter, trade_date: today, status: 1,
      profit: realizedProfit
    }, { transaction: t })

    await t.commit()

    createGroupMessage(userId, 2, stockCode, quote.stockName, marketType, shares, quote.price, amount, reason)

    return { tradeId: transaction.id, stockCode, price: quote.price, shares, amount, commission, netAmount }
  } catch (err) {
    await t.rollback()
    throw err
  }
}

async function createGroupMessage(userId, mType, code, name, marketType, shares, price, amount, reason) {
  try {
    const userGroups = await UserGroup.findAll({ where: { user_id: userId } })
    if (userGroups.length === 0) return null
    const typeLabels = { 1: '买入', 2: '卖出', 3: '分红', 4: '配股' }
    const label = typeLabels[mType] || ''
    const marketLabels = { 1: 'A股', 2: '港股', 3: '美股' }
    const marketLabel = marketLabels[marketType] || ''
    const displayContent = `${label} ${code} ${name} | ${marketLabel} | 单价¥${parseFloat(price || 0).toFixed(2)} × ${shares}股 = ¥${parseFloat(amount || 0).toFixed(2)}`
    let lastMsgId = null
    for (const ug of userGroups) {
      const msg = await GroupMessage.create({
        group_id: ug.group_id, user_id: userId,
        message_type: mType, stock_code: code,
        stock_name: name, market_type: marketType,
        shares, price: parseFloat(price || 0),
        amount: parseFloat(amount || 0),
        content: displayContent
      })
      lastMsgId = msg.id
      if (reason) {
        await MessageReply.create({
          message_id: msg.id, user_id: userId,
          content: reason
        })
      }
    }
    return lastMsgId
  } catch (e) {
    console.log('Create group message error:', e.message)
    return null
  }
}

module.exports = { processAIUser, executeBuy, executeSell }
