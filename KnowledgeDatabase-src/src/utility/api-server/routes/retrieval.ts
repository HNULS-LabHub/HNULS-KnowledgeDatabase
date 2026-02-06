/**
 * @file 向量检索 API 路由
 * @description 提供向量检索（含重排）的 REST API，通过 mainBridge 委托主进程执行
 */

import type { Router, Request, Response } from 'express'
import type { MainBridge } from '../ipc/main-bridge'
import type { ApiResponse, RetrievalHit, RetrievalSearchParams } from '@shared/api-server.types'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[ApiServer:RetrievalRoutes] ${msg}`, data)
  } else {
    console.log(`[ApiServer:RetrievalRoutes] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[ApiServer:RetrievalRoutes] ${msg}`, error)
}

// ============================================================================
// 辅助函数
// ============================================================================

function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

function error(code: string, message: string, details?: any): ApiResponse<never> {
  return {
    success: false,
    error: { code, message, details }
  }
}

// ============================================================================
// 路由工厂
// ============================================================================

export function createRetrievalRoutes(router: Router, bridge: MainBridge): Router {
  // ==========================================================================
  // POST /api/v1/retrieval/search - 向量检索（含可选重排）
  // ==========================================================================

  router.post('/retrieval/search', async (req: Request, res: Response) => {
    try {
      const body = req.body || {}

      // ---------- 参数校验 ----------
      const knowledgeBaseId = Number(body.knowledgeBaseId)
      if (!knowledgeBaseId || isNaN(knowledgeBaseId)) {
        res.status(400).json(error('INVALID_PARAM', 'knowledgeBaseId is required and must be a number'))
        return
      }

      const tableName = String(body.tableName || '').trim()
      if (!tableName) {
        res.status(400).json(error('INVALID_PARAM', 'tableName is required'))
        return
      }

      const queryText = String(body.queryText || '').trim()
      if (!queryText) {
        res.status(400).json(error('INVALID_PARAM', 'queryText is required'))
        return
      }

      const params: RetrievalSearchParams = {
        knowledgeBaseId,
        tableName,
        queryText,
        k: body.k !== undefined ? Number(body.k) : undefined,
        ef: body.ef !== undefined ? Number(body.ef) : undefined,
        rerankModelId: body.rerankModelId ? String(body.rerankModelId) : undefined,
        rerankTopN: body.rerankTopN !== undefined ? Number(body.rerankTopN) : undefined
      }

      log('Search request', {
        knowledgeBaseId: params.knowledgeBaseId,
        tableName: params.tableName,
        k: params.k,
        ef: params.ef,
        rerankModelId: params.rerankModelId || null,
        queryPreview:
          queryText.length > 100 ? queryText.slice(0, 100) + '…' : queryText
      })

      // ---------- 委托主进程执行 ----------
      const result = await bridge.sendRetrievalSearch(params)

      if (!result.success) {
        log('Search failed', { error: result.error })
        res.status(500).json(error('RETRIEVAL_FAILED', result.error || 'Unknown error'))
        return
      }

      log('Search succeeded', { resultCount: result.data?.length ?? 0 })
      res.json(success(result.data as RetrievalHit[]))
    } catch (err) {
      logError('Unexpected error in retrieval search', err)
      res.status(500).json(error('INTERNAL_ERROR', 'Internal server error'))
    }
  })

  return router
}
