import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPersistedSources } from '@/utils/storage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('persisted source validation', () => {
  it('treats a parseable malformed source list as missing', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        getPersistedSources: vi.fn().mockResolvedValue({ sources: [] }),
      },
    })

    await expect(getPersistedSources()).resolves.toEqual([])
  })

  it('drops unsafe entries without losing valid sources', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        getPersistedSources: vi.fn().mockResolvedValue([
          { id: '../../outside', name: 'Unsafe', url: 'https://example.com/a' },
          { id: 'src-valid', name: 'Users', url: 'https://example.com/openapi.json' },
        ]),
      },
    })

    await expect(getPersistedSources()).resolves.toEqual([
      { id: 'src-valid', name: 'Users', url: 'https://example.com/openapi.json' },
    ])
  })
})
