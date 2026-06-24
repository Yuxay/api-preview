import { describe, it, expect } from 'vitest'
import { parseOpenApiSpec } from '@/core/openapiParser'
import type { OpenApiSpec } from '@/core/types'

describe('parseOpenApiSpec circular schemas', () => {
  it('handles additionalProperties self-$ref without stack overflow', () => {
    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/x': {
          get: {
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Node' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Node: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    }

    expect(() => parseOpenApiSpec(spec)).not.toThrow()
    const apis = parseOpenApiSpec(spec)
    expect(apis).toHaveLength(1)
  })

  it('handles mutual $ref between schemas without stack overflow', () => {
    const spec: OpenApiSpec = {
      openapi: '3.0.0',
      info: { title: 't', version: '1' },
      paths: {
        '/x': {
          get: {
            requestBody: {
              description: '',
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/A' },
                },
              },
            },
            responses: { '200': { description: 'ok' } },
          },
        },
      },
      components: {
        schemas: {
          A: {
            type: 'object',
            properties: {
              b: { $ref: '#/components/schemas/B' },
            },
          },
          B: {
            type: 'object',
            properties: {
              a: { $ref: '#/components/schemas/A' },
            },
          },
        },
      },
    }

    expect(() => parseOpenApiSpec(spec)).not.toThrow()
  })
})
