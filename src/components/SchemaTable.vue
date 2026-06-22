<script setup lang="ts">
import { ref } from 'vue'
import type { ApiSchema } from '@/core/types'
import CopyButton from '@/components/CopyButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'

defineProps<{
  schema: ApiSchema
  requiredFields?: string[]
  depth?: number
}>()

const expanded = ref<Record<string, boolean>>({})
const { t } = useI18n()

function toggle(key: string) {
  expanded.value[key] = !expanded.value[key]
}

function isExpanded(key: string): boolean {
  return !!expanded.value[key]
}

function isRequired(name: string, required?: string[]): boolean {
  return required?.includes(name) ?? false
}

function typeLabel(schema: ApiSchema): string {
  let label = schema.type || 'object'
  if (schema.format) label += ` (${schema.format})`
  if (schema.nullable) label += ' | null'
  if (schema.enum?.length) label += ' (enum)'
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop() || schema.$ref
    label = `$ref → ${refName}`
  }
  if (schema.oneOf) label = 'oneOf'
  if (schema.anyOf) label = 'anyOf'
  if (schema.allOf) label = 'allOf'
  return label
}

function exampleText(schema: ApiSchema): string {
  if (schema.example !== undefined) return JSON.stringify(schema.example)
  if (schema.default !== undefined) return JSON.stringify(schema.default)
  if (schema.enum?.length) return schema.enum.map((e) => JSON.stringify(e)).join(' | ')
  return ''
}

function hasChildren(schema: ApiSchema): boolean {
  return !!(
    (schema.type === 'object' || !schema.type) && schema.properties && Object.keys(schema.properties).length > 0
  )
}

function sortedProperties(schema: ApiSchema): [string, ApiSchema][] {
  if (!schema.properties) return []
  const entries = Object.entries(schema.properties)
  const req = new Set(schema.required || [])
  entries.sort((a, b) => {
    if (req.has(a[0]) && !req.has(b[0])) return -1
    if (!req.has(a[0]) && req.has(b[0])) return 1
    return a[0].localeCompare(b[0])
  })
  return entries
}

</script>

<template>
  <div>
    <!-- 根 schema 没有 properties 时显示单行汇总 -->
    <div
      v-if="sortedProperties(schema).length === 0 && !schema.$ref && !schema.oneOf && !schema.anyOf"
      class="text-xs text-dark-400 font-mono px-3 py-1"
    >
      {{ typeLabel(schema) }}
      <span v-if="exampleText(schema)" class="text-dark-600 ml-2">{{ t('common.example') }}: {{ exampleText(schema) }}</span>
      <span v-if="schema.description" class="text-dark-600 ml-2">{{ schema.description }}</span>
    </div>

    <!-- $ref 引用 -->
    <div v-else-if="schema.$ref" class="text-xs text-dark-400 font-mono px-3 py-1">
      → {{ schema.$ref.split('/').pop() }}
    </div>

    <!-- oneOf / anyOf / allOf -->
    <div v-else-if="schema.oneOf || schema.anyOf || schema.allOf" class="px-3 py-1 space-y-1">
      <div
        v-for="(sub, i) in (schema.oneOf || schema.anyOf || schema.allOf || [])"
        :key="i"
        class="border border-dark-700 rounded"
      >
        <SchemaTable
          :schema="sub"
          :required-fields="sub.required"
          :depth="(depth || 0) + 1"
        />
      </div>
    </div>

    <!-- 对象：按 properties 生成表格行 -->
    <template v-else>
      <table class="w-full text-xs">
        <thead v-if="depth === 0 || depth === undefined">
          <tr class="border-b border-dark-700 text-dark-500">
            <th class="text-left font-medium px-3 py-1.5 w-32">{{ t('schema.field') }}</th>
            <th class="text-left font-medium px-3 py-1.5 w-24">{{ t('common.type') }}</th>
            <th class="text-left font-medium px-3 py-1.5 w-10">{{ t('common.required') }}</th>
            <th class="text-left font-medium px-3 py-1.5">{{ t('common.description') }}</th>
            <th class="text-left font-medium px-3 py-1.5">{{ t('common.example') }}</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="[name, prop] in sortedProperties(schema)" :key="name">
            <!-- 可展开的对象行 -->
            <template v-if="hasChildren(prop) || prop.$ref || prop.oneOf || prop.anyOf">
              <tr
                class="border-b border-dark-800/50 hover:bg-dark-800/30 cursor-pointer transition-colors group"
                @click="toggle(name)"
              >
                <td class="px-3 py-1.5 font-mono text-dark-200 relative">
                  <AppIcon
                    :name="isExpanded(name) ? 'chevron-down' : 'chevron-right'"
                    :size="10"
                    class="mr-1 inline-block align-baseline text-dark-500"
                  />
                  {{ name }}
                  <span v-if="isRequired(name, schema.required)" class="text-red-400 ml-0.5">*</span>
                  <CopyButton :value="name" :title="t('schema.copyField')" />
                </td>
                <td class="px-3 py-1.5 text-dark-400 font-mono">{{ typeLabel(prop) }}</td>
                <td class="px-3 py-1.5">
                  <span v-if="isRequired(name, schema.required)" class="text-red-400 font-bold">{{ t('common.yes') }}</span>
                  <span v-else class="text-dark-600">{{ t('common.no') }}</span>
                </td>
                <td class="px-3 py-1.5 text-dark-500 max-w-48 truncate relative">
                  <span class="group-hover:inline hidden">{{ prop.description || '—' }}</span>
                  <CopyButton
                    v-if="prop.description"
                    :value="prop.description"
                    :title="t('schema.copyDescription')"
                  />
                </td>
                <td class="px-3 py-1.5 text-dark-500 font-mono max-w-32 truncate">
                  {{ exampleText(prop) || '—' }}
                </td>
              </tr>
              <!-- 展开子表 -->
              <tr v-if="isExpanded(name)" class="bg-dark-850/50">
                <td colspan="5" class="px-3 py-2 border-b border-dark-700/30">
                  <SchemaTable
                    :schema="prop"
                    :required-fields="prop.required"
                    :depth="(depth || 0) + 1"
                  />
                </td>
              </tr>
            </template>

            <!-- Array 行 -->
            <template v-else-if="prop.type === 'array' && prop.items">
              <tr
                class="border-b border-dark-800/50 hover:bg-dark-800/30 cursor-pointer transition-colors group"
                @click="toggle(name)"
              >
                <td class="px-3 py-1.5 font-mono text-dark-200">
                  <AppIcon
                    :name="isExpanded(name) ? 'chevron-down' : 'chevron-right'"
                    :size="10"
                    class="mr-1 inline-block align-baseline text-dark-500"
                  />
                  {{ name }}
                  <span v-if="isRequired(name, schema.required)" class="text-red-400 ml-0.5">*</span>
                  <CopyButton :value="name" :title="t('schema.copyField')" />
                </td>
                <td class="px-3 py-1.5 text-dark-400 font-mono">
                  array&lt;{{ prop.items.type || 'object' }}&gt;
                </td>
                <td class="px-3 py-1.5">
                  <span v-if="isRequired(name, schema.required)" class="text-red-400 font-bold">{{ t('common.yes') }}</span>
                  <span v-else class="text-dark-600">{{ t('common.no') }}</span>
                </td>
                <td class="px-3 py-1.5 text-dark-500 max-w-48 truncate relative">
                  {{ prop.description || '—' }}
                  <CopyButton
                    v-if="prop.description"
                    :value="prop.description"
                    :title="t('schema.copyDescription')"
                  />
                </td>
                <td class="px-3 py-1.5 text-dark-500 font-mono max-w-32 truncate">
                  —
                </td>
              </tr>
              <tr v-if="isExpanded(name)" class="bg-dark-850/50">
                <td colspan="5" class="px-3 py-2 border-b border-dark-700/30">
                  <div class="text-[10px] text-dark-600 mb-1">{{ t('schema.arrayItemType') }}</div>
                  <SchemaTable
                    :schema="prop.items"
                    :required-fields="prop.items.required"
                    :depth="(depth || 0) + 1"
                  />
                </td>
              </tr>
            </template>

            <!-- 普通字段行 -->
            <tr v-else class="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors group">
              <td class="px-3 py-1.5 font-mono text-dark-200">
                {{ name }}
                <span v-if="isRequired(name, schema.required)" class="text-red-400 ml-0.5">*</span>
                <CopyButton :value="name" :title="t('schema.copyField')" />
              </td>
              <td class="px-3 py-1.5 text-dark-400 font-mono">{{ typeLabel(prop) }}</td>
              <td class="px-3 py-1.5">
                <span v-if="isRequired(name, schema.required)" class="text-red-400 font-bold">{{ t('common.yes') }}</span>
                <span v-else class="text-dark-600">{{ t('common.no') }}</span>
              </td>
              <td class="px-3 py-1.5 text-dark-500 max-w-48 truncate relative">
                {{ prop.description || '—' }}
                <CopyButton
                  v-if="prop.description"
                  :value="prop.description"
                  :title="t('schema.copyDescription')"
                />
              </td>
              <td class="px-3 py-1.5 text-dark-500 font-mono max-w-32 truncate">
                {{ exampleText(prop) || '—' }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </div>
</template>
