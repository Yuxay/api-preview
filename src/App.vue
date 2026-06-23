<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSwagger } from '@/composables/useSwagger'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { getToken, getUiState, saveToken, saveUiState } from '@/utils/storage'
import UrlBar from '@/components/UrlBar.vue'
import TagSidebar from '@/components/TagSidebar.vue'
import ApiList from '@/components/ApiList.vue'
import ApiDetail from '@/components/ApiDetail.vue'
import DiffView from '@/components/DiffView.vue'
import ApiExportDialog from '@/components/ApiExportDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'
import type { ApiItem } from '@/core/types'

const {
  loading,
  error,
  sources,
  selectedSource,
  apis,
  tags,
  selectedTag,
  selectedApi,
  searchQuery,
  searchResults,
  displayedApis,
  diffResults,
  hasDiff,
  showDiff,
  renameSource,
  addSource,
  removeSource,
  reloadAll,
  cancelLoading,
  moveSource,
  selectTag,
  selectApi,
} = useSwagger()

const globalToken = ref('')
const sidebarCollapsed = ref(getUiState('sidebar-collapsed', false))
const apiListCollapsed = ref(getUiState('apilist-collapsed', false))
const showExport = ref(false)
const exportInitialSelected = ref<ApiItem[]>([])
const { t } = useI18n()

const exportApis = computed(() => {
  if (!selectedSource.value || selectedSource.value === '__ALL__') return apis.value
  return apis.value.filter((api) => api.sourceId === selectedSource.value)
})

function openExport(initialSelected: ApiItem[] = []) {
  exportInitialSelected.value = initialSelected
  showExport.value = true
}

watch(sidebarCollapsed, (value) => saveUiState('sidebar-collapsed', value))
watch(apiListCollapsed, (value) => saveUiState('apilist-collapsed', value))
const { themeMode, setThemeMode } = useTheme()

onMounted(async () => {
  globalToken.value = await getToken()
})

async function onTokenChange(token: string) {
  globalToken.value = token
  await saveToken(token)
}

async function onAddSource(name: string, url: string) {
  await addSource(name, url)
}

function onThemeModeChange(mode: ThemeMode) {
  setThemeMode(mode)
}

function onSelectSource(id: string) {
  selectedSource.value = id
  selectedApi.value = null
  selectedTag.value = ''
}

function toggleDiff() {
  showDiff.value = !showDiff.value
}

const currentServers = computed(() => {
  if (!selectedApi.value?.sourceId) return undefined
  const src = sources.value.find((s) => s.id === selectedApi.value?.sourceId)
  return src?.spec?.servers
})

const totalApiCount = computed(() => {
  if (!selectedSource.value || selectedSource.value === '__ALL__') return apis.value.length
  return apis.value.filter((a) => a.sourceId === selectedSource.value).length
})

const tagCounts = computed<Record<string, number>>(() => {
  const items = !selectedSource.value || selectedSource.value === '__ALL__'
    ? apis.value
    : apis.value.filter((api) => api.sourceId === selectedSource.value)

  return items.reduce<Record<string, number>>((acc, api) => {
    acc[api.tag] = (acc[api.tag] || 0) + 1
    return acc
  }, {})
})

const impactedKeys = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const diff of diffResults.value) {
    for (const key of diff.impactedApiKeys || []) {
      set.add(key)
    }
  }
  return set
})

const diffChangeCount = computed(() =>
  diffResults.value.reduce(
    (sum, diff) => sum + diff.summary.added + diff.summary.removed + diff.summary.modified,
    0
  )
)

const layoutStyle = computed(() => ({
  gridTemplateColumns: [
    sidebarCollapsed.value ? '40px' : 'minmax(260px, 280px)',
    apiListCollapsed.value ? '40px' : 'minmax(340px, 380px)',
    'minmax(0, 1fr)',
  ].join(' '),
}))

function collapseSidebar() {
  sidebarCollapsed.value = true
}

function expandSidebar() {
  sidebarCollapsed.value = false
}

function collapseApiList() {
  apiListCollapsed.value = true
}

function expandApiList() {
  apiListCollapsed.value = false
}
</script>

<template>
  <div class="h-full bg-ui-canvas text-slate-100">
    <div class="relative flex h-full flex-col overflow-hidden">
      <UrlBar
        :token="globalToken"
        :loading="loading"
        :sources="sources"
        :selected-source="selectedSource"
        :search-query="searchQuery"
        :has-diff="hasDiff"
        :show-diff="showDiff"
        :diff-count="diffChangeCount"
        :theme-mode="themeMode"
        @add-source="onAddSource"
        @select-source="onSelectSource"
        @remove-source="(id: string) => removeSource(id)"
        @reload="reloadAll"
        @cancel-loading="cancelLoading"
        @toggle-diff="toggleDiff"
        @open-export="openExport()"
        @update:theme-mode="onThemeModeChange"
        @update:token="onTokenChange"
        @update:search-query="(value: string) => searchQuery = value"
      />

      <ApiExportDialog
        :open="showExport"
        :apis="exportApis"
        :sources="sources"
        :initial-selected="exportInitialSelected"
        @close="showExport = false"
      />

      <div
        v-if="error"
        class="mx-3 mt-2 flex items-start justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-200"
      >
        <span class="min-w-0 flex-1">{{ error }}</span>
        <button
          type="button"
          class="shrink-0 rounded-md p-0.5 text-red-500 transition hover:bg-red-500/20 hover:text-red-700 dark:text-red-300 dark:hover:text-red-100"
          :title="t('common.close')"
          @click="error = ''"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>

      <div class="flex-1 overflow-hidden px-3 pb-3 pt-2">
        <div
          v-if="sources.length === 0 && !loading"
          class="panel-surface flex h-full items-center justify-center"
        >
          <div class="max-w-xl space-y-4 text-center">
            <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-400/15 bg-sky-400/[0.08]">
              <AppIcon name="file-text" :size="32" class="text-sky-400" />
            </div>
            <div class="space-y-2">
              <h1 class="text-2xl font-semibold text-slate-100">ApiPreview</h1>
              <p class="text-sm leading-6 text-slate-400">
                {{ t('app.intro') }}
              </p>
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/[0.08] px-4 py-2 text-sm font-medium text-sky-300 transition hover:bg-sky-400/[0.15] hover:text-sky-200"
                @click="onAddSource('Swagger Petstore (示例)', 'example://petstore')"
              >
                <AppIcon name="file-text" :size="16" />
                {{ t('urlBar.loadExample') }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-else-if="loading && sources.length === 0"
          class="panel-surface flex h-full items-center justify-center"
        >
          <div class="space-y-3 text-center">
            <div class="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
            <p class="text-sm text-slate-400">{{ t('app.loadingDocs') }}</p>
          </div>
        </div>

        <div v-else class="grid layout-grid h-full min-h-0 gap-3" :style="layoutStyle">
          <!-- 第一栏：工作区 -->
          <TagSidebar
            v-if="!sidebarCollapsed"
            :sources="sources"
            :selected-source="selectedSource"
            :tags="tags"
            :selected-tag="selectedTag"
            :api-count="totalApiCount"
            :tag-counts="tagCounts"
            :diff-results="diffResults"
            @select-tag="selectTag"
            @select-source="onSelectSource"
            @remove-source="(id: string) => removeSource(id)"
            @rename-source="(id: string, name: string) => renameSource(id, name)"
            @move-source="(draggedId: string, targetId: string) => moveSource(draggedId, targetId)"
            @toggle-sidebar="collapseSidebar"
          />

          <!-- 侧边栏收起 → 竖向窄条 -->
          <button
            v-if="sidebarCollapsed"
            type="button"
            class="panel-surface flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden px-1 transition hover:bg-white/[0.02]"
            :title="t('common.show')"
            @click="expandSidebar"
          >
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500" style="writing-mode: vertical-rl;">
              {{ t('sidebar.workspace') }}
            </span>
            <AppIcon name="chevron-right" :size="14" class="shrink-0 text-slate-500" />
          </button>

          <!-- 第二栏：API 列表 -->
          <ApiList
            v-if="!apiListCollapsed"
            :apis="displayedApis"
            :search-results="searchResults"
            :selected-api="selectedApi"
            :search-query="searchQuery"
            :sources="sources"
            :impacted-keys="impactedKeys"
            @select="selectApi"
            @export-api="(api: ApiItem) => openExport([api])"
            @toggle-collapse="collapseApiList"
          />

          <!-- API 列表收起 → 竖向窄条 -->
          <button
            v-if="apiListCollapsed"
            type="button"
            class="panel-surface flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden px-1 transition hover:bg-white/[0.02]"
            :title="t('common.show')"
            @click="expandApiList"
          >
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500" style="writing-mode: vertical-rl;">
              {{ t('explorer.title') }}
            </span>
            <AppIcon name="chevron-right" :size="14" class="shrink-0 text-slate-500" />
          </button>

          <div class="flex min-w-0 flex-col gap-3 overflow-hidden">
            <ApiDetail
              v-if="selectedApi"
              :api="selectedApi"
              :servers="currentServers"
              :token="globalToken"
              @export-api="(api: ApiItem) => openExport([api])"
            />

            <div
              v-else
              class="panel-surface flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center text-sm text-slate-400"
            >
              <AppIcon name="code" :size="40" class="text-slate-600" />
              <p>{{ t('app.selectApiHint') }}</p>
            </div>

            <div
              v-if="showDiff && diffResults.length > 0"
              class="grid max-h-[32rem] gap-3 overflow-auto pr-1"
            >
              <DiffView
                v-for="diff in diffResults"
                :key="diff.sourceId"
                :diff="diff"
                @close="showDiff = false"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
