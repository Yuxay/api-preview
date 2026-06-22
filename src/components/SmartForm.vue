<script setup lang="ts">
import { computed } from 'vue'
import type { FormField } from '@/core/schemaFormEngine'
import { generateFieldValue } from '@/core/schemaFormEngine'
import FormFieldComponent from '@/components/FormField.vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  fields: FormField[]
  depth: number
}>()

const emit = defineEmits<{
  'update:fields': [fields: FormField[]]
}>()

// 传播子字段的更新
function onChildChange(index: number, updated: FormField) {
  const copy = props.fields.map((f, i) => (i === index ? updated : f))
  emit('update:fields', copy)
}

const maxDepth = computed(() => Math.max(0, ...props.fields.map((f) => depthOf(f))))
const { t } = useI18n()

function depthOf(f: FormField): number {
  if (!f.children || f.children.length === 0) return 0
  return 1 + Math.max(0, ...f.children.map((c) => depthOf(c)))
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="fields.length === 0" class="py-2 text-xs italic text-slate-500">
      {{ t('requestEditor.emptyRequestBody') }}
    </div>
    <div
      v-for="(field, idx) in fields"
      :key="field.key"
      class="transition-colors"
      :class="[
        depth > 0 ? 'surface-sunken' : 'surface-inset',
        field.required && !field.value && field.value !== 0 && field.value !== false
          ? 'border-l-2 border-l-amber-400/50'
          : '',
      ]"
    >
      <FormFieldComponent
        :field="field"
        :depth="depth"
        @update:field="(updated: FormField) => onChildChange(idx, updated)"
      />
    </div>
  </div>
</template>
