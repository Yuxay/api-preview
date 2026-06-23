/** OpenAPI 3.x 解析后的统一 API 条目 */
export interface ApiItem {
  id: string;
  tag: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  operationId?: string;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  security?: Record<string, string[]>[];
  /** 多源标识 */
  sourceId?: string;
  sourceName?: string;
}

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description: string;
  schema: ApiSchema;
  example?: unknown;
}

export interface ApiRequestBody {
  description: string;
  required: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema: ApiSchema;
  example?: unknown;
}

export interface ApiResponse {
  code?: string;
  description: string;
  content?: Record<string, MediaTypeObject>;
}

export interface ApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, ApiSchema>;
  additionalProperties?: boolean | ApiSchema;
  items?: ApiSchema;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  description?: string;
  nullable?: boolean;
  oneOf?: ApiSchema[];
  anyOf?: ApiSchema[];
  allOf?: ApiSchema[];
  /** $ref 引用 */
  $ref?: string;
}

/** Swagger/OpenAPI 3.x 原始 JSON 顶层结构（部分） */
export interface OpenApiSpec {
  openapi: string;
  swagger?: string; // 兼容 Swagger 2.0
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: { url: string; description?: string }[];
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, ApiSchema>;
    parameters?: Record<string, ApiParameter>;
    securitySchemes?: Record<string, unknown>;
  };
  definitions?: Record<string, ApiSchema>;
  tags?: { name: string; description?: string }[];
  security?: Record<string, string[]>[];
}

/** 多源管理 */
export interface SwaggerSource {
  id: string;
  name: string;
  url: string;
  spec: OpenApiSpec;
  apis: ApiItem[];
  status: 'loading' | 'loaded' | 'error';
  error?: string;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  /** path-level 公共参数，适用于该路径下所有操作 */
  parameters?: ApiParameter[];
}

export interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  security?: Record<string, string[]>[];
}
