<template>
  <div class="statistics-container">
    <div class="header">
      <h2>{{ $t('statistics_page.title') }}</h2>
      <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
    </div>

    <el-card>
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-title">{{ $t('statistics_page.floating_profit') }}</div>
            <div class="stat-value" :class="stats.floatingProfit >= 0 ? 'profit' : 'loss'">
              {{ stats.floatingProfit >= 0 ? '+' : '' }}{{ formatMoney(stats.floatingProfit) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-title">{{ $t('statistics_page.floating_profit_rate') }}</div>
            <div class="stat-value" :class="stats.floatingProfitRate >= 0 ? 'profit' : 'loss'">
              {{ stats.floatingProfitRate >= 0 ? '+' : '' }}{{ stats.floatingProfitRate?.toFixed(2) || '0.00' }}%
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-title">{{ $t('statistics_page.realized_profit') }}</div>
            <div class="stat-value" :class="stats.realizedProfit >= 0 ? 'profit' : 'loss'">
              {{ stats.realizedProfit >= 0 ? '+' : '' }}{{ formatMoney(stats.realizedProfit) }}
            </div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-card">
            <div class="stat-title">{{ $t('statistics_page.position_count') }}</div>
            <div class="stat-value">{{ stats.positionCount || 0 }}</div>
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <div class="trade-stats">
        <h3>{{ $t('statistics_page.trade_stats') }}</h3>
        <el-row :gutter="20">
          <el-col :span="6">
            <div class="stat-item">
              <span class="label">{{ $t('statistics_page.total_trades') + '：' }}</span>
              <span class="value">{{ tradeStats.totalTrades || 0 }}</span>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <span class="label">{{ $t('statistics_page.buy_count') + '：' }}</span>
              <span class="value">{{ tradeStats.buyTrades || 0 }}</span>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <span class="label">{{ $t('statistics_page.sell_count') + '：' }}</span>
              <span class="value">{{ tradeStats.sellTrades || 0 }}</span>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <span class="label">{{ $t('statistics_page.total_amount') + '：' }}</span>
              <span class="value">{{ formatMoney(tradeStats.totalAmount) }}</span>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <span>{{ $t('statistics_page.trade_records') }}</span>
      </template>
      <el-table :data="transactions">
        <el-table-column prop="trade_date" :label="$t('statistics_page.date')" width="100" />
        <el-table-column prop="stockCode" :label="$t('statistics_page.stock_code')" width="100" />
        <el-table-column prop="stockName" :label="$t('statistics_page.stock_name')" />
        <el-table-column prop="tradeType" :label="$t('statistics_page.type')" width="80">
          <template #default="{ row }">{{ row.tradeType === 1 ? $t('statistics_page.buy_label') : $t('statistics_page.sell_label') }}</template>
        </el-table-column>
        <el-table-column prop="shares" :label="$t('statistics_page.shares')" width="80" />
        <el-table-column prop="price" :label="$t('statistics_page.price')" width="100">
          <template #default="{ row }">{{ formatMoney(row.price) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" :label="$t('statistics_page.amount')" width="120">
          <template #default="{ row }">{{ formatMoney(row.amount) || '-' }} RMB</template>
        </el-table-column>
        <el-table-column :label="$t('statistics_page.profit')" width="100">
          <template #default="{ row }">
            <span v-if="row.tradeType === 2 && row.profit !== undefined && row.profit !== null" :class="row.profit >= 0 ? 'profit' : 'loss'">
              {{ row.profit >= 0 ? '+' : '' }}{{ formatMoney(row.profit) }}
            </span>
            <span v-else-if="row.tradeType === 1" class="commission-text">
              -{{ formatMoney(row.commission) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
/**
 * File: Statistics.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Profit statistics page displaying floating/realized P&L, position
 *   counts, trade statistics, and a transaction records table.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getProfitStats, getPositionStats, getTradeStats } from '@/api/statistics'
import { getTransactions } from '@/api/transaction'

const { t } = useI18n()

const stats = ref({})
const tradeStats = ref({})
const transactions = ref([])

/**
 * formatMoney
 * Description: Formats a numeric value as a comma-separated string with two decimal places.
 * @param {number} value - The numeric value to format
 * @returns {string} The formatted money string
 */
const formatMoney = (value) => {
  if (!value && value !== 0) return '0.00'
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

onMounted(async () => {
  fetchStats()
})

/**
 * fetchStats
 * Description: Fetches profit statistics, position stats, trade stats, and
 *   transaction records in parallel from the API.
 * @returns {Promise<void>}
 */
const fetchStats = async () => {
  try {
    const [profit, posStats, trade, txRes] = await Promise.all([
      getProfitStats(),
      getPositionStats(),
      getTradeStats(),
      getTransactions()
    ])
    stats.value = { ...profit.data, ...posStats.data }
    tradeStats.value = trade.data || {}
    transactions.value = txRes.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('statistics_page.fetch_failed'))
  }
}
</script>

<style scoped>
.statistics-container {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: white;
  border-radius: 8px;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-card {
  background: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-title {
  font-size: 14px;
  color: #999;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-value.profit {
  color: #f56c6c;
}

.stat-value.loss {
  color: #67c23a;
}

.trade-stats {
  margin-top: 20px;
}

.trade-stats h3 {
  margin-bottom: 15px;
}

.stat-item {
  padding: 10px;
}

.stat-item .label {
  color: #999;
}

.stat-item .value {
  font-weight: bold;
}

.commission-text {
  color: #909399;
}
</style>
