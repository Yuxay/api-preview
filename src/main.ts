import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { useTheme } from '@/composables/useTheme'

useTheme()

const app = createApp(App)
app.mount('#app')

// ── Dismiss splash screen ──
const splash = document.getElementById('splash')
if (splash) {
  requestAnimationFrame(() => {
    // Brief delay so the intro animations have a moment to play
    setTimeout(() => {
      splash.classList.add('splash-exit')
      splash.addEventListener('transitionend', () => splash.remove(), { once: true })
      // Safety fallback — ensure element is removed even if transitionend doesn't fire
      setTimeout(() => {
        if (splash.parentNode) splash.remove()
      }, 600)
    }, 200)
  })
}
