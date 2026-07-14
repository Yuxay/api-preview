# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start Vite dev server with Electron + HMR |
| `npm run build` | Type-check (`vue-tsc --noEmit`) then `vite build` |
| `npm test` | Run all tests once (`vitest run`) |
| `npm run test:watch` | Run tests in watch mode (`vitest`) |
| `npm run dist:win` | Build Windows NSIS installer |

No linter or formatter is configured. No single-test-file shortcut — use `npx vitest run <path>`.

## Architecture

Electron 33 + Vue 3 (Composition API, `<script setup lang="ts">`) desktop app. No Vue Router, no Pinia, no i18n library — all custom.

### Layered data flow

```
components/   UI (props down, events up)
composables/  Reactive state (useSwagger, useTheme, useI18n)
services/     I/O layer (calls core, accesses network via IPC)
core/         Pure functions — zero side effects, independently testable
electron/     Main process IPC + network (security boundary)
```

- **State**: `useSwagger()` in `App.vue` is the single source of truth. No provide/inject, no event bus.
- **i18n**: Custom `src/i18n.ts` with dot-notation keys, `zh-CN` (default) / `en-US`, `useI18n()` composable.
- **Theme**: `useTheme()` composable, Tailwind `darkMode: 'class'`, CSS custom properties in `style.css`.

### Key data flow

1. URL input → `useSwagger.addSource()` → `swaggerMultiLoader` → IPC `fetchSwagger` → main process Node.js fetch (no CORS)
2. Raw JSON → `openapiParser.parseOpenApiSpec()` → `ApiItem[]` → reactive state
3. Selection cascade: `selectedSource` → `selectedTag` → `selectedApi` → filtered display
4. "Try It": `requestRuntime.buildRequest()` → `httpClient` → IPC `proxy:request` → main process fetch

### Core modules (all pure, all in `src/core/`)

| Module | Purpose |
|--------|---------|
| `openapiParser.ts` | OpenAPI 3.x / Swagger 2.0 parser, `$ref` resolution, `allOf` merge |
| `apiDiffEngine.ts` | API + Schema diff (added/removed/modified) |
| `impactAnalysis.ts` | DTO→API reverse reference graph, transitive closure |
| `apiIndexEngine.ts` | Weighted fuzzy search index + HTML highlight |
| `schemaFormEngine.ts` | Bidirectional Schema ↔ FormField tree |
| `requestRuntime.ts` | HTTP request assembly from API definition + user input |
| `aiContextGenerator.ts` | API export to Markdown/JSON with TypeScript types |

### Electron security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Protocol whitelist: only `http:` / `https:` for network requests
- External navigation blocked; external links open in system browser
- Preload exposes `window.electronAPI` via `contextBridge`

## Styling

- Tailwind 3.4 with `darkMode: 'class'`
- Design tokens as CSS custom properties in `style.css` (`:root` = dark, `html.light` = light)
- Component classes in `@layer components` (e.g., `.panel-surface`, `.method-chip`, `.field-input`)
- Fonts: IBM Plex Sans (body), JetBrains Mono (code)
- Multi-source colors: 6-color "Signal Trace" palette

## Testing

Tests live in `src/__tests__/`, use vitest with `describe/it/expect`. All test files import from `@/core/` and `@/utils/` — only pure-function layers are tested. No component tests.

## Path alias

`@/*` → `./src/*` (configured in both `tsconfig.json` and `vite.config.ts`)
