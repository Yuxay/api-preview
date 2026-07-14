<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useSwagger } from '@/composables/useSwagger';
import { useTheme, type ThemeMode } from '@/composables/useTheme';
import { getToken, getUiState, saveToken, saveUiState } from '@/utils/storage';
import UrlBar from '@/components/UrlBar.vue';
import TagSidebar from '@/components/TagSidebar.vue';
import ApiList from '@/components/ApiList.vue';
import ApiDetail from '@/components/ApiDetail.vue';
import DiffView from '@/components/DiffView.vue';
import ApiExportDialog from '@/components/ApiExportDialog.vue';
import AppIcon from '@/components/AppIcon.vue';
import { useI18n } from '@/i18n';
import type { ApiItem } from '@/core/types';

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
  restoreSources,
} = useSwagger();

const globalToken = ref('');
const sidebarCollapsed = ref(getUiState('sidebar-collapsed', false));
const apiListCollapsed = ref(getUiState('apilist-collapsed', false));
const showExport = ref(false);
const exportInitialSelected = ref<ApiItem[]>([]);
const updaterState = ref<AppUpdaterState | null>(null);
const updaterDialogOpen = ref(false);
const updaterActionPending = ref(false);
const { t } = useI18n();

const exportApis = computed(() => {
  if (selectedSource.value.length === 0)
    return apis.value;
  return apis.value.filter((api) => selectedSource.value.includes(api.sourceId || ''));
});

function openExport(initialSelected: ApiItem[] = []) {
  exportInitialSelected.value = initialSelected;
  showExport.value = true;
}

watch(sidebarCollapsed, (value) => saveUiState('sidebar-collapsed', value));
watch(apiListCollapsed, (value) => saveUiState('apilist-collapsed', value));
const { themeMode, setThemeMode } = useTheme();

onMounted(async () => {
  globalToken.value = await getToken();
  await restoreSources();
  if (window.electronAPI?.getUpdaterState) {
    updaterState.value = await window.electronAPI.getUpdaterState();
    window.electronAPI.onUpdaterStateChanged((state) => {
      updaterState.value = state;
    });
  }
});

async function onTokenChange(token: string) {
  globalToken.value = token;
  await saveToken(token);
}

async function onAddSource(name: string, url: string) {
  await addSource(name, url);
}

function onThemeModeChange(mode: ThemeMode) {
  setThemeMode(mode);
}

async function onCheckUpdates() {
  if (!window.electronAPI?.checkForUpdates) return;
  const result = await window.electronAPI.checkForUpdates();
  updaterState.value = result.state;
}

async function onStartUpdateDownload() {
  if (!window.electronAPI?.downloadUpdate || updaterActionPending.value) return;
  updaterActionPending.value = true;
  try {
    const result = await window.electronAPI.downloadUpdate();
    updaterState.value = result.state;
  } finally {
    updaterActionPending.value = false;
  }
}

async function onInstallUpdate() {
  if (!window.electronAPI?.quitAndInstallUpdate || updaterActionPending.value)
    return;
  updaterActionPending.value = true;
  try {
    const result = await window.electronAPI.quitAndInstallUpdate();
    updaterState.value = result.state;
  } finally {
    updaterActionPending.value = false;
  }
}

function onSelectSource(id: string) {
  if (id === '__ALL__') {
    selectedSource.value = [];
  } else {
    const idx = selectedSource.value.indexOf(id);
    if (idx >= 0) {
      selectedSource.value = selectedSource.value.filter((s) => s !== id);
    } else {
      selectedSource.value = [...selectedSource.value, id];
    }
  }
  selectedApi.value = null;
  selectedTag.value = '';
}

function toggleDiff() {
  showDiff.value = !showDiff.value;
}

const currentServers = computed(() => {
  if (!selectedApi.value?.sourceId) return undefined;
  const src = sources.value.find((s) => s.id === selectedApi.value?.sourceId);
  return src?.spec?.servers;
});

const totalApiCount = computed(() => {
  if (selectedSource.value.length === 0)
    return apis.value.length;
  return apis.value.filter((a) => selectedSource.value.includes(a.sourceId || '')).length;
});

const tagCounts = computed<Record<string, number>>(() => {
  const items =
    selectedSource.value.length === 0
      ? apis.value
      : apis.value.filter((api) => selectedSource.value.includes(api.sourceId || ''));

  return items.reduce<Record<string, number>>((acc, api) => {
    acc[api.tag] = (acc[api.tag] || 0) + 1;
    return acc;
  }, {});
});

const impactedKeys = computed<Set<string>>(() => {
  const set = new Set<string>();
  for (const diff of diffResults.value) {
    for (const key of diff.impactedApiKeys || []) {
      set.add(key);
    }
  }
  return set;
});

const diffChangeCount = computed(() =>
  diffResults.value.reduce(
    (sum, diff) =>
      sum + diff.summary.added + diff.summary.removed + diff.summary.modified,
    0,
  ),
);

const updaterSupported = computed(() => updaterState.value?.supported ?? false);

const checkingUpdates = computed(() => {
  const phase = updaterState.value?.phase;
  return phase === 'checking' || phase === 'downloading';
});

const updaterDialogSessionKey = computed(() => {
  const state = updaterState.value;
  if (!state || !state.supported) return '';

  switch (state.phase) {
    case 'available':
    case 'downloading':
    case 'downloaded':
      return `${state.lastCheckSource}:${state.phase}:${state.availableVersion || state.currentVersion}`;
    case 'up-to-date':
      return state.lastCheckSource === 'manual'
        ? `${state.lastCheckSource}:${state.phase}:${state.currentVersion}`
        : '';
    case 'error':
      return state.lastCheckSource === 'manual'
        ? `${state.lastCheckSource}:${state.phase}:${state.error || ''}`
        : '';
    default:
      return '';
  }
});

watch(updaterDialogSessionKey, (nextKey, previousKey) => {
  if (!nextKey) {
    updaterDialogOpen.value = false;
    return;
  }

  if (nextKey !== previousKey) {
    updaterDialogOpen.value = true;
  }
}, { immediate: true });

const updaterDialogTitle = computed(() => {
  switch (updaterState.value?.phase) {
    case 'available':
      return t('updater.availableTitle');
    case 'downloading':
      return t('updater.downloadingTitle');
    case 'downloaded':
      return t('updater.downloadedTitle');
    case 'up-to-date':
      return t('updater.latestTitle');
    case 'error':
      return t('updater.errorTitle');
    default:
      return t('updater.check');
  }
});

const updaterDialogIcon = computed(() => {
  switch (updaterState.value?.phase) {
    case 'up-to-date':
      return 'check-circle';
    case 'error':
      return 'alert-triangle';
    case 'available':
    case 'downloading':
    case 'downloaded':
      return 'download';
    default:
      return 'info';
  }
});

const updaterDialogIconClass = computed(() => {
  switch (updaterState.value?.phase) {
    case 'up-to-date':
      return 'ui-alert-success';
    case 'error':
      return 'ui-alert-danger';
    case 'available':
    case 'downloading':
    case 'downloaded':
      return 'ui-alert-info';
    default:
      return 'ui-alert-info';
  }
});

const updaterDialogMessage = computed(() => {
  const state = updaterState.value;
  if (!state || !state.supported) return '';

  switch (state.phase) {
    case 'available':
      return t('updater.updateAvailable', {
        version: state.availableVersion || state.currentVersion,
      });
    case 'downloading':
      return t('updater.downloading', {
        progress: state.progress,
      });
    case 'downloaded':
      return t('updater.downloaded', {
        version: state.availableVersion || state.currentVersion,
      });
    case 'up-to-date':
      return state.lastCheckSource === 'manual'
        ? t('updater.upToDate', {
            version: state.currentVersion,
          })
        : '';
    case 'error':
      return state.lastCheckSource === 'manual'
        ? t('updater.checkFailed', {
            message: state.error || t('errors.unknownError'),
          })
        : '';
    default:
      return '';
  }
});

const updaterDialogPrimaryLabel = computed(() => {
  switch (updaterState.value?.phase) {
    case 'available':
      return t('updater.updateNow');
    case 'downloaded':
      return t('updater.installNow');
    case 'downloading':
      return t('updater.background');
    default:
      return t('common.confirm');
  }
});

const updaterDialogShowSecondary = computed(() => {
  const phase = updaterState.value?.phase;
  return phase === 'available' || phase === 'downloaded';
});

const updaterDialogSecondaryLabel = computed(() => t('updater.remindLater'));

async function onUpdaterDialogPrimaryAction() {
  switch (updaterState.value?.phase) {
    case 'available':
      await onStartUpdateDownload();
      return;
    case 'downloaded':
      await onInstallUpdate();
      return;
    default:
      updaterDialogOpen.value = false;
  }
}

function onUpdaterDialogSecondaryAction() {
  updaterDialogOpen.value = false;
}

const layoutStyle = computed(() => ({
  gridTemplateColumns: [
    sidebarCollapsed.value ? '40px' : 'minmax(260px, 280px)',
    apiListCollapsed.value ? '40px' : 'minmax(340px, 380px)',
    'minmax(0, 1fr)',
  ].join(' '),
}));

function collapseSidebar() {
  sidebarCollapsed.value = true;
}

function expandSidebar() {
  sidebarCollapsed.value = false;
}

function collapseApiList() {
  apiListCollapsed.value = true;
}

function expandApiList() {
  apiListCollapsed.value = false;
}
</script>

<template>
  <div class="h-full bg-ui-canvas" style="color: var(--ui-text)">
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
        :updater-supported="updaterSupported"
        :checking-updates="checkingUpdates"
        :updater-state="updaterState"
        @add-source="onAddSource"
        @select-source="onSelectSource"
        @remove-source="(id: string) => removeSource(id)"
        @reload="reloadAll"
        @cancel-loading="cancelLoading"
        @check-updates="onCheckUpdates"
        @toggle-diff="toggleDiff"
        @open-export="openExport()"
        @update:theme-mode="onThemeModeChange"
        @update:token="onTokenChange"
        @update:search-query="(value: string) => (searchQuery = value)"
      />

      <ApiExportDialog
        :open="showExport"
        :apis="exportApis"
        :sources="sources"
        :initial-selected="exportInitialSelected"
        @close="showExport = false"
      />

      <div
        v-if="updaterDialogOpen && updaterDialogMessage"
        class="overlay-backdrop-strong fixed inset-0 z-[70] flex items-start justify-center px-4 pt-24"
        @click.self="updaterDialogOpen = false"
      >
        <div class="popover-surface w-full max-w-md p-5">
          <div class="flex items-start gap-3">
            <div
              class="ui-alert flex h-10 w-10 shrink-0 items-center justify-center rounded-xl px-0 py-0"
              :class="updaterDialogIconClass"
            >
              <AppIcon
                :name="updaterDialogIcon"
                :size="18"
                :class="
                  updaterState?.phase === 'downloading' ? 'animate-spin' : ''
                "
              />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold" style="color: var(--ui-text)">
                {{ updaterDialogTitle }}
              </h3>
              <p
                class="mt-1 text-sm leading-6"
                style="color: var(--ui-text-muted)"
              >
                {{ updaterDialogMessage }}
              </p>
            </div>
            <button
              type="button"
              class="icon-button icon-button-sm shrink-0"
              :title="t('common.close')"
              @click="updaterDialogOpen = false"
            >
              <AppIcon name="x" :size="14" />
            </button>
          </div>

          <div
            v-if="updaterState?.phase === 'downloading'"
            class="mt-4 overflow-hidden rounded-full"
            style="background-color: var(--ui-btn)"
          >
            <div
              class="h-2 rounded-full"
              :style="{
                width: `${updaterState.progress}%`,
                backgroundColor: 'var(--ui-accent)',
              }"
            />
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              v-if="updaterDialogShowSecondary"
              type="button"
              class="toolbar-button"
              :disabled="updaterActionPending"
              @click="onUpdaterDialogSecondaryAction"
            >
              {{ updaterDialogSecondaryLabel }}
            </button>
            <button
              type="button"
              class="toolbar-button toolbar-button-primary"
              :disabled="updaterActionPending"
              @click="onUpdaterDialogPrimaryAction"
            >
              {{ updaterDialogPrimaryLabel }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="error"
        class="ui-alert ui-alert-danger mx-3 mt-2 justify-between"
      >
        <span class="min-w-0 flex-1">{{ error }}</span>
        <button
          type="button"
          class="ui-alert-dismiss shrink-0"
          :title="t('common.close')"
          @click="error = ''"
        >
          <AppIcon name="x" :size="16" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-2">
        <div
          v-if="sources.length === 0 && !loading"
          class="panel-surface flex h-full items-center justify-center"
        >
          <div
            class="empty-state max-w-xl space-y-4 border-0 bg-transparent px-10 py-10"
          >
            <div class="empty-state-icon">
              <AppIcon name="file-text" :size="32" />
            </div>
            <div class="space-y-2">
              <h1 class="text-2xl font-semibold" style="color: var(--ui-text)">
                ApiPreview
              </h1>
              <p class="text-sm leading-6" style="color: var(--ui-text-muted)">
                {{ t('app.intro') }}
              </p>
              <button
                type="button"
                class="toolbar-button toolbar-button-primary"
                @click="
                  onAddSource('Swagger Petstore (示例)', 'example://petstore')
                "
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
          <div class="empty-state border-0 bg-transparent px-10 py-10">
            <div
              class="mx-auto h-10 w-10 animate-spin rounded-full border-2"
              style="
                border-color: color-mix(
                  in srgb,
                  var(--ui-border-strong) 90%,
                  transparent
                );
                border-top-color: var(--ui-accent);
              "
            />
            <p class="mt-3 text-sm" style="color: var(--ui-text-muted)">
              {{ t('app.loadingDocs') }}
            </p>
          </div>
        </div>

        <div
          v-else
          class="grid layout-grid h-full min-h-0 gap-3"
          :style="layoutStyle"
        >
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
            @rename-source="
              (id: string, name: string) => renameSource(id, name)
            "
            @move-source="
              (draggedId: string, targetId: string) =>
                moveSource(draggedId, targetId)
            "
            @toggle-sidebar="collapseSidebar"
          />

          <!-- 侧边栏收起 → 竖向窄条 -->
          <button
            v-if="sidebarCollapsed"
            type="button"
            class="panel-rail-button collapse-toggle"
            :title="t('common.show')"
            @click="expandSidebar"
          >
            <span class="panel-rail-label">{{ t('sidebar.workspace') }}</span>
            <AppIcon name="chevron-right" :size="14" class="shrink-0" />
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
            class="panel-rail-button collapse-toggle"
            :title="t('common.show')"
            @click="expandApiList"
          >
            <span class="panel-rail-label">{{ t('explorer.title') }}</span>
            <AppIcon name="chevron-right" :size="14" class="shrink-0" />
          </button>

          <div class="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
            <ApiDetail
              v-if="selectedApi"
              :api="selectedApi"
              :servers="currentServers"
              :token="globalToken"
              @export-api="(api: ApiItem) => openExport([api])"
            />

            <div
              v-else
              class="empty-state panel-surface flex flex-1 flex-col items-center justify-center gap-4 px-8"
            >
              <div class="empty-state-icon h-14 w-14">
                <AppIcon name="code" :size="28" />
              </div>
              <p>{{ t('app.selectApiHint') }}</p>
            </div>

            <div
              v-if="showDiff && diffResults.length > 0"
              class="grid min-h-0 max-h-[32rem] gap-3 overflow-auto pr-1"
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
