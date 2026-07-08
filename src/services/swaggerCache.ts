import type { ApiItem, OpenApiSpec } from '@/core/types'

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
    return (await window.electronAPI.getCachedSource(sourceId)) as CachedSource | null
  }
  const raw = localStorage.getItem(`olid-cache-${sourceId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CachedSource
  } catch {
    return null
  }
}

/**
 * 列出所有已缓存的源（用于启动时检测可用缓存）
 */
export async function getAllCachedSources(): Promise<CachedSource[]> {
  if (window.electronAPI?.getAllCachedSources) {
    return (await window.electronAPI.getAllCachedSources()) as CachedSource[]
  }
  // 浏览器 fallback：扫描 localStorage
  const results: CachedSource[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('olid-cache-')) {
      try {
        results.push(JSON.parse(localStorage.getItem(key)!) as CachedSource)
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
