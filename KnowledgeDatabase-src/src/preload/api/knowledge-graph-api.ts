/**
 * @file 知识图谱 Preload API
 * @description 提供知识图谱构建相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'
import type { KnowledgeGraphAPI, GraphDataBatchEvent } from '../types/knowledge-graph.types'
import type {
  KGSubmitTaskParams,
  KGTaskStatus,
  KGCreateSchemaParams,
  KGBuildTaskStatus,
  KGGraphQueryParams,
  KGEmbeddingProgressData,
  KGRetrievalParams,
  KGRetrievalResult
} from '../types/knowledge-graph.types'

const CH = {
  SUBMIT_TASK: 'knowledge-graph:submit-task',
  QUERY_STATUS: 'knowledge-graph:query-status',
  UPDATE_CONCURRENCY: 'knowledge-graph:update-concurrency',
  CREATE_GRAPH_SCHEMA: 'knowledge-graph:create-graph-schema',
  QUERY_BUILD_STATUS: 'knowledge-graph:query-build-status',
  // 图谱数据查询
  QUERY_GRAPH_DATA: 'knowledge-graph:query-graph-data',
  CANCEL_GRAPH_QUERY: 'knowledge-graph:cancel-graph-query',
  // 嵌入相关
  QUERY_EMBEDDING_STATUS: 'knowledge-graph:query-embedding-status',
  EMBEDDING_PROGRESS: 'knowledge-graph:embedding-progress',
  // KG 检索
  RETRIEVAL_SEARCH: 'knowledge-graph:retrieval-search',
  // 事件（main → renderer）
  TASK_PROGRESS: 'knowledge-graph:task-progress',
  TASK_COMPLETED: 'knowledge-graph:task-completed',
  TASK_FAILED: 'knowledge-graph:task-failed',
  BUILD_PROGRESS: 'knowledge-graph:build-progress',
  BUILD_COMPLETED: 'knowledge-graph:build-completed',
  BUILD_FAILED: 'knowledge-graph:build-failed',
  // 图谱数据查询事件
  GRAPH_DATA_BATCH: 'knowledge-graph:graph-data-batch',
  GRAPH_DATA_COMPLETE: 'knowledge-graph:graph-data-complete',
  GRAPH_DATA_ERROR: 'knowledge-graph:graph-data-error',
  GRAPH_DATA_CANCELLED: 'knowledge-graph:graph-data-cancelled'
} as const

export const knowledgeGraphAPI: KnowledgeGraphAPI = {
  async submitTask(params: KGSubmitTaskParams): Promise<{ taskId: string; chunksTotal: number }> {
    return ipcRenderer.invoke(CH.SUBMIT_TASK, params)
  },

  async queryStatus(): Promise<KGTaskStatus[]> {
    return ipcRenderer.invoke(CH.QUERY_STATUS)
  },

  async updateConcurrency(maxConcurrency: number): Promise<void> {
    return ipcRenderer.invoke(CH.UPDATE_CONCURRENCY, maxConcurrency)
  },

  onTaskProgress(callback) {
    const handler = (_e: any, taskId: string, completed: number, failed: number, total: number) => {
      callback(taskId, completed, failed, total)
    }
    ipcRenderer.on(CH.TASK_PROGRESS, handler)
    return () => ipcRenderer.removeListener(CH.TASK_PROGRESS, handler)
  },

  onTaskCompleted(callback) {
    const handler = (_e: any, taskId: string) => callback(taskId)
    ipcRenderer.on(CH.TASK_COMPLETED, handler)
    return () => ipcRenderer.removeListener(CH.TASK_COMPLETED, handler)
  },

  onTaskFailed(callback) {
    const handler = (_e: any, taskId: string, error: string) => callback(taskId, error)
    ipcRenderer.on(CH.TASK_FAILED, handler)
    return () => ipcRenderer.removeListener(CH.TASK_FAILED, handler)
  },

  async createGraphSchema(params: KGCreateSchemaParams): Promise<string[]> {
    return ipcRenderer.invoke(CH.CREATE_GRAPH_SCHEMA, params)
  },

  async queryBuildStatus(): Promise<KGBuildTaskStatus[]> {
    return ipcRenderer.invoke(CH.QUERY_BUILD_STATUS)
  },

  onBuildProgress(callback) {
    const handler = (
      _e: any,
      taskId: string,
      completed: number,
      failed: number,
      total: number,
      entitiesTotal: number,
      relationsTotal: number
    ) => {
      callback(taskId, completed, failed, total, entitiesTotal, relationsTotal)
    }
    ipcRenderer.on(CH.BUILD_PROGRESS, handler)
    return () => ipcRenderer.removeListener(CH.BUILD_PROGRESS, handler)
  },

  onBuildCompleted(callback) {
    const handler = (_e: any, taskId: string) => callback(taskId)
    ipcRenderer.on(CH.BUILD_COMPLETED, handler)
    return () => ipcRenderer.removeListener(CH.BUILD_COMPLETED, handler)
  },

  onBuildFailed(callback) {
    const handler = (_e: any, taskId: string, error: string) => callback(taskId, error)
    ipcRenderer.on(CH.BUILD_FAILED, handler)
    return () => ipcRenderer.removeListener(CH.BUILD_FAILED, handler)
  },

  // ============================================================================
  // 图谱数据流式查询
  // ============================================================================

  async queryGraphData(params: KGGraphQueryParams): Promise<string> {
    return ipcRenderer.invoke(CH.QUERY_GRAPH_DATA, params)
  },

  cancelGraphQuery(sessionId: string): void {
    ipcRenderer.send(CH.CANCEL_GRAPH_QUERY, sessionId)
  },

  onGraphDataBatch(callback) {
    const handler = (_e: any, data: GraphDataBatchEvent) => callback(data)
    ipcRenderer.on(CH.GRAPH_DATA_BATCH, handler)
    return () => ipcRenderer.removeListener(CH.GRAPH_DATA_BATCH, handler)
  },

  onGraphDataComplete(callback) {
    const handler = (_e: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on(CH.GRAPH_DATA_COMPLETE, handler)
    return () => ipcRenderer.removeListener(CH.GRAPH_DATA_COMPLETE, handler)
  },

  onGraphDataError(callback) {
    const handler = (_e: any, sessionId: string, error: string) => callback(sessionId, error)
    ipcRenderer.on(CH.GRAPH_DATA_ERROR, handler)
    return () => ipcRenderer.removeListener(CH.GRAPH_DATA_ERROR, handler)
  },

  onGraphDataCancelled(callback) {
    const handler = (_e: any, sessionId: string) => callback(sessionId)
    ipcRenderer.on(CH.GRAPH_DATA_CANCELLED, handler)
    return () => ipcRenderer.removeListener(CH.GRAPH_DATA_CANCELLED, handler)
  },

  // ============================================================================
  // 嵌入状态监控
  // ============================================================================

  async queryEmbeddingStatus(): Promise<KGEmbeddingProgressData | null> {
    return ipcRenderer.invoke(CH.QUERY_EMBEDDING_STATUS)
  },

  onEmbeddingProgress(callback) {
    const handler = (_e: any, data: KGEmbeddingProgressData) => callback(data)
    ipcRenderer.on(CH.EMBEDDING_PROGRESS, handler)
    return () => ipcRenderer.removeListener(CH.EMBEDDING_PROGRESS, handler)
  },

  // ============================================================================
  // KG 检索
  // ============================================================================

  async retrievalSearch(params: KGRetrievalParams): Promise<KGRetrievalResult> {
    return ipcRenderer.invoke(CH.RETRIEVAL_SEARCH, params)
  }
}
