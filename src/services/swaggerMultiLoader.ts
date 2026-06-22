import type { ApiItem, SwaggerSource, OpenApiSpec } from '@/core/types';
import { parseOpenApiSpec, groupByTag } from '@/core/openapiParser';
import { saveUrl } from '@/utils/storage';
import { translate } from '@/i18n';
import petstoreExample from '../../examples/petstore.json';

export interface SourceInput {
  id: string;
  name: string;
  url: string;
}

export interface MultiLoadResult {
  sources: SwaggerSource[];
  allApis: ApiItem[];
  tagGroups: Map<string, ApiItem[]>;
  errors: string[];
}

function getBundledExampleSpec(url: string): OpenApiSpec | null {
  if (url === 'example://petstore') {
    return petstoreExample as unknown as OpenApiSpec;
  }
  return null;
}

export function normalizeSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const normalizedPath =
      parsed.pathname.length > 1
        ? parsed.pathname.replace(/\/+$/, '')
        : parsed.pathname;

    return `${parsed.protocol}//${parsed.host}${normalizedPath}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function stableHash(input: string): string {
  let hash = 5381;

  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }

  return hash.toString(36);
}

export function buildSourceId(url: string): string {
  return `src-${stableHash(normalizeSourceUrl(url))}`;
}

export function buildApiId(
  sourceId: string,
  method: string,
  path: string,
): string {
  return `${sourceId}:${method.toUpperCase()}:${path}`;
}

/**
 * 并行加载多个 Swagger 源，合并 API 列表
 */
export async function loadSources(
  inputs: SourceInput[],
): Promise<MultiLoadResult> {
  const results = await Promise.allSettled(
    inputs.map((input) => loadSingleSource(input)),
  );

  const sources: SwaggerSource[] = [];
  const allApis: ApiItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      sources.push(result.value.source);
      allApis.push(...result.value.apis);
      // 保存到最近使用（附带名称）
      await saveUrl({ name: inputs[i].name, url: inputs[i].url });
    } else {
      const err = result.reason?.message || translate('errors.unknownError');
      errors.push(`${inputs[i].name}: ${err}`);
      sources.push({
        id: inputs[i].id,
        name: inputs[i].name,
        url: inputs[i].url,
        spec: {
          openapi: 'unknown',
          info: { title: inputs[i].name, version: '' },
          paths: {},
        },
        apis: [],
        status: 'error',
        error: err,
      });
    }
  }

  const tagGroups = groupByTag(allApis);

  return { sources, allApis, tagGroups, errors };
}

async function loadSingleSource(
  input: SourceInput,
): Promise<{ source: SwaggerSource; apis: ApiItem[] }> {
  let raw: { success: boolean; data?: unknown; error?: string };

  // 处理示例项目（example:// 协议）
  if (input.url.startsWith('example://')) {
    if (window.electronAPI?.loadExampleSpec) {
      raw = await window.electronAPI.loadExampleSpec();
    } else {
      const bundledSpec = getBundledExampleSpec(input.url);
      if (!bundledSpec) {
        throw new Error(translate('errors.exampleUnavailable'));
      }
      raw = { success: true, data: bundledSpec };
    }
  } else if (window.electronAPI) {
    raw = await window.electronAPI.fetchSwagger(input.url);
  } else {
    const resp = await fetch(input.url, {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) {
      throw new Error(
        translate('errors.http', {
          status: resp.status,
          statusText: resp.statusText,
        }),
      );
    }
    raw = { success: true, data: await resp.json() };
  }

  if (!raw.success || !raw.data) {
    throw new Error(raw.error || translate('errors.loadFailed'));
  }

  const spec = raw.data as OpenApiSpec;
  if (!spec.openapi && !spec.swagger) {
    throw new Error(translate('errors.invalidSpec'));
  }

  const apis = parseOpenApiSpec(spec);

  // 为每个 API 标记来源
  const stampedApis: ApiItem[] = apis.map((api) => ({
    ...api,
    id: buildApiId(input.id, api.method, api.path),
    sourceId: input.id,
    sourceName: input.name,
  }));

  return {
    source: {
      id: input.id,
      name: input.name,
      url: input.url,
      spec,
      apis: stampedApis,
      status: 'loaded',
    },
    apis: stampedApis,
  };
}

/**
 * 从 URL 自动生成名称（取最后一段路径）
 */
export function deriveSourceName(url: string): string {
  // 示例项目使用友好名称
  if (url.startsWith('example://')) {
    const key = url.replace('example://', '');
    const names: Record<string, string> = {
      petstore: 'Swagger Petstore (示例)',
    };
    return names[key] || `示例: ${key}`;
  }
  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || pathname || url;
  } catch {
    return url.split('/').pop() || url;
  }
}

/**
 * 为 source 分配颜色索引（循环 6 色）
 *
 * "Signal Trace" 调色板 —— 示波器/精密仪器风格
 * 每色含：选中背景/边框、悬浮预览、文字、菱形标记、左侧色带
 *
 * 核心原则：选中 = 来源色强化，绝非替换为 sky-400
 */
const SOURCE_COLORS = [
  {
    hex: '#06b6d4',
    bg:          'bg-[rgba(6,182,212,0.14)]',
    bgHover:     'hover:bg-[rgba(6,182,212,0.06)]',
    text:        'text-[#06b6d4]',
    dot:         'bg-[#06b6d4]',
    border:      'border-[rgba(6,182,212,0.35)]',
    borderHover: 'hover:border-[rgba(6,182,212,0.20)]',
    bar:         'border-l-[#06b6d4]',
  },
  {
    hex: '#10b981',
    bg:          'bg-[rgba(16,185,129,0.14)]',
    bgHover:     'hover:bg-[rgba(16,185,129,0.06)]',
    text:        'text-[#10b981]',
    dot:         'bg-[#10b981]',
    border:      'border-[rgba(16,185,129,0.35)]',
    borderHover: 'hover:border-[rgba(16,185,129,0.20)]',
    bar:         'border-l-[#10b981]',
  },
  {
    hex: '#8b5cf6',
    bg:          'bg-[rgba(139,92,246,0.14)]',
    bgHover:     'hover:bg-[rgba(139,92,246,0.06)]',
    text:        'text-[#8b5cf6]',
    dot:         'bg-[#8b5cf6]',
    border:      'border-[rgba(139,92,246,0.35)]',
    borderHover: 'hover:border-[rgba(139,92,246,0.20)]',
    bar:         'border-l-[#8b5cf6]',
  },
  {
    hex: '#f59e0b',
    bg:          'bg-[rgba(245,158,11,0.14)]',
    bgHover:     'hover:bg-[rgba(245,158,11,0.06)]',
    text:        'text-[#f59e0b]',
    dot:         'bg-[#f59e0b]',
    border:      'border-[rgba(245,158,11,0.35)]',
    borderHover: 'hover:border-[rgba(245,158,11,0.20)]',
    bar:         'border-l-[#f59e0b]',
  },
  {
    hex: '#f43f5e',
    bg:          'bg-[rgba(244,63,94,0.14)]',
    bgHover:     'hover:bg-[rgba(244,63,94,0.06)]',
    text:        'text-[#f43f5e]',
    dot:         'bg-[#f43f5e]',
    border:      'border-[rgba(244,63,94,0.35)]',
    borderHover: 'hover:border-[rgba(244,63,94,0.20)]',
    bar:         'border-l-[#f43f5e]',
  },
  {
    hex: '#6366f1',
    bg:          'bg-[rgba(99,102,241,0.14)]',
    bgHover:     'hover:bg-[rgba(99,102,241,0.06)]',
    text:        'text-[#6366f1]',
    dot:         'bg-[#6366f1]',
    border:      'border-[rgba(99,102,241,0.35)]',
    borderHover: 'hover:border-[rgba(99,102,241,0.20)]',
    bar:         'border-l-[#6366f1]',
  },
];

export function getSourceColor(index: number) {
  return SOURCE_COLORS[index % SOURCE_COLORS.length];
}

export function getSourceColorById(sourceId: string, sources: SwaggerSource[]) {
  const idx = sources.findIndex((s) => s.id === sourceId);
  return getSourceColor(idx >= 0 ? idx : 0);
}
