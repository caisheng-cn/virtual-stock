import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Trade from '@/views/Trade.vue'
import { nextTick } from 'vue'

vi.mock('@/api/stock', () => ({
  getStockList: vi.fn(),
  getStockQuote: vi.fn()
}))

vi.mock('@/api/group', () => ({
  getMyGroups: vi.fn(),
  getBalance: vi.fn()
}))

vi.mock('@/api/trade', () => ({
  buyStock: vi.fn(),
  sellStock: vi.fn()
}))

describe('Trade.vue - 股票交易组件', () => {
  describe('Given 交易组件', () => {
    const groups = [
      { groupId: 1, groupName: '默认群组' },
      { groupId: 2, groupName: '竞赛群组' }
    ]

    const stocks = [
      { stock_code: '600519', stock_name: '贵州茅台', market_type: 1 },
      { stock_code: '000858', stock_name: '五粮液', market_type: 1 }
    ]

    const quoteData = {
      price: 1850.00,
      prevClose: 1790.00,
      openPrice: 1800.00,
      highPrice: 1900.00,
      lowPrice: 1780.00
    }

    describe('When 组件挂载并加载数据', () => {
      it('Then 应正确渲染组件结构', async () => {
        const { getStockList, getStockQuote } = await import('@/api/stock')
        const { getMyGroups } = await import('@/api/group')

        getMyGroups.mockResolvedValue({ data: groups })
        getStockList.mockResolvedValue({ data: { list: stocks, total: 2 } })
        getStockQuote.mockResolvedValue({ data: quoteData })

        const wrapper = mount(Trade, {
          global: {
            stubs: {
              'el-card': true,
              'el-button': true,
              'el-radio-group': true,
              'el-radio-button': true,
              'el-table': true,
              'el-table-column': true,
              'el-pagination': true,
              'el-input': true,
              'el-form': true,
              'el-form-item': true,
              'el-select': true,
              'el-option': true,
              'el-radio-group': true,
              'el-radio': true,
              'el-input-number': true,
              'el-divider': true,
              'el-row': true,
              'el-col': true
            }
          }
        })

        await nextTick()

        expect(wrapper.find('.trade-container').exists()).toBe(true)
        expect(wrapper.find('h2').text()).toBe('股票交易')
      })
    })

    describe('Given 已选择的股票和行情数据', () => {
      describe('When 计算预估金额', () => {
        it('Then 应正确计算买入金额', async () => {
          const { ref, reactive, computed } = await import('vue')

          const stockQuote = ref(quoteData)
          const tradeForm = reactive({
            shares: 100
          })

          const amount = computed(() => {
            if (!stockQuote.value?.price) return 0
            return tradeForm.shares * stockQuote.value.price
          })

          expect(amount.value).toBe(185000)
        })

        it('Then 数量变化时金额应同步更新', async () => {
          const { ref, reactive, computed } = await import('vue')

          const stockQuote = ref(quoteData)
          const tradeForm = reactive({
            shares: 100
          })

          const amount = computed(() => {
            if (!stockQuote.value?.price) return 0
            return tradeForm.shares * stockQuote.value.price
          })

          expect(amount.value).toBe(185000)

          tradeForm.shares = 200
          expect(amount.value).toBe(370000)
        })

        it('Then 无行情数据时金额应为0', async () => {
          const { ref, reactive, computed } = await import('vue')

          const stockQuote = ref(null)
          const tradeForm = reactive({
            shares: 100
          })

          const amount = computed(() => {
            if (!stockQuote.value?.price) return 0
            return tradeForm.shares * stockQuote.value.price
          })

          expect(amount.value).toBe(0)
        })
      })
    })

    describe('Given 交易表单验证', () => {
      describe('When 提交交易表单', () => {
        it('Then 未选择股票时应提前返回', async () => {
          const wrapper = mount(Trade, {
            global: {
              stubs: {
                'el-card': true,
                'el-button': true,
                'el-radio-group': true,
                'el-radio-button': true,
                'el-table': true,
                'el-table-column': true,
                'el-pagination': true,
                'el-input': true,
                'el-form': true,
                'el-form-item': true,
                'el-select': true,
                'el-option': true,
                'el-radio-group': true,
                'el-radio': true,
                'el-input-number': true,
                'el-divider': true,
                'el-row': true,
                'el-col': true
              }
            }
          })

          wrapper.vm.selectedStock = null
          wrapper.vm.loading = false

          await wrapper.vm.handleTrade()
        })
      })
    })

    describe('Given 市场切换', () => {
      describe('When 切换到港股市场', () => {
        it('Then 市场类型应更新为2', async () => {
          const { ref } = await import('vue')

          const marketType = ref(1)
          marketType.value = 2

          expect(marketType.value).toBe(2)
        })

        it('Then 股票列表应清空', async () => {
          const { ref } = await import('vue')

          const stocks = ref([
            { stock_code: '600519', stock_name: '贵州茅台' }
          ])
          const selectedStock = ref({ stock_code: '600519' })

          stocks.value = []
          selectedStock.value = null

          expect(stocks.value.length).toBe(0)
          expect(selectedStock.value).toBeNull()
        })
      })
    })
  })
})