<template>
  <div class="admin-login-container">
    <div class="login-box">
      <h1>{{ $t('auth.admin_login') }}</h1>
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item prop="username">
          <el-input v-model="form.username" :placeholder="$t('auth.admin_username_placeholder')" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" :placeholder="$t('auth.password_placeholder')" prefix-icon="Lock" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width: 100%;" :loading="loading" @click="handleLogin">{{ $t('auth.login') }}</el-button>
        </el-form-item>
      </el-form>
      <div class="login-footer">
        <router-link to="/login">{{ $t('auth.to_user_login') }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * File: admin-login.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Admin login page with username/password form. Uses adminLogin API,
 *   stores adminToken in localStorage, and redirects to /admin.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { adminLogin } from '@/api/admin'

const { t } = useI18n()
const router = useRouter()
const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: t('auth.username_rule'), trigger: 'blur' }],
  password: [{ required: true, message: t('auth.password_rule'), trigger: 'blur' }]
}

/**
 * handleLogin
 * Description: Validates the admin login form, calls the adminLogin API, stores
 *   admin token and ID in localStorage, and navigates to the admin dashboard.
 * @returns {Promise<void>}
 */
const handleLogin = async () => {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const res = await adminLogin(form)
      localStorage.setItem('adminToken', res.data.token)
      localStorage.setItem('adminId', res.data.adminId)
      ElMessage.success(t('auth.login_success'))
      router.push('/admin')
    } catch (err) {
      ElMessage.error(err.message || t('auth.login_failed'))
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.admin-login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.login-box h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #1a1a2e;
  font-size: 24px;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
}

.login-footer a {
  color: #1a1a2e;
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>
