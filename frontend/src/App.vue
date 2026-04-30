<!--
  File: App.vue
  Created: 2024-01-01
  Author: CAISHENG <caisheng.cn@gmail.com>
  Description: Root Vue component. Renders the current route via router-view and applies a global CSS reset.
  Version History:
    v1.0 - Initial version
-->

<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script setup>
</script>

<style>
:root {
  --color-bg: #f7f8fa;
  --color-card: #ffffff;
  --color-navbar: #1a2332;
  --color-primary: #3b82f6;
  --color-up: #e74c3c;
  --color-down: #27ae60;
  --color-text: #1f2937;
  --color-text-secondary: #6b7280;
  --color-border: #e5e7eb;
  --radius-card: 12px;
  --radius-btn: 8px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-card-hover: 0 8px 25px rgba(0,0,0,0.1);
  --font-display: 'Outfit', 'PingFang SC', -apple-system, sans-serif;
  --font-body: 'PingFang SC', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-num: 'Outfit', 'PingFang SC', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  min-height: 100vh;
  background-color: var(--color-bg);
  overflow-x: hidden;
}

@media (max-width: 768px) {
  .el-table {
    overflow-x: auto;
  }
  .el-button {
    min-height: 44px;
  }
  .el-input__inner {
    min-height: 44px;
  }
  .el-input-number .el-input__inner {
    min-height: 44px;
  }
  .el-select { width: 100% !important; }
  .el-date-editor--daterange { width: 100% !important; }
}
</style>