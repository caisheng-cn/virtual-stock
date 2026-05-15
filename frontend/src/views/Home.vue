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
        <el-button size="small" @click="showPwdDialog = true">{{ $t('home.change_password') }}</el-button>
        <el-button type="danger" size="small" @click="handleLogout">{{ $t('common.logout') }}</el-button>
      </div>
    </div>

    <div class="content">
      <el-row :gutter="[16, 16]">
        <el-col :xs="12" :sm="6" :md="6">
          <div class="card">
            <div class="card-title">{{ $t('nav.available_funds') }}</div>
            <div class="card-value">¥{{ formatMoney(balance?.cash) || '0.00' }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="6">
          <div class="card">
            <div class="card-title">{{ $t('nav.total_assets') }}</div>
            <div class="card-value">¥{{ formatMoney(balance?.totalAssets) || '0.00' }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="6">
          <div class="card">
            <div class="card-title">{{ $t('nav.market_value') }}</div>
            <div class="card-value">¥{{ formatMoney(balance?.totalMarketValue) || '0.00' }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6" :md="6">
          <div class="card">
            <div class="card-title">{{ $t('nav.profit_amount') }}</div>
            <div class="card-value" :class="balance?.profit >= 0 ? 'profit' : 'loss'">
              {{ balance?.profit >= 0 ? '+' : '' }}¥{{ formatMoney(balance?.profit) || '0.00' }}
            </div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="[16, 16]" style="margin-top: 24px;">
        <el-col :xs="12" :sm="8" :md="8">
          <div class="nav-card" @click="$router.push('/trade')">
            <div class="nav-icon">📈</div>
            <div class="nav-text">{{ $t('nav.trade') }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="8">
          <div class="nav-card" @click="$router.push('/options')">
            <div class="nav-icon">💹</div>
            <div class="nav-text">{{ $t('nav.options') }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="8">
          <div class="nav-card" @click="$router.push('/positions')">
            <div class="nav-icon">📊</div>
            <div class="nav-text">{{ $t('nav.positions') }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="8">
          <div class="nav-card" @click="$router.push('/statistics')">
            <div class="nav-icon">📋</div>
            <div class="nav-text">{{ $t('nav.statistics') }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="8">
          <div class="nav-card" @click="$router.push('/transactions')">
            <div class="nav-icon">📝</div>
            <div class="nav-text">{{ $t('nav.transactions') }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="8" :md="8">
          <div class="nav-card" @click="$router.push('/fund-flow')">
            <div class="nav-icon">💰</div>
            <div class="nav-text">{{ $t('nav.fund_flow') }}</div>
          </div>
        </el-col>
      </el-row>
      <el-row :gutter="[16, 16]" style="margin-top: 16px;">
        <el-col :xs="24" :sm="24" :md="24">
          <div class="nav-card nav-card-wide" style="position:relative" @click="$router.push('/group')">
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

    <el-dialog v-model="showPwdDialog" :title="$t('home.change_password')" width="400px">
      <el-form :model="pwdForm" :rules="pwdRules" ref="pwdFormRef" label-width="0">
        <el-form-item prop="oldPassword">
          <el-input v-model="pwdForm.oldPassword" type="password" :placeholder="$t('home.old_password_placeholder')" prefix-icon="Lock" />
        </el-form-item>
        <el-form-item prop="newPassword">
          <el-input v-model="pwdForm.newPassword" type="password" :placeholder="$t('home.new_password_placeholder')" prefix-icon="Lock" />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input v-model="pwdForm.confirmPassword" type="password" :placeholder="$t('home.confirm_password_placeholder')" prefix-icon="Lock" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPwdDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleChangePassword" :loading="pwdLoading">{{ $t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * File: Home.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Dashboard page displaying balance cards (available funds, total assets,
 *   market value, profit), navigation grid to other modules (trade, positions,
 *   statistics, transactions, fund flow, group, about), and a language switcher.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { i18n } from '@/i18n'
import { getUserInfo } from '@/api/user'
import { getMyGroups, getBalance } from '@/api/group'
import { getUnreadCount } from '@/api/message'

const { t } = useI18n()
const router = useRouter()
const username = ref(localStorage.getItem('username') || '')
const currentLang = ref(i18n.global.locale.value)
const groups = ref([])
const balance = ref(null)
const unreadCount = ref(0)

const showPwdDialog = ref(false)
const pwdLoading = ref(false)
const pwdFormRef = ref()
const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateNewPass = (rule, value, callback) => {
  if (value !== pwdForm.newPassword) {
    callback(new Error(t('home.password_mismatch')))
  } else {
    callback()
  }
}

const pwdRules = {
  oldPassword: [{ required: true, message: t('home.old_password_rule'), trigger: 'blur' }],
  newPassword: [{ required: true, message: t('home.new_password_rule'), trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: t('home.confirm_password_rule'), trigger: 'blur' },
    { validator: validateNewPass, trigger: 'blur' }
  ]
}

const handleChangePassword = async () => {
  await pwdFormRef.value.validate(async (valid) => {
    if (!valid) return
    pwdLoading.value = true
    try {
      const { default: request } = await import('@/utils/request')
      const res = await request.put('/users/password', {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      })
      if (res.code === 0) {
        ElMessage.success(t('home.password_change_success'))
        showPwdDialog.value = false
        pwdForm.oldPassword = ''
        pwdForm.newPassword = ''
        pwdForm.confirmPassword = ''
      }
    } catch (err) {
      ElMessage.error(err.response?.data?.message || err.message || t('common.error'))
    } finally {
      pwdLoading.value = false
    }
  })
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

/**
 * switchLang
 * Description: Switches the application UI language.
 * @param {string} lang - The language code (e.g. 'zh-CN', 'zh-TW', 'en')
 * @returns {void}
 */
const switchLang = (lang) => {
  i18n.global.locale.value = lang
}

/**
 * onMounted lifecycle hook
 * Description: Fetches user groups, balance, and unread message count on page load.
 * @returns {Promise<void>}
 */
onMounted(async () => {
  try {
    const groupsRes = await getMyGroups()
    groups.value = groupsRes.data || []
    const groupId = groups.value.length > 0 ? groups.value[0].groupId : null
    const [balanceRes, unreadRes] = await Promise.all([
      getBalance(groupId),
      getUnreadCount()
    ])
    balance.value = balanceRes.data
    unreadCount.value = unreadRes.data || 0
  } catch (err) {
    ElMessage.error(err.message || '获取数据失败')
  }
})

/**
 * handleLogout
 * Description: Clears all localStorage data and redirects to the login page.
 * @returns {void}
 */
const handleLogout = () => {
  localStorage.clear()
  router.push('/login')
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background-color: var(--color-bg);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  background: var(--color-card);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.content {
  padding: 20px 40px;
  max-width: 1200px;
  margin: 0 auto;
}

.card {
  background: var(--color-card);
  padding: 20px 24px;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
}

.card-title {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.card-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  font-family: var(--font-num);
}

.card-value.profit {
  color: var(--color-up);
}

.card-value.loss {
  color: var(--color-down);
}

.nav-card {
  background: var(--color-card);
  padding: 24px 16px;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  text-align: center;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.nav-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-card-hover);
}

.nav-icon {
  font-size: 36px;
  margin-bottom: 8px;
  display: block;
}

.nav-text {
  font-size: 15px;
  color: var(--color-text);
  font-weight: 500;
}

.footer {
  text-align: center;
  margin-top: 30px;
  padding: 20px;
}

.footer a {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 14px;
}

.footer a:hover {
  color: var(--color-primary);
}

.nav-card-wide {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 16px;
}

.nav-card-wide .nav-icon {
  margin-bottom: 0;
  font-size: 28px;
}

.nav-card-wide .nav-text {
  font-size: 17px;
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

@media (max-width: 768px) {
  .header {
    padding: 14px 16px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .user-info {
    width: 100%;
    justify-content: flex-end;
    gap: 10px;
  }
  .user-info span {
    font-size: 13px;
  }
  .content {
    padding: 16px;
  }
  .card-value {
    font-size: 20px;
  }
  .nav-card {
    padding: 20px 12px;
  }
  .nav-icon {
    font-size: 28px;
  }
}
</style>
