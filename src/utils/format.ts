const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400 bg-green-500/10',
  POST: 'text-blue-400 bg-blue-500/10',
  PUT: 'text-amber-400 bg-amber-500/10',
  DELETE: 'text-red-400 bg-red-500/10',
  PATCH: 'text-purple-400 bg-purple-500/10',
  OPTIONS: 'text-gray-400 bg-gray-500/10',
  HEAD: 'text-gray-400 bg-gray-500/10',
}

const METHOD_BORDER: Record<string, string> = {
  GET: 'border-green-500/40',
  POST: 'border-blue-500/40',
  PUT: 'border-amber-500/40',
  DELETE: 'border-red-500/40',
  PATCH: 'border-purple-500/40',
  OPTIONS: 'border-gray-500/40',
  HEAD: 'border-gray-500/40',
}

export function getMethodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] || METHOD_COLORS.GET
}

export function getMethodBorder(method: string): string {
  return METHOD_BORDER[method.toUpperCase()] || METHOD_BORDER.GET
}

export function prettyJson(obj: unknown): string {
  try {
    const result = JSON.stringify(obj, null, 2)
    // JSON.stringify returns undefined for Symbol, undefined, functions
    return result ?? String(obj)
  } catch {
    return String(obj)
  }
}

export function tryParseJson(raw: string): { ok: boolean; data: unknown; error?: string } {
  try {
    return { ok: true, data: JSON.parse(raw) }
  } catch (e: any) {
    return { ok: false, data: raw, error: e.message }
  }
}

export function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/** 拼接 base 与 path，规整斜杠，供复制完整 URL 使用 */
export function joinUrl(base: string, path: string): string {
  const cleanBase = (base || '').trim()
  const cleanPath = (path || '').trim()
  if (!cleanBase) return cleanPath
  if (cleanBase.endsWith('/') && cleanPath.startsWith('/')) {
    return cleanBase + cleanPath.slice(1)
  }
  if (!cleanBase.endsWith('/') && cleanPath && !cleanPath.startsWith('/')) {
    return `${cleanBase}/${cleanPath}`
  }
  return cleanBase + cleanPath
}

export function normalizeMediaType(value?: string): string {
  return (value || '').split(';', 1)[0].trim().toLowerCase()
}

export function isJsonMediaType(value?: string): boolean {
  const mediaType = normalizeMediaType(value)
  return mediaType === 'application/json' || mediaType.endsWith('+json')
}

export function isTextLikeMediaType(value?: string): boolean {
  const mediaType = normalizeMediaType(value)
  if (!mediaType) return true
  return (
    mediaType.startsWith('text/') ||
    isJsonMediaType(mediaType) ||
    mediaType === 'application/xml' ||
    mediaType.endsWith('+xml') ||
    mediaType === 'application/x-www-form-urlencoded' ||
    mediaType === 'application/javascript' ||
    mediaType === 'application/ecmascript' ||
    mediaType === 'image/svg+xml'
  )
}

export function formatBytes(bytes?: number): string {
  const size = Number(bytes || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
