<script setup lang="ts">
import {
  computed,
  nextTick,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue';
import type { ApiItem, SwaggerSource } from '@/core/types';
import { getMethodColor } from '@/utils/format';
import {
  generateApiContext,
  exportApiKey,
  type ExportFormat,
} from '@/core/aiContextGenerator';
import AppIcon from '@/components/AppIcon.vue';
import { useI18n } from '@/i18n';

const props = defineProps<{
  open: boolean;
  apis: ApiItem[];
  sources: SwaggerSource[];
  /** 打开时预选的 API（快捷导出入口传入） */
  initialSelected?: ApiItem[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

const selectedKeys = ref<Set<string>>(new Set());
const expandedTags = ref<Set<string>>(new Set());
const filter = ref('');
const format = ref<ExportFormat>('markdown');
const output = ref('');
const copied = ref(false);
const generated = ref(false);
const apiRowRefs = ref<Record<string, HTMLElement | null>>({});

const baseUrlMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const source of props.sources) {
    map[source.id] = source.spec?.servers?.[0]?.url || '';
  }
  return map;
});

const multiSource = computed(() => props.sources.length > 1);

const filteredApis = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return props.apis;
  return props.apis.filter(
    (api) =>
      api.path.toLowerCase().includes(q) ||
      api.method.toLowerCase().includes(q) ||
      (api.summary || '').toLowerCase().includes(q) ||
      (api.tag || '').toLowerCase().includes(q),
  );
});

interface TagGroup {
  tag: string;
  apis: ApiItem[];
}

const groups = computed<TagGroup[]>(() => {
  const map = new Map<string, ApiItem[]>();
  for (const api of filteredApis.value) {
    const list = map.get(api.tag) || [];
    list.push(api);
    map.set(api.tag, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([tag, apis]) => ({ tag, apis }));
});

const selectedCount = computed(() => selectedKeys.value.size);

const selectedApis = computed(() =>
  props.apis.filter((api) => selectedKeys.value.has(exportApiKey(api))),
);

/** 根据当前选中项决定默认展开哪些标签：有选中则只展开含选中项的标签，否则全部展开 */
function initExpandedTags(keys: Set<string>) {
  if (keys.size === 0) {
    expandedTags.value = new Set(groups.value.map((g) => g.tag));
    return;
  }
  const tags = new Set<string>();
  for (const api of props.apis) {
    if (keys.has(exportApiKey(api))) tags.add(api.tag);
  }
  expandedTags.value = tags;
}

function isTagExpanded(tag: string): boolean {
  return expandedTags.value.has(tag);
}

function toggleTagExpand(tag: string) {
  const next = new Set(expandedTags.value);
  if (next.has(tag)) next.delete(tag);
  else next.add(tag);
  expandedTags.value = next;
}

function expandAllTags() {
  expandedTags.value = new Set(groups.value.map((g) => g.tag));
}

function collapseAllTags() {
  expandedTags.value = new Set();
}

function ensureTagExpanded(tag: string) {
  if (!expandedTags.value.has(tag)) {
    expandedTags.value = new Set([...expandedTags.value, tag]);
  }
}

function setApiRowRef(
  key: string,
  el: Element | ComponentPublicInstance | null,
) {
  const resolved =
    el && '$el' in el
      ? (el.$el as HTMLElement | null)
      : (el as HTMLElement | null);
  apiRowRefs.value[key] = resolved;
}

function scrollToFirstSelected() {
  const firstKey = (props.initialSelected || []).map(exportApiKey)[0];
  if (!firstKey) return;
  apiRowRefs.value[firstKey]?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;

    const initialKeys = new Set(
      (props.initialSelected || []).map(exportApiKey),
    );
    selectedKeys.value = initialKeys;
    filter.value = '';
    output.value = '';
    generated.value = false;
    copied.value = false;
    initExpandedTags(initialKeys);

    if (initialKeys.size > 0) {
      generate();
    }

    await nextTick();
    scrollToFirstSelected();
  },
);

function toggleApi(api: ApiItem) {
  const key = exportApiKey(api);
  const next = new Set(selectedKeys.value);
  if (next.has(key)) next.delete(key);
  else {
    next.add(key);
    ensureTagExpanded(api.tag);
  }
  selectedKeys.value = next;
  generated.value = false;
}

function isApiSelected(api: ApiItem): boolean {
  return selectedKeys.value.has(exportApiKey(api));
}

function tagState(group: TagGroup): 'none' | 'partial' | 'all' {
  let selected = 0;
  for (const api of group.apis) {
    if (selectedKeys.value.has(exportApiKey(api))) selected++;
  }
  if (selected === 0) return 'none';
  if (selected === group.apis.length) return 'all';
  return 'partial';
}

function toggleTag(group: TagGroup) {
  const next = new Set(selectedKeys.value);
  const allSelected = tagState(group) === 'all';
  for (const api of group.apis) {
    const key = exportApiKey(api);
    if (allSelected) next.delete(key);
    else next.add(key);
  }
  selectedKeys.value = next;
  if (!allSelected) ensureTagExpanded(group.tag);
  generated.value = false;
}

function selectAll() {
  const next = new Set(selectedKeys.value);
  for (const api of filteredApis.value) next.add(exportApiKey(api));
  selectedKeys.value = next;
  initExpandedTags(next);
  generated.value = false;
}

function clearAll() {
  selectedKeys.value = new Set();
  initExpandedTags(new Set());
  generated.value = false;
}

function generate() {
  if (selectedApis.value.length === 0) return;
  output.value = generateApiContext(selectedApis.value, format.value, {
    baseUrlMap: baseUrlMap.value,
  });
  generated.value = true;
}

watch(format, () => {
  if (generated.value) generate();
});

async function copyOutput() {
  if (!output.value) return;
  try {
    await navigator.clipboard.writeText(output.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // 忽略剪贴板错误
  }
}

function downloadOutput() {
  if (!output.value) return;
  const ext = format.value === 'json' ? 'json' : 'md';
  const blob = new Blob([output.value], {
    type: format.value === 'json' ? 'application/json' : 'text/markdown',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `api-context-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div
    v-if="open"
    class="overlay-backdrop-strong fixed inset-0 z-[70] flex items-center justify-center px-4 py-6"
    @click.self="emit('close')"
  >
    <div
      class="popover-surface flex h-full max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden"
    >
      <div class="panel-header px-5">
        <div>
          <h3 class="panel-title">{{ t('aiExport.title') }}</h3>
          <p class="panel-description">{{ t('aiExport.description') }}</p>
        </div>
        <button
          type="button"
          class="icon-button icon-button-sm"
          :title="t('common.close')"
          @click="emit('close')"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>

      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(320px,2fr)_minmax(0,3fr)]"
      >
        <div class="panel-divider flex min-h-0 flex-col border-r">
          <div class="panel-divider space-y-2 border-b px-4 py-3">
            <input
              v-model="filter"
              type="text"
              :placeholder="t('aiExport.filterPlaceholder')"
              class="toolbar-input w-full"
            />
            <div class="flex items-center justify-between">
              <span class="text-xs" style="color: var(--ui-text-muted)">
                {{ t('aiExport.selectedCount', { count: selectedCount }) }}
              </span>
              <div class="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  class="text-link-action"
                  @click="selectAll"
                >
                  {{ t('aiExport.selectAll') }}
                </button>
                <button type="button" class="text-link-muted" @click="clearAll">
                  {{ t('common.clear') }}
                </button>
                <span style="color: var(--ui-border-strong)">|</span>
                <button
                  type="button"
                  class="text-link-muted"
                  @click="expandAllTags"
                >
                  {{ t('aiExport.expandAll') }}
                </button>
                <button
                  type="button"
                  class="text-link-muted"
                  @click="collapseAllTags"
                >
                  {{ t('aiExport.collapseAll') }}
                </button>
              </div>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto px-2 py-2">
            <div v-if="groups.length === 0" class="table-empty px-3 py-6">
              {{ t('explorer.empty') }}
            </div>

            <section v-for="group in groups" :key="group.tag" class="mb-1">
              <div
                class="hover-soft flex items-center gap-1 rounded-lg px-1 py-1"
                style="color: var(--ui-text-muted)"
              >
                <button
                  type="button"
                  class="icon-button icon-button-xs shrink-0"
                  :title="
                    isTagExpanded(group.tag)
                      ? t('common.hide')
                      : t('common.show')
                  "
                  @click="toggleTagExpand(group.tag)"
                >
                  <AppIcon
                    name="chevron-right"
                    :size="14"
                    class="transition-transform"
                    :class="isTagExpanded(group.tag) ? 'rotate-90' : ''"
                  />
                </button>

                <label
                  class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1"
                >
                  <input
                    type="checkbox"
                    class="selection-checkbox"
                    :checked="tagState(group) === 'all'"
                    :indeterminate.prop="tagState(group) === 'partial'"
                    @change="toggleTag(group)"
                  />
                  <span
                    class="flex-1 truncate text-xs font-semibold uppercase tracking-[0.12em]"
                    style="color: var(--ui-text)"
                  >
                    {{ group.tag }}
                  </span>
                  <span class="status-badge status-badge-neutral">
                    {{ group.apis.length }}
                  </span>
                </label>
              </div>

              <div
                v-if="isTagExpanded(group.tag)"
                class="tree-rail ml-3 mt-0.5 space-y-0.5 pl-2"
              >
                <label
                  v-for="api in group.apis"
                  :key="exportApiKey(api)"
                  :ref="(el) => setApiRowRef(exportApiKey(api), el)"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition"
                  :class="
                    isApiSelected(api) ? 'meta-badge-active' : 'hover-soft'
                  "
                >
                  <input
                    type="checkbox"
                    class="selection-checkbox"
                    :checked="isApiSelected(api)"
                    @change="toggleApi(api)"
                  />
                  <span
                    class="method-chip w-14 shrink-0 justify-center px-1 py-0.5 text-[10px]"
                    :class="getMethodColor(api.method)"
                  >
                    {{ api.method }}
                  </span>
                  <span
                    class="min-w-0 flex-1 truncate font-mono text-xs"
                    style="color: var(--ui-text)"
                    :title="api.path"
                  >
                    {{ api.path }}
                  </span>
                  <span
                    v-if="api.summary"
                    class="min-w-0 shrink truncate text-[11px]"
                    style="color: var(--ui-text-soft)"
                    :title="api.summary"
                  >
                    {{ api.summary }}
                  </span>
                  <span
                    v-if="multiSource && api.sourceName"
                    class="shrink-0 text-[10px]"
                    style="color: var(--ui-text-soft)"
                  >
                    {{ api.sourceName }}
                  </span>
                </label>
              </div>
            </section>
          </div>
        </div>

        <div class="flex min-h-0 flex-col">
          <div
            class="panel-divider flex flex-wrap items-center gap-2 border-b px-4 py-3"
          >
            <div class="segmented-control">
              <button
                type="button"
                class="segmented-button"
                :class="format === 'markdown' ? 'segmented-button-active' : ''"
                @click="format = 'markdown'"
              >
                Markdown
              </button>
              <button
                type="button"
                class="segmented-button"
                :class="format === 'json' ? 'segmented-button-active' : ''"
                @click="format = 'json'"
              >
                JSON
              </button>
            </div>

            <button
              type="button"
              class="toolbar-button toolbar-button-primary"
              :disabled="selectedCount === 0"
              @click="generate"
            >
              {{ t('aiExport.generate') }}
            </button>

            <div class="ml-auto flex gap-2">
              <button
                type="button"
                class="toolbar-button"
                :disabled="!output"
                @click="copyOutput"
              >
                {{ copied ? t('common.copied') : t('aiExport.copy') }}
              </button>
              <button
                type="button"
                class="toolbar-button"
                :disabled="!output"
                @click="downloadOutput"
              >
                {{ t('aiExport.download') }}
              </button>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-auto p-4">
            <pre
              v-if="output"
              class="json-editor surface-sunken min-h-full whitespace-pre-wrap p-4 text-xs leading-5"
              >{{ output }}</pre
            >
            <div
              v-else
              class="empty-state flex h-full items-center justify-center px-6"
            >
              {{ t('aiExport.emptyHint') }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
