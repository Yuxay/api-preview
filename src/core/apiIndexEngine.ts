import type { ApiItem } from './types'

// ========== 搜索索引项 ==========
export interface ApiSearchEntry {
  api: ApiItem
  searchText: string
}

// ========== 构建搜索索引 ==========

export function buildSearchIndex(apis: ApiItem[]): ApiSearchEntry[] {
  return apis.map((api) => ({
    api,
    searchText: [api.path, api.summary, api.tag, api.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }))
}

// ========== 搜索 ==========

export interface SearchResult {
  api: ApiItem
  score: number
}

const SCORE_PATH = 5
const SCORE_SUMMARY = 3
const SCORE_TAG = 2
const SCORE_FALLBACK = 1

/**
 * 在 API 列表中模糊搜索，返回 score 排序的结果
 */
export function searchApis(entries: ApiSearchEntry[], query: string): SearchResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return entries.map((e) => ({ api: e.api, score: 0 }))

  const results: SearchResult[] = []

  for (const entry of entries) {
    const api = entry.api
    let score = 0

    const pathLower = api.path.toLowerCase()
    const summaryLower = (api.summary || '').toLowerCase()
    const tagLower = api.tag.toLowerCase()
    const searchLower = entry.searchText

    if (pathLower.includes(q)) score += SCORE_PATH
    if (summaryLower.includes(q)) score += SCORE_SUMMARY
    if (tagLower.includes(q)) score += SCORE_TAG
    if (searchLower.includes(q)) score += SCORE_FALLBACK

    if (score > 0) {
      results.push({ api, score })
    }
  }

  // 按 score 降序
  results.sort((a, b) => b.score - a.score)

  return results
}

/**
 * 高亮搜索关键词（返回带标记的 HTML 文本用于 v-html）
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const q = escapeHtml(query.trim())
  // 不区分大小写的替换
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(re, '<mark class="bg-yellow-400/60 text-slate-900 rounded px-0.5">$1</mark>')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
