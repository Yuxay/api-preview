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
  <div v-if="params.length > 0" class="overflow-hidden rounded-lg border border-white/10">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-white/[0.03] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <th class="px-3 py-2 font-medium w-28">{{ t('common.name') }}</th>
          <th class="px-3 py-2 font-medium">{{ t('common.value') }}</th>
          <th class="px-3 py-2 font-medium w-24">{{ t('common.type') }}</th>
          <th class="px-3 py-2 font-medium">{{ t('common.notes') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="p in params"
          :key="p.name"
          class="border-t border-white/5"
        >
          <td class="px-3 py-2.5 align-top">
            <span class="font-mono text-xs text-slate-200">{{ p.name }}</span>
            <span v-if="p.required" class="ml-1 text-xs text-red-400">*</span>
          </td>
          <td class="px-3 py-2.5">
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
          <td class="px-3 py-2.5 text-xs font-mono text-slate-500">
            {{ p.schema?.type || 'string' }}
          </td>
          <td class="px-3 py-2.5 text-xs text-slate-400">
            <div class="truncate">{{ p.description || t('common.noDescription') }}</div>
            <div v-if="formatExample(p)" class="mt-1 font-mono text-[11px] text-slate-500">
              {{ t('common.example') }}: {{ formatExample(p) }}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
