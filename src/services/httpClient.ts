import { translate } from '@/i18n'
import { isTextLikeMediaType } from '@/utils/format'
import { readResponseBytes } from '@/utils/http'

const MAX_RESPONSE_BYTES = 50 * 1024 * 1024

export interface ProxyRequestOptions {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

export interface ProxyResponse {
  success: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  bodyEncoding?: 'text' | 'base64'
  contentType?: string
  bodySize?: number
  error?: string
  duration: number
}

export async function sendRequest(options: ProxyRequestOptions): Promise<ProxyResponse> {
  const start = Date.now()

  if (window.electronAPI) {
    const result = await window.electronAPI.proxyRequest({
      url: options.url,
      method: options.method,
      headers: options.headers,
      body: options.body || undefined,
    })
    return { ...result, duration: Date.now() - start }
  }

  // 浏览器环境 fallback（仅用于调试，无法跨域访问内网 IP）
  try {
    const init: RequestInit = {
      method: options.method,
      headers: options.headers,
    }
    if (options.body && ['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
      init.body = options.body
    }
    const resp = await fetch(options.url, init)
    const respHeaders: Record<string, string> = {}
    resp.headers.forEach((v, k) => {
      respHeaders[k] = v
    })
    const contentType = resp.headers.get('content-type') || undefined
    const textLike = isTextLikeMediaType(contentType)
    const bytes = await readResponseBytes(resp, MAX_RESPONSE_BYTES)
    const body = textLike
      ? new TextDecoder().decode(bytes)
      : uint8ArrayToBase64(bytes)
    return {
      success: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
      body,
      bodyEncoding: textLike ? 'text' : 'base64',
      contentType,
      bodySize: bytes.byteLength,
      duration: Date.now() - start,
    }
  } catch (e: any) {
    return {
      success: false,
      status: 0,
      statusText: translate('errors.networkError'),
      headers: {},
      body: '',
      error: e.message,
      duration: Date.now() - start,
    }
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}
