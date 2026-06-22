# OpenAPI Light Desktop — 执行进度

## 总体进度

| 阶段 | 状态 | 完成时间 |
|------|------|----------|
| 1. 项目脚手架 | ✅ 完成 | 2025-06-22 |
| 2. Electron 主进程 + Preload | ✅ 完成 | 2025-06-22 |
| 3. 核心类型、解析器 & 工具 | ✅ 完成 | 2025-06-22 |
| 4. Renderer 服务 & Composables | ✅ 完成 | 2025-06-22 |
| 5. Vue 组件 — 布局 & 导航 | ✅ 完成 | 2025-06-22 |
| 6. Vue 组件 — 详情 & 调试 | ✅ 完成 | 2025-06-22 |
| 7. 集成 & 验证 | ✅ 完成 | 2025-06-22 |
| 8. 完整 Try It（第二阶段） | ✅ 完成 | 2025-06-22 |
| 5'. 变更检测 / 多源 / 影响分析 / 安全加固 | ✅ 完成 | 2026-06-22 |

---

## Phase 5 闭环（2026-06-22）

按 `NEXT_STEPS.md` 路线图完成 T1–T10：

| 任务 | 主题 | 结果 |
|------|------|------|
| T1 | Schema Diff 接线 | `diffApis()` 接收新旧 schemas 并调用 `diffSchemas()`，快照持久化 DTO 定义 |
| T2 | Diff 明细展开 | `DiffView` 支持 modified 项展开 old→new，新增 Schema Tab |
| T3 | Reload 入口 | `UrlBar` 刷新按钮 → `reloadAll()` → 自动 diff |
| T4 | Electron 安全加固 | `sandbox: true`、`will-navigate`/`setWindowOpenHandler` 拦截、http/https 协议白名单 |
| T5 | path-level 参数 | 解析时合并 path-level 与 operation-level 参数（in+name 去重，operation 优先） |
| T6 | 参数文档表 | `ApiDetail` 详情区新增 Parameters 只读表 |
| T7 | 增量加载 | `addSource()` 仅拉取新源并合并，全量重拉只由 `reloadAll()` 承担 |
| T8 | 影响分析 | `impactAnalysis.ts` 基于原始 spec 的 $ref 反向索引，标记受变更 DTO 影响的 API |
| T9 | Snapshot 历史 | 快照按时间戳保留最近 10 份，diff 对比「最新历史 vs 当前」，超额清理最旧 |
| T10 | 代码债 | 删除 `ApiList` 死函数 `getScoreLabel`、移除遗留 `swaggerService.ts`、同步本文档 |

新增模块：`src/core/apiDiffEngine.ts`、`src/core/impactAnalysis.ts`、`src/services/swaggerSnapshot.ts`、`src/services/swaggerMultiLoader.ts`、`src/components/DiffView.vue`。
新增测试：`apiDiffEngine.test.ts`、`impactAnalysis.test.ts`，并扩充 `openapiParser.test.ts`。

---

## 第二阶段新增文件

```
src/core/
  requestRuntime.ts           # 核心请求构建器（纯函数）

src/components/
  PathParamsEditor.vue        # Path 参数表格
  QueryParamsEditor.vue       # Query 参数表格
  HeadersEditor.vue           # Key-Value Header 编辑器（增删改）
  JsonBodyEditor.vue          # JSON Body 编辑器（实时校验）
```

## 第二阶段改造文件

- `electron/proxy/request.ts` — 新增 30s 超时 + 错误中文分类
- `electron/ipc/swagger.ts` — 同步 fs → 异步 fs/promises + writeJson 错误保护
- `src/components/ApiDetail.vue` — 接入 4 个编辑器组件 + requestRuntime + 统一方法颜色
- `src/services/httpClient.ts` — 移除废弃的 buildBaseUrl + 去重 queryParams
- `src/core/openapiParser.ts` — 类型 any→ApiSchema + Swagger 2.0 definitions 兼容
- `src/core/requestRuntime.ts` — replaceAll + 空路径参数拦截
- `src/utils/format.ts` — prettyJson 处理 Symbol/undefined 返回值
- `src/core/types.ts` — ApiResponse.code 可选（匹配原始 JSON 结构）
- `src/env.d.ts` — ProxyResponse 补 duration 字段
- `tsconfig.json` — lib ES2020→ES2021
- `package.json` — 新增 vitest + test 脚本

## 测试覆盖

| 模块 | 测试数 | 状态 |
|------|--------|------|
| `src/utils/format.ts` | 14 | ✅ |
| `src/core/requestRuntime.ts` | 11 | ✅ |
| `src/core/openapiParser.ts` | 10 | ✅ |
| **总计** | **35** | **全部通过** |

## Try It 流程

```
用户填写参数 → buildRequest(api, opts) → RequestConfig
                                               ↓
                                      sendRequest(config)
                                               ↓
                                  preload → IPC → main process
                                               ↓
                                    fetch(url, { signal, ... })
                                               ↓
                                    成功 → 响应面板
                                    超时 → "请求超时（超过 30 秒）"
                                    断网 → "无法连接到服务器"
                                    DNS 失败 → "无法解析域名"
                                    JSON 错误 → buildError 面板
                                    路径参数缺失 → buildError 面板
```

---

## 构建状态

- **TypeScript 类型检查**: ✅ 零错误 (`vue-tsc --noEmit` 通过)
- **Vite 构建**: ✅ 成功
  - Renderer: `dist/` (index.html + CSS 15KB + JS 87KB)
  - Main process: `dist-electron/main.js` (533KB, 含 undici)
  - Preload: `dist-electron/preload.js` (0.4KB)

---

## 项目结构

```
openapi-light-desktop/
├── package.json
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js / postcss.config.js
├── index.html
├── PROGRESS.md
├── electron/
│   ├── main.ts              # 应用入口，IPC 注册，窗口管理
│   ├── window.ts             # BrowserWindow 工厂（沙箱 + 导航拦截）
│   ├── preload.ts            # contextBridge IPC API
│   ├── ipc/swagger.ts        # Swagger 获取（协议白名单）+ 历史快照存储
│   └── proxy/request.ts      # HTTP 请求代理 (Try It，协议白名单)
└── src/
    ├── main.ts               # Vue 入口
    ├── App.vue               # 三栏主布局
    ├── style.css             # Tailwind + 全局样式
    ├── env.d.ts              # TypeScript 声明
    ├── components/
    │   ├── UrlBar.vue         # URL + Token 输入栏 + 刷新
    │   ├── TagSidebar.vue     # Tags 侧栏
    │   ├── ApiList.vue        # API 列表（含受影响徽标）
    │   ├── DiffView.vue       # 变更检测面板（API + Schema）
    │   └── ApiDetail.vue      # API 详情 + 参数表 + 请求调试 + 响应面板
    ├── core/
    │   ├── types.ts           # OpenAPI 类型定义
    │   ├── openapiParser.ts   # OpenAPI 3.x 解析器
    │   ├── apiDiffEngine.ts   # API/Schema 差异引擎
    │   ├── impactAnalysis.ts  # DTO→API 影响分析
    │   └── apiIndexEngine.ts  # 搜索索引
    ├── services/
    │   ├── swaggerMultiLoader.ts # 多源加载
    │   ├── swaggerSnapshot.ts    # 快照（历史版本链）
    │   └── httpClient.ts         # HTTP 代理客户端
    ├── composables/
    │   └── useSwagger.ts      # 响应式状态管理
    └── utils/
        ├── storage.ts         # 持久化存储
        └── format.ts          # 格式化工具
```

---

## 启动方式

```bash
npm install
npm run dev
```

Electron 桌面窗口自动打开，输入 Swagger URL 即可使用。

---

## 已完成功能清单

- [x] 输入 Swagger URL 加载 JSON（内网 IP / localhost 均支持）
- [x] 通过 Electron 主进程 + undici 请求，避免 CORS
- [x] OpenAPI 3.x 解析（paths, methods, tags, summary, requestBody, responses, $ref 递归解析）
- [x] Tag 分组侧栏
- [x] API 列表展示（method 彩色 badge + path + summary）
- [x] API 详情（Path 参数、Query 参数、请求体 Schema、响应 Schema）
- [x] 请求调试（可编辑 Headers/Query/Body，Send 按钮）
- [x] 全局 Bearer Token 自动注入
- [x] 响应展示（状态码、耗时、Headers、格式化 JSON）
- [x] 最近 URL 历史（最多 5 条，持久化到本地文件）
- [x] 深色模式 UI
- [x] Electron IPC 架构（所有网络请求走主进程）
