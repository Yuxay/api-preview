<script setup lang="ts">
import { ref } from 'vue';
import type { ApiSchema } from '@/core/types';
import CopyButton from '@/components/CopyButton.vue';
import AppIcon from '@/components/AppIcon.vue';
import { useI18n } from '@/i18n';

defineProps<{
  schema: ApiSchema;
  requiredFields?: string[];
  depth?: number;
}>();

const expanded = ref<Record<string, boolean>>({});
const { t } = useI18n();

function toggle(key: string) {
  expanded.value[key] = !expanded.value[key];
}

function isExpanded(key: string): boolean {
  return !!expanded.value[key];
}

function isRequired(name: string, required?: string[]): boolean {
  return required?.includes(name) ?? false;
}

function typeLabel(schema: ApiSchema, seen = new WeakSet<ApiSchema>()): string {
  let label = schema.type || 'object';
  if (
    schema.type === 'object' &&
    !schema.properties &&
    schema.additionalProperties
  ) {
    if (schema.additionalProperties === true) {
      label = 'object<string, any>';
    } else if (seen.has(schema.additionalProperties)) {
      label = 'object<string, ...>';
    } else {
      seen.add(schema.additionalProperties);
      label = `object<string, ${typeLabel(schema.additionalProperties, seen)}>`;
    }
  }
  if (schema.format) label += ` (${schema.format})`;
  if (schema.nullable) label += ' | null';
  if (schema.enum?.length) label += ' (enum)';
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop() || schema.$ref;
    label = `$ref → ${refName}`;
  }
  if (schema.oneOf) label = 'oneOf';
  if (schema.anyOf) label = 'anyOf';
  if (schema.allOf) label = 'allOf';
  return label;
}

function exampleText(schema: ApiSchema): string {
  if (schema.example !== undefined) return JSON.stringify(schema.example);
  if (schema.default !== undefined) return JSON.stringify(schema.default);
  if (schema.enum?.length)
    return schema.enum.map((e) => JSON.stringify(e)).join(' | ');
  return '';
}

function hasChildren(schema: ApiSchema): boolean {
  return !!(
    (schema.type === 'object' || !schema.type) &&
    schema.properties &&
    Object.keys(schema.properties).length > 0
  );
}

function sortedProperties(schema: ApiSchema): [string, ApiSchema][] {
  if (!schema.properties) return [];
  const entries = Object.entries(schema.properties);
  const req = new Set(schema.required || []);
  entries.sort((a, b) => {
    if (req.has(a[0]) && !req.has(b[0])) return -1;
    if (!req.has(a[0]) && req.has(b[0])) return 1;
    return a[0].localeCompare(b[0]);
  });
  return entries;
}

function mapValueSchema(schema: ApiSchema): ApiSchema | null {
  return schema.additionalProperties &&
    typeof schema.additionalProperties === 'object'
    ? schema.additionalProperties
    : null;
}

function isMapSchema(schema: ApiSchema): boolean {
  return !!(
    schema.type === 'object' &&
    !schema.properties &&
    schema.additionalProperties
  );
}
</script>

<template>
  <div>
    <!-- oneOf / anyOf / allOf -->
    <div
      v-if="schema.oneOf || schema.anyOf || schema.allOf"
      class="space-y-1 px-3 py-1"
    >
      <div
        v-for="(sub, i) in schema.oneOf || schema.anyOf || schema.allOf || []"
        :key="i"
        class="schema-box"
      >
        <SchemaTable
          :schema="sub"
          :required-fields="sub.required"
          :depth="(depth || 0) + 1"
        />
      </div>
    </div>

    <!-- $ref 引用 -->
    <div v-else-if="schema.$ref" class="schema-summary">
      → {{ schema.$ref.split('/').pop() }}
    </div>

    <!-- 根级数组 -->
    <div
      v-else-if="schema.type === 'array' && schema.items"
      class="space-y-2 px-3 py-1"
    >
      <div class="schema-summary">
        {{ typeLabel(schema) }}
        <span v-if="schema.description" class="schema-summary-meta">{{
          schema.description
        }}</span>
      </div>
      <div class="schema-array-label">{{ t('schema.arrayItemType') }}</div>
      <SchemaTable
        :schema="schema.items"
        :required-fields="schema.items.required"
        :depth="(depth || 0) + 1"
      />
    </div>

    <!-- 根级映射对象 -->
    <div v-else-if="isMapSchema(schema)" class="space-y-2 px-3 py-1">
      <div class="schema-summary">
        {{ typeLabel(schema) }}
        <span v-if="schema.description" class="schema-summary-meta">{{
          schema.description
        }}</span>
      </div>
      <div v-if="mapValueSchema(schema)" class="schema-array-label">
        {{ t('schema.mapValueType') }}
      </div>
      <SchemaTable
        v-if="mapValueSchema(schema)"
        :schema="mapValueSchema(schema)!"
        :required-fields="mapValueSchema(schema)!.required"
        :depth="(depth || 0) + 1"
      />
    </div>

    <!-- 根 schema 没有 properties 时显示单行汇总 -->
    <div
      v-else-if="sortedProperties(schema).length === 0"
      class="schema-summary"
    >
      {{ typeLabel(schema) }}
      <span v-if="exampleText(schema)" class="schema-summary-meta"
        >{{ t('common.example') }}: {{ exampleText(schema) }}</span
      >
      <span v-if="schema.description" class="schema-summary-meta">{{
        schema.description
      }}</span>
    </div>

    <!-- 对象：按 properties 生成表格行 -->
    <template v-else>
      <table class="schema-table">
        <thead v-if="depth === 0 || depth === undefined">
          <tr class="schema-table-head">
            <th class="schema-cell w-32 text-left font-medium">
              {{ t('schema.field') }}
            </th>
            <th class="schema-cell w-24 text-left font-medium">
              {{ t('common.type') }}
            </th>
            <th class="schema-cell w-10 text-left font-medium">
              {{ t('common.required') }}
            </th>
            <th class="schema-cell text-left font-medium">
              {{ t('common.description') }}
            </th>
            <th class="schema-cell text-left font-medium">
              {{ t('common.example') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="[name, prop] in sortedProperties(schema)"
            :key="name"
          >
            <!-- 可展开的对象行 -->
            <template
              v-if="hasChildren(prop) || prop.$ref || prop.oneOf || prop.anyOf"
            >
              <tr
                class="schema-row schema-row-expand group"
                @click="toggle(name)"
              >
                <td class="schema-cell schema-field-name">
                  <AppIcon
                    :name="isExpanded(name) ? 'chevron-down' : 'chevron-right'"
                    :size="10"
                    class="schema-toggle"
                  />
                  {{ name }}
                  <span
                    v-if="isRequired(name, schema.required)"
                    class="schema-required ml-0.5"
                    >*</span
                  >
                  <CopyButton :value="name" :title="t('schema.copyField')" />
                </td>
                <td class="schema-cell schema-type">{{ typeLabel(prop) }}</td>
                <td class="schema-cell">
                  <span
                    v-if="isRequired(name, schema.required)"
                    class="schema-required-yes"
                    >{{ t('common.yes') }}</span
                  >
                  <span v-else class="schema-required-no">{{
                    t('common.no')
                  }}</span>
                </td>
                <td class="schema-cell schema-description">
                  <span class="group-hover:inline hidden">{{
                    prop.description || '—'
                  }}</span>
                  <CopyButton
                    v-if="prop.description"
                    :value="prop.description"
                    :title="t('schema.copyDescription')"
                  />
                </td>
                <td class="schema-cell schema-example">
                  {{ exampleText(prop) || '—' }}
                </td>
              </tr>
              <!-- 展开子表 -->
              <tr v-if="isExpanded(name)" class="schema-row-nested">
                <td
                  colspan="5"
                  class="schema-cell border-b"
                  style="
                    border-color: color-mix(
                      in srgb,
                      var(--ui-border) 60%,
                      transparent
                    );
                  "
                >
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
                class="schema-row schema-row-expand group"
                @click="toggle(name)"
              >
                <td class="schema-cell schema-field-name">
                  <AppIcon
                    :name="isExpanded(name) ? 'chevron-down' : 'chevron-right'"
                    :size="10"
                    class="schema-toggle"
                  />
                  {{ name }}
                  <span
                    v-if="isRequired(name, schema.required)"
                    class="schema-required ml-0.5"
                    >*</span
                  >
                  <CopyButton :value="name" :title="t('schema.copyField')" />
                </td>
                <td class="schema-cell schema-type">
                  array&lt;{{ prop.items.type || 'object' }}&gt;
                </td>
                <td class="schema-cell">
                  <span
                    v-if="isRequired(name, schema.required)"
                    class="schema-required-yes"
                    >{{ t('common.yes') }}</span
                  >
                  <span v-else class="schema-required-no">{{
                    t('common.no')
                  }}</span>
                </td>
                <td class="schema-cell schema-description">
                  {{ prop.description || '—' }}
                  <CopyButton
                    v-if="prop.description"
                    :value="prop.description"
                    :title="t('schema.copyDescription')"
                  />
                </td>
                <td class="schema-cell schema-example">—</td>
              </tr>
              <tr v-if="isExpanded(name)" class="schema-row-nested">
                <td
                  colspan="5"
                  class="schema-cell border-b"
                  style="
                    border-color: color-mix(
                      in srgb,
                      var(--ui-border) 60%,
                      transparent
                    );
                  "
                >
                  <div class="schema-array-label">
                    {{ t('schema.arrayItemType') }}
                  </div>
                  <SchemaTable
                    :schema="prop.items"
                    :required-fields="prop.items.required"
                    :depth="(depth || 0) + 1"
                  />
                </td>
              </tr>
            </template>

            <!-- 普通字段行 -->
            <tr v-else class="schema-row group">
              <td class="schema-cell schema-field-name">
                {{ name }}
                <span
                  v-if="isRequired(name, schema.required)"
                  class="schema-required ml-0.5"
                  >*</span
                >
                <CopyButton :value="name" :title="t('schema.copyField')" />
              </td>
              <td class="schema-cell schema-type">{{ typeLabel(prop) }}</td>
              <td class="schema-cell">
                <span
                  v-if="isRequired(name, schema.required)"
                  class="schema-required-yes"
                  >{{ t('common.yes') }}</span
                >
                <span v-else class="schema-required-no">{{
                  t('common.no')
                }}</span>
              </td>
              <td class="schema-cell schema-description">
                {{ prop.description || '—' }}
                <CopyButton
                  v-if="prop.description"
                  :value="prop.description"
                  :title="t('schema.copyDescription')"
                />
              </td>
              <td class="schema-cell schema-example">
                {{ exampleText(prop) || '—' }}
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </div>
</template>
