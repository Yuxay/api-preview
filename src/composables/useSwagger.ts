import { computed, ref, watch, type Ref, type ComputedRef } from 'vue'
import type { ApiItem, SwaggerSource } from '@/core/types'
import type { ApiSearchEntry, SearchResult } from '@/core/apiIndexEngine'
import { buildSearchIndex, searchApis } from '@/core/apiIndexEngine'
import {
  loadSources,
  deriveSourceName,
  buildSourceId,
  type SourceInput,
} from '@/services/swaggerMultiLoader'
import { saveSnapshot, getSnapshot, extractSchemas } from '@/services/swaggerSnapshot'
import { getUiState, saveUiState, saveUrl } from '@/utils/storage'
import { diffApis, type DiffResult } from '@/core/apiDiffEngine'
import { computeAffectedApis } from '@/core/impactAnalysis'
import { groupByTag } from '@/core/openapiParser'
import { translate } from '@/i18n'

const SOURCE_ORDER_STORAGE_KEY = 'source-order'

export interface UseSwaggerReturn {
  // 状态
  url: Ref<string>
  loading: Ref<boolean>
  error: Ref<string>
  sources: Ref<SwaggerSource[]>
  selectedSource: Ref<string[]>
  apis: Ref<ApiItem[]>
  tagGroups: Ref<Map<string, ApiItem[]>>
  tags: ComputedRef<string[]>
  selectedTag: Ref<string>
  selectedApi: Ref<ApiItem | null>
  filteredApis: ComputedRef<ApiItem[]>

  // 搜索
  searchQuery: Ref<string>
  searchResults: ComputedRef<SearchResult[]>
  displayedApis: ComputedRef<ApiItem[]>

  // Diff
  diffResults: Ref<DiffResult[]>
  hasDiff: ComputedRef<boolean>
  showDiff: Ref<boolean>

  // 方法
  addSource: (name: string, url: string) => Promise<void>
  removeSource: (id: string) => void
  renameSource: (id: string, name: string) => Promise<void>
  reloadAll: () => Promise<void>
  cancelLoading: () => Promise<void>
  moveSource: (draggedId: string, targetId: string) => void
  selectTag: (tag: string) => void
  selectApi: (api: ApiItem) => void
}

export function useSwagger(): UseSwaggerReturn {
  const url = ref('')
  const loading = ref(false)
  const error = ref('')
  const sources = ref<SwaggerSource[]>([])
  const selectedSource = ref<string[]>([])
  const apis = ref<ApiItem[]>([])
  const tagGroups = ref<Map<string, ApiItem[]>>(new Map())
  const selectedTag = ref('')
  const selectedApi = ref<ApiItem | null>(null)
  const searchQuery = ref('')
  const searchIndex = ref<ApiSearchEntry[]>([])
  const diffResults = ref<DiffResult[]>([])
  const showDiff = ref(false)
  const storedSourceOrder = ref<string[]>(getUiState<string[]>(SOURCE_ORDER_STORAGE_KEY, []))
  let loadSeq = 0
  let activeLoad:
    | {
        id: number
        controller: AbortController | null
        requestIds: string[]
      }
    | null = null

  const tags = computed(() => [...tagGroups.value.keys()])

  // 当前 source 过滤后的 API（用于 tag 分组）
  const sourceFilteredApis = computed<ApiItem[]>(() => {
    if (selectedSource.value.length === 0) {
      return apis.value
    }
    return apis.value.filter((a) => selectedSource.value.includes(a.sourceId || ''))
  })

  const filteredApis = computed(() => {
    if (!selectedTag.value || selectedTag.value === '__ALL__') {
      return sourceFilteredApis.value
    }
    return sourceFilteredApis.value.filter((a) => a.tag === selectedTag.value)
  })

  const searchResults = computed<SearchResult[]>(() => {
    const q = searchQuery.value.trim()
    if (!q) return []
    return searchApis(searchIndex.value, q)
  })

  const displayedApis = computed<ApiItem[]>(() => {
    if (searchQuery.value.trim()) {
      return searchResults.value.map((r) => r.api)
    }
    return filteredApis.value
  })

  const hasDiff = computed(() =>
    diffResults.value.some(
      (d) =>
        d.summary.added > 0 ||
        d.summary.removed > 0 ||
        d.summary.modified > 0 ||
        d.schemas.length > 0
    )
  )

  function persistSourceOrder(nextSources: SwaggerSource[] = sources.value) {
    storedSourceOrder.value = nextSources.map((source) => source.id)
    saveUiState(SOURCE_ORDER_STORAGE_KEY, storedSourceOrder.value)
  }

  function orderSources(nextSources: SwaggerSource[]): SwaggerSource[] {
    const rank = new Map(storedSourceOrder.value.map((id, index) => [id, index]))
    return [...nextSources].sort((a, b) => {
      const aRank = rank.get(a.id)
      const bRank = rank.get(b.id)
      if (aRank !== undefined && bRank !== undefined) return aRank - bRank
      if (aRank !== undefined) return -1
      if (bRank !== undefined) return 1
      return 0
    })
  }

  function orderApis(nextApis: ApiItem[], orderedSources: SwaggerSource[]): ApiItem[] {
    const rank = new Map(orderedSources.map((source, index) => [source.id, index]))
    return [...nextApis].sort((a, b) => {
      const aRank = rank.get(a.sourceId || '') ?? Number.MAX_SAFE_INTEGER
      const bRank = rank.get(b.sourceId || '') ?? Number.MAX_SAFE_INTEGER
      if (aRank !== bRank) return aRank - bRank
      return a.id.localeCompare(b.id)
    })
  }

  function syncCollections(nextSources: SwaggerSource[], nextApis: ApiItem[]) {
    const orderedSources = orderSources(nextSources)
    sources.value = orderedSources
    apis.value = orderApis(nextApis, orderedSources)
    persistSourceOrder(orderedSources)
  }

  function beginLoad(inputs: SourceInput[]) {
    loadSeq += 1
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const requestIds = inputs.map((input) => `swagger-load:${loadSeq}:${input.id}`)
    activeLoad = {
      id: loadSeq,
      controller,
      requestIds,
    }
    return {
      id: loadSeq,
      abortSignal: controller?.signal,
      requestIdBySourceId: Object.fromEntries(
        inputs.map((input, index) => [input.id, requestIds[index]])
      ) as Record<string, string>,
    }
  }

  function isActiveLoad(loadId: number): boolean {
    return activeLoad?.id === loadId
  }

  function recalcTagGroups() {
    tagGroups.value = groupByTag(sourceFilteredApis.value)
    searchIndex.value = buildSearchIndex(sourceFilteredApis.value)
    const firstTag = [...tagGroups.value.keys()][0]
    if (firstTag && (!selectedTag.value || !tagGroups.value.has(selectedTag.value))) {
      selectedTag.value = firstTag
    }
  }

  // source 切换时重建搜索索引并更新标签分组
  watch(sourceFilteredApis, () => {
    searchIndex.value = buildSearchIndex(sourceFilteredApis.value)
    recalcTagGroups()
  })

  // ========== 多源操作 ==========

  async function runDiffForSource(source: SwaggerSource) {
    const newSchemas = extractSchemas(source.spec)
    const oldSnapshot = await getSnapshot(source.id)
    if (oldSnapshot && oldSnapshot.apis) {
      const diff = diffApis(
        source.id,
        source.name,
        oldSnapshot.apis,
        source.apis,
        oldSnapshot.timestamp,
        oldSnapshot.schemas,
        newSchemas
      )
      // 影响分析：反查引用了变更（modified/removed）DTO 的 API
      const changedDtos = diff.schemas
        .filter((s) => s.type === 'modified' || s.type === 'removed')
        .map((s) => s.name)
      if (changedDtos.length > 0) {
        diff.impactedApiKeys = [...computeAffectedApis(source.spec, changedDtos)]
      }
      // 合并到 diffResults（替换同 sourceId 的旧结果）
      diffResults.value = [
        ...diffResults.value.filter((d) => d.sourceId !== source.id),
        diff,
      ]
      if (
        diff.summary.added > 0 ||
        diff.summary.removed > 0 ||
        diff.summary.modified > 0 ||
        diff.schemas.length > 0
      ) {
        showDiff.value = true
      }
    }
    // 保存新快照
    await saveSnapshot(source.id, source.name, source.apis, newSchemas)
  }

  async function addSource(name: string, inputUrl: string): Promise<void> {
    url.value = inputUrl
    loading.value = true
    error.value = ''

    try {
      const srcName = name.trim() || deriveSourceName(inputUrl)
      const id = buildSourceId(inputUrl)

      if (sources.value.some((s) => s.id === id)) {
        error.value = translate('errors.duplicateSource', { url: inputUrl })
        return
      }

      const loadContext = beginLoad([{ id, name: srcName, url: inputUrl }])

      // 增量加载：仅拉取新源，与内存中已有源/接口合并（不重拉已存在源）
      const { sources: loaded, allApis: newApis, errors: loadErrors } = await loadSources(
        [{ id, name: srcName, url: inputUrl }],
        {
          abortSignal: loadContext.abortSignal,
          requestIdBySourceId: loadContext.requestIdBySourceId,
        }
      )
      if (!isActiveLoad(loadContext.id)) return

      syncCollections([...sources.value, ...loaded], [...apis.value, ...newApis])
      selectedSource.value = []
      selectedApi.value = null
      recalcTagGroups()

      // Diff: 为新加载的源执行对比
      for (const src of loaded) {
        if (src.status === 'loaded') {
          await runDiffForSource(src)
        }
      }

      if (loadErrors.length > 0) {
        error.value = loadErrors.join('; ')
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      error.value = e.message || translate('errors.loadFailed')
    } finally {
      if (activeLoad) {
        activeLoad = null
      }
      loading.value = false
    }
  }

  function removeSource(id: string) {
    sources.value = sources.value.filter((s) => s.id !== id)
    apis.value = apis.value.filter((a) => a.sourceId !== id)
    if (selectedSource.value.includes(id)) {
      selectedSource.value = selectedSource.value.filter((s) => s !== id)
    }
    persistSourceOrder()
    recalcTagGroups()
  }

  /**
   * 重命名某个源，并把新名称同步到所有依赖名称的地方：
   * source 自身 → 各 API 的 sourceName → diff 结果的 sourceName → 持久化的「最近使用」记录。
   */
  async function renameSource(id: string, rawName: string): Promise<void> {
    const src = sources.value.find((s) => s.id === id)
    const name = rawName.trim()
    if (!src || !name || src.name === name) return

    src.name = name
    // 同步：该 source 下所有 API 的 sourceName
    for (const api of apis.value) {
      if (api.sourceId === id) {
        api.sourceName = name
      }
    }
    // 同步：diff 结果中的 sourceName（DiffView 头部展示用）
    diffResults.value = diffResults.value.map((d) =>
      d.sourceId === id ? { ...d, sourceName: name } : d
    )
    // 显式触发 sources / apis 响应式更新
    sources.value = [...sources.value]
    apis.value = [...apis.value]

    // 同步：持久化「最近使用」记录的名称（按 url upsert）
    await saveUrl({ name, url: src.url })
  }

  async function reloadAll(): Promise<void> {
    if (sources.value.length === 0) return
    loading.value = true
    error.value = ''

    try {
      const inputs: SourceInput[] = sources.value.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
      }))
      const loadContext = beginLoad(inputs)

      const { sources: loaded, allApis: merged, errors: loadErrors } = await loadSources(inputs, {
        abortSignal: loadContext.abortSignal,
        requestIdBySourceId: loadContext.requestIdBySourceId,
      })
      if (!isActiveLoad(loadContext.id)) return

      syncCollections(loaded, merged)
      recalcTagGroups()

      // Diff
      for (const src of loaded) {
        if (src.status === 'loaded') {
          await runDiffForSource(src)
        }
      }

      if (loadErrors.length > 0) {
        error.value = loadErrors.join('; ')
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      error.value = e.message || translate('errors.reloadFailed')
    } finally {
      if (activeLoad) {
        activeLoad = null
      }
      loading.value = false
    }
  }

  async function cancelLoading(): Promise<void> {
    const current = activeLoad
    if (!current) return
    activeLoad = null
    loading.value = false
    current.controller?.abort()

    if (window.electronAPI?.cancelSwaggerFetch) {
      await Promise.allSettled(
        current.requestIds.map((requestId) => window.electronAPI.cancelSwaggerFetch(requestId))
      )
    }
  }

  function moveSource(draggedId: string, targetId: string): void {
    if (!draggedId || !targetId || draggedId === targetId) return
    const fromIndex = sources.value.findIndex((source) => source.id === draggedId)
    const toIndex = sources.value.findIndex((source) => source.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const nextSources = [...sources.value]
    const [dragged] = nextSources.splice(fromIndex, 1)
    nextSources.splice(toIndex, 0, dragged)
    sources.value = nextSources
    apis.value = orderApis(apis.value, nextSources)
    persistSourceOrder(nextSources)
  }

  function selectTag(tag: string): void {
    selectedTag.value = tag
    selectedApi.value = null
    searchQuery.value = ''
  }

  function selectApi(api: ApiItem): void {
    selectedApi.value = api
    selectedTag.value = api.tag // ponytail: sync tag highlight to selected api's parent
  }

  return {
    url,
    loading,
    error,
    sources,
    selectedSource,
    apis,
    tagGroups,
    tags,
    selectedTag,
    selectedApi,
    filteredApis,
    searchQuery,
    searchResults,
    displayedApis,
    diffResults,
    hasDiff,
    showDiff,
    addSource,
    removeSource,
    renameSource,
    reloadAll,
    cancelLoading,
    moveSource,
    selectTag,
    selectApi,
  }
}
