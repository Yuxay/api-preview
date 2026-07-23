import { ipcMain, type IpcMainInvokeEvent } from 'electron'

type IpcHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any

/** Only the renderer owned by our main window may reach privileged handlers. */
export function handleTrustedIpc(channel: string, handler: IpcHandler): void {
  ipcMain.handle(channel, (event, ...args) => {
    const mainWindow = globalThis.__mainWindow
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) {
      throw new Error('Blocked IPC call from an untrusted renderer')
    }
    return handler(event, ...args)
  })
}
