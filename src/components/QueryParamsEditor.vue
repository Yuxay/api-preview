<script setup lang="ts">
import type { ApiParameter } from '@/core/types'
import { useI18n } from '@/i18n'

defineProps<{
  params: ApiParameter[]
  modelValue: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

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
            {{ p.schema?.type || 'string' }}
          </td>
          <td class="input-table-cell text-xs" style="color: var(--ui-text-muted)">
            <div class="truncate">{{ p.description || t('common.noDescription') }}</div>
            <div v-if="formatExample(p)" class="mt-1 font-mono text-[11px]" style="color: var(--ui-text-soft)">
              {{ t('common.example') }}: {{ formatExample(p) }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
