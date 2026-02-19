/**
 * @file 知识图谱测试 - 数据源
 * @description 封装 IPC 调用，支持 mock 切换
 */

import type { LLMStreamRequest, LLMStreamChunk } from './kg-test.types'

// ============================================================================
// 真实实现
// ============================================================================

export const kgTestDatasource = {
  /**
   * 发起流式 LLM 调用
   */
  llmStream: (request: LLMStreamRequest): Promise<{ success: boolean; error?: string }> => {
    return window.api.test.llmStream(request)
  },

  /**
   * 监听流式 chunk
   */
  onLlmStreamChunk: (callback: (chunk: LLMStreamChunk) => void): (() => void) => {
    return window.api.test.onLlmStreamChunk(callback)
  },

  /**
   * 监听流式完成
   */
  onLlmStreamDone: (callback: (data: { sessionId: string }) => void): (() => void) => {
    return window.api.test.onLlmStreamDone(callback)
  },

  /**
   * 监听流式错误
   */
  onLlmStreamError: (
    callback: (data: { sessionId: string; error: string }) => void
  ): (() => void) => {
    return window.api.test.onLlmStreamError(callback)
  }
}
