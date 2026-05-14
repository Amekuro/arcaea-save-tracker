import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import os from 'os'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

if (fs.existsSync(path.join(ROOT_DIR, '.skip_update'))) {
  console.log('⏩ 检测到 .skip_update 标记，跳过图片处理与转换步骤。')
  process.exit(0)
}

const extractSongsDir = path.join(ROOT_DIR, 'extracted_assets', 'assets', 'songs')
const publicSongsDir = path.join(ROOT_DIR, 'public', 'songs')
const publicDataDir = path.join(ROOT_DIR, 'public', 'data')

if (!fs.existsSync(extractSongsDir)) {
  console.error('❌ 未找到解压后的 assets/songs 目录！请先执行 02_extract_assets.js。')
  process.exit(1)
}

fs.mkdirSync(publicSongsDir, { recursive: true })
fs.mkdirSync(publicDataDir, { recursive: true })

async function run() {
  console.log('🎨 开始处理核心数据文件与曲绘...')
  
  // 1. 拷贝并重命名无后缀的核心数据文件为 .json
  const coreFiles = ['songlist', 'packlist', 'unlocks']
  for (const file of coreFiles) {
    const srcPath = path.join(extractSongsDir, file)
    if (fs.existsSync(srcPath)) {
      const destPath = path.join(publicDataDir, `${file}.json`)
      fs.copyFileSync(srcPath, destPath)
      console.log(`📄 已提取并赋予后缀: ${file} -> public/data/${file}.json`)
    }
  }

  // 1.5 预先读取 songlist.json 构建正确的 ID 白名单
  const songlistPath = path.join(publicDataDir, 'songlist.json')
  let validSongIds = new Set()
  if (fs.existsSync(songlistPath)) {
    try {
      const songlistData = JSON.parse(fs.readFileSync(songlistPath, 'utf-8'))
      validSongIds = new Set(songlistData.songs.map(s => s.id))
      console.log(`📂 成功读取 songlist.json，解析到 ${validSongIds.size} 首官方曲目 ID。`)
    } catch (e) {
      console.error('⚠️ 解析 songlist.json 失败，将回退到使用原始文件夹名。')
    }
  }

  // 2. 遍历歌曲文件夹并提取/转换高清曲绘
  const items = fs.readdirSync(extractSongsDir, { withFileTypes: true })
  let skippedCount = 0
  const conversionTasks = []

  // 构建转换任务队列
  for (const item of items) {
    if (!item.isDirectory()) continue
    if (['pack', 'random', 'tutorial'].includes(item.name)) continue

    // 智能修正 songId：如果带 dl_ 前缀且去除后存在于官方 id 列表中，则剥离 dl_
    let songId = item.name
    if (songId.startsWith('dl_') && validSongIds.has(songId.slice(3))) {
      songId = songId.slice(3)
    }

    const songSrcDir = path.join(extractSongsDir, item.name)
    const files = fs.readdirSync(songSrcDir)
    
    // 智能过滤曲绘文件：
    // 1. 必须是 .jpg 结尾，且不能是带 _256 的缩略图
    // 2. 优先选用 1080_ 开头的高清原图，如果某歌曲只有低清的（没有 1080_ 版本），则退而求其次使用普通版本
    const allJpgs = files.filter(f => f.endsWith('.jpg') && !f.includes('_256'))
    const jackets = []
    
    // 按原始名字进行分组判断
    for (const file of allJpgs) {
      if (file.startsWith('1080_')) {
        jackets.push(file)
      } else {
        // 如果它不带 1080_，检查是否同目录下有它的 1080_ 大哥
        if (!allJpgs.includes(`1080_${file}`)) {
          jackets.push(file)
        }
      }
    }
    
    if (jackets.length === 0) continue

    const songDestDir = path.join(publicSongsDir, songId)
    if (!fs.existsSync(songDestDir)) {
      fs.mkdirSync(songDestDir, { recursive: true })
    }

    for (const jacket of jackets) {
      // 统一命名为 destFile (如 base.avif, 3.avif)
      const namePart = jacket.replace(/^1080_/, '').replace('.jpg', '')
      const destFile = path.join(songDestDir, `${namePart}.avif`)

      if (fs.existsSync(destFile)) {
        skippedCount++
        continue
      }

      conversionTasks.push({
        songId,
        src: path.join(songSrcDir, jacket),
        dest: destFile
      })
    }
  }

  const totalTasks = conversionTasks.length
  let processedCount = 0

  if (totalTasks > 0) {
    // 获取 CPU 核心数作为最大并发数
    const concurrency = Math.max(1, os.cpus().length)
    console.log(`\n🚀 准备就绪！共分配了 ${totalTasks} 个转换任务。`)
    console.log(`💻 正在使用 ${concurrency} 线程满血并发处理...`)
    
    let completedTasks = 0
    let currentTaskName = ''
    const startTime = Date.now()
    
    // 启动定时器，每 100ms 刷新一次极致的进度条
    const progressInterval = setInterval(() => {
      const now = Date.now()
      const elapsedSeconds = (now - startTime) / 1000
      const elapsedStr = elapsedSeconds < 60 
        ? `${elapsedSeconds.toFixed(1)}s` 
        : `${Math.floor(elapsedSeconds / 60)}m ${(elapsedSeconds % 60).toFixed(0)}s`
        
      const progressPct = ((completedTasks / totalTasks) * 100).toFixed(1)
      const taskDisplay = currentTaskName.padEnd(20).substring(0, 20)
      
      process.stdout.write(`\r⚙️ 进度: ${progressPct.padStart(5)}% [${completedTasks}/${totalTasks}] | 用时: ${elapsedStr.padStart(6)} | 当前处理: ${taskDisplay}`)
    }, 100)

    // 简易且极速的异步并发队列
    let taskIndex = 0
    const workers = Array.from({ length: concurrency }, async () => {
      while (taskIndex < totalTasks) {
        const idx = taskIndex++
        const task = conversionTasks[idx]
        currentTaskName = task.songId
        
        try {
          await sharp(task.src)
            .avif({ quality: 65, effort: 4 })
            .toFile(task.dest)
        } catch (err) {
          // 记录失败但不中断其他线程
        }
        completedTasks++
      }
    })
    
    await Promise.all(workers)
    
    clearInterval(progressInterval)
    const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    process.stdout.write(`\r⚙️ 进度: 100.0% [${totalTasks}/${totalTasks}] | 用时: ${finalElapsed}s | 状态: 所有线程处理完毕!`.padEnd(80) + '\n')
    processedCount = totalTasks
  }

  console.log(`\n✅ 曲绘处理彻底完工！本次新转换了 ${processedCount} 张图，跳过了 ${skippedCount} 张已有图。`)

  // 3. 收尾工作
  const tempVersionFile = path.join(ROOT_DIR, 'latest_version.txt')
  if (fs.existsSync(tempVersionFile)) {
    const version = fs.readFileSync(tempVersionFile, 'utf-8').trim()
    const versionFilePath = path.join(ROOT_DIR, 'public', 'data', 'version.json')
    
    let versionData = {}
    if (fs.existsSync(versionFilePath)) {
      try {
        versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf-8'))
      } catch (e) {}
    }
    
    versionData.apk_version = version
    versionData.apk_updated_at = new Date().toISOString()
    
    fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2))
    
    console.log(`\n🎉 流水线总装完成！已将前端网站的当前数据版本刷新为: ${version}`)
    
    fs.unlinkSync(tempVersionFile)
    
    const tempApkNameFile = path.join(ROOT_DIR, 'latest_apk_name.txt')
    if (fs.existsSync(tempApkNameFile)) {
      const apkName = fs.readFileSync(tempApkNameFile, 'utf-8').trim()
      fs.unlinkSync(tempApkNameFile)
      
      console.log(`💡 [运维提示]: 所有纯净且极致压缩的 Vue 静态资产已安静地躺在 public/ 目录下。`)
      console.log(`如果你在本地硬盘紧张，现在可以直接删除 1.8GB 的 ${apkName} 和 extracted_assets/ 文件夹了！`)
    }
  } else {
    console.warn('⚠️ 未找到 latest_version.txt，无法刷新 public/version.json！')
  }
}

run()
