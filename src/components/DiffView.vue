<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type {
  ApiDiffItem,
  DiffResult,
  FieldChange,
  SchemaDiffItem,
} from '@/core/apiDiffEngine';
import { getUiState, saveUiState } from '@/utils/storage';
import { getMethodColor } from '@/utils/format';
import { useI18n } from '@/i18n';

const props = defineProps<{
  diff: DiffResult;
}>();

type TabKey = 'added' | 'removed' | 'modified' | 'schema';
type SelectableItem =
  | { kind: 'api'; key: string; item: ApiDiffItem }
  | { kind: 'schema'; key: string; item: SchemaDiffItem };

const activeTab = ref<TabKey>('modified');
const selectedKey = ref('');
const { t } = useI18n();

watch(activeTab, (value) => {
  saveUiState(`diff-tab:${props.diff.sourceId}`, value);
});

const filteredApis = computed<ApiDiffItem[]>(() => {
  if (activeTab.value === 'schema') return [];
  return props.diff.apis.filter((item) => item.type === activeTab.value);
});

const schemaItems = computed<SchemaDiffItem[]>(() => props.diff.schemas || []);
const impactedKeys = computed<string[]>(() => props.diff.impactedApiKeys || []);

const listItems = computed<SelectableItem[]>(() => {
  if (activeTab.value === 'schema') {
    return schemaItems.value.map((item) => ({
      kind: 'schema' as const,
      key: `schema:${item.name}`,
      item,
    }));
  }
  return filteredApis.value.map((item) => ({
    kind: 'api' as const,
    key: item.api.id,
    item,
  }));
});

function tabItemCount(tab: TabKey): number {
  if (tab === 'schema') return schemaItems.value.length;
  return props.diff.apis.filter((item) => item.type === tab).length;
}

function resolveAvailableTab(preferred: TabKey): TabKey {
  if (tabItemCount(preferred) > 0) return preferred;
  return (
    (['modified', 'added', 'removed', 'schema'] as TabKey[]).find(
      (tab) => tabItemCount(tab) > 0,
    ) || preferred
  );
}

const savedTab = getUiState<TabKey>(
  `diff-tab:${props.diff.sourceId}`,
  'modified',
);
activeTab.value = resolveAvailableTab(savedTab);

watch(
  () => props.diff,
  () => {
    activeTab.value = resolveAvailableTab(activeTab.value);
  },
);

watch(
  listItems,
  (items) => {
    if (!items.length) {
      selectedKey.value = '';
      return;
    }
    if (!items.some((item) => item.key === selectedKey.value)) {
      selectedKey.value = items[0].key;
    }
  },
  { immediate: true },
);

const selectedItem = computed<SelectableItem | null>(() => {
  return listItems.value.find((item) => item.key === selectedKey.value) || null;
});

function changeLabel(change: FieldChange): string {
  if (change.path === 'requestBody') return t('common.body');
  if (change.path === 'responses') return t('common.response');
  if (change.path === 'parameters') return t('common.parameters');
  if (change.path === 'summary') return t('common.summary');
  if (change.path === 'description') return t('common.description');
  return change.path;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value || '(empty)';
  try {
    const text = JSON.stringify(value, null, 2);
    return text.length > 2400 ? `${text.slice(0, 2400)}\n... truncated` : text;
  } catch {
    return String(value);
  }
}

function tabClass(tab: TabKey) {
  return activeTab.value === tab ? 'meta-badge-active' : 'data-note hover-soft';
}

function itemStateClass(type: string) {
  if (type === 'added') return 'status-badge-success';
  if (type === 'removed') return 'status-badge-danger';
  if (type === 'modified') return 'status-badge-warning';
  return 'status-badge-neutral';
}

function sidePanelClass(type: string) {
  if (type === 'added') return 'border-emerald-500/20 bg-emerald-500/[0.06]';
  if (type === 'removed') return 'border-red-500/20 bg-red-500/[0.06]';
  if (type === 'modified') return 'border-amber-500/20 bg-amber-500/[0.06]';
  return 'surface-muted';
}

function diffTypeLabel(type: string) {
  if (type === 'added') return t('diff.added');
  if (type === 'removed') return t('diff.removed');
  if (type === 'modified') return t('diff.modified');
  return type;
}
</script>

<template>
  <section
    class="panel-surface flex h-full min-h-0 flex-col overflow-hidden"
    style="
      border-color: color-mix(
        in srgb,
        var(--ui-warning) 38%,
        var(--ui-border)
      );
      box-shadow:
        var(--ui-shadow),
        inset 3px 0 0
          color-mix(in srgb, var(--ui-warning) 68%, transparent);
    "
  >
    <div class="panel-header panel-header-compact items-center">
      <div>
        <p class="panel-kicker">{{ t('common.diff') }}</p>
        <h3 class="panel-title">{{ diff.sourceName }}</h3>
      </div>
    </div>

    <div
      class="panel-divider flex flex-wrap items-center gap-2 border-b px-4 py-3 text-xs"
    >
      <span class="status-badge status-badge-success">{{
        t('meta.addCount', { count: diff.summary.added })
      }}</span>
      <span class="status-badge status-badge-danger">{{
        t('meta.removeCount', { count: diff.summary.removed })
      }}</span>
      <span class="status-badge status-badge-warning">{{
        t('meta.tildeCount', { count: diff.summary.modified })
      }}</span>
      <span class="status-badge status-badge-neutral"
        >{{ diff.summary.unchanged }} {{ t('diff.unchanged') }}</span
      >
      <span class="ml-auto" style="color: var(--ui-text-soft)">{{
        t('diff.currentApis', { count: diff.summary.total })
      }}</span>
    </div>

    <div class="panel-divider flex gap-2 border-b px-4 py-3">
      <button
        type="button"
        class="rounded-md border px-3 py-1.5 text-xs transition"
        :class="tabClass('added')"
        @click="activeTab = 'added'"
      >
        {{ t('diff.added') }} {{ diff.summary.added }}
      </button>
      <button
        type="button"
        class="rounded-md border px-3 py-1.5 text-xs transition"
        :class="tabClass('removed')"
        @click="activeTab = 'removed'"
      >
        {{ t('diff.removed') }} {{ diff.summary.removed }}
      </button>
      <button
        type="button"
        class="rounded-md border px-3 py-1.5 text-xs transition"
        :class="tabClass('modified')"
        @click="activeTab = 'modified'"
      >
        {{ t('diff.modified') }} {{ diff.summary.modified }}
      </button>
      <button
        type="button"
        class="rounded-md border px-3 py-1.5 text-xs transition"
        :class="tabClass('schema')"
        @click="activeTab = 'schema'"
      >
        {{ t('common.schema') }} {{ schemaItems.length }}
      </button>
    </div>

    <div
      class="grid min-h-0 flex-1 grid-cols-[minmax(220px,280px)_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]"
    >
      <div
        class="panel-divider flex min-h-0 flex-col overflow-hidden border-r"
      >
        <div
          v-if="activeTab === 'schema' && impactedKeys.length > 0"
          class="panel-divider max-h-[40%] shrink-0 overflow-auto border-b px-4 py-3"
          style="
            background-color: color-mix(
              in srgb,
              var(--ui-warning-soft) 80%,
              transparent
            );
          "
        >
          <p
            class="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style="color: var(--ui-warning)"
          >
            {{ t('diff.impactedApis') }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="key in impactedKeys"
              :key="key"
              class="status-badge status-badge-warning font-mono"
            >
              {{ key }}
            </span>
          </div>
        </div>

        <div v-if="listItems.length > 0" class="min-h-0 flex-1 overflow-auto">
          <button
            v-for="entry in listItems"
            :key="entry.key"
            type="button"
            class="hover-soft w-full border-b px-4 py-3 text-left transition"
            :class="selectedKey === entry.key ? 'table-row-active' : ''"
            style="
              border-color: color-mix(
                in srgb,
                var(--ui-border) 68%,
                transparent
              );
            "
            @click="selectedKey = entry.key"
          >
            <template v-if="entry.kind === 'api'">
              <div class="flex items-center gap-2">
                <span
                  class="method-chip"
                  :class="getMethodColor(entry.item.api.method)"
                >
                  {{ entry.item.api.method }}
                </span>
                <span
                  class="status-badge"
                  :class="itemStateClass(entry.item.type)"
                >
                  {{ diffTypeLabel(entry.item.type) }}
                </span>
              </div>
              <div
                class="mt-2 truncate font-mono text-sm"
                style="color: var(--ui-text)"
              >
                {{ entry.item.api.path }}
              </div>
              <div
                class="mt-1 truncate text-xs"
                style="color: var(--ui-text-soft)"
              >
                {{
                  entry.item.api.summary ||
                  entry.item.api.description ||
                  t('common.noSummary')
                }}
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-2">
                <span
                  class="status-badge"
                  :class="itemStateClass(entry.item.type)"
                >
                  {{ diffTypeLabel(entry.item.type) }}
                </span>
                <span
                  class="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style="color: var(--ui-text-soft)"
                  >{{ t('common.schema') }}</span
                >
              </div>
              <div
                class="mt-2 truncate font-mono text-sm"
                style="color: var(--ui-text)"
              >
                {{ entry.item.name }}
              </div>
              <div
                class="mt-1 truncate text-xs"
                style="color: var(--ui-text-soft)"
              >
                {{
                  t('meta.changeCount', {
                    count: entry.item.changes?.length || 0,
                  })
                }}
              </div>
            </template>
          </button>
        </div>

        <div v-else class="table-empty flex-1">
          {{ t('diff.emptyCategory') }}
        </div>
      </div>

      <div class="min-h-0 overflow-auto p-4">
        <div v-if="selectedItem" class="space-y-4">
          <template v-if="selectedItem.kind === 'api'">
            <div
              class="rounded-xl border p-4"
              :class="sidePanelClass(selectedItem.item.type)"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="method-chip"
                  :class="getMethodColor(selectedItem.item.api.method)"
                >
                  {{ selectedItem.item.api.method }}
                </span>
                <span
                  class="status-badge"
                  :class="itemStateClass(selectedItem.item.type)"
                >
                  {{ diffTypeLabel(selectedItem.item.type) }}
                </span>
              </div>
              <h4
                class="mt-3 break-all font-mono text-base"
                style="color: var(--ui-text)"
              >
                {{ selectedItem.item.api.path }}
              </h4>
              <p class="mt-2 text-sm" style="color: var(--ui-text-muted)">
                {{
                  selectedItem.item.api.summary ||
                  selectedItem.item.api.description ||
                  t('common.noSummary')
                }}
              </p>
            </div>

            <div v-if="selectedItem.item.changes?.length" class="space-y-3">
              <div
                v-for="change in selectedItem.item.changes"
                :key="change.path"
                class="surface-muted p-4"
              >
                <div class="mb-3 flex items-center justify-between gap-2">
                  <p
                    class="text-sm font-semibold"
                    style="color: var(--ui-text)"
                  >
                    {{ changeLabel(change) }}
                  </p>
                  <span
                    class="font-mono text-[11px]"
                    style="color: var(--ui-text-soft)"
                    >{{ change.path }}</span
                  >
                </div>
                <div class="grid gap-3 xl:grid-cols-2">
                  <div
                    class="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3"
                  >
                    <p
                      class="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style="color: var(--ui-danger)"
                    >
                      {{ t('common.before') }}
                    </p>
                    <pre
                      class="json-editor max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs" style="color: color-mix(in srgb, var(--ui-text) 78%, var(--ui-danger))"
                      >{{ formatValue(change.oldValue) }}</pre
                    >
                  </div>
                  <div
                    class="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3"
                  >
                    <p
                      class="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style="color: var(--ui-success)"
                    >
                      {{ t('common.after') }}
                    </p>
                    <pre
                      class="json-editor max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs" style="color: color-mix(in srgb, var(--ui-text) 78%, var(--ui-success))"
                      >{{ formatValue(change.newValue) }}</pre
                    >
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="surface-muted p-4 text-sm"
              style="color: var(--ui-text-muted)"
            >
              {{ t('diff.noApiFieldChanges') }}
            </div>
          </template>

          <template v-else>
            <div
              class="rounded-xl border p-4"
              :class="sidePanelClass(selectedItem.item.type)"
            >
              <div class="flex items-center gap-2">
                <span
                  class="status-badge"
                  :class="itemStateClass(selectedItem.item.type)"
                >
                  {{ diffTypeLabel(selectedItem.item.type) }}
                </span>
                <span
                  class="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style="color: var(--ui-text-soft)"
                  >{{ t('common.schema') }}</span
                >
              </div>
              <h4
                class="mt-3 break-all font-mono text-base"
                style="color: var(--ui-text)"
              >
                {{ selectedItem.item.name }}
              </h4>
            </div>

            <div v-if="selectedItem.item.changes?.length" class="space-y-3">
              <div
                v-for="(change, index) in selectedItem.item.changes"
                :key="`${selectedItem.item.name}-${index}`"
                class="surface-muted p-4"
              >
                <div class="mb-3 flex items-center justify-between gap-2">
                  <p
                    class="text-sm font-semibold"
                    style="color: var(--ui-text)"
                  >
                    {{ changeLabel(change) }}
                  </p>
                  <span
                    class="font-mono text-[11px]"
                    style="color: var(--ui-text-soft)"
                    >{{ change.path }}</span
                  >
                </div>
                <div class="grid gap-3 xl:grid-cols-2">
                  <div
                    class="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-3"
                  >
                    <p
                      class="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style="color: var(--ui-danger)"
                    >
                      {{ t('common.before') }}
                    </p>
                    <pre
                      class="json-editor max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs" style="color: color-mix(in srgb, var(--ui-text) 78%, var(--ui-danger))"
                      >{{ formatValue(change.oldValue) }}</pre
                    >
                  </div>
                  <div
                    class="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3"
                  >
                    <p
                      class="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style="color: var(--ui-success)"
                    >
                      {{ t('common.after') }}
                    </p>
                    <pre
                      class="json-editor max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs" style="color: color-mix(in srgb, var(--ui-text) 78%, var(--ui-success))"
                      >{{ formatValue(change.newValue) }}</pre
                    >
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="surface-muted p-4 text-sm"
              style="color: var(--ui-text-muted)"
            >
              {{ t('diff.noSchemaFieldChanges') }}
            </div>
          </template>
        </div>

        <div v-else class="table-empty">
          {{ t('diff.selectHint') }}
        </div>
      </div>
    </div>
  </section>
</template>
