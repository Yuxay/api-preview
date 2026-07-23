import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { SwaggerSource } from '@/core/types'
import type { CachedSource } from '@/services/swaggerCache'

const mocks = vi.hoisted(() => ({
  loadSources: vi.fn(),
  saveCachedSource: vi.fn(),
  getCachedSource: vi.fn(),
  getAllCachedSources: vi.fn(),
  removeCachedSource: vi.fn(),
  getPersistedSources: vi.fn(),
  savePersistedSources: vi.fn(),
}))

vi.mock('@/services/swaggerMultiLoader', () => ({
  loadSources: mocks.loadSources,
  deriveSourceName: (url: string) => url,
  buildSourceId: () => 'src-valid',
}))

vi.mock('@/services/swaggerSnapshot', () => ({
  saveSnapshot: vi.fn(),
  getSnapshot: vi.fn().mockResolvedValue(null),
  extractSchemas: vi.fn().mockReturnValue({}),
}))

vi.mock('@/services/swaggerCache', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/swaggerCache')>(),
  saveCachedSource: mocks.saveCachedSource,
  getCachedSource: mocks.getCachedSource,
  getAllCachedSources: mocks.getAllCachedSources,
  removeCachedSource: mocks.removeCachedSource,
}))

vi.mock('@/utils/storage', () => ({
  getUiState: (_key: string, fallback: unknown) => fallback,
  saveUiState: vi.fn(),
  saveUrl: vi.fn().mockResolvedValue(undefined),
  getPersistedSources: mocks.getPersistedSources,
  savePersistedSources: mocks.savePersistedSources,
}))

import { useSwagger } from '@/composables/useSwagger'

const cachedSource: CachedSource = {
  sourceId: 'src-valid',
  sourceName: 'Users',
  url: 'https://example.com/openapi.json',
  spec: {
    openapi: '3.0.0',
    info: { title: 'Users', version: '1.0.0' },
    paths: {},
  },
  apis: [{
    id: 'src-valid:GET:/users',
    tag: 'Users',
    method: 'GET',
    path: '/users',
    summary: 'List users',
    description: '',
    parameters: [],
    responses: [],
    sourceId: 'src-valid',
    sourceName: 'Users',
  }],
  timestamp: 1,
}

function failedSource(name = 'Users'): SwaggerSource {
  return {
    id: 'src-valid',
    name,
    url: cachedSource.url,
    spec: {
      openapi: 'unknown',
      info: { title: name, version: '' },
      paths: {},
    },
    apis: [],
    status: 'error',
    error: 'offline',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPersistedSources.mockResolvedValue([])
  mocks.getAllCachedSources.mockResolvedValue([cachedSource])
  mocks.getCachedSource.mockResolvedValue(cachedSource)
  mocks.saveCachedSource.mockResolvedValue(undefined)
  mocks.removeCachedSource.mockResolvedValue(undefined)
  mocks.savePersistedSources.mockResolvedValue(undefined)
  mocks.loadSources.mockResolvedValue({
    sources: [failedSource()],
    allApis: [],
    tagGroups: new Map(),
    errors: ['Users: offline'],
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('offline source lifecycle', () => {
  it('does not let a cancelled load clear a newer loading state', async () => {
    let finishFirst!: (value: any) => void
    let finishSecond!: (value: any) => void
    mocks.loadSources
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { finishSecond = resolve }))
    vi.stubGlobal('window', {
      electronAPI: { cancelSwaggerFetch: vi.fn().mockResolvedValue({ success: true }) },
    })

    const scope = effectScope()
    const state = scope.run(() => useSwagger())!
    const firstLoad = state.addSource('First', 'https://example.com/first.json')
    await state.cancelLoading()
    const secondLoad = state.addSource('Second', 'https://example.com/second.json')

    finishFirst({ sources: [], allApis: [], tagGroups: new Map(), errors: [] })
    await firstLoad
    expect(state.loading.value).toBe(true)

    finishSecond({ sources: [], allApis: [], tagGroups: new Map(), errors: [] })
    await secondLoad
    expect(state.loading.value).toBe(false)
    scope.stop()
  })

  it('does not let a cancelled cache fallback overwrite a newer load', async () => {
    let finishFallback!: (value: CachedSource) => void
    mocks.getCachedSource.mockImplementationOnce(
      () => new Promise<CachedSource>((resolve) => { finishFallback = resolve }),
    )
    const secondSource: SwaggerSource = {
      ...cachedSource,
      id: 'src-valid',
      name: 'Second',
      status: 'loaded',
    }
    mocks.loadSources
      .mockResolvedValueOnce({
        sources: [failedSource('First')],
        allApis: [],
        tagGroups: new Map(),
        errors: ['First: offline'],
      })
      .mockResolvedValueOnce({
        sources: [secondSource],
        allApis: secondSource.apis,
        tagGroups: new Map(),
        errors: [],
      })
    vi.stubGlobal('window', {
      electronAPI: { cancelSwaggerFetch: vi.fn().mockResolvedValue({ success: true }) },
    })

    const scope = effectScope()
    const state = scope.run(() => useSwagger())!
    const firstLoad = state.addSource('First', 'https://example.com/first.json')
    await vi.waitFor(() => expect(mocks.getCachedSource).toHaveBeenCalledOnce())
    await state.cancelLoading()
    await state.addSource('Second', 'https://example.com/second.json')

    finishFallback(cachedSource)
    await firstLoad

    expect(state.sources.value).toHaveLength(1)
    expect(state.sources.value[0].name).toBe('Second')
    scope.stop()
  })

  it('reports cache write failures instead of claiming persistence', async () => {
    const loaded: SwaggerSource = {
      id: cachedSource.sourceId,
      name: cachedSource.sourceName,
      url: cachedSource.url,
      spec: cachedSource.spec,
      apis: cachedSource.apis,
      status: 'loaded',
    }
    mocks.loadSources.mockResolvedValue({
      sources: [loaded],
      allApis: loaded.apis,
      tagGroups: new Map(),
      errors: [],
    })
    mocks.saveCachedSource.mockRejectedValue(new Error('disk full'))
    const scope = effectScope()
    const state = scope.run(() => useSwagger())!

    await state.addSource('Users', cachedSource.url)

    expect(state.error.value).toBe('disk full')
    expect(mocks.savePersistedSources).not.toHaveBeenCalled()
    scope.stop()
  })

  it('rebuilds a missing source list from valid caches', async () => {
    const scope = effectScope()
    const state = scope.run(() => useSwagger())!

    await state.restoreSources()

    expect(mocks.getAllCachedSources).toHaveBeenCalledOnce()
    expect(state.sources.value[0]).toMatchObject({
      id: 'src-valid',
      name: 'Users',
      status: 'cached',
    })
    expect(state.apis.value[0].sourceName).toBe('Users')
    expect(mocks.savePersistedSources).toHaveBeenCalledWith([
      { id: 'src-valid', name: 'Users', url: cachedSource.url },
    ])
    scope.stop()
  })

  it('keeps renamed metadata in the offline cache', async () => {
    const scope = effectScope()
    const state = scope.run(() => useSwagger())!
    await state.restoreSources()
    mocks.saveCachedSource.mockClear()

    await state.renameSource('src-valid', 'Accounts')

    expect(mocks.saveCachedSource).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'src-valid', sourceName: 'Accounts' }),
    )
    scope.stop()
  })

  it('waits for cache deletion before removing the source', async () => {
    const scope = effectScope()
    const state = scope.run(() => useSwagger())!
    await state.restoreSources()

    let finishRemoval!: () => void
    mocks.removeCachedSource.mockImplementation(() => new Promise<void>((resolve) => {
      finishRemoval = resolve
    }))

    const removal = state.removeSource('src-valid')
    expect(state.sources.value).toHaveLength(1)

    finishRemoval()
    await removal

    expect(state.sources.value).toHaveLength(0)
    expect(mocks.savePersistedSources).toHaveBeenLastCalledWith([])
    scope.stop()
  })
})
