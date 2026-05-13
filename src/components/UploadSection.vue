<template>
  <div class="upload-section">
    <el-upload
      class="upload-drag"
      drag
      action="#"
      :auto-upload="false"
      :show-file-list="false"
      @change="handleFileChange"
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        拖拽 <em>st3 文件</em> 到此处，或 <em>点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          st3 是 Arcaea 的本地存档文件，通常位于 Android 设备的 /data/data/moe.low.arc/files/st3
        </div>
      </template>
    </el-upload>
    
    <!-- 加载状态提示 -->
    <div v-if="isLoading" class="loading-tips">
      <el-icon class="is-loading"><loading /></el-icon>
      正在解析存档并计算 PTT，请稍候...
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { UploadFilled, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { parseSt3 } from '../utils/ptts.js'
// 导入曲目名称映射（之前用 Python 脚本从 apk 解包出来的）
import songlistData from '../../public/songlist.json'
// 导入从 Wiki 拷贝的曲目定数表
import constantsData from '../assets/ChartConstant.json'

const emit = defineEmits(['processed'])
const isLoading = ref(false)

/**
 * 处理文件选中事件
 * @param {Object} uploadFile Element Plus 的上传文件对象
 */
const handleFileChange = async (uploadFile) => {
  const file = uploadFile.raw
  if (!file) return
  
  isLoading.value = true
  
  try {
    // 1. 将文件转换为 ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    
    // 2. 严谨的文件头校验：SQLite 3 文件的最开头 16 个字节必定是 "SQLite format 3\0"
    if (arrayBuffer.byteLength < 16) {
      throw new Error('文件体积过小，不可能是合法的存档')
    }
    const headerString = new TextDecoder().decode(new Uint8Array(arrayBuffer.slice(0, 16)))
    if (headerString !== 'SQLite format 3\0') {
      throw new Error('文件头魔法数字(Magic Number)不匹配！你上传的可能不是有效的 st3 存档文件。')
    }
    
    // 3. 调用工具函数解析 st3 并计算 PTT
    const result = await parseSt3(arrayBuffer, songlistData, constantsData)
    
    // 3. 将结果向上传递给父组件 (App.vue)
    emit('processed', result)
  } catch (err) {
    console.error('解析错误:', err)
    ElMessage.error(`解析失败: ${err.message}`)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.upload-drag {
  width: 100%;
  max-width: 500px;
}

.loading-tips {
  margin-top: 20px;
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
</style>
