import { ipcRenderer } from 'electron'
import type {
  KnowledgeBaseMeta,
  CreateKnowledgeBaseData,
  UpdateKnowledgeBaseData,
  EmbeddingTableInfo
} from '../../main/services/knowledgeBase-library/types'

/**
 * IPC 响应格式
 */
interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export const knowledgeLibraryAPI = {
  /**
   * 获取所有知识库
   */
  getAll: (): Promise<KnowledgeBaseMeta[]> => {
    return ipcRenderer
      .invoke('knowledge-library:getall')
      .then((response: IPCResponse<KnowledgeBaseMeta[]>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || 'Failed to get all knowledge bases')
      })
  },

  /**
   * 根据 ID 获取知识库
   */
  getById: (id: number): Promise<KnowledgeBaseMeta> => {
    return ipcRenderer
      .invoke('knowledge-library:getbyid', id)
      .then((response: IPCResponse<KnowledgeBaseMeta>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || `Failed to get knowledge base with id ${id}`)
      })
  },

  /**
   * 创建知识库
   */
  create: (data: CreateKnowledgeBaseData): Promise<KnowledgeBaseMeta> => {
    return ipcRenderer
      .invoke('knowledge-library:create', data)
      .then((response: IPCResponse<KnowledgeBaseMeta>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || 'Failed to create knowledge base')
      })
  },

  /**
   * 更新知识库
   */
  update: (id: number, data: UpdateKnowledgeBaseData): Promise<KnowledgeBaseMeta> => {
    return ipcRenderer
      .invoke('knowledge-library:update', id, data)
      .then((response: IPCResponse<KnowledgeBaseMeta>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(response.error || `Failed to update knowledge base with id ${id}`)
      })
  },

  /**
   * 删除知识库
   */
  delete: (id: number): Promise<void> => {
    return ipcRenderer
      .invoke('knowledge-library:delete', id)
      .then((response: IPCResponse<{ id: number }>) => {
        if (!response.success) {
          throw new Error(response.error || `Failed to delete knowledge base with id ${id}`)
        }
      })
  },

  /**
   * 列出知识库中的嵌入向量表
   */
  listEmbeddingTables: (knowledgeBaseId: number): Promise<EmbeddingTableInfo[]> => {
    return ipcRenderer
      .invoke('knowledge-library:listembeddingtables', knowledgeBaseId)
      .then((response: IPCResponse<EmbeddingTableInfo[]>) => {
        if (response.success && response.data) {
          return response.data
        }
        throw new Error(
          response.error || `Failed to list embedding tables for knowledge base ${knowledgeBaseId}`
        )
      })
  }
}
