import { describe, expect, it } from 'vitest'
import { formFieldsToBody, schemaToFormFields } from '@/core/schemaFormEngine'

describe('schemaFormEngine', () => {
  it('serializes root array schemas as arrays instead of objects', () => {
    const fields = schemaToFormFields({
      type: 'array',
      items: { type: 'string' },
    })

    fields[0].value = '["a","b"]'

    expect(formFieldsToBody(fields)).toEqual(['a', 'b'])
  })
})
