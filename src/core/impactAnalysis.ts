import type {
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  ApiSchema,
  OpenApiSpec,
  OperationObject,
  PathItem,
  ReferenceObject,
} from './types'

/**
 * 影响分析（轻量版）
 *
 * 解析器会把 $ref 解析为实际 schema 对象，丢失引用信息，因此本模块直接基于
 * 原始 OpenApiSpec（$ref 仍保留）构建 DTO 反向索引，反查引用了变更 DTO 的 API。
 */

const HTTP_METHODS: (keyof PathItem)[] = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
]

/** API 唯一键：METHOD:path，与 apiDiffEngine 的 apiKey 保持一致 */
export function apiKeyOf(method: string, path: string): string {
  return `${method.toUpperCase()}:${path}`
}

/** 从 $ref 字符串中取出 DTO 名称：#/components/schemas/Pet → Pet，#/definitions/Pet → Pet */
export function refToName(ref: string): string | null {
  const idx = ref.lastIndexOf('/')
  if (idx < 0) return null
  const name = ref.slice(idx + 1)
  return name || null
}

/** 递归收集一个 schema 子树中所有 $ref 指向的 DTO 名称 */
function collectRefs(schema: ApiSchema | undefined, acc: Set<string>): void {
  if (!schema) return
  if (schema.$ref) {
    const name = refToName(schema.$ref)
    if (name) acc.add(name)
  }
  if (schema.items) collectRefs(schema.items, acc)
  if (schema.properties) {
    for (const v of Object.values(schema.properties)) collectRefs(v, acc)
  }
  for (const combinator of [schema.oneOf, schema.anyOf, schema.allOf]) {
    if (combinator) for (const s of combinator) collectRefs(s, acc)
  }
}

/** 收集一组 content（requestBody / response）里的全部 $ref */
function collectContentRefs(
  content: Record<string, { schema?: ApiSchema }> | undefined,
  acc: Set<string>
): void {
  if (!content) return
  for (const media of Object.values(content)) {
    collectRefs(media?.schema, acc)
  }
}

function getSchemas(spec: OpenApiSpec): Record<string, ApiSchema> {
  const fromComponents = spec.components?.schemas
  if (fromComponents) return fromComponents
  const fromDefinitions = (spec as { definitions?: Record<string, ApiSchema> }).definitions
  return fromDefinitions || {}
}

function resolveObjectRef<T extends object>(
  spec: OpenApiSpec,
  value: T | ReferenceObject | undefined,
): T | undefined {
  let current: T | ReferenceObject | undefined = value
  const visited = new Set<string>()

  while (current && '$ref' in current) {
    const ref = current.$ref
    if (!ref.startsWith('#/') || visited.has(ref)) return undefined
    visited.add(ref)

    let resolved: unknown = spec
    for (const segment of ref.slice(2).split('/')) {
      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~')
      if (!resolved || typeof resolved !== 'object') return undefined
      resolved = (resolved as Record<string, unknown>)[key]
    }
    if (!resolved || typeof resolved !== 'object') return undefined
    current = resolved as T | ReferenceObject
  }

  return current as T | undefined
}

/** 构建 DTO → 其直接引用的其它 DTO 的图 */
export function buildDtoRefGraph(spec: OpenApiSpec): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>()
  const schemas = getSchemas(spec)
  for (const [name, schema] of Object.entries(schemas)) {
    const refs = new Set<string>()
    collectRefs(schema, refs)
    refs.delete(name) // 去掉自引用
    graph.set(name, refs)
  }
  return graph
}

/** 构建 API key → 其直接引用的 DTO 集合 */
export function buildApiRefMap(spec: OpenApiSpec): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const paths = spec.paths || {}

  for (const [pathUrl, pathItemOrRef] of Object.entries(paths)) {
    const pathItem = resolveObjectRef<PathItem>(spec, pathItemOrRef)
    if (!pathItem) continue
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OperationObject | undefined
      if (!operation) continue

      const refs = new Set<string>()
      const requestBody = resolveObjectRef<ApiRequestBody>(spec, operation.requestBody)
      collectContentRefs(requestBody?.content, refs)
      for (const responseOrRef of Object.values(operation.responses || {})) {
        const response = resolveObjectRef<ApiResponse>(spec, responseOrRef)
        collectContentRefs(response?.content, refs)
      }
      // 参数 schema 中的 $ref 同样纳入
      for (const parameterOrRef of operation.parameters || []) {
        const parameter = resolveObjectRef<ApiParameter>(spec, parameterOrRef)
        collectRefs(parameter?.schema, refs)
      }
      map.set(apiKeyOf(String(method), pathUrl), refs)
    }
  }
  return map
}

/** 计算一组根 DTO 经引用图可达的全部 DTO（含根本身） */
function reachable(roots: Set<string>, graph: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>()
  const stack = [...roots]
  while (stack.length > 0) {
    const cur = stack.pop()!
    if (visited.has(cur)) continue
    visited.add(cur)
    const next = graph.get(cur)
    if (next) for (const n of next) if (!visited.has(n)) stack.push(n)
  }
  return visited
}

/**
 * 给定变更的 DTO 名称集合，反查受影响的 API（key 集合）。
 * 某 API 若（直接或经 DTO 引用链间接）使用了任一变更 DTO，则判定为受影响。
 */
export function computeAffectedApis(
  spec: OpenApiSpec,
  changedDtos: string[]
): Set<string> {
  const changed = new Set(changedDtos)
  const affected = new Set<string>()
  if (changed.size === 0) return affected

  const dtoGraph = buildDtoRefGraph(spec)
  const apiRefs = buildApiRefMap(spec)

  for (const [apiKey, roots] of apiRefs) {
    if (roots.size === 0) continue
    const reach = reachable(roots, dtoGraph)
    for (const c of changed) {
      if (reach.has(c)) {
        affected.add(apiKey)
        break
      }
    }
  }
  return affected
}
