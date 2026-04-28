<template>
  <div class="fund-flow-container">
    <div class="header">
      <h2>{{ $t('fund_flow.title') }}</h2>
      <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
    </div>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ $t('fund_flow.title') }}</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            :range-separator="$t('fund_flow.to')"
            :start-placeholder="$t('fund_flow.start_date')"
            :end-placeholder="$t('fund_flow.end_date')"
            value-format="YYYY-MM-DD"
            @change="fetchFundFlow"
          />
        </div>
      </template>

      <el-table :data="list" stripe>
        <el-table-column :label="$t('fund_flow.date')" width="110">
          <template #default="{ row }">{{ row.tradeDate }}</template>
        </el-table-column>
        <el-table-column :label="$t('fund_flow.type')" width="130">
          <template #default="{ row }">
            <el-tag :type="getTagType(row)" size="small">{{ getTypeLabel(row.typeLabel) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('fund_flow.stock')" width="140">
          <template #default="{ row }">{{ row.stockName || (row.stockCode || '-') }}</template>
        </el-table-column>
        <el-table-column :label="$t('fund_flow.shares')" width="80">
          <template #default="{ row }">{{ row.tradeType === 4 ? row.shares : (row.shares || '-') }}</template>
        </el-table-column>
        <el-table-column :label="$t('fund_flow.change')" width="140">
          <template #default="{ row }">
            <span :class="row.changeAmount >= 0 ? 'profit' : 'loss'">
              {{ row.changeAmount >= 0 ? '+' : '' }}{{ formatMoney(Math.abs(row.changeAmount)) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('fund_flow.balance')" width="140">
          <template #default="{ row }">{{ formatMoney(row.balanceAfter) }}</template>
        </el-table-column>
      </el-table>

      <div v-if="list.length === 0" class="empty">
        <p>{{ $t('fund_flow.no_records') }}</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
/**
 * File: FundFlow.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Fund flow page displaying a table of financial records with date
 *   range filter. Shows initial fund, buy/sell transactions, dividends, and
 *   allotments with change amounts.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getFundFlow } from '@/api/transaction'

const { t } = useI18n()

const list = ref([])
const dateRange = ref([])

const oneMonthAgo = new Date()
oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
const defaultStart = oneMonthAgo.toISOString().split('T')[0]
const today = new Date().toISOString().split('T')[0]
dateRange.value = [defaultStart, today]

/**
 * getTagType
 * Description: Returns the Element Plus tag type for a given fund flow row.
 * @param {Object} row - The fund flow row object
 * @returns {string} The tag type string
 */
const getTagType = (row) => {
  const map = { 5: 'success', 1: 'danger', 2: 'success', 3: 'warning', 4: 'info' }
  return map[row.tradeType] || ''
}

/**
 * getTypeLabel
 * Description: Returns the display label for a given fund flow type.
 * @param {string} label - The type label key
 * @returns {string} The localized type label
 */
const getTypeLabel = (label) => {
  const labels = {
    initial_fund: t('fund_flow.initial_fund'),
    buy_stock: t('fund_flow.buy_stock'),
    sell_stock: t('fund_flow.sell_stock'),
    dividend: t('fund_flow.dividend'),
    allotment: t('fund_flow.allotment'),
    unknown: t('common.unknown')
  }
  return labels[label] || label
}

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

/**
 * fetchFundFlow
 * Description: Fetches fund flow records with optional date range parameters.
 * @returns {Promise<void>}
 */
const fetchFundFlow = async () => {
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await getFundFlow(params.start_date, params.end_date)
    list.value = res.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('fund_flow.fetch_failed'))
  }
}

onMounted(() => {
  fetchFundFlow()
})
</script>

<style scoped>
.fund-flow-container {
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

.profit {
  color: #f56c6c;
  font-weight: bold;
}

.loss {
  color: #67c23a;
  font-weight: bold;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
