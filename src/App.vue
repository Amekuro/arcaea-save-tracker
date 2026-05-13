<template>
  <div class="app-container">
    <el-container>
      <el-header height="80px" class="main-header">
        <div class="header-inner">
          <h1>Arcaea Save Tracker</h1>
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
      
      <el-main class="main-content">
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
import { ref } from 'vue'
import UploadSection from './components/UploadSection.vue'
import ResultTable from './components/ResultTable.vue'
import { ElMessage } from 'element-plus'

// 状态管理
const isProcessed = ref(false)
const allRecords = ref([])
const b30Avg = ref(0)
const maxPtt = ref(0)

// 主题状态，从 localStorage 读取初始值
const currentTheme = ref(localStorage.getItem('theme-setting') || 'auto')

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

<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
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

.header-inner h1 {
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
}
</style>
