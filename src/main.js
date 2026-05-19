import { ViteSSG } from 'vite-ssg/single-page'
import ElementPlus from 'element-plus'
import { ID_INJECTION_KEY } from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import App from './App.vue'
import './assets/main.css'

export const createApp = ViteSSG(
  App,
  ({ app, isClient }) => {
    app.use(ElementPlus)
    app.provide(ID_INJECTION_KEY, { prefix: 0, current: 0 })

    if (isClient) {
      const savedTheme = localStorage.getItem('theme-setting') || 'auto'
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

      const applyTheme = (theme) => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark')
        } else {
          document.documentElement.classList.toggle('dark', mediaQuery.matches)
        }
      }

      applyTheme(savedTheme)

      mediaQuery.addEventListener('change', () => {
        const current = localStorage.getItem('theme-setting') || 'auto'
        if (current === 'auto') applyTheme('auto')
      })

      window.setAppTheme = (theme) => {
        localStorage.setItem('theme-setting', theme)
        applyTheme(theme)
      }
    }
  }
)
