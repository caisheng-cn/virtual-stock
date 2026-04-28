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

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN')
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
})

const fetchPositions = async () => {
  try {
    const res = await getPositions()
    positions.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
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
</script>

<style scoped>
.positions-container {
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
}

.loss {
  color: #67c23a;
}

.empty {
  text-align: center;
  padding: 40px;
  color: #999;
}

.sell-info {
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
  margin-bottom: 20px;
}

.sell-info p {
  margin: 5px 0;
}
</style>
