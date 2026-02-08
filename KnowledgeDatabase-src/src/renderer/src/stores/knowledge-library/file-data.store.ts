import { defineStore } from 'pinia'
import { ref } from 'vue'
import { FileDataSource } from './file.datasource'
import type { FileNode } from './file.types'

/**
 * 唯一文件数据源 Store
 * - 所有文件列表都从这里获取
 * - 负责去重、竞态保护
 */
export const useFileDataStore = defineStore('file-data', () => {
  const files = ref<FileNode[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentKnowledgeBaseId = ref<number | null>(null)

  // 防止同一 KB 重复请求
  let inflightPromise: Promise<void> | null = null
  let inflightKbId: number | null = null

  // 竞态保护：仅最后一次请求可落地
  let fetchVersion = 0

  async function fetchFiles(knowledgeBaseId: number): Promise<void> {
    // 同一个 KB 正在请求，直接复用
    if (inflightPromise && inflightKbId === knowledgeBaseId) {
      return inflightPromise
    }

    const currentVersion = ++fetchVersion
    currentKnowledgeBaseId.value = knowledgeBaseId
    loading.value = true
    error.value = null
    inflightKbId = knowledgeBaseId

    inflightPromise = (async () => {
      try {
        const data = await FileDataSource.getAll(knowledgeBaseId)
        // 只接受最新的请求结果
        if (currentVersion === fetchVersion) {
          files.value = data
        }
      } catch (err) {
        if (currentVersion === fetchVersion) {
          error.value = err instanceof Error ? err.message : 'Failed to fetch files'
          files.value = []
        }
      } finally {
        if (currentVersion === fetchVersion) {
          loading.value = false
        }
        inflightPromise = null
        inflightKbId = null
      }
    })()

    return inflightPromise
  }

  async function refresh(): Promise<void> {
    if (currentKnowledgeBaseId.value !== null) {
      await fetchFiles(currentKnowledgeBaseId.value)
    }
  }

  return {
    files,
    loading,
    error,
    currentKnowledgeBaseId,
    fetchFiles,
    refresh
  }
})
