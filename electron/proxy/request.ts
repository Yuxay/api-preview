import { ipcMain } from 'electron'
import { validateRequestUrl } from '../ipc/swagger'

const DEFAULT_TIMEOUT_MS = 30_000

export function registerProxyHandler(): void {
  ipcMain.handle('proxy:request', async (_event, options: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }) => {
    const { url, method, headers, body } = options
    const start = Date.now()

    const invalid = validateRequestUrl(url)
    if (invalid) {
      return {
        success: false,
        status: 0,
        statusText: 'Error',
        headers: {} as Record<string, string>,
        body: '',
        duration: 0,
        error: invalid,
      }
    }

    // AbortController 用于超时控制
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: method || 'GET',
        headers: {
          ...headers,
          'User-Agent': 'OpenAPI-Light-Desktop/1.0',
        },
        body: body || undefined,
        redirect: 'follow',
        signal: controller.signal,
      })

      clearTimeout(timer)
      const raw = await res.text()

      const headersObj: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        headersObj[key] = value
      })

      return {
        success: res.ok || (res.status >= 200 && res.status < 400),
        status: res.status,
        statusText: res.statusText || httpStatusText(res.status),
        headers: headersObj,
        body: raw,
        duration: Date.now() - start,
        error: res.ok ? undefined : `HTTP ${res.status}: ${raw.slice(0, 300)}`,
      }
    } catch (err: any) {
      clearTimeout(timer)

      // 区分错误类型
      let error: string
      if (err?.name === 'AbortError' || err?.code === 'ABORT_ERR') {
        error = `请求超时（超过 ${DEFAULT_TIMEOUT_MS / 1000} 秒未响应）`
      } else if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed')) {
        error = `无法连接到服务器 —— 请检查目标地址是否可达、服务是否已启动。`
      } else if (err?.message?.includes('ENOTFOUND') || err?.message?.includes('getaddrinfo')) {
        error = `无法解析域名 —— 请检查 URL 是否正确、DNS 是否可达。`
      } else {
        error = `网络请求失败: ${err.message || '未知错误'}`
      }

      return {
        success: false,
        status: 0,
        statusText: 'Error',
        headers: {} as Record<string, string>,
        body: '',
        duration: Date.now() - start,
        error,
      }
    }
  })
}

/** 常见 HTTP status code 中文说明 */
function httpStatusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  }
  return map[code] || ''
}
