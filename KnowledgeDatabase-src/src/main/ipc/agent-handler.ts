/**
 * @file Agent IPC Handler
 * @description 处理 agent:run / agent:cancel 请求，桥接 AgentRunner 与渲染进程
 */

import { IpcMainInvokeEvent } from 'electron'
import { BaseIPCHandler } from './base-handler'
import { AgentRunner } from '../services/agent/agent-runner'
import type { AgentRunParams } from '../services/agent/agent-runner'
import type { VectorRetrievalService } from '../services/vector-retrieval/vector-retrieval-service'
import type { ModelConfigService } from '../services/model-config/model-config-service'
import type { AgentEvent } from '../../renderer/src/stores/rag/agent.types'

export class AgentIPCHandler extends BaseIPCHandler {
  private readonly agentRunner: AgentRunner

  constructor(
    vectorRetrievalService: VectorRetrievalService,
    modelConfigService: ModelConfigService
  ) {
    super()
    this.agentRunner = new AgentRunner(vectorRetrievalService, modelConfigService)
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'agent'
  }

  /**
   * agent:run — 启动一次 Agent 运行
   * 运行是异步的，结果通过 agent:event 推送
   */
  async handleRun(
    event: IpcMainInvokeEvent,
    params: AgentRunParams
  ): Promise<{ success: boolean; runId?: string; error?: string }> {
    try {
      // 创建事件回调：通过 IPC 推送到发起请求的窗口
      const emitEvent = (agentEvent: AgentEvent) => {
        try {
          event.sender.send('agent:event', agentEvent)
        } catch {
          // 窗口可能已关闭，忽略
        }
      }

      // fire-and-forget：不 await，让图在后台流式执行
      // runId 由前端生成并通过 params.runId 透传，保证全链路一致
      this.agentRunner.run(params, emitEvent).catch(() => {
        // 错误已在 run 内部通过 emitEvent 推送，这里只防止 unhandled rejection
      })

      return { success: true, runId: params.runId }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { success: false, error: message }
    }
  }

  /**
   * agent:cancel — 取消指定运行
   */
  async handleCancel(_event: IpcMainInvokeEvent, runId: string): Promise<{ success: boolean }> {
    const cancelled = this.agentRunner.cancel(runId)
    return { success: cancelled }
  }
}
