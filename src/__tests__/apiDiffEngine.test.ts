import { describe, it, expect } from 'vitest'
import { diffApis, diffSchemas } from '@/core/apiDiffEngine'
import type { ApiItem, ApiSchema } from '@/core/types'

function makeApi(partial: Partial<ApiItem> & { method: string; path: string }): ApiItem {
  return {
    id: `${partial.method}:${partial.path}`,
    tag: 'default',
    summary: '',
    description: '',
    parameters: [],
    responses: [],
    ...partial,
  }
}

describe('diffSchemas', () => {
  it('detects added schema', () => {
    const oldS: Record<string, ApiSchema> = {}
    const newS: Record<string, ApiSchema> = { User: { type: 'object' } }
    const result = diffSchemas(oldS, newS)
    expect(result.find((s) => s.name === 'User')?.type).toBe('added')
  })

  it('detects removed schema', () => {
    const oldS: Record<string, ApiSchema> = { User: { type: 'object' } }
    const newS: Record<string, ApiSchema> = {}
    const result = diffSchemas(oldS, newS)
    expect(result.find((s) => s.name === 'User')?.type).toBe('removed')
  })

  it('detects added field on a schema', () => {
    const oldS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { id: { type: 'integer' } } },
    }
    const newS: Record<string, ApiSchema> = {
      User: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' } },
      },
    }
    const result = diffSchemas(oldS, newS)
    const user = result.find((s) => s.name === 'User')
    expect(user?.type).toBe('modified')
    expect(user?.changes?.some((c) => c.path === 'User.name' && c.newValue === 'added')).toBe(true)
  })

  it('detects removed field on a schema', () => {
    const oldS: Record<string, ApiSchema> = {
      User: {
        type: 'object',
        properties: { id: { type: 'integer' }, name: { type: 'string' } },
      },
    }
    const newS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { id: { type: 'integer' } } },
    }
    const result = diffSchemas(oldS, newS)
    const user = result.find((s) => s.name === 'User')
    expect(user?.type).toBe('modified')
    expect(user?.changes?.some((c) => c.path === 'User.name' && c.newValue === null)).toBe(true)
  })

  it('detects field type change', () => {
    const oldS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { age: { type: 'string' } } },
    }
    const newS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { age: { type: 'integer' } } },
    }
    const result = diffSchemas(oldS, newS)
    const user = result.find((s) => s.name === 'User')
    expect(user?.type).toBe('modified')
    const change = user?.changes?.find((c) => c.path === 'User.age')
    expect(change?.oldValue).toBe('string')
    expect(change?.newValue).toBe('integer')
  })

  it('detects required change (added)', () => {
    const oldS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { name: { type: 'string' } }, required: [] },
    }
    const newS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    }
    const result = diffSchemas(oldS, newS)
    const user = result.find((s) => s.name === 'User')
    expect(user?.type).toBe('modified')
    expect(
      user?.changes?.some((c) => c.path === 'User.required' && c.newValue === '+name')
    ).toBe(true)
  })

  it('detects required change (removed)', () => {
    const oldS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    }
    const newS: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { name: { type: 'string' } }, required: [] },
    }
    const result = diffSchemas(oldS, newS)
    const user = result.find((s) => s.name === 'User')
    expect(user?.type).toBe('modified')
    expect(
      user?.changes?.some((c) => c.path === 'User.required' && c.oldValue === 'name')
    ).toBe(true)
  })

  it('marks unchanged schema', () => {
    const schema: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { id: { type: 'integer' } } },
    }
    const result = diffSchemas(schema, { ...schema })
    expect(result.find((s) => s.name === 'User')?.type).toBe('unchanged')
  })

  it('handles undefined inputs gracefully', () => {
    expect(diffSchemas(undefined, undefined)).toEqual([])
  })
})

describe('diffApis with schemas', () => {
  const apis = [makeApi({ method: 'GET', path: '/users' })]

  it('populates schemas field with non-unchanged items', () => {
    const oldSchemas: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { id: { type: 'integer' } } },
    }
    const newSchemas: Record<string, ApiSchema> = {
      User: { type: 'object', properties: { id: { type: 'string' } } },
      Order: { type: 'object' },
    }
    const diff = diffApis('s1', 'Source 1', apis, apis, undefined, oldSchemas, newSchemas)
    // 应包含 User(modified) 与 Order(added)，不含 unchanged
    expect(diff.schemas.map((s) => `${s.name}:${s.type}`).sort()).toEqual([
      'Order:added',
      'User:modified',
    ])
  })

  it('returns empty schemas when not provided', () => {
    const diff = diffApis('s1', 'Source 1', apis, apis)
    expect(diff.schemas).toEqual([])
  })

  it('still detects api-level changes alongside schema changes', () => {
    const oldApis = [makeApi({ method: 'GET', path: '/users', summary: 'old' })]
    const newApis = [
      makeApi({ method: 'GET', path: '/users', summary: 'new' }),
      makeApi({ method: 'POST', path: '/users' }),
    ]
    const diff = diffApis('s1', 'Source 1', oldApis, newApis)
    expect(diff.summary.added).toBe(1)
    expect(diff.summary.modified).toBe(1)
  })

  it('detects authentication requirement changes', () => {
    const oldApis = [makeApi({ method: 'GET', path: '/users' })]
    const newApis = [
      makeApi({ method: 'GET', path: '/users', security: [{ bearerAuth: [] }] }),
    ]

    const diff = diffApis('s1', 'Source 1', oldApis, newApis)
    expect(diff.summary.modified).toBe(1)
    expect(diff.apis[0].changes).toContainEqual({
      path: 'security',
      oldValue: undefined,
      newValue: [{ bearerAuth: [] }],
    })
  })
})
