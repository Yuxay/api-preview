<script setup lang="ts">
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title: string
  subtitle?: string
  bodyClass?: string
}>(), {
  subtitle: '',
  bodyClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const { t } = useI18n()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <section class="panel-surface overflow-hidden">
    <button
      class="panel-header panel-header-compact w-full text-left transition-colors"
      type="button"
      @click="toggle"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold" style="color: var(--ui-text)">{{ title }}</h3>
          <slot name="meta" />
        </div>
        <p v-if="subtitle" class="mt-0.5 text-xs" style="color: var(--ui-text-muted)">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-2" @click.stop>
        <slot name="actions" />
      </div>
      <span class="text-xs" style="color: var(--ui-text-soft)">
        {{ modelValue ? t('common.hide') : t('common.show') }}
      </span>
      <AppIcon
        :name="modelValue ? 'minus' : 'plus'"
        :size="14"
        class="shrink-0"
        style="color: var(--ui-text-muted)"
      />
    </button>

    <div v-show="modelValue" class="panel-divider border-t" :class="bodyClass">
      <slot />
    </div>
  </section>
</template>
