<template>
  <div class="app-container">
    <el-container>
      <el-header height="80px" class="main-header">
        <div class="header-inner">
          <div class="header-left">
            <a href="https://github.com/Amekuro/arcaea-save-tracker" target="_blank" rel="noopener noreferrer" class="header-link">
              <el-icon :size="14"><LogoGithub /></el-icon>
              <span>Amekuro/arcaea-save-tracker</span>
            </a>
            <div class="header-status" v-if="versionInfo">
              <el-tag size="small" effect="plain" type="info">游戏 v{{ versionInfo.apk_version }}</el-tag>
              <el-tag size="small" effect="plain" :type="versionInfo.constants_synced ? 'success' : 'warning'">定数{{ versionInfo.constants_synced ? '已同步' : '同步中' }}</el-tag>
              <span style="color: var(--el-text-color-placeholder); font-size: 11px;">{{ formatDate(versionInfo.apk_updated_at) }}</span>
            </div>
          </div>
          <h2>Arcaea Save Tracker</h2>
          <div class="theme-switch">
            <el-radio-group v-model="currentTheme" size="small" @change="handleThemeChange">
              <el-radio-button value="light">浅色</el-radio-button>
              <el-radio-button value="dark">深色</el-radio-button>
              <el-radio-button value="auto">跟随系统</el-radio-button>
            </el-radio-group>
          </div>
        </div>
        <p>基于 Vue 3 + Element Plus 的本地 st3 解析工具</p>
      </el-header>
      
      <el-main class="main-content" :class="{ 'is-empty': !isProcessed }">
        <!-- 尚未解析时，显示上传区域 -->
        <UploadSection 
          v-if="!isProcessed"
          @processed="handleProcessed" 
        />
        
        <!-- 解析完成后，显示结果表格 -->
        <ResultTable 
          v-else
          :all-data="allRecords"
          :max-ptt="maxPtt"
          :b30-avg="b30Avg"
          @reset="reset"
        />
      </el-main>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import UploadSection from './components/UploadSection.vue'
import ResultTable from './components/ResultTable.vue'
import { ElMessage } from 'element-plus'
import { LogoGithub } from '@vicons/ionicons5'

// 状态管理
const isProcessed = ref(false)
const allRecords = ref([])
const b30Avg = ref(0)
const maxPtt = ref(0)
const versionInfo = ref(null)

// 主题状态，从 localStorage 读取初始值
const currentTheme = ref(localStorage.getItem('theme-setting') || 'auto')

onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/version.json`)
    if (res.ok) {
      versionInfo.value = await res.json()
    }
  } catch (e) {
    // version.json 不存在或网络错误时静默忽略
  }
})

const formatDate = (isoStr) => {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 切换主题
 */
const handleThemeChange = (val) => {
  // 调用在 main.js 中挂载的全局方法
  if (window.setAppTheme) {
    window.setAppTheme(val)
  }
}

/**
 * 接收来自 UploadSection 的解析成功事件
 * @param {Object} result 解析结果，包含 b30 列表和平均值
 */
const handleProcessed = (result) => {
  allRecords.value = result.allRecords
  b30Avg.value = result.b30Avg
  maxPtt.value = result.maxPtt
  isProcessed.value = true
  ElMessage.success('存档解析成功！')
}

/**
 * 重置状态，重新上传
 */
const reset = () => {
  isProcessed.value = false
  allRecords.value = []
  b30Avg.value = 0
  maxPtt.value = 0
}
</script>

<style>
/* 全局样式重置，确保 100vh 布局生效 */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}
</style>

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 20px 12px;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.app-container :deep(.el-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.app-container :deep(.el-main) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.main-header {
  padding-top: 20px;
}

.header-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.header-left {
  position: absolute;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.header-link:hover {
  color: var(--el-color-primary);
}

.header-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-inner h2 {
  margin: 0;
  color: var(--el-color-primary);
  font-size: 32px;
}

.theme-switch {
  position: absolute;
  right: 0;
}

.main-header p {
  text-align: center;
  color: var(--el-text-color-secondary);
  margin-top: 10px;
}

.main-content {
  margin-top: 30px;
  background-color: var(--el-bg-color-overlay);
  border-radius: var(--el-border-radius-base);
  box-shadow: var(--el-box-shadow-light);
  padding: 30px;
  display: flex;
  flex-direction: column;
}

.main-content.is-empty {
  justify-content: center;
  align-items: center;
}
</style>

