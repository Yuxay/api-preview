import { translate } from '@/i18n'

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
    const body = await resp.text()
    return {
      success: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
      body,
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
