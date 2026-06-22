import { describe, it, expect } from 'vitest'
import { buildApiId, buildSourceId, normalizeSourceUrl } from '@/services/swaggerMultiLoader'

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
})

describe('buildApiId', () => {
  it('includes source id to avoid cross-source collisions', () => {
    expect(buildApiId('src-a', 'get', '/users/{id}')).toBe('src-a:GET:/users/{id}')
    expect(buildApiId('src-b', 'get', '/users/{id}')).toBe('src-b:GET:/users/{id}')
  })
})
