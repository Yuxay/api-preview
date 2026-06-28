<script setup lang="ts">
import { ref } from 'vue'
import type { ApiParameter } from '@/core/types'
import CopyButton from '@/components/CopyButton.vue'
import { useI18n } from '@/i18n'

defineProps<{
  params: ApiParameter[]
  modelValue: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

const expandedDesc = ref<Record<string, boolean>>({})

function paramPlaceholder(p: ApiParameter): string {
  const value = p.example ?? p.schema?.example ?? p.schema?.default
  if (value === null || value === undefined) return p.name
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function formatExample(p: ApiParameter): string {
  const value = p.example ?? p.schema?.example ?? p.schema?.default
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toggleDescExpand(key: string) {
  expandedDesc.value[key] = !expandedDesc.value[key]
}

function isDescExpanded(key: string): boolean {
  return !!expandedDesc.value[key]
}

function isLongText(text: string): boolean {
  return text.length > 30;
}

function paramTypeLabel(p: ApiParameter): string {
  const schema = p.schema;
  if (!schema) return 'string';
  if (schema.$ref) return schema.$ref.split('/').pop() || schema.$ref;
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
  if (schema.type === 'string' && (schema.format === 'binary' || schema.format === 'byte')) {
    return `file (${schema.format})`;
  }
  return [schema.type, schema.format].filter(Boolean).join(' / ') || 'string';
}

const { t } = useI18n()
</script>

<template>
  <div v-if="params.length > 0" class="input-table">
    <table class="w-full text-sm">
      <thead>
        <tr class="input-table-head">
          <th class="input-table-cell w-28 font-medium">{{ t('common.name') }}</th>
          <th class="input-table-cell font-medium">{{ t('common.value') }}</th>
          <th class="input-table-cell w-24 font-medium">{{ t('common.type') }}</th>
          <th class="input-table-cell font-medium">{{ t('common.notes') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in params"
          :key="p.name"
          class="input-table-row"
        >
          <td class="input-table-cell">
            <span class="font-mono text-xs" style="color: var(--ui-text)">{{ p.name }}</span>
            <span v-if="p.required" class="form-required-mark ml-1 text-xs">*</span>
            <CopyButton :value="p.name" :title="t('common.copyName')" />
          </td>
          <td class="input-table-cell">
            <input
              :value="modelValue[p.name] || ''"
              type="text"
              :placeholder="paramPlaceholder(p)"
              class="field-input w-full px-3 py-2 text-xs"
              @input="(e: Event) => {
                const target = e.target as HTMLInputElement
                const copy = { ...modelValue }
                copy[p.name] = target.value
                emit('update:modelValue', copy)
              }"
            />
          </td>
          <td class="input-table-cell text-xs font-mono" style="color: var(--ui-text-soft)">
            {{ paramTypeLabel(p) }}
          </td>
          <td class="input-table-cell text-xs" style="color: var(--ui-text-muted)">
            <span class="inline-flex items-center gap-1 min-w-0">
              <span
                :class="{
                  'line-clamp-1': !isDescExpanded(p.name) && isLongText(p.description || ''),
                }"
                :title="p.description || ''"
              >{{ p.description || t('common.noDescription') }}</span>
              <button
                v-if="isLongText(p.description || '')"
                type="button"
                class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                style="color: var(--ui-accent)"
                @click="toggleDescExpand(p.name)"
              >
                {{ isDescExpanded(p.name) ? t('common.hide') : t('common.show') }}
              </button>
            </span>
            <div v-if="formatExample(p)" class="mt-1 font-mono text-[11px]" style="color: var(--ui-text-soft)">
              {{ t('common.example') }}: {{ formatExample(p) }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
