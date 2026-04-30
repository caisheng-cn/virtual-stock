<template>
  <div class="login-container">
    <div class="login-box">
      <h1>{{ $t('nav.home') }}</h1>
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item prop="username">
          <el-input v-model="form.username" :placeholder="$t('auth.username_placeholder')" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" :placeholder="$t('auth.password_placeholder')" prefix-icon="Lock" @keyup.enter="handleLogin" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width: 100%;" :loading="loading" @click="handleLogin">{{ $t('auth.login') }}</el-button>
        </el-form-item>
      </el-form>
      <div class="login-footer">
        <router-link to="/register">{{ $t('auth.to_register') }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * File: Login.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: User login page with username/password form. Calls login API,
 *   stores authentication token in localStorage, and redirects to /home or /admin.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { login } from '@/api/user'

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
 * Description: Validates the login form, calls the login API, stores user credentials
 *   in localStorage, and navigates to the appropriate page (home or admin).
 * @returns {Promise<void>}
 */
const handleLogin = async () => {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const res = await login(form)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('userId', res.data.userId)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('isAdmin', res.data.isAdmin || false)
      ElMessage.success(t('auth.login_success'))
      router.push(res.data.isAdmin ? '/admin' : '/home')
    } catch (err) {
      ElMessage.error(err.message || t('auth.login_failed'))
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a2332 0%, #2d3748 100%);
  padding: 20px;
}

.login-box {
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
  background: white;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.login-box h1 {
  text-align: center;
  margin-bottom: 30px;
  color: var(--color-text);
  font-family: var(--font-display);
  font-weight: 600;
}

.login-footer {
  text-align: center;
  margin-top: 20px;
}

.login-footer a {
  color: var(--color-primary);
  text-decoration: none;
}

.login-footer a:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .login-box {
    padding: 28px 20px;
  }
  .login-box h1 {
    margin-bottom: 24px;
    font-size: 22px;
  }
}
</style>
