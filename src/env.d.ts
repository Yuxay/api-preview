/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ElectronAPI {
  fetchSwagger: (
    url: string,
    requestId?: string,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  cancelSwaggerFetch: (requestId: string) => Promise<{ success: boolean }>;
  proxyRequest: (options: ProxyRequestOptions) => Promise<ProxyResponse>;
  getStoredUrls: () => Promise<{ name: string; url: string }[]>;
  saveUrl: (entry: { name: string; url: string }) => Promise<void>;
  getPersistedSources: () => Promise<{ id: string; name: string; url: string }[]>;
  savePersistedSources: (sources: { id: string; name: string; url: string }[]) => Promise<void>;
  getToken: () => Promise<string>;
  saveToken: (token: string) => Promise<void>;
  getSnapshot: (sourceId: string) => Promise<unknown>;
  saveSnapshot: (sourceId: string, data: unknown) => Promise<void>;
  listSnapshots: (sourceId: string) => Promise<number[]>;
  saveCachedSource: (sourceId: string, data: unknown) => Promise<void>;
  getCachedSource: (sourceId: string) => Promise<unknown>;
  getAllCachedSources: () => Promise<unknown[]>;
  removeCachedSource: (sourceId: string) => Promise<void>;
  getUpdaterState: () => Promise<AppUpdaterState>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<AppUpdaterActionResult>;
  downloadUpdate: () => Promise<AppUpdaterActionResult>;
  quitAndInstallUpdate: () => Promise<AppUpdaterActionResult>;
  onUpdaterStateChanged: (listener: (state: AppUpdaterState) => void) => void;
}

type UpdaterPhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

type UpdaterCheckSource = 'auto' | 'manual' | null;

interface AppUpdaterState {
  supported: boolean;
  phase: UpdaterPhase;
  lastCheckSource: UpdaterCheckSource;
  currentVersion: string;
  availableVersion?: string;
  progress: number;
  error?: string;
}

interface AppUpdaterActionResult {
  success: boolean;
  state: AppUpdaterState;
  error?: string;
}

interface ProxyRequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ProxyResponse {
  success: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyEncoding?: 'text' | 'base64';
  contentType?: string;
  bodySize?: number;
  duration: number;
  error?: string;
}

interface Window {
  electronAPI: ElectronAPI;
}
