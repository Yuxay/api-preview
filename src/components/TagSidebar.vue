<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import { getUiState, saveUiState } from '@/utils/storage';
import { getSourceColor } from '@/services/swaggerMultiLoader';
import type { SwaggerSource } from '@/core/types';
import type { DiffResult } from '@/core/apiDiffEngine';
import AppIcon from '@/components/AppIcon.vue';
import { useI18n } from '@/i18n';

const props = defineProps<{
  sources: SwaggerSource[];
  selectedSource: string;
  tags: string[];
  selectedTag: string;
  apiCount: number;
  tagCounts: Record<string, number>;
  diffResults: DiffResult[];
}>();

const emit = defineEmits<{
  'select-source': [id: string];
  'select-tag': [tag: string];
  'remove-source': [id: string];
  'rename-source': [id: string, name: string];
  'move-source': [draggedId: string, targetId: string];
  'toggle-sidebar': [];
}>();

const sourcesOpen = ref(getUiState('sidebar-sources-open', true));
const tagsOpen = ref(getUiState('sidebar-tags-open', true));
const renamingId = ref('');
const renameValue = ref('');
const renameInputEl = ref<HTMLInputElement | null>(null);
const draggingId = ref('');
const dragOverId = ref('');

const { t } = useI18n();

watch(sourcesOpen, (value) => saveUiState('sidebar-sources-open', value));
watch(tagsOpen, (value) => saveUiState('sidebar-tags-open', value));

function sourceDiffCount(sourceId: string) {
  const diff = props.diffResults.find((item) => item.sourceId === sourceId);
  if (!diff) return 0;
  return diff.summary.added + diff.summary.removed + diff.summary.modified;
}

function startRename(id: string, name: string) {
  renamingId.value = id;
  renameValue.value = name;
  nextTick(() => {
    renameInputEl.value?.focus();
    renameInputEl.value?.select();
  });
}

function commitRename(id: string) {
  const trimmed = renameValue.value.trim();
  if (trimmed) {
    emit('rename-source', id, trimmed);
  }
  renamingId.value = '';
}

function cancelRename() {
  renamingId.value = '';
}

function onDragStart(event: DragEvent, id: string) {
  draggingId.value = id;
  event.dataTransfer?.setData('text/plain', id);
  event.dataTransfer?.setDragImage?.(event.currentTarget as Element, 12, 12);
}

function onDragEnter(id: string) {
  if (!draggingId.value || draggingId.value === id) return;
  dragOverId.value = id;
}

function onDragEnd() {
  draggingId.value = '';
  dragOverId.value = '';
}

function onDrop(targetId: string) {
  if (draggingId.value && draggingId.value !== targetId) {
    emit('move-source', draggingId.value, targetId);
  }
  onDragEnd();
}
</script>

<template>
  <aside class="panel-surface flex h-full min-h-0 flex-col overflow-hidden">
    <div class="panel-header">
      <div>
        <p class="panel-kicker">{{ t('sidebar.workspace') }}</p>
        <h2 class="panel-title">{{ t('sidebar.sourcesAndTags') }}</h2>
        <p class="panel-description">{{ t('sidebar.description') }}</p>
      </div>
      <button
        type="button"
        class="icon-button icon-button-sm collapse-toggle mt-0.5 shrink-0"
        :title="t('common.hide')"
        @click="emit('toggle-sidebar')"
      >
        <AppIcon name="chevron-left" :size="14" />
      </button>
    </div>

    <div class="flex-1 overflow-auto px-2 py-2">
      <section class="mb-3">
        <button
          type="button"
          class="section-toggle-button"
          @click="sourcesOpen = !sourcesOpen"
        >
          <span class="panel-kicker">{{ t('common.source') }}</span>
          <AppIcon :name="sourcesOpen ? 'minus' : 'plus'" :size="12" />
        </button>

        <div v-if="sourcesOpen" class="mt-1 space-y-1">
          <button
            type="button"
            class="sidebar-item"
            :class="selectedSource === '__ALL__' ? 'sidebar-item-active' : ''"
            @click="emit('select-source', '__ALL__')"
          >
            <span class="h-2 w-2 rounded-full bg-slate-500" />
            <span class="min-w-0 flex-1 truncate">{{
              t('sidebar.allSources')
            }}</span>
            <span class="text-xs" style="color: var(--ui-text-soft)">{{
              sources.reduce((sum, source) => sum + source.apis.length, 0)
            }}</span>
          </button>

          <div
            v-for="(source, index) in sources"
            :key="source.id"
            class="group cursor-pointer rounded-lg border transition"
            :class="
              selectedSource === source.id
                ? [
                    getSourceColor(index).bg,
                    getSourceColor(index).border,
                    getSourceColor(index).text,
                  ]
                : [
                    'border-transparent',
                    getSourceColor(index).text,
                    getSourceColor(index).bgHover,
                    getSourceColor(index).borderHover,
                  ]
            "
            :draggable="renamingId !== source.id"
            :style="{
              opacity: draggingId === source.id ? '0.65' : '1',
              borderStyle:
                dragOverId === source.id && draggingId !== source.id
                  ? 'dashed'
                  : undefined,
            }"
            :title="source.url"
            @dragstart="onDragStart($event, source.id)"
            @dragenter.prevent="onDragEnter(source.id)"
            @dragover.prevent
            @dragend="onDragEnd"
            @drop.prevent="onDrop(source.id)"
            @click="emit('select-source', source.id)"
          >
            <div class="flex items-center gap-2 px-3 py-2">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  class="icon-button icon-button-xs shrink-0 cursor-grab active:cursor-grabbing"
                  :title="t('common.source')"
                  tabindex="-1"
                  @click.stop
                >
                  <AppIcon name="more-vertical" :size="14" />
                </button>
                <span
                  class="source-diamond source-marker-glow h-2 w-2 shrink-0"
                  :class="[
                    getSourceColor(index).dot,
                    getSourceColor(index).text,
                  ]"
                />
                <input
                  v-if="renamingId === source.id"
                  ref="renameInputEl"
                  v-model="renameValue"
                  type="text"
                  class="field-input min-w-0 flex-1 px-2 py-1 text-sm !border-sky-400/40"
                  @blur="commitRename(source.id)"
                  @click.stop
                  @keydown.enter="commitRename(source.id)"
                  @keydown.esc="cancelRename"
                />
                <span
                  v-else
                  class="min-w-0 flex-1 truncate text-sm"
                  @dblclick.stop="startRename(source.id, source.name)"
                >
                  {{ source.name }}
                </span>
              </div>

              <span
                class="status-badge"
                :class="
                  source.status === 'error'
                    ? 'status-badge-danger'
                    : 'status-badge-neutral'
                "
              >
                {{
                  source.status === 'error'
                    ? t('common.error')
                    : source.apis.length
                }}
              </span>

              <span
                v-if="sourceDiffCount(source.id) > 0"
                class="status-badge status-badge-warning"
              >
                {{ sourceDiffCount(source.id) }}
              </span>

              <button
                v-if="renamingId !== source.id"
                type="button"
                class="icon-button icon-button-xs shrink-0 opacity-0 group-hover:opacity-100"
                :title="t('common.rename')"
                @click.stop="startRename(source.id, source.name)"
              >
                <AppIcon name="pencil" :size="14" />
              </button>

              <button
                type="button"
                class="icon-button icon-button-xs icon-button-danger shrink-0 opacity-0 group-hover:opacity-100"
                :title="t('common.remove')"
                @click.stop="emit('remove-source', source.id)"
              >
                <AppIcon name="x" :size="14" />
              </button>
            </div>

            <div
              class="px-3 pb-2 text-[11px]"
              style="color: var(--ui-text-soft)"
            >
              <div class="truncate">{{ source.url }}</div>
              <div
                v-if="source.error"
                class="truncate"
                style="color: var(--ui-danger)"
              >
                {{ source.error }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <button
          type="button"
          class="section-toggle-button"
          @click="tagsOpen = !tagsOpen"
        >
          <span class="panel-kicker">{{ t('common.tags') }}</span>
          <AppIcon :name="tagsOpen ? 'minus' : 'plus'" :size="12" />
        </button>

        <div v-if="tagsOpen" class="mt-1 space-y-1">
          <button
            type="button"
            class="sidebar-item"
            :class="selectedTag === '__ALL__' ? 'sidebar-item-active' : ''"
            @click="emit('select-tag', '__ALL__')"
          >
            <span class="min-w-0 flex-1 truncate">{{
              t('sidebar.allApis')
            }}</span>
            <span class="text-xs" style="color: var(--ui-text-soft)">{{
              apiCount
            }}</span>
          </button>

          <button
            v-for="tag in tags"
            :key="tag"
            type="button"
            class="sidebar-item"
            :class="selectedTag === tag ? 'sidebar-item-active' : ''"
            @click="emit('select-tag', tag)"
          >
            <span class="min-w-0 flex-1 truncate">{{ tag }}</span>
            <span class="text-xs" style="color: var(--ui-text-soft)">{{
              tagCounts[tag] || 0
            }}</span>
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>
