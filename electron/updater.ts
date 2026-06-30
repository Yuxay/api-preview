import { BrowserWindow, app, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import {
  compareAppVersions,
  getCurrentAppVersion,
  normalizeAppVersion,
} from './version';

export type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

export type UpdaterCheckSource = 'auto' | 'manual' | null;

export interface AppUpdaterState {
  supported: boolean;
  phase: UpdaterPhase;
  lastCheckSource: UpdaterCheckSource;
  currentVersion: string;
  availableVersion?: string;
  progress: number;
  error?: string;
}

export interface AppUpdaterActionResult {
  success: boolean;
  state: AppUpdaterState;
  error?: string;
}

let updaterState: AppUpdaterState = {
  supported: false,
  phase: 'idle',
  lastCheckSource: null,
  currentVersion: getCurrentAppVersion(),
  progress: 0,
};

let checkForUpdatesPromise: Promise<void> | null = null;
let activeCheckSource: UpdaterCheckSource = null;

// ponytail: allow dev-mode update checks; electron-updater GitHub provider
// reads publish config from package.json, which is available in dev too.
function supportsAutoUpdate(): boolean {
  return process.platform === 'win32';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function broadcastUpdaterState(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('updater:state-changed', updaterState);
    }
  }
}

function setUpdaterState(patch: Partial<AppUpdaterState>): void {
  updaterState = {
    ...updaterState,
    ...patch,
    supported: supportsAutoUpdate(),
    lastCheckSource:
      patch.lastCheckSource ??
      activeCheckSource ??
      updaterState.lastCheckSource,
    currentVersion: getCurrentAppVersion(),
  };
  broadcastUpdaterState();
}

function createActionResult(
  success: boolean,
  error?: string,
): AppUpdaterActionResult {
  return {
    success,
    state: updaterState,
    error,
  };
}

async function checkForUpdatesInternal(
  source: Exclude<UpdaterCheckSource, null>,
): Promise<void> {
  if (!supportsAutoUpdate()) return;
  if (checkForUpdatesPromise) {
    // A check is already in progress. If the new source is 'manual',
    // upgrade the active source so the result shows the right dialog.
    if (source === 'manual') {
      activeCheckSource = 'manual';
    }
    return checkForUpdatesPromise;
  }

  activeCheckSource = source;
  checkForUpdatesPromise = (async () => {
    const result = await autoUpdater.checkForUpdates();
    const currentVersion = getCurrentAppVersion();
    const availableVersion = normalizeAppVersion(result?.updateInfo?.version);

    // Guard against malformed metadata or stale releases that are not newer.
    if (
      !availableVersion ||
      compareAppVersions(availableVersion, currentVersion) <= 0
    ) {
      setUpdaterState({
        phase: 'up-to-date',
        availableVersion: undefined,
        error: undefined,
        progress: 0,
      });
      return;
    }
  })().finally(() => {
    checkForUpdatesPromise = null;
  });

  return checkForUpdatesPromise;
}

async function downloadUpdateInternal(): Promise<void> {
  if (!supportsAutoUpdate()) return;
  if (updaterState.phase !== 'available') return;

  await autoUpdater.downloadUpdate();
}

export function registerUpdater(): void {
  setUpdaterState({});

  ipcMain.handle('updater:get-state', () => updaterState);

  ipcMain.handle('updater:check', async () => {
    if (!supportsAutoUpdate()) {
      return createActionResult(false, 'unsupported');
    }

    if (
      updaterState.phase === 'checking'
    ) {
      // Auto-check is in progress — upgrade source to 'manual' so the
      // result dialog behaves as a user-initiated check.
      activeCheckSource = 'manual';
      await checkForUpdatesPromise;
      return createActionResult(true);
    }

    if (
      updaterState.phase === 'downloading' ||
      updaterState.phase === 'downloaded'
    ) {
      return createActionResult(true);
    }

    try {
      await checkForUpdatesInternal('manual');
      return createActionResult(true);
    } catch (error) {
      const message = getErrorMessage(error);
      setUpdaterState({
        phase: 'error',
        error: message,
        progress: 0,
      });
      return createActionResult(false, message);
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (!supportsAutoUpdate()) {
      return createActionResult(false, 'unsupported');
    }

    if (
      updaterState.phase === 'downloading' ||
      updaterState.phase === 'downloaded'
    ) {
      return createActionResult(true);
    }

    if (updaterState.phase !== 'available') {
      return createActionResult(false, 'update-not-available');
    }

    activeCheckSource = 'manual';
    try {
      await downloadUpdateInternal();
      return createActionResult(true);
    } catch (error) {
      const message = getErrorMessage(error);
      setUpdaterState({
        phase: 'error',
        error: message,
        progress: 0,
      });
      return createActionResult(false, message);
    }
  });

  ipcMain.handle('updater:quit-and-install', () => {
    if (updaterState.phase !== 'downloaded') {
      return createActionResult(false, 'update-not-downloaded');
    }

    setTimeout(() => {
      autoUpdater.quitAndInstall(true, true);
    }, 150);
    return createActionResult(true);
  });

  if (!supportsAutoUpdate()) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.forceDevUpdateConfig = true; // ponytail: allow check in dev mode

  autoUpdater.on('checking-for-update', () => {
    setUpdaterState({
      phase: 'checking',
      availableVersion: undefined,
      error: undefined,
      progress: 0,
    });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdaterState({
      phase: 'available',
      availableVersion: info.version,
      error: undefined,
      progress: 0,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdaterState({
      phase: 'up-to-date',
      availableVersion: undefined,
      error: undefined,
      progress: 0,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdaterState({
      phase: 'downloading',
      progress: Math.max(0, Math.min(100, Math.round(progress.percent))),
      error: undefined,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdaterState({
      phase: 'downloaded',
      availableVersion: info.version,
      progress: 100,
      error: undefined,
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdaterState({
      phase: 'error',
      error: getErrorMessage(error),
      progress: 0,
    });
  });

  void app.whenReady().then(() => {
    setTimeout(() => {
      void checkForUpdatesInternal('auto').catch(() => undefined);
    }, 2500);
  });
}
