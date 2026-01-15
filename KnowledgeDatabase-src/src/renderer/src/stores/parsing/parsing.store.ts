import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ParsingDataSource } from './parsing.datasource'
import type { FileParsingState, ParsingVersion, StartParsingOptions } from './parsing.types'

export const useParsingStore = defineStore('parsing', () => {
  const fileStates = ref<Map<string, FileParsingState>>(new Map())
  const loadingByFileKey = ref<Map<string, boolean>>(new Map())

  const isLoading = computed(
    () => (fileKey: string) => loadingByFileKey.value.get(fileKey) === true
  )

  const getState = computed(() => (fileKey: string): FileParsingState | null => {
    return fileStates.value.get(fileKey) ?? null
  })

  const getActiveVersion = computed(() => (fileKey: string): ParsingVersion | null => {
    const state = fileStates.value.get(fileKey)
    if (!state || !state.activeVersionId) return null
    return state.versions.find((v) => v.id === state.activeVersionId) ?? null
  })

  async function ensureState(fileKey: string): Promise<FileParsingState> {
    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await ParsingDataSource.getFileParsingState(fileKey)
      fileStates.value.set(fileKey, state)
      return state
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  function switchActiveVersion(fileKey: string, versionId: string) {
    const state = fileStates.value.get(fileKey)
    if (!state) return
    if (!state.versions.some((v) => v.id === versionId)) return

    state.activeVersionId = versionId
    fileStates.value.set(fileKey, {
      ...state,
      activeVersionId: versionId,
      versions: state.versions.map((v) => ({
        ...v,
        status: v.id === versionId ? 'active' : 'archived'
      }))
    })
  }

  async function startParsing(fileKey: string, options: StartParsingOptions): Promise<void> {
    loadingByFileKey.value.set(fileKey, true)
    try {
      const newState = await ParsingDataSource.startParsing(fileKey, options)
      fileStates.value.set(fileKey, newState)
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  return {
    fileStates,
    isLoading,
    getState,
    getActiveVersion,
    ensureState,
    switchActiveVersion,
    startParsing
  }
})
