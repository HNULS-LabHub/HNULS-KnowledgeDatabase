/**
 * @file Express 应用配置
 * @description 配置 Express 中间件和路由
 */

import express, { Router } from 'express'
import type { Express, Request, Response, NextFunction } from 'express'
import type { SurrealClient } from './db/surreal-client'
import { createKnowledgeRoutes } from './routes/knowledge'
import { createRetrievalRoutes } from './routes/retrieval'
import { createRerankModelRoutes } from './routes/rerank-models'
import { mainBridge } from './ipc/main-bridge'

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: unknown): void => {
  if (data) {
    console.log(`[ApiServer:App] ${msg}`, data)
  } else {
    console.log(`[ApiServer:App] ${msg}`)
  }
}

// ============================================================================
// 应用统计
// ============================================================================

let requestCount = 0
let startTime = 0

export function getRequestCount(): number {
  return requestCount
}

export function getUptime(): number {
  return startTime > 0 ? Date.now() - startTime : 0
}

// ============================================================================
// 创建 Express 应用
// ============================================================================

export function createApp(dbClient: SurrealClient, metaFilePath: string): Express {
  const app = express()
  startTime = Date.now()

  // ==========================================================================
  // 中间件
  // ==========================================================================

  // JSON 解析
  app.use(express.json())

  // CORS (允许所有来源)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (_req.method === 'OPTIONS') {
      res.sendStatus(200)
      return
    }

    next()
  })

  // 请求日志
  app.use((req: Request, _res: Response, next: NextFunction) => {
    requestCount++
    log(`${req.method} ${req.path}`, {
      query: req.query,
      requestId: requestCount
    })
    next()
  })

  // ==========================================================================
  // 状态路由
  // ==========================================================================

  app.get('/api/v1/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        version: '1.0.0',
        uptime: getUptime(),
        requestCount: getRequestCount()
      }
    })
  })

  // ==========================================================================
  // 知识库路由
  // ==========================================================================

  const knowledgeRouter = Router()
  createKnowledgeRoutes(knowledgeRouter, dbClient, metaFilePath)
  app.use('/api/v1', knowledgeRouter)

  // ==========================================================================
  // 检索路由
  // ==========================================================================

  const retrievalRouter = Router()
  createRetrievalRoutes(retrievalRouter, mainBridge)
  app.use('/api/v1', retrievalRouter)

  // ==========================================================================
  // 重排模型路由（供外部程序发现可用 rerankModelId）
  // ==========================================================================

  const rerankModelRouter = Router()
  createRerankModelRoutes(rerankModelRouter, mainBridge)
  app.use('/api/v1', rerankModelRouter)

  // ==========================================================================
  // 404 处理
  // ==========================================================================

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'API endpoint not found'
      }
    })
  })

  // ==========================================================================
  // 错误处理
  // ==========================================================================

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    // 保持 4 参数签名，确保 Express 将其识别为错误处理中间件
    void next

    console.error('[ApiServer:App] Unhandled error:', err)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        details: err.message
      }
    })
  })

  return app
}
