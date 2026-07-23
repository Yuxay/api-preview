<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ApiItem, ApiParameter } from '@/core/types';
import type { FormField } from '@/core/schemaFormEngine';
import { schemaToFormFields, formFieldsToBody } from '@/core/schemaFormEngine';
import {
  buildRequest,
  type RequestBuildError,
  type RequestConfig,
} from '@/core/requestRuntime';
import { sendRequest, type ProxyResponse } from '@/services/httpClient';
import { getUiState, saveUiState } from '@/utils/storage';
import {
  formatBytes,
  formatResponseTime,
  getMethodColor,
  isJsonMediaType,
  joinUrl,
  normalizeMediaType,
  prettyJson,
  tryParseJson,
} from '@/utils/format';
import CollapsiblePanel from '@/components/CollapsiblePanel.vue';
import CopyButton from '@/components/CopyButton.vue';
import HeadersEditor from '@/components/HeadersEditor.vue';
import JsonBodyEditor from '@/components/JsonBodyEditor.vue';
import JsonTreeView from '@/components/JsonTreeView.vue';
import ModeSwitch from '@/components/ModeSwitch.vue';
import PathParamsEditor from '@/components/PathParamsEditor.vue';
import QueryParamsEditor from '@/components/QueryParamsEditor.vue';
import SchemaTable from '@/components/SchemaTable.vue';
import SmartForm from '@/components/SmartForm.vue';
import AppIcon from '@/components/AppIcon.vue';
import { useI18n } from '@/i18n';

const props = defineProps<{
  api: ApiItem;
  servers?: { url: string; description?: string }[];
  token: string;
}>();

const emit = defineEmits<{
  'export-api': [api: ApiItem];
}>();

const activeView = ref<'docs' | 'test'>(
  getUiState<'docs' | 'test'>('detail-active-view', 'docs'),
);
const bodySchemaView = ref<'code' | 'table'>('table');
const respSchemaView = ref<'code' | 'table'>('table');
const requestOpen = ref(getUiState('detail-request-open', true));
const responseOpen = ref(getUiState('detail-response-open', true));
const pathOpen = ref(getUiState('detail-path-open', true));
const queryOpen = ref(getUiState('detail-query-open', true));
const cookieOpen = ref(getUiState('detail-cookie-open', false));
const headersOpen = ref(getUiState('detail-headers-open', false));
const bodyOpen = ref(getUiState('detail-body-open', true));

const pathParams = ref<Record<string, string>>({});
const queryParams = ref<Record<string, string>>({});
const cookieParams = ref<Record<string, string>>({});
const requestHeaders = ref<Record<string, string>>({});
const requestBody = ref('');
const bodyMode = ref<'form' | 'json'>('form');
const formFields = ref<FormField[]>([]);
const sending = ref(false);
const response = ref<ProxyResponse | null>(null);
const buildError = ref<RequestBuildError | null>(null);
const requestMediaType = ref('');
const expandedDesc = ref<Record<string, boolean>>({});
const { t } = useI18n();

watch(activeView, (value) => saveUiState('detail-active-view', value));

for (const [key, state] of [
  ['detail-request-open', requestOpen],
  ['detail-response-open', responseOpen],
  ['detail-path-open', pathOpen],
  ['detail-query-open', queryOpen],
  ['detail-cookie-open', cookieOpen],
  ['detail-headers-open', headersOpen],
  ['detail-body-open', bodyOpen],
] as const) {
  watch(state, (value) => saveUiState(key, value));
}

const requestMediaTypes = computed(() =>
  Object.keys(props.api.requestBody?.content || {}),
);
const bodySchema = computed(
  () => props.api.requestBody?.content?.[requestMediaType.value]?.schema,
);
const requiredFields = computed(() => bodySchema.value?.required || []);
const hasBodySchema = computed(
  () =>
    !!(
      bodySchema.value?.properties ||
      bodySchema.value?.type ||
      bodySchema.value?.oneOf ||
      bodySchema.value?.anyOf ||
      bodySchema.value?.allOf
    ),
);
const canUseFormBody = computed(
  () => hasBodySchema.value && isJsonMediaType(requestMediaType.value),
);
const pathParamsList = computed(() =>
  props.api.parameters.filter((param) => param.in === 'path'),
);
const queryParamsList = computed(() =>
  props.api.parameters.filter((param) => param.in === 'query'),
);
const cookieParamsList = computed(() =>
  props.api.parameters.filter((param) => param.in === 'cookie'),
);
const headerParamsList = computed(() =>
  props.api.parameters.filter((param) => param.in === 'header'),
);
const isBodyMethod = computed(() => {
  const method = props.api.method.toUpperCase();
  return (
    !['GET', 'HEAD'].includes(method) &&
    (Boolean(props.api.requestBody) || ['POST', 'PUT', 'PATCH'].includes(method))
  );
});
const parsedResponse = computed(() =>
  response.value?.bodyEncoding === 'base64' || !response.value
    ? null
    : tryParseJson(response.value.body),
);
const responseBodyDisplay = computed(() => {
  if (!response.value) return '';
  if (response.value.bodyEncoding === 'base64') return response.value.body;
  if (parsedResponse.value?.ok) return prettyJson(parsedResponse.value.data);
  return response.value.body;
});
const responseTreeData = computed(() => {
  if (
    !parsedResponse.value?.ok ||
    parsedResponse.value.data === null ||
    typeof parsedResponse.value.data !== 'object'
  ) {
    return null;
  }
  return parsedResponse.value.data;
});
const responsePayloadTitle = computed(() =>
  response.value?.bodyEncoding === 'base64'
    ? t('apiDetail.binaryPayload')
    : t('apiDetail.runtimePayload'),
);
const responsePayloadHint = computed(() =>
  response.value?.bodyEncoding === 'base64'
    ? t('apiDetail.binaryPayloadHint')
    : t('apiDetail.runtimePayloadHint'),
);
const serverBase = computed(() => props.servers?.[0]?.url || '');
const activeServer = computed(
  () => serverBase.value || t('apiDetail.serverFallback'),
);
const fullUrl = computed(() => joinUrl(serverBase.value, props.api.path));
const pathParamsSubtitle = computed(() =>
  t('meta.parameterCount', { count: pathParamsList.value.length }),
);
const queryParamsSubtitle = computed(() =>
  t('meta.parameterCount', { count: queryParamsList.value.length }),
);
const cookieParamsSubtitle = computed(() =>
  t('meta.parameterCount', { count: cookieParamsList.value.length }),
);
const headersSubtitle = computed(() =>
  t('meta.headerCount', { count: Object.keys(requestHeaders.value).length }),
);
const bodySubtitle = computed(() =>
  props.api.requestBody?.required
    ? t('apiDetail.requiredRequestBody')
    : t('apiDetail.optionalRequestBody'),
);
const tryRequestSummary = computed(() =>
  t('apiDetail.tryRequestSummary', {
    pathCount: pathParamsList.value.length,
    queryCount: queryParamsList.value.length,
    headerCount: headerParamsList.value.length,
  }),
);

watch(
  () => props.api,
  (api) => {
    requestMediaType.value = pickPreferredMediaType(
      Object.keys(api.requestBody?.content || {}),
    );

    const nextPathParams: Record<string, string> = {};
    for (const param of api.parameters.filter((item) => item.in === 'path')) {
      nextPathParams[param.name] = stringifyValue(resolveExample(param));
    }
    pathParams.value = nextPathParams;

    const nextQueryParams: Record<string, string> = {};
    for (const param of api.parameters.filter((item) => item.in === 'query')) {
      nextQueryParams[param.name] = stringifyValue(resolveExample(param));
    }
    queryParams.value = nextQueryParams;

    const nextCookieParams: Record<string, string> = {};
    for (const param of api.parameters.filter((item) => item.in === 'cookie')) {
      nextCookieParams[param.name] = stringifyValue(resolveExample(param));
    }
    cookieParams.value = nextCookieParams;

    const nextHeaders: Record<string, string> = {};
    const acceptType = pickPreferredMediaType(collectResponseMediaTypes(api));
    if (acceptType) {
      nextHeaders.Accept = acceptType;
    }
    if (isBodyMethod.value && requestMediaType.value) {
      nextHeaders['Content-Type'] = requestMediaType.value;
    }
    if (props.token) {
      nextHeaders.Authorization = `Bearer ${props.token}`;
    }
    for (const param of api.parameters.filter((item) => item.in === 'header')) {
      nextHeaders[param.name] = stringifyValue(resolveExample(param));
    }
    requestHeaders.value = nextHeaders;

    const nextBodySchema =
      api.requestBody?.content?.[requestMediaType.value]?.schema;
    if (nextBodySchema && isJsonMediaType(requestMediaType.value)) {
      formFields.value = schemaToFormFields(
        nextBodySchema,
        nextBodySchema.required || [],
      );
      requestBody.value = prettyJson(formFieldsToBody(formFields.value));
      bodyMode.value = 'form';
    } else {
      formFields.value = [];
      requestBody.value = stringifyRequestBodyExample(
        api.requestBody?.content?.[requestMediaType.value],
      );
      bodyMode.value = 'json';
    }

    bodySchemaView.value = 'table';
    respSchemaView.value = 'table';
    response.value = null;
    buildError.value = null;
  },
  { immediate: true },
);

watch(
  () => props.token,
  (token) => {
    if (token) {
      requestHeaders.value.Authorization = `Bearer ${token}`;
    } else {
      delete requestHeaders.value.Authorization;
    }
  },
);

watch(requestMediaType, (mediaType, prevMediaType) => {
  if (!mediaType || mediaType === prevMediaType) return;

  if (isBodyMethod.value) {
    requestHeaders.value['Content-Type'] = mediaType;
  }

  const mediaObj = props.api.requestBody?.content?.[mediaType];
  const schema = mediaObj?.schema;
  if (schema && isJsonMediaType(mediaType)) {
    formFields.value = schemaToFormFields(schema, schema.required || []);
    requestBody.value = prettyJson(formFieldsToBody(formFields.value));
    bodyMode.value = 'form';
  } else {
    formFields.value = [];
    requestBody.value = stringifyRequestBodyExample(mediaObj);
    bodyMode.value = 'json';
  }
});

function resolveExample(param: ApiParameter): unknown {
  return param.example ?? param.schema?.example ?? param.schema?.default ?? '';
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function paramTypeLabel(param: ApiParameter): string {
  const schema = param.schema;
  if (!schema) return '-';
  if (schema.$ref) return `$ref → ${schema.$ref.split('/').pop() || schema.$ref}`;
  if (schema.oneOf?.length) return `oneOf [${schema.oneOf.length}]`;
  if (schema.anyOf?.length) return `anyOf [${schema.anyOf.length}]`;
  if (schema.allOf?.length) return `allOf [${schema.allOf.length}]`;
  if (schema.type === 'array') {
    if (schema.items) {
      const itemType = schema.items.$ref
        ? schema.items.$ref.split('/').pop()
        : schema.items.type || 'any';
      return `array<${itemType}>`;
    }
    return 'array';
  }
  if ((schema.type === 'object' || !schema.type) && schema.properties) {
    return 'object';
  }
  if (schema.type === 'string' && (schema.format === 'binary' || schema.format === 'byte')) {
    return `file (${schema.format})`;
  }
  return [schema.type, schema.format].filter(Boolean).join(' / ') || '-';
}

function hasParamSchemaDetails(param: ApiParameter): boolean {
  const schema = param.schema;
  if (!schema) return false;
  if (schema.oneOf?.length || schema.anyOf?.length || schema.allOf?.length)
    return true;
  if (schema.type === 'array' && !!schema.items) return true;
  return !!(
    (schema.type === 'object' || !schema.type) &&
    schema.properties &&
    Object.keys(schema.properties).length > 0
  );
}

function pickPreferredMediaType(mediaTypes: string[]): string {
  if (mediaTypes.length === 0) return '';
  return (
    mediaTypes.find(
      (type) => normalizeMediaType(type) === 'application/json',
    ) || mediaTypes[0]
  );
}

function collectResponseMediaTypes(api: ApiItem): string[] {
  return [
    ...new Set(
      api.responses.flatMap((item) => Object.keys(item.content || {})),
    ),
  ];
}

function stringifyRequestBodyExample(mediaObj?: {
  schema?: { example?: unknown; default?: unknown };
  example?: unknown;
}): string {
  const example =
    mediaObj?.example ?? mediaObj?.schema?.example ?? mediaObj?.schema?.default;
  if (example === undefined || example === null) return '';
  return typeof example === 'string' ? example : prettyJson(example);
}

function onModeChange(mode: 'form' | 'json') {
  if (
    mode === 'json' &&
    bodyMode.value === 'form' &&
    formFields.value.length > 0
  ) {
    requestBody.value = prettyJson(formFieldsToBody(formFields.value));
  } else if (mode === 'form' && bodyMode.value === 'json') {
    const parsed = tryParseJson(requestBody.value);
    if (parsed.ok) {
      updateFormFieldsFromValue(formFields.value, parsed.data);
    }
  }
  bodyMode.value = mode;
}

function updateFormFieldsFromValue(fields: FormField[], data: unknown) {
  if (
    fields.length === 1 &&
    (fields[0].key === 'value' || fields[0].key === 'items')
  ) {
    fields[0].value = data;
    return;
  }

  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return;
  }

  const record = data as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field.key];
    if (value === undefined) continue;
    if (
      field.type === 'object' &&
      field.children &&
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      field.value = value;
      updateFormFieldsFromValue(field.children, value);
      continue;
    }
    field.value = value;
  }
}

async function handleSend() {
  buildError.value = null;
  sending.value = true;
  response.value = null;

  let bodyStr = requestBody.value;
  if (bodyMode.value === 'form' && formFields.value.length > 0) {
    bodyStr = prettyJson(formFieldsToBody(formFields.value));
  }

  const result = buildRequest(props.api, {
    servers: props.servers,
    token: props.token,
    pathParams: pathParams.value,
    queryParams: queryParams.value,
    cookieParams: cookieParams.value,
    headers: requestHeaders.value,
    body: isBodyMethod.value ? bodyStr : '',
  });

  if (!result.ok) {
    buildError.value = result.error!;
    sending.value = false;
    return;
  }

  const config: RequestConfig = result.config!;

  try {
    response.value = await sendRequest({
      url: config.url,
      method: config.method,
      headers: config.headers,
      body: config.body,
    });
  } catch (error: any) {
    response.value = {
      success: false,
      status: 0,
      statusText: t('common.error'),
      headers: {},
      body: '',
      error: error.message,
      duration: 0,
    };
  } finally {
    sending.value = false;
  }
}

function responseBadgeClass(status: number) {
  if (status >= 200 && status < 300) return 'status-badge-success';
  if (status >= 400 || status === 0) return 'status-badge-danger';
  return 'status-badge-warning';
}

function responseMetaClass(code?: string) {
  const status = Number(code || 0);
  if (status >= 200 && status < 300) return 'status-badge-success';
  if (status >= 400) return 'status-badge-danger';
  return 'status-badge-warning';
}

function toggleDescExpand(key: string) {
  expandedDesc.value[key] = !expandedDesc.value[key];
}

function isDescExpanded(key: string): boolean {
  return !!expandedDesc.value[key];
}

function isLongText(text: string): boolean {
  return text.length > 30;
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
    <section class="panel-surface group shrink-0 px-5 py-3.5">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="method-chip px-2.5 text-xs"
          :class="getMethodColor(api.method)"
        >
          {{ api.method }}
        </span>
        <span class="meta-badge">
          {{ api.sourceName || t('common.defaultSource') }}
        </span>
        <span class="meta-badge">
          {{ api.tag }}
        </span>
        <span class="meta-badge ml-auto">
          {{ t('common.parameters') }} {{ api.parameters.length }}
        </span>
        <button
          type="button"
          class="ghost-button"
          :title="t('aiExport.quickExport')"
          @click="emit('export-api', api)"
        >
          <AppIcon name="code" :size="14" />
          {{ t('aiExport.entry') }}
        </button>
      </div>

      <div class="mt-2.5 flex min-w-0 items-center gap-1.5">
        <h2
          class="min-w-0 truncate font-mono text-base"
          style="color: var(--ui-text)"
          :title="api.path"
        >
          {{ api.path }}
        </h2>
        <CopyButton :value="api.path" :title="t('common.copyPath')" />
      </div>

      <p class="mt-1.5 text-sm" style="color: var(--ui-text-muted)">
        {{ api.summary || api.description || t('common.noSummary') }}
      </p>
      <p
        v-if="api.summary && api.description"
        class="mt-1 text-xs leading-5"
        style="color: var(--ui-text-soft)"
      >
        {{ api.description }}
      </p>

      <div
        class="mt-2 flex min-w-0 items-center gap-2 text-xs"
        style="color: var(--ui-text-soft)"
      >
        <span class="shrink-0 font-semibold uppercase tracking-[0.16em]">{{
          t('common.server')
        }}</span>
        <span
          class="min-w-0 truncate font-mono"
          style="color: var(--ui-text-muted)"
          :title="activeServer"
          >{{ activeServer }}</span
        >
      </div>

      <div class="panel-divider mt-3 flex items-center gap-1 border-t pt-3">
        <button
          type="button"
          class="detail-tab"
          :class="activeView === 'docs' ? 'detail-tab-active' : ''"
          @click="activeView = 'docs'"
        >
          <AppIcon name="book-open" :size="16" />
          {{ t('apiDetail.docsTab') }}
        </button>
        <button
          type="button"
          class="detail-tab"
          :class="activeView === 'test' ? 'detail-tab-active' : ''"
          @click="activeView = 'test'"
        >
          <AppIcon name="play" :size="16" />
          {{ t('apiDetail.testTab') }}
        </button>
        <span
          class="ml-2 hidden text-xs sm:inline"
          style="color: var(--ui-text-soft)"
        >
          {{
            activeView === 'docs'
              ? t('apiDetail.docsTabHint')
              : t('apiDetail.testTabHint')
          }}
        </span>
      </div>
    </section>

    <div class="min-h-0 flex-1 overflow-auto pr-1">
      <!-- ========== 文档（阅读） ========== -->
      <div v-if="activeView === 'docs'" class="space-y-3 pb-1">
        <CollapsiblePanel
          v-model="requestOpen"
          :title="t('apiDetail.parametersTitle')"
          :subtitle="t('apiDetail.parametersHint')"
        >
          <div class="p-4">
            <div
              v-if="api.parameters.length === 0"
              class="empty-state px-4 py-6"
            >
              {{ t('apiDetail.noParameters') }}
            </div>

            <div v-else class="surface-inset overflow-hidden">
              <div
                class="table-header-row grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 px-3"
              >
                <span>{{ t('common.name') }}</span>
                <span>{{ t('apiDetail.paramLocation') }}</span>
                <span>{{ t('common.type') }}</span>
                <span>{{ t('common.description') }}</span>
              </div>
              <template
                v-for="param in api.parameters"
                :key="`${param.in}-${param.name}`"
              >
                <div
                  class="group grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 border-b px-3 py-2 text-xs"
                  style="
                    border-color: color-mix(
                      in srgb,
                      var(--ui-border) 68%,
                      transparent
                    );
                  "
                >
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span
                      class="truncate font-mono"
                      style="color: var(--ui-text)"
                      >{{ param.name }}</span
                    >
                    <CopyButton
                      :value="param.name"
                      :title="t('common.copyName')"
                    />
                    <span
                      v-if="param.required"
                      class="status-badge status-badge-danger shrink-0"
                      >{{ t('common.required') }}</span
                    >
                  </span>
                  <span style="color: var(--ui-text-muted)">{{
                    param.in
                  }}</span>
                  <span
                    class="truncate font-mono"
                    style="color: var(--ui-accent)"
                    >{{ paramTypeLabel(param) }}</span
                  >
                  <span
                    class="flex min-w-0 items-center gap-1"
                    style="color: var(--ui-text-muted)"
                    :title="param.description"
                  >
                    <span
                      :class="{
                        'line-clamp-1': !isDescExpanded(`${param.in}-${param.name}`) && isLongText(param.description || ''),
                      }"
                    >{{
                      param.description || t('common.noDescription')
                    }}</span>
                    <button
                      v-if="isLongText(param.description || '')"
                      type="button"
                      class="ml-0.5 inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                      style="color: var(--ui-accent)"
                      @click.stop="toggleDescExpand(`${param.in}-${param.name}`)"
                    >
                      {{ isDescExpanded(`${param.in}-${param.name}`) ? t('common.hide') : t('common.show') }}
                    </button>
                    <CopyButton
                      v-if="param.description"
                      :value="param.description"
                      :title="t('common.copyDescription')"
                    />
                  </span>
                </div>

                <div
                  v-if="hasParamSchemaDetails(param)"
                  class="border-b px-3 pb-3 pt-1 last:border-0"
                  style="
                    border-color: color-mix(
                      in srgb,
                      var(--ui-border) 68%,
                      transparent
                    );
                  "
                >
                  <div class="surface-muted p-2">
                    <SchemaTable
                      :schema="param.schema"
                      :required-fields="param.schema.required"
                    />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          v-if="api.requestBody"
          v-model="bodyOpen"
          :title="t('apiDetail.requestBodyTitle')"
          :subtitle="bodySubtitle"
        >
          <template #actions>
            <button
              type="button"
              class="ghost-button"
              @click.stop="
                bodySchemaView = bodySchemaView === 'table' ? 'code' : 'table'
              "
            >
              {{
                bodySchemaView === 'table'
                  ? t('common.code')
                  : t('common.table')
              }}
            </button>
          </template>

          <div class="space-y-3 p-4">
            <p class="text-xs" style="color: var(--ui-text-muted)">
              {{ api.requestBody.description || '' }}
            </p>

            <template
              v-for="(mediaObj, mediaType) in api.requestBody.content || {}"
              :key="mediaType"
            >
              <div class="mb-1 text-[11px]" style="color: var(--ui-text-soft)">
                {{ mediaType }}
              </div>

              <pre
                v-if="bodySchemaView === 'code'"
                class="json-editor surface-sunken max-h-80 overflow-auto whitespace-pre-wrap p-3"
                >{{ prettyJson(mediaObj.schema || {}) }}</pre
              >

              <SchemaTable
                v-else
                :schema="mediaObj.schema || {}"
                :required-fields="(mediaObj.schema || {}).required"
              />
            </template>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          v-model="responseOpen"
          :title="t('apiDetail.documentedResponses')"
          :subtitle="t('apiDetail.documentedResponsesHint')"
        >
          <template #actions>
            <button
              type="button"
              class="ghost-button"
              @click.stop="
                respSchemaView = respSchemaView === 'table' ? 'code' : 'table'
              "
            >
              {{
                respSchemaView === 'table'
                  ? t('common.code')
                  : t('common.table')
              }}
            </button>
          </template>

          <div class="space-y-3 p-4">
            <div
              v-for="docResponse in api.responses"
              :key="docResponse.code || ''"
              class="surface-inset p-3"
            >
              <div class="mb-2 flex items-center gap-2">
                <span
                  class="status-badge text-[11px] font-semibold"
                  :class="responseMetaClass(docResponse.code)"
                >
                  {{ docResponse.code || 'default' }}
                </span>
                <span class="text-xs" style="color: var(--ui-text-muted)">{{
                  docResponse.description || t('common.noDescription')
                }}</span>
              </div>

              <template
                v-for="(mediaObj, mediaType) in docResponse.content || {}"
                :key="mediaType"
              >
                <div
                  class="mb-1 mt-3 text-[11px]"
                  style="color: var(--ui-text-soft)"
                >
                  {{ mediaType }}
                </div>

                <pre
                  v-if="mediaObj.schema && respSchemaView === 'code'"
                  class="json-editor surface-sunken max-h-48 overflow-auto whitespace-pre-wrap p-3"
                  >{{ prettyJson(mediaObj.schema) }}</pre
                >

                <SchemaTable
                  v-if="mediaObj.schema && respSchemaView === 'table'"
                  :schema="mediaObj.schema"
                  :required-fields="mediaObj.schema.required"
                />
              </template>
            </div>
          </div>
        </CollapsiblePanel>
      </div>

      <!-- ========== 调试（测试） ========== -->
      <div v-else class="space-y-3 pb-1">
        <CollapsiblePanel
          v-model="requestOpen"
          :title="t('apiDetail.request')"
          :subtitle="t('apiDetail.requestSubtitle')"
        >
          <div class="space-y-3 p-4">
            <CollapsiblePanel
              v-if="pathParamsList.length > 0"
              v-model="pathOpen"
              :title="t('apiDetail.pathParams')"
              :subtitle="pathParamsSubtitle"
              body-class="p-4"
            >
              <PathParamsEditor
                :params="pathParamsList"
                :model-value="pathParams"
                @update:model-value="
                  (value: Record<string, string>) => (pathParams = value)
                "
              />
            </CollapsiblePanel>

            <CollapsiblePanel
              v-if="queryParamsList.length > 0"
              v-model="queryOpen"
              :title="t('apiDetail.queryParams')"
              :subtitle="queryParamsSubtitle"
              body-class="p-4"
            >
              <QueryParamsEditor
                :params="queryParamsList"
                :model-value="queryParams"
                @update:model-value="
                  (value: Record<string, string>) => (queryParams = value)
                "
              />
            </CollapsiblePanel>

            <CollapsiblePanel
              v-if="cookieParamsList.length > 0"
              v-model="cookieOpen"
              :title="t('apiDetail.cookieParams')"
              :subtitle="cookieParamsSubtitle"
              body-class="p-4"
            >
              <QueryParamsEditor
                :params="cookieParamsList"
                :model-value="cookieParams"
                @update:model-value="
                  (value: Record<string, string>) => (cookieParams = value)
                "
              />
            </CollapsiblePanel>

            <CollapsiblePanel
              v-model="headersOpen"
              :title="t('common.headers')"
              :subtitle="headersSubtitle"
              body-class="p-4"
            >
              <HeadersEditor
                :model-value="requestHeaders"
                @update:model-value="
                  (value: Record<string, string>) => (requestHeaders = value)
                "
              />
            </CollapsiblePanel>

            <CollapsiblePanel
              v-if="isBodyMethod"
              v-model="bodyOpen"
              :title="t('common.body')"
              :subtitle="bodySubtitle"
              body-class="p-4"
            >
              <template #actions>
                <ModeSwitch
                  v-if="canUseFormBody"
                  :model-value="bodyMode"
                  @update:model-value="onModeChange"
                />
              </template>

              <div class="space-y-4">
                <label
                  v-if="requestMediaTypes.length > 1"
                  class="block text-xs"
                  style="color: var(--ui-text-muted)"
                >
                  <span class="mb-1 block">{{
                    t('apiDetail.requestMediaType')
                  }}</span>
                  <select
                    v-model="requestMediaType"
                    class="field-input w-full px-2 py-1.5 text-xs font-mono"
                  >
                    <option
                      v-for="mediaType in requestMediaTypes"
                      :key="mediaType"
                      :value="mediaType"
                    >
                      {{ mediaType }}
                    </option>
                  </select>
                </label>

                <div
                  v-if="
                    bodyMode === 'form' &&
                    canUseFormBody &&
                    formFields.length > 0
                  "
                  class="surface-inset max-h-[20rem] overflow-auto p-2"
                >
                  <SmartForm
                    :fields="formFields"
                    :depth="0"
                    @update:fields="
                      (value: FormField[]) => (formFields = value)
                    "
                  />
                </div>

                <JsonBodyEditor
                  v-else
                  :model-value="requestBody"
                  :label="
                    isJsonMediaType(requestMediaType)
                      ? t('requestEditor.jsonBody')
                      : t('requestEditor.rawBody')
                  "
                  :validate-json="isJsonMediaType(requestMediaType)"
                  @update:model-value="(value: string) => (requestBody = value)"
                />
              </div>
            </CollapsiblePanel>

            <div class="action-bar sticky bottom-0 p-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-1">
                  <p
                    class="text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style="color: var(--ui-text-soft)"
                  >
                    {{ t('apiDetail.tryRequest') }}
                  </p>
                  <p class="text-xs" style="color: var(--ui-text-muted)">
                    {{ tryRequestSummary }}
                  </p>
                </div>

                <button
                  type="button"
                  :disabled="sending"
                  class="toolbar-button toolbar-button-primary min-w-[168px] px-5 text-sm font-semibold"
                  @click="handleSend"
                >
                  <span
                    v-if="sending"
                    class="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
                  />
                  <span>{{
                    sending
                      ? t('apiDetail.sending')
                      : t('apiDetail.sendRequest')
                  }}</span>
                </button>
              </div>

              <div
                v-if="buildError"
                class="ui-alert ui-alert-danger mt-3 text-xs"
              >
                {{ buildError.message }}
              </div>
            </div>
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          v-model="responseOpen"
          :title="t('common.response')"
          :subtitle="t('apiDetail.responseSubtitle')"
        >
          <div class="space-y-4 p-4">
            <div class="flex flex-wrap items-center gap-2">
              <span
                v-if="response"
                class="status-badge px-2.5 py-1 text-xs font-semibold"
                :class="responseBadgeClass(response.status)"
              >
                {{ response.status || 'ERR' }} {{ response.statusText }}
              </span>
              <span v-if="response" class="meta-badge">
                {{ formatResponseTime(response.duration) }}
              </span>
              <span
                v-if="response?.success && response.status < 400"
                class="status-badge status-badge-success"
              >
                {{ t('common.success') }}
              </span>
              <span
                v-if="!response"
                class="text-sm"
                style="color: var(--ui-text-muted)"
              >
                {{ t('apiDetail.emptyResponse') }}
              </span>
            </div>

            <div
              v-if="response?.error"
              class="ui-alert ui-alert-danger text-sm"
            >
              {{ response.error }}
            </div>

            <section class="surface-inset p-3">
              <div class="mb-3">
                <p
                  class="text-xs font-semibold uppercase tracking-[0.14em]"
                  style="color: var(--ui-text-soft)"
                >
                  {{ responsePayloadTitle }}
                </p>
                <p class="mt-1 text-xs" style="color: var(--ui-text-muted)">
                  {{ responsePayloadHint }}
                </p>
                <p
                  v-if="
                    response?.contentType || response?.bodySize !== undefined
                  "
                  class="mt-1 text-[11px] font-mono"
                  style="color: var(--ui-text-soft)"
                >
                  {{ response?.contentType || 'application/octet-stream' }}
                  <span v-if="response?.bodySize !== undefined">
                    · {{ formatBytes(response.bodySize) }}
                  </span>
                </p>
              </div>

              <div
                v-if="response"
                class="surface-sunken max-h-[28rem] overflow-auto p-3"
              >
                <JsonTreeView
                  v-if="
                    responseTreeData !== null &&
                    typeof responseTreeData === 'object'
                  "
                  :value="responseTreeData"
                  :name="t('common.root')"
                />
                <pre
                  v-else
                  class="json-editor whitespace-pre-wrap"
                  style="color: var(--ui-code-text)"
                  >{{ responseBodyDisplay }}</pre
                >
              </div>

              <div v-else class="empty-state px-4 py-8">
                {{ t('apiDetail.emptyResponseBody') }}
              </div>

              <details v-if="response" class="surface-muted mt-3 px-3 py-2">
                <summary
                  class="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em]"
                  style="color: var(--ui-text-muted)"
                >
                  {{ t('common.headers') }} ({{
                    Object.keys(response.headers || {}).length
                  }})
                </summary>
                <div class="mt-3 space-y-2">
                  <div
                    v-for="(value, key) in response.headers"
                    :key="key"
                    class="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-xs"
                  >
                    <span
                      class="font-mono"
                      style="color: var(--ui-text-soft)"
                      >{{ key }}</span
                    >
                    <span
                      class="break-all"
                      style="color: var(--ui-code-text)"
                      >{{ value }}</span
                    >
                  </div>
                </div>
              </details>
            </section>
          </div>
        </CollapsiblePanel>
      </div>
    </div>
  </div>
</template>
