<template>
  <div class="positions-container">
    <div class="header">
      <h2>{{ $t('positions_page.title') }}</h2>
      <div>
        <el-button type="primary" @click="$router.push('/trade')">{{ $t('nav.trade') }}</el-button>
        <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
      </div>
    </div>

    <el-card>
      <template #header>
        <div class="card-header">
          <el-tabs v-model="activeTab" class="position-tabs">
            <el-tab-pane :label="$t('positions_page.stock_tab')" name="stock" />
            <el-tab-pane :label="$t('positions_page.option_tab')" name="option" />
          </el-tabs>
        </div>
      </template>

      <el-table v-if="activeTab === 'stock'" :data="positions" stripe>
        <el-table-column prop="stockCode" :label="$t('positions_page.stock_code')" width="100" />
        <el-table-column :label="$t('positions_page.stock_name')">
          <template #default="{ row }">{{ row.stockName || row.stockCode }}</template>
        </el-table-column>
        <el-table-column :label="$t('positions_page.market')" width="70">
          <template #default="{ row }">
            <el-tag size="small">{{ getMarketLabel(row.marketType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('positions_page.purchase_date')" width="110">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="shares" :label="$t('positions_page.shares')" width="100" />
        <el-table-column :label="$t('positions_page.cost_price')" width="120">
          <template #default="{ row }">{{ formatMoney(row.avgCost) || '-' }} {{ row.currency }}</template>
        </el-table-column>
        <el-table-column :label="$t('positions_page.current_price')" width="120">
          <template #default="{ row }">{{ formatMoney(row.currentPrice) || '-' }} {{ row.currency }}</template>
        </el-table-column>
        <el-table-column :label="$t('positions_page.market_value')" width="140">
          <template #default="{ row }">¥{{ formatMoney(row.marketValue) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="floatingProfit" :label="$t('positions_page.floating_profit')" width="100">
          <template #default="{ row }">
            <span :class="row.floatingProfit >= 0 ? 'profit' : 'loss'">
              {{ row.floatingProfit >= 0 ? '+' : '' }}¥{{ formatMoney(row.floatingProfit) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="floatingProfitRate" :label="$t('positions_page.floating_profit_rate')" width="100">
          <template #default="{ row }">
            <span :class="row.floatingProfitRate >= 0 ? 'profit' : 'loss'">
              {{ row.floatingProfitRate >= 0 ? '+' : '' }}{{ row.floatingProfitRate?.toFixed(2) || '0.00' }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('positions_page.sell')" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="openSellDialog(row)">{{ $t('positions_page.sell') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-table v-if="activeTab === 'option'" :data="optionPositions" stripe>
        <el-table-column prop="contractCode" :label="$t('options_page.contract_code')" width="130" />
        <el-table-column prop="stockCode" :label="$t('positions_page.stock_code')" width="70" />
        <el-table-column :label="$t('options_page.option_type')" width="70">
          <template #default="{ row }">
            <el-tag :type="row.optionType === 'call' ? 'success' : 'danger'" size="small">
              {{ row.optionType === 'call' ? 'Call' : 'Put' }}
            </el-tag>
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
        <el-table-column :label="$t('options_page.market_value_cny')" width="110">
          <template #default="{ row }">¥{{ formatMoney(row.marketValue) }}</template>
        </el-table-column>
        <el-table-column :label="$t('options_page.moneyness')" width="70">
          <template #default="{ row }">
            <el-tag :type="row.moneyness === 'itm' ? 'success' : row.moneyness === 'atm' ? 'warning' : 'info'" size="small">
              {{ row.moneyness === 'itm' ? t('options_page.itm') : row.moneyness === 'atm' ? t('options_page.atm') : t('options_page.otm') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('options_page.profit')" width="110">
          <template #default="{ row }">
            <span :class="row.profit >= 0 ? 'profit' : 'loss'">
              {{ row.profit >= 0 ? '+' : '' }}¥{{ formatMoney(row.profit) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="$t('options_page.actions')" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="openOptionSellDialog(row)">{{ $t('options_page.sell_to_close') }}</el-button>
            <el-button size="small" type="warning" @click="handleOptionExercise(row)"
              :disabled="row.moneyness !== 'itm'">{{ $t('options_page.exercise') }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="activeTab === 'stock' && positions.length === 0" class="empty">
        <p>{{ $t('positions_page.no_positions') }}</p>
      </div>
      <div v-if="activeTab === 'option' && optionPositions.length === 0" class="empty">
        <p>{{ $t('options_page.no_positions') }}</p>
      </div>
    </el-card>

    <el-dialog v-model="sellDialogVisible" :title="$t('positions_page.sell_title')" width="400px">
      <div class="sell-info">
        <p><strong>{{ sellRow.stockName || sellRow.stockCode }}</strong></p>
        <p>{{ $t('positions_page.current_price_label') }} {{ formatMoney(sellRow.currentPrice) }} {{ sellRow.currency }}</p>
        <p>{{ $t('positions_page.available_shares') }} {{ sellRow.shares }}</p>
      </div>
      <el-form label-width="80px">
        <el-form-item :label="$t('positions_page.sell_shares')">
          <el-input-number v-model="sellShares" :min="1" :max="sellRow.shares" />
        </el-form-item>
        <el-form-item :label="$t('positions_page.estimated_amount')">
          <span>{{ formatMoney(sellShares * sellRow.currentPrice) }} {{ sellRow.currency }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="sellDialogVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmSell" :loading="selling">{{ $t('positions_page.confirm_sell') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="optionSellVisible" :title="$t('options_page.sell_to_close')" width="400px">
      <div class="sell-info">
        <p><strong>{{ optionSellRow.stockName }} {{ optionSellRow.strikePrice }}{{ optionSellRow.optionType === 'call' ? 'C' : 'P' }}</strong></p>
        <p>{{ $t('options_page.strike_price') }}: ${{ formatMoney(optionSellRow.strikePrice) }}</p>
        <p>{{ $t('options_page.current_premium') }}: ${{ formatMoney(optionSellRow.currentPremium) }}</p>
        <p>{{ $t('options_page.available_qty') }}: {{ optionSellRow.quantity }}</p>
      </div>
      <el-form label-width="80px">
        <el-form-item :label="$t('options_page.quantity')">
          <el-input-number v-model="optionSellQty" :min="1" :max="optionSellRow.quantity || 1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="optionSellVisible = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="confirmOptionSell" :loading="optionSelling">{{ $t('options_page.confirm_sell') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * File: Positions.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Current positions page with tab switching between stock holdings
 *   and option positions. Stock section includes sell dialog; option section
 *   includes sell-to-close and exercise actions.
 * Version History:
 *   v1.0 - Initial version
 *   v2.0 - Added options positions tab (2026-05-13)
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPositions, sellStock } from '@/api/trade'
import { getOptionPositions, sellOption, exerciseOption } from '@/api/options'

const { t } = useI18n()

const activeTab = ref('stock')
const positions = ref([])
const optionPositions = ref([])

const sellDialogVisible = ref(false)
const sellRow = ref({})
const sellShares = ref(1)
const selling = ref(false)

const optionSellVisible = ref(false)
const optionSellRow = ref({})
const optionSellQty = ref(1)
const optionSelling = ref(false)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return dateStr.substring(0, 10)
}

const getMarketLabel = (marketType) => {
  const labels = { 1: t('market.a_share'), 2: t('market.hk_stock'), 3: t('market.us_stock') }
  return labels[marketType] || t('common.unknown')
}

const formatMoney = (value) => {
  if (!value && value !== 0) return '0.00'
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

onMounted(async () => {
  fetchPositions()
  fetchOptionPositions()
})

const fetchPositions = async () => {
  try {
    const res = await getPositions()
    positions.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

const fetchOptionPositions = async () => {
  try {
    const res = await getOptionPositions()
    optionPositions.value = res.data || []
  } catch (err) {
    console.error('fetch option positions error:', err)
  }
}

const openSellDialog = (row) => {
  sellRow.value = row
  sellShares.value = 1
  sellDialogVisible.value = true
}

const confirmSell = async () => {
  if (!sellShares.value || sellShares.value < 1) {
    return ElMessage.warning(t('positions_page.enter_sell_shares'))
  }
  selling.value = true
  try {
    await sellStock({
      stock_code: sellRow.value.stockCode,
      market_type: sellRow.value.marketType,
      shares: sellShares.value
    })
    ElMessage.success(t('positions_page.sell_success'))
    sellDialogVisible.value = false
    fetchPositions()
  } catch (err) {
    ElMessage.error(err.message || t('positions_page.sell_failed'))
  } finally {
    selling.value = false
  }
}

const openOptionSellDialog = (row) => {
  optionSellRow.value = row
  optionSellQty.value = 1
  optionSellVisible.value = true
}

const confirmOptionSell = async () => {
  if (!optionSellQty.value || optionSellQty.value < 1) return
  optionSelling.value = true
  try {
    await sellOption({ position_id: optionSellRow.value.positionId, quantity: optionSellQty.value })
    ElMessage.success(t('options_page.sell_success'))
    optionSellVisible.value = false
    fetchOptionPositions()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || t('common.error'))
  } finally {
    optionSelling.value = false
  }
}

const handleOptionExercise = async (row) => {
  try {
    await ElMessageBox.confirm(
      `${t('options_page.exercise_confirm')} ${row.stockName} ${row.strikePrice}${row.optionType === 'call' ? 'C' : 'P'} x ${row.quantity}?`,
      t('options_page.exercise'),
      { confirmButtonText: t('common.confirm'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )
  } catch { return }
  try {
    await exerciseOption({ position_id: row.positionId, quantity: row.quantity })
    ElMessage.success(t('options_page.exercise_success'))
    fetchOptionPositions()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || t('common.error'))
  }
}
</script>

<style scoped>
.positions-container {
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profit {
  color: var(--color-up);
  font-weight: 600;
}

.loss {
  color: var(--color-down);
  font-weight: 600;
}

.position-tabs { margin-top: -8px; }
.position-tabs :deep(.el-tabs__header) { margin-bottom: 0; border-bottom: none; }

.empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-secondary);
}

.sell-info {
  padding: 10px;
  background: var(--color-bg);
  border-radius: var(--radius-btn);
  margin-bottom: 20px;
}

.sell-info p {
  margin: 5px 0;
}

@media (max-width: 768px) {
  .positions-container {
    padding: 12px;
  }
  .header {
    padding: 14px 16px;
    flex-wrap: wrap;
    gap: 10px;
  }
  :deep(.el-dialog) {
    width: 92% !important;
  }
}
</style>
