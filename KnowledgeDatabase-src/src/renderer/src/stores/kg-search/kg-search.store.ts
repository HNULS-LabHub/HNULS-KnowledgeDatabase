/**
 * 知识图谱检索状态管理 Store
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KGSearchDataSource } from './kg-search.datasource'
import type { KGSearchMode, KGSearchResult } from './kg-search.types'

export const useKGSearchStore = defineStore('kg-search', () => {
  // ---- State ----
  const query = ref('')
  const mode = ref<KGSearchMode>('keyword')
  const isSearching = ref(false)
  const result = ref<KGSearchResult | null>(null)

  // ---- Getters ----
  const hasResult = computed(() => result.value !== null && result.value.hits.length > 0)
  const hitCount = computed(() => result.value?.hits.length ?? 0)

  // ---- Actions ----
  function setMode(newMode: KGSearchMode): void {
    mode.value = newMode
  }

  async function executeSearch(): Promise<void> {
    if (!query.value.trim() || isSearching.value) return

    isSearching.value = true
    result.value = null
    const startTime = performance.now()

    try {
      const hits = await KGSearchDataSource.search(query.value, mode.value)
      const elapsedMs = Math.round(performance.now() - startTime)

      result.value = {
        hits,
        totalCount: hits.length,
        elapsedMs,
        mode: mode.value
      }
    } catch (err) {
      console.error('[KGSearchStore] Search failed:', err)
      result.value = {
        hits: [],
        totalCount: 0,
        elapsedMs: Math.round(performance.now() - startTime),
        mode: mode.value
      }
    } finally {
      isSearching.value = false
    }
  }

  function reset(): void {
    query.value = ''
    result.value = null
    isSearching.value = false
  }

  return {
    query,
    mode,
    isSearching,
    result,
    hasResult,
    hitCount,
    setMode,
    executeSearch,
    reset
  }
})
