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
      class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      type="button"
      @click="toggle"
    >
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-slate-100">{{ title }}</h3>
          <slot name="meta" />
        </div>
        <p v-if="subtitle" class="mt-0.5 text-xs text-slate-400">{{ subtitle }}</p>
      </div>
      <div class="flex items-center gap-2" @click.stop>
        <slot name="actions" />
      </div>
      <span class="text-xs text-slate-500">
        {{ modelValue ? t('common.hide') : t('common.show') }}
      </span>
      <AppIcon
        :name="modelValue ? 'minus' : 'plus'"
        :size="14"
        class="shrink-0 text-slate-400"
      />
    </button>

    <div v-show="modelValue" class="border-t border-white/10" :class="bodyClass">
      <slot />
    </div>
  </section>
</template>
