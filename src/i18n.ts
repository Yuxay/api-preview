import { computed, ref, watch } from 'vue';
import { getUiState, saveUiState } from '@/utils/storage';

export type Locale = 'zh-CN' | 'en-US';

interface MessageSchema {
  [key: string]: string | MessageSchema;
}

type MessageValue = string | MessageSchema;
type MessageParams = Record<string, string | number>;

const LOCALE_STORAGE_KEY = 'locale';
const DEFAULT_LOCALE: Locale = 'zh-CN';

const messages: Record<Locale, MessageSchema> = {
  'zh-CN': {
    common: {
      add: '添加',
      after: '变更后',
      all: '全部',
      api: 'API',
      appName: 'ApiPreview',
      before: '变更前',
      body: '请求体',
      cancel: '取消',
      clear: '清空',
      close: '关闭',
      code: '代码',
      confirm: '确定',
      copyDescription: '复制说明',
      copyName: '复制字段名',
      copyPath: '复制路径',
      copyUrl: '复制 URL',
      copied: '已复制',
      defaultSource: '默认来源',
      description: '说明',
      diff: '差异',
      error: '错误',
      example: '示例',
      form: '表单',
      headers: '请求头',
      hide: '收起',
      impacted: '受影响',
      items: '项',
      json: 'JSON',
      language: '语言',
      loading: '加载中',
      method: '方法',
      name: '名称',
      noDescription: '无说明',
      noSummary: '无摘要',
      notes: '备注',
      off: '关闭',
      on: '开启',
      optional: '可选',
      parameters: '参数',
      path: '路径',
      query: 'Query',
      refresh: '刷新',
      remove: '移除',
      rename: '重命名',
      required: '必填',
      response: '响应',
      root: '根节点',
      schema: 'Schema',
      search: '搜索',
      server: '服务器',
      show: '展开',
      source: '来源',
      status: '状态',
      success: '成功',
      summary: '摘要',
      table: '表格',
      tag: '标签',
      tags: '标签',
      token: 'Token',
      type: '类型',
      value: '值',
      yes: '是',
      no: '否',
    },
    locale: {
      zh: '中文',
      en: 'English',
    },
    theme: {
      title: '主题',
      light: '浅色',
      dark: '深色',
      system: '跟随系统',
    },
    settings: {
      title: '外观设置',
      language: '语言',
      version: '版本 {version}',
    },
    updater: {
      check: '检查更新',
      checking: '检查中',
      checkingForUpdates: '正在检查新版本...',
      availableTitle: '发现新版本',
      downloadingTitle: '正在下载更新',
      downloadedTitle: '更新已就绪',
      latestTitle: '已是最新版本',
      errorTitle: '检查更新失败',
      updateNow: '立即更新',
      installNow: '立即安装',
      remindLater: '稍后再说',
      background: '后台下载',
      updateAvailable: '发现新版本 {version}，是否现在下载并准备安装？',
      downloading: '正在下载更新包... {progress}%',
      downloaded: '新版本 {version} 已下载完成，是否现在安装？',
      upToDate: '当前已是最新版本（{version}）。',
      checkFailed: '检查更新失败：{message}',
      unsupported: '当前平台暂不支持自动更新。',
    },
    app: {
      intro:
        '从顶部输入 Swagger / OpenAPI URL，加载后即可浏览 API、调试请求、管理多个来源并查看差异变化。',
      loadingDocs: '正在加载 API 文档...',
      selectApiHint:
        '从中间列表选择一个 API，右侧会显示文档、请求参数和调试响应。',
    },
    urlBar: {
      addSource: '添加来源',
      addSourceTitle: '添加来源',
      allSources: '全部',
      bearerToken: 'Bearer Token',
      loadExample: '加载示例',
      pasteUrl:
        '粘贴 Swagger URL，例如 http://127.0.0.1:8080/v3/api-docs/business',
      removeSource: '删除来源',
      searchPlaceholder: '搜索 API 路径、摘要、标签...',
      sourceFilter: '来源筛选',
      sourceName: '来源名称',
      sourceNameHint: '不修改则使用默认名称',
      sourcePlaceholder: '来源名',
      tokenSettings: 'Token 设置',
      toolbar: '工具栏',
      urlRequired: '请先粘贴 Swagger / OpenAPI URL',
    },
    sidebar: {
      allApis: '全部 API',
      allSources: '全部来源',
      description: '按来源或标签聚焦文档范围。',
      sourcesAndTags: '来源与标签',
      workspace: '工作区',
    },
    explorer: {
      browseHint: '按 method / path / summary 浏览接口',
      empty: '当前筛选条件下没有 API。',
      noMatch: '没有匹配当前关键词的 API，尝试搜索 path、summary 或 tag。',
      searchLabel: '搜索：{query}',
      title: 'API 浏览器',
    },
    aiExport: {
      entry: 'AI 代码',
      entryTitle: '生成 AI 代码上下文',
      quickExport: '导出此接口',
      title: '生成 AI 代码上下文',
      description:
        '勾选一个或多个 API，或直接勾选标签全选其下接口，生成包含 URL、参数、请求体与响应体的规范，可直接交给 AI Agent 生成接口文件与页面。',
      filterPlaceholder: '筛选 method / path / summary / tag...',
      selectedCount: '已选 {count} 个接口',
      selectAll: '全选',
      expandAll: '全部展开',
      collapseAll: '全部收起',
      generate: '生成代码',
      copy: '复制',
      download: '下载',
      emptyHint: '勾选左侧的 API 或标签，然后点击「生成代码」。',
    },
    apiDetail: {
      docsTab: '文档',
      testTab: '调试',
      docsTabHint: '阅读接口定义与 Schema',
      testTabHint: '调试参数并发送请求',
      parametersTitle: '参数定义',
      parametersHint: '按位置查看接口参数。',
      noParameters: '该接口没有参数。',
      requestBodyTitle: '请求体定义',
      requestMediaType: '请求体类型',
      paramLocation: '位置',
      documentedResponses: '文档响应',
      documentedResponsesHint: '按规范查看状态码与返回 Schema。',
      emptyResponse: '发送请求后，在这里查看返回状态、Headers 与 JSON 结构。',
      emptyResponseBody: '响应体将显示在这里。',
      optionalRequestBody: '可选请求体',
      pathParams: '路径参数',
      queryParams: '查询参数',
      cookieParams: 'Cookie 参数',
      request: '请求',
      requestSubtitle: 'Path / Query / Headers / Body',
      requiredRequestBody: '必填请求体',
      responseSubtitle: '运行时响应 + Schema 参考',
      runtimePayload: '运行时载荷',
      runtimePayloadHint: '树状浏览 JSON，非 JSON 以代码块显示。',
      binaryPayload: '二进制响应',
      binaryPayloadHint:
        '当前响应以 Base64 保存，避免二进制内容被错误按文本解析。',
      schemaReference: 'Schema 参考',
      sendRequest: '发送请求',
      sending: '发送中...',
      serverFallback: '使用规范中的服务器地址',
      tryRequest: '调试请求',
      tryRequestSummary:
        '路径 {pathCount} · Query {queryCount} · 请求头 {headerCount}',
      documentedResponseCount: '{count} 处变更',
    },
    cache: {
      restoredNotice: '以下来源使用了本地缓存（服务端不可达）：{names}',
      partialNotice:
        '{errors}；以下来源已使用本地缓存：{names}',
    },
    diff: {
      added: '新增',
      currentApis: '当前 API 数：{count}',
      emptyCategory: '当前分类下没有差异项。',
      impactedApis: '受影响 API',
      modified: '修改',
      noApiFieldChanges: '该接口在此分类下没有可展开的字段级变化。',
      noSchemaFieldChanges: '该 Schema 在此分类下没有字段级差异。',
      removed: '删除',
      selectHint: '选择左侧差异项查看详情。',
      unchanged: '未变更',
    },
    requestEditor: {
      addHeader: '添加 Header',
      arrayHint: '输入 JSON 数组，例如 [1, 2, 3]',
      chooseValue: '选择一个值',
      emptyObject: '空对象',
      emptyRequestBody: '无请求体参数',
      headerName: 'Header 名称',
      invalidJson: 'JSON 格式错误',
      jsonBody: 'JSON 请求体',
      rawBody: '原始请求体',
      validJson: 'JSON 有效',
      valuePlaceholder: '值',
    },
    schema: {
      arrayItemType: '数组元素类型：',
      copyDescription: '复制说明',
      copyField: '复制字段名',
      field: '字段',
      hoverToCopy: '悬停行可复制',
      mapValueType: '映射值类型：',
    },
    errors: {
      duplicateSource: '该文档地址已存在：{url}',
      exampleUnavailable: '示例项目仅在 Electron 开发模式下可用',
      http: 'HTTP {status}: {statusText}',
      invalidJson: 'JSON 格式错误：{message}',
      invalidSpec: '响应不是有效的 OpenAPI/Swagger 规范',
      loadFailed: '加载失败',
      missingPathParam: '路径参数 "{param}" 未填写',
      networkError: '网络错误',
      reloadFailed: '重新加载失败',
      unknownError: '未知错误',
    },
    meta: {
      addCount: '+{count} 新增',
      apiCount: '{count} 个接口',
      changeCount: '{count} 处变更',
      headerCount: '{count} 个 Header',
      itemCount: '{count} 项',
      parameterCount: '{count} 个参数',
      removeCount: '-{count} 删除',
      score: '分数 {score}',
      tildeCount: '~{count} 修改',
    },
  },
  'en-US': {
    common: {
      add: 'Add',
      after: 'After',
      all: 'All',
      api: 'API',
      appName: 'ApiPreview',
      before: 'Before',
      body: 'Body',
      cancel: 'Cancel',
      clear: 'Clear',
      close: 'Close',
      code: 'Code',
      confirm: 'Confirm',
      copyDescription: 'Copy Description',
      copyName: 'Copy Name',
      copyPath: 'Copy Path',
      copyUrl: 'Copy URL',
      copied: 'Copied',
      defaultSource: 'Default Source',
      description: 'Description',
      diff: 'Diff',
      error: 'Error',
      example: 'Example',
      form: 'Form',
      headers: 'Headers',
      hide: 'Hide',
      impacted: 'Impacted',
      items: 'Items',
      json: 'JSON',
      language: 'Language',
      loading: 'Loading',
      method: 'Method',
      name: 'Name',
      noDescription: 'No description',
      noSummary: 'No summary',
      notes: 'Notes',
      off: 'Off',
      on: 'On',
      optional: 'Optional',
      parameters: 'Parameters',
      path: 'Path',
      query: 'Query',
      refresh: 'Refresh',
      remove: 'Remove',
      rename: 'Rename',
      required: 'Required',
      response: 'Response',
      root: 'root',
      schema: 'Schema',
      search: 'Search',
      server: 'Server',
      show: 'Show',
      source: 'Source',
      status: 'Status',
      success: 'Success',
      summary: 'Summary',
      table: 'Table',
      tag: 'Tag',
      tags: 'Tags',
      token: 'Token',
      type: 'Type',
      value: 'Value',
      yes: 'Yes',
      no: 'No',
    },
    locale: {
      zh: 'Chinese',
      en: 'English',
    },
    theme: {
      title: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    settings: {
      title: 'Appearance',
      language: 'Language',
      version: 'Version {version}',
    },
    updater: {
      check: 'Check Updates',
      checking: 'Checking',
      checkingForUpdates: 'Checking for updates...',
      availableTitle: 'Update Available',
      downloadingTitle: 'Downloading Update',
      downloadedTitle: 'Update Ready',
      latestTitle: 'Latest Version',
      errorTitle: 'Update Check Failed',
      updateNow: 'Update Now',
      installNow: 'Install Now',
      remindLater: 'Later',
      background: 'Run in Background',
      updateAvailable:
        'Version {version} is available. Download it now and get ready to install?',
      downloading: 'Downloading update... {progress}%',
      downloaded: 'Version {version} has finished downloading. Install it now?',
      upToDate: 'You are on the latest version ({version}).',
      checkFailed: 'Update check failed: {message}',
      unsupported: 'Automatic updates are not supported on this platform.',
    },
    app: {
      intro:
        'Paste a Swagger / OpenAPI URL at the top to browse APIs, debug requests, manage multiple sources, and inspect diffs.',
      loadingDocs: 'Loading API documents...',
      selectApiHint:
        'Select an API from the middle list to view docs, request params, and runtime responses.',
    },
    urlBar: {
      addSource: 'Add Source',
      addSourceTitle: 'Add Source',
      allSources: 'All',
      bearerToken: 'Bearer Token',
      loadExample: 'Load Example',
      pasteUrl:
        'Paste a Swagger URL, e.g. http://127.0.0.1:8080/v3/api-docs/business',
      removeSource: 'Remove source',
      searchPlaceholder: 'Search API path, summary, tag...',
      sourceFilter: 'Source Filter',
      sourceName: 'Source name',
      sourceNameHint: 'Keep the default name if left unchanged',
      sourcePlaceholder: 'Source',
      tokenSettings: 'Token settings',
      toolbar: 'Toolbar',
      urlRequired: 'Paste a Swagger / OpenAPI URL first',
    },
    sidebar: {
      allApis: 'All APIs',
      allSources: 'All Sources',
      description: 'Focus the document scope by source or tag.',
      sourcesAndTags: 'Sources & Tags',
      workspace: 'Workspace',
    },
    explorer: {
      browseHint: 'Browse APIs by method / path / summary',
      empty: 'No APIs match the current filters.',
      noMatch:
        'No API matches the current keyword. Try searching by path, summary, or tag.',
      searchLabel: 'Search: {query}',
      title: 'API Explorer',
    },
    aiExport: {
      entry: 'AI Code',
      entryTitle: 'Generate AI code context',
      quickExport: 'Export this API',
      title: 'Generate AI Code Context',
      description:
        'Select one or more APIs, or pick whole tags to include all their endpoints. Generates a spec with URL, parameters, request and response bodies that you can hand to an AI agent to scaffold API files and pages.',
      filterPlaceholder: 'Filter by method / path / summary / tag...',
      selectedCount: '{count} selected',
      selectAll: 'Select All',
      expandAll: 'Expand All',
      collapseAll: 'Collapse All',
      generate: 'Generate',
      copy: 'Copy',
      download: 'Download',
      emptyHint: 'Select APIs or tags on the left, then click "Generate".',
    },
    apiDetail: {
      docsTab: 'Docs',
      testTab: 'Debug',
      docsTabHint: 'Read the API definition and schemas',
      testTabHint: 'Tune parameters and send requests',
      parametersTitle: 'Parameters',
      parametersHint: 'Inspect parameters grouped by location.',
      noParameters: 'This API has no parameters.',
      requestBodyTitle: 'Request Body',
      requestMediaType: 'Body Media Type',
      paramLocation: 'In',
      documentedResponses: 'Documented Responses',
      documentedResponsesHint:
        'Inspect documented status codes and response schemas.',
      emptyResponse:
        'Send a request to inspect status, headers, and JSON structure here.',
      emptyResponseBody: 'Response body will appear here.',
      optionalRequestBody: 'Optional request body',
      pathParams: 'Path Params',
      queryParams: 'Query Params',
      cookieParams: 'Cookie Params',
      request: 'Request',
      requestSubtitle: 'Path / Query / Headers / Body',
      requiredRequestBody: 'Required request body',
      responseSubtitle: 'Runtime response + schema reference',
      runtimePayload: 'Runtime Payload',
      runtimePayloadHint:
        'Browse JSON as a tree. Non-JSON payloads are shown as code.',
      binaryPayload: 'Binary Payload',
      binaryPayloadHint:
        'This response is stored as Base64 so binary content is not corrupted by text decoding.',
      schemaReference: 'Schema Reference',
      sendRequest: 'Send Request',
      sending: 'Sending...',
      serverFallback: 'Use server from spec',
      tryRequest: 'Try Request',
      tryRequestSummary:
        'Path {pathCount} · Query {queryCount} · Headers {headerCount}',
      documentedResponseCount: '{count} change(s)',
    },
    cache: {
      restoredNotice:
        'The following sources were restored from local cache (server unreachable): {names}',
      partialNotice:
        '{errors}; the following sources were restored from local cache: {names}',
    },
    diff: {
      added: 'Added',
      currentApis: '{count} current APIs',
      emptyCategory: 'No diff items exist in this category.',
      impactedApis: 'Impacted APIs',
      modified: 'Modified',
      noApiFieldChanges:
        'This API has no expandable field-level changes in this category.',
      noSchemaFieldChanges:
        'This schema has no field-level changes in this category.',
      removed: 'Removed',
      selectHint: 'Select a diff item on the left to view details.',
      unchanged: 'Unchanged',
    },
    requestEditor: {
      addHeader: 'Add Header',
      arrayHint: 'Enter a JSON array, for example [1, 2, 3]',
      chooseValue: 'Choose a value',
      emptyObject: 'Empty object',
      emptyRequestBody: 'No request body parameters',
      headerName: 'Header name',
      invalidJson: 'Invalid JSON',
      jsonBody: 'JSON Body',
      rawBody: 'Raw Body',
      validJson: 'Valid JSON',
      valuePlaceholder: 'Value',
    },
    schema: {
      arrayItemType: 'Array item type:',
      copyDescription: 'Copy description',
      copyField: 'Copy field name',
      field: 'Field',
      hoverToCopy: 'Hover row to copy',
      mapValueType: 'Map value type:',
    },
    errors: {
      duplicateSource: 'This document URL already exists: {url}',
      exampleUnavailable:
        'Example project is only available in Electron dev mode',
      http: 'HTTP {status}: {statusText}',
      invalidJson: 'Invalid JSON: {message}',
      invalidSpec: 'The response is not a valid OpenAPI/Swagger spec',
      loadFailed: 'Load failed',
      missingPathParam: 'Path parameter "{param}" is required',
      networkError: 'Network Error',
      reloadFailed: 'Reload failed',
      unknownError: 'Unknown error',
    },
    meta: {
      addCount: '+{count} added',
      apiCount: '{count} APIs',
      changeCount: '{count} change(s)',
      headerCount: '{count} headers',
      itemCount: '{count} items',
      parameterCount: '{count} parameter(s)',
      removeCount: '-{count} removed',
      score: 'score {score}',
      tildeCount: '~{count} modified',
    },
  },
};

function normalizeLocale(value: unknown): Locale {
  return value === 'en-US' ? 'en-US' : DEFAULT_LOCALE;
}

function resolveMessage(locale: Locale, key: string): string | undefined {
  const parts = key.split('.');
  let current: MessageValue | undefined = messages[locale];

  for (const part of parts) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }

  return typeof current === 'string' ? current : undefined;
}

function formatMessage(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    String(params[key] ?? `{${key}}`),
  );
}

const localeState = ref<Locale>(
  normalizeLocale(getUiState(LOCALE_STORAGE_KEY, DEFAULT_LOCALE)),
);

watch(
  localeState,
  (value) => {
    saveUiState(LOCALE_STORAGE_KEY, value);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = value;
    }
  },
  { immediate: true },
);

export function translate(key: string, params?: MessageParams): string {
  const current = resolveMessage(localeState.value, key);
  if (current) return formatMessage(current, params);

  const fallback = resolveMessage(DEFAULT_LOCALE, key);
  if (fallback) return formatMessage(fallback, params);

  return key;
}

export function setLocale(locale: Locale): void {
  localeState.value = locale;
}

export function getLocale(): Locale {
  return localeState.value;
}

export function useI18n() {
  return {
    locale: computed(() => localeState.value),
    setLocale,
    t: translate,
  };
}
