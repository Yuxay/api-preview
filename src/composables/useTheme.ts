import { computed, ref, watch } from 'vue'
import { getUiState, saveUiState } from '@/utils/storage'

export type ThemeMode = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme-mode'
const themeModeState = ref<ThemeMode>(getUiState<ThemeMode>(THEME_STORAGE_KEY, 'system'))
const systemThemeState = ref<EffectiveTheme>('dark')

let initialized = false
let mediaQueryList: MediaQueryList | null = null
let mediaQueryHandler: ((event: MediaQueryListEvent) => void) | null = null

function resolveSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function effectiveThemeValue(): EffectiveTheme {
  return themeModeState.value === 'system' ? systemThemeState.value : themeModeState.value
}

function applyTheme() {
  if (typeof document === 'undefined') return
  const effective = effectiveThemeValue()
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(effective)
  root.dataset.theme = themeModeState.value
  root.style.colorScheme = effective
}

function initializeTheme() {
  if (initialized) return
  initialized = true

  systemThemeState.value = resolveSystemTheme()
  applyTheme()

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQueryHandler = (event: MediaQueryListEvent) => {
      systemThemeState.value = event.matches ? 'dark' : 'light'
      if (themeModeState.value === 'system') {
        applyTheme()
      }
    }

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', mediaQueryHandler)
    } else {
      mediaQueryList.addListener(mediaQueryHandler)
    }
  }
}

watch(
  themeModeState,
  (value) => {
    saveUiState(THEME_STORAGE_KEY, value)
    applyTheme()
  },
  { immediate: false }
)

export function setThemeMode(mode: ThemeMode) {
  themeModeState.value = mode
}

export function getThemeMode(): ThemeMode {
  return themeModeState.value
}

export function useTheme() {
  initializeTheme()

  return {
    themeMode: computed(() => themeModeState.value),
    effectiveTheme: computed(() => effectiveThemeValue()),
    setThemeMode,
  }
}
