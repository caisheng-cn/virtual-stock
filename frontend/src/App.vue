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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#app {
  width: 100%;
  min-height: 100vh;
  background-color: #f5f5f5;
}
</style>