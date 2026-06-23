import { describe, it, expect } from 'vitest'
import { buildRequest, type RequestBuildOptions } from '@/core/requestRuntime'
import type { ApiItem } from '@/core/types'

function makeApi(overrides: Partial<ApiItem> = {}): ApiItem {
  return {
    id: 'GET:/users/{id}',
    tag: 'Users',
    method: 'GET',
    path: '/users/{id}',
    summary: 'Get user',
    description: '',
    parameters: [
      { name: 'id', in: 'path', required: true, description: 'User ID', schema: { type: 'string' } },
      { name: 'page', in: 'query', required: false, description: 'Page number', schema: { type: 'integer' } },
    ],
    responses: [],
    ...overrides,
  }
}

function makeOpts(overrides: Partial<RequestBuildOptions> = {}): RequestBuildOptions {
  return {
    servers: [{ url: 'http://localhost:8080' }],
    token: '',
    pathParams: { id: '42' },
    queryParams: {},
    headers: {},
    body: '',
    ...overrides,
  }
}

describe('buildRequest', () => {
  it('builds a simple GET request with path param', () => {
    const api = makeApi()
    const opts = makeOpts()
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(true)
    expect(result.config!.url).toBe('http://localhost:8080/users/42')
    expect(result.config!.method).toBe('GET')
  })

  it('appends query params', () => {
    const api = makeApi()
    const opts = makeOpts({ queryParams: { page: '2', size: '10' } })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(true)
    expect(result.config!.url).toContain('?page=2&size=10')
  })

  it('injects Bearer token into headers', () => {
    const api = makeApi()
    const opts = makeOpts({ token: 'abc123' })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(true)
    expect(result.config!.headers['Authorization']).toBe('Bearer abc123')
  })

  it('rejects missing path param', () => {
    const api = makeApi()
    const opts = makeOpts({ pathParams: { id: '' } })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(false)
    expect(result.error!.type).toBe('missing_path_param')
    expect(result.error!.param).toBe('id')
  })

  it('rejects invalid JSON body', () => {
    const api = makeApi({ method: 'POST' })
    const opts = makeOpts({ body: '{broken' })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(false)
    expect(result.error!.type).toBe('invalid_json_body')
  })

  it('accepts valid JSON body for POST', () => {
    const api = makeApi({ method: 'POST' })
    const opts = makeOpts({ body: '{"name":"test"}' })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(true)
    expect(result.config!.body).toBe('{"name":"test"}')
  })

  it('accepts raw text body for non-JSON content types', () => {
    const api = makeApi({ method: 'POST' })
    const opts = makeOpts({
      body: 'plain text body',
      headers: { 'Content-Type': 'text/plain' },
    })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(true)
    expect(result.config!.body).toBe('plain text body')
    expect(result.config!.headers['Content-Type']).toBe('text/plain')
  })

  it('sets Content-Type header for POST', () => {
    const api = makeApi({ method: 'POST' })
    const opts = makeOpts({ body: '{"x":1}' })
    const result = buildRequest(api, opts)

    expect(result.config!.headers['Content-Type']).toBe('application/json')
  })

  it('omits Content-Type for GET', () => {
    const api = makeApi()
    const opts = makeOpts()
    const result = buildRequest(api, opts)

    expect(result.config!.headers['Content-Type']).toBeUndefined()
  })

  it('user headers override defaults', () => {
    const api = makeApi({ method: 'POST' })
    const opts = makeOpts({
      body: '{}',
      headers: { 'Content-Type': 'application/xml' },
    })
    const result = buildRequest(api, opts)

    expect(result.config!.headers['Content-Type']).toBe('application/xml')
  })

  it('handles missing servers gracefully', () => {
    const api = makeApi()
    const opts = makeOpts({ servers: undefined })
    const result = buildRequest(api, opts)

    expect(result.ok).toBe(true)
    expect(result.config!.url).toBe('/users/42')
  })

  it('normalizes slash between base and path', () => {
    const api = makeApi()
    const opts = makeOpts({ servers: [{ url: 'http://localhost:8080/' }] })
    const result = buildRequest(api, opts)

    expect(result.config!.url).toBe('http://localhost:8080/users/42')
  })
})
