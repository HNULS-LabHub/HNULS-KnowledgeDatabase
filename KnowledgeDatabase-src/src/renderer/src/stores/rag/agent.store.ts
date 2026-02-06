/**
 * Agent 状态管理 Store
 * 管理运行实例、事件聚合、token 累积等
 */

import { defineStore } from 'pinia'
import { ref, computed, onUnmounted } from 'vue'
import type {
  AgentRun,
  AgentEvent,
  AgentDoc,
  AgentCitation,
  AgentStatus
} from './agent.types'

export const useAgentStore = defineStore('agent', () => {
  // ---- State ----
  /** 所有运行实例（支持多 run，按 runId 索引） */
  const runs = ref<Map<string, AgentRun>>(new Map())

  /** 当前活跃的 runId */
  const currentRunId = ref<string | null>(null)

  /** 事件流（按 runId -> events[]） */
  const events = ref<Map<string, AgentEvent[]>>(new Map())

  // ---- Getters ----
  /** 当前运行实例 */
  const currentRun = computed<AgentRun | null>(() => {
    if (!currentRunId.value) return null
    return runs.value.get(currentRunId.value) || null
  })

  /** 当前运行的事件列表 */
  const currentEvents = computed<AgentEvent[]>(() => {
    if (!currentRunId.value) return []
    return events.value.get(currentRunId.value) || []
  })

  /** 当前运行的所有检索文档 */
  const currentDocs = computed<AgentDoc[]>(() => {
    const docs: AgentDoc[] = []
    for (const evt of currentEvents.value) {
      if (evt.type === 'retrieval_results') {
        docs.push(...evt.docs)
      }
    }
    return docs
  })

  /** 当前运行状态 */
  const currentStatus = computed<AgentStatus>(() => {
    return currentRun.value?.status || 'idle'
  })

  /** 当前运行的答案（从 token 累积或最终结果） */
  const currentAnswer = computed<string>(() => {
    return currentRun.value?.answer || ''
  })

  /** 当前运行的引用 */
  const currentCitations = computed<AgentCitation[]>(() => {
    return currentRun.value?.citations || []
  })

  /** 当前运行的错误信息 */
  const currentError = computed<string | undefined>(() => {
    return currentRun.value?.error
  })

  /** 当前运行是否正在进行 */
  const isRunning = computed<boolean>(() => {
    return currentStatus.value === 'running'
  })

  /** 当前运行的用时（毫秒） */
  const currentElapsedMs = computed<number | null>(() => {
    const run = currentRun.value
    if (!run) return null
    if (run.status === 'running') {
      return Date.now() - run.startedAt
    }
    if (run.endedAt) {
      return run.endedAt - run.startedAt
    }
    return null
  })

  // ---- 内部辅助 ----
  function ensureRun(runId: string): AgentRun {
    let run = runs.value.get(runId)
    if (!run) {
      run = {
        runId,
        status: 'idle',
        startedAt: Date.now(),
        modelId: '',
        kbId: 0,
        question: '',
        answer: '',
        citations: []
      }
      runs.value.set(runId, run)
    }
    return run
  }

  function ensureEvents(runId: string): AgentEvent[] {
    let evts = events.value.get(runId)
    if (!evts) {
      evts = []
      events.value.set(runId, evts)
    }
    return evts
  }

  // ---- IPC 事件监听 ----
  let unsubscribeIPC: (() => void) | null = null

  /**
   * 初始化 IPC 事件监听
   * 应在组件 setup 中调用
   */
  function initIPCListener(): void {
    if (unsubscribeIPC) return // 已初始化
    const api = (window as any).api
    if (api?.agent?.onEvent) {
      unsubscribeIPC = api.agent.onEvent((event: AgentEvent) => {
        pushEvent(event)
      })
    }
  }

  /**
   * 清理 IPC 事件监听
   */
  function destroyIPCListener(): void {
    if (unsubscribeIPC) {
      unsubscribeIPC()
      unsubscribeIPC = null
    }
  }

  // ---- Actions ----
  /**
   * 开始新的运行（本地状态初始化）
   * @param question 用户问题
   * @param modelId LLM 模型 ID
   * @param kbId 知识库 ID
   * @returns runId
   */
  function startRun(question: string, modelId: string, kbId: number): string {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const run: AgentRun = {
      runId,
      status: 'running',
      startedAt: Date.now(),
      modelId,
      kbId,
      question,
      answer: '',
      citations: []
    }
    runs.value.set(runId, run)
    events.value.set(runId, [])
    currentRunId.value = runId

    // 推送 run_started 事件
    pushEvent({
      type: 'run_started',
      runId,
      at: Date.now()
    })

    return runId
  }

  /**
   * 通过 IPC 启动后端 Agent 运行
   */
  async function runAgent(params: {
    question: string
    llmModelId: string
    kbId: number
    tables: string[]
    rerankModelId?: string
    k?: number
    ef?: number
    rerankTopN?: number
  }): Promise<string | null> {
    // 1) 初始化本地状态（生成 runId）
    const runId = startRun(params.question, params.llmModelId, params.kbId)

    // 2) 确保 IPC 监听已启动
    initIPCListener()

    // 3) 调用后端，透传 runId 保证全链路一致
    const api = (window as any).api
    if (!api?.agent?.run) {
      pushEvent({
        type: 'error',
        runId,
        at: Date.now(),
        message: 'Agent API not available'
      })
      return null
    }

    const result = await api.agent.run({ ...params, runId })
    if (!result.success) {
      pushEvent({
        type: 'error',
        runId,
        at: Date.now(),
        message: result.error || 'Failed to start agent run'
      })
      return null
    }

    return runId
  }

  /**
   * 推送事件
   * @param event AgentEvent
   */
  function pushEvent(event: AgentEvent): void {
    const evts = ensureEvents(event.runId)
    evts.push(event)

    const run = ensureRun(event.runId)

    // 根据事件类型更新 run 状态
    switch (event.type) {
      case 'run_started':
        run.status = 'running'
        break

      case 'run_completed':
        run.status = 'completed'
        run.endedAt = event.at
        if (event.answer !== undefined) {
          run.answer = event.answer
        }
        if (event.citations) {
          run.citations = event.citations
        }
        break

      case 'token':
        // 累积 token 到 answer
        run.answer += event.text
        break

      case 'error':
        run.status = 'error'
        run.endedAt = event.at
        run.error = event.message
        break
    }
  }

  /**
   * 取消当前运行（同时通知后端）
   */
  async function cancel(): Promise<void> {
    if (!currentRunId.value) return
    const run = runs.value.get(currentRunId.value)
    if (run && run.status === 'running') {
      run.status = 'cancelled'
      run.endedAt = Date.now()

      // 通知后端取消
      const api = (window as any).api
      if (api?.agent?.cancel) {
        await api.agent.cancel(currentRunId.value).catch(() => {})
      }

      // 推送 error 事件（表示取消）
      pushEvent({
        type: 'error',
        runId: currentRunId.value,
        at: Date.now(),
        message: 'Run cancelled by user'
      })
    }
  }

  /**
   * 重试（重新执行当前问题）
   * 需要外部传入执行逻辑，这里只提供 UI 状态管理
   */
  function retry(): void {
    if (!currentRun.value) return
    // 清除当前 run，准备重新开始
    const question = currentRun.value.question
    const modelId = currentRun.value.modelId
    const kbId = currentRun.value.kbId
    startRun(question, modelId, kbId)
  }

  /**
   * 清除运行记录
   * @param runId 可选，不传则清除所有
   */
  function clearRuns(runId?: string): void {
    if (runId) {
      runs.value.delete(runId)
      events.value.delete(runId)
      if (currentRunId.value === runId) {
        currentRunId.value = null
      }
    } else {
      runs.value.clear()
      events.value.clear()
      currentRunId.value = null
    }
  }

  /**
   * 设置当前活跃的 runId
   */
  function setCurrentRun(runId: string | null): void {
    currentRunId.value = runId
  }

  return {
    // state
    runs,
    currentRunId,
    events,

    // getters
    currentRun,
    currentEvents,
    currentDocs,
    currentStatus,
    currentAnswer,
    currentCitations,
    currentError,
    isRunning,
    currentElapsedMs,

    // actions
    startRun,
    runAgent,
    pushEvent,
    cancel,
    retry,
    clearRuns,
    setCurrentRun,
    initIPCListener,
    destroyIPCListener
  }
})
