/// <reference types="vite/client" />

interface ElectronAPI {
  fetchSwagger: (url: string) => Promise<{ success: boolean; data?: unknown; error?: string }>
  proxyRequest: (options: ProxyRequestOptions) => Promise<ProxyResponse>
  getStoredUrls: () => Promise<{ name: string; url: string }[]>
  saveUrl: (entry: { name: string; url: string }) => Promise<void>
  getToken: () => Promise<string>
  saveToken: (token: string) => Promise<void>
  getSnapshot: (sourceId: string) => Promise<unknown>
  saveSnapshot: (sourceId: string, data: unknown) => Promise<void>
  listSnapshots: (sourceId: string) => Promise<number[]>
  loadExampleSpec: () => Promise<{ success: boolean; data?: unknown; error?: string }>
}

interface ProxyRequestOptions {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

interface ProxyResponse {
  success: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  error?: string
}

interface Window {
  electronAPI: ElectronAPI
}
