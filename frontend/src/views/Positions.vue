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
          <span>{{ $t('positions_page.current_positions') }}</span>
        </div>
      </template>

      <el-table :data="positions" stripe>
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
          <template #default="{ row }">{{ formatMoney(row.marketValue) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="floatingProfit" :label="$t('positions_page.floating_profit')" width="100">
          <template #default="{ row }">
            <span :class="row.floatingProfit >= 0 ? 'profit' : 'loss'">
              {{ row.floatingProfit >= 0 ? '+' : '' }}{{ formatMoney(row.floatingProfit) }}
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

      <div v-if="positions.length === 0" class="empty">
        <p>{{ $t('positions_page.no_positions') }}</p>
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
  </div>
</template>

<script setup>
/**
 * File: Positions.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Current positions page displaying a table of held stocks with
 *   code, name, market, shares, cost price, current price, market value, and
 *   floating P&L. Includes a sell confirmation dialog.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { getPositions, sellStock } from '@/api/trade'

const { t } = useI18n()

const positions = ref([])

const sellDialogVisible = ref(false)
const sellRow = ref({})
const sellShares = ref(1)
const selling = ref(false)

/**
 * formatDate
 * Description: Formats an ISO date string to a localized Chinese date format.
 * @param {string} dateStr - The ISO date string to format
 * @returns {string} The formatted date string
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN')
}

/**
 * getMarketLabel
 * Description: Returns the display label for a given market type.
 * @param {number} marketType - The market type (1=A, 2=HK, 3=US)
 * @returns {string} The market label string
 */
const getMarketLabel = (marketType) => {
  const labels = { 1: t('market.a_share'), 2: t('market.hk_stock'), 3: t('market.us_stock') }
  return labels[marketType] || t('common.unknown')
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

onMounted(async () => {
  fetchPositions()
})

/**
 * fetchPositions
 * Description: Fetches the current list of positions from the API.
 * @returns {Promise<void>}
 */
const fetchPositions = async () => {
  try {
    const res = await getPositions()
    positions.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * openSellDialog
 * Description: Opens the sell confirmation dialog for the selected position row.
 * @param {Object} row - The position row to sell
 * @returns {void}
 */
const openSellDialog = (row) => {
  sellRow.value = row
  sellShares.value = 1
  sellDialogVisible.value = true
}

/**
 * confirmSell
 * Description: Executes the sell trade for the selected position with the specified shares.
 * @returns {Promise<void>}
 */
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
