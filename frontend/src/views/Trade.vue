<template>
  <div class="trade-container">
    <div class="header">
      <h2>{{ $t('trade_page.title') }}</h2>
      <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
    </div>

    <el-card class="market-tabs">
      <el-radio-group v-model="marketType" @change="handleMarketChange">
        <el-radio-button :label="1">{{ $t('market.a_share') }}</el-radio-button>
        <el-radio-button :label="2">{{ $t('market.hk_stock') }}</el-radio-button>
        <el-radio-button :label="3">{{ $t('market.us_stock') }}</el-radio-button>
      </el-radio-group>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ $t('trade_page.stock_list') }}</span>
              <el-input v-model="keyword" :placeholder="$t('trade_page.search_stock')" style="width: 200px;" @input="handleSearch" />
            </div>
          </template>
          <el-table :data="stocks" height="400" @row-click="handleRowClick">
            <el-table-column prop="stock_code" :label="$t('trade_page.stock_code')" width="100" />
            <el-table-column prop="stock_name" :label="$t('trade_page.stock_name')" />
          </el-table>
          <el-pagination
            v-model:current-page="page"
            :page-size="20"
            :total="total"
            layout="prev, pager, next"
            @current-change="fetchStocks"
          />
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card v-if="selectedStock">
          <template #header>
            <div class="card-header">
              <span>{{ selectedStock.stock_name }} ({{ selectedStock.stock_code }})</span>
              <el-radio-group v-model="klineType" size="small" @change="handleKlineTypeChange">
                <el-radio-button label="day">{{ $t('trade_page.daily_k') }}</el-radio-button>
                <el-radio-button label="week">{{ $t('trade_page.weekly_k') }}</el-radio-button>
                <el-radio-button label="month">{{ $t('trade_page.monthly_k') }}</el-radio-button>
              </el-radio-group>
            </div>
          </template>

          <div v-if="klineLoading" class="chart-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ $t('trade_page.loading_kline') }}</span>
          </div>
          <div v-else-if="klineError" class="chart-error">
            <span>{{ klineError }}</span>
          </div>
          <div ref="chartContainer" class="chart-container" v-show="!klineLoading && !klineError">
            <div style="padding: 10px;">
              chartReady={{ chartReady }}, dataCount={{ dataCount }}
            </div>
          </div>

          <div class="stock-info">
            <div class="info-row">
              <span class="label">{{ $t('trade_page.current_price') }}：</span>
              <span class="value price">{{ formatMoney(stockQuote?.price) || '-' }} {{ currencySymbol }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('trade_page.prev_close') }}：</span>
              <span class="value">{{ formatMoney(stockQuote?.prevClose) || '-' }} {{ currencySymbol }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('trade_page.open_price') }}：</span>
              <span class="value">{{ formatMoney(stockQuote?.openPrice) || '-' }} {{ currencySymbol }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('trade_page.high_price') }}：</span>
              <span class="value">{{ formatMoney(stockQuote?.highPrice) || '-' }} {{ currencySymbol }}</span>
            </div>
            <div class="info-row">
              <span class="label">{{ $t('trade_page.low_price') }}：</span>
              <span class="value">{{ formatMoney(stockQuote?.lowPrice) || '-' }} {{ currencySymbol }}</span>
            </div>
          </div>

          <el-divider />

          <el-form :model="tradeForm" label-width="80px">
            <el-form-item :label="$t('trade_page.trade_type')">
              <el-radio-group v-model="tradeForm.type">
                <el-radio :label="1">{{ $t('trade_page.buy') }}</el-radio>
                <el-radio :label="2">{{ $t('trade_page.sell') }}</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item :label="$t('trade_page.shares')">
              <el-input-number v-model="tradeForm.shares" :min="1" />
            </el-form-item>
            <el-form-item :label="$t('trade_page.estimated_amount')">
              <span class="amount">{{ formatMoney(amountOriginal) }} {{ currencySymbol }}</span>
              <span class="amount-cny">({{ formatMoney(amountCNY) }} RMB)</span>
            </el-form-item>
            <el-form-item :label="$t('trade_page.estimated_commission')">
              <span class="commission">{{ formatMoney(estimatedCommission) }} {{ currencySymbol }}</span>
              <span class="commission-rate">({{ $t('trade_page.rate') }}: {{ commissionRateDisplay }}, ~{{ formatMoney(estimatedCommissionCNY) }} RMB)</span>
            </el-form-item>
            <el-form-item :label="$t('trade_page.actual_deduction')">
              <span class="total-deduct" :class="{ 'sell': tradeForm.type === 2 }">
                {{ formatMoney(estimatedTotal) }} RMB
              </span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="handleTrade" :loading="loading">{{ tradeForm.type === 1 ? $t('trade_page.confirm_buy') : $t('trade_page.confirm_sell') }}</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card v-else>
          <div class="no-selection">
            <p>{{ $t('trade_page.no_stock_selected') }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
/**
 * File: Trade.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Stock trading page with market tabs (A/HK/US), stock list with search
 *   and pagination, K-line chart using lightweight-charts, stock quote info, and
 *   buy/sell form with commission calculation.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { createChart } from 'lightweight-charts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getStockList, getStockQuote, getStockHistory, getCommissionConfigs } from '@/api/stock'
import { buyStock, sellStock } from '@/api/trade'

const { t } = useI18n()

let chart = null
let candlestickSeries = null
let volumeSeries = null

const CURRENCY_SYMBOL = { 1: '¥', 2: 'HKD', 3: 'USD' }
const EXCHANGE_RATES = { 1: 1, 2: 0.9, 3: 7 }

const tradeForm = reactive({
  type: 1,
  shares: 100
})

const marketType = ref(1)
const keyword = ref('')
const page = ref(1)
const total = ref(0)
const stocks = ref([])
const selectedStock = ref(null)
const stockQuote = ref(null)
const loading = ref(false)
const chartContainer = ref(null)
const klineType = ref('day')
const klineLoading = ref(false)
const klineError = ref('')
const chartReady = ref(false)
const dataCount = ref(0)
const containerWidth = ref(0)
const containerHeight = ref(0)

const amountOriginal = computed(() => {
  if (!stockQuote.value?.price) return 0
  return tradeForm.shares * stockQuote.value.price
})

const amountCNY = computed(() => {
  if (!stockQuote.value?.price) return 0
  const rate = EXCHANGE_RATES[marketType.value] || 1
  return amountOriginal.value * rate
})

const currencySymbol = computed(() => CURRENCY_SYMBOL[marketType.value] || 'RMB')

const commissionConfigs = ref({})
const commissionConfigsLoaded = ref(false)

/**
 * loadCommissionConfigs
 * Description: Fetches commission rate configurations from the API and builds
 *   a lookup map keyed by market_type and trade_type.
 * @returns {Promise<void>}
 */
async function loadCommissionConfigs() {
  try {
    const configs = await getCommissionConfigs()
    const map = {}
    for (const c of configs.data || []) {
      const key = `${c.market_type}_${c.trade_type}`
      map[key] = parseFloat(c.commission_rate)
    }
    commissionConfigs.value = map
    commissionConfigsLoaded.value = true
  } catch (e) {
    console.error('Failed to load commission configs:', e)
  }
}

/**
 * getRate
 * Description: Retrieves the commission rate for a given market and trade type.
 * @param {number} marketType - The market type (1=A, 2=HK, 3=US)
 * @param {number} tradeType - The trade type (1=buy, 2=sell)
 * @returns {number} The commission rate in per-mille
 */
const getRate = (marketType, tradeType) => {
  const key = `${marketType}_${tradeType}`
  return commissionConfigs.value[key] ?? 0.5
}

const estimatedCommission = computed(() => {
  if (!stockQuote.value?.price) return 0
  const commissionRate = getRate(marketType.value, tradeForm.type)
  return Math.round(amountOriginal.value * commissionRate / 1000 * 100) / 100
})

const estimatedCommissionCNY = computed(() => {
  const rate = EXCHANGE_RATES[marketType.value] || 1
  return Math.round(estimatedCommission.value * rate * 100) / 100
})

const estimatedTotal = computed(() => {
  if (tradeForm.type === 1) {
    return amountCNY.value + estimatedCommissionCNY.value
  } else {
    return amountCNY.value - estimatedCommissionCNY.value
  }
})

const commissionRateDisplay = computed(() => {
  const rate = getRate(marketType.value, tradeForm.type)
  return rate.toFixed(1) + '‰'
})

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

onMounted(() => {
  fetchStocks()
  loadCommissionConfigs()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (chart) {
    chart.remove()
    chart = null
  }
})

/**
 * handleResize
 * Description: Resizes the lightweight-charts chart when the browser window is resized.
 * @returns {void}
 */
const handleResize = () => {
  if (chart && chartContainer.value) {
    chart.applyOptions({
      width: chartContainer.value.clientWidth,
      height: chartContainer.value.clientHeight
    })
    console.log('chart resized')
  }
}

/**
 * initChart
 * Description: Initializes the lightweight-charts candlestick and volume series
 *   within the chart container element. Destroys any previous chart instance first.
 * @returns {Promise<void>}
 */
const initChart = async () => {
  await nextTick()

  console.log('initChart: chartContainer:', !!chartContainer.value, 'clientWidth:', chartContainer.value?.clientWidth)

  if (!chartContainer.value) {
    klineError.value = 'Chart container not initialized'
    return
  }

  chartReady.value = false
  klineError.value = ''
  dataCount.value = 0

  containerWidth.value = chartContainer.value.clientWidth || 582
  containerHeight.value = chartContainer.value.clientHeight || 300

  if (chart) {
    chart.remove()
    chart = null
  }

  try {
    chart = createChart(chartContainer.value, {
      width: containerWidth.value,
      height: containerHeight.value,
      layout: {
        background: { type: 'solid', color: '#fff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' }
      },
      rightPriceScale: {
        borderVisible: false
      },
      timeScale: {
        borderVisible: false
      }
    })

    candlestickSeries = chart.addCandlestickSeries({
      upColor: '#ef5350',
      downColor: '#26a69a',
      borderUpColor: '#ef5350',
      borderDownColor: '#26a69a',
      wickUpColor: '#ef5350',
      wickDownColor: '#26a69a'
    })

    volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume'
    })
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.7, bottom: 0 } })

    chartReady.value = true
    console.log('lightweight-charts inited OK')

    window.addEventListener('resize', () => {
      if (chart && chartContainer.value) {
        chart.applyOptions({
          width: chartContainer.value.clientWidth,
          height: chartContainer.value.clientHeight
        })
      }
    })
  } catch(e) {
    console.error('Chart init error:', e)
  }
}

/**
 * fetchStockHistory
 * Description: Fetches historical K-line data for the selected stock and renders
 *   it on the chart. Supports day/week/month aggregation.
 * @returns {Promise<void>}
 */
const fetchStockHistory = async () => {
  if (!chart) return

  klineLoading.value = true
  klineError.value = ''
  dataCount.value = 0

  console.log('fetchStockHistory called, selectedStock:', selectedStock.value?.stock_code)

  try {
    const res = await getStockHistory(
      selectedStock.value.stock_code,
      marketType.value,
      { source: 'db' }
    )

klineLoading.value = false

    console.log('fetchStockHistory result, res:', res)

    let data = []
    if (res) {
      if (Array.isArray(res)) {
        data = res
      } else if (res.data && Array.isArray(res.data)) {
        data = res.data
      } else if (res.data && res.data.data && Array.isArray(res.data.data)) {
        data = res.data.data
      }
    }

    dataCount.value = data.length
    console.log('data length:', data.length)

    if (data.length === 0) {
      klineError.value = 'No data'
      return
    }

    const validData = data.filter(d =>
      d.openPrice != null && d.closePrice != null && d.lowPrice != null && d.highPrice != null
    )
    console.log('filtered data:', validData.length, 'from', data.length)

    if (validData.length === 0) {
      klineError.value = t('trade_page.no_valid_data')
      return
    }

    data = validData

    if (klineType.value === 'week') {
      data = convertToWeekly(data)
      console.log('weekly data sample:', data[0])
    } else if (klineType.value === 'month') {
      data = convertToMonthly(data)
      console.log('monthly data sample:', data[0])
    }

    if (chart && data.length > 0) {
      console.log('first data:', data[0])

      const candleData = data.map(d => ({
        time: d.tradeDate,
        open: Number(d.openPrice ?? d.open),
        high: Number(d.highPrice ?? d.high),
        low: Number(d.lowPrice ?? d.low),
        close: Number(d.closePrice ?? d.close)
      }))
      console.log('candle sample:', candleData[0])

      const volumeData = data.map(d => ({
        time: d.tradeDate,
        value: Number(d.volume ?? d.volume) || 0,
        color: Number(d.closePrice ?? d.close) >= Number(d.openPrice ?? d.open) ? '#ef5350' : '#26a69a'
      }))

      try {
        candlestickSeries.setData(candleData)
        volumeSeries.setData(volumeData)
        chart.timeScale().fitContent()
        console.log('Chart rendered OK')
      } catch(e) {
        console.error('Chart render error:', e)
      }
    }
  } catch (err) {
    klineError.value = err.message || t('trade_page.trade_failed')
  }
}

/**
 * convertToWeekly
 * Description: Aggregates daily K-line data into weekly bars by grouping on ISO week number.
 * @param {Array} data - Array of daily K-line data objects
 * @returns {Array} Array of weekly aggregated data objects
 */
const convertToWeekly = (data) => {
  if (data.length === 0) return []
  const weeks = {}
  data.forEach(d => {
    const date = new Date(d.tradeDate)
    const year = date.getFullYear()
    const week = getWeekNumber(date)
    const key = `${year}-W${week}`
    if (!weeks[key]) {
      weeks[key] = { tradeDate: d.tradeDate, open: d.openPrice, high: d.highPrice, low: d.lowPrice, close: d.closePrice, volume: 0 }
    } else {
      weeks[key].high = Math.max(weeks[key].high, Number(d.highPrice))
      weeks[key].low = Math.min(weeks[key].low, Number(d.lowPrice))
      weeks[key].close = d.closePrice
      weeks[key].volume = (weeks[key].volume || 0) + Number(d.volume)
    }
  })
  return Object.values(weeks)
}

/**
 * convertToMonthly
 * Description: Aggregates daily K-line data into monthly bars by grouping on year-month.
 * @param {Array} data - Array of daily K-line data objects
 * @returns {Array} Array of monthly aggregated data objects
 */
const convertToMonthly = (data) => {
  if (data.length === 0) return []
  const months = {}
  data.forEach(d => {
    const key = d.tradeDate.substring(0, 7)
    if (!months[key]) {
      months[key] = { tradeDate: d.tradeDate, open: d.openPrice, high: d.highPrice, low: d.lowPrice, close: d.closePrice, volume: 0 }
    } else {
      months[key].high = Math.max(months[key].high, Number(d.highPrice))
      months[key].low = Math.min(months[key].low, Number(d.lowPrice))
      months[key].close = d.closePrice
      months[key].volume = (months[key].volume || 0) + Number(d.volume)
    }
  })
  return Object.values(months)
}

/**
 * getWeekNumber
 * Description: Calculates the ISO week number for a given date.
 * @param {Date} date - The date to calculate the week number for
 * @returns {number} The ISO week number
 */
const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

/**
 * handleKlineTypeChange
 * Description: Re-fetches stock history when the K-line type (day/week/month) selection changes.
 * @returns {void}
 */
const handleKlineTypeChange = () => {
  console.log('handleKlineTypeChange, klineType:', klineType.value)
  fetchStockHistory()
}

/**
 * fetchStocks
 * Description: Fetches the stock list for the current market type with pagination and search keyword.
 * @returns {Promise<void>}
 */
const fetchStocks = async () => {
  console.log('fetchStocks called, marketType:', marketType.value)
  try {
    const res = await getStockList({ market_type: marketType.value, page: page.value, pageSize: 20, keyword: keyword.value })
    console.log('fetchStocks result:', res)
    stocks.value = res.data.list
    total.value = res.data.total
  } catch (err) {
    console.error('fetchStocks error:', err)
    ElMessage.error(err.message || t('trade_page.trade_failed'))
  }
}

/**
 * handleMarketChange
 * Description: Resets the selected stock and quote, then re-fetches the stock list
 *   when the market tab selection changes.
 * @returns {void}
 */
const handleMarketChange = () => {
  selectedStock.value = null
  stockQuote.value = null
  fetchStocks()
}

/**
 * handleSearch
 * Description: Resets pagination to page 1 and re-fetches stocks when the search keyword changes.
 * @returns {void}
 */
const handleSearch = () => {
  page.value = 1
  fetchStocks()
}

/**
 * handleRowClick
 * Description: Handles stock row selection: fetches quote data, initializes the chart,
 *   then loads the stock history for the selected stock.
 * @param {Object} row - The clicked stock row object
 * @returns {Promise<void>}
 */
const handleRowClick = async (row) => {
  console.log('handleRowClick:', row.stock_code)
  selectedStock.value = row
  try {
    const res = await getStockQuote(row.stock_code, row.market_type)
    stockQuote.value = res.data
    console.log('quote:', stockQuote.value)
  } catch (err) {
    ElMessage.error(err.message || t('trade_page.trade_failed'))
  }

  initChart()

  setTimeout(async () => {
    console.log('after initChart, chartReady:', chartReady.value, 'klineError:', klineError.value)
    await fetchStockHistory()
  }, 500)
}

/**
 * handleTrade
 * Description: Validates the trade form, shows a confirmation dialog with estimated
 *   costs, then executes the buy or sell trade via the API.
 * @returns {Promise<void>}
 */
const handleTrade = async () => {
  if (!selectedStock.value) {
    return ElMessage.warning(t('trade_page.select_stock_first'))
  }
  if (!tradeForm.shares) {
    return ElMessage.warning(t('trade_page.enter_shares'))
  }

  const isBuy = tradeForm.type === 1
  const stockName = selectedStock.value.stock_name
  const shares = tradeForm.shares
  const price = stockQuote.value?.price || 0
  const amount = amountOriginal.value
  const amountCny = amountCNY.value
  const commission = estimatedCommission.value
  const commissionCny = estimatedCommissionCNY.value
  const totalCny = estimatedTotal.value

  const confirmMsg = isBuy
    ? `${t('trade_page.stock_name')}: ${stockName}\n${t('trade_page.shares')}: ${shares}\n${t('trade_page.current_price')}: ${price} ${currencySymbol.value} (~${formatMoney(price * EXCHANGE_RATES[marketType.value])} RMB)\n${t('trade_page.estimated_amount')}: ${formatMoney(amount)} ${currencySymbol.value} (~${formatMoney(amountCny)} RMB)\n${t('trade_page.estimated_commission')}: ${formatMoney(commission)} ${currencySymbol.value} (~${formatMoney(commissionCny)} RMB)\n${t('trade_page.actual_deduction')}: ${formatMoney(totalCny)} RMB`
    : `${t('trade_page.stock_name')}: ${stockName}\n${t('trade_page.shares')}: ${shares}\n${t('trade_page.current_price')}: ${price} ${currencySymbol.value} (~${formatMoney(price * EXCHANGE_RATES[marketType.value])} RMB)\n${t('trade_page.estimated_amount')}: ${formatMoney(amount)} ${currencySymbol.value} (~${formatMoney(amountCny)} RMB)\n${t('trade_page.estimated_commission')}: ${formatMoney(commission)} ${currencySymbol.value} (~${formatMoney(commissionCny)} RMB)\n${t('trade_page.actual_deduction')}: ${formatMoney(totalCny)} RMB`

  try {
    await ElMessageBox.confirm(confirmMsg, t('trade_page.confirm_trade'), {
      confirmButtonText: t('trade_page.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  loading.value = true
  try {
    if (isBuy) {
      await buyStock({
        stock_code: selectedStock.value.stock_code,
        market_type: marketType.value,
        shares: tradeForm.shares
      })
      ElMessage.success(t('trade_page.buy_success'))
    } else {
      await sellStock({
        stock_code: selectedStock.value.stock_code,
        market_type: marketType.value,
        shares: tradeForm.shares
      })
      ElMessage.success(t('trade_page.sell_success'))
    }
    tradeForm.shares = 100
  } catch (err) {
    ElMessage.error(err.message || t('trade_page.trade_failed'))
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  if (chart) {
    chart.remove()
    chart = null
  }
})
</script>

<style scoped>
.trade-container {
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

.market-tabs {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stock-info {
  padding: 10px 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.info-row .label {
  color: #999;
}

.info-row .value {
  font-weight: bold;
}

.info-row .price {
  font-size: 24px;
  color: #f56c6c;
}

.amount {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.amount-cny {
  font-size: 14px;
  color: #999;
  margin-left: 10px;
}

.commission {
  color: #e6a23c;
  font-weight: bold;
}

.commission-rate {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}

.total-deduct {
  font-size: 20px;
  font-weight: bold;
  color: #f56c6c;
}

.total-deduct.sell {
  color: #67c23a;
}

.no-selection {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

.chart-container {
  width: 100%;
  height: 400px;
  min-height: 400px;
  margin-bottom: 15px;
  background-color: #fff;
  border: 1px dashed #999;
}

#kline-inner {
  width: 100%;
  height: 100%;
}

.chart-debug {
  padding: 10px;
  font-size: 12px;
  color: #666;
}

.chart-debug p {
  margin: 4px 0;
}
</style>
