# ApiPreview

<p align="center">
  <img src="brand/logo-horizontal-v2.svg" alt="ApiPreview" width="600" />
</p>

轻量级 **Swagger / OpenAPI 桌面阅读器 + 轻调试工具** —— 本地运行、零 CORS、开箱即用。

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows-blue?logo=windows" alt="Windows" />
  <img src="https://img.shields.io/badge/electron-33.x-47848F?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/vue-3.5-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/typescript-5.7-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/tailwindcss-3.4-06B6D4?logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

---

## ✨ 为什么选择 ApiPreview？

| 痛点 | 解决方案 |
|------|----------|
| 🌐 浏览器 CORS 限制无法拉取内网 Swagger | Electron 主进程直发请求，**无视 CORS** |
| 🐘 Apifox / Postman 太重，只想看文档 | 不到 **100 KB 的渲染层 JS**，启动即用 |
| 📡 内网环境无法访问在线工具 | 纯本地桌面应用，**不依赖任何外部服务** |
| 🔄 API 变更无感知 | 内置 **Diff 引擎**，自动对比新旧文档 |
| 🔗 多个微服务文档分散 | **多源加载**，一个窗口管理所有服务 |

---

## 🚀 核心功能

### 📖 文档浏览
- 输入 Swagger / OpenAPI 3.x URL，自动拉取解析
- **多源管理**：同时加载多个服务的文档，Tag 侧栏聚合展示
- Tag 分组 + API 列表 + 详情三栏布局，信息密度高
- 搜索过滤：按 path / summary / description 快速定位 API

### 🧪 请求调试（Try It）
- 自动填充 Path / Query 参数编辑器
- JSON Body 实时校验 + 格式化
- 自定义 Headers 编辑器
- 全局 Bearer Token 自动注入
- 响应面板展示：状态码、耗时、Headers、格式化 JSON
- **所有请求走 Electron 主进程**，无 CORS 烦恼

### 🔍 变更检测（Diff）
- 重新拉取文档时自动对比新旧版本
- **API 级别**：新增/删除/变更接口一览
- **Schema 级别**：DTO 字段增删、类型变化、required 变更逐项展示
- modified 项可展开查看 `old → new` 字段级细节

### 📊 影响分析
- 基于 `$ref` 建立 DTO → API 反向索引
- Schema 变更时自动标记**受影响的 API**
- 在列表和 Diff 面板中以徽标提示

### 📸 快照历史
- 每次变更自动保存快照（最近 10 份）
- Diff 默认对比「最新历史 vs 当前」
- 主流外自动清理，不必担心磁盘占用

### 🎨 体验优化
- 深色/浅色主题切换（默认深色）
- 最近 URL 历史记录（持久化）
- 侧栏可折叠，聚焦当前操作
- API 导出为 Markdown
- 中英双语界面

---

## 📦 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **桌面框架** | Electron 33 | 主进程 + Preload IPC 架构 |
| **前端框架** | Vue 3 (Composition API) | `<script setup>` + Composables |
| **语言** | TypeScript 5.7 | 严格类型，零 `any` 泄漏 |
| **样式** | Tailwind CSS 3.4 | 深色优先的设计系统 |
| **构建** | Vite 6 + vite-plugin-electron | 秒级 HMR，Electron 双进程打包 |
| **测试** | Vitest 4 | 纯逻辑层单测覆盖 |
| **打包** | electron-builder | NSIS Windows 安装包 |

---

## 🏁 快速开始

### 环境要求
- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows**（macOS / Linux 可自行配置 electron-builder target）

### 开发运行

```bash
# 克隆仓库
git clone <repo-url> && cd api-preview

# 安装依赖
npm install

# 启动开发服务器（自动打开 Electron 窗口 + HMR）
npm run dev
```

### 生产构建

```bash
# 类型检查 + Vite 构建
npm run build

# 打包 Windows NSIS 安装程序
npm run dist:win
```

构建产物：
- `dist/` — 渲染层（HTML + CSS + JS）
- `dist-electron/` — Electron 主进程 + Preload
- `release/` — NSIS 安装包 `.exe`

### 运行测试

```bash
npm test          # 单次运行
npm run test:watch  # 监听模式
```

---

## 🗂️ 项目结构

```
api-preview/
├── electron/                  # Electron 主进程
│   ├── main.ts                #   应用入口、IPC 注册、窗口管理
│   ├── window.ts              #   BrowserWindow 工厂（沙箱 + 导航拦截）
│   ├── preload.ts             #   contextBridge 暴露 IPC API
│   ├── ipc/swagger.ts         #   Swagger 获取 + 快照持久化
│   └── proxy/request.ts       #   HTTP 代理（Try It 请求中转）
├── src/                       # Vue 渲染层
│   ├── main.ts                #   Vue 应用入口
│   ├── App.vue                #   三栏主布局 + 全局状态
│   ├── style.css              #   Tailwind + 设计 Token
│   ├── i18n.ts                #   中英双语
│   ├── core/                  #   纯函数核心逻辑
│   │   ├── types.ts           #     OpenAPI 类型定义
│   │   ├── openapiParser.ts   #     OpenAPI 3.x / Swagger 2.0 解析器
│   │   ├── apiDiffEngine.ts   #     API + Schema 差异引擎
│   │   ├── impactAnalysis.ts  #     DTO → API 影响分析
│   │   ├── apiIndexEngine.ts  #     搜索索引
│   │   ├── requestRuntime.ts  #     请求构建器
│   │   └── schemaFormEngine.ts #    Schema 表单生成
│   ├── services/              #   I/O 层
│   │   ├── swaggerMultiLoader.ts #  多源加载管理
│   │   ├── swaggerSnapshot.ts    #  快照历史版本链
│   │   └── httpClient.ts         #  HTTP 客户端
│   ├── composables/           #   Vue 响应式状态
│   │   ├── useSwagger.ts      #     核心状态管理
│   │   └── useTheme.ts        #     主题切换
│   ├── components/            #   UI 组件
│   │   ├── UrlBar.vue         #     URL + Token 输入栏 + 刷新
│   │   ├── TagSidebar.vue     #     Tags 侧栏
│   │   ├── ApiList.vue        #     API 列表
│   │   ├── ApiDetail.vue      #     API 详情 + Try It + 响应面板
│   │   ├── DiffView.vue       #     变更检测面板
│   │   └── ...                #     编辑器/工具组件
│   ├── utils/                 #   工具函数
│   │   ├── format.ts          #     JSON 格式化
│   │   └── storage.ts         #     持久化存储
│   └── __tests__/             #   单测
├── examples/petstore.json     # 示例 OpenAPI 文档
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── LICENSE
```

### 分层原则

```
┌──────────────────────────────────────────┐
│  components/        UI 组件              │  ← 只依赖 composables + core 类型
├──────────────────────────────────────────┤
│  composables/       Vue 响应式状态        │  ← 调用 services，驱动组件
├──────────────────────────────────────────┤
│  services/          I/O + 外部交互        │  ← 调用 core，通过 IPC 访问网络
├──────────────────────────────────────────┤
│  core/              纯函数核心逻辑        │  ← 零副作用，可独立单测
├──────────────────────────────────────────┤
│  electron/          主进程 IPC + 网络     │  ← 安全边界：协议白名单、沙箱
└──────────────────────────────────────────┘
```

---

## 🔒 安全

- ✅ `contextIsolation: true` — 渲染进程无法直接访问 Node.js
- ✅ `nodeIntegration: false` — 禁用 Node 集成
- ✅ `sandbox: true` — 沙箱模式
- ✅ 导航拦截 — 阻止跳转外部页面，外链交由系统浏览器
- ✅ 协议白名单 — 主进程仅允许 `http:` / `https:` 请求
- ✅ 不收集任何遥测数据，完全离线运行

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

## 👤 作者

**Yuxay** · [GitHub](https://github.com/Yuxay)

---

> 设计哲学：**轻量、分层、不引入重平台抽象**。保持代码简洁，每个模块职责单一，方便阅读和二次开发。
