import type {
  ApiItem,
  ApiParameter,
  ApiResponse,
  OpenApiSpec,
  OperationObject,
  ApiSchema,
} from './types';

/**
 * 解析 OpenAPI 3.x 规范 JSON 为统一 ApiItem[]
 */
export function parseOpenApiSpec(spec: OpenApiSpec): ApiItem[] {
  const items: ApiItem[] = [];

  const paths = spec.paths || {};
  const globalSecurity = spec.security || [];

  for (const [pathUrl, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;

    // path-level 公共参数（适用于该路径下所有操作）
    const pathLevelParams: ApiParameter[] = (pathItem.parameters || []).map(
      (p) => resolveParameterRef(p, spec),
    );

    const methods: { method: string; operation: OperationObject }[] = [];

    if (pathItem.get) methods.push({ method: 'GET', operation: pathItem.get });
    if (pathItem.post)
      methods.push({ method: 'POST', operation: pathItem.post });
    if (pathItem.put) methods.push({ method: 'PUT', operation: pathItem.put });
    if (pathItem.delete)
      methods.push({ method: 'DELETE', operation: pathItem.delete });
    if (pathItem.patch)
      methods.push({ method: 'PATCH', operation: pathItem.patch });
    if (pathItem.options)
      methods.push({ method: 'OPTIONS', operation: pathItem.options });
    if (pathItem.head)
      methods.push({ method: 'HEAD', operation: pathItem.head });

    for (const { method, operation } of methods) {
      const tag = operation.tags?.[0] || 'default';

      const operationParams: ApiParameter[] = (operation.parameters || []).map(
        (p) => resolveParameterRef(p, spec),
      );

      // 合并 path-level 与 operation-level：按 in+name 去重，operation 覆盖 path
      const mergedParams = new Map<string, ApiParameter>();
      for (const p of pathLevelParams) mergedParams.set(`${p.in}:${p.name}`, p);
      for (const p of operationParams) mergedParams.set(`${p.in}:${p.name}`, p);
      const parameters: ApiParameter[] = [...mergedParams.values()];

      // 从 path 中提取路径参数（若未在 operation.parameters 中声明）
      const paramNames = extractPathParams(pathUrl);
      for (const name of paramNames) {
        if (!parameters.find((p) => p.in === 'path' && p.name === name)) {
          parameters.push({
            name,
            in: 'path',
            required: true,
            description: '',
            schema: { type: 'string' },
          });
        }
      }

      const requestBody = operation.requestBody
        ? {
            ...operation.requestBody,
            content: resolveContentRefs(operation.requestBody.content, spec),
          }
        : undefined;

      const responses: ApiResponse[] = Object.entries(
        operation.responses || {},
      ).map(([code, resp]) => ({
        code,
        description: resp.description || '',
        content: resp.content
          ? resolveContentRefs(resp.content, spec)
          : undefined,
      }));

      const opSecurity = operation.security || globalSecurity;

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
      });
    }
  }

  return items;
}

/** 提取路径中的 {paramName} 参数名 */
export function extractPathParams(path: string): string[] {
  const re = /\{(\w+)\}/g;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/** 解析 $ref */
function resolveSchemaRef(
  schema: ApiSchema,
  spec: OpenApiSpec,
  visited: Set<string> = new Set(),
): ApiSchema {
  if (!schema) return schema;

  let resolved = { ...schema };
  // 解析 $ref 后仍需向子节点传递已访问集合，避免循环引用再次展开
  let activeVisited = visited;
  if (schema.$ref) {
    if (visited.has(schema.$ref)) {
      return resolved;
    }
    activeVisited = new Set(visited);
    activeVisited.add(schema.$ref);
    const refResult = resolveRef(schema.$ref, spec);
    if (refResult) {
      resolved = mergeSchemas(resolveSchemaRef(refResult, spec, activeVisited), {
        ...schema,
        $ref: undefined,
      });
    }
  }

  if (resolved.allOf?.length) {
    resolved = mergeAllOfSchemas(
      resolved.allOf.map((item) =>
        resolveSchemaRef(item, spec, activeVisited),
      ),
      { ...resolved, allOf: undefined },
    );
  }

  if (resolved.properties) {
    const resolvedProps: Record<string, ApiSchema> = {};
    for (const [k, v] of Object.entries(resolved.properties)) {
      resolvedProps[k] = resolveSchemaRef(v, spec, activeVisited);
    }
    resolved = { ...resolved, properties: resolvedProps };
  }
  if (
    resolved.additionalProperties &&
    typeof resolved.additionalProperties === 'object'
  ) {
    resolved = {
      ...resolved,
      additionalProperties: resolveSchemaRef(
        resolved.additionalProperties,
        spec,
        activeVisited,
      ),
    };
  }
  if (resolved.items) {
    resolved = {
      ...resolved,
      items: resolveSchemaRef(resolved.items, spec, activeVisited),
    };
  }
  if (resolved.oneOf) {
    resolved = {
      ...resolved,
      oneOf: resolved.oneOf.map((s) =>
        resolveSchemaRef(s, spec, activeVisited),
      ),
    };
  }
  if (resolved.anyOf) {
    resolved = {
      ...resolved,
      anyOf: resolved.anyOf.map((s) =>
        resolveSchemaRef(s, spec, activeVisited),
      ),
    };
  }
  return resolved;
}

function resolveContentRefs(
  content: Record<string, any>,
  spec: OpenApiSpec,
): Record<string, any> {
  const resolved: Record<string, any> = {};
  for (const [mediaType, obj] of Object.entries(content)) {
    resolved[mediaType] = {
      ...obj,
      schema: obj.schema ? resolveSchemaRef(obj.schema, spec) : undefined,
    };
  }
  return resolved;
}

function resolveRef(ref: string, spec: OpenApiSpec): ApiSchema | null {
  // 例如 #/components/schemas/Pet 或 Swagger 2.0 #/definitions/Pet
  const parts = ref.replace(/^#\//, '').split('/');
  let current: any = spec;
  for (const part of parts) {
    if (!current) return null;
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    // Swagger 2.0 兼容: definitions 替代 components/schemas
    if (key === 'components' && !(key in current)) {
      current = current['definitions'];
      continue;
    }
    current = current[key];
  }
  return (current as ApiSchema) || null;
}

function resolveParameterRef(parameter: any, spec: OpenApiSpec): ApiParameter {
  if (!parameter) {
    return {
      name: '',
      in: 'query',
      required: false,
      description: '',
      schema: { type: 'string' },
    };
  }

  const referenced =
    parameter.$ref && typeof parameter.$ref === 'string'
      ? (resolveRef(parameter.$ref, spec) as any) || parameter
      : parameter;

  const merged = {
    ...referenced,
    ...parameter,
    $ref: undefined,
  };

  return {
    ...merged,
    schema: resolveSchemaRef(merged.schema, spec),
  };
}

function mergeAllOfSchemas(parts: ApiSchema[], seed: ApiSchema): ApiSchema {
  return parts.reduce((acc, part) => mergeSchemas(acc, part), seed);
}

function mergeSchemas(base: ApiSchema, extra: ApiSchema): ApiSchema {
  const merged: ApiSchema = {
    ...base,
    ...extra,
  };

  if (base.properties || extra.properties) {
    merged.properties = {
      ...(base.properties || {}),
      ...(extra.properties || {}),
    };
  }

  if (base.required || extra.required) {
    merged.required = [
      ...new Set([...(base.required || []), ...(extra.required || [])]),
    ];
  }

  return merged;
}

/** 按 tag 分组 */
export function groupByTag(items: ApiItem[]): Map<string, ApiItem[]> {
  const map = new Map<string, ApiItem[]>();
  for (const item of items) {
    const list = map.get(item.tag) || [];
    list.push(item);
    map.set(item.tag, list);
  }
  // 排序：按 tag 名称
  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}
