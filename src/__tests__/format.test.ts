import { describe, it, expect } from 'vitest'
import { prettyJson, tryParseJson, formatResponseTime, getMethodColor } from '@/utils/format'

describe('prettyJson', () => {
  it('formats a valid object with 2-space indent', () => {
    expect(prettyJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('returns string for non-JSON values', () => {
    expect(prettyJson(undefined)).toBe('undefined')
    expect(prettyJson(Symbol('test'))).toBe('Symbol(test)')
  })

  it('handles circular reference by falling back to String()', () => {
    const obj: any = {}
    obj.self = obj
    // JSON.stringify throws on circular, prettyJson catches and returns String(obj)
    const result = prettyJson(obj)
    expect(typeof result).toBe('string')
  })
})

describe('tryParseJson', () => {
  it('parses valid JSON', () => {
    const result = tryParseJson('{"a":1}')
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ a: 1 })
  })

  it('returns error for invalid JSON', () => {
    const result = tryParseJson('{broken')
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('returns raw string in data on parse failure', () => {
    const result = tryParseJson('raw text')
    expect(result.data).toBe('raw text')
  })

  it('handles empty string', () => {
    const result = tryParseJson('')
    expect(result.ok).toBe(false)
  })
})

describe('formatResponseTime', () => {
  it('formats < 1000ms as ms', () => {
    expect(formatResponseTime(500)).toBe('500ms')
  })

  it('formats >= 1000ms as seconds', () => {
    expect(formatResponseTime(1500)).toBe('1.50s')
  })

  it('handles 0', () => {
    expect(formatResponseTime(0)).toBe('0ms')
  })
})

describe('getMethodColor', () => {
  it('returns GET color for GET', () => {
    expect(getMethodColor('GET')).toContain('text-green')
    expect(getMethodColor('get')).toContain('text-green')
  })

  it('returns POST color for POST', () => {
    expect(getMethodColor('POST')).toContain('text-blue')
  })

  it('returns DELETE color for DELETE', () => {
    expect(getMethodColor('DELETE')).toContain('text-red')
  })

  it('defaults to GET color for unknown methods', () => {
    expect(getMethodColor('PURGE')).toContain('text-green')
  })
})
