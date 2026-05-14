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

    <!-- 筛选/检索工具栏 -->
    <div class="filter-toolbar">
      <div class="filter-row">
        <el-input 
          v-model="searchQuery" 
          placeholder="搜索曲名/ID..."
          clearable 
          style="width: 180px"
        />
        <el-select v-model="filterDifficulty" multiple collapse-tags collapse-tags-tooltip placeholder="谱面难度" style="width: 160px">
          <el-option label="Past" :value="0" />
          <el-option label="Present" :value="1" />
          <el-option label="Future" :value="2" />
          <el-option label="Beyond" :value="3" />
          <el-option label="Eternal" :value="4" />
        </el-select>
        <el-select v-model="filterRating" multiple collapse-tags collapse-tags-tooltip placeholder="等级" style="width: 140px">
          <el-option v-for="r in uniqueRatings" :key="r" :label="r" :value="r" />
        </el-select>
        <el-select v-model="filterPack" multiple collapse-tags collapse-tags-tooltip placeholder="所属曲包" style="width: 180px">
          <el-option v-for="p in uniquePacks" :key="p" :label="p" :value="p" />
        </el-select>
        <el-select v-model="filterClearType" multiple collapse-tags collapse-tags-tooltip placeholder="通关状态" style="width: 160px">
          <el-option label="Track Lost" :value="0" />
          <el-option label="Normal Clear" :value="1" />
          <el-option label="Full Recall" :value="2" />
          <el-option label="Pure Memory" :value="3" />
          <el-option label="Easy Clear" :value="4" />
          <el-option label="Hard Clear" :value="5" />
        </el-select>
      </div>
      
      <div class="filter-row">
        <span class="filter-label">分数:</span>
        <el-input-number v-model="filterScoreRange[0]" :min="0" :max="10002222" :step="100000" controls-position="right" style="width: 130px"/>
        <span class="filter-separator">-</span>
        <el-input-number v-model="filterScoreRange[1]" :min="0" :max="10002222" :step="100000" controls-position="right" style="width: 130px"/>
        
        <span class="filter-label" style="margin-left: 10px;">日期:</span>
        <el-date-picker
          v-model="filterDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 240px"
        />
        
        <span class="filter-label" style="margin-left: 10px;">首选语言:</span>
        <el-select v-model="currentLangCode" style="width: 110px">
          <el-option label="简体中文" value="zh-Hans" />
          <el-option label="繁体中文" value="zh-Hant" />
          <el-option label="日本語" value="ja" />
          <el-option label="English" value="en" />
        </el-select>
        
        <el-button style="margin-left: auto;" plain @click="resetFilters">重置</el-button>
      </div>
    </div>

    <!-- 成绩数据表格展示 -->
    <el-table 
      :data="filteredData" 
      style="width: 100%" 
      height="calc(100vh - 250px)"
      :default-sort="{ prop: 'ptt', order: 'descending' }"
      :row-class-name="tableRowClassName"
    >
      <!-- ID 列 -->
      <el-table-column prop="id" label="ID" width="70" align="center" sortable />

      <!-- 排名列 (使用原始数据的索引) -->
      <el-table-column prop="rank" label="排名" width="80" align="center" sortable>
        <template #default="scope">
          <div :style="{ fontWeight: 'bold', color: scope.row.rank <= 30 ? 'var(--el-color-danger)' : 'var(--el-text-color-secondary)' }">
            # {{ scope.row.rank }}
          </div>
        </template>
      </el-table-column>
      
      <!-- 曲绘列 -->
      <el-table-column label="曲绘" width="90" align="center">
        <template #default="scope">
          <el-image 
            class="song-jacket"
            :src="getJacketUrl(scope.row)" 
            :alt="scope.row.songId"
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
      <el-table-column label="曲目 / 艺术家" min-width="200" sortable :sort-method="(a, b) => getLocalizedData(a.title_localized).text.localeCompare(getLocalizedData(b.title_localized).text)">
        <template #default="scope">
          <MarqueeText class="song-title">
            {{ getLocalizedData(scope.row.title_localized).text }}
            <span class="lang-fallback-badge">
              {{ getLocalizedData(scope.row.title_localized).lang }}
            </span>
          </MarqueeText>
          <MarqueeText class="song-id-sub">
            {{ getLocalizedData(scope.row.artist_localized).text }}
          </MarqueeText>
        </template>
      </el-table-column>
      
      <!-- 难度列 -->
      <el-table-column prop="songDifficulty" label="难度" width="120" align="center" sortable>
        <template #default="scope">
          <el-tag 
            size="small" 
            :style="{
              '--el-tag-text-color': getDifficultyWikiColor(scope.row.songDifficulty),
              '--el-tag-border-color': getDifficultyWikiColor(scope.row.songDifficulty),
              '--el-tag-bg-color': 'transparent'
            }"
          >
            {{ scope.row.difficultyName }} {{ scope.row.ratingLevelStr }}
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
      <el-table-column prop="score" label="成绩 & 评级" min-width="200" sortable>
        <template #default="scope">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: monospace; font-size: 16px; font-weight: bold;">{{ formatScore(scope.row.score) }}</span>
            <el-tag :type="getClearTypeColor(scope.row.clearType)" size="small" effect="dark">
              {{ scope.row.clearTypeLabel }}
            </el-tag>
          </div>
          <div style="font-size: 11px; margin-top: 2px; display: flex; gap: 8px;">
            <span style="color: var(--el-color-primary);">Pure: {{ scope.row.perfectCount }}</span>
            <span style="color: var(--el-color-warning); opacity: 0.85;">(-{{ scope.row.perfectCount - scope.row.shinyPerfectCount }})</span>
          </div>
          <div style="font-size: 11px; margin-top: 2px; display: flex; gap: 8px;">
            <span style="color: var(--el-color-warning);">Far: {{ scope.row.nearCount }}</span>
            <span style="color: var(--el-color-danger);">Lost: {{ scope.row.missCount }}</span>
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
import MarqueeText from './MarqueeText.vue'

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
const filterDifficulty = ref([])
const filterPack = ref([])
const filterRating = ref([])
const filterClearType = ref([])
const filterScoreRange = ref([0, 10002222])
const filterDateRange = ref(null)

// 语言切换逻辑
const currentLangCode = ref('zh-Hans')
const langOrder = ['zh-Hans', 'zh-Hant', 'ja', 'en']

/**
 * 获取多语言对象中的文本，并统一返回“极客风”的语言标签
 */
const langMap = {
  'zh-Hans': '简',
  'zh-Hant': '繁',
  'ja': 'JP',
  'en': 'EN'
}

const getLocalizedData = (locObj) => {
  if (!locObj) return { text: 'Unknown', lang: 'EN' }
  
  const targetLang = currentLangCode.value
  if (locObj[targetLang]) {
    return { text: locObj[targetLang], lang: langMap[targetLang] }
  }
  
  // 严格按照优先级回退 (由于 Arcaea 是英国游戏，en 是兜底选项，而 ja 是大部分原曲语言)
  const fallbackOrder = ['zh-Hans', 'zh-Hant', 'ja', 'en']
  for (const lang of fallbackOrder) {
    if (locObj[lang]) {
      return { text: locObj[lang], lang: langMap[lang] }
    }
  }
  
  // 极端兜底情况
  const firstAvailable = Object.keys(locObj)[0]
  if (firstAvailable) {
    return { text: locObj[firstAvailable], lang: langMap[firstAvailable] || firstAvailable.substring(0, 2).toUpperCase() }
  }
  
  return { text: 'Unknown', lang: 'EN' }
}

// 提取数据中所有出现过的曲包和难度评级，供下拉框使用
const uniquePacks = computed(() => {
  const packsMap = new Map()
  props.allData.forEach(d => {
    if (!packsMap.has(d.packName)) {
      packsMap.set(d.packName, d.packOrder)
    }
  })
  // 按照官方 packlist.json 中的先后顺序排序
  return Array.from(packsMap.keys()).sort((a, b) => packsMap.get(a) - packsMap.get(b))
})

const uniqueRatings = computed(() => {
  const ratings = new Set(props.allData.map(d => d.ratingLevelStr))
  return Array.from(ratings).sort((a, b) => {
    // 处理带 "+" 号的字符串排序，如 "9+" > "9"
    const valA = parseFloat(a) + (a.includes('+') ? 0.5 : 0)
    const valB = parseFloat(b) + (b.includes('+') ? 0.5 : 0)
    return valA - valB
  })
})

const resetFilters = () => {
  searchQuery.value = ''
  filterDifficulty.value = [0, 1, 2, 3, 4]
  filterPack.value = []
  filterRating.value = []
  filterClearType.value = []
  filterScoreRange.value = [0, 10002222]
  filterDateRange.value = null
}

/**
 * 带有排名的计算属性，并应用超级过滤器
 */
const filteredData = computed(() => {
  return props.allData.filter(row => {
    // 1. 搜索词匹配 (全语言 + search_title + search_artist)
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      let match = false
      
      // 内置ID匹配
      if (row.songId.toLowerCase().includes(q)) match = true
      
      // title匹配
      if (!match && row.title_localized) {
        match = Object.values(row.title_localized).some(t => typeof t === 'string' && t.toLowerCase().includes(q))
      }
      if (!match && row.search_title) {
        match = row.search_title.some(t => typeof t === 'string' && t.toLowerCase().includes(q))
      }
      
      // artist匹配
      if (!match && row.artist_localized) {
        match = Object.values(row.artist_localized).some(a => typeof a === 'string' && a.toLowerCase().includes(q))
      }
      if (!match && row.search_artist) {
        match = row.search_artist.some(a => typeof a === 'string' && a.toLowerCase().includes(q))
      }
      
      if (!match) return false
    }
    // 2. 谱面分类 (PST/PRS...)
    if (filterDifficulty.value.length > 0 && !filterDifficulty.value.includes(row.songDifficulty)) return false
    // 3. 曲包
    if (filterPack.value.length > 0 && !filterPack.value.includes(row.packName)) return false
    // 4. 等级 (8, 9, 9+, 10...)
    if (filterRating.value.length > 0 && !filterRating.value.includes(row.ratingLevelStr)) return false
    // 5. 通关状态
    if (filterClearType.value.length > 0 && !filterClearType.value.includes(row.clearType)) return false
    // 6. 分数范围
    if (row.score < filterScoreRange.value[0] || row.score > filterScoreRange.value[1]) return false
    // 7. 游玩时间范围
    if (filterDateRange.value && filterDateRange.value.length === 2) {
      // row.date 是 Unix 秒级时间戳，需特殊处理 2000 年之前的默认值
      if (row.date < 1000000000) return false // 没有确切日期的老记录，如果在选了时间范围的情况下默认过滤掉
      
      const startSec = Math.floor(filterDateRange.value[0].getTime() / 1000)
      // 结束时间需要加一天以包含选择的最后一天
      const endSec = Math.floor(filterDateRange.value[1].getTime() / 1000) + 86400 
      
      if (row.date < startSec || row.date > endSec) return false
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
  // row.jacketPath 由 ptts.js 根据官方 songlist 里的 jacketOverride 动态计算得出 (例如 base.avif 或 3.avif)
  // 使用 import.meta.env.BASE_URL 确保在使用了 base 路径 (如 github pages) 时依然能正确加载图片
  const baseUrl = import.meta.env.BASE_URL
  return `${baseUrl}songs/${row.songId}/${row.jacketPath}`
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
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  padding: 15px;
  background-color: var(--el-fill-color-light);
  border-radius: var(--el-border-radius-base);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
  font-weight: bold;
}

.filter-separator {
  margin: 0 4px;
  color: var(--el-text-color-secondary);
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

.lang-fallback-badge {
  display: inline-block;
  margin-left: 6px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 14px;
  height: 14px;
  color: var(--el-text-color-secondary);
  background-color: var(--el-fill-color-dark);
  border-radius: 4px;
  font-weight: normal;
  vertical-align: middle;
  transform: translateY(-1px);
  opacity: 0.8;
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
