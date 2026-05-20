import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WIKI_URL = 'https://wiki.arcaea.cn/index.php?title=Template:ChartConstant.json&action=raw'
const DEST_PATH = path.join(__dirname, '../public/data/ChartConstant.json')
const VERSION_PATH = path.join(__dirname, '../public/data/version.json')
const SONGLIST_PATH = path.join(__dirname, '../public/data/songlist.json')

// 如果 APK 未更新，跳过定数表拉取与 version.json 写入
if (fs.existsSync(path.join(__dirname, '../.skip_update'))) {
  console.log('⏩ 检测到 .skip_update 标记，APK 未更新，跳过定数表同步步骤。')
  process.exit(0)
}

console.log('🌐 开始检查定数表同步状态...')

try {
  let versionData = {}
  if (fs.existsSync(VERSION_PATH)) {
    versionData = JSON.parse(fs.readFileSync(VERSION_PATH, 'utf-8'))
  }

  let validSongs = []
  if (fs.existsSync(SONGLIST_PATH)) {
    const songlistData = JSON.parse(fs.readFileSync(SONGLIST_PATH, 'utf-8'))
    validSongs = songlistData.songs.filter(s => s.id !== 'tutorial' && !s.deleted)
  }

  // 如果已经完美同步，并且曲目数量没有发生变动，直接退出以节省请求
  if (versionData.constants_synced && versionData.synced_song_count === validSongs.length && !process.env.FORCE_FETCH) {
    console.log(`✅ 定数表早已与当前游戏版本 (${validSongs.length} 首曲目) 完美同步，无需拉取！`)
    process.exit(0)
  }

  console.log('🔄 检测到新曲目或尚未同步完成，开始从 Arcaea Wiki 获取最新曲目定数表...')
  
  // 确保存储目录存在
  const destDir = path.dirname(DEST_PATH)
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  // 使用原生 curl 下载
  execSync(`curl -s -L -o "${DEST_PATH}" "${WIKI_URL}"`, { stdio: 'inherit' })

  const rawData = fs.readFileSync(DEST_PATH, 'utf-8')
  const parsedData = JSON.parse(rawData)
  
  // ==========================================
  // 注入已下架曲目 (Legacy/Deleted Songs)
  // 因为维基的定数总表往往会剔除已下架曲目，但老玩家的本地存档依然有这些成绩。
  // 为了确保能为老玩家正确计算 PTT，我们在这里硬编码补充它们。
  // ==========================================
  const legacyConstants = {
    "particlearts": [
      { "constant": 3.5 }, // Past
      { "constant": 6.0 }, // Present
      { "constant": 8.8 }  // Future
    ]
    // 未来如果还有别的版权曲下架，可以直接在这里补充
  }

  let legacyAdded = 0
  for (const [id, difficulties] of Object.entries(legacyConstants)) {
    if (!parsedData[id]) {
      parsedData[id] = difficulties
      legacyAdded++
    }
  }
  
  // 将补充好的完整数据写回文件
  if (legacyAdded > 0) {
    fs.writeFileSync(DEST_PATH, JSON.stringify(parsedData, null, 2), 'utf-8')
  }

  const songCount = Object.keys(parsedData).length
  console.log(`✅ 定数表更新成功！共包含 ${songCount} 首曲目的数据 (其中硬编码补充了 ${legacyAdded} 首下架曲目)。`)
  
  // --- 对比验证逻辑：判断定数表是否与当前的 songlist.json 完全同步 ---
  let isSynced = true
  let missingSongs = []
  
  if (fs.existsSync(SONGLIST_PATH)) {
    const songlistData = JSON.parse(fs.readFileSync(SONGLIST_PATH, 'utf-8'))
    // 过滤掉教程曲（tutorial）以及其他无需定数的特殊曲目，对于标记为 deleted 的曲目也跳过严格校验
    const validSongs = songlistData.songs.filter(s => s.id !== 'tutorial' && !s.deleted)
    
    for (const song of validSongs) {
      if (!parsedData[song.id]) {
        isSynced = false
        missingSongs.push(song.id)
      }
    }
    
    if (isSynced) {
      console.log(`🎉 完美！当前定数表已与游戏数据 (songlist.json) 完全同步。`)
    } else {
      console.warn(`⚠️ 警告：当前定数表缺失 ${missingSongs.length} 首曲目的数据，维基可能仍在更新中。`)
      console.warn(`🔍 缺失定数的曲目 ID 列表: ${missingSongs.join(', ')}`)
    }
  }

  // 更新 version.json
  versionData.constants_last_update = new Date().toISOString()
  versionData.constants_synced = isSynced
  versionData.synced_song_count = validSongs.length
  
  fs.writeFileSync(VERSION_PATH, JSON.stringify(versionData, null, 2), 'utf-8')
  console.log(`📝 已将定数表同步状态更新至 version.json`)
} catch (e) {
  console.error('❌ 获取或解析定数表失败！可能是网络被阻断或返回的数据不是合法的 JSON。')
  console.error(e.message)
  process.exit(1)
}
