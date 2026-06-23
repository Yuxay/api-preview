import type { ApiSchema } from './types'

// ========== 统一表单字段描述 ==========
export interface FormField {
  key: string
  label: string
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
  required: boolean
  value: unknown
  description: string
  format?: string // date-time, date, email, etc.
  enum?: unknown[] // 枚举值
  children?: FormField[] // object/array 子字段
  itemSchema?: ApiSchema // array item schema
  collapsed: boolean // UI 折叠状态
}

// ========== Schema → FormField[] ==========

/**
 * 将 OpenAPI requestBody schema 转换为表单字段数组
 */
export function schemaToFormFields(
  schema: ApiSchema,
  requiredFields: string[] = []
): FormField[] {
  const type = schema.type || 'object'

  // Object → 递归展开 properties
  if (type === 'object' && schema.properties) {
    return Object.entries(schema.properties).map(([key, propSchema]) => {
      const isRequired = requiredFields.includes(key)
      const childType = propSchema.type || 'string'

      return {
        key,
        label: key,
        type: mapOpenApiType(childType),
        required: isRequired,
        value: generateFieldValue(propSchema),
        description: propSchema.description || '',
        format: propSchema.format,
        enum: propSchema.enum,
        children:
          childType === 'object' && propSchema.properties
            ? schemaToFormFields(propSchema, propSchema.required || [])
            : undefined,
        itemSchema: childType === 'array' ? propSchema.items : undefined,
        collapsed: childType === 'object' || childType === 'array',
      } satisfies FormField
    })
  }

  // Array → 单项字段
  if (type === 'array') {
    return [
      {
        key: 'items',
        label: 'items',
        type: 'array',
        required: requiredFields.includes('items'),
        value: [],
        description: schema.description || '',
        itemSchema: schema.items,
        collapsed: true,
      } satisfies FormField,
    ]
  }

  // Scalar → 单个字段
  return [
    {
      key: 'value',
      label: 'value',
      type: mapOpenApiType(type),
      required: requiredFields.includes('value'),
      value: generateFieldValue(schema),
      description: schema.description || '',
      format: schema.format,
      enum: schema.enum,
      collapsed: false,
    },
  ]
}

// ========== FormField[] → JSON Object ==========

/**
 * 将表单字段树还原为 JSON 对象（用于发送请求）
 */
export function formFieldsToBody(fields: FormField[]): unknown {
  // 如果是 object type 的 fields 数组，构建对象
  const result: Record<string, unknown> = {}
  let allScalar = true

  for (const field of fields) {
    const val = fieldToValue(field)
    // 跳过空值（非必填且未填写的）
    if (!field.required && isEmpty(val)) continue
    result[field.key] = val

    // 检查是否有非标量类型的 key
    if (field.key !== 'value' && field.key !== 'items') {
      allScalar = false
    }
  }

  // 如果只有一个 'value' key（标量 schema），直接返回值
  if (allScalar && fields.length === 1 && 'value' in result) {
    return result.value
  }

  // 如果根级 schema 是数组，直接返回数组本身而不是 { items: [...] }
  if (allScalar && fields.length === 1 && 'items' in result) {
    return result.items
  }

  return result
}

function fieldToValue(field: FormField): unknown {
  switch (field.type) {
    case 'object':
      if (field.children && field.children.length > 0) {
        return formFieldsToBody(field.children)
      }
      return field.value ?? {}

    case 'array':
      if (Array.isArray(field.value)) {
        return field.value
      }
      // 如果是字符串（JSON 模式下填写），尝试解析
      if (typeof field.value === 'string') {
        try {
          return JSON.parse(field.value)
        } catch {
          return []
        }
      }
      return []

    case 'number':
    case 'integer':
      if (field.value === '' || field.value === undefined) return field.required ? 0 : undefined
      return field.type === 'integer'
        ? parseInt(String(field.value), 10) || 0
        : parseFloat(String(field.value)) || 0

    case 'boolean':
      return Boolean(field.value)

    case 'string':
    default:
      if (field.value === undefined) return field.required ? '' : undefined
      return String(field.value)
  }
}

function isEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return true
  if (val === '') return true
  if (typeof val === 'object' && Object.keys(val as object).length === 0) return true
  return false
}

// ========== 默认值生成 ==========

/**
 * 按优先级生成字段默认值：example > default > enum[0] > type-fallback
 */
export function generateFieldValue(schema: ApiSchema): unknown {
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum && schema.enum.length > 0) return schema.enum[0]

  return fallbackByType(schema.type, schema.format)
}

function fallbackByType(type?: string, format?: string): unknown {
  switch (type) {
    case 'string':
      if (format === 'date-time') return '2024-01-01T00:00:00Z'
      if (format === 'date') return '2024-01-01'
      if (format === 'email') return 'user@example.com'
      if (format === 'uri') return 'https://example.com'
      return ''
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      return {}
    default:
      return ''
  }
}

// ========== 辅助 ==========

function mapOpenApiType(openApiType: string): FormField['type'] {
  switch (openApiType) {
    case 'integer':
      return 'integer'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'array':
      return 'array'
    case 'object':
      return 'object'
    default:
      return 'string'
  }
}
