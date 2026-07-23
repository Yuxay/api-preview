import { app } from 'electron'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc/swagger'
import { registerProxyHandler } from './proxy/request'
import { registerUpdater } from './updater'
import { getCurrentAppVersion } from './version'
import { handleTrustedIpc } from './security'

app.whenReady().then(() => {
  // ponytail: tiny IPC so renderer always has the version
  handleTrustedIpc('app:get-version', () => getCurrentAppVersion())

  registerIpcHandlers()
  registerProxyHandler()
  registerUpdater()
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
