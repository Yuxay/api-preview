import type {
  ApiItem,
  ApiParameter,
  ApiResponse,
  OpenApiSpec,
  OperationObject,
  ApiSchema,
} from './types'

/**
 * 解析 OpenAPI 3.x 规范 JSON 为统一 ApiItem[]
 */
export function parseOpenApiSpec(spec: OpenApiSpec): ApiItem[] {
  const items: ApiItem[] = []

  const paths = spec.paths || {}
  const globalSecurity = spec.security || []

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue

    // path-level 公共参数（适用于该路径下所有操作）
    const pathLevelParams: ApiParameter[] = (pathItem.parameters || []).map((p) => ({
      ...p,
      schema: resolveSchemaRef(p.schema, spec),
    }))

    const methods: { method: string; operation: OperationObject }[] = []

    if (pathItem.get) methods.push({ method: 'GET', operation: pathItem.get })
    if (pathItem.post) methods.push({ method: 'POST', operation: pathItem.post })
    if (pathItem.put) methods.push({ method: 'PUT', operation: pathItem.put })
    if (pathItem.delete) methods.push({ method: 'DELETE', operation: pathItem.delete })
    if (pathItem.patch) methods.push({ method: 'PATCH', operation: pathItem.patch })
    if (pathItem.options) methods.push({ method: 'OPTIONS', operation: pathItem.options })
    if (pathItem.head) methods.push({ method: 'HEAD', operation: pathItem.head })

    for (const { method, operation } of methods) {
      const tag = operation.tags?.[0] || 'default'

      const operationParams: ApiParameter[] = (operation.parameters || []).map((p) => ({
        ...p,
        schema: resolveSchemaRef(p.schema, spec),
      }))

      // 合并 path-level 与 operation-level：按 in+name 去重，operation 覆盖 path
      const mergedParams = new Map<string, ApiParameter>()
      for (const p of pathLevelParams) mergedParams.set(`${p.in}:${p.name}`, p)
      for (const p of operationParams) mergedParams.set(`${p.in}:${p.name}`, p)
      const parameters: ApiParameter[] = [...mergedParams.values()]

      // 从 path 中提取路径参数（若未在 operation.parameters 中声明）
      const paramNames = extractPathParams(pathUrl)
      for (const name of paramNames) {
        if (!parameters.find((p) => p.in === 'path' && p.name === name)) {
          parameters.push({
            name,
            in: 'path',
            required: true,
            description: '',
            schema: { type: 'string' },
          })
        }
      }

      const requestBody = operation.requestBody
        ? {
            ...operation.requestBody,
            content: resolveContentRefs(operation.requestBody.content, spec),
          }
        : undefined

      const responses: ApiResponse[] = Object.entries(operation.responses || {}).map(
        ([code, resp]) => ({
          code,
          description: resp.description || '',
          content: resp.content ? resolveContentRefs(resp.content, spec) : undefined,
        })
      )

      const opSecurity = operation.security || globalSecurity

      items.push({
        id: `${method}:${pathUrl}`,
        tag,
        method,
        path: pathUrl,
        summary: operation.summary || '',
        description: operation.description || '',
        operationId: operation.operationId,
        parameters,
        requestBody,
        responses,
        security: opSecurity.length > 0 ? opSecurity : undefined,
      })
    }
  }

  return items
}

/** 提取路径中的 {paramName} 参数名 */
export function extractPathParams(path: string): string[] {
  const re = /\{(\w+)\}/g
  const names: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(path)) !== null) {
    names.push(m[1])
  }
  return names
}

/** 解析 $ref */
function resolveSchemaRef(
  schema: ApiSchema,
  spec: OpenApiSpec,
  visited: Set<string> = new Set(),
): ApiSchema {
  if (!schema) return schema

  // 先解析 $ref，然后继续递归处理解析后的 schema（解析嵌套的 $ref）
  let resolved = schema
  if (schema.$ref) {
    // 循环引用检测：已见过的 $ref 不再展开
    if (visited.has(schema.$ref)) {
      return schema
    }
    visited.add(schema.$ref)
    const refResult = resolveRef(schema.$ref, spec)
    if (refResult) {
      resolved = refResult
    }
  }

  // 递归处理嵌套 schema（包括从 $ref 解析后仍未展开的嵌套引用）
  if (resolved.properties) {
    const resolvedProps: Record<string, ApiSchema> = {}
    for (const [k, v] of Object.entries(resolved.properties)) {
      resolvedProps[k] = resolveSchemaRef(v, spec, visited)
    }
    resolved = { ...resolved, properties: resolvedProps }
  }
  if (resolved.items) {
    resolved = { ...resolved, items: resolveSchemaRef(resolved.items, spec, visited) }
  }
  if (resolved.oneOf) {
    resolved = { ...resolved, oneOf: resolved.oneOf.map((s) => resolveSchemaRef(s, spec, visited)) }
  }
  if (resolved.anyOf) {
    resolved = { ...resolved, anyOf: resolved.anyOf.map((s) => resolveSchemaRef(s, spec, visited)) }
  }
  if (resolved.allOf) {
    resolved = { ...resolved, allOf: resolved.allOf.map((s) => resolveSchemaRef(s, spec, visited)) }
  }
  return resolved
}

function resolveContentRefs(
  content: Record<string, any>,
  spec: OpenApiSpec
): Record<string, any> {
  const resolved: Record<string, any> = {}
  for (const [mediaType, obj] of Object.entries(content)) {
    resolved[mediaType] = {
      ...obj,
      schema: obj.schema ? resolveSchemaRef(obj.schema, spec) : undefined,
    }
  }
  return resolved
}

function resolveRef(ref: string, spec: OpenApiSpec): ApiSchema | null {
  // 例如 #/components/schemas/Pet 或 Swagger 2.0 #/definitions/Pet
  const parts = ref.replace(/^#\//, '').split('/')
  let current: any = spec
  for (const part of parts) {
    if (!current) return null
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~')
    // Swagger 2.0 兼容: definitions 替代 components/schemas
    if (key === 'components' && !(key in current)) {
      current = current['definitions']
      continue
    }
    current = current[key]
  }
  return (current as ApiSchema) || null
}

/** 按 tag 分组 */
export function groupByTag(items: ApiItem[]): Map<string, ApiItem[]> {
  const map = new Map<string, ApiItem[]>()
  for (const item of items) {
    const list = map.get(item.tag) || []
    list.push(item)
    map.set(item.tag, list)
  }
  // 排序：按 tag 名称
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}
