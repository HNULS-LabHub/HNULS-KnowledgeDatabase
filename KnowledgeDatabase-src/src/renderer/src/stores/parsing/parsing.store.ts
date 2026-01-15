import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ParsingDataSource } from './parsing.datasource'
import type { FileParsingState, ParsingVersion, StartParsingOptions } from './parsing.types'
import type { MinerUParsingProgressEvent } from '@preload/types'

function toVersion(evt: MinerUParsingProgressEvent): ParsingVersion {
  const ts = evt.updatedAt || new Date().toISOString()
  const state = evt.state
  const name =
    state === 'done'
      ? 'MinerU 解析完成'
      : state === 'failed'
        ? 'MinerU 解析失败'
        : 'MinerU 解析中'

  return {
    id: evt.versionId,
    name,
    timestamp: ts,
    status: 'active'
  }
}

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

  function upsertFromProgress(evt: MinerUParsingProgressEvent): void {
    const current = fileStates.value.get(evt.fileKey)

    const v = toVersion(evt)

    const versions = current?.versions ? [...current.versions] : []
    const existingIndex = versions.findIndex((x) => x.id === v.id)
    if (existingIndex >= 0) {
      versions[existingIndex] = { ...versions[existingIndex], ...v }
    } else {
      versions.unshift(v)
    }

    const activeVersionId = evt.versionId

    fileStates.value.set(evt.fileKey, {
      fileKey: evt.fileKey,
      activeVersionId,
      versions: versions.map((x) => ({
        ...x,
        status: x.id === activeVersionId ? 'active' : 'archived'
      })),
      progress: typeof evt.progress === 'number' ? evt.progress : current?.progress
    })
  }

  // 订阅主进程推送（store 生命周期不等同组件，初始化一次）
  const listenerInitialized = ref(false)

  function initMinerUListener(): void {
    if (listenerInitialized.value) return
    listenerInitialized.value = true
    window.api.minerU.onProgress((evt) => {
      upsertFromProgress(evt)
    })
  }

  initMinerUListener()

  async function ensureState(
    fileKey: string,
    options?: { knowledgeBaseId?: number }
  ): Promise<FileParsingState> {
    loadingByFileKey.value.set(fileKey, true)
    try {
      const state = await ParsingDataSource.getFileParsingState(fileKey, options)
      fileStates.value.set(fileKey, state)
      return state
    } finally {
      loadingByFileKey.value.set(fileKey, false)
    }
  }

  async function switchActiveVersion(
    fileKey: string,
    versionId: string,
    knowledgeBaseId?: number
  ): Promise<void> {
    if (!knowledgeBaseId) {
      // fallback: 只做前端切换
      const state = fileStates.value.get(fileKey)
      if (!state) return
      if (!state.versions.some((v) => v.id === versionId)) return
      fileStates.value.set(fileKey, {
        ...state,
        activeVersionId: versionId,
        versions: state.versions.map((v) => ({
          ...v,
          status: v.id === versionId ? 'active' : 'archived'
        }))
      })
      return
    }

    const res = await window.api.minerU.setActiveVersion({
      knowledgeBaseId,
      fileRelativePath: fileKey,
      versionId
    })

    if (!res.success || !res.data) {
      throw new Error(res.error || 'Failed to set active version')
    }

    const activeId = res.data.activeVersionId

    const versions: ParsingVersion[] = (res.data.versions || []).map((v) => ({
      id: v.id,
      name:
        v.state === 'done'
          ? 'MinerU 解析完成'
          : v.state === 'failed'
            ? 'MinerU 解析失败'
            : 'MinerU 解析中',
      timestamp: v.updatedAt || v.createdAt,
      status: v.id === activeId ? 'active' : 'archived'
    }))

    fileStates.value.set(fileKey, {
      fileKey,
      activeVersionId: activeId,
      versions,
      progress: res.data.progress
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
