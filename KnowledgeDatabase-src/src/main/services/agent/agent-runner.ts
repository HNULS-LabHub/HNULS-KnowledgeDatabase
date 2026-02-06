/**
 * @file Agent 运行器
 * @description 负责创建 ChatModel、执行 graph.stream、映射事件、管理 AbortController
 */

import { ChatOpenAI } from '@langchain/openai'
import { logger } from '../logger'
import { ModelConfigService } from '../model-config/model-config-service'
import type { VectorRetrievalService } from '../vector-retrieval/vector-retrieval-service'
import type { AgentEvent } from '../../../renderer/src/stores/rag/agent.types'
import { buildRAGAgentGraph } from './rag-agent-graph'
import type { AgentMeta } from './rag-agent-graph'

// ============================================================================
// 运行请求参数
// ============================================================================

export interface AgentRunParams {
  /** 用户问题 */
  question: string
  /** LLM 模型 ID */
  llmModelId: string
  /** 知识库 ID */
  kbId: number
  /** 向量表名列表 */
  tables: string[]
  /** 重排模型 ID（可选） */
  rerankModelId?: string
  /** TopK */
  k?: number
  /** HNSW ef 参数 */
  ef?: number
  /** 重排 TopN */
  rerankTopN?: number
}

// ============================================================================
// AgentRunner
// ============================================================================

export class AgentRunner {
  private readonly modelConfigService: ModelConfigService
  private readonly vectorRetrievalService: VectorRetrievalService

  /** 当前活跃运行的 AbortController（按 runId） */
  private activeControllers = new Map<string, AbortController>()

  constructor(
    vectorRetrievalService: VectorRetrievalService,
    modelConfigService?: ModelConfigService
  ) {
    this.vectorRetrievalService = vectorRetrievalService
    this.modelConfigService = modelConfigService ?? new ModelConfigService()
  }

  /**
   * 执行一次 Agent 运行
   * @param params 运行参数
   * @param emitEvent 事件回调（推送到渲染层）
   * @returns runId
   */
  async run(
    params: AgentRunParams,
    emitEvent: (event: AgentEvent) => void
  ): Promise<string> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const controller = new AbortController()
    this.activeControllers.set(runId, controller)

    logger.info('[AgentRunner] Starting run', { runId, question: params.question })

    // 1) 推送 run_started
    emitEvent({ type: 'run_started', runId, at: Date.now() })

    try {
      // 2) 解析 LLM provider 配置，创建 ChatOpenAI
      const chatModel = await this.createChatModel(params.llmModelId)

      // 3) 构建图
      const meta: AgentMeta = {
        kbId: params.kbId,
        tables: params.tables,
        rerankModelId: params.rerankModelId,
        llmModelId: params.llmModelId,
        k: params.k,
        ef: params.ef,
        rerankTopN: params.rerankTopN
      }

      const app = buildRAGAgentGraph({
        vectorRetrievalService: this.vectorRetrievalService,
        chatModel,
        emitEvent,
        runId
      })

      // 4) 流式执行图
      const input = {
        question: params.question,
        iteration: 0,
        meta,
        answer: '',
        gradeResult: null,
        documents: []
      }

      const stream = await app.stream(input, {
        streamMode: 'updates' as const,
        signal: controller.signal
      })

      let finalAnswer = ''

      for await (const chunk of stream) {
        // chunk 格式: { nodeName: { ...state updates } }
        for (const [nodeName, update] of Object.entries(chunk)) {
          if (nodeName === 'generate' && (update as any)?.answer) {
            finalAnswer = (update as any).answer
          }
        }
      }

      // 5) 推送 run_completed
      emitEvent({
        type: 'run_completed',
        runId,
        at: Date.now(),
        answer: finalAnswer
      })

      logger.info('[AgentRunner] Run completed', { runId, answerLength: finalAnswer.length })
    } catch (err) {
      if (controller.signal.aborted) {
        logger.info('[AgentRunner] Run cancelled', { runId })
        emitEvent({
          type: 'error',
          runId,
          at: Date.now(),
          message: 'Run cancelled by user'
        })
      } else {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('[AgentRunner] Run failed', { runId, error: message })
        emitEvent({
          type: 'error',
          runId,
          at: Date.now(),
          message: `Agent 运行失败: ${message}`
        })
      }
    } finally {
      this.activeControllers.delete(runId)
    }

    return runId
  }

  /**
   * 取消指定运行
   */
  cancel(runId: string): boolean {
    const controller = this.activeControllers.get(runId)
    if (controller) {
      controller.abort()
      this.activeControllers.delete(runId)
      logger.info('[AgentRunner] Cancelled run', { runId })
      return true
    }
    return false
  }

  /**
   * 取消所有活跃运行
   */
  cancelAll(): void {
    for (const [runId, controller] of this.activeControllers) {
      controller.abort()
      logger.info('[AgentRunner] Cancelled run', { runId })
    }
    this.activeControllers.clear()
  }

  /**
   * 根据模型 ID 解析 provider 配置并创建 ChatOpenAI 实例
   */
  private async createChatModel(modelId: string): Promise<ChatOpenAI> {
    const config = await this.modelConfigService.getConfig()

    // 遍历 providers 找到包含该 modelId 的启用 provider
    for (const provider of config.providers || []) {
      if (!provider?.enabled || !provider.baseUrl || !provider.apiKey) continue
      const hasModel = provider.models?.some((m) => m.id === modelId)
      if (!hasModel) continue

      const baseURL = provider.baseUrl.replace(/\/$/, '')

      return new ChatOpenAI({
        modelName: modelId,
        configuration: {
          baseURL: `${baseURL}/v1`,
          apiKey: provider.apiKey,
          defaultHeaders: provider.defaultHeaders
        },
        streaming: true
      })
    }

    throw new Error(`No enabled provider found for model: ${modelId}`)
  }
}
