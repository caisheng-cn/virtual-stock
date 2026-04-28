<template>
  <div class="about-container">
    <div class="about-card">
      <h1>{{ $t('about_page.title') }}</h1>
      <div class="version-info">
        <div class="version-label">{{ $t('about_page.version') }}</div>
        <div class="version-value">{{ version || '1.0.0' }}</div>
      </div>
      <div class="copyright-info">
        <div class="copyright-label">{{ $t('about_page.copyright') }}</div>
        <div class="copyright-value">{{ copyright }}</div>
      </div>
      <div class="changelog">
        <h3>{{ $t('about_page.changelog') }}</h3>
        <el-timeline>
          <el-timeline-item
            v-for="item in changelog"
            :key="item.ver"
            :timestamp="item.date"
            placement="top"
          >
            <el-card>
              <h4>v{{ item.ver }}</h4>
              <p>{{ item.desc }}</p>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </div>
      <el-button class="back-btn" @click="$router.back()">{{ $t('common.back') }}</el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getVersion } from '@/api/about'

const { t } = useI18n()

const version = ref('')
const copyright = ref('')
const changelog = ref([])

const fetchAbout = async () => {
  try {
    const res = await getVersion()
    if (res.code === 0) {
      version.value = res.data.version
      copyright.value = res.data.copyright
      changelog.value = res.data.changelog || []
    }
  } catch (err) {
    ElMessage.error(t('about_page.fetch_failed'))
  }
}

onMounted(() => {
  fetchAbout()
})
</script>

<style scoped>
.about-container {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 40px 20px;
}

.about-card {
  background: white;
  border-radius: 8px;
  padding: 30px;
  max-width: 600px;
  width: 100%;
}

.about-card h1 {
  text-align: center;
  margin-bottom: 30px;
}

.version-info,
.copyright-info {
  display: flex;
  justify-content: space-between;
  padding: 15px 0;
  border-bottom: 1px solid #eee;
}

.version-label,
.copyright-label {
  color: #666;
}

.version-value,
.copyright-value {
  font-weight: bold;
  color: #333;
}

.changelog {
  margin-top: 30px;
}

.changelog h3 {
  margin-bottom: 15px;
}

.back-btn {
  margin-top: 30px;
  width: 100%;
}
</style>
