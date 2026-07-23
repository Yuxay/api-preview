import { describe, it, expect } from 'vitest'
import {
  computeAffectedApis,
  refToName,
  apiKeyOf,
  buildApiRefMap,
} from '@/core/impactAnalysis'
import type { OpenApiSpec } from '@/core/types'

const SPEC: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'T', version: '1' },
  paths: {
    '/users': {
      post: {
        requestBody: {
          description: '',
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
        },
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
        },
      },
    },
    '/orders': {
      get: {
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Order' } },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        responses: { '200': { description: 'OK' } },
      },
    },
  },
  components: {
    schemas: {
      User: { type: 'object', properties: { id: { type: 'integer' } } },
      // Order 通过 items 间接引用 User
      Order: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/User' } },
        },
      },
    },
  },
}

describe('refToName', () => {
  it('extracts name from components ref', () => {
    expect(refToName('#/components/schemas/Pet')).toBe('Pet')
  })
  it('extracts name from swagger 2.0 definitions ref', () => {
    expect(refToName('#/definitions/Pet')).toBe('Pet')
  })
})

describe('buildApiRefMap', () => {
  it('maps api keys to directly referenced DTOs', () => {
    const map = buildApiRefMap(SPEC)
    expect([...(map.get(apiKeyOf('post', '/users')) || [])]).toEqual(['User'])
    expect([...(map.get(apiKeyOf('get', '/orders')) || [])]).toEqual(['Order'])
    expect([...(map.get(apiKeyOf('get', '/health')) || [])]).toEqual([])
  })

  it('follows path, request body, response, and parameter refs', () => {
    const spec = {
      ...SPEC,
      paths: {
        '/referenced': { $ref: '#/x-paths/referenced' },
      },
      'x-paths': {
        referenced: {
          post: {
            parameters: [{ $ref: '#/components/parameters/filter' }],
            requestBody: { $ref: '#/components/requestBodies/input' },
            responses: { '200': { $ref: '#/components/responses/output' } },
          },
        },
      },
      components: {
        ...SPEC.components,
        parameters: {
          filter: { name: 'filter', in: 'query', schema: { $ref: '#/components/schemas/Filter' } },
        },
        requestBodies: {
          input: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } },
        },
        responses: {
          output: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } },
        },
      },
    } as unknown as OpenApiSpec

    expect([...buildApiRefMap(spec).get('POST:/referenced')!]).toEqual([
      'User',
      'Order',
      'Filter',
    ])
  })
})

describe('computeAffectedApis', () => {
  it('marks API directly referencing a changed DTO', () => {
    const affected = computeAffectedApis(SPEC, ['User'])
    expect(affected.has('POST:/users')).toBe(true)
  })

  it('marks API transitively referencing a changed DTO', () => {
    // Order → items → User，改 User 时 /orders 也受影响
    const affected = computeAffectedApis(SPEC, ['User'])
    expect(affected.has('GET:/orders')).toBe(true)
  })

  it('does not mark unrelated API', () => {
    const affected = computeAffectedApis(SPEC, ['User'])
    expect(affected.has('GET:/health')).toBe(false)
  })

  it('returns empty set when no DTO changed', () => {
    expect(computeAffectedApis(SPEC, []).size).toBe(0)
  })

  it('only affects orders when Order changes (not users)', () => {
    const affected = computeAffectedApis(SPEC, ['Order'])
    expect(affected.has('GET:/orders')).toBe(true)
    expect(affected.has('POST:/users')).toBe(false)
  })
})
