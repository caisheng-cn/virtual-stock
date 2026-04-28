<template>
  <div class="home-container">
    <div class="header">
      <h2>{{ $t('nav.home') }}</h2>
      <div class="user-info">
        <el-select v-model="currentLang" size="small" style="width: 120px" @change="switchLang">
          <el-option label="简体中文" value="zh-CN" />
          <el-option label="繁體中文" value="zh-TW" />
          <el-option label="English" value="en" />
        </el-select>
        <span>{{ $t('auth.welcome') }}，{{ username }}</span>
        <el-button type="danger" size="small" @click="handleLogout">{{ $t('common.logout') }}</el-button>
      </div>
    </div>

    <div class="content">
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="card">
            <div class="card-title">{{ $t('nav.available_funds') }}</div>
            <div class="card-value">{{ formatMoney(balance?.cash) || '0.00' }} RMB</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="card">
            <div class="card-title">{{ $t('nav.total_assets') }}</div>
            <div class="card-value">{{ formatMoney(balance?.totalAssets) || '0.00' }} RMB</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="card">
            <div class="card-title">{{ $t('nav.market_value') }}</div>
            <div class="card-value">{{ formatMoney(balance?.totalMarketValue) || '0.00' }} RMB</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="8">
          <div class="card">
            <div class="card-title">{{ $t('nav.profit_amount') }}</div>
            <div class="card-value" :class="balance?.profit >= 0 ? 'profit' : 'loss'">
              {{ balance?.profit >= 0 ? '+' : '' }}{{ formatMoney(balance?.profit) || '0.00' }} RMB
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 30px;">
        <el-col :span="8">
          <div class="nav-card" @click="$router.push('/trade')">
            <div class="nav-icon">📈</div>
            <div class="nav-text">{{ $t('nav.trade') }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="nav-card" @click="$router.push('/positions')">
            <div class="nav-icon">📊</div>
            <div class="nav-text">{{ $t('nav.positions') }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="nav-card" @click="$router.push('/statistics')">
            <div class="nav-icon">📋</div>
            <div class="nav-text">{{ $t('nav.statistics') }}</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="8">
          <div class="nav-card" @click="$router.push('/transactions')">
            <div class="nav-icon">📝</div>
            <div class="nav-text">{{ $t('nav.transactions') }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="nav-card" @click="$router.push('/fund-flow')">
            <div class="nav-icon">💰</div>
            <div class="nav-text">{{ $t('nav.fund_flow') }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="nav-card" style="position:relative" @click="$router.push('/group')">
            <div class="nav-icon">👥</div>
            <div class="nav-text">{{ $t('nav.group_ranking') }}</div>
            <el-badge v-if="unreadCount > 0" :value="unreadCount" class="unread-badge" :hidden="false" />
          </div>
        </el-col>
      </el-row>

      <div class="footer">
        <a href="javascript:void(0)" @click="$router.push('/about')">{{ $t('nav.about') }}</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { i18n } from '@/i18n'
import { getUserInfo } from '@/api/user'
import { getMyGroups, getBalance } from '@/api/group'
import { getUnreadCount } from '@/api/message'

const router = useRouter()
const username = ref(localStorage.getItem('username') || '')
const currentLang = ref(i18n.global.locale.value)
const groups = ref([])
const balance = ref(null)
const unreadCount = ref(0)

const formatMoney = (value) => {
  if (!value && value !== 0) return '0.00'
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const switchLang = (lang) => {
  i18n.global.locale.value = lang
}

onMounted(async () => {
  try {
    const [groupsRes, balanceRes, unreadRes] = await Promise.all([
      getMyGroups(),
      getBalance(),
      getUnreadCount()
    ])
    groups.value = groupsRes.data || []
    balance.value = balanceRes.data
    unreadCount.value = unreadRes.data || 0
  } catch (err) {
    ElMessage.error(err.message || '获取数据失败')
  }
})

const handleLogout = () => {
  localStorage.clear()
  router.push('/login')
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.content {
  padding: 20px 40px;
}

.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-title {
  font-size: 14px;
  color: #999;
  margin-bottom: 10px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.card-value.profit {
  color: #f56c6c;
}

.card-value.loss {
  color: #67c23a;
}

.nav-card {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s;
}

.nav-card:hover {
  transform: translateY(-5px);
}

.nav-icon {
  font-size: 40px;
  margin-bottom: 10px;
}

.nav-text {
  font-size: 16px;
  color: #333;
}

.footer {
  text-align: center;
  margin-top: 30px;
  padding: 20px;
}

.footer a {
  color: #999;
  text-decoration: none;
}

.footer a:hover {
  color: #667eea;
  text-decoration: underline;
}

.unread-badge {
  position: absolute;
  top: 8px;
  right: 8px;
}

.unread-badge :deep(.el-badge__content) {
  font-size: 11px;
  padding: 0 5px;
  height: 18px;
  line-height: 18px;
  border: 2px solid white;
}
</style>
