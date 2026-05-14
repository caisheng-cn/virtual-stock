<template>
  <div class="options-container">
    <div class="header">
      <h2>{{ $t('options_page.title') }}</h2>
      <div>
        <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
      </div>
    </div>

    <el-card class="stock-selector">
      <el-row :gutter="16" align="middle">
        <el-col :span="12">
          <el-select
            v-model="selectedStock"
            filterable
            remote
            :remote-method="searchStocks"
            :loading="searchLoading"
            :placeholder="$t('options_page.select_underlying')"
            @change="onStockSelected"
            style="width:100%"
            value-key="id"
            size="large"
            clearable
          >
            <el-option v-for="item in whitelist" :key="item.id" :label="`${item.stock_code} ${item.stock_name}`" :value="item" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select v-model="currentGroupId" :placeholder="$t('group_page.select_group')" style="width:100%">
            <el-option v-for="g in groups" :key="g.groupId" :label="g.groupName" :value="g.groupId" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <div class="underlying-price" v-if="underlyingPrice">
            标的价: <strong>${{ formatMoney(underlyingPrice) }}</strong>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card v-if="selectedStock && expirations.length" class="expiry-selector">
      <el-tabs v-model="activeExpiration" @tab-change="onExpirationChange">
        <el-tab-pane v-for="exp in expirations" :key="exp" :label="formatExpiryLabel(exp)" :name="exp" />
      </el-tabs>
    </el-card>

    <el-row :gutter="[16, 16]" v-if="chainData">
      <el-col :xs="24" :md="16">
        <el-card class="chain-card">
          <template #header>
            <div class="card-header">
              <span>{{ $t('options_page.option_chain') }}</span>
              <span class="chain-subtitle">{{ $t('options_page.call') }} / {{ $t('options_page.put') }}</span>
            </div>
          </template>
          <div class="chain-table-wrapper">
            <table class="chain-table">
              <thead>
                <tr>
                  <th class="col-strike">{{ $t('options_page.strike_price') }}</th>
                  <th class="col-premium">{{ $t('options_page.premium') }}</th>
                  <th class="col-value">{{ $t('options_page.intrinsic_value') }}</th>
                  <th class="col-value">{{ $t('options_page.time_value') }}</th>
                  <th class="col-type">{{ $t('options_page.call') }}</th>
                  <th class="col-strike">{{ $t('options_page.strike_price') }}</th>
                  <th class="col-premium">{{ $t('options_page.premium') }}</th>
                  <th class="col-value">{{ $t('options_page.intrinsic_value') }}</th>
                  <th class="col-value">{{ $t('options_page.time_value') }}</th>
                  <th class="col-type">{{ $t('options_page.put') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in chainRows" :key="item.strike"
                  :class="{ 'selected-row': selectedContract && selectedContract.strike === item.strike }">
                  <td class="col-strike" @click="selectContract('call', item)">{{ formatMoney(item.strike) }}</td>
                  <td class="col-premium" @click="selectContract('call', item)">{{ formatMoney(item.callPremium) || '-' }}</td>
                  <td class="col-value" @click="selectContract('call', item)">{{ formatMoney(item.callIntrinsic) || '-' }}</td>
                  <td class="col-value" @click="selectContract('call', item)">{{ formatMoney(item.callTime) || '-' }}</td>
                  <td class="col-type call" @click="selectContract('call', item)" :class="{ active: selectedSide === 'call' && selectedContract && selectedContract.strike === item.strike }">Call</td>
                  <td class="col-strike" @click="selectContract('put', item)">{{ formatMoney(item.strike) }}</td>
                  <td class="col-premium" @click="selectContract('put', item)">{{ formatMoney(item.putPremium) || '-' }}</td>
                  <td class="col-value" @click="selectContract('put', item)">{{ formatMoney(item.putIntrinsic) || '-' }}</td>
                  <td class="col-value" @click="selectContract('put', item)">{{ formatMoney(item.putTime) || '-' }}</td>
                  <td class="col-type put" @click="selectContract('put', item)" :class="{ active: selectedSide === 'put' && selectedContract && selectedContract.strike === item.strike }">Put</td>
                </tr>
              </tbody>
            </table>
          </div>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="8">
        <el-card class="trade-panel" v-if="selectedContract">
          <template #header>
            <div class="card-header">
              <span>{{ $t('options_page.trade_title') }}</span>
            </div>
          </template>
          <div class="contract-detail">
            <div class="detail-row">
              <span class="label">{{ $t('options_page.strike_price') }}:</span>
              <span class="value">${{ formatMoney(selectedContract.strike) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('options_page.option_type') }}:</span>
              <el-tag :type="selectedSide === 'call' ? 'success' : 'danger'" size="small">
                {{ selectedSide === 'call' ? 'Call' : 'Put' }}
              </el-tag>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('options_page.expiration') }}:</span>
              <span class="value">{{ activeExpiration }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('options_page.premium') }}:</span>
              <span class="value highlight">${{ formatMoney(currentPremium) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('options_page.intrinsic_value') }}:</span>
              <span class="value">${{ formatMoney(currentIntrinsic) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('options_page.time_value') }}:</span>
              <span class="value">${{ formatMoney(currentTimeValue) }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('options_page.days_to_expiry') }}:</span>
              <span class="value">{{ selectedContract.daysToExpiry || 0 }}天</span>
            </div>
            <el-divider />
            <el-form label-width="80px">
              <el-form-item :label="$t('options_page.quantity')">
                <el-input-number v-model="tradeQuantity" :min="1" :max="9999" />
              </el-form-item>
              <el-form-item :label="$t('options_page.estimated_premium')">
                <span class="amount">${{ formatMoney(estimatedPremium) }}</span>
                <span class="amount-cny">(~¥{{ formatMoney(estimatedPremiumCNY) }})</span>
              </el-form-item>
              <el-form-item :label="$t('options_page.estimated_commission')">
                <span class="commission">${{ formatMoney(estimatedCommission) }}</span>
                <span class="amount-cny">(~¥{{ formatMoney(estimatedCommissionCNY) }})</span>
              </el-form-item>
              <el-form-item :label="$t('options_page.total_deduct')">
                <span class="total">¥{{ formatMoney(totalDeductCNY) }}</span>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="handleBuy" :loading="buying" style="width:100%">
                  {{ $t('options_page.buy_to_open') }}
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-card>
        <el-card v-else>
          <div class="no-selection">
            <p>{{ $t('options_page.select_contract_hint') }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="my-positions" v-if="optionPositions.length">
      <template #header>
        <div class="card-header">
          <span>{{ $t('options_page.my_positions') }}</span>
        </div>
      </template>
      <el-table :data="optionPositions" stripe size="small">
        <el-table-column prop="stockCode" :label="$t('positions_page.stock_code')" width="80" />
        <el-table-column :label="$t('options_page.contract')" width="150">
          <template #default="{ row }">{{ row.stockName }} {{ row.strikePrice }}{{ row.optionType === 'call' ? 'C' : 'P' }} {{ row.expirationDate }}</template>
        </el-table-column>
        <el-table-column :label="$t('options_page.option_type')" width="70">
          <template #default="{ row }">
            <el-tag :type="row.optionType === 'call' ? 'success' : 'danger'" size="small">{{ row.optionType === 'call' ? 'Call' : 'Put' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('options_page.strike_price')" width="90">
          <template #default="{ row }">${{ formatMoney(row.strikePrice) }}</template>
        </el-table-column>
        <el-table-column :label="$t('options_page.expiration')" width="100">{{ row.expirationDate }}</el-table-column>
        <el-table-column :label="$t('options_page.days_to_expiry')" width="80">{{ row.daysToExpiry }}天</el-table-column>
        <el-table-column :label="$t('options_page.quantity')" prop="quantity" width="60" />
        <el-table-column :label="$t('options_page.avg_cost')" width="80">
          <template #default="{ row }">${{ formatMoney(row.avgCost) }}</template>
        </el-table-column>
        <el-table-column :label="$t('options_page.current_premium')" width="90">
          <template #default="{ row }">${{ formatMoney(row.currentPremium) }}</template>
        </el-table-column>
        <el-table-column :label="$t('options_page.profit')" width="110">
          <template #default="{ row }">
            <span :class="row.profit >= 0 ? 'profit' : 'loss'">{{ row.profit >= 0 ? '+' : '' }}¥{{ formatMoney(row.profit) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('options_page.actions')" width="140" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openSellDialog(row)">{{ $t('options_page.sell_to_close') }}</el-button>
            <el-button size="small" type="warning" @click="handleExerciseDirect(row)"
              :disabled="row.moneyness !== 'itm'">{{ $t('options_page.exercise') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="sellDialogVisible" :title="$t('options_page.sell_to_close')" width="400px">
      <div class="sell-info">
        <p><strong>{{ sellRow.stockName }} {{ sellRow.strikePrice }}{{ sellRow.optionType === 'call' ? 'C' : 'P' }}</strong></p>
        <p>{{ $t('options_page.strike_price') }}: ${{ formatMoney(sellRow.strikePrice) }}</p>
        <p>{{ $t('options_page.current_premium') }}: ${{ formatMoney(sellRow.currentPremium) }}</p>
        <p>{{ $t('options_page.available_qty') }}: {{ sellRow.quantity }}</p>
      </div>
      <el-form label-width="80px">
        <el-form-item :label="$t('options_page.quantity')">
          <el-input-number v-model="sellQuantity" :min="1" :max="sellRow.quantity || 1" />
        </el-form-item>
        <el-form-item :label="$t('options_page.estimated_receive')">
          <span>${{ formatMoney(sellQuantity * sellRow.currentPremium) }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sellDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmSell" :loading="selling">{{ $t('options_page.confirm_sell') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getWhitelist, getExpirations, getOptionChain, buyOption, sellOption, exerciseOption, getOptionPositions } from '@/api/options'
import { getMyGroups, getBalance } from '@/api/group'

const { t } = useI18n()

const whitelist = ref([])
const searchLoading = ref(false)
const selectedStock = ref(null)
const groups = ref([])
const currentGroupId = ref(null)
const underlyingPrice = ref(0)
const expirations = ref([])
const activeExpiration = ref('')
const chainData = ref(null)
const selectedContract = ref(null)
const selectedSide = ref('call')
const tradeQuantity = ref(1)
const buying = ref(false)
const selling = ref(false)
const optionPositions = ref([])
const sellDialogVisible = ref(false)
const sellRow = ref({})
const sellQuantity = ref(1)

const EXCHANGE_RATES = { 1: 1, 2: 0.9, 3: 7 }

const chainRows = computed(() => {
  if (!chainData.value) return []
  const calls = chainData.value.calls || []
  const puts = chainData.value.puts || []
  const maxLen = Math.max(calls.length, puts.length)
  const rows = []
  for (let i = 0; i < maxLen; i++) {
    const c = calls[i] || {}
    const p = puts[i] || {}
    rows.push({
      strike: c.strike || p.strike,
      callPremium: c.premium,
      callIntrinsic: c.intrinsicValue,
      callTime: c.timeValue,
      putPremium: p.premium,
      putIntrinsic: p.intrinsicValue,
      putTime: p.timeValue,
      daysToExpiry: c.daysToExpiry || p.daysToExpiry,
      callContractId: c.contractId,
      putContractId: p.contractId
    })
  }
  return rows
})

const currentPremium = computed(() => {
  if (!selectedContract.value) return 0
  return selectedSide.value === 'call' ? selectedContract.value.callPremium : selectedContract.value.putPremium
})

const currentIntrinsic = computed(() => {
  if (!selectedContract.value) return 0
  return selectedSide.value === 'call' ? selectedContract.value.callIntrinsic : selectedContract.value.putIntrinsic
})

const currentTimeValue = computed(() => {
  if (!selectedContract.value) return 0
  return selectedSide.value === 'call' ? selectedContract.value.callTime : selectedContract.value.putTime
})

const estimatedPremium = computed(() => {
  return (currentPremium.value || 0) * tradeQuantity.value * 100
})

const estimatedPremiumCNY = computed(() => {
  const rate = EXCHANGE_RATES[chainData.value?.marketType || 1] || 1
  return estimatedPremium.value * rate
})

const estimatedCommission = computed(() => {
  return Math.round(estimatedPremium.value * 0.5 / 1000 * 100) / 100
})

const estimatedCommissionCNY = computed(() => {
  const rate = EXCHANGE_RATES[chainData.value?.marketType || 1] || 1
  return estimatedCommission.value * rate
})

const totalDeductCNY = computed(() => estimatedPremiumCNY.value + estimatedCommissionCNY.value)

const formatMoney = (value) => {
  if (!value && value !== 0) return '0.00'
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const formatExpiryLabel = (dateStr) => {
  const d = new Date(dateStr)
  const today = new Date()
  const days = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}/${dd} (${days}天)`
}

const searchStocks = async (query) => {
  if (!query || !query.trim()) {
    whitelist.value = []
    return
  }
  searchLoading.value = true
  try {
    const res = await getWhitelist()
    const all = (res.data || []).filter(s => s.status === 1)
    const q = query.toLowerCase()
    whitelist.value = all.filter(s =>
      s.stock_code.toLowerCase().includes(q) || s.stock_name.toLowerCase().includes(q)
    )
  } catch (e) {
    whitelist.value = []
  }
  searchLoading.value = false
}

const onStockSelected = async (stock) => {
  if (!stock) {
    selectedStock.value = null
    chainData.value = null
    expirations.value = []
    underlyingPrice.value = 0
    return
  }
  selectedStock.value = stock
  try {
    const expRes = await getExpirations(stock.stock_code, stock.market_type)
    expirations.value = expRes.data || []
    if (expirations.value.length) {
      activeExpiration.value = expirations.value[0]
      await loadChain()
    }
  } catch (e) {
    ElMessage.error(t('common.error'))
  }
}

const onExpirationChange = async () => {
  await loadChain()
}

const loadChain = async () => {
  if (!selectedStock.value || !activeExpiration.value) return
  try {
    const res = await getOptionChain(selectedStock.value.stock_code, selectedStock.value.market_type, activeExpiration.value)
    chainData.value = res.data
    underlyingPrice.value = res.data?.underlyingPrice || 0
    selectedContract.value = null
    await loadOptionPositions()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || t('common.error'))
  }
}

const loadOptionPositions = async () => {
  try {
    const res = await getOptionPositions(currentGroupId.value)
    optionPositions.value = res.data || []
  } catch (e) {}
}

const selectContract = (side, row) => {
  selectedSide.value = side
  selectedContract.value = row
}

const handleBuy = async () => {
  if (!selectedContract.value || !selectedStock.value) {
    return ElMessage.warning(t('options_page.select_contract_hint'))
  }
  if (!tradeQuantity.value || tradeQuantity.value < 1) {
    return ElMessage.warning(t('trade_page.enter_shares'))
  }
  const contractId = selectedSide.value === 'call' ? selectedContract.value.callContractId : selectedContract.value.putContractId
  if (!contractId) return ElMessage.warning('该合约暂不可交易')

  const confirmMsg = `${t('options_page.strike_price')}: $${formatMoney(selectedContract.value.strike)}\n` +
    `${t('options_page.option_type')}: ${selectedSide.value === 'call' ? 'Call' : 'Put'}\n` +
    `${t('options_page.expiration')}: ${activeExpiration.value}\n` +
    `${t('options_page.quantity')}: ${tradeQuantity.value}\n` +
    `${t('options_page.estimated_premium')}: $${formatMoney(estimatedPremium.value)}\n` +
    `${t('options_page.total_deduct')}: ¥${formatMoney(totalDeductCNY.value)}`

  try {
    await ElMessageBox.confirm(confirmMsg, t('options_page.buy_to_open'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  buying.value = true
  try {
    await buyOption({
      contract_id: contractId,
      quantity: tradeQuantity.value,
      group_id: currentGroupId.value
    })
    ElMessage.success(t('options_page.buy_success'))
    tradeQuantity.value = 1
    await loadChain()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || t('common.error'))
  } finally {
    buying.value = false
  }
}

const openSellDialog = (row) => {
  sellRow.value = row
  sellQuantity.value = 1
  sellDialogVisible.value = true
}

const confirmSell = async () => {
  if (!sellQuantity.value || sellQuantity.value < 1) {
    return ElMessage.warning(t('positions_page.enter_sell_shares'))
  }
  selling.value = true
  try {
    await sellOption({ position_id: sellRow.value.positionId, quantity: sellQuantity.value })
    ElMessage.success(t('options_page.sell_success'))
    sellDialogVisible.value = false
    await loadOptionPositions()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || t('common.error'))
  } finally {
    selling.value = false
  }
}

const handleExerciseDirect = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要行权 ${row.stockName} ${row.strikePrice}${row.optionType === 'call' ? 'C' : 'P'} 共 ${row.quantity} 张吗？`,
      t('options_page.exercise'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )
  } catch { return }

  try {
    await exerciseOption({ position_id: row.positionId, quantity: row.quantity })
    ElMessage.success(t('options_page.exercise_success'))
    await loadOptionPositions()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || t('common.error'))
  }
}

onMounted(async () => {
  try {
    const res = await getMyGroups()
    groups.value = res.data || []
    if (groups.value.length > 0) {
      currentGroupId.value = groups.value[0].groupId
    }
  } catch (e) {}
  const allRes = await getWhitelist()
  whitelist.value = (allRes.data || []).filter(s => s.status === 1)
})
</script>

<style scoped>
.options-container {
  padding: 20px;
  background-color: var(--color-bg);
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: var(--color-card);
  border-radius: var(--radius-card);
  margin-bottom: 20px;
}

.stock-selector { margin-bottom: 16px; }
.expiry-selector { margin-bottom: 16px; }
.expiry-selector :deep(.el-tabs__header) { margin-bottom: 0; }

.underlying-price {
  text-align: right;
  font-size: 14px;
  color: var(--color-text-secondary);
}
.underlying-price strong {
  font-size: 18px;
  color: var(--color-primary);
  font-family: var(--font-num);
}

.chain-card { margin-bottom: 16px; }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chain-subtitle { font-size: 12px; color: var(--color-text-secondary); }

.chain-table-wrapper { overflow-x: auto; }
.chain-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-family: var(--font-num);
}
.chain-table th {
  background: var(--color-bg);
  padding: 8px 6px;
  text-align: right;
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text-secondary);
  border-bottom: 2px solid var(--color-border);
  white-space: nowrap;
}
.chain-table td {
  padding: 8px 6px;
  text-align: right;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}
.chain-table tr:hover td { background: #f5f7fa; }
.chain-table tr.selected-row td { background: #ecf5ff; }
.col-strike { font-weight: 700; color: var(--color-text); min-width: 70px; }
.col-premium { font-weight: 600; min-width: 70px; }
.col-value { color: var(--color-text-secondary); min-width: 65px; }
.col-type { font-weight: 700; min-width: 50px; text-align: center !important; }
.col-type.call { color: var(--color-up); }
.col-type.put { color: var(--color-down); }
.col-type.active { background: var(--color-primary); color: #fff !important; border-radius: 4px; }

.trade-panel { margin-bottom: 16px; }
.contract-detail { padding: 0 4px; }
.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}
.detail-row .label { color: var(--color-text-secondary); }
.detail-row .value { font-weight: 600; font-family: var(--font-num); }
.detail-row .highlight { font-size: 20px; color: var(--color-primary); }

.amount { font-size: 16px; font-weight: 700; color: var(--color-primary); font-family: var(--font-num); }
.amount-cny { font-size: 12px; color: var(--color-text-secondary); margin-left: 6px; }
.commission { color: #e6a23c; font-weight: 600; }
.total { font-size: 18px; font-weight: 700; color: var(--color-up); font-family: var(--font-num); }

.my-positions { margin-top: 16px; }
.profit { color: var(--color-up); font-weight: 600; }
.loss { color: var(--color-down); font-weight: 600; }

.no-selection {
  text-align: center;
  padding: 60px 0;
  color: var(--color-text-secondary);
}

.sell-info {
  padding: 10px;
  background: var(--color-bg);
  border-radius: var(--radius-btn);
  margin-bottom: 20px;
}
.sell-info p { margin: 5px 0; }

@media (max-width: 768px) {
  .options-container { padding: 12px; }
  .header { padding: 14px 16px; flex-wrap: wrap; gap: 10px; }
  .chain-table { font-size: 12px; }
  .chain-table th, .chain-table td { padding: 6px 4px; }
}
</style>
