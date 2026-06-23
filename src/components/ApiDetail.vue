<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ApiItem, ApiParameter } from '@/core/types'
import type { FormField } from '@/core/schemaFormEngine'
import { schemaToFormFields, formFieldsToBody } from '@/core/schemaFormEngine'
import { buildRequest, type RequestBuildError, type RequestConfig } from '@/core/requestRuntime'
import { sendRequest, type ProxyResponse } from '@/services/httpClient'
import { getUiState, saveUiState } from '@/utils/storage'
import { formatResponseTime, getMethodColor, joinUrl, prettyJson, tryParseJson } from '@/utils/format'
import CollapsiblePanel from '@/components/CollapsiblePanel.vue'
import CopyButton from '@/components/CopyButton.vue'
import HeadersEditor from '@/components/HeadersEditor.vue'
import JsonBodyEditor from '@/components/JsonBodyEditor.vue'
import JsonTreeView from '@/components/JsonTreeView.vue'
import ModeSwitch from '@/components/ModeSwitch.vue'
import PathParamsEditor from '@/components/PathParamsEditor.vue'
import QueryParamsEditor from '@/components/QueryParamsEditor.vue'
import SchemaTable from '@/components/SchemaTable.vue'
import SmartForm from '@/components/SmartForm.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  api: ApiItem
  servers?: { url: string; description?: string }[]
  token: string
}>()

const emit = defineEmits<{
  'export-api': [api: ApiItem]
}>()

const activeView = ref<'docs' | 'test'>(getUiState<'docs' | 'test'>('detail-active-view', 'docs'))
const bodySchemaView = ref<'code' | 'table'>('table')
const respSchemaView = ref<'code' | 'table'>('table')
const requestOpen = ref(getUiState('detail-request-open', true))
const responseOpen = ref(getUiState('detail-response-open', true))
const pathOpen = ref(getUiState('detail-path-open', true))
const queryOpen = ref(getUiState('detail-query-open', true))
const headersOpen = ref(getUiState('detail-headers-open', false))
const bodyOpen = ref(getUiState('detail-body-open', true))

const pathParams = ref<Record<string, string>>({})
const queryParams = ref<Record<string, string>>({})
const requestHeaders = ref<Record<string, string>>({})
const requestBody = ref('')
const bodyMode = ref<'form' | 'json'>('form')
const formFields = ref<FormField[]>([])
const sending = ref(false)
const response = ref<ProxyResponse | null>(null)
const buildError = ref<RequestBuildError | null>(null)
const { t } = useI18n()

watch(activeView, (value) => saveUiState('detail-active-view', value))

for (const [key, state] of [
  ['detail-request-open', requestOpen],
  ['detail-response-open', responseOpen],
  ['detail-path-open', pathOpen],
  ['detail-query-open', queryOpen],
  ['detail-headers-open', headersOpen],
  ['detail-body-open', bodyOpen],
] as const) {
  watch(state, (value) => saveUiState(key, value))
}

const bodySchema = computed(() => props.api.requestBody?.content?.['application/json']?.schema)
const requiredFields = computed(() => bodySchema.value?.required || [])
const hasBodySchema = computed(() => !!(bodySchema.value?.properties || bodySchema.value?.type))
const pathParamsList = computed(() => props.api.parameters.filter((param) => param.in === 'path'))
const queryParamsList = computed(() => props.api.parameters.filter((param) => param.in === 'query'))
const headerParamsList = computed(() => props.api.parameters.filter((param) => param.in === 'header'))
const isBodyMethod = computed(() => ['POST', 'PUT', 'PATCH'].includes(props.api.method.toUpperCase()))
const parsedResponse = computed(() => (response.value ? tryParseJson(response.value.body) : null))
const responseBodyDisplay = computed(() => {
  if (!response.value) return ''
  if (parsedResponse.value?.ok) return prettyJson(parsedResponse.value.data)
  return response.value.body
})
const responseTreeData = computed(() => {
  if (!parsedResponse.value?.ok) return null
  return parsedResponse.value.data
})
const serverBase = computed(() => props.servers?.[0]?.url || '')
const activeServer = computed(() => serverBase.value || t('apiDetail.serverFallback'))
const fullUrl = computed(() => joinUrl(serverBase.value, props.api.path))
const pathParamsSubtitle = computed(() => t('meta.parameterCount', { count: pathParamsList.value.length }))
const queryParamsSubtitle = computed(() => t('meta.parameterCount', { count: queryParamsList.value.length }))
const headersSubtitle = computed(() => t('meta.headerCount', { count: Object.keys(requestHeaders.value).length }))
const bodySubtitle = computed(() =>
  props.api.requestBody?.required ? t('apiDetail.requiredRequestBody') : t('apiDetail.optionalRequestBody')
)
const tryRequestSummary = computed(() =>
  t('apiDetail.tryRequestSummary', {
    pathCount: pathParamsList.value.length,
    queryCount: queryParamsList.value.length,
    headerCount: headerParamsList.value.length,
  })
)

watch(
  () => props.api,
  (api) => {
    const nextPathParams: Record<string, string> = {}
    for (const param of api.parameters.filter((item) => item.in === 'path')) {
      nextPathParams[param.name] = stringifyValue(resolveExample(param))
    }
    pathParams.value = nextPathParams

    const nextQueryParams: Record<string, string> = {}
    for (const param of api.parameters.filter((item) => item.in === 'query')) {
      nextQueryParams[param.name] = stringifyValue(resolveExample(param))
    }
    queryParams.value = nextQueryParams

    const nextHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }
    if (props.token) {
      nextHeaders.Authorization = `Bearer ${props.token}`
    }
    for (const param of api.parameters.filter((item) => item.in === 'header')) {
      nextHeaders[param.name] = stringifyValue(resolveExample(param))
    }
    requestHeaders.value = nextHeaders

    if (bodySchema.value) {
      formFields.value = schemaToFormFields(bodySchema.value, requiredFields.value)
      requestBody.value = prettyJson(formFieldsToBody(formFields.value))
    } else {
      formFields.value = []
      requestBody.value = ''
    }

    bodyMode.value = 'form'
    bodySchemaView.value = 'table'
    respSchemaView.value = 'table'
    response.value = null
    buildError.value = null
  },
  { immediate: true }
)

watch(
  () => props.token,
  (token) => {
    if (token) {
      requestHeaders.value.Authorization = `Bearer ${token}`
    } else {
      delete requestHeaders.value.Authorization
    }
  }
)

function resolveExample(param: ApiParameter): unknown {
  return param.example ?? param.schema?.example ?? param.schema?.default ?? ''
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function paramTypeLabel(param: ApiParameter): string {
  const schema = param.schema
  if (!schema) return '-'
  if (schema.oneOf?.length) return 'oneOf'
  if (schema.anyOf?.length) return 'anyOf'
  if (schema.allOf?.length) return 'allOf'
  if (schema.$ref) return schema.$ref.split('/').pop() || schema.$ref
  if (schema.type === 'array') {
    return `${schema.items?.type || 'any'}[]`
  }
  if ((schema.type === 'object' || !schema.type) && schema.properties) {
    return 'object'
  }
  return [schema.type, schema.format].filter(Boolean).join(' / ') || '-'
}

function hasParamSchemaDetails(param: ApiParameter): boolean {
  const schema = param.schema
  if (!schema) return false
  if (schema.oneOf?.length || schema.anyOf?.length || schema.allOf?.length) return true
  if (schema.type === 'array' && !!schema.items) return true
  return !!((schema.type === 'object' || !schema.type) && schema.properties && Object.keys(schema.properties).length > 0)
}

function onModeChange(mode: 'form' | 'json') {
  if (mode === 'json' && bodyMode.value === 'form' && formFields.value.length > 0) {
    requestBody.value = prettyJson(formFieldsToBody(formFields.value))
  } else if (mode === 'form' && bodyMode.value === 'json') {
    const parsed = tryParseJson(requestBody.value)
    if (parsed.ok && typeof parsed.data === 'object' && parsed.data !== null) {
      updateFormFieldsFromObject(formFields.value, parsed.data as Record<string, unknown>)
    }
  }
  bodyMode.value = mode
}

function updateFormFieldsFromObject(fields: FormField[], data: Record<string, unknown>) {
  for (const field of fields) {
    const value = data[field.key]
    if (value === undefined) continue
    if (field.type === 'object' && field.children && typeof value === 'object' && value !== null) {
      field.value = value
      updateFormFieldsFromObject(field.children, value as Record<string, unknown>)
      continue
    }
    field.value = value
  }
}

async function handleSend() {
  buildError.value = null
  sending.value = true
  response.value = null

  let bodyStr = requestBody.value
  if (bodyMode.value === 'form' && formFields.value.length > 0) {
    bodyStr = prettyJson(formFieldsToBody(formFields.value))
  }

  const result = buildRequest(props.api, {
    servers: props.servers,
    token: props.token,
    pathParams: pathParams.value,
    queryParams: queryParams.value,
    headers: requestHeaders.value,
    body: isBodyMethod.value ? bodyStr : '',
  })

  if (!result.ok) {
    buildError.value = result.error!
    sending.value = false
    return
  }

  const config: RequestConfig = result.config!

  try {
    response.value = await sendRequest({
      url: config.url,
      method: config.method,
      headers: config.headers,
      body: config.body,
    })
  } catch (error: any) {
    response.value = {
      success: false,
      status: 0,
      statusText: t('common.error'),
      headers: {},
      body: '',
      error: error.message,
      duration: 0,
    }
  } finally {
    sending.value = false
  }
}

function responseBadgeClass(status: number) {
  if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-300'
  if (status >= 400 || status === 0) return 'bg-red-500/15 text-red-300'
  return 'bg-amber-500/15 text-amber-300'
}

function responseMetaClass(code?: string) {
  const status = Number(code || 0)
  if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-300'
  if (status >= 400) return 'bg-red-500/15 text-red-300'
  return 'bg-amber-500/15 text-amber-300'
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
    <section class="panel-surface group shrink-0 px-5 py-3.5">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center rounded-lg border border-white/10 px-2.5 py-1 text-xs font-semibold uppercase"
          :class="getMethodColor(api.method)"
        >
          {{ api.method }}
        </span>
        <span class="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-400">
          {{ api.sourceName || t('common.defaultSource') }}
        </span>
        <span class="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-500">
          {{ api.tag }}
        </span>
        <span class="ml-auto rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-500">
          {{ t('common.parameters') }} {{ api.parameters.length }}
        </span>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400 transition hover:border-sky-400/30 hover:bg-sky-400/[0.06] hover:text-sky-300"
          :title="t('aiExport.quickExport')"
          @click="emit('export-api', api)"
        >
          <AppIcon name="code" :size="14" />
          {{ t('aiExport.entry') }}
        </button>
      </div>

      <div class="mt-2.5 flex min-w-0 items-center gap-1.5">
        <h2 class="min-w-0 truncate font-mono text-base text-slate-100" :title="api.path">{{ api.path }}</h2>
        <CopyButton :value="api.path" :title="t('common.copyPath')" />
      </div>

      <p class="mt-1.5 text-sm text-slate-300">{{ api.summary || api.description || t('common.noSummary') }}</p>
      <p v-if="api.summary && api.description" class="mt-1 text-xs leading-5 text-slate-500">
        {{ api.description }}
      </p>

      <div class="mt-2 flex min-w-0 items-center gap-2 text-xs text-slate-500">
        <span class="shrink-0 font-semibold uppercase tracking-[0.16em]">{{ t('common.server') }}</span>
        <span class="min-w-0 truncate font-mono text-slate-400" :title="activeServer">{{ activeServer }}</span>
      </div>

      <div class="mt-3 flex items-center gap-1 border-t border-white/10 pt-3">
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
        <span class="ml-2 hidden text-xs text-slate-500 sm:inline">
          {{ activeView === 'docs' ? t('apiDetail.docsTabHint') : t('apiDetail.testTabHint') }}
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
              class="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500"
            >
              {{ t('apiDetail.noParameters') }}
            </div>

            <div v-else class="surface-inset overflow-hidden">
              <div class="grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 border-b border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                <span>{{ t('common.name') }}</span>
                <span>{{ t('apiDetail.paramLocation') }}</span>
                <span>{{ t('common.type') }}</span>
                <span>{{ t('common.description') }}</span>
              </div>
              <template v-for="param in api.parameters" :key="`${param.in}-${param.name}`">
                <div
                  class="group grid grid-cols-[minmax(0,1.4fr)_88px_minmax(0,1fr)_minmax(0,1.6fr)] gap-2 border-b border-white/5 px-3 py-2 text-xs"
                >
                  <span class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate font-mono text-slate-200">{{ param.name }}</span>
                    <CopyButton :value="param.name" :title="t('common.copyName')" />
                    <span
                      v-if="param.required"
                      class="shrink-0 rounded bg-red-500/15 px-1 py-0.5 text-[10px] text-red-300"
                    >{{ t('common.required') }}</span>
                  </span>
                  <span class="text-slate-400">{{ param.in }}</span>
                  <span class="truncate font-mono text-sky-300/80">{{ paramTypeLabel(param) }}</span>
                  <span class="flex min-w-0 items-center gap-1 truncate text-slate-400" :title="param.description">
                    <span class="truncate">{{ param.description || t('common.noDescription') }}</span>
                    <CopyButton
                      v-if="param.description"
                      :value="param.description"
                      :title="t('common.copyDescription')"
                    />
                  </span>
                </div>

                <div
                  v-if="hasParamSchemaDetails(param)"
                  class="border-b border-white/5 px-3 pb-3 pt-1 last:border-0"
                >
                  <div class="rounded-lg border border-white/10 bg-white/[0.02] p-2">
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
              class="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 transition hover:border-white/15 hover:bg-white/[0.03] hover:text-slate-200"
              @click.stop="bodySchemaView = bodySchemaView === 'table' ? 'code' : 'table'"
            >
              {{ bodySchemaView === 'table' ? t('common.code') : t('common.table') }}
            </button>
          </template>

          <div class="space-y-3 p-4">
            <p class="text-xs text-slate-400">{{ api.requestBody.description || '' }}</p>

            <template v-for="(mediaObj, mediaType) in (api.requestBody.content || {})" :key="mediaType">
              <div class="mb-1 text-[11px] text-slate-500">{{ mediaType }}</div>

              <pre
                v-if="bodySchemaView === 'code'"
                class="json-editor surface-sunken max-h-80 overflow-auto whitespace-pre-wrap p-3"
              >{{ prettyJson(mediaObj.schema || {}) }}</pre>

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
              class="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 transition hover:border-white/15 hover:bg-white/[0.03] hover:text-slate-200"
              @click.stop="respSchemaView = respSchemaView === 'table' ? 'code' : 'table'"
            >
              {{ respSchemaView === 'table' ? t('common.code') : t('common.table') }}
            </button>
          </template>

          <div class="space-y-3 p-4">
            <div
              v-for="docResponse in api.responses"
              :key="docResponse.code || ''"
              class="surface-inset p-3"
            >
              <div class="mb-2 flex items-center gap-2">
                <span class="rounded-lg px-2 py-1 text-[11px] font-semibold" :class="responseMetaClass(docResponse.code)">
                  {{ docResponse.code || 'default' }}
                </span>
                <span class="text-xs text-slate-400">{{ docResponse.description || t('common.noDescription') }}</span>
              </div>

              <template v-for="(mediaObj, mediaType) in (docResponse.content || {})" :key="mediaType">
                <div class="mb-1 mt-3 text-[11px] text-slate-500">{{ mediaType }}</div>

                <pre
                  v-if="mediaObj.schema && respSchemaView === 'code'"
                  class="json-editor surface-sunken max-h-48 overflow-auto whitespace-pre-wrap p-3"
                >{{ prettyJson(mediaObj.schema) }}</pre>

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
                @update:model-value="(value: Record<string, string>) => pathParams = value"
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
                @update:model-value="(value: Record<string, string>) => queryParams = value"
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
                @update:model-value="(value: Record<string, string>) => requestHeaders = value"
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
                  v-if="hasBodySchema"
                  :model-value="bodyMode"
                  @update:model-value="onModeChange"
                />
              </template>

              <div class="space-y-4">
                <div
                  v-if="bodyMode === 'form' && formFields.length > 0"
                  class="surface-inset max-h-[20rem] overflow-auto p-2"
                >
                  <SmartForm
                    :fields="formFields"
                    :depth="0"
                    @update:fields="(value: FormField[]) => formFields = value"
                  />
                </div>

                <JsonBodyEditor
                  v-else
                  :model-value="requestBody"
                  @update:model-value="(value: string) => requestBody = value"
                />
              </div>
            </CollapsiblePanel>

            <div class="action-bar sticky bottom-0 p-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{{ t('apiDetail.tryRequest') }}</p>
                  <p class="text-xs text-slate-400">
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
                  <span>{{ sending ? t('apiDetail.sending') : t('apiDetail.sendRequest') }}</span>
                </button>
              </div>

              <div
                v-if="buildError"
                class="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
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
                class="rounded-lg px-2.5 py-1 text-xs font-semibold"
                :class="responseBadgeClass(response.status)"
              >
                {{ response.status || 'ERR' }} {{ response.statusText }}
              </span>
              <span
                v-if="response"
                class="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-400"
              >
                {{ formatResponseTime(response.duration) }}
              </span>
              <span
                v-if="response?.success && response.status < 400"
                class="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"
              >
                {{ t('common.success') }}
              </span>
              <span v-if="!response" class="text-sm text-slate-400">
                {{ t('apiDetail.emptyResponse') }}
              </span>
            </div>

            <div
              v-if="response?.error"
              class="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {{ response.error }}
            </div>

            <section class="surface-inset p-3">
              <div class="mb-3">
                <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{{ t('apiDetail.runtimePayload') }}</p>
                <p class="mt-1 text-xs text-slate-400">{{ t('apiDetail.runtimePayloadHint') }}</p>
              </div>

              <div v-if="response" class="surface-sunken max-h-[28rem] overflow-auto p-3">
                <JsonTreeView
                  v-if="responseTreeData !== null && typeof responseTreeData === 'object'"
                  :value="responseTreeData"
                  :name="t('common.root')"
                />
                <pre
                  v-else
                  class="json-editor whitespace-pre-wrap text-slate-300"
                >{{ responseBodyDisplay }}</pre>
              </div>

              <div
                v-else
                class="rounded-lg border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500"
              >
                {{ t('apiDetail.emptyResponseBody') }}
              </div>

              <details
                v-if="response"
                class="mt-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
              >
                <summary class="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {{ t('common.headers') }} ({{ Object.keys(response.headers || {}).length }})
                </summary>
                <div class="mt-3 space-y-2">
                  <div
                    v-for="(value, key) in response.headers"
                    :key="key"
                    class="grid grid-cols-[160px_minmax(0,1fr)] gap-3 text-xs"
                  >
                    <span class="font-mono text-slate-500">{{ key }}</span>
                    <span class="break-all text-slate-300">{{ value }}</span>
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
