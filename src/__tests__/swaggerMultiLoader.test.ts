import { describe, it, expect, vi } from 'vitest'
import { assertValidSourceId } from '@/core/sourceId'
import { buildApiId, buildSourceId, loadSources, normalizeSourceUrl } from '@/services/swaggerMultiLoader'

describe('normalizeSourceUrl', () => {
  it('trims whitespace and removes trailing slash', () => {
    expect(normalizeSourceUrl('  http://localhost:8080/v3/api-docs/  ')).toBe(
      'http://localhost:8080/v3/api-docs'
    )
  })

  it('preserves query string while normalizing path', () => {
    expect(normalizeSourceUrl('http://localhost:8080/v3/api-docs/?group=user')).toBe(
      'http://localhost:8080/v3/api-docs?group=user'
    )
  })
})

describe('buildSourceId', () => {
  it('returns the same id for equivalent URLs', () => {
    expect(buildSourceId('http://localhost:8080/v3/api-docs')).toBe(
      buildSourceId('http://localhost:8080/v3/api-docs/')
    )
  })

  it('returns different ids for different URLs', () => {
    expect(buildSourceId('http://localhost:8080/v3/api-docs/a')).not.toBe(
      buildSourceId('http://localhost:8080/v3/api-docs/b')
    )
  })

  it('only accepts generated source ids for storage paths', () => {
    expect(() => assertValidSourceId(buildSourceId('https://example.com/openapi.json'))).not.toThrow()
    expect(() => assertValidSourceId('..\\..\\outside')).toThrow('Invalid source id')
  })
})

describe('buildApiId', () => {
  it('includes source id to avoid cross-source collisions', () => {
    expect(buildApiId('src-a', 'get', '/users/{id}')).toBe('src-a:GET:/users/{id}')
    expect(buildApiId('src-b', 'get', '/users/{id}')).toBe('src-b:GET:/users/{id}')
  })
})

describe('Swagger 2.0 loading', () => {
  it('derives a server URL from schemes, host and basePath', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        fetchSwagger: vi.fn().mockResolvedValue({
          success: true,
          data: {
            swagger: '2.0',
            info: { title: 'Legacy', version: '1' },
            schemes: ['https'],
            host: 'api.example.com',
            basePath: '/v1',
            paths: {},
          },
        }),
        saveUrl: vi.fn(),
      },
    })

    try {
      const result = await loadSources([
        { id: 'src-legacy', name: 'Legacy', url: 'http://docs.example.com/swagger.json' },
      ])
      expect(result.sources[0].spec.servers).toEqual([
        { url: 'https://api.example.com/v1' },
      ])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
