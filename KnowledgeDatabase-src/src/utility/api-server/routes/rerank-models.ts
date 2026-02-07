/**
 * @file 重排模型 API 路由
 * @description 提供可用的重排模型列表（脱敏），供外部程序前端下拉选择
 */

import type { Router, Request, Response } from 'express'
import type { MainBridge } from '../ipc/main-bridge'
import type { ApiResponse, RerankModelInfo } from '@shared/api-server.types'

// ============================================================================
// 辅助函数
// ============================================================================

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

function error(code: string, message: string, details?: unknown): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details }
  }
}

// ============================================================================
// 路由工厂
// ============================================================================

export function createRerankModelRoutes(router: Router, bridge: MainBridge): Router {
  /**
   * GET /api/v1/rerank-models
   *
   * 返回当前可用于 rerank 的模型列表：
   * - id: 用于 /retrieval/search 的 rerankModelId
   * - displayName/group/providerName: 用于前端展示
   */
  router.get('/rerank-models', async (_req: Request, res: Response) => {
    try {
      const result = await bridge.listRerankModels()

      if (!result.success) {
        const msg = result.error || 'Unknown error'
        const status = msg.includes('not bound') ? 503 : 500
        res.status(status).json(error('MODEL_LIST_FAILED', 'Failed to list rerank models', msg))
        return
      }

      // 保证返回数组（即使为空）
      res.json(success((result.data || []) as RerankModelInfo[]))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json(error('INTERNAL_ERROR', 'Internal server error', msg))
    }
  })

  return router
}
