import type { ApiItem, OpenApiSpec } from '@/core/types'
import { isValidSourceId } from '@/core/sourceId'

/**
 * 离线缓存数据结构 —— 成功加载后将完整源数据持久化到本地，
 * 以便服务端离线时仍可浏览之前加载过的 API 文档。
 */
export interface CachedSource {
  sourceId: string
  sourceName: string
  url: string
  spec: OpenApiSpec
  apis: ApiItem[]
  timestamp: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isCachedSource(value: unknown, sourceId?: string): value is CachedSource {
  if (!isRecord(value) || !isRecord(value.spec) || !isRecord(value.spec.info)) return false
  if (!isValidSourceId(value.sourceId) || (sourceId && value.sourceId !== sourceId)) return false
  if (typeof value.sourceName !== 'string' || typeof value.url !== 'string') return false
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return false
  if (!Array.isArray(value.apis)) return false
  if (!value.apis.every((api) =>
    isRecord(api) &&
    typeof api.id === 'string' &&
    typeof api.tag === 'string' &&
    typeof api.method === 'string' &&
    typeof api.path === 'string' &&
    Array.isArray(api.parameters) &&
    Array.isArray(api.responses)
  )) return false
  if (typeof value.spec.info.title !== 'string' || typeof value.spec.info.version !== 'string') return false
  if (!isRecord(value.spec.paths)) return false
  return typeof value.spec.openapi === 'string' || typeof value.spec.swagger === 'string'
}

/**
 * 保存单个源的离线缓存（通过 IPC 持久化到主进程文件系统）
 */
export async function saveCachedSource(source: CachedSource): Promise<void> {
  if (window.electronAPI?.saveCachedSource) {
    await window.electronAPI.saveCachedSource(source.sourceId, source)
  } else {
    // 浏览器 fallback
    localStorage.setItem(
      `olid-cache-${source.sourceId}`,
      JSON.stringify(source),
    )
  }
}

/**
 * 读取单个源的离线缓存
 */
export async function getCachedSource(
  sourceId: string,
): Promise<CachedSource | null> {
  if (window.electronAPI?.getCachedSource) {
    const cached = await window.electronAPI.getCachedSource(sourceId)
    return isCachedSource(cached, sourceId) ? cached : null
  }
  const raw = localStorage.getItem(`olid-cache-${sourceId}`)
  if (!raw) return null
  try {
    const cached: unknown = JSON.parse(raw)
    return isCachedSource(cached, sourceId) ? cached : null
  } catch {
    return null
  }
}

/**
 * 列出所有已缓存的源（用于启动时检测可用缓存）
 */
export async function getAllCachedSources(): Promise<CachedSource[]> {
  if (window.electronAPI?.getAllCachedSources) {
    const cached = await window.electronAPI.getAllCachedSources()
    return cached.filter((value) => isCachedSource(value))
  }
  // 浏览器 fallback：扫描 localStorage
  const results: CachedSource[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('olid-cache-')) {
      try {
        const cached: unknown = JSON.parse(localStorage.getItem(key)!)
        if (isCachedSource(cached, key.slice('olid-cache-'.length))) results.push(cached)
      } catch {
        /* 忽略损坏的缓存条目 */
      }
    }
  }
  return results
}

/**
 * 删除单个源的离线缓存
 */
export async function removeCachedSource(sourceId: string): Promise<void> {
  if (window.electronAPI?.removeCachedSource) {
    await window.electronAPI.removeCachedSource(sourceId)
  } else {
    localStorage.removeItem(`olid-cache-${sourceId}`)
  }
}
