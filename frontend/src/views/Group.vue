<template>
  <div class="group-container">
    <div class="header">
      <h2>{{ $t('group_page.title') }}</h2>
      <el-button @click="$router.push('/home')">{{ $t('common.back') }}</el-button>
    </div>

    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ $t('group_page.member_ranking') }}</span>
          <el-select v-model="currentGroup" :placeholder="$t('group_page.select_group')" @change="onGroupChange" style="width:200px">
            <el-option v-for="g in groups" :key="g.groupId" :label="g.groupName" :value="g.groupId" />
          </el-select>
        </div>
      </template>

      <el-table :data="ranking" stripe>
        <el-table-column prop="rank" :label="$t('group_page.rank')" width="80">
          <template #default="{ row }">
            <el-tag :type="row.rank <= 3 ? 'danger' : ''">{{ row.rank }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" :label="$t('group_page.nickname')" />
        <el-table-column prop="totalAssets" :label="$t('group_page.total_assets')" width="130">
          <template #default="{ row }">{{ formatMoney(row.totalAssets) || '-' }}</template>
        </el-table-column>
        <el-table-column prop="profit" :label="$t('group_page.profit')" width="130">
          <template #default="{ row }">
            <span :class="row.profit >= 0 ? 'profit' : 'loss'">
              {{ row.profit >= 0 ? '+' : '' }}{{ formatMoney(row.profit) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="profitRate" :label="$t('group_page.profit_rate')" width="110">
          <template #default="{ row }">
            <span :class="row.profitRate >= 0 ? 'profit' : 'loss'">
              {{ row.profitRate >= 0 ? '+' : '' }}{{ row.profitRate?.toFixed(2) || '0.00' }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>{{ $t('group_page.member_trades') }}</span>
          <div style="display:flex;gap:10px;align-items:center">
            <el-date-picker
              v-model="tradeDateRange"
              type="daterange"
              range-separator="~"
              :start-placeholder="$t('group_page.start_date')"
              :end-placeholder="$t('group_page.end_date')"
              value-format="YYYY-MM-DD"
              @change="fetchMemberDetail"
              style="width: 260px"
            />
            <el-select
              v-model="selectedMember"
              :placeholder="$t('group_page.select_member')"
              @change="fetchMemberDetail"
              style="width:200px"
              clearable
            >
              <el-option v-for="m in ranking" :key="m.userId" :label="m.nickname || '用户' + m.userId" :value="m.userId" />
            </el-select>
          </div>
        </div>
      </template>

      <div v-if="!selectedMember" style="text-align:center;padding:40px;color:#999">
        {{ $t('group_page.select_member_hint') }}
      </div>

      <div v-else-if="memberDetailLoading" style="text-align:center;padding:40px">
        <el-icon class="is-loading" style="font-size:32px"><Loading /></el-icon>
      </div>

      <div v-else-if="memberDetail">
        <el-row :gutter="20" style="margin-bottom:20px">
          <el-col :span="6">
            <div class="summary-card">
              <div class="summary-label">{{ $t('group_page.available_cash') }}</div>
              <div class="summary-value">{{ formatMoney(memberDetail.balance.cash) }} RMB</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="summary-card">
              <div class="summary-label">{{ $t('group_page.total_assets') }}</div>
              <div class="summary-value">{{ formatMoney(memberDetail.balance.totalAssets) }} RMB</div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="summary-card">
              <div class="summary-label">{{ $t('group_page.profit') }}</div>
              <div class="summary-value" :class="memberDetail.balance.profit >= 0 ? 'profit' : 'loss'">
                {{ memberDetail.balance.profit >= 0 ? '+' : '' }}{{ formatMoney(memberDetail.balance.profit) }} RMB
              </div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="summary-card">
              <div class="summary-label">{{ $t('group_page.profit_rate') }}</div>
              <div class="summary-value" :class="memberDetail.balance.profitRate >= 0 ? 'profit' : 'loss'">
                {{ memberDetail.balance.profitRate >= 0 ? '+' : '' }}{{ memberDetail.balance.profitRate?.toFixed(2) }}%
              </div>
            </div>
          </el-col>
        </el-row>

        <el-divider style="margin:12px 0" />

        <div style="margin-bottom:8px;font-weight:bold;font-size:14px">{{ $t('group_page.positions') }}</div>
        <el-table :data="memberDetail.positions" stripe size="small" v-if="memberDetail.positions.length > 0">
          <el-table-column prop="stockCode" :label="$t('group_page.stock_code')" width="100" />
          <el-table-column prop="stockName" :label="$t('group_page.stock_name')" />
          <el-table-column prop="marketType" :label="$t('group_page.market_type')" width="70">
            <template #default="{ row }">{{ getMarketTypeLabel(row.marketType) }}</template>
          </el-table-column>
          <el-table-column prop="shares" :label="$t('group_page.shares')" width="80" />
          <el-table-column prop="avgCost" :label="$t('group_page.avg_cost')" width="100">
            <template #default="{ row }">{{ formatMoney(row.avgCost) }}</template>
          </el-table-column>
          <el-table-column prop="currentPrice" :label="$t('group_page.current_price')" width="100">
            <template #default="{ row }">{{ formatMoney(row.currentPrice) }}</template>
          </el-table-column>
          <el-table-column prop="marketValue" :label="$t('group_page.market_value')" width="110">
            <template #default="{ row }">{{ formatMoney(row.marketValue) }}</template>
          </el-table-column>
          <el-table-column prop="floatingProfit" :label="$t('group_page.floating_profit')" width="110">
            <template #default="{ row }">
              <span :class="row.floatingProfit >= 0 ? 'profit' : 'loss'">
                {{ row.floatingProfit >= 0 ? '+' : '' }}{{ formatMoney(row.floatingProfit) }}
              </span>
            </template>
          </el-table-column>
        </el-table>
        <div v-else style="text-align:center;padding:20px;color:#999">
          {{ $t('group_page.no_positions') }}
        </div>

        <el-divider style="margin:12px 0" />

        <div style="margin-bottom:8px;font-weight:bold;font-size:14px">{{ $t('group_page.transaction_records') }}</div>
        <div style="font-size:12px;color:#999;margin-bottom:8px">{{ $t('group_page.last_month_hint') }}</div>
        <el-table :data="memberDetail.transactions" stripe size="small">
          <el-table-column prop="stockCode" :label="$t('group_page.stock_code')" width="95" />
          <el-table-column prop="stockName" :label="$t('group_page.stock_name')" />
          <el-table-column prop="marketType" :label="$t('group_page.market_type')" width="65">
            <template #default="{ row }">{{ getMarketTypeLabel(row.marketType) }}</template>
          </el-table-column>
          <el-table-column prop="tradeType" :label="$t('group_page.type')" width="80">
            <template #default="{ row }">{{ row.tradeType === 1 ? $t('trade_page.buy') : $t('trade_page.sell') }}</template>
          </el-table-column>
          <el-table-column prop="shares" :label="$t('group_page.shares')" width="80" />
          <el-table-column prop="price" :label="$t('group_page.price')" width="100">
            <template #default="{ row }">{{ formatMoney(row.price) || '-' }}</template>
          </el-table-column>
          <el-table-column prop="amount" :label="$t('group_page.amount')" width="110">
            <template #default="{ row }">{{ formatMoney(row.amount) || '-' }}</template>
          </el-table-column>
          <el-table-column prop="tradeDate" :label="$t('group_page.date')" width="100" />
        </el-table>
      </div>
    </el-card>

    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>{{ $t('group_page.group_messages') }}</span>
          <el-date-picker
            v-model="messageDateRange"
            type="daterange"
            range-separator="~"
            :start-placeholder="$t('group_page.start_date')"
            :end-placeholder="$t('group_page.end_date')"
            value-format="YYYY-MM-DD"
            @change="fetchMessages(1)"
            style="width: 300px"
          />
        </div>
      </template>

      <div v-if="messagesLoading" style="text-align:center;padding:40px">
        <el-icon class="is-loading" style="font-size:32px"><Loading /></el-icon>
      </div>

      <div v-else-if="messages.length === 0" style="text-align:center;padding:40px;color:#999">
        {{ $t('group_page.no_messages') }}
      </div>

      <div v-else>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-card"
          :class="{ 'own-message': msg.user_id === currentUserId }"
        >
          <div class="message-header">
            <span class="message-user">{{ msg.nickname }}</span>
            <el-tag :type="getMessageTagType(msg.message_type)" size="small">
              {{ getMessageTypeLabel(msg.message_type) }}
            </el-tag>
            <span class="message-time">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-content">{{ msg.content }}</div>

          <div v-if="msg.stock_code" class="message-stock-info">
            <span>{{ getMessageTypeLabel(msg.message_type) }} {{ msg.stock_code }} {{ msg.stock_name }}</span>
            <span v-if="msg.market_type"> | {{ getMarketTypeLabel(msg.market_type) }}</span>
            <span v-if="msg.price"> | {{ $t('group_page.unit_price') }} ¥{{ msg.price?.toFixed(2) }}</span>
            <span v-if="msg.shares"> | {{ $t('group_page.shares') }}: {{ msg.shares }}</span>
            <span v-if="msg.amount"> | = ¥{{ msg.amount?.toFixed(2) }}</span>
          </div>

          <div class="message-actions">
            <el-button
              text
              size="small"
              :type="msg.liked ? 'danger' : ''"
              @click="handleLike(msg)"
            >
              {{ msg.liked ? '❤️' : '🤍' }} {{ msg.likeCount || 0 }}
            </el-button>
            <el-button
              text
              size="small"
              @click="toggleReplies(msg)"
            >
              💬 {{ msg.replies?.length || 0 }}
            </el-button>
          </div>

          <div v-if="msg.likers && msg.likers.length > 0" class="likers">
            <span>{{ $t('group_page.liked_by') }}:</span>
            <span v-for="(liker, idx) in msg.likers" :key="liker.user_id" class="liker-name">
              {{ liker.nickname }}<template v-if="idx < msg.likers.length - 1">, </template>
            </span>
          </div>

          <div v-if="msg.showReplies" class="replies-section">
            <div v-if="msg.replies && msg.replies.length > 0">
              <div v-for="reply in msg.replies" :key="reply.id" class="reply-item">
                <span class="reply-user">{{ reply.nickname }}</span>
                <span class="reply-text">{{ reply.content }}</span>
                <span class="reply-time">{{ formatTime(reply.created_at) }}</span>
              </div>
            </div>
            <div class="reply-input-row">
              <el-input
                v-model="replyText[msg.id]"
                :placeholder="$t('group_page.reply_placeholder')"
                size="small"
                style="flex:1"
                @keyup.enter="handleReply(msg)"
              />
              <el-button size="small" type="primary" @click="handleReply(msg)">{{ $t('common.send') }}</el-button>
            </div>
          </div>
        </div>

        <div class="pagination-wrapper">
          <el-pagination
            v-if="messageTotal > 0"
            :total="messageTotal"
            :page-size="20"
            :current-page="messagePage"
            layout="prev, pager, next"
            @current-change="fetchMessages"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
/**
 * File: Group.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Group ranking page showing member rankings with total assets/profit,
 *   member detail view (balance/positions/transactions), and group messages with
 *   like and reply functionality.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { getMyGroups, getGroupRanking, getMemberDetails } from '@/api/group'
import { getGroupMessages, toggleLike, replyMessage } from '@/api/message'

const { t } = useI18n()

const currentUserId = parseInt(localStorage.getItem('userId') || 0)
const groups = ref([])
const currentGroup = ref(null)
const ranking = ref([])

const selectedMember = ref(null)
const memberDetail = ref(null)
const memberDetailLoading = ref(false)

const messages = ref([])
const messageTotal = ref(0)
const messagePage = ref(1)
const messagesLoading = ref(false)
const messageDateRange = ref(null)
const replyText = ref({})

const tradeDateRange = ref(null)

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
 * formatTime
 * Description: Formats an ISO date string to a readable date-time format.
 * @param {string} dateStr - The ISO date string to format
 * @returns {string} The formatted date-time string
 */
const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = n => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * getMessageTypeLabel
 * Description: Returns the display label for a given message type.
 * @param {number} type - The message type (1=buy, 2=sell, 3=dividend, 4=allotment)
 * @returns {string} The message type label
 */
const getMessageTypeLabel = (type) => {
  const labels = { 1: t('trade_page.buy'), 2: t('trade_page.sell'), 3: t('group_page.dividend'), 4: t('group_page.allotment') }
  return labels[type] || '-'
}

/**
 * getMessageTagType
 * Description: Returns the Element Plus tag type for a given message type.
 * @param {number} type - The message type
 * @returns {string} The tag type (success/warning/primary/info)
 */
const getMessageTagType = (type) => {
  const types = { 1: 'success', 2: 'warning', 3: 'primary', 4: 'info' }
  return types[type] || ''
}

/**
 * getMarketTypeLabel
 * Description: Returns the display label for a given market type.
 * @param {number} type - The market type (1=A, 2=HK, 3=US)
 * @returns {string} The market label string
 */
const getMarketTypeLabel = (type) => {
  const labels = { 1: 'A股', 2: '港股', 3: '美股' }
  return labels[type] || '-'
}

onMounted(async () => {
  groups.value = await getMyGroups().then(r => r.data || [])
  if (groups.value.length > 0) {
    currentGroup.value = groups.value[0].groupId
    fetchRanking()
    fetchMessages(1)
  }
})

/**
 * onGroupChange
 * Description: Resets member selection and re-fetches ranking and messages
 *   when the selected group changes.
 * @returns {void}
 */
const onGroupChange = () => {
  selectedMember.value = null
  memberDetail.value = null
  fetchRanking()
  fetchMessages(1)
}

/**
 * fetchRanking
 * Description: Fetches the member ranking list for the current group.
 * @returns {Promise<void>}
 */
const fetchRanking = async () => {
  if (!currentGroup.value) return
  try {
    const res = await getGroupRanking(currentGroup.value)
    ranking.value = res.data || []
  } catch (err) {
    ElMessage.error(err.message || t('group_page.fetch_failed'))
  }
}

/**
 * fetchMemberDetail
 * Description: Fetches detailed member information including balance, positions,
 *   and transactions for the selected member.
 * @returns {Promise<void>}
 */
const fetchMemberDetail = async () => {
  if (!selectedMember.value || !currentGroup.value) {
    memberDetail.value = null
    return
  }
  memberDetailLoading.value = true
  try {
    const params = { page: 1, pageSize: 20 }
    if (tradeDateRange.value) {
      params.start_date = tradeDateRange.value[0]
      params.end_date = tradeDateRange.value[1]
    }
    const res = await getMemberDetails(currentGroup.value, selectedMember.value, params)
    memberDetail.value = res.data
  } catch (err) {
    ElMessage.error(err.message || t('group_page.fetch_failed'))
    memberDetail.value = null
  }
  memberDetailLoading.value = false
}

/**
 * fetchMessages
 * Description: Fetches group messages with pagination and optional date range filter.
 * @param {number} page - The page number to fetch
 * @returns {Promise<void>}
 */
const fetchMessages = async (page) => {
  if (!currentGroup.value) return
  messagePage.value = page || 1
  messagesLoading.value = true
  try {
    const params = { page: messagePage.value, pageSize: 20 }
    if (messageDateRange.value) {
      params.start_date = messageDateRange.value[0]
      params.end_date = messageDateRange.value[1]
    }
    const res = await getGroupMessages(currentGroup.value, params)
    const list = (res.data?.list || []).map(m => ({ ...m, showReplies: false }))
    messages.value = list
    messageTotal.value = res.data?.total || 0
  } catch (err) {
    ElMessage.error(err.message || t('group_page.fetch_failed'))
  }
  messagesLoading.value = false
}

/**
 * handleLike
 * Description: Toggles the like status for a group message.
 * @param {Object} msg - The message object to like/unlike
 * @returns {Promise<void>}
 */
const handleLike = async (msg) => {
  try {
    await toggleLike(msg.id)
    msg.liked = !msg.liked
    msg.likeCount += msg.liked ? 1 : -1
  } catch (err) {
    ElMessage.error(err.message || t('common.error'))
  }
}

/**
 * toggleReplies
 * Description: Toggles the visibility of reply section for a group message.
 * @param {Object} msg - The message object to toggle replies for
 * @returns {void}
 */
const toggleReplies = (msg) => {
  msg.showReplies = !msg.showReplies
  if (msg.showReplies && !replyText.value[msg.id]) {
    replyText.value[msg.id] = ''
  }
}

/**
 * handleReply
 * Description: Submits a reply to a group message and appends it to the local replies list.
 * @param {Object} msg - The message object to reply to
 * @returns {Promise<void>}
 */
const handleReply = async (msg) => {
  const text = replyText.value[msg.id]
  if (!text || !text.trim()) return
  try {
    const res = await replyMessage(msg.id, { content: text.trim() })
    if (!msg.replies) msg.replies = []
    msg.replies.push({
      id: res.data?.id,
      user_id: currentUserId,
      nickname: localStorage.getItem('username') || 'User',
      content: text.trim(),
      created_at: res.data?.created_at || new Date().toISOString()
    })
    replyText.value[msg.id] = ''
    ElMessage.success(t('common.success'))
  } catch (err) {
    ElMessage.error(err.message || t('common.error'))
  }
}
</script>

<style scoped>
.group-container {
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

.profit { color: #f56c6c; }
.loss { color: #67c23a; }

.summary-card {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 14px 16px;
  text-align: center;
}

.summary-label {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.summary-value {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.message-card {
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 12px;
  border-left: 4px solid #dcdfe6;
}

.message-card.own-message {
  background: #ecf5ff;
  border-left-color: #409eff;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.message-user {
  font-weight: bold;
  font-size: 14px;
  color: #333;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.message-content {
  font-size: 14px;
  color: #555;
  line-height: 1.5;
  margin-bottom: 8px;
}

.message-stock-info {
  font-size: 12px;
  color: #666;
  background: #f0f0f0;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  display: inline-block;
}

.message-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}

.likers {
  font-size: 12px;
  color: #999;
  margin-bottom: 6px;
}

.liker-name {
  color: #409eff;
  margin-right: 2px;
}

.replies-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.reply-item {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
  font-size: 13px;
}

.reply-user {
  font-weight: bold;
  color: #333;
  white-space: nowrap;
}

.reply-text {
  color: #555;
  flex: 1;
}

.reply-time {
  font-size: 11px;
  color: #999;
  white-space: nowrap;
}

.reply-input-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
