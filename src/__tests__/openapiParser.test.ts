import { describe, it, expect } from 'vitest'
import { parseOpenApiSpec, extractPathParams, groupByTag } from '@/core/openapiParser'
import type { OpenApiSpec } from '@/core/types'

const MINIMAL_SPEC: OpenApiSpec = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {},
}

describe('extractPathParams', () => {
  it('extracts single param', () => {
    expect(extractPathParams('/users/{id}')).toEqual(['id'])
  })

  it('extracts multiple params', () => {
    expect(extractPathParams('/users/{userId}/posts/{postId}')).toEqual(['userId', 'postId'])
  })

  it('returns empty array when no params', () => {
    expect(extractPathParams('/users')).toEqual([])
  })
})

describe('parseOpenApiSpec', () => {
  it('parses a simple GET path', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    }
    const apis = parseOpenApiSpec(spec)
    expect(apis).toHaveLength(1)
    expect(apis[0].method).toBe('GET')
    expect(apis[0].path).toBe('/users')
    expect(apis[0].summary).toBe('List users')
  })

  it('parses multiple methods on same path', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/users': {
          get: { responses: { '200': { description: 'OK' } } },
          post: { responses: { '201': { description: 'Created' } } },
        },
      },
    }
    const apis = parseOpenApiSpec(spec)
    expect(apis).toHaveLength(2)
    expect(apis.map((a) => a.method).sort()).toEqual(['GET', 'POST'])
  })

  it('assigns first tag from operation.tags', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/users': {
          get: {
            tags: ['Users'],
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    }
    const apis = parseOpenApiSpec(spec)
    expect(apis[0].tag).toBe('Users')
  })

  it('defaults tag to "default" when no tags', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/health': {
          get: { responses: { '200': { description: 'OK' } } },
        },
      },
    }
    const apis = parseOpenApiSpec(spec)
    expect(apis[0].tag).toBe('default')
  })

  it('merges path-level parameters into operations', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/items': {
          parameters: [
            {
              name: 'tenant',
              in: 'header',
              required: true,
              description: '租户ID',
              schema: { type: 'string' },
            },
          ],
          get: {
            parameters: [
              {
                name: 'page',
                in: 'query',
                required: false,
                description: '页码',
                schema: { type: 'integer' },
              },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      } as any,
    }
    const apis = parseOpenApiSpec(spec)
    const params = apis[0].parameters
    expect(params.find((p) => p.name === 'tenant' && p.in === 'header')).toBeTruthy()
    expect(params.find((p) => p.name === 'page' && p.in === 'query')).toBeTruthy()
  })

  it('operation-level parameter overrides path-level with same name+in', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/items': {
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'path-level',
              schema: { type: 'string' },
            },
          ],
          get: {
            parameters: [
              {
                name: 'limit',
                in: 'query',
                required: true,
                description: 'operation-level',
                schema: { type: 'integer' },
              },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      } as any,
    }
    const apis = parseOpenApiSpec(spec)
    const limit = apis[0].parameters.filter((p) => p.name === 'limit' && p.in === 'query')
    expect(limit).toHaveLength(1)
    expect(limit[0].description).toBe('operation-level')
    expect(limit[0].required).toBe(true)
  })

  it('auto-extracts path params not in operation.parameters', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      paths: {
        '/users/{id}': {
          get: { responses: { '200': { description: 'OK' } } },
        },
      },
    }
    const apis = parseOpenApiSpec(spec)
    const pathParams = apis[0].parameters.filter((p) => p.in === 'path')
    expect(pathParams).toHaveLength(1)
    expect(pathParams[0].name).toBe('id')
    expect(pathParams[0].required).toBe(true)
  })

  it('resolves parameter refs from components', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      components: {
        parameters: {
          UserId: {
            name: 'id',
            in: 'path',
            required: true,
            description: '用户 ID',
            schema: { type: 'string' },
          },
        },
      },
      paths: {
        '/users/{id}': {
          get: {
            parameters: [{ $ref: '#/components/parameters/UserId' }] as any,
            responses: { '200': { description: 'OK' } },
          },
        },
      } as any,
    }

    const apis = parseOpenApiSpec(spec)
    expect(apis[0].parameters).toHaveLength(1)
    expect(apis[0].parameters[0]).toMatchObject({
      name: 'id',
      in: 'path',
      required: true,
      description: '用户 ID',
    })
  })

  it('merges allOf object properties for parameter schemas', () => {
    const spec: OpenApiSpec = {
      ...MINIMAL_SPEC,
      components: {
        schemas: {
          BaseFilter: {
            type: 'object',
            required: ['keyword'],
            properties: {
              keyword: { type: 'string' },
            },
          },
          RangeFilter: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
            },
          },
        },
      },
      paths: {
        '/reports': {
          get: {
            parameters: [
              {
                name: 'filter',
                in: 'query',
                required: false,
                description: '筛选条件',
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/BaseFilter' },
                    { $ref: '#/components/schemas/RangeFilter' },
                  ],
                },
              },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      } as any,
    }

    const apis = parseOpenApiSpec(spec)
    expect(apis[0].parameters[0].schema.properties).toMatchObject({
      keyword: { type: 'string' },
      page: { type: 'integer' },
    })
    expect(apis[0].parameters[0].schema.required).toEqual(['keyword'])
  })

  it('normalizes Swagger 2.0 body parameters and response schemas', () => {
    const spec: OpenApiSpec = {
      swagger: '2.0',
      info: { title: 'Legacy API', version: '1.0.0' },
      consumes: ['application/json'],
      produces: ['application/json'],
      paths: {
        '/pets': {
          post: {
            parameters: [
              {
                name: 'body',
                in: 'body',
                required: true,
                description: 'Pet payload',
                schema: { $ref: '#/definitions/Pet' },
              },
              {
                name: 'limit',
                in: 'query',
                required: false,
                description: '',
                type: 'integer',
              },
            ] as any,
            responses: {
              '200': {
                description: 'OK',
                schema: { $ref: '#/definitions/Pet' },
              },
            },
          },
        },
      },
      definitions: {
        Pet: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      },
    }

    const [api] = parseOpenApiSpec(spec)
    expect(api.parameters).toHaveLength(1)
    expect(api.parameters[0]).toMatchObject({ name: 'limit', schema: { type: 'integer' } })
    expect(api.requestBody?.required).toBe(true)
    expect(api.requestBody?.content['application/json'].schema.properties).toHaveProperty('name')
    expect(api.responses[0].content?.['application/json'].schema.properties).toHaveProperty('name')
  })
})

describe('groupByTag', () => {
  it('groups APIs by tag', () => {
    const apis = [
      { id: '1', tag: 'Users', method: 'GET', path: '/users', summary: '', description: '', parameters: [], responses: [] },
      { id: '2', tag: 'Users', method: 'POST', path: '/users', summary: '', description: '', parameters: [], responses: [] },
      { id: '3', tag: 'Auth', method: 'POST', path: '/login', summary: '', description: '', parameters: [], responses: [] },
    ]
    const groups = groupByTag(apis as any)
    expect(groups.size).toBe(2)
    expect(groups.get('Users')?.length).toBe(2)
    expect(groups.get('Auth')?.length).toBe(1)
  })

  it('sorts tags alphabetically', () => {
    const apis = [
      { id: '1', tag: 'Zebra', method: 'GET', path: '/z', summary: '', description: '', parameters: [], responses: [] },
      { id: '2', tag: 'Alpha', method: 'GET', path: '/a', summary: '', description: '', parameters: [], responses: [] },
    ]
    const groups = groupByTag(apis as any)
    const keys = [...groups.keys()]
    expect(keys).toEqual(['Alpha', 'Zebra'])
  })
})
