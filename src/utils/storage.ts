import { isValidSourceId } from '@/core/sourceId'

const STORAGE_KEY_URLS = 'olid-recent-urls'
const STORAGE_KEY_TOKEN = 'olid-token'
const STORAGE_KEY_SOURCES = 'olid-sources'
const STORAGE_KEY_UI_PREFIX = 'olid-ui:'

export interface RecentEntry {
  name: string
  url: string
}

export interface PersistedSource {
  id: string
  name: string
  url: string
}

function validPersistedSources(value: unknown): PersistedSource[] {
  if (!Array.isArray(value)) return []
  return value.filter((source): source is PersistedSource =>
    typeof source === 'object' &&
    source !== null &&
    isValidSourceId((source as PersistedSource).id) &&
    typeof (source as PersistedSource).name === 'string' &&
    typeof (source as PersistedSource).url === 'string'
  )
}

function isElectron(): boolean {
  return !!(window.electronAPI)
}

export async function getStoredUrls(): Promise<RecentEntry[]> {
  if (isElectron()) {
    const raw = await window.electronAPI.getStoredUrls()
    // 兼容旧格式
    return raw.map((item: any) => {
      if (typeof item === 'string') return { name: '', url: item }
      return item as RecentEntry
    })
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_URLS)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return parsed.map((item: any) => {
      if (typeof item === 'string') return { name: '', url: item }
      return item as RecentEntry
    })
  } catch {
    return []
  }
}

export async function saveUrl(entry: RecentEntry): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.saveUrl(entry)
    return
  }
  const entries = await getStoredUrls()
  const filtered = entries.filter((e) => e.url !== entry.url)
  filtered.unshift(entry)
  localStorage.setItem(STORAGE_KEY_URLS, JSON.stringify(filtered.slice(0, 5)))
}

export async function getToken(): Promise<string> {
  if (isElectron()) {
    try {
      return await window.electronAPI.getToken()
    } catch (error) {
      console.warn('[storage] Failed to load stored token:', error)
      return ''
    }
  }
  return localStorage.getItem(STORAGE_KEY_TOKEN) || ''
}

export async function saveToken(token: string): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.saveToken(token)
    return
  }
  localStorage.setItem(STORAGE_KEY_TOKEN, token)
}

export async function getPersistedSources(): Promise<PersistedSource[]> {
  if (isElectron()) {
    return validPersistedSources(await window.electronAPI.getPersistedSources())
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOURCES)
    return raw ? validPersistedSources(JSON.parse(raw)) : []
  } catch {
    return []
  }
}

export async function savePersistedSources(sources: PersistedSource[]): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.savePersistedSources(sources)
    return
  }
  localStorage.setItem(STORAGE_KEY_SOURCES, JSON.stringify(sources))
}

export function getUiState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_UI_PREFIX}${key}`)
    return raw ? JSON.parse(raw) as T : fallback
  } catch {
    return fallback
  }
}

export function saveUiState<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_UI_PREFIX}${key}`, JSON.stringify(value))
  } catch {
    // ignore storage errors for renderer-only UI preferences
  }
}
