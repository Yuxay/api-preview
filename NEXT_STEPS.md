# ApiPreview — 后续执行文档（Next Steps）

> 基于 2026-06-22 功能审计结论制定。
> 当前完成度：**Phase 1–4 基本完整；Phase 5 约 40%（引擎在、链路断）**。
> 核心问题：Phase 5「有实现无接线」的悬空代码、规范兼容缺口、Electron 安全收紧项。

---

## 0. 总体路线图

| 批次 | 主题 | 任务 | 预期收益 |
|------|------|------|----------|
| **P0** | Phase 5 闭环 | T1 Schema Diff 接线、T2 Diff 明细展开、T3 Reload 入口 | 让「变更检测」真正可用 |
| **P0** | 安全收紧 | T4 Electron 安全加固 | 修复隔离/导航/SSRF 风险 |
| **P1** | 规范兼容 | T5 path-level 参数、T6 参数文档表 | 修复真实 Swagger 解析退化 |
| **P1** | 性能 | T7 增量加载 | 避免新增源时全量重拉 |
| **P2** | 进阶能力 | T8 影响分析、T9 Snapshot 历史 | 完成 Phase 5 全量目标 |
| **P2** | 代码债 | T10 清理与文档同步 | 降低维护成本 |

> 建议执行顺序：T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10。
> T1–T3 共享 `apiDiffEngine.ts` / `DiffView.vue` / `useSwagger.ts`，建议同一分支连续完成。

---

## P0 任务

### T1：Schema Diff 接入主流程
- **现状**：`diffSchemas()` / `diffSchemaFields()` 已实现（`src/core/apiDiffEngine.ts:169-252`），但 `diffApis()` 硬编码 `schemas: []`（L104），且无任何调用方。
- **目标**：让 `DiffResult.schemas` 真正产出 DTO 级变更。
- **涉及文件**：
  - `src/core/apiDiffEngine.ts`：`diffApis()` 增加 `oldSchemas/newSchemas` 入参并调用 `diffSchemas()`。
  - `src/services/swaggerSnapshot.ts`：`SnapshotData` 增加 `schemas` 字段（来源 `spec.components.schemas` 或 Swagger 2.0 `definitions`）。
  - `src/composables/useSwagger.ts`：`runDiffForSource()` 透传新旧 schemas。
  - `src/services/swaggerMultiLoader.ts`：`SwaggerSource` 已含 `spec`，从中取 schemas。
- **验收标准**：
  1. 修改某 DTO 字段类型/增删字段后，`DiffResult.schemas` 含对应 `modified/added/removed` 项。
  2. 新增 `apiDiffEngine.test.ts`，覆盖 schema 字段新增/删除/类型变化/required 变化。
  3. `npm run build` 与 `npm test` 通过。

### T2：Diff 明细展开（API + Schema）
- **现状**：`DiffView.vue:129-142` 仅渲染「已变更」标签，`change.oldValue/newValue` 数据已存在但未展示；无 schema 区。
- **目标**：modified 项可展开查看字段级 old → new；新增 Schema 变更 Tab。
- **涉及文件**：`src/components/DiffView.vue`。
- **验收标准**：
  1. modified API 可展开显示每个 `FieldChange` 的 old/new（requestBody/responses/parameters/summary/description）。
  2. 新增「Schema」Tab，展示 `diff.schemas`（added/removed/modified + 字段级变化）。
  3. 无变更时显示空态，不报错。

### T3：Reload 入口 + 自动 diff 闭环
- **现状**：`useSwagger.ts:188-221` 的 `reloadAll()` 完整但无任何调用方/UI。
- **目标**：UI 暴露「重新加载全部」，触发 reload → 自动 diff。
- **涉及文件**：
  - `src/composables/useSwagger.ts`：`reloadAll` 已 return，确认导出。
  - `src/App.vue`：解构 `reloadAll` 并传入 `UrlBar`。
  - `src/components/UrlBar.vue`：新增刷新按钮，emit `reload`。
- **验收标准**：
  1. 点击刷新按钮重新拉取全部源并对比，有变更时自动弹出 `DiffView`。
  2. loading 态正确，错误聚合显示在 error banner。

### T4：Electron 安全加固
- **现状**：`electron/window.ts:25` `sandbox: false`；无导航/新窗口拦截；主进程对任意 URL fetch 无协议校验（`ipc/swagger.ts:10`、`proxy/request.ts:20`）。
- **目标**：在不破坏内网请求能力的前提下收紧安全面。
- **涉及文件**：`electron/window.ts`、`electron/ipc/swagger.ts`、`electron/proxy/request.ts`。
- **实现要点**：
  - `sandbox: true`（若 preload 无 Node 依赖即可开启，需回归验证）。
  - 对 `webContents` 注册 `will-navigate` 与 `setWindowOpenHandler`，阻止跳转到非应用页面 / 外链改用 `shell.openExternal`。
  - 在 `swagger:fetch` 与 `proxy:request` 入口校验 `new URL(url).protocol` ∈ `{http:, https:}`，否则直接返回错误。
- **验收标准**：
  1. 内网 `http://192.168.x.x` 仍可正常拉取与调试。
  2. 传入 `file://` / `ftp://` 等被拒绝并返回中文错误。
  3. 应用启动、Try It、多源加载回归正常。

---

## P1 任务

### T5：path-level 公共参数解析
- **现状**：`types.ts:93-101` 的 `PathItem` 无 `parameters`；`openapiParser.ts:35` 只读 `operation.parameters`，漏掉 path-level 公共参数。
- **目标**：合并 path-level 与 operation-level 参数（operation 覆盖 path，按 `name+in` 去重）。
- **涉及文件**：`src/core/types.ts`、`src/core/openapiParser.ts`。
- **验收标准**：含 path-level `parameters` 的文档能正确解析出全部参数；补单测。

### T6：详情区参数文档表
- **现状**：`ApiDetail.vue:238-280` 只渲染 requestBody/responses schema，无 parameters 文档表。
- **目标**：在详情文档区新增 Parameters 表（name / in / type / required / description）。
- **涉及文件**：`src/components/ApiDetail.vue`（或抽 `ParamsTable.vue`）。
- **验收标准**：path/query/header 参数以只读表格展示，与 Try It 编辑器并存不冲突。

### T7：增量加载（性能）
- **现状**：`useSwagger.ts:151-167` 新增一个源会把所有已存在源重新拉取+解析+diff。
- **目标**：`addSource()` 只加载新源并与内存态合并；全量重拉仅由 `reloadAll()` 承担。
- **涉及文件**：`src/composables/useSwagger.ts`、`src/services/swaggerMultiLoader.ts`。
- **验收标准**：新增第 N 个源时仅发起 1 次网络请求；已有源数据不丢失；diff 仍正确。

---

## P2 任务

### T8：影响分析（轻量版）
- **现状**：无任何实现（Phase 5.7 完全缺失）。
- **目标**：基于 T1 的 schema diff，反查引用了变更 DTO 的 API 并打标。
- **实现要点**：遍历每个 API 的 `requestBody`/`responses` schema 中的 `$ref`，建立 `DTO → API[]` 反向索引；对 `schemas` 中 modified/removed 的 DTO，在受影响 API 上标记「受影响」徽标。
- **涉及文件**：新增 `src/core/impactAnalysis.ts`、`apiDiffEngine.ts`、`DiffView.vue`/`ApiList.vue`。
- **验收标准**：改动某 DTO 后，引用它的 API 在列表/Diff 中出现「受影响」标记；补单测。

### T9：Snapshot 历史版本链
- **现状**：`swaggerSnapshot.ts` + `ipc/swagger.ts:101` 每源仅一份 `${sourceId}.json`，覆盖式。
- **目标**：保留最近 N 份历史（文件名带时间戳），diff 默认对比「最新历史 vs 当前」。
- **涉及文件**：`electron/ipc/swagger.ts`、`src/services/swaggerSnapshot.ts`。
- **验收标准**：可列出某源历史快照；超出 N 份自动清理最旧。

### T10：代码债清理与文档同步
- 删除 `src/components/ApiList.vue:39-43` 死函数 `getScoreLabel`。
- 评估移除遗留 `src/services/swaggerService.ts`（确认主链路未引用后删除）。
- 评估拆分 `ApiDetail.vue`（文档面板 / 请求构建面板 / 响应面板 + composable）。
- 更新 `PROGRESS.md` 至 Phase 5 实际状态。

---

## 通用约定（所有任务必须遵守）

- 每个任务独立提交，commit message 描述「为什么」而非「改了什么」。
- 纯逻辑改动须补 `src/__tests__/` 单测；改完跑 `npm test` + `npm run build` 必须通过。
- 不引入新依赖（除非必要并说明理由）。
- 保持轻量：**禁止**引入 Apifox 式重平台抽象、状态库或复杂插件机制。
- 维持分层：`electron/`(IPC+网络) / `core`(纯函数) / `services`(I/O) / `components`(UI) / `composables`(状态)。
- Electron 安全红线：不开 `nodeIntegration`、保持 `contextIsolation: true`、所有网络请求走主进程。

---

## 配套执行 Prompt（可直接复制给 AI Agent）

### Prompt A — Phase 5 闭环（T1+T2+T3，建议一次性交付）

```
你是该 Electron + Vue3 + TS 项目的开发工程师。请在保持「轻量、分层、不引入新依赖」前提下，完成 Phase 5 变更检测闭环：

【T1 Schema Diff 接线】
1. src/core/apiDiffEngine.ts 的 diffApis() 增加 oldSchemas/newSchemas: Record<string, ApiSchema> 入参，调用已有的 diffSchemas() 填充 DiffResult.schemas（删除当前 schemas:[] 硬编码）。
2. src/services/swaggerSnapshot.ts 的 SnapshotData 增加 schemas 字段；保存时从 source.spec.components.schemas（兼容 Swagger 2.0 definitions）取值。
3. src/composables/useSwagger.ts 的 runDiffForSource() 透传新旧 schemas。

【T2 Diff 明细展开】
4. src/components/DiffView.vue：modified API 项可展开显示每个 FieldChange 的 old→new；新增「Schema」Tab 展示 diff.schemas。

【T3 Reload 入口】
5. src/App.vue 解构并传入 reloadAll；src/components/UrlBar.vue 新增刷新按钮 emit('reload')；点击触发 reload→自动 diff，有变更时弹出 DiffView。

【验收】
- 新增 src/__tests__/apiDiffEngine.test.ts，覆盖 schema 字段新增/删除/类型/required 变化。
- npm test 与 npm run build 必须通过。
- 不破坏现有多源加载、Try It、搜索功能。
完成后输出改动文件清单与验收结果。
```

### Prompt B — Electron 安全加固（T4）

```
你是该 Electron 项目的安全工程师。请在不破坏内网（http://192.168.x.x）请求能力的前提下加固：
1. electron/window.ts：尝试将 sandbox 改为 true（若 preload 无 Node 依赖），并为 webContents 注册 will-navigate 与 setWindowOpenHandler，阻止跳转非应用页面、外链改用 shell.openExternal。
2. electron/ipc/swagger.ts 与 electron/proxy/request.ts：入口处校验 new URL(url).protocol ∈ {http:, https:}，否则返回中文错误，不发起请求。
验收：内网 IP 正常；file://、ftp:// 被拒绝；启动/Try It/多源加载回归正常；npm run build 通过。
输出改动清单与验收结果。
```

### Prompt C — 规范兼容（T5+T6）

```
你是该项目的解析层工程师。请完成 OpenAPI 解析兼容增强：
【T5】src/core/types.ts 的 PathItem 增加 parameters?: ApiParameter[]；src/core/openapiParser.ts 解析时合并 path-level 与 operation-level 参数，按 name+in 去重，operation 优先。补单测覆盖 path-level 公共参数。
【T6】src/components/ApiDetail.vue 详情文档区新增 Parameters 只读表（name/in/type/required/description），与 Try It 编辑器并存。
验收：含 path-level parameters 的文档解析正确；参数表正常展示；npm test + npm run build 通过。
输出改动清单与验收结果。
```

### Prompt D — 性能增量加载（T7）

```
你是该项目的性能工程师。当前 src/composables/useSwagger.ts 的 addSource() 每次新增源都会重新拉取+解析+diff 全部已存在源。
请重构为：addSource() 只加载新源并与内存中的 sources/apis 合并（不重拉已有源），全量刷新仅由 reloadAll() 承担。保证 diff、search 索引、source 过滤仍正确。
验收：新增第 N 个源仅发起 1 次网络请求；已有源数据不丢；npm test + npm run build 通过。
输出改动清单与验收结果。
```

### Prompt E — 影响分析 + Snapshot 历史 + 代码债（T8+T9+T10，可拆分执行）

```
你是该项目的开发工程师，请分三步完成（每步独立提交）：
【T8 影响分析】新增 src/core/impactAnalysis.ts：遍历各 API 的 requestBody/responses schema 中的 $ref 建立 DTO→API[] 反向索引；对 schema diff 中 modified/removed 的 DTO，在受影响 API 上打「受影响」标记，并在 DiffView/ApiList 展示。补单测。
【T9 Snapshot 历史】electron/ipc/swagger.ts 与 src/services/swaggerSnapshot.ts：快照文件名带时间戳保留最近 N 份，diff 默认对比「最新历史 vs 当前」，超额清理最旧。
【T10 代码债】删除 ApiList.vue 死函数 getScoreLabel；确认无引用后删除遗留 swaggerService.ts；更新 PROGRESS.md 至 Phase 5 实际状态。
每步均需 npm test + npm run build 通过，输出改动清单与验收结果。
```
