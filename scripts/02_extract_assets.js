import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '..')

// 如果存在跳过标记，则直接秒退
if (fs.existsSync(path.join(ROOT_DIR, '.skip_update'))) {
  console.log('⏩ 检测到 .skip_update 标记，版本未发生变化，跳过解包步骤。')
  process.exit(0)
}

// 获取要解压的 APK 文件名
let apkName = ''
try {
  apkName = fs.readFileSync(path.join(ROOT_DIR, 'latest_apk_name.txt'), 'utf-8').trim()
} catch (e) {
  console.error('❌ 未找到 latest_apk_name.txt！请确保先成功执行了 01_download_apk.js。')
  process.exit(1)
}

const apkPath = path.join(ROOT_DIR, apkName)
const extractDir = path.join(ROOT_DIR, 'extracted_assets')

console.log(`📦 目标已锁定: ${apkName}，准备开膛破肚...`)

if (!fs.existsSync(apkPath)) {
  console.error(`❌ 找不到物理文件: ${apkPath}`)
  process.exit(1)
}

// 为了防止旧数据干扰，每次解压前把上次的残留干掉
if (fs.existsSync(extractDir)) {
  console.log('🧹 正在清理旧的解压目录...')
  fs.rmSync(extractDir, { recursive: true, force: true })
}
fs.mkdirSync(extractDir, { recursive: true })

try {
  // 调用底层 Linux/Unix 原生 unzip 命令
  // -q 静默解压，只报错误，防止控制台刷屏
  // -o 无脑覆盖
  // "assets/songs/*" 指明只要这个文件夹里的东西，剩下的那 1GB 废料碰都不碰
  console.log('⏳ 正在高速剥离音频与曲绘资产 (大约需要 10~30 秒)...')
  
  execSync(`unzip -q -o "${apkPath}" "assets/songs/*" -d "${extractDir}"`, { 
    stdio: 'inherit' 
  })
  
  console.log('✅ 手术成功！所需核心资源已全部剥离至:', path.join(extractDir, 'assets/songs'))
} catch (err) {
  console.error('\n❌ 解压命令执行失败！')
  console.error('如果你在 Windows 本地运行此脚本，可能是因为系统没有原生 unzip 命令。')
  console.error('在 Github Actions 的 Ubuntu 容器中这行代码会完美运行。')
  console.error(err.message)
  process.exit(1)
}
