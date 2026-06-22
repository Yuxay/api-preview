<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

defineOptions({ name: 'JsonTreeView' })

const props = withDefaults(defineProps<{
  value: unknown
  name?: string
  depth?: number
}>(), {
  name: '',
  depth: 0,
})

const isArrayValue = computed(() => Array.isArray(props.value))
const isObjectValue = computed(() =>
  props.value !== null && typeof props.value === 'object' && !Array.isArray(props.value)
)

const entries = computed(() => {
  if (isArrayValue.value) {
    return (props.value as unknown[]).map((item, index) => [`[${index}]`, item] as const)
  }
  if (isObjectValue.value) {
    return Object.entries(props.value as Record<string, unknown>)
  }
  return []
})

function isNested(value: unknown) {
  return value !== null && typeof value === 'object'
}

function preview(value: unknown) {
  if (Array.isArray(value)) return `Array(${value.length})`
  if (value !== null && typeof value === 'object') {
    return `Object(${Object.keys(value as Record<string, unknown>).length})`
  }
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

function valueClass(value: unknown) {
  if (value === null) return 'text-slate-500'
  if (typeof value === 'string') return 'text-emerald-300'
  if (typeof value === 'number') return 'text-sky-300'
  if (typeof value === 'boolean') return 'text-amber-300'
  return 'text-slate-300'
}
</script>

<template>
  <div class="font-mono text-[12px] leading-6">
    <details
      v-if="isArrayValue || isObjectValue"
      class="group"
      :open="depth < 1"
    >
      <summary class="flex cursor-pointer list-none items-center gap-2 text-slate-300 marker:hidden">
        <span class="w-3 text-center text-slate-500 group-open:hidden"><AppIcon name="plus" :size="12" /></span>
        <span class="hidden w-3 text-center text-slate-500 group-open:inline"><AppIcon name="minus" :size="12" /></span>
        <span v-if="name" class="text-slate-400">{{ name }}</span>
        <span class="text-slate-500">{{ isArrayValue ? '[' : '{' }}</span>
        <span class="text-slate-500">{{ preview(value) }}</span>
        <span class="text-slate-500">{{ isArrayValue ? ']' : '}' }}</span>
      </summary>

      <div class="mt-1 space-y-1 border-l border-white/10 pl-4">
        <JsonTreeView
          v-for="[entryName, entryValue] in entries"
          :key="String(entryName)"
          :name="String(entryName)"
          :value="entryValue"
          :depth="depth + 1"
        />
      </div>
    </details>

    <div v-else class="flex items-start gap-2">
      <span class="w-3 shrink-0 text-center text-slate-600">·</span>
      <span v-if="name" class="text-slate-400">{{ name }}</span>
      <span class="break-all" :class="valueClass(value)">
        {{ typeof value === 'string' ? `"${value}"` : String(value) }}
      </span>
    </div>

    <div
      v-if="(isArrayValue || isObjectValue) && entries.length === 0"
      class="ml-5 text-slate-500"
    >
      {{ isArrayValue ? '[]' : '{}' }}
    </div>
  </div>
</template>
