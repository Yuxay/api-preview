import type { ApiItem, ApiParameter, ApiSchema } from './types'
import { joinUrl } from '@/utils/format'

export type ExportFormat = 'markdown' | 'json'

export interface GenerateOptions {
  /** sourceId → server base url，用于拼接完整 URL */
  baseUrlMap?: Record<string, string>
  /** 文档标题 */
  title?: string
}

/** 结构化的单接口导出条目（JSON 格式与内部使用） */
export interface ApiExportEntry {
  method: string
  path: string
  fullUrl: string
  tag: string
  summary: string
  description: string
  operationId?: string
  source?: string
  secured: boolean
  parameters: {
    path: ExportParam[]
    query: ExportParam[]
    header: ExportParam[]
    cookie: ExportParam[]
  }
  requestBody?: {
    mediaType: string
    required: boolean
    tsType: string
    example: unknown
  }
  responses: {
    code: string
    description: string
    mediaType?: string
    tsType?: string
    example?: unknown
  }[]
}

interface ExportParam {
  name: string
  type: string
  required: boolean
  description: string
  example?: unknown
  /** 完整的 TypeScript 类型定义（仅当参数 schema 为 object/array 等复杂类型时存在） */
  tsType?: string
}

const MAX_DEPTH = 8

/** 导出选择用的唯一键（sourceId + api.id） */
export function exportApiKey(api: ApiItem): string {
  return `${api.sourceId || ''}|${api.id}`
}

// ========== 公共入口 ==========

/** 按所选格式生成代码/规范文本 */
export function generateApiContext(
  apis: ApiItem[],
  format: ExportFormat,
  options: GenerateOptions = {}
): string {
  const entries = apis.map((api) => buildApiExportEntry(api, options))
  return format === 'json'
    ? generateJson(entries, options)
    : generateMarkdown(entries, options)
}

/** 将单个 ApiItem 转换为结构化导出条目 */
export function buildApiExportEntry(api: ApiItem, options: GenerateOptions = {}): ApiExportEntry {
  const base = options.baseUrlMap?.[api.sourceId || ''] || ''
  const bodyMedia = pickRequestMedia(api)
  const bodySchema = bodyMedia?.obj?.schema

  return {
    method: api.method.toUpperCase(),
    path: api.path,
    fullUrl: joinUrl(base, api.path),
    tag: api.tag,
    summary: api.summary || '',
    description: api.description || '',
    operationId: api.operationId,
    source: api.sourceName,
    secured: !!(api.security && api.security.length > 0),
    parameters: {
      path: paramsOf(api.parameters, 'path'),
      query: paramsOf(api.parameters, 'query'),
      header: paramsOf(api.parameters, 'header'),
      cookie: paramsOf(api.parameters, 'cookie'),
    },
    requestBody: bodySchema
      ? {
          mediaType: bodyMedia!.mediaType,
          required: !!api.requestBody?.required,
          tsType: schemaToTsType(bodySchema),
          example: schemaToExample(bodySchema),
        }
      : undefined,
    responses: api.responses.map((resp) => {
      const media = pickResponseMedia(resp.content)
      return {
        code: resp.code || 'default',
        description: resp.description || '',
        mediaType: media?.mediaType,
        tsType: media?.obj?.schema ? schemaToTsType(media.obj.schema) : undefined,
        example: media?.obj?.schema ? schemaToExample(media.obj.schema) : undefined,
      }
    }),
  }
}

// ========== Markdown 生成 ==========

function generateMarkdown(entries: ApiExportEntry[], options: GenerateOptions): string {
  const title = options.title || 'API 接口规范导出'
  const out: string[] = []

  out.push(`# ${title}`)
  out.push('')
  out.push(
    '> 本文档由 ApiPreview 自动生成，包含所选接口的 URL、请求参数、请求体与响应体定义（含 TypeScript 类型与 JSON 示例），可直接提供给 AI Agent 生成对应的 API 调用文件与前端页面。'
  )
  out.push('')
  out.push(`**接口数量**: ${entries.length}`)
  out.push('')

  // 目录
  if (entries.length > 1) {
    out.push('## 目录')
    out.push('')
    entries.forEach((e, i) => {
      out.push(`${i + 1}. \`${e.method} ${e.path}\`${e.summary ? ` — ${e.summary}` : ''}`)
    })
    out.push('')
  }

  out.push('---')
  out.push('')

  for (const e of entries) {
    out.push(`## ${e.method} ${e.path}`)
    out.push('')
    if (e.summary) {
      out.push(`> ${e.summary}`)
      out.push('')
    }
    if (e.description && e.description !== e.summary) {
      out.push(e.description)
      out.push('')
    }

    // 元信息
    out.push(`- **请求方法**: \`${e.method}\``)
    out.push(`- **完整 URL**: \`${e.fullUrl || e.path}\``)
    out.push(`- **接口路径**: \`${e.path}\``)
    if (e.operationId) out.push(`- **Operation ID**: \`${e.operationId}\``)
    out.push(`- **所属标签**: ${e.tag}`)
    if (e.source) out.push(`- **来源**: ${e.source}`)
    out.push(`- **是否鉴权**: ${e.secured ? '是（需要 Authorization）' : '否'}`)
    out.push('')

    pushParamTable(out, '路径参数 (Path)', e.parameters.path)
    pushParamTable(out, '查询参数 (Query)', e.parameters.query)
    pushParamTable(out, '请求头 (Header)', e.parameters.header)
    pushParamTable(out, 'Cookie 参数', e.parameters.cookie)

    // 请求体
    if (e.requestBody) {
      out.push(`### 请求体 (${e.requestBody.mediaType})`)
      out.push('')
      out.push(`必填: ${e.requestBody.required ? '是' : '否'}`)
      out.push('')
      out.push('TypeScript 类型：')
      out.push('')
      out.push('```ts')
      out.push(`interface RequestBody ${e.requestBody.tsType}`)
      out.push('```')
      out.push('')
      out.push('示例：')
      out.push('')
      out.push('```json')
      out.push(stringify(e.requestBody.example))
      out.push('```')
      out.push('')
    }

    // 响应体
    if (e.responses.length > 0) {
      out.push('### 响应')
      out.push('')
      for (const resp of e.responses) {
        out.push(`#### ${resp.code}${resp.description ? ` — ${resp.description}` : ''}`)
        out.push('')
        if (resp.tsType) {
          out.push('TypeScript 类型：')
          out.push('')
          out.push('```ts')
          out.push(`interface Response${normalizeCode(resp.code)} ${resp.tsType}`)
          out.push('```')
          out.push('')
          out.push('示例：')
          out.push('')
          out.push('```json')
          out.push(stringify(resp.example))
          out.push('```')
          out.push('')
        } else {
          out.push('_无响应体_')
          out.push('')
        }
      }
    }

    out.push('---')
    out.push('')
  }

  return out.join('\n').trimEnd() + '\n'
}

function pushParamTable(out: string[], title: string, params: ExportParam[]): void {
  if (params.length === 0) return
  out.push(`### ${title}`)
  out.push('')
  out.push('| 名称 | 类型 | 必填 | 说明 | 示例 |')
  out.push('| --- | --- | --- | --- | --- |')
  for (const p of params) {
    out.push(
      `| \`${p.name}\` | ${p.type} | ${p.required ? '是' : '否'} | ${escapeCell(p.description)} | ${escapeCell(formatExample(p.example))} |`
    )
  }
  out.push('')
  // 展开复杂参数的 TypeScript 类型定义
  const complexParams = params.filter((p) => p.tsType)
  if (complexParams.length > 0) {
    out.push('**参数类型定义：**')
    out.push('')
    for (const p of complexParams) {
      out.push(`- \`${p.name}\`：`)
      out.push('')
      out.push('```ts')
      out.push(`interface ${safeKey(p.name)} ${p.tsType}`)
      out.push('```')
      out.push('')
    }
  }
}

// ========== JSON 生成 ==========

function generateJson(entries: ApiExportEntry[], options: GenerateOptions): string {
  return JSON.stringify(
    {
      title: options.title || 'API 接口规范导出',
      generatedBy: 'ApiPreview',
      count: entries.length,
      apis: entries,
    },
    null,
    2
  )
}

// ========== Schema → TypeScript 类型 ==========

export function schemaToTsType(schema: ApiSchema | undefined, indent = 0, depth = 0): string {
  if (!schema || depth > MAX_DEPTH) return 'any'

  if (schema.$ref) return refName(schema.$ref)
  if (schema.allOf?.length) {
    return schema.allOf.map((s) => schemaToTsType(s, indent, depth + 1)).join(' & ')
  }
  if (schema.oneOf?.length) {
    return schema.oneOf.map((s) => schemaToTsType(s, indent, depth + 1)).join(' | ')
  }
  if (schema.anyOf?.length) {
    return schema.anyOf.map((s) => schemaToTsType(s, indent, depth + 1)).join(' | ')
  }
  if (schema.enum?.length) {
    return schema.enum.map((e) => JSON.stringify(e)).join(' | ')
  }

  const type = schema.type || (schema.properties ? 'object' : 'any')

  switch (type) {
    case 'object': {
      const props = schema.properties
      if (!props || Object.keys(props).length === 0) return 'Record<string, any>'
      const required = new Set(schema.required || [])
      const pad = '  '.repeat(indent + 1)
      const closePad = '  '.repeat(indent)
      const lines = Object.entries(props).map(([key, prop]) => {
        const optional = required.has(key) ? '' : '?'
        const comment = prop.description ? ` // ${prop.description.replace(/\s+/g, ' ').trim()}` : ''
        return `${pad}${safeKey(key)}${optional}: ${schemaToTsType(prop, indent + 1, depth + 1)};${comment}`
      })
      return `{\n${lines.join('\n')}\n${closePad}}`
    }
    case 'array':
      return `${schemaToTsType(schema.items, indent, depth + 1)}[]`
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'string':
      return 'string'
    default:
      return 'any'
  }
}

// ========== Schema → JSON 示例 ==========

export function schemaToExample(schema: ApiSchema | undefined, depth = 0): unknown {
  if (!schema || depth > MAX_DEPTH) return null

  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum?.length) return schema.enum[0]

  if (schema.allOf?.length) {
    const merged: Record<string, unknown> = {}
    for (const sub of schema.allOf) {
      const value = schemaToExample(sub, depth + 1)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(merged, value)
      }
    }
    return merged
  }
  if (schema.oneOf?.length) return schemaToExample(schema.oneOf[0], depth + 1)
  if (schema.anyOf?.length) return schemaToExample(schema.anyOf[0], depth + 1)

  const type = schema.type || (schema.properties ? 'object' : undefined)

  switch (type) {
    case 'object': {
      const obj: Record<string, unknown> = {}
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = schemaToExample(prop, depth + 1)
        }
      }
      return obj
    }
    case 'array':
      return [schemaToExample(schema.items, depth + 1)]
    case 'string':
      return exampleString(schema.format)
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return null
  }
}

// ========== 辅助 ==========

function paramsOf(params: ApiParameter[], location: ApiParameter['in']): ExportParam[] {
  return params
    .filter((p) => p.in === location)
    .map((p) => {
      const schema = p.schema
      const hasComplexSchema =
        schema &&
        ((schema.type === 'object' && schema.properties && Object.keys(schema.properties).length > 0) ||
          (schema.type === 'array' && schema.items) ||
          schema.oneOf?.length ||
          schema.anyOf?.length ||
          schema.allOf?.length ||
          schema.$ref)
      return {
        name: p.name,
        type: schemaTypeLabel(schema),
        required: p.required,
        description: p.description || '',
        example: p.example ?? schema?.example ?? schema?.default,
        tsType: hasComplexSchema ? schemaToTsType(schema) : undefined,
      }
    })
}

function schemaTypeLabel(schema?: ApiSchema): string {
  if (!schema) return 'any'
  if (schema.$ref) return refName(schema.$ref)
  if (schema.type === 'array') return `${schema.items?.type || 'any'}[]`
  return [schema.type, schema.format].filter(Boolean).join(' / ') || 'any'
}

function pickRequestMedia(api: ApiItem): { mediaType: string; obj: { schema?: ApiSchema } } | null {
  const content = api.requestBody?.content
  if (!content) return null
  const preferred = content['application/json']
  if (preferred) return { mediaType: 'application/json', obj: preferred }
  const first = Object.entries(content)[0]
  return first ? { mediaType: first[0], obj: first[1] } : null
}

function pickResponseMedia(
  content?: Record<string, { schema?: ApiSchema }>
): { mediaType: string; obj: { schema?: ApiSchema } } | null {
  if (!content) return null
  const preferred = content['application/json']
  if (preferred) return { mediaType: 'application/json', obj: preferred }
  const first = Object.entries(content)[0]
  return first ? { mediaType: first[0], obj: first[1] } : null
}

function refName(ref: string): string {
  return ref.split('/').pop() || ref
}

function safeKey(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key)
}

function normalizeCode(code: string): string {
  if (/^\d+$/.test(code)) return code
  return code.replace(/[^A-Za-z0-9]/g, '') || 'Default'
}

function exampleString(format?: string): string {
  switch (format) {
    case 'date-time':
      return '2024-01-01T00:00:00Z'
    case 'date':
      return '2024-01-01'
    case 'email':
      return 'user@example.com'
    case 'uri':
    case 'url':
      return 'https://example.com'
    case 'uuid':
      return '00000000-0000-0000-0000-000000000000'
    default:
      return 'string'
  }
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'null'
  } catch {
    return String(value)
  }
}

function formatExample(value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function escapeCell(text: string): string {
  return (text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim() || '-'
}
