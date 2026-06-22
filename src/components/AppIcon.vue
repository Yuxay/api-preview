<script setup lang="ts">
/**
 * AppIcon — 统一图标系统
 *
 * 所有图标均为 Lucide 风格：viewBox="0 0 24 24" · fill="none"
 * stroke="currentColor" · stroke-width="2" · stroke-linecap="round" · stroke-linejoin="round"
 *
 * 使用方式: <AppIcon name="search" size="16" />
 */

export type IconName = keyof typeof icons

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
    class?: string
  }>(),
  {
    size: 16,
  },
)

const sizePx = typeof props.size === 'number' ? `${props.size}px` : props.size

// ============================================================
// 图标路径库 — 所有路径基于 Lucide 图标规范
// ============================================================
const icons = {
  /* ─── 导航 / 方向 ─── */
  'chevron-left':  'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-down':  'M6 9l6 6 6-6',
  'chevron-up':    'M18 15l-6-6-6 6',
  'arrow-left':    'M19 12H5m7-7-7 7 7 7',
  'arrow-right':   'M5 12h14m-7-7 7 7-7 7',

  /* ─── 操作 ─── */
  'search':  'M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  'plus':    'M12 5v14m-7-7h14',
  'minus':   'M5 12h14',
  'x':       'M18 6L6 18M6 6l12 12',
  'refresh-cw': 'M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6',
  'copy':    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 9h7v7H9z',
  'check':   'M20 6L9 17l-5-5',
  'trash-2': 'M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
  'pencil':  'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  'play':    'M5 3l14 9-14 9V3z',
  'send':    'M22 2l-7 20-4-9-9-4Z',
  'download':'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  'upload':  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',

  /* ─── 对象 / 指示 ─── */
  'file-text':    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  'book-open':    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  'settings':     'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'key':          'M21 2l-9.6 9.6M15.5 7.5l2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4M7.5 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  'globe':        'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10M12 2a15.3 15.3 0 0 0-4 10 15.3 15.3 0 0 0 4 10',
  'code':         'M16 18l6-6-6-6M8 6l-6 6 6 6',
  'folder':       'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  'database':     'M4 6c0 1.66 3.58 3 8 3s8-1.34 8-3M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6',
  'list':         'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  'more-horizontal': 'M12 12h.01M19 12h.01M5 12h.01',
  'more-vertical':   'M12 3v.01M12 12v.01M12 21v.01M12 16v.01M12 8v.01',
  'eye':          'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off':      'M10.73 5.07A10.8 10.8 0 0 1 12 5c7 0 11 7 11 7a15.4 15.4 0 0 1-2.22 3.34M6.22 6.22A10.9 10.9 0 0 0 1 12s4 8 11 8a11.5 11.5 0 0 0 5.45-1.45M4.26 18.86 2 21M21 2l-2.26 2.26M14.83 14.83A3 3 0 1 0 9.17 9.17',
  'link':         'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  'external-link':'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3',
  'tag':          'M12 2H2v10l9.17 9.17a2 2 0 0 0 2.83 0l7-7a2 2 0 0 0 0-2.83Z',
  'dot':          'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  'square':       'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  'layers':       'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',

  /* ─── 状态 ─── */
  'check-circle':     'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  'alert-triangle':   'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  'info':             'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  'loader':           'M21 12a9 9 0 1 1-6.22-8.55', // spinner arc

  /* ─── 数据源标记 — 菱形 / 圆圈变体 ─── */
  'diamond':  'M12 2l10 10-10 10L2 12Z',
} as const
</script>

<template>
  <svg
    :class="props.class"
    :width="sizePx"
    :height="sizePx"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="icons[name]" />
  </svg>
</template>
