import type { ApiItem, ApiSchema } from './types'

// ========== Diff 类型 ==========

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged'

export interface ApiDiffItem {
  type: DiffChangeType
  api: ApiItem
  oldApi?: ApiItem // 仅在 modified 时存在
  changes?: FieldChange[] // 仅在 modified 时存在
}

export interface FieldChange {
  path: string // e.g. "requestBody.schema.properties.name.type"
  oldValue: unknown
  newValue: unknown
}

export interface SchemaDiffItem {
  name: string
  type: DiffChangeType
  changes?: FieldChange[]
}

export interface DiffResult {
  sourceId: string
  sourceName: string
  timestamp: number
  oldTimestamp?: number
  apis: ApiDiffItem[]
  schemas: SchemaDiffItem[]
  summary: DiffSummary
  /** 受 schema 变更影响的 API key（METHOD:path）列表 */
  impactedApiKeys?: string[]
}

export interface DiffSummary {
  added: number
  removed: number
  modified: number
  unchanged: number
  total: number
}

// ========== 核心 Diff 函数 ==========

/**
 * 对比两个 API 快照
 */
export function diffApis(
  sourceId: string,
  sourceName: string,
  oldApis: ApiItem[],
  newApis: ApiItem[],
  oldTimestamp?: number,
  oldSchemas?: Record<string, ApiSchema>,
  newSchemas?: Record<string, ApiSchema>
): DiffResult {
  const oldMap = new Map<string, ApiItem>()
  const newMap = new Map<string, ApiItem>()

  for (const api of oldApis) {
    oldMap.set(apiKey(api), api)
  }
  for (const api of newApis) {
    newMap.set(apiKey(api), api)
  }

  const result: ApiDiffItem[] = []

  // 检查新增和修改
  for (const [key, newApi] of newMap) {
    const oldApi = oldMap.get(key)
    if (!oldApi) {
      result.push({ type: 'added', api: newApi })
    } else {
      const changes = diffApiFields(oldApi, newApi)
      if (changes.length > 0) {
        result.push({ type: 'modified', api: newApi, oldApi, changes })
      } else {
        result.push({ type: 'unchanged', api: newApi })
      }
    }
  }

  // 检查删除
  for (const [key, oldApi] of oldMap) {
    if (!newMap.has(key)) {
      result.push({ type: 'removed', api: oldApi })
    }
  }

  const summary: DiffSummary = result.reduce<DiffSummary>(
    (acc, r) => {
      acc[r.type]++
      return acc
    },
    { added: 0, removed: 0, modified: 0, unchanged: 0, total: newApis.length }
  )

  // schema (DTO) 级差异；仅保留有变化的项，未变更不入列表
  const schemas = diffSchemas(oldSchemas, newSchemas).filter(
    (s) => s.type !== 'unchanged'
  )

  return {
    sourceId,
    sourceName,
    timestamp: Date.now(),
    oldTimestamp,
    apis: result,
    schemas,
    summary,
  }
}

/**
 * 对比单个 API 的字段差异
 */
function diffApiFields(oldApi: ApiItem, newApi: ApiItem): FieldChange[] {
  const changes: FieldChange[] = []

  // requestBody
  const oldBody = JSON.stringify(oldApi.requestBody || null)
  const newBody = JSON.stringify(newApi.requestBody || null)
  if (oldBody !== newBody) {
    changes.push({
      path: 'requestBody',
      oldValue: oldApi.requestBody || null,
      newValue: newApi.requestBody || null,
    })
  }

  // responses
  const oldResp = JSON.stringify(oldApi.responses || [])
  const newResp = JSON.stringify(newApi.responses || [])
  if (oldResp !== newResp) {
    changes.push({
      path: 'responses',
      oldValue: oldApi.responses,
      newValue: newApi.responses,
    })
  }

  // parameters
  const oldParams = JSON.stringify(oldApi.parameters || [])
  const newParams = JSON.stringify(newApi.parameters || [])
  if (oldParams !== newParams) {
    changes.push({
      path: 'parameters',
      oldValue: oldApi.parameters,
      newValue: newApi.parameters,
    })
  }

  // summary / description
  if (oldApi.summary !== newApi.summary) {
    changes.push({ path: 'summary', oldValue: oldApi.summary, newValue: newApi.summary })
  }
  if (oldApi.description !== newApi.description) {
    changes.push({ path: 'description', oldValue: oldApi.description, newValue: newApi.description })
  }

  for (const field of ['security', 'operationId', 'tag'] as const) {
    if (JSON.stringify(oldApi[field]) !== JSON.stringify(newApi[field])) {
      changes.push({ path: field, oldValue: oldApi[field], newValue: newApi[field] })
    }
  }

  return changes
}

/**
 * API 唯一键: method + path
 */
function apiKey(api: ApiItem): string {
  return `${api.method.toUpperCase()}:${api.path}`
}

/**
 * 对比 Schema (DTOS) 变化
 */
export function diffSchemas(
  oldSchemas: Record<string, ApiSchema> | undefined,
  newSchemas: Record<string, ApiSchema> | undefined
): SchemaDiffItem[] {
  const result: SchemaDiffItem[] = []
  const oldMap = oldSchemas || {}
  const newMap = newSchemas || {}

  // 新增 / 修改
  for (const [name, newSchema] of Object.entries(newMap)) {
    const oldSchema = oldMap[name]
    if (!oldSchema) {
      result.push({ name, type: 'added' })
    } else {
      const changes = diffSchemaFields(oldSchema, newSchema, name)
      if (changes.length > 0) {
        result.push({ name, type: 'modified', changes })
      } else {
        result.push({ name, type: 'unchanged' })
      }
    }
  }

  // 删除
  for (const name of Object.keys(oldMap)) {
    if (!newMap[name]) {
      result.push({ name, type: 'removed' })
    }
  }

  return result
}

function diffSchemaFields(
  oldSchema: ApiSchema,
  newSchema: ApiSchema,
  basePath: string
): FieldChange[] {
  const changes: FieldChange[] = []

  // type change
  if (oldSchema.type !== newSchema.type) {
    changes.push({ path: `${basePath}.type`, oldValue: oldSchema.type, newValue: newSchema.type })
  }

  // properties
  const oldProps = oldSchema.properties || {}
  const newProps = newSchema.properties || {}

  for (const [key, newProp] of Object.entries(newProps)) {
    const oldProp = oldProps[key]
    if (!oldProp) {
      changes.push({ path: `${basePath}.${key}`, oldValue: null, newValue: 'added' })
    } else if (JSON.stringify(oldProp) !== JSON.stringify(newProp)) {
      changes.push({
        path: `${basePath}.${key}`,
        oldValue: oldProp.type || 'object',
        newValue: newProp.type || 'object',
      })
    }
  }

  for (const key of Object.keys(oldProps)) {
    if (!newProps[key]) {
      changes.push({ path: `${basePath}.${key}`, oldValue: oldProps[key].type || 'object', newValue: null })
    }
  }

  // required changes
  const oldReq = new Set(oldSchema.required || [])
  const newReq = new Set(newSchema.required || [])
  for (const r of newReq) {
    if (!oldReq.has(r)) {
      changes.push({ path: `${basePath}.required`, oldValue: null, newValue: `+${r}` })
    }
  }
  for (const r of oldReq) {
    if (!newReq.has(r)) {
      changes.push({ path: `${basePath}.required`, oldValue: r, newValue: null })
    }
  }

  return changes
}
