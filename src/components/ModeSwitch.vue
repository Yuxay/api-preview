<script setup lang="ts">
import { useI18n } from '@/i18n'

defineProps<{
  modelValue: 'form' | 'json'
}>()

const emit = defineEmits<{
  'update:modelValue': [mode: 'form' | 'json']
}>()

const { t } = useI18n()
</script>

<template>
  <div class="segmented-control">
    <button
      class="segmented-button"
      :class="modelValue === 'form'
        ? 'segmented-button-active'
        : ''"
      @click="emit('update:modelValue', 'form')"
    >
      {{ t('common.form') }}
    </button>
    <button
      class="segmented-button"
      :class="modelValue === 'json'
        ? 'segmented-button-active'
        : ''"
      @click="emit('update:modelValue', 'json')"
    >
      {{ t('common.json') }}
    </button>
  </div>
</template>
