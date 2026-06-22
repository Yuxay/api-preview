<script setup lang="ts">
import { ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{
  value: string
  title?: string
}>()

const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1200)
  } catch {
    // 忽略剪贴板错误
  }
}
</script>

<template>
  <button
    type="button"
    class="ml-1.5 inline-flex cursor-pointer align-middle text-dark-600 opacity-0 transition-opacity hover:text-dark-300 group-hover:opacity-100"
    :title="title"
    @click.stop="copy"
  >
    <AppIcon
      v-if="!copied"
      name="copy"
      :size="12"
      class="shrink-0"
    />
    <AppIcon
      v-else
      name="check"
      :size="12"
      class="shrink-0 text-emerald-400"
    />
  </button>
</template>
