/**
 * @file Agent Preload API
 * @description 提供 Agent 相关的 IPC 通信接口
 */

import { ipcRenderer } from 'electron'

// ============================================================================
// IPC Channel 常量
// ============================================================================

const IPC_CHANNELS = {
  RUN: 'agent:run',
  CANCEL: 'agent:cancel',
  EVENT: 'agent:event'
} as const

// ============================================================================
// 类型
// ============================================================================

export interface AgentRunParams {
  runId: string
  question: string
  llmModelId: string
  kbId: number
  tables: string[]
  rerankModelId?: string
  k?: number
  ef?: number
  rerankTopN?: number
}

export interface AgentRunResult {
  success: boolean
  runId?: string
  error?: string
}

// ============================================================================
// API 实现
// ============================================================================

export const agentAPI = {
  /**
   * 启动 Agent 运行
   * 立即返回 runId，后续通过 onEvent 接收事件
   */
  async run(params: AgentRunParams): Promise<AgentRunResult> {
    return ipcRenderer.invoke(IPC_CHANNELS.RUN, params)
  },

  /**
   * 取消指定运行
   */
  async cancel(runId: string): Promise<{ success: boolean }> {
    return ipcRenderer.invoke(IPC_CHANNELS.CANCEL, runId)
  },

  /**
   * 监听 Agent 事件
   * @param callback 事件回调
   * @returns 取消监听的函数
   */
  onEvent(callback: (event: any) => void): () => void {
    const handler = (_ipcEvent: any, agentEvent: any) => {
      callback(agentEvent)
    }
    ipcRenderer.on(IPC_CHANNELS.EVENT, handler)

    // 返回清理函数
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.EVENT, handler)
    }
  }
}
