<template>
  <div class="result-section">
    <div class="header-actions">
      <h2 class="section-title">
        存档解析结果 (全量)
        <el-tag size="large" type="success" effect="dark" class="ptt-badge">
          Max PTT: {{ maxPtt.toFixed(4) }}
        </el-tag>
        <el-tag size="large" type="primary" effect="dark" class="ptt-badge">
          B30 Avg: {{ b30Avg.toFixed(4) }}
        </el-tag>
      </h2>
      <el-button type="primary" plain @click="$emit('reset')">重新上传</el-button>
    </div>

    <!-- 筛选/检索工具栏预留区域 -->
    <div class="filter-toolbar">
      <el-input 
        v-model="searchQuery" 
        placeholder="搜索曲目名或内部曲目ID..."
        clearable 
        style="width: 250px"
      />
      <el-select 
        v-model="filterDifficulty" 
        multiple 
        collapse-tags 
        collapse-tags-tooltip 
        placeholder="选择难度" 
        style="width: 200px"
      >
        <el-option label="Past" :value="0" />
        <el-option label="Present" :value="1" />
        <el-option label="Future" :value="2" />
        <el-option label="Beyond" :value="3" />
        <el-option label="Eternal" :value="4" />
      </el-select>
      <el-button disabled>更多筛选 (待开发)</el-button>
    </div>

    <!-- 成绩数据表格展示 -->
    <el-table 
      :data="filteredData" 
      style="width: 100%" 
      :default-sort="{ prop: 'ptt', order: 'descending' }"
      :row-class-name="tableRowClassName"
    >
      <!-- ID 列 -->
      <el-table-column prop="id" label="ID" width="70" align="center" sortable />

      <!-- 排名列 (使用原始数据的索引) -->
      <el-table-column prop="rank" label="排名" width="80" align="center" sortable>
        <template #default="scope">
          <div :style="{ fontWeight: 'bold', color: scope.row.rank <= 30 ? 'var(--el-color-danger)' : 'var(--el-text-color-secondary)' }">
            #{{ scope.row.rank }}
          </div>
        </template>
      </el-table-column>
      
      <!-- 曲绘列 -->
        <el-table-column label="曲绘" width="90" align="center">
        <template #default="scope">
          <el-image 
            class="song-jacket"
            :src="getJacketUrl(scope.row)" 
            fit="cover"
            loading="lazy"
          >
            <!-- 曲绘加载失败时的占位符 -->
            <template #error>
              <div class="image-slot">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-image>
        </template>
      </el-table-column>
      
      <!-- 曲目名称列 -->
      <el-table-column prop="title" label="曲目" min-width="200" sortable>
        <template #default="scope">
          <div class="song-title">{{ scope.row.title }}</div>
          <div class="song-id-sub">{{ scope.row.songId }}</div>
        </template>
      </el-table-column>
      
      <!-- 难度列 -->
      <el-table-column prop="songDifficulty" label="难度" width="110" align="center" sortable>
        <template #default="scope">
          <el-tag 
            size="small" 
            :style="{
              '--el-tag-text-color': getDifficultyWikiColor(scope.row.songDifficulty),
              '--el-tag-border-color': getDifficultyWikiColor(scope.row.songDifficulty),
              '--el-tag-bg-color': 'transparent'
            }"
          >
            {{ scope.row.difficultyName }}
          </el-tag>
        </template>
      </el-table-column>
      
      <!-- 定数列表 -->
      <el-table-column prop="constant" label="定数" width="100" align="center" sortable>
        <template #default="scope">
          {{ scope.row.constant.toFixed(1) }}
        </template>
      </el-table-column>
      
      <!-- 分数与评级列 -->
      <el-table-column prop="score" label="成绩 & 评级" min-width="180" sortable>
        <template #default="scope">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: monospace; font-size: 16px; font-weight: bold;">{{ formatScore(scope.row.score) }}</span>
            <el-tag :type="getClearTypeColor(scope.row.clearType)" size="small" effect="dark">
              {{ scope.row.clearTypeLabel }}
            </el-tag>
          </div>
          <!-- 判定明细：Pure (+Shiny) / Far / Lost -->
          <div style="font-size: 11px; color: var(--el-text-color-secondary); margin-top: 4px;">
            <span style="color: var(--el-color-primary);">Pure: {{ scope.row.perfectCount }} <span style="color: var(--el-color-warning);">(+{{ scope.row.shinyPerfectCount }})</span></span>
            <span style="color: var(--el-color-warning); margin-left: 8px;">Far: {{ scope.row.nearCount }}</span>
            <span style="color: var(--el-color-danger); margin-left: 8px;">Lost: {{ scope.row.missCount }}</span>
          </div>
        </template>
      </el-table-column>
      
      <!-- 游玩日期列 -->
      <el-table-column prop="date" label="游玩时间" width="150" align="center" sortable>
        <template #default="scope">
          <span style="font-size: 12px; color: var(--el-text-color-secondary);">{{ scope.row.playDate }}</span>
        </template>
      </el-table-column>
      
      <!-- 单曲 PTT 列 -->
      <el-table-column prop="ptt" label="单曲 PTT" width="140" align="center" sortable>
        <template #default="scope">
          <span style="font-weight: bold; color: var(--el-color-primary); font-size: 15px;">{{ formatPtt(scope.row.ptt) }}</span>
        </template>
      </el-table-column>
      
    </el-table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Picture } from '@element-plus/icons-vue'

const props = defineProps({
  allData: {
    type: Array,
    required: true
  },
  b30Avg: {
    type: Number,
    required: true
  },
  maxPtt: {
    type: Number,
    required: true
  }
})

defineEmits(['reset'])

// 搜索和过滤
const searchQuery = ref('')
// 默认全选所有难度 (0=Past, 1=Present, 2=Future, 3=Beyond, 4=Eternal)
const filterDifficulty = ref([0, 1, 2, 3, 4])

/**
 * 带有排名的计算属性，并应用过滤器
 */
const filteredData = computed(() => {
  return props.allData.filter(row => {
    // 按曲名或 ID 搜索
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      if (!row.title.toLowerCase().includes(q) && !row.songId.toLowerCase().includes(q)) {
        return false
      }
    }
    // 按难度过滤（多选：如果没勾选该难度，则过滤掉）
    if (filterDifficulty.value && Array.isArray(filterDifficulty.value)) {
      if (!filterDifficulty.value.includes(row.songDifficulty)) {
        return false
      }
    }
    return true
  })
})

/**
 * PTT 格式化：前5位四舍五入，第6位为原始值并放在括号内
 * 例: 11.459528 -> 11.45953(8)
 */
const formatPtt = (ptt) => {
  const rounded5 = ptt.toFixed(5)
  // 获取最原始计算出的第 6 位小数的值
  const digit6 = Math.floor(ptt * 1000000) % 10
  return `${rounded5}(${digit6})`
}

/**
 * 格式化分数为带逗号的字符串，例如 9,999,999
 * @param {Number} score 
 */
const formatScore = (score) => {
  return score.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * 为每行绑定难度特定的背景色 class
 */
const tableRowClassName = ({ row }) => {
  return `diff-row-${row.songDifficulty}`
}

/**
 * 根据难度 ID 返回 Wiki 字体颜色
 * Past(0)=#4bb7f0, Present(1)=#a0c679, Future(2)=#e1a1dc, Beyond(3)=#ff1a1a, Eternal(4)=#aba398
 */
const getDifficultyWikiColor = (difficultyId) => {
  const mapping = ['#4bb7f0', '#a0c679', '#e1a1dc', '#ff1a1a', '#aba398']
  return mapping[difficultyId] || '#909399'
}

/**
 * 根据 clearType ID 返回通关状态的标签颜色
 */
const getClearTypeColor = (clearType) => {
  // 0: Track Lost, 1: Normal Clear, 2: Full Recall, 3: Pure Memory, 4: Easy Clear, 5: Hard Clear
  const mapping = ['info', 'primary', 'warning', 'success', 'success', 'danger']
  return mapping[clearType] || 'info'
}

/**
 * 构建获取本地 public 目录下提取好的曲绘路径
 * @param {Object} row 
 */
const getJacketUrl = (row) => {
  // 提取出来的曲绘都在 /songs/{songId}/ 目录下
  // 按照优先级: {difficulty}.jpg -> base.jpg
  // 简易起见，暂用 base.jpg 作为默认展示
  return `/songs/${row.songId}/base.jpg`
}
</script>

<style scoped>
/* 仅仅保留布局和结构所必须的 CSS，文字颜色尽量使用 Element 提供的 CSS 变量 */
.result-section {
  width: 100%;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.filter-toolbar {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
}

.section-title {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 15px;
  color: var(--el-text-color-primary);
}

.song-jacket {
  width: 60px;
  height: 60px;
  border-radius: var(--el-border-radius-base);
  border: 1px solid var(--el-border-color-lighter);
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-placeholder);
  font-size: 20px;
}

.song-title {
  font-weight: bold;
  font-size: 15px;
  color: var(--el-text-color-primary);
}

.song-id-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}

/* 根据难度定制带有极低透明度的表格行底色（完美兼容日间/夜间模式和 WCAG 标准） */
:deep(.el-table .diff-row-0) { --el-table-tr-bg-color: rgba(75, 183, 240, 0.08); }
:deep(.el-table .diff-row-0:hover) { --el-table-row-hover-bg-color: rgba(75, 183, 240, 0.15); }

:deep(.el-table .diff-row-1) { --el-table-tr-bg-color: rgba(160, 198, 121, 0.08); }
:deep(.el-table .diff-row-1:hover) { --el-table-row-hover-bg-color: rgba(160, 198, 121, 0.15); }

:deep(.el-table .diff-row-2) { --el-table-tr-bg-color: rgba(225, 161, 220, 0.08); }
:deep(.el-table .diff-row-2:hover) { --el-table-row-hover-bg-color: rgba(225, 161, 220, 0.15); }

:deep(.el-table .diff-row-3) { --el-table-tr-bg-color: rgba(255, 26, 26, 0.08); }
:deep(.el-table .diff-row-3:hover) { --el-table-row-hover-bg-color: rgba(255, 26, 26, 0.15); }

:deep(.el-table .diff-row-4) { --el-table-tr-bg-color: rgba(171, 163, 152, 0.08); }
:deep(.el-table .diff-row-4:hover) { --el-table-row-hover-bg-color: rgba(171, 163, 152, 0.15); }
</style>
