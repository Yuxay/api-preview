<script setup lang="ts">
import { computed } from 'vue';
import { tryParseJson } from '@/utils/format';
import { useI18n } from '@/i18n';

const props = defineProps<{
  modelValue: string;
  validateJson?: boolean;
  label?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const validation = computed(() => {
  if (props.validateJson === false) {
    return { ok: true, data: props.modelValue, error: undefined as string | undefined };
  }
  if (!props.modelValue.trim())
    return { ok: true, data: null, error: undefined as string | undefined };
  const result = tryParseJson(props.modelValue);
  return result;
});

const lineCount = computed(() => {
  return Math.max(6, (props.modelValue.match(/\n/g) || []).length + 1);
});

const { t } = useI18n();
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <span class="text-xs" style="color: var(--ui-text-muted)">{{
        label || t('requestEditor.jsonBody')
      }}</span>
      <span
        v-if="validateJson !== false && modelValue.trim()"
        class="text-[11px] font-mono"
        :style="{
          color: validation.ok ? 'var(--ui-success)' : 'var(--ui-danger)',
        }"
      >
        {{
          validation.ok
            ? t('requestEditor.validJson')
            : validation.error || t('requestEditor.invalidJson')
        }}
      </span>
    </div>
    <textarea
      :value="modelValue"
      :rows="lineCount"
      spellcheck="false"
      class="json-editor field-input w-full resize-y px-3 py-3"
      :class="modelValue.trim() && !validation.ok ? 'field-input-invalid' : ''"
      @input="
        (e: Event) =>
          emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
      "
    ></textarea>
  </div>
</template>
