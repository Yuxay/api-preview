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
  if (value === null) return 'tree-token'
  if (typeof value === 'string') return 'status-badge-success'
  if (typeof value === 'number') return 'status-badge-info'
  if (typeof value === 'boolean') return 'status-badge-warning'
  return ''
}
</script>

<template>
  <div class="font-mono text-[12px] leading-6">
    <details
      v-if="isArrayValue || isObjectValue"
      class="group"
      :open="depth < 1"
    >
      <summary class="tree-summary">
        <span class="tree-toggle group-open:hidden"><AppIcon name="plus" :size="12" /></span>
        <span class="tree-toggle hidden group-open:inline"><AppIcon name="minus" :size="12" /></span>
        <span v-if="name" class="tree-key">{{ name }}</span>
        <span class="tree-token">{{ isArrayValue ? '[' : '{' }}</span>
        <span class="tree-token">{{ preview(value) }}</span>
        <span class="tree-token">{{ isArrayValue ? ']' : '}' }}</span>
      </summary>

      <div class="tree-rail">
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
      <span class="tree-toggle shrink-0">·</span>
      <span v-if="name" class="tree-key">{{ name }}</span>
      <span class="break-all" :class="valueClass(value)">
        {{ typeof value === 'string' ? `"${value}"` : String(value) }}
      </span>
    </div>

    <div
      v-if="(isArrayValue || isObjectValue) && entries.length === 0"
      class="ml-5 tree-token"
    >
      {{ isArrayValue ? '[]' : '{}' }}
    </div>
  </div>
</template>
