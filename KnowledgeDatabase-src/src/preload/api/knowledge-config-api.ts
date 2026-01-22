import { ipcRenderer } from 'electron'
import type {
  KnowledgeConfig,
  KnowledgeGlobalConfig,
  DocumentConfig
} from '../types/knowledge-config.types'
import type { APIResponse } from '../types/base.types'

/**
 * 知识库配置 API
 */
export const knowledgeConfigAPI = {
  /**
   * 获取知识库配置
   */
  getConfig: (knowledgeBaseId: number): Promise<APIResponse<KnowledgeConfig>> => {
    return ipcRenderer.invoke('knowledgeConfig:getconfig', knowledgeBaseId)
  },

  /**
   * 更新全局配置
   */
  updateGlobalConfig: (
    knowledgeBaseId: number,
    globalConfig: Partial<KnowledgeGlobalConfig>
  ): Promise<APIResponse<KnowledgeConfig>> => {
    return ipcRenderer.invoke('knowledgeConfig:updateglobalconfig', knowledgeBaseId, globalConfig)
  },

  /**
   * 获取文档配置（已合并全局配置）
   */
  getDocumentConfig: (
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<APIResponse<Required<DocumentConfig>>> => {
    return ipcRenderer.invoke('knowledgeConfig:getdocumentconfig', knowledgeBaseId, fileKey)
  },

  /**
   * 更新文档配置
   */
  updateDocumentConfig: (
    knowledgeBaseId: number,
    fileKey: string,
    docConfig: DocumentConfig
  ): Promise<APIResponse<KnowledgeConfig>> => {
    return ipcRenderer.invoke(
      'knowledgeConfig:updatedocumentconfig',
      knowledgeBaseId,
      fileKey,
      docConfig
    )
  },

  /**
   * 清除文档配置（回正）
   */
  clearDocumentConfig: (
    knowledgeBaseId: number,
    fileKey: string
  ): Promise<APIResponse<KnowledgeConfig>> => {
    return ipcRenderer.invoke('knowledgeConfig:cleardocumentconfig', knowledgeBaseId, fileKey)
  },

  /**
   * 验证并清理配置
   */
  validateAndCleanup: (knowledgeBaseId: number): Promise<APIResponse<void>> => {
    return ipcRenderer.invoke('knowledgeConfig:validateandcleanup', knowledgeBaseId)
  }
}
