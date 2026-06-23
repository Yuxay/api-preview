import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  fetchSwagger: (url: string, requestId?: string) =>
    ipcRenderer.invoke('swagger:fetch', url, requestId),

  cancelSwaggerFetch: (requestId: string) =>
    ipcRenderer.invoke('swagger:cancel', requestId),

  proxyRequest: (options: {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }) =>
    ipcRenderer.invoke('proxy:request', options),

  getStoredUrls: () =>
    ipcRenderer.invoke('storage:get-urls'),

  saveUrl: (entry: { name: string; url: string }) =>
    ipcRenderer.invoke('storage:save-url', entry),

  getToken: () =>
    ipcRenderer.invoke('storage:get-token'),

  saveToken: (token: string) =>
    ipcRenderer.invoke('storage:save-token', token),

  getSnapshot: (sourceId: string) =>
    ipcRenderer.invoke('storage:get-snapshot', sourceId),

  saveSnapshot: (sourceId: string, data: unknown) =>
    ipcRenderer.invoke('storage:save-snapshot', sourceId, data),

  listSnapshots: (sourceId: string) =>
    ipcRenderer.invoke('storage:list-snapshots', sourceId),

  loadExampleSpec: () =>
    ipcRenderer.invoke('example:load'),
})
