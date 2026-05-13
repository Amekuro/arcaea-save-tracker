import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css' // 引入深色模式变量
import App from './App.vue'
import './assets/main.css'

// 主题模式管理 (支持: light, dark, auto)
const savedTheme = localStorage.getItem('theme-setting') || 'auto'
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

const applyTheme = (theme) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark')
  } else {
    // auto 模式跟随系统
    if (mediaQuery.matches) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }
}

// 页面加载时立即应用主题，防止白屏闪烁
applyTheme(savedTheme)

// 监听系统主题变化（仅在 auto 模式下生效）
mediaQuery.addEventListener('change', () => {
  const currentSetting = localStorage.getItem('theme-setting') || 'auto'
  if (currentSetting === 'auto') {
    applyTheme('auto')
  }
})

// 挂载到 window，方便 Vue 组件调用
window.setAppTheme = (theme) => {
  localStorage.setItem('theme-setting', theme)
  applyTheme(theme)
}

const app = createApp(App)

app.use(ElementPlus)
app.mount('#app')
