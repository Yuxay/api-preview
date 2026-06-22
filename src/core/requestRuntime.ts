import type { ApiItem } from './types'
import { translate } from '@/i18n'

// ========== 输出类型 ==========
export interface RequestConfig {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface RequestBuildError {
  type: 'missing_path_param' | 'invalid_json_body' | 'invalid_url'
  message: string
  param?: string
}

export interface BuildResult {
  ok: boolean
  config?: RequestConfig
  error?: RequestBuildError
}

// ========== 构建选项 ==========
export interface RequestBuildOptions {
  servers?: { url: string }[]
  token: string
  pathParams: Record<string, string>
  queryParams: Record<string, string>
  headers: Record<string, string>
  body: string // raw JSON string from editor
}

// ========== 核心构建函数 ==========

/**
 * 将用户输入组装为可发送的 HTTP 请求配置
 */
export function buildRequest(api: ApiItem, opts: RequestBuildOptions): BuildResult {
  // 1. 构建 URL
  const urlResult = buildUrl(api.path, opts.servers, opts.pathParams, opts.queryParams)
  if (!urlResult.ok) {
    return { ok: false, error: urlResult.error }
  }

  // 2. 构建 Headers
  const headers = buildHeaders(api, opts)

  // 3. 构建/校验 Body
  const bodyResult = buildBody(api.method, opts.body)
  if (bodyResult !== null && !bodyResult.ok) {
    return { ok: false, error: bodyResult.error }
  }

  return {
    ok: true,
    config: {
      url: urlResult.url!,
      method: api.method,
      headers,
      body: bodyResult?.body,
    },
  }
}

// ========== URL 拼接 ==========

function buildUrl(
  pathTemplate: string,
  servers: { url: string }[] | undefined,
  pathParams: Record<string, string>,
  queryParams: Record<string, string>,
): { ok: boolean; url?: string; error?: RequestBuildError } {
  // 替换路径参数 {id} → 用户输入
  let resolvedPath = pathTemplate
  for (const [key, value] of Object.entries(pathParams)) {
    if (!value) {
      return {
        ok: false,
        error: {
          type: 'missing_path_param',
          message: translate('errors.missingPathParam', { param: key }),
          param: key,
        },
      }
    }
    resolvedPath = resolvedPath.replaceAll(`{${key}}`, encodeURIComponent(value))
  }

  // 检查是否还有未替换的路径参数
  const remaining = resolvedPath.match(/\{(\w+)\}/)
  if (remaining) {
    return {
      ok: false,
      error: {
        type: 'missing_path_param',
        message: translate('errors.missingPathParam', { param: remaining[1] }),
        param: remaining[1],
      },
    }
  }

  // Base URL (server)
  const base = servers?.[0]?.url || ''

  // 拼接，处理多余或缺失的斜杠
  let fullUrl: string
  if (base.endsWith('/') && resolvedPath.startsWith('/')) {
    fullUrl = base + resolvedPath.slice(1)
  } else if (!base.endsWith('/') && !resolvedPath.startsWith('/')) {
    fullUrl = base + '/' + resolvedPath
  } else {
    fullUrl = base + resolvedPath
  }

  // 拼接 Query String
  const qs = buildQueryString(queryParams)
  if (qs) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs
  }

  return { ok: true, url: fullUrl }
}

function buildQueryString(params: Record<string, string>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    }
  }
  return parts.join('&')
}

// ========== Headers 构建 ==========

function buildHeaders(api: ApiItem, opts: RequestBuildOptions): Record<string, string> {
  const headers: Record<string, string> = {}

  // 1. 默认 Content-Type（有 body 的方法）
  if (['POST', 'PUT', 'PATCH'].includes(api.method.toUpperCase())) {
    headers['Content-Type'] = 'application/json'
  }

  // 2. Token 注入
  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`
  }

  // 3. 用户自定义 headers（覆盖默认值）
  for (const [key, value] of Object.entries(opts.headers)) {
    if (value) {
      headers[key] = value
    }
  }

  // 4. 删除空的 header（用户手动清空的）
  for (const [key, value] of Object.entries(headers)) {
    if (!value) delete headers[key]
  }

  return headers
}

// ========== Body 处理 ==========

function buildBody(
  method: string,
  rawBody: string,
): { ok: boolean; body?: string; error?: RequestBuildError } | null {
  // 无 body 的方法跳过
  if (!['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    return null
  }

  const trimmed = (rawBody || '').trim()
  if (!trimmed) return null // 空 body 不发送

  // JSON 校验
  try {
    JSON.parse(trimmed)
  } catch (e: any) {
    return {
      ok: false,
      error: {
        type: 'invalid_json_body',
        message: translate('errors.invalidJson', { message: e.message }),
      },
    }
  }

  return { ok: true, body: trimmed }
}
