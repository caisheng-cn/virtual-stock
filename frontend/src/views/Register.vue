<template>
  <div class="register-container">
    <div class="register-box">
      <h1>{{ $t('auth.register_title') }}</h1>
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item prop="username">
          <el-input v-model="form.username" :placeholder="$t('auth.username_placeholder_register')" prefix-icon="User" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" :placeholder="$t('auth.password_placeholder_register')" prefix-icon="Lock" />
        </el-form-item>
        <el-form-item prop="nickname">
          <el-input v-model="form.nickname" :placeholder="$t('auth.nickname_placeholder')" prefix-icon="UserFilled" />
        </el-form-item>
        <el-form-item prop="invite_code">
          <el-input v-model="form.invite_code" :placeholder="$t('auth.invite_code_placeholder')" prefix-icon="Key" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" style="width: 100%;" :loading="loading" @click="handleRegister">{{ $t('common.register') }}</el-button>
        </el-form-item>
      </el-form>
      <div class="register-footer">
        <router-link to="/login">{{ $t('auth.back_to_login') }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * File: Register.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: User registration page with username, password, nickname, and
 *   invite code fields. Calls the register API and redirects to /login on success.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { register } from '@/api/user'

const { t } = useI18n()
const router = useRouter()
const formRef = ref()
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  invite_code: ''
})

const rules = {
  username: [{ required: true, message: t('auth.username_rule'), trigger: 'blur' }],
  password: [{ required: true, message: t('auth.password_rule'), trigger: 'blur' }],
  inviteCode: [{ required: true, message: t('auth.invite_code_rule'), trigger: 'blur' }]
}

/**
 * handleRegister
 * Description: Validates the registration form, calls the register API with form data,
 *   and navigates to the login page upon successful registration.
 * @returns {Promise<void>}
 */
const handleRegister = async () => {
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      // Add language parameter to match backend expectations
      const registerData = { ...form, language: 'zh-CN' }
      await register(registerData)
      ElMessage.success(t('auth.register_success'))
      router.push('/login')
    } catch (err) {
      ElMessage.error(err.message || t('auth.register_failed'))
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.register-box h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}

.register-footer {
  text-align: center;
  margin-top: 20px;
}

.register-footer a {
  color: #667eea;
  text-decoration: none;
}

.register-footer a:hover {
  text-decoration: underline;
}
</style>
