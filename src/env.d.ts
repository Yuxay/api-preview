/// <reference types="vite/client" />

interface ElectronAPI {
  fetchSwagger: (
    url: string,
    requestId?: string,
  ) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  cancelSwaggerFetch: (requestId: string) => Promise<{ success: boolean }>;
  proxyRequest: (options: ProxyRequestOptions) => Promise<ProxyResponse>;
  getStoredUrls: () => Promise<{ name: string; url: string }[]>;
  saveUrl: (entry: { name: string; url: string }) => Promise<void>;
  getToken: () => Promise<string>;
  saveToken: (token: string) => Promise<void>;
  getSnapshot: (sourceId: string) => Promise<unknown>;
  saveSnapshot: (sourceId: string, data: unknown) => Promise<void>;
  listSnapshots: (sourceId: string) => Promise<number[]>;
  loadExampleSpec: () => Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
  getUpdaterState: () => Promise<AppUpdaterState>;
  getAppVersion: () => Promise<string>;
  checkForUpdates: () => Promise<AppUpdaterActionResult>;
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

interface AppUpdaterState {
  supported: boolean;
  phase: UpdaterPhase;
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
