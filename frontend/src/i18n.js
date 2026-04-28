/**
 * File: i18n.js
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Creates and exports a vue-i18n instance with support for zh-CN, zh-TW, and en locales.
 * Version History:
 *   v1.0 - Initial version
 */

import { createI18n } from 'vue-i18n'
import zhCN from './locales/zh-CN.json'
import zhTW from './locales/zh-TW.json'
import en from './locales/en.json'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'en',
  messages: {
    'zh-CN': zhCN,
    'zh-TW': zhTW,
    en
  }
})