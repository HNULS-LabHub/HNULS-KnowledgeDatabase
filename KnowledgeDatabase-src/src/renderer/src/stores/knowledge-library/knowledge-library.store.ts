import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { KnowledgeLibraryDataSource } from './knowledge-library.datasource'
import type {
  KnowledgeBase,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData
} from './knowledge-library.types'

/**
 * 知识库管理 Store
 */
export const useKnowledgeLibraryStore = defineStore('knowledge-library', () => {
  // State
  const knowledgeBases = ref<KnowledgeBase[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const getById = computed(() => {
    return (id: number): KnowledgeBase | undefined => {
      return knowledgeBases.value.find((kb) => kb.id === id)
    }
  })

  const getCount = computed(() => knowledgeBases.value.length)

  // Actions
  /**
   * 获取所有知识库
   */
  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      knowledgeBases.value = await KnowledgeLibraryDataSource.getAll()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch knowledge bases'
      console.error('Failed to fetch knowledge bases:', err)
      // 清空列表，避免显示旧数据
      knowledgeBases.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * 创建知识库
   */
  async function create(data: CreateKnowledgeBaseData): Promise<KnowledgeBase> {
    loading.value = true
    error.value = null
    try {
      const newKB = await KnowledgeLibraryDataSource.create(data)
      // 添加到列表开头
      knowledgeBases.value.unshift(newKB)
      return newKB
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create knowledge base'
      console.error('Failed to create knowledge base:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 更新知识库
   */
  async function update(id: number, data: UpdateKnowledgeBaseData): Promise<KnowledgeBase> {
    loading.value = true
    error.value = null
    try {
      const updatedKB = await KnowledgeLibraryDataSource.update(id, data)
      // 更新列表中的项
      const index = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (index !== -1) {
        knowledgeBases.value[index] = updatedKB
      }
      return updatedKB
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update knowledge base'
      console.error('Failed to update knowledge base:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 删除知识库
   */
  async function deleteKB(id: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await KnowledgeLibraryDataSource.delete(id)
      // 从列表中移除
      const index = knowledgeBases.value.findIndex((kb) => kb.id === id)
      if (index !== -1) {
        knowledgeBases.value.splice(index, 1)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete knowledge base'
      console.error('Failed to delete knowledge base:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 刷新知识库列表
   */
  async function refresh(): Promise<void> {
    await fetchAll()
  }

  return {
    // State
    knowledgeBases,
    loading,
    error,
    // Getters
    getById,
    getCount,
    // Actions
    fetchAll,
    create,
    update,
    delete: deleteKB,
    refresh
  }
})
