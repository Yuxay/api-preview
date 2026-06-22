import { describe, it, expect } from 'vitest'
import {
  generateApiContext,
  buildApiExportEntry,
  schemaToTsType,
  schemaToExample,
} from '@/core/aiContextGenerator'
import type { ApiItem } from '@/core/types'

const USER_API: ApiItem = {
  id: 'POST:/users/{id}',
  tag: 'users',
  method: 'POST',
  path: '/users/{id}',
  summary: '更新用户',
  description: '根据 ID 更新用户信息',
  operationId: 'updateUser',
  sourceId: 'src-1',
  sourceName: 'Main',
  security: [{ bearer: [] }],
  parameters: [
    { name: 'id', in: 'path', required: true, description: '用户 ID', schema: { type: 'integer' } },
    { name: 'verbose', in: 'query', required: false, description: '详细模式', schema: { type: 'boolean' } },
  ],
  requestBody: {
    description: '',
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', description: '姓名' },
            age: { type: 'integer' },
          },
        },
      },
    },
  },
  responses: [
    {
      code: '200',
      description: 'OK',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  ],
}

describe('schemaToTsType', () => {
  it('builds an interface body for objects with optional markers', () => {
    const ts = schemaToTsType({
      type: 'object',
      required: ['name'],
      properties: { name: { type: 'string' }, age: { type: 'integer' } },
    })
    expect(ts).toContain('name: string;')
    expect(ts).toContain('age?: number;')
  })

  it('renders arrays and enums', () => {
    expect(schemaToTsType({ type: 'array', items: { type: 'string' } })).toBe('string[]')
    expect(schemaToTsType({ type: 'string', enum: ['a', 'b'] })).toBe('"a" | "b"')
  })
})

describe('schemaToExample', () => {
  it('prefers explicit example then type fallback', () => {
    expect(schemaToExample({ type: 'string', example: 'hi' })).toBe('hi')
    const obj = schemaToExample({
      type: 'object',
      properties: { a: { type: 'integer' }, b: { type: 'boolean' } },
    })
    expect(obj).toEqual({ a: 0, b: false })
  })
})

describe('buildApiExportEntry', () => {
  it('captures url, params, body and responses', () => {
    const entry = buildApiExportEntry(USER_API, { baseUrlMap: { 'src-1': 'https://api.test' } })
    expect(entry.fullUrl).toBe('https://api.test/users/{id}')
    expect(entry.secured).toBe(true)
    expect(entry.parameters.path).toHaveLength(1)
    expect(entry.parameters.query).toHaveLength(1)
    expect(entry.requestBody?.required).toBe(true)
    expect(entry.responses[0].code).toBe('200')
  })
})

describe('generateApiContext', () => {
  it('produces markdown with key sections', () => {
    const md = generateApiContext([USER_API], 'markdown', {
      baseUrlMap: { 'src-1': 'https://api.test' },
    })
    expect(md).toContain('## POST /users/{id}')
    expect(md).toContain('https://api.test/users/{id}')
    expect(md).toContain('### 请求体 (application/json)')
    expect(md).toContain('interface RequestBody')
    expect(md).toContain('### 响应')
  })

  it('produces valid JSON', () => {
    const json = generateApiContext([USER_API], 'json')
    const parsed = JSON.parse(json)
    expect(parsed.count).toBe(1)
    expect(parsed.apis[0].method).toBe('POST')
  })
})
