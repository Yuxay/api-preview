<script setup lang="ts">
import { computed } from 'vue'
import type { FormField } from '@/core/schemaFormEngine'
import AppIcon from '@/components/AppIcon.vue'
import { useI18n } from '@/i18n'

const props = defineProps<{
  field: FormField
  depth: number
}>()

const emit = defineEmits<{
  'update:field': [field: FormField]
}>()

const hasChildren = computed(
  () => props.field.type === 'object' && props.field.children && props.field.children.length > 0
)

const isArrayEditor = computed(() => props.field.type === 'array' || props.field.type === 'object')
const { t } = useI18n()

function toggleCollapse() {
  emit('update:field', { ...props.field, collapsed: !props.field.collapsed })
}

function onValueChange(val: unknown) {
  emit('update:field', { ...props.field, value: val })
}

function onChildChange(index: number, child: FormField) {
  if (!props.field.children) return
  const copy = [...props.field.children]
  copy[index] = child
  emit('update:field', { ...props.field, children: copy })
}
</script>

<template>
  <div class="px-3 py-2">
    <!-- 字段头部 -->
    <div
      class="flex cursor-pointer select-none items-center gap-2"
      :class="{ 'cursor-pointer': hasChildren }"
      @click="hasChildren && toggleCollapse()"
    >
      <!-- 折叠图标 -->
      <AppIcon
        v-if="hasChildren"
        :name="field.collapsed ? 'chevron-right' : 'chevron-down'"
        :size="10"
        class="w-3 shrink-0"
        style="color: var(--ui-text-soft)"
      />
      <span v-else class="w-3 shrink-0"></span>

      <!-- 字段名 -->
      <label class="form-key min-w-[96px] shrink-0">
        {{ field.key }}
        <span v-if="field.required" class="form-required-mark ml-0.5">*</span>
      </label>

      <!-- 类型标签 -->
      <span class="form-type-chip">
        {{ field.type }}{{ field.format ? `:${field.format}` : '' }}
      </span>

      <!-- Spacer -->
      <span class="flex-1"></span>

      <!-- 描述 -->
      <span
        v-if="field.description && !field.collapsed"
        class="form-description max-w-[180px] truncate"
      >
        {{ field.description }}
      </span>
    </div>

    <!-- 字段值输入（非折叠时） -->
    <div v-if="!field.collapsed" class="mt-1.5 ml-5 space-y-1">
      <!-- string / number / integer -->
      <template v-if="field.type === 'string' || field.type === 'number' || field.type === 'integer'">
        <!-- 枚举 → select -->
        <select
          v-if="field.enum && field.enum.length > 0"
          :value="String(field.value ?? '')"
          class="field-input w-full px-2 py-1.5 text-xs"
          @change="(e: Event) => onValueChange((e.target as HTMLSelectElement).value)"
        >
          <option value="" disabled>{{ t('requestEditor.chooseValue') }}</option>
          <option
            v-for="opt in field.enum"
            :key="String(opt)"
            :value="String(opt)"
          >
            {{ opt }}
          </option>
        </select>
        <!-- 普通输入 -->
        <input
          v-else
          :type="field.type === 'number' || field.type === 'integer' ? 'number' : 'text'"
          :value="field.value as string | number"
          :placeholder="field.format || field.description || field.key"
          class="field-input w-full px-2 py-1.5 text-xs font-mono"
          @input="(e: Event) => {
            const raw = (e.target as HTMLInputElement).value
            onValueChange(field.type === 'number' || field.type === 'integer' ? Number(raw) : raw)
          }"
        />
      </template>

      <!-- boolean → checkbox -->
      <template v-else-if="field.type === 'boolean'">
        <label class="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            :checked="Boolean(field.value)"
            class="selection-checkbox"
            @change="(e: Event) => onValueChange((e.target as HTMLInputElement).checked)"
          />
          <span class="text-xs font-mono" style="color: var(--ui-text-muted)">{{ String(field.value) }}</span>
        </label>
      </template>

      <!-- array → JSON textarea -->
      <template v-else-if="field.type === 'array'">
        <textarea
          :value="typeof field.value === 'string' ? field.value : JSON.stringify(field.value ?? [], null, 2)"
          rows="3"
          spellcheck="false"
          class="json-editor field-input w-full resize-y px-2 py-1.5 text-xs"
          @input="(e: Event) => onValueChange((e.target as HTMLTextAreaElement).value)"
        ></textarea>
        <p class="editor-note">{{ t('requestEditor.arrayHint') }}</p>
      </template>

      <!-- object → 递归 SmartForm -->
      <template v-else-if="field.type === 'object' && field.children">
        <p
          v-if="field.children.length === 0"
          class="py-1 text-xs italic"
          style="color: var(--ui-text-soft)"
        >
          {{ t('requestEditor.emptyObject') }}
        </p>
        <!-- 内嵌子表单 -->
        <div
          v-for="(child, ci) in field.children"
          :key="child.key"
          class="tree-rail ml-1 pl-2"
        >
          <FormFieldComponent
            :field="child"
            :depth="depth + 1"
            @update:field="(updated: FormField) => onChildChange(ci, updated)"
          />
        </div>
      </template>
    </div>

    <!-- 折叠时显示预览 -->
    <div v-else-if="hasChildren" class="ml-5 mt-0.5 text-[10px] italic" style="color: var(--ui-text-soft)">
      {{ field.type === 'object' ? `{...}` : '[...]' }}
    </div>
  </div>
</template>
