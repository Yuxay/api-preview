<script setup lang="ts">
import { useI18n } from '@/i18n'

defineProps<{
  modelValue: Record<string, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, string>]
}>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-end">
      <button
        class="ghost-button"
        @click="() => {
          const copy = { ...modelValue }
          copy[''] = ''
          emit('update:modelValue', copy)
        }"
      >
        {{ t('requestEditor.addHeader') }}
      </button>
    </div>

    <div class="space-y-2">
      <div
        v-for="(val, key) in modelValue"
        :key="key"
        class="group grid grid-cols-[180px_minmax(0,1fr)_auto] gap-2"
      >
        <input
          :value="key"
          type="text"
          :placeholder="t('requestEditor.headerName')"
          class="field-input px-3 py-2 text-[11px] font-mono"
          @input="(e: Event) => {
            const newKey = (e.target as HTMLInputElement).value
            const copy: Record<string, string> = {}
            for (const [k, v] of Object.entries(modelValue)) {
              if (k === key) {
                if (newKey) copy[newKey] = v
              } else {
                copy[k] = v
              }
            }
            emit('update:modelValue', copy)
          }"
        />
        <input
          :value="val"
          type="text"
          :placeholder="t('requestEditor.valuePlaceholder')"
          class="field-input px-3 py-2 text-[11px] font-mono"
          @input="(e: Event) => {
            const copy = { ...modelValue }
            copy[key] = (e.target as HTMLInputElement).value
            emit('update:modelValue', copy)
          }"
        />
        <button
          class="icon-button icon-button-danger h-auto w-auto rounded-md px-2 py-2 text-xs opacity-0 group-hover:opacity-100"
          :title="t('common.remove')"
          @click="() => {
            const copy = { ...modelValue }
            delete copy[key]
            emit('update:modelValue', copy)
          }"
        >
          {{ t('common.remove') }}
        </button>
      </div>
    </div>
  </div>
</template>
