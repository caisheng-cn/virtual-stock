/**
 * File: main.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Vue application entry point. Initializes and mounts the app with Pinia,
 *              Element Plus, vue-i18n, and Vue Router. Manages locale persistence.
 * Version History:
 *   v1.0 - Initial version
 */

import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { i18n } from './i18n'
import App from './App.vue'
import router from './router'

const pinia = createPinia()
const app = createApp(App)

/**
 * setElementLocale
 * Description: Dynamically loads and sets the Element Plus locale module based on the given locale string.
 * @param {string} locale - The locale key ('zh-CN', 'zh-TW', or 'en')
 * @returns {void}
 */
const setElementLocale = (locale) => {
  const localeMap = {
    'zh-CN': () => import('element-plus/dist/locale/zh-cn.mjs'),
    'zh-TW': () => import('element-plus/dist/locale/zh-tw.mjs'),
    'en': () => import('element-plus/dist/locale/en.mjs')
  }
  const load = localeMap[locale] || localeMap['en']
  load().then(({ default: lang }) => { ElementPlus.locale = lang })
}

// Set initial locale from localStorage
const savedLocale = localStorage.getItem('language') || 'zh-CN'
i18n.global.locale.value = savedLocale
setElementLocale(savedLocale)

// Watch for locale changes
watch(() => i18n.global.locale.value, (newLocale) => {
  localStorage.setItem('language', newLocale)
  setElementLocale(newLocale)
})

app.use(pinia)
app.use(router)
app.use(i18n)
app.use(ElementPlus)

app.mount('#app')