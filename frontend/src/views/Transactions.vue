<template>
  <div class="transactions-container">
    <div class="header">
      <h2>{{ $t('transactions_page.title') }}</h2>
      <div>
        <el-button type="primary" @click="$router.push('/home')">{{ $t('nav.home') }}</el-button>
        <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
      </div>
    </div>

    <el-card class="balance-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="balance-item">
            <span class="label">{{ $t('transactions_page.account_balance') }}</span>
            <span class="value">{{ formatMoney(balance) }} RMB</span>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ $t('transactions_page.trade_records') }}</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            :range-separator="$t('transactions_page.to')"
            :start-placeholder="$t('transactions_page.start_date')"
            :end-placeholder="$t('transactions_page.end_date')"
            value-format="YYYY-MM-DD"
            @change="handleDateChange"
          />
        </div>
      </template>

      <el-table :data="transactions" stripe>
        <el-table-column :label="$t('transactions_page.date')" width="110">
          <template #default="{ row }">{{ row.tradeDate }}</template>
        </el-table-column>
        <el-table-column :label="$t('transactions_page.market')" width="70">
          <template #default="{ row }">
            <el-tag size="small">{{ getMarketLabel(row.marketType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="stockCode" :label="$t('transactions_page.stock_code')" width="100" />
        <el-table-column :label="$t('transactions_page.stock_name')">
          <template #default="{ row }">{{ row.stockName || row.stockCode }}</template>
        </el-table-column>
        <el-table-column :label="$t('transactions_page.direction')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.tradeType === 1 ? 'success' : 'danger'" size="small">
              {{ row.tradeType === 1 ? $t('transactions_page.buy') : $t('transactions_page.sell') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('transactions_page.price')" width="100">
          <template #default="{ row }">{{ formatMoney(row.price) }} {{ row.currency }}</template>
        </el-table-column>
        <el-table-column prop="shares" :label="$t('transactions_page.shares')" width="100">
          <template #default="{ row }">{{ formatNumber(row.shares) }}</template>
        </el-table-column>
        <el-table-column :label="$t('transactions_page.amount')" width="150">
          <template #default="{ row }">
            {{ formatMoney(row.amount) }} {{ row.currency }}
            <span class="amount-cny">({{ formatMoney(row.amountCNY) }} RMB)</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('transactions_page.commission')" width="130">
          <template #default="{ row }">
            <span class="commission">{{ formatMoney(row.commission) }} RMB</span>
            <span class="commission-rate">({{ formatCommissionRate(row.commissionRate) }})</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('transactions_page.balance')" width="120">
          <template #default="{ row }">{{ formatMoney(row.balanceAfter) }} RMB</template>
        </el-table-column>
      </el-table>

      <div v-if="transactions.length === 0" class="empty">
        <p>{{ $t('transactions_page.no_records') }}</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getTransactions } from '@/api/trade'

const { t } = useI18n()

const transactions = ref([])
const dateRange = ref([])
const balance = ref(0)
const totalCost = ref(0)

const threeWeeksAgo = new Date()
threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21)
const defaultStart = threeWeeksAgo.toISOString().split('T')[0]
const today = new Date().toISOString().split('T')[0]
dateRange.value = [defaultStart, today]

const getMarketLabel = (marketType) => {
  const labels = { 1: t('market.a_share'), 2: t('market.hk_stock'), 3: t('market.us_stock') }
  return labels[marketType] || t('common.unknown')
}

const formatMoney = (value) => {
  if (!value && value !== 0) return '0.00'
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatNumber = (value) => {
  if (!value && value !== 0) return '0'
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatCommissionRate = (rate) => {
  if (rate === undefined || rate === null || rate === '') return '-'
  return parseFloat(rate).toFixed(1) + '‰'
}

const handleDateChange = () => {
  fetchTransactions()
}

const fetchTransactions = async () => {
  try {
    const params = {}
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await getTransactions(params)
    transactions.value = res.data?.list || []
    balance.value = res.data?.currentBalance || 0
    totalCost.value = res.data?.totalCost || 0
  } catch (err) {
    ElMessage.error(err.message || t('transactions_page.fetch_failed'))
  }
}

onMounted(() => {
  fetchTransactions()
})
</script>

<style scoped>
.transactions-container {
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

.balance-card {
  margin-bottom: 20px;
}

.balance-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
}

.balance-item .label {
  font-size: 14px;
  color: #999;
  margin-bottom: 5px;
}

.balance-item .value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.amount-cny {
  color: #999;
  font-size: 12px;
}

.commission {
  color: #e6a23c;
}

.commission-rate {
  font-size: 11px;
  color: #999;
  margin-left: 2px;
}
</style>
