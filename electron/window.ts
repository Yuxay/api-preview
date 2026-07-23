import { BrowserWindow, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

declare global {
  // eslint-disable-next-line no-var
  var __mainWindow: BrowserWindow | undefined;
}

export function createMainWindow(): BrowserWindow {
  // App icon: PNG for Electron (converted from SVG at build time by scripts/generate-icons.py)
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'ApiPreview',
    icon: join(__dirname, '../brand/logo-icon-v2.png'),
    backgroundColor: '#020617',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // preload 仅依赖 contextBridge / ipcRenderer，可在沙箱内运行
      sandbox: true,
    },
  });

  globalThis.__mainWindow = win;

  configureContentSecurityPolicy(win);

  const appEntryFile = join(__dirname, '../dist/index.html');
  // 开发模式加载 Vite dev server，生产模式加载打包文件
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(appEntryFile);
  }

  hardenNavigation(win, appEntryFile);

  win.on('closed', () => {
    globalThis.__mainWindow = undefined;
  });

  return win;
}

/**
 * 收紧导航面：仅允许停留在应用自身页面（dev server / file），
 * 任何跳转到外部页面的请求一律拦截，http/https 改用系统浏览器打开。
 */
function hardenNavigation(win: BrowserWindow, appEntryFile: string): void {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const devOrigin = devServerUrl ? new URL(devServerUrl).origin : null;
  const appEntryUrl = new URL(pathToFileURL(appEntryFile).href);

  function isAppUrl(target: string): boolean {
    try {
      const targetUrl = new URL(target);
      if (devOrigin) return targetUrl.origin === devOrigin;
      return (
        targetUrl.protocol === 'file:' &&
        targetUrl.host === appEntryUrl.host &&
        targetUrl.pathname === appEntryUrl.pathname
      );
    } catch {
      return false;
    }
  }

  // 阻止应用框架本身被导航到外部页面
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (isAppUrl(targetUrl)) return;
    event.preventDefault();
    openExternalIfWeb(targetUrl);
  });

  // 阻止 window.open / target=_blank 创建新窗口，外链交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalIfWeb(url);
    return { action: 'deny' };
  });
}

function configureContentSecurityPolicy(win: BrowserWindow): void {
  if (process.env.VITE_DEV_SERVER_URL) return;

  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' http: https:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

function openExternalIfWeb(target: string): void {
  try {
    const protocol = new URL(target).protocol;
    if (protocol === 'http:' || protocol === 'https:') {
      void shell.openExternal(target);
    }
  } catch {
    // 非法 URL 直接忽略
  }
}
