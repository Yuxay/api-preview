<script setup lang="ts">
import { computed } from 'vue'
import type { ApiItem, SwaggerSource } from '@/core/types'
import type { SearchResult } from '@/core/apiIndexEngine'
import { highlightMatch } from '@/core/apiIndexEngine'
import { getSourceColorById } from '@/services/swaggerMultiLoader'
import { getMethodColor, joinUrl } from '@/utils/format'
import CopyButton from '@/components/CopyButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  apis: ApiItem[]
  searchResults: SearchResult[]
  selectedApi: ApiItem | null
  searchQuery: string
  sources: SwaggerSource[]
  impactedKeys?: Set<string>
}>()

const emit = defineEmits<{
  select: [api: ApiItem]
  'export-api': [api: ApiItem]
  'toggle-collapse': []
}>()

const { t } = useI18n()

const sourceUrlMap = computed(() => {
  const map = new Map<string, string>()
  for (const source of props.sources) {
    map.set(source.id, source.url)
  }
  return map
})

const sourceServerMap = computed(() => {
  const map = new Map<string, string>()
  for (const source of props.sources) {
    map.set(source.id, source.spec?.servers?.[0]?.url || '')
  }
  return map
})

function fullUrl(api: ApiItem): string {
  return joinUrl(sourceServerMap.value.get(api.sourceId || '') || '', api.path)
}

function isImpacted(api: ApiItem): boolean {
  if (!props.impactedKeys || props.impactedKeys.size === 0) return false
  return props.impactedKeys.has(`${api.method.toUpperCase()}:${api.path}`)
}

function searchScore(apiId: string) {
  return props.searchResults.find((item) => item.api.id === apiId)?.score || 0
}
</script>

<template>
  <section class="panel-surface flex h-full min-h-0 flex-col overflow-hidden">
    <div class="flex items-start justify-between border-b border-white/10 px-4 py-4">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{{ t('common.search') }}</p>
        <div class="mt-1 flex items-end gap-3">
          <div>
            <h2 class="text-sm font-semibold text-slate-100">{{ t('explorer.title') }}</h2>
            <p class="mt-1 text-xs text-slate-400">
              {{ searchQuery ? t('explorer.searchLabel', { query: searchQuery }) : t('explorer.browseHint') }}
            </p>
          </div>
          <span class="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400">
            {{ t('meta.itemCount', { count: apis.length }) }}
          </span>
        </div>
      </div>
      <button
        type="button"
        class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white/10 hover:text-slate-300"
        :title="t('common.hide')"
        @click="emit('toggle-collapse')"
      >
        <AppIcon name="chevron-left" :size="14" />
      </button>
    </div>

    <div class="grid grid-cols-[72px_minmax(0,1fr)_minmax(120px,0.8fr)] gap-3 border-b border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      <span>{{ t('common.method') }}</span>
      <span>{{ t('common.path') }}</span>
      <span>{{ t('common.summary') }}</span>
    </div>

    <div class="flex-1 overflow-auto">
      <div
        v-if="searchQuery && apis.length === 0"
        class="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400"
      >
        {{ t('explorer.noMatch') }}
      </div>

      <div
        v-for="api in apis"
        :key="api.id"
        role="button"
        tabindex="0"
        class="table-row group grid w-full grid-cols-[72px_minmax(0,1fr)_minmax(120px,0.8fr)] gap-3 py-3 pl-3.5 pr-4 text-left"
        :class="[
          selectedApi?.id === api.id ? 'bg-sky-400/[0.07]' : '',
          api.sourceName && sources.length > 1 ? ['source-bar', getSourceColorById(api.sourceId || '', sources).bar] : 'border-l-2 border-l-transparent',
        ]"
        @click="emit('select', api)"
        @keydown.enter="emit('select', api)"
      >
        <div class="flex flex-col gap-2">
          <span
            class="inline-flex w-fit items-center rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold uppercase"
            :class="getMethodColor(api.method)"
          >
            {{ api.method }}
          </span>
          <span
            v-if="isImpacted(api)"
            class="w-fit rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300"
          >
            {{ t('common.impacted') }}
          </span>
        </div>

        <div class="min-w-0">
          <div class="flex items-center gap-1">
            <span
              class="min-w-0 truncate font-mono text-sm text-slate-100"
              v-html="highlightMatch(api.path, searchQuery)"
            />
            <CopyButton :value="api.path" :title="t('common.copyPath')" />
            <button
              type="button"
              class="inline-flex cursor-pointer align-middle text-slate-600 opacity-0 transition-opacity hover:text-sky-400 group-hover:opacity-100"
              :title="t('aiExport.quickExport')"
              @click.stop="emit('export-api', api)"
            >
              <AppIcon name="code" :size="12" />
            </button>
          </div>
          <div class="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
            <span v-if="api.operationId" class="truncate">{{ api.operationId }}</span>
            <span
              v-if="api.sourceName && sources.length > 1"
              class="truncate"
              :class="getSourceColorById(api.sourceId || '', sources).text"
            >◆ {{ api.sourceName }}</span>
          </div>
        </div>

        <div class="min-w-0">
          <div
            class="truncate text-sm text-slate-400"
            v-html="highlightMatch(api.summary || api.description || t('common.noSummary'), searchQuery)"
          />
          <div class="mt-1 flex items-center gap-2">
            <span
              v-if="api.sourceName && sources.length > 1"
              class="source-badge inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-medium"
              :class="[
                getSourceColorById(api.sourceId || '', sources).bg,
                getSourceColorById(api.sourceId || '', sources).text,
              ]"
              :title="sourceUrlMap.get(api.sourceId || '') || ''"
            >
              <span class="source-diamond source-marker-glow h-2 w-2 shrink-0" :class="[getSourceColorById(api.sourceId || '', sources).dot, getSourceColorById(api.sourceId || '', sources).text]" />
              <span class="truncate">{{ api.sourceName }}</span>
            </span>

            <span
              v-if="searchQuery"
              class="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500"
            >
              {{ t('meta.score', { score: searchScore(api.id) }) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="!searchQuery && apis.length === 0"
        class="flex h-full items-center justify-center px-6 text-center text-sm text-slate-400"
      >
        {{ t('explorer.empty') }}
      </div>
    </div>
  </section>
</template>
