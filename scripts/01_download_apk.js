import fs from 'fs'
import path from 'path'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { fileURLToPath } from 'url'

// 获取当前模块所在目录的绝对路径
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')
const PUBLIC_DIR = path.join(ROOT_DIR, 'public')
const VERSION_FILE = path.join(PUBLIC_DIR, 'version.json')
const TEMP_VERSION_FILE = path.join(ROOT_DIR, 'latest_version.txt')

async function run() {
  console.log('正在访问 Arcaea 官网获取最新版本信息...')
  
  try {
    // 1. 直接请求官方的 webapi 接口获取最新包的动态下载链接和版本号
    const { data: apiResponse } = await axios.get('https://webapi.lowiro.com/webapi/serve/static/bin/arcaea/apk')
    
    if (!apiResponse || !apiResponse.success || !apiResponse.value || !apiResponse.value.url) {
      throw new Error('请求官方下载 API 失败，请检查网络或官方接口是否已变更！')
    }
    
    const apkUrl = apiResponse.value.url
    const latestVersion = apiResponse.value.version || 'unknown'
    
    console.log(`📡 获取到官网最新 APK 版本号: ${latestVersion}`)
    
    // 2. 读取本地记录的版本号进行对比
    let localVersion = 'none'
    if (fs.existsSync(VERSION_FILE)) {
      const versionData = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf-8'))
      localVersion = versionData.apk_version || 'none'
    }
    
    console.log(`📦 当前本地缓存版本号: ${localVersion}`)
    
    if (latestVersion !== 'unknown' && latestVersion === localVersion) {
      console.log('✅ 版本一致，无需下载更新！脚本将终止。')
      // 写入一个标记文件供 GitHub Actions 识别，从而跳过后续的解压和转换步骤
      fs.writeFileSync(path.join(ROOT_DIR, '.skip_update'), 'true')
      return
    }
    
    console.log(`🚀 检测到新版本 ${latestVersion}！开始下载 APK... (这可能需要几分钟)`)
    
    // 5. 使用原文件名而不是固定的 arcaea_latest.apk
    // 例如获取到的文件名类似: arcaea_6.14.1c.apk
    const originalFileName = `arcaea_${latestVersion}.apk`
    const downloadPath = path.join(ROOT_DIR, originalFileName)
    
    // 6. 流式下载大文件 (防止内存溢出)
    const response = await axios({
      method: 'GET',
      url: apkUrl,
      responseType: 'stream'
    })
    
    const writer = fs.createWriteStream(downloadPath)
    
    // 下载进度计算与日志节流
    let downloadedBytes = 0
    let totalBytes = parseInt(response.headers['content-length'] || '0', 10)
    const startTime = Date.now()
    let lastLogTime = 0
    
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length
      const now = Date.now()
      
      // 节流：每 100ms 刷新一次控制台，防止刷爆 GitHub Actions 的日志
      if (now - lastLogTime > 100 || downloadedBytes === totalBytes) {
        lastLogTime = now
        const elapsedSeconds = (now - startTime) / 1000
        const speedMBps = elapsedSeconds > 0 ? (downloadedBytes / 1024 / 1024) / elapsedSeconds : 0
        
        const elapsedStr = elapsedSeconds < 60 
          ? `${elapsedSeconds.toFixed(1)}s` 
          : `${Math.floor(elapsedSeconds / 60)}m ${(elapsedSeconds % 60).toFixed(0)}s`
          
        const mbString = (downloadedBytes / 1024 / 1024).toFixed(1)
        const speedString = speedMBps.toFixed(1)
        
        if (totalBytes > 0) {
          const progress = ((downloadedBytes / totalBytes) * 100).toFixed(2)
          process.stdout.write(`\r📥 下载进度: ${progress}% (${mbString}MB) | 速度: ${speedString} MB/s | 用时: ${elapsedStr}  `)
        } else {
          process.stdout.write(`\r📥 已下载: ${mbString}MB | 速度: ${speedString} MB/s | 用时: ${elapsedStr}  `)
        }
      }
    })
    
    response.data.pipe(writer)
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', reject)
    })
    
    console.log('\n\n✅ APK 下载完成！保存位置:', downloadPath)
    
    // 7. 将最新版本号存入临时文件，等所有静态资源处理完毕后，由最后一个脚本正式更新 version.json
    fs.writeFileSync(TEMP_VERSION_FILE, latestVersion)
    
    // 把下载得到的文件名也存下来，方便后面的解压脚本知道该解压哪个文件
    fs.writeFileSync(path.join(ROOT_DIR, 'latest_apk_name.txt'), originalFileName)
    
    // 确保删除跳过标记
    if (fs.existsSync(path.join(ROOT_DIR, '.skip_update'))) {
      fs.unlinkSync(path.join(ROOT_DIR, '.skip_update'))
    }
    
  } catch (err) {
    console.error('\n❌ 下载流程发生致命错误:', err.message)
    process.exit(1) // 抛出非 0 退出码，让 GitHub Actions 标记任务失败
  }
}

run()
