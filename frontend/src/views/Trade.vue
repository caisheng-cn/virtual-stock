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

    <el-row :gutter="[16, 16]">
      <el-col :xs="24" :md="12">
        <el-card shadow="never">
          <template #header>
            <div class="card-header">
              <span>{{ $t('trade_page.stock_list') }}</span>
            </div>
          </template>
          <el-select
            v-model="selectedSearchStock"
            filterable
            remote
            :remote-method="searchStocks"
            :loading="searchLoading"
            :placeholder="$t('trade_page.search_placeholder')"
            @change="onStockSelected"
            style="width:100%"
            value-key="stock_code"
            size="large"
            clearable
          >
            <el-option
              v-for="item in searchResults"
              :key="item.stock_code"
              :label="`${item.stock_code} ${item.stock_name}`"
              :value="item"
            />
          </el-select>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
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
              <el-input-number v-model="tradeForm.shares" :min="1" :max="Math.max(1, tradeForm.type === 1 ? maxBuyShares : maxSellShares)" />
              <span v-if="tradeForm.type === 1 && maxBuyShares > 0" class="max-hint">{{ $t('trade_page.max_buy') }}: {{ maxBuyShares }}</span>
              <span v-else-if="tradeForm.type === 2 && maxSellShares > 0" class="max-hint">{{ $t('trade_page.max_sell') }}: {{ maxSellShares }}</span>
            </el-form-item>
            <el-form-item :label="$t('trade_page.estimated_amount')">
              <span class="amount">{{ formatMoney(amountOriginal) }} {{ currencySymbol }}</span>
              <span class="amount-cny">({{ formatMoney(amountCNY) }} RMB)</span>
              <span v-if="tradeForm.type === 1" class="balance-hint">{{ $t('trade_page.available_balance') }}: {{ formatMoney(userCash) }} RMB</span>
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
import { buyStock, sellStock, getPositions } from '@/api/trade'
import { getBalance } from '@/api/group'

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
const selectedStock = ref(null)
const stockQuote = ref(null)
const searchResults = ref([])
const searchLoading = ref(false)
const selectedSearchStock = ref(null)
let searchTimer = null
const loading = ref(false)
const userCash = ref(0)
const positionShares = ref(0)
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

const maxBuyShares = computed(() => {
  if (!stockQuote.value?.price) return 0
  const rate = EXCHANGE_RATES[marketType.value] || 1
  const priceInRMB = stockQuote.value.price * rate
  if (priceInRMB <= 0) return 0
  return Math.floor(userCash.value / priceInRMB)
})

const maxSellShares = computed(() => positionShares.value)

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
 * searchStocks
 * Description: Debounced stock search. Supports query by stock code, name, or pinyin initials.
 * @param {string} query - The search keyword
 * @returns {void}
 */
const searchStocks = (query) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!query || !query.trim()) {
    searchResults.value = []
    return
  }
  searchLoading.value = true
  searchTimer = setTimeout(async () => {
    try {
      const res = await getStockList({ market_type: marketType.value, keyword: query.trim(), page: 1, pageSize: 50 })
      searchResults.value = res.data?.list || []
    } catch (err) {
      console.error('searchStocks error:', err)
      searchResults.value = []
    }
    searchLoading.value = false
  }, 300)
}

/**
 * handleMarketChange
 * Description: Resets the selected stock, quote, and search state when market tab changes.
 * @returns {void}
 */
const handleMarketChange = () => {
  selectedStock.value = null
  stockQuote.value = null
  selectedSearchStock.value = null
  searchResults.value = []
}

/**
 * onStockSelected
 * Description: Handles stock selection from search dropdown: fetches quote data,
 *   initializes the chart, then loads the stock history.
 * @param {Object} stock - The selected stock object
 * @returns {Promise<void>}
 */
const onStockSelected = async (stock) => {
  if (!stock) {
    selectedStock.value = null
    stockQuote.value = null
    return
  }
  console.log('onStockSelected:', stock.stock_code)
  selectedStock.value = stock

  // Fetch quote, balance, and positions in parallel
  const [quoteRes, balanceRes, posRes] = await Promise.all([
    getStockQuote(stock.stock_code, stock.market_type).catch(() => ({ data: null })),
    getBalance().catch(() => ({ data: null })),
    getPositions().catch(() => [])
  ])

  stockQuote.value = quoteRes?.data || stockQuote.value
  userCash.value = balanceRes?.data?.cash || 0

  const pos = (Array.isArray(posRes) ? posRes : posRes?.data || []).find(
    p => p.stockCode === stock.stock_code && p.marketType === stock.market_type
  )
  positionShares.value = pos?.shares || 0

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

.market-tabs {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.stock-info {
  padding: 10px 0;
}

.stock-info :deep(.el-descriptions__title) {
  font-family: var(--font-display);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border);
}

.info-row .label {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.info-row .value {
  font-weight: 600;
  font-family: var(--font-num);
}

.info-row .price {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-up);
}

.amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
  font-family: var(--font-num);
}

.amount-cny {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-left: 10px;
}

.max-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 10px;
  white-space: nowrap;
}

.balance-hint {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 12px;
}

.commission {
  color: #e6a23c;
  font-weight: 600;
}

.commission-rate {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-left: 8px;
}

.total-deduct {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-up);
  font-family: var(--font-num);
}

.total-deduct.sell {
  color: var(--color-down);
}

.no-selection {
  text-align: center;
  padding: 60px 0;
  color: var(--color-text-secondary);
}

.chart-container {
  width: 100%;
  height: 400px;
  min-height: 300px;
  margin-bottom: 15px;
  background-color: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
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

@media (max-width: 768px) {
  .trade-container {
    padding: 12px;
  }
  .header {
    padding: 14px 16px;
  }
  .chart-container {
    height: 300px;
    min-height: 250px;
  }
  .stock-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 16px;
  }
  .info-row .price {
    font-size: 22px;
  }
}
</style>
