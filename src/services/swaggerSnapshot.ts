import type { ApiItem, ApiSchema, OpenApiSpec } from '@/core/types'

export interface SnapshotData {
  sourceId: string
  sourceName: string
  timestamp: number
  apis: ApiItem[]
  /** DTO 定义（components.schemas 或 Swagger 2.0 definitions），用于 schema diff */
  schemas?: Record<string, ApiSchema>
}

/**
 * 从规范中提取 DTO 定义，兼容 OpenAPI 3.x（components.schemas）与 Swagger 2.0（definitions）
 */
export function extractSchemas(spec?: OpenApiSpec): Record<string, ApiSchema> {
  if (!spec) return {}
  const fromComponents = spec.components?.schemas
  if (fromComponents) return fromComponents
  const fromDefinitions = (spec as { definitions?: Record<string, ApiSchema> }).definitions
  return fromDefinitions || {}
}

/**
 * 保存快照（通过 IPC 持久化到主进程文件系统）
 */
export async function saveSnapshot(
  sourceId: string,
  sourceName: string,
  apis: ApiItem[],
  schemas?: Record<string, ApiSchema>
): Promise<void> {
  const snapshot: SnapshotData = {
    sourceId,
    sourceName,
    timestamp: Date.now(),
    apis: apis.map((a) => ({
      ...a,
      parameters: a.parameters.map((p) => ({ ...p })),
      requestBody: a.requestBody ? { ...a.requestBody } : undefined,
      responses: a.responses.map((r) => ({ ...r })),
    })),
    schemas,
  }

  if (window.electronAPI) {
    await window.electronAPI.saveSnapshot(sourceId, snapshot)
  } else {
    // 浏览器 fallback
    localStorage.setItem(
      `olid-snapshot-${sourceId}`,
      JSON.stringify(snapshot)
    )
  }
}

/**
 * 读取「最新历史」快照（用于与当前对比）
 */
export async function getSnapshot(
  sourceId: string
): Promise<SnapshotData | null> {
  if (window.electronAPI) {
    return (await window.electronAPI.getSnapshot(sourceId)) as SnapshotData | null
  }
  const raw = localStorage.getItem(`olid-snapshot-${sourceId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SnapshotData
  } catch {
    return null
  }
}

/**
 * 列出某源历史快照时间戳（最新在前）。浏览器 fallback 无历史链，至多返回一份。
 */
export async function listSnapshots(sourceId: string): Promise<number[]> {
  if (window.electronAPI) {
    return window.electronAPI.listSnapshots(sourceId)
  }
  const raw = localStorage.getItem(`olid-snapshot-${sourceId}`)
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as SnapshotData
    return typeof data.timestamp === 'number' ? [data.timestamp] : []
  } catch {
    return []
  }
}
