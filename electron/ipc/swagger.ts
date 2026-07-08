import { ipcMain, app } from 'electron'
import { readFile, writeFile, mkdir, access, readdir, unlink } from 'fs/promises'
import { constants } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

/** 每个源最多保留的历史快照份数，超出自动清理最旧 */
const MAX_SNAPSHOTS_PER_SOURCE = 10
const SWAGGER_FETCH_TIMEOUT_MS = 30_000
const pendingSwaggerFetches = new Map<string, AbortController>()

/**
 * 仅允许 http/https 协议的网络请求，阻止 file://、ftp:// 等本地/危险协议（防 SSRF / 本地文件读取）。
 * 返回 null 表示校验通过，否则返回中文错误信息。
 */
export function validateRequestUrl(url: string): string | null {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    return `无效的地址：${url}`
  }
  if (protocol !== 'http:' && protocol !== 'https:') {
    return `不支持的协议「${protocol}」，仅允许 http/https 地址`
  }
  return null
}

export function registerIpcHandlers(): void {
  // ========== Swagger JSON 获取 ==========
  ipcMain.handle('swagger:fetch', async (_event, url: string, requestId?: string) => {
    const invalid = validateRequestUrl(url)
    if (invalid) {
      return { success: false, error: invalid }
    }
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, SWAGGER_FETCH_TIMEOUT_MS)
    if (requestId) {
      pendingSwaggerFetches.set(requestId, controller)
    }
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OpenAPI-Light-Desktop/1.0',
        },
        redirect: 'follow',
        signal: controller.signal,
      })

      const raw = await res.text()

      if (res.status !== 200) {
        return {
          success: false,
          error: `HTTP ${res.status}: ${raw.slice(0, 200)}`,
        }
      }

      const data = JSON.parse(raw)
      return { success: true, data }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.code === 'ABORT_ERR') {
        return {
          success: false,
          error: timedOut
            ? `连接超时（超过 ${SWAGGER_FETCH_TIMEOUT_MS / 1000} 秒未响应）`
            : '已取消加载',
        }
      }
      return { success: false, error: `无法连接: ${url} —— 请检查地址是否正确、网络是否可达。${err.message}` }
    } finally {
      clearTimeout(timer)
      if (requestId) {
        pendingSwaggerFetches.delete(requestId)
      }
    }
  })

  ipcMain.handle('swagger:cancel', async (_event, requestId: string) => {
    const controller = pendingSwaggerFetches.get(requestId)
    if (!controller) {
      return { success: false }
    }
    controller.abort()
    pendingSwaggerFetches.delete(requestId)
    return { success: true }
  })

  // ========== 本地持久化存储（异步 I/O） ==========
  const userDataPath = app.getPath('userData')
  const storageDir = join(userDataPath, 'storage')
  const urlsFile = join(storageDir, 'recent-urls.json')
  const tokenFile = join(storageDir, 'token.json')

  async function ensureDir(): Promise<void> {
    try {
      await access(storageDir, constants.F_OK)
    } catch {
      await mkdir(storageDir, { recursive: true })
    }
  }

  async function fileExists(file: string): Promise<boolean> {
    try {
      await access(file, constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  async function readJson<T>(file: string, fallback: T): Promise<T> {
    try {
      await ensureDir()
      if (!(await fileExists(file))) return fallback
      const raw = await readFile(file, 'utf-8')
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  }

  async function writeJson(file: string, data: unknown): Promise<void> {
    try {
      await ensureDir()
      await writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error('[openapi-light] 写入存储失败:', file, err)
    }
  }

  ipcMain.handle('storage:get-urls', async () => {
    const raw = await readJson<any[]>(urlsFile, [])
    // 兼容旧格式 string[]
    return raw.map((item: any) => {
      if (typeof item === 'string') return { name: '', url: item }
      return item
    })
  })

  ipcMain.handle('storage:save-url', async (_event, entry: { name: string; url: string }) => {
    const raw = await readJson<any[]>(urlsFile, [])
    const entries: { name: string; url: string }[] = raw.map((item: any) => {
      if (typeof item === 'string') return { name: '', url: item }
      return item
    })
    const filtered = entries.filter((e) => e.url !== entry.url)
    filtered.unshift(entry)
    await writeJson(urlsFile, filtered.slice(0, 5))
  })

  ipcMain.handle('storage:get-token', async () => {
    const data = await readJson<{ token: string }>(tokenFile, { token: '' })
    return data.token
  })

  ipcMain.handle('storage:save-token', async (_event, token: string) => {
    await writeJson(tokenFile, { token })
  })

  // ========== 来源列表持久化（重启后自动恢复） ==========
  const sourcesFile = join(storageDir, 'sources.json')

  interface PersistedSource {
    id: string
    name: string
    url: string
  }

  ipcMain.handle('storage:get-sources', async () => {
    return readJson<PersistedSource[]>(sourcesFile, [])
  })

  ipcMain.handle('storage:save-sources', async (_event, sources: PersistedSource[]) => {
    await writeJson(sourcesFile, sources)
  })

  // ========== 快照存储（用于 Diff，保留历史版本链） ==========
  const snapshotsDir = join(storageDir, 'snapshots')

  /** 某源的历史快照目录：snapshots/<sourceId>/ */
  async function sourceSnapshotDir(sourceId: string): Promise<string> {
    await ensureDir()
    const dir = join(snapshotsDir, sourceId)
    try { await access(dir, constants.F_OK) } catch { await mkdir(dir, { recursive: true }) }
    return dir
  }

  /** 旧版扁平文件路径（snapshots/<sourceId>.json），用于向后兼容读取 */
  function legacySnapshotFile(sourceId: string): string {
    return join(snapshotsDir, `${sourceId}.json`)
  }

  /** 列出某源历史快照，按时间戳降序（最新在前） */
  async function listSnapshotTimestamps(sourceId: string): Promise<number[]> {
    const dir = await sourceSnapshotDir(sourceId)
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return []
    }
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => Number(f.replace(/\.json$/, '')))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a)
  }

  // 返回「最新历史」快照（用于与当前对比）
  ipcMain.handle('storage:get-snapshot', async (_event, sourceId: string) => {
    const timestamps = await listSnapshotTimestamps(sourceId)
    if (timestamps.length > 0) {
      const dir = await sourceSnapshotDir(sourceId)
      return readJson<any>(join(dir, `${timestamps[0]}.json`), null)
    }
    // 向后兼容：迁移期读取旧扁平文件
    return readJson<any>(legacySnapshotFile(sourceId), null)
  })

  // 追加一份带时间戳的快照，并清理超出上限的最旧份
  ipcMain.handle('storage:save-snapshot', async (_event, sourceId: string, data: unknown) => {
    const dir = await sourceSnapshotDir(sourceId)
    const ts =
      data && typeof data === 'object' && typeof (data as any).timestamp === 'number'
        ? (data as any).timestamp
        : Date.now()
    await writeJson(join(dir, `${ts}.json`), data)

    // 清理最旧的，仅保留 MAX_SNAPSHOTS_PER_SOURCE 份
    const timestamps = await listSnapshotTimestamps(sourceId)
    if (timestamps.length > MAX_SNAPSHOTS_PER_SOURCE) {
      const toDelete = timestamps.slice(MAX_SNAPSHOTS_PER_SOURCE)
      for (const old of toDelete) {
        try { await unlink(join(dir, `${old}.json`)) } catch { /* 忽略 */ }
      }
    }
  })

  // 列出某源全部历史快照时间戳（最新在前）
  ipcMain.handle('storage:list-snapshots', async (_event, sourceId: string) => {
    return listSnapshotTimestamps(sourceId)
  })

  // ========== 离线缓存存储（成功加载后持久化完整源数据，服务端离线时回退使用） ==========
  const cacheDir = join(storageDir, 'cache')

  async function ensureCacheDir(): Promise<string> {
    await ensureDir()
    try { await access(cacheDir, constants.F_OK) } catch { await mkdir(cacheDir, { recursive: true }) }
    return cacheDir
  }

  ipcMain.handle('storage:save-cache', async (_event, sourceId: string, data: unknown) => {
    await ensureCacheDir()
    await writeJson(join(cacheDir, `${sourceId}.json`), data)
  })

  ipcMain.handle('storage:get-cache', async (_event, sourceId: string) => {
    return readJson<any>(join(cacheDir, `${sourceId}.json`), null)
  })

  ipcMain.handle('storage:get-all-cache', async () => {
    const dir = await ensureCacheDir()
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      return []
    }
    const results: any[] = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      const data = await readJson<any>(join(dir, f), null)
      if (data) results.push(data)
    }
    return results
  })

  ipcMain.handle('storage:remove-cache', async (_event, sourceId: string) => {
    try { await unlink(join(cacheDir, `${sourceId}.json`)) } catch { /* 忽略 */ }
  })

  // ========== 示例项目加载（仅开发/本地使用） ==========
  ipcMain.handle('example:load', async () => {
    try {
      // 使用与 window.ts 相同的方式解析路径：从 dist-electron/ 回到项目根目录
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      const examplePath = join(__dirname, '..', 'examples', 'petstore.json')
      const raw = await readFile(examplePath, 'utf-8')
      const data = JSON.parse(raw)
      return { success: true, data }
    } catch (err: any) {
      return { success: false, error: `无法加载示例项目: ${err.message}` }
    }
  })
}
