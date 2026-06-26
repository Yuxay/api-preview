<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ThemeMode } from '@/composables/useTheme';
import {
  getStoredUrls,
  getUiState,
  saveUiState,
  type RecentEntry,
} from '@/utils/storage';
import {
  deriveSourceName,
  getSourceColor,
} from '@/services/swaggerMultiLoader';
import type { SwaggerSource } from '@/core/types';
import { setLocale, useI18n, type Locale } from '@/i18n';
import AppIcon from '@/components/AppIcon.vue';

const props = defineProps<{
  token: string;
  loading: boolean;
  sources: SwaggerSource[];
  selectedSource: string;
  searchQuery: string;
  hasDiff: boolean;
  showDiff: boolean;
  diffCount: number;
  themeMode: ThemeMode;
  updaterSupported: boolean;
  checkingUpdates: boolean;
  updaterState: AppUpdaterState | null;
}>();

const emit = defineEmits<{
  'update:token': [token: string];
  'update:searchQuery': [query: string];
  'update:theme-mode': [mode: ThemeMode];
  'add-source': [name: string, url: string];
  'select-source': [id: string];
  'remove-source': [id: string];
  reload: [];
  'cancel-loading': [];
  'check-updates': [];
  'toggle-diff': [];
  'open-export': [];
}>();

const urlInput = ref('');
const searchInput = ref(props.searchQuery);
const recentUrls = ref<RecentEntry[]>([]);
const showRecent = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// 弹窗 / 浮层开关
const showAddDialog = ref(false);
const showSettings = ref(false);
const showToken = ref(false);
const collapsed = ref(getUiState('searchbar-collapsed', false));

watch(collapsed, (value) => saveUiState('searchbar-collapsed', value));
const pendingName = ref('');
const nameInputEl = ref<HTMLInputElement | null>(null);

const { locale, t } = useI18n();

const appVersion = ref(__APP_VERSION__);

onMounted(async () => {
  if (window.electronAPI?.getAppVersion) {
    appVersion.value = await window.electronAPI.getAppVersion();
  }
});

const updateDot = computed(() => {
  const phase = props.updaterState?.phase;
  return (
    phase === 'available' || phase === 'downloading' || phase === 'downloaded'
  );
});

const tokenActive = computed(() => !!props.token.trim());

onMounted(refreshRecentUrls);

watch(
  () => props.searchQuery,
  (value) => {
    if (value !== searchInput.value) {
      searchInput.value = value;
    }
  },
);

async function refreshRecentUrls() {
  recentUrls.value = await getStoredUrls();
}

function onUrlFocus() {
  if (!urlInput.value.trim()) {
    showRecent.value = true;
    refreshRecentUrls();
  }
}

function onUrlInput(event: Event) {
  urlInput.value = (event.target as HTMLInputElement).value;
  showRecent.value = !urlInput.value.trim();
  if (showRecent.value) refreshRecentUrls();
}

function onUrlBlur() {
  setTimeout(() => {
    showRecent.value = false;
  }, 120);
}

function onUrlKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') openAddDialog();
  if (event.key === 'Escape') showRecent.value = false;
}

function openAddDialog() {
  const trimmed = urlInput.value.trim();
  if (!trimmed) return;
  showRecent.value = false;
  pendingName.value = deriveSourceName(trimmed);
  showAddDialog.value = true;
  nextTick(() => {
    nameInputEl.value?.focus();
    nameInputEl.value?.select();
  });
}

function confirmAdd() {
  const trimmedUrl = urlInput.value.trim();
  if (!trimmedUrl) return;
  emit('add-source', pendingName.value.trim(), trimmedUrl);
  urlInput.value = '';
  pendingName.value = '';
  showAddDialog.value = false;
}

function cancelAdd() {
  showAddDialog.value = false;
}

async function selectRecent(entry: RecentEntry) {
  const url = entry.url;
  emit('add-source', entry.name?.trim() || deriveSourceName(url), url);
  urlInput.value = '';
  showRecent.value = false;
  await refreshRecentUrls();
}

function onTokenInput(event: Event) {
  emit('update:token', (event.target as HTMLInputElement).value);
}

function onSearchInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  searchInput.value = value;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    emit('update:searchQuery', value.trim());
  }, 220);
}

function clearSearch() {
  searchInput.value = '';
  emit('update:searchQuery', '');
}

function switchLocale(nextLocale: Locale) {
  setLocale(nextLocale);
}

function switchTheme(mode: ThemeMode) {
  emit('update:theme-mode', mode);
}

function closeAllPopovers() {
  showSettings.value = false;
  showToken.value = false;
}

const themeOptions: { mode: ThemeMode; key: string }[] = [
  { mode: 'light', key: 'theme.light' },
  { mode: 'dark', key: 'theme.dark' },
  { mode: 'system', key: 'theme.system' },
];
</script>

<template>
  <header class="glass-surface sticky top-0 z-30">
    <!-- 收起状态：仅显示展开按钮 -->
    <div v-if="collapsed" class="flex items-center justify-between px-3 py-1.5">
      <span class="panel-kicker">{{ t('urlBar.toolbar') }}</span>
      <button
        type="button"
        class="icon-button icon-button-sm"
        :title="t('common.show')"
        @click="collapsed = false"
      >
        <AppIcon name="chevron-down" :size="14" />
      </button>
    </div>

    <!-- 展开状态 -->
    <div v-else class="flex flex-col gap-3 px-3 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <div
          class="surface-muted hidden min-w-[164px] items-center gap-2 px-3 py-2 text-xs xl:flex"
        >
          <span
            class="h-2 w-2 rounded-full"
            style="
              background-color: color-mix(
                in srgb,
                var(--ui-accent) 80%,
                transparent
              );
            "
          />
          <span
            class="font-semibold uppercase tracking-[0.14em]"
            style="color: var(--ui-text)"
            >ApiPreview</span
          >
        </div>

        <div class="relative min-w-0 flex-1">
          <input
            :value="urlInput"
            type="text"
            :placeholder="t('urlBar.pasteUrl')"
            class="toolbar-input toolbar-input-url w-full"
            @input="onUrlInput"
            @focus="onUrlFocus"
            @blur="onUrlBlur"
            @keydown="onUrlKeydown"
          />

          <div
            v-if="showRecent && recentUrls.length > 0"
            class="popover-surface absolute left-0 right-0 top-full z-50 mt-1"
          >
            <button
              v-for="entry in recentUrls"
              :key="entry.url"
              type="button"
              class="menu-item text-xs last:border-0"
              @click="selectRecent(entry)"
            >
              <span
                class="truncate font-medium"
                style="color: var(--ui-text)"
                >{{ entry.name || deriveSourceName(entry.url) }}</span
              >
              <span class="truncate" style="color: var(--ui-text-soft)">{{
                entry.url
              }}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          class="toolbar-button toolbar-button-primary shrink-0 whitespace-nowrap"
          :disabled="!loading && !urlInput.trim()"
          @click="loading ? emit('cancel-loading') : openAddDialog()"
        >
          <AppIcon :name="loading ? 'x' : 'plus'" :size="14" />
          <span>{{
            loading ? t('common.cancel') : t('urlBar.addSource')
          }}</span>
        </button>

        <!-- 加载示例项目（仅开发模式） -->
        <button
          type="button"
          class="toolbar-button shrink-0 whitespace-nowrap text-xs"
          :disabled="loading"
          :title="t('urlBar.loadExample')"
          @click="
            emit('add-source', 'Swagger Petstore (示例)', 'example://petstore')
          "
        >
          <AppIcon name="file-text" :size="14" />
          <span class="hidden sm:inline">{{ t('urlBar.loadExample') }}</span>
        </button>

        <div class="relative w-64 shrink-0">
          <AppIcon
            name="search"
            :size="14"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style="color: var(--ui-text-soft)"
          />
          <input
            :value="searchInput"
            type="text"
            :placeholder="t('urlBar.searchPlaceholder')"
            class="toolbar-input toolbar-input-search w-full pl-9 pr-10"
            @input="onSearchInput"
          />
          <button
            v-if="searchInput"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-button"
            @click="clearSearch"
          >
            {{ t('common.clear') }}
          </button>
        </div>

        <!-- 外观设置（语言 + 主题） -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="toolbar-button h-9 w-9 px-0"
            :class="showSettings ? 'icon-button-active' : ''"
            :title="t('settings.title')"
            @click="
              showToken = false;
              showSettings = !showSettings;
            "
          >
            <AppIcon name="settings" :size="16" />
            <span
              v-if="updateDot"
              class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              style="background-color: var(--ui-warning)"
            />
          </button>

          <div
            v-if="showSettings"
            class="popover-surface absolute right-0 top-full z-50 mt-1 w-52 p-3"
          >
            <p class="panel-kicker mb-1.5">
              {{ t('settings.language') }}
            </p>
            <div class="segmented-control w-full">
              <button
                type="button"
                class="segmented-button flex-1"
                :class="locale === 'zh-CN' ? 'segmented-button-active' : ''"
                @click="switchLocale('zh-CN')"
              >
                中文
              </button>
              <button
                type="button"
                class="segmented-button flex-1"
                :class="locale === 'en-US' ? 'segmented-button-active' : ''"
                @click="switchLocale('en-US')"
              >
                EN
              </button>
            </div>

            <p class="panel-kicker mb-1.5 mt-3">
              {{ t('theme.title') }}
            </p>
            <div class="grid gap-1">
              <button
                v-for="option in themeOptions"
                :key="option.mode"
                type="button"
                class="sidebar-item justify-between"
                :class="
                  props.themeMode === option.mode ? 'sidebar-item-active' : ''
                "
                @click="switchTheme(option.mode)"
              >
                <span>{{ t(option.key) }}</span>
                <AppIcon
                  v-if="props.themeMode === option.mode"
                  name="check"
                  :size="14"
                  style="color: var(--ui-accent)"
                />
              </button>
            </div>

            <!-- 版本 & 更新 -->
            <div
              class="mt-3 border-t pt-3"
              style="border-color: var(--ui-border)"
            >
              <p class="mb-1 text-xs" style="color: var(--ui-text-soft)">
                {{
                  t('settings.version', {
                    version:
                      props.updaterState?.currentVersion || appVersion,
                  })
                }}
              </p>
              <button
                type="button"
                class="toolbar-button w-full justify-center text-xs"
                :disabled="
                  !props.updaterSupported ||
                  props.checkingUpdates ||
                  !props.updaterState
                "
                @click="
                  showSettings = false;
                  emit('check-updates');
                "
              >
                <AppIcon
                  :name="props.checkingUpdates ? 'loader' : 'download'"
                  :size="14"
                  :class="props.checkingUpdates ? 'animate-spin' : ''"
                />
                <span>{{
                  props.checkingUpdates
                    ? t('updater.checking')
                    : t('updater.check')
                }}</span>
              </button>
              <p
                v-if="props.updaterState && !props.updaterSupported"
                class="mt-1 text-xs"
                style="color: var(--ui-text-soft)"
              >
                {{ t('updater.unsupported') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Token 设置 -->
        <div class="relative shrink-0">
          <button
            type="button"
            class="toolbar-button h-9 w-9 px-0"
            :class="
              tokenActive
                ? 'icon-button-success'
                : showToken
                  ? 'icon-button-active'
                  : ''
            "
            :title="t('urlBar.tokenSettings')"
            @click="
              showSettings = false;
              showToken = !showToken;
            "
          >
            <AppIcon name="key" :size="16" />
            <span
              v-if="tokenActive"
              class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full"
              style="background-color: var(--ui-success)"
            />
          </button>

          <div
            v-if="showToken"
            class="popover-surface absolute right-0 top-full z-50 mt-1 w-80 p-3"
          >
            <p class="panel-kicker mb-1.5">
              {{ t('common.token') }}
            </p>
            <input
              :value="token"
              type="text"
              :placeholder="t('urlBar.bearerToken')"
              class="toolbar-input w-full"
              @input="onTokenInput"
            />
          </div>
        </div>

        <!-- 生成 AI 代码上下文 -->
        <button
          v-if="sources.length > 0"
          type="button"
          class="toolbar-button shrink-0 whitespace-nowrap"
          :title="t('aiExport.entryTitle')"
          @click="emit('open-export')"
        >
          <AppIcon name="code" :size="16" />
          <span class="hidden sm:inline">{{ t('aiExport.entry') }}</span>
        </button>

        <!-- 刷新 -->
        <button
          v-if="sources.length > 0"
          type="button"
          class="toolbar-button h-9 w-9 shrink-0 px-0"
          :title="loading ? t('common.cancel') : t('common.refresh')"
          @click="loading ? emit('cancel-loading') : emit('reload')"
        >
          <AppIcon :name="loading ? 'x' : 'refresh-cw'" :size="16" />
        </button>

        <button
          v-if="hasDiff"
          type="button"
          class="toolbar-button shrink-0"
          :class="showDiff ? 'status-badge-warning border-transparent' : ''"
          @click="emit('toggle-diff')"
        >
          Diff
          <span class="status-badge status-badge-neutral">{{ diffCount }}</span>
        </button>

        <button
          type="button"
          class="toolbar-button h-9 w-9 shrink-0 px-0"
          :title="t('common.hide')"
          @click="collapsed = true"
        >
          <AppIcon name="chevron-up" :size="16" />
        </button>
      </div>

      <div
        v-if="sources.length > 0"
        class="flex items-center gap-2 overflow-auto pb-0.5"
      >
        <span class="panel-kicker shrink-0">
          {{ t('urlBar.sourceFilter') }}
        </span>

        <button
          type="button"
          class="badge-soft shrink-0 transition"
          :class="selectedSource === '__ALL__' ? 'meta-badge-active' : ''"
          @click="emit('select-source', '__ALL__')"
        >
          {{ t('common.all') }}
          <span style="color: var(--ui-text-soft)">{{
            sources.reduce((sum, source) => sum + source.apis.length, 0)
          }}</span>
        </button>

        <div
          v-for="(source, index) in sources"
          :key="source.id"
          class="badge-soft group shrink-0 transition"
          :class="
            selectedSource === source.id
              ? [
                  getSourceColor(index).bg,
                  getSourceColor(index).border,
                  getSourceColor(index).text,
                ]
              : [
                  getSourceColor(index).text,
                  getSourceColor(index).bgHover,
                  getSourceColor(index).borderHover,
                ]
          "
          :title="source.url"
        >
          <button
            type="button"
            class="flex cursor-pointer items-center gap-1"
            @click="emit('select-source', source.id)"
          >
            <span
              class="source-diamond source-marker-glow h-2 w-2 shrink-0"
              :class="[getSourceColor(index).dot, getSourceColor(index).text]"
            />
            <span>{{ source.name }}</span>
            <span style="color: var(--ui-text-soft)">{{
              source.apis.length
            }}</span>
          </button>
          <button
            type="button"
            class="icon-button icon-button-danger -mr-0.5 ml-0.5 h-4 w-4 rounded"
            :title="t('urlBar.removeSource')"
            @click.stop="emit('remove-source', source.id)"
          >
            <AppIcon name="x" :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- 浮层点击外部关闭遮罩 -->
    <div
      v-if="showSettings || showToken"
      class="fixed inset-0 z-40"
      @click="closeAllPopovers"
    />

    <!-- 添加来源弹窗 -->
    <div
      v-if="showAddDialog"
      class="overlay-backdrop-strong fixed inset-0 z-[60] flex items-start justify-center px-4 pt-28"
      @click.self="cancelAdd"
    >
      <div class="popover-surface w-full max-w-md p-5">
        <h3 class="text-sm font-semibold" style="color: var(--ui-text)">
          {{ t('urlBar.addSourceTitle') }}
        </h3>
        <p class="mt-1 break-all text-xs" style="color: var(--ui-text-soft)">
          {{ urlInput }}
        </p>

        <div class="mt-4">
          <label class="panel-kicker">{{ t('urlBar.sourceName') }}</label>
          <input
            ref="nameInputEl"
            v-model="pendingName"
            type="text"
            :placeholder="t('urlBar.sourcePlaceholder')"
            class="toolbar-input mt-1.5 w-full"
            @keydown.enter="confirmAdd"
            @keydown.esc="cancelAdd"
          />
          <p class="mt-1.5 text-xs" style="color: var(--ui-text-soft)">
            {{ t('urlBar.sourceNameHint') }}
          </p>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="toolbar-button" @click="cancelAdd">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="toolbar-button toolbar-button-primary"
            :disabled="loading"
            @click="confirmAdd"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
