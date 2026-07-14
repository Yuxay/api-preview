import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getAllCachedSources,
  getCachedSource,
  isCachedSource,
  type CachedSource,
} from '@/services/swaggerCache'

const validCache: CachedSource = {
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
  }],
  timestamp: 1,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('offline cache validation', () => {
  it('accepts a complete cache only for its source id', () => {
    expect(isCachedSource(validCache, 'src-valid')).toBe(true)
    expect(isCachedSource(validCache, 'src-other')).toBe(false)
  })

  it('rejects malformed and unsafe cache entries', () => {
    expect(isCachedSource({ ...validCache, apis: undefined })).toBe(false)
    expect(isCachedSource({ ...validCache, sourceId: '../../outside' })).toBe(false)
    expect(isCachedSource({ ...validCache, spec: { openapi: '3.0.0' } })).toBe(false)
  })

  it('treats a parseable malformed Electron cache as a miss', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        getCachedSource: vi.fn().mockResolvedValue({ sourceId: 'src-valid' }),
      },
    })

    await expect(getCachedSource('src-valid')).resolves.toBeNull()
  })

  it('filters malformed entries when recovering all caches', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        getAllCachedSources: vi.fn().mockResolvedValue([
          validCache,
          { sourceId: 'src-broken' },
        ]),
      },
    })

    await expect(getAllCachedSources()).resolves.toEqual([validCache])
  })
})
