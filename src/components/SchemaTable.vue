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
const expandedDesc = ref<Record<string, boolean>>({});
const expandedExample = ref<Record<string, boolean>>({});
const { t } = useI18n();

function toggle(key: string) {
  expanded.value[key] = !expanded.value[key];
}

function isExpanded(key: string): boolean {
  return !!expanded.value[key];
}

function toggleDescExpand(key: string) {
  expandedDesc.value[key] = !expandedDesc.value[key];
}

function isDescExpanded(key: string): boolean {
  return !!expandedDesc.value[key];
}

function toggleExampleExpand(key: string) {
  expandedExample.value[key] = !expandedExample.value[key];
}

function isExampleExpanded(key: string): boolean {
  return !!expandedExample.value[key];
}

function isLongText(text: string): boolean {
  return text.length > 30;
}

function isLongExample(text: string): boolean {
  return text.length > 15;
}

function isRequired(name: string, required?: string[]): boolean {
  return required?.includes(name) ?? false;
}

function typeLabel(schema: ApiSchema, seen = new WeakSet<ApiSchema>()): string {
  // $ref takes priority — show referenced type name
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop() || schema.$ref;
    return `$ref → ${refName}`;
  }

  let label = schema.type || 'object';

  // Map objects: object with additionalProperties but no fixed properties
  if (
    schema.type === 'object' &&
    !schema.properties &&
    schema.additionalProperties
  ) {
    if (schema.additionalProperties === true) {
      label = 'map<string, any>';
    } else if (seen.has(schema.additionalProperties)) {
      label = 'map<string, ...>';
    } else {
      seen.add(schema.additionalProperties);
      label = `map<string, ${typeLabel(schema.additionalProperties, seen)}>`;
    }
  }

  // Arrays: show item type inside angle brackets
  if (schema.type === 'array' && schema.items) {
    if (seen.has(schema.items)) {
      label = 'array<...>';
    } else {
      seen.add(schema.items);
      label = `array<${typeLabel(schema.items, seen)}>`;
    }
  } else if (schema.type === 'array') {
    label = 'array';
  }

  // Format: give binary/byte a friendlier label
  if (schema.format) {
    if (schema.format === 'binary') {
      label = `file (binary)`;
    } else if (schema.format === 'byte') {
      label = `file (base64)`;
    } else {
      label += ` (${schema.format})`;
    }
  }

  // Nullable
  if (schema.nullable) label += ' | null';

  // Enum
  if (schema.enum?.length) label += ' (enum)';

  // Composite types — use compact label with variant count
  if (schema.oneOf) label = `oneOf [${schema.oneOf.length}]`;
  if (schema.anyOf) label = `anyOf [${schema.anyOf.length}]`;
  if (schema.allOf) label = `allOf [${schema.allOf.length}]`;

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
        <span
          v-if="schema.description"
          class="schema-summary-meta inline-flex items-center gap-1"
          :title="schema.description"
        >
          <span
            :class="{
              'line-clamp-1': !isDescExpanded('root') && isLongText(schema.description),
            }"
          >{{ schema.description }}</span>
          <button
            v-if="isLongText(schema.description)"
            type="button"
            class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
            style="color: var(--ui-accent)"
            @click.stop="toggleDescExpand('root')"
          >
            {{ isDescExpanded('root') ? t('common.hide') : t('common.show') }}
          </button>
        </span>
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
        <span
          v-if="schema.description"
          class="schema-summary-meta inline-flex items-center gap-1"
          :title="schema.description"
        >
          <span
            :class="{
              'line-clamp-1': !isDescExpanded('root') && isLongText(schema.description),
            }"
          >{{ schema.description }}</span>
          <button
            v-if="isLongText(schema.description)"
            type="button"
            class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
            style="color: var(--ui-accent)"
            @click.stop="toggleDescExpand('root')"
          >
            {{ isDescExpanded('root') ? t('common.hide') : t('common.show') }}
          </button>
        </span>
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
      <span v-if="exampleText(schema)" class="schema-summary-meta inline-flex items-center gap-1">
        <span
          :class="{
            'line-clamp-1': !isExampleExpanded('root') && isLongExample(exampleText(schema)),
          }"
          :title="exampleText(schema)"
          class="break-all"
        >{{ t('common.example') }}: {{ exampleText(schema) }}</span>
        <button
          v-if="isLongExample(exampleText(schema))"
          type="button"
          class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
          style="color: var(--ui-accent)"
          @click.stop="toggleExampleExpand('root')"
        >
          {{ isExampleExpanded('root') ? t('common.hide') : t('common.show') }}
        </button>
      </span>
      <span
        v-if="schema.description"
        class="schema-summary-meta inline-flex items-center gap-1"
        :title="schema.description"
      >
        <span
          :class="{
            'line-clamp-1': !isDescExpanded('root') && isLongText(schema.description),
          }"
        >{{ schema.description }}</span>
        <button
          v-if="isLongText(schema.description)"
          type="button"
          class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
          style="color: var(--ui-accent)"
          @click.stop="toggleDescExpand('root')"
        >
          {{ isDescExpanded('root') ? t('common.hide') : t('common.show') }}
        </button>
      </span>
    </div>

    <!-- 对象：按 properties 生成表格行 -->
    <template v-else>
      <table class="schema-table">
        <thead>
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
              <span
                class="ml-1.5 text-[10px] font-normal"
                style="color: var(--ui-text-muted)"
                :title="t('schema.hoverToCopy')"
              >
                {{ t('schema.hoverToCopy') }}
              </span>
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
              v-if="hasChildren(prop) || prop.$ref || prop.oneOf || prop.anyOf || prop.allOf"
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
                  <span class="inline-flex items-center gap-1 min-w-0">
                    <span
                      :class="{
                        'line-clamp-1': !isDescExpanded(name) && isLongText(prop.description || ''),
                      }"
                      :title="prop.description || ''"
                    >{{
                      prop.description || '—'
                    }}</span>
                    <button
                      v-if="isLongText(prop.description || '')"
                      type="button"
                      class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                      style="color: var(--ui-accent)"
                      @click.stop="toggleDescExpand(name)"
                    >
                      {{ isDescExpanded(name) ? t('common.hide') : t('common.show') }}
                    </button>
                  </span>
                  <CopyButton
                    v-if="prop.description"
                    :value="prop.description"
                    :title="t('schema.copyDescription')"
                  />
                </td>
                <td class="schema-cell schema-example">
                  <span class="inline-flex items-center gap-1 min-w-0">
                    <span
                      :class="{
                        'line-clamp-1': !isExampleExpanded(name) && isLongExample(exampleText(prop)),
                        'break-all': isExampleExpanded(name),
                      }"
                      :title="exampleText(prop)"
                    >{{ exampleText(prop) || '—' }}</span>
                    <button
                      v-if="isLongExample(exampleText(prop))"
                      type="button"
                      class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                      style="color: var(--ui-accent)"
                      @click.stop="toggleExampleExpand(name)"
                    >
                      {{ isExampleExpanded(name) ? t('common.hide') : t('common.show') }}
                    </button>
                  </span>
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
                  <span class="inline-flex items-center gap-1 min-w-0">
                    <span
                      :class="{
                        'line-clamp-1': !isDescExpanded(name) && isLongText(prop.description || ''),
                      }"
                      :title="prop.description || ''"
                    >{{
                      prop.description || '—'
                    }}</span>
                    <button
                      v-if="isLongText(prop.description || '')"
                      type="button"
                      class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                      style="color: var(--ui-accent)"
                      @click.stop="toggleDescExpand(name)"
                    >
                      {{ isDescExpanded(name) ? t('common.hide') : t('common.show') }}
                    </button>
                  </span>
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
                <span class="inline-flex items-center gap-1 min-w-0">
                  <span
                    :class="{
                      'line-clamp-1': !isDescExpanded(name) && isLongText(prop.description || ''),
                    }"
                    :title="prop.description || ''"
                  >{{
                    prop.description || '—'
                  }}</span>
                  <button
                    v-if="isLongText(prop.description || '')"
                    type="button"
                    class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                    style="color: var(--ui-accent)"
                    @click.stop="toggleDescExpand(name)"
                  >
                    {{ isDescExpanded(name) ? t('common.hide') : t('common.show') }}
                  </button>
                </span>
                <CopyButton
                  v-if="prop.description"
                  :value="prop.description"
                  :title="t('schema.copyDescription')"
                />
              </td>
              <td class="schema-cell schema-example">
                <span class="inline-flex items-center gap-1 min-w-0">
                  <span
                    :class="{
                      'line-clamp-1': !isExampleExpanded(name) && isLongExample(exampleText(prop)),
                      'break-all': isExampleExpanded(name),
                    }"
                    :title="exampleText(prop)"
                  >{{ exampleText(prop) || '—' }}</span>
                  <button
                    v-if="isLongExample(exampleText(prop))"
                    type="button"
                    class="inline-flex shrink-0 cursor-pointer text-[10px] font-medium underline-offset-2 hover:underline"
                    style="color: var(--ui-accent)"
                    @click.stop="toggleExampleExpand(name)"
                  >
                    {{ isExampleExpanded(name) ? t('common.hide') : t('common.show') }}
                  </button>
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </div>
</template>
