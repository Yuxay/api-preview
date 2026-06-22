import { app } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/swagger'
import { registerProxyHandler } from './proxy/request'

app.whenReady().then(() => {
  registerIpcHandlers()
  registerProxyHandler()
  createMainWindow()

  app.on('activate', () => {
    if (!globalThis.__mainWindow || globalThis.__mainWindow.isDestroyed()) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
