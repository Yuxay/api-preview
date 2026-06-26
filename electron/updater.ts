import { BrowserWindow, app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { compareAppVersions, getCurrentAppVersion, normalizeAppVersion } from './version'

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error'

export interface AppUpdaterState {
  supported: boolean
  phase: UpdaterPhase
  currentVersion: string
  availableVersion?: string
  progress: number
  error?: string
}

export interface AppUpdaterActionResult {
  success: boolean
  state: AppUpdaterState
  error?: string
}

let updaterState: AppUpdaterState = {
  supported: false,
  phase: 'idle',
  currentVersion: getCurrentAppVersion(),
  progress: 0,
}

let checkForUpdatesPromise: Promise<void> | null = null
let installScheduled = false

// ponytail: allow dev-mode update checks; electron-updater GitHub provider
// reads publish config from package.json, which is available in dev too.
function supportsAutoUpdate(): boolean {
  return process.platform === 'win32'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function broadcastUpdaterState(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('updater:state-changed', updaterState)
    }
  }
}

function setUpdaterState(patch: Partial<AppUpdaterState>): void {
  updaterState = {
    ...updaterState,
    ...patch,
    supported: supportsAutoUpdate(),
    currentVersion: getCurrentAppVersion(),
  }
  broadcastUpdaterState()
}

function createActionResult(success: boolean, error?: string): AppUpdaterActionResult {
  return {
    success,
    state: updaterState,
    error,
  }
}

function scheduleQuitAndInstall(): void {
  if (installScheduled) return
  installScheduled = true

  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true)
  }, 1500)
}

async function checkForUpdatesInternal(): Promise<void> {
  if (!supportsAutoUpdate()) return
  if (checkForUpdatesPromise) return checkForUpdatesPromise

  checkForUpdatesPromise = (async () => {
    const result = await autoUpdater.checkForUpdates()
    const currentVersion = getCurrentAppVersion()
    const availableVersion = normalizeAppVersion(result?.updateInfo?.version)

    // Guard against malformed metadata or stale releases that are not newer.
    if (!availableVersion || compareAppVersions(availableVersion, currentVersion) <= 0) {
      installScheduled = false
      setUpdaterState({
        phase: 'up-to-date',
        availableVersion: undefined,
        error: undefined,
        progress: 0,
      })
      return
    }

    if (updaterState.phase === 'available') {
      await autoUpdater.downloadUpdate()
    }
  })().finally(() => {
    checkForUpdatesPromise = null
  })

  return checkForUpdatesPromise
}

export function registerUpdater(): void {
  setUpdaterState({})

  ipcMain.handle('updater:get-state', () => updaterState)

  ipcMain.handle('updater:check', async () => {
    if (!supportsAutoUpdate()) {
      return createActionResult(false, 'unsupported')
    }

    if (updaterState.phase === 'checking' || updaterState.phase === 'downloading') {
      return createActionResult(true)
    }

    if (updaterState.phase === 'downloaded') {
      return createActionResult(true)
    }

    try {
      await checkForUpdatesInternal()
      return createActionResult(true)
    } catch (error) {
      const message = getErrorMessage(error)
      installScheduled = false
      setUpdaterState({
        phase: 'error',
        error: message,
        progress: 0,
      })
      return createActionResult(false, message)
    }
  })

  ipcMain.handle('updater:quit-and-install', () => {
    if (updaterState.phase !== 'downloaded') {
      return createActionResult(false, 'update-not-downloaded')
    }

    scheduleQuitAndInstall()
    return createActionResult(true)
  })

  if (!supportsAutoUpdate()) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true
  autoUpdater.allowPrerelease = false
  autoUpdater.forceDevUpdateConfig = true // ponytail: allow check in dev mode

  autoUpdater.on('checking-for-update', () => {
    installScheduled = false
    setUpdaterState({
      phase: 'checking',
      availableVersion: undefined,
      error: undefined,
      progress: 0,
    })
  })

  autoUpdater.on('update-available', (info) => {
    setUpdaterState({
      phase: 'available',
      availableVersion: info.version,
      error: undefined,
      progress: 0,
    })
  })

  autoUpdater.on('update-not-available', () => {
    installScheduled = false
    setUpdaterState({
      phase: 'up-to-date',
      availableVersion: undefined,
      error: undefined,
      progress: 0,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    setUpdaterState({
      phase: 'downloading',
      progress: Math.max(0, Math.min(100, Math.round(progress.percent))),
      error: undefined,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setUpdaterState({
      phase: 'downloaded',
      availableVersion: info.version,
      progress: 100,
      error: undefined,
    })
    scheduleQuitAndInstall()
  })

  autoUpdater.on('error', (error) => {
    installScheduled = false
    setUpdaterState({
      phase: 'error',
      error: getErrorMessage(error),
      progress: 0,
    })
  })

  void app.whenReady().then(() => {
    setTimeout(() => {
      void checkForUpdatesInternal().catch(() => undefined)
    }, 2500)
  })
}
