/**
 * @file Utility → Main 消息 RPC 客户端
 * @description 通过 parentPort 向主进程发送检索请求并等待结果
 */

import type {
  ApiServerToMainMessage,
  MainToApiServerMessage,
  RetrievalSearchParams,
  RetrievalHit,
  RerankModelInfo
} from '@shared/api-server.types'

// ============================================================================
// 类型
// ============================================================================

interface PendingRequest<T> {
  resolve: (value: T) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

export interface RetrievalSearchResult {
  success: boolean
  data?: RetrievalHit[]
  error?: string
}

export interface ModelListResult {
  success: boolean
  data?: RerankModelInfo[]
  error?: string
}

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: unknown): void => {
  if (data) {
    console.log(`[ApiServer:MainBridge] ${msg}`, data)
  } else {
    console.log(`[ApiServer:MainBridge] ${msg}`)
  }
}

// ============================================================================
// MainBridge
// ============================================================================

export class MainBridge {
  private parentPort: Electron.MessagePortMain | null = null
  private pendingRetrievalRequests: Map<string, PendingRequest<RetrievalSearchResult>> = new Map()
  private pendingModelListRequests: Map<string, PendingRequest<ModelListResult>> = new Map()
  private requestCounter = 0

  /**
   * 绑定 parentPort（由 entry.ts 在启动时调用）
   */
  bind(parentPort: Electron.MessagePortMain): void {
    this.parentPort = parentPort
    log('Bound to parentPort')
  }

  /**
   * 处理来自 Main 的消息（由 entry.ts 路由过来）
   */
  handleMessage(msg: MainToApiServerMessage): void {
    if (msg.type === 'retrieval:result') {
      const pending = this.pendingRetrievalRequests.get(msg.requestId)
      if (pending) {
        clearTimeout(pending.timeoutId)
        this.pendingRetrievalRequests.delete(msg.requestId)

        const result: RetrievalSearchResult = {
          success: msg.success,
          data: msg.data,
          error: msg.error
        }
        pending.resolve(result)
      }
      return
    }

    if (msg.type === 'model:list:result') {
      const pending = this.pendingModelListRequests.get(msg.requestId)
      if (pending) {
        clearTimeout(pending.timeoutId)
        this.pendingModelListRequests.delete(msg.requestId)

        const result: ModelListResult = {
          success: msg.success,
          data: msg.data,
          error: msg.error
        }
        pending.resolve(result)
      }
    }
  }

  /**
   * 发送向量检索请求到 Main 进程并等待结果
   */
  async sendRetrievalSearch(
    params: RetrievalSearchParams,
    timeoutMs = 60000
  ): Promise<RetrievalSearchResult> {
    if (!this.parentPort) {
      return { success: false, error: 'MainBridge not bound to parentPort' }
    }

    const requestId = this.generateRequestId('ret')

    return new Promise<RetrievalSearchResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRetrievalRequests.has(requestId)) {
          this.pendingRetrievalRequests.delete(requestId)
          resolve({ success: false, error: 'Retrieval request timeout' })
        }
      }, timeoutMs)

      this.pendingRetrievalRequests.set(requestId, { resolve, reject, timeoutId })

      const msg: ApiServerToMainMessage = {
        type: 'retrieval:search',
        requestId,
        params
      }

      this.parentPort!.postMessage(msg)
    })
  }

  async listRerankModels(timeoutMs = 10000): Promise<ModelListResult> {
    if (!this.parentPort) {
      return { success: false, error: 'MainBridge not bound to parentPort' }
    }

    const requestId = this.generateRequestId('model')

    return new Promise<ModelListResult>((resolve) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingModelListRequests.has(requestId)) {
          this.pendingModelListRequests.delete(requestId)
          resolve({ success: false, error: 'Model list request timeout' })
        }
      }, timeoutMs)

      this.pendingModelListRequests.set(requestId, {
        resolve,
        reject: () => {},
        timeoutId
      })

      const msg: ApiServerToMainMessage = {
        type: 'model:list',
        requestId
      }

      this.parentPort!.postMessage(msg)
    })
  }

  private generateRequestId(prefix = 'ret'): string {
    this.requestCounter++
    return `${prefix}-${Date.now()}-${this.requestCounter}`
  }
}

// 单例导出
export const mainBridge = new MainBridge()
