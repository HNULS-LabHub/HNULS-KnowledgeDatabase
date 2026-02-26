/**
 * @file Knowledge Graph API 路由
 * @description 提供 KG 检索和模型查询的 REST API
 */

import type { Router, Request, Response } from 'express'
import type { MainBridge } from '../ipc/main-bridge'
import type { SurrealClient } from '../db/surreal-client'
import type { ApiResponse, KGRetrievalParams } from '@shared/api-server.types'
import * as fs from 'fs/promises'

// ============================================================================
// 类型定义
// ============================================================================

interface KnowledgeLibraryMeta {
  version: string
  knowledgeBases: KnowledgeBaseMeta[]
}

interface KnowledgeBaseMeta {
  id: number
  name: string
  description: string
  databaseName: string
  documentPath?: string
}

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

export function createKGRoutes(
  router: Router,
  bridge: MainBridge,
  dbClient: SurrealClient,
  metaFilePath: string
): Router {
  
  // ==========================================================================
  // 辅助函数：读取知识库元数据
  // ==========================================================================
  
  async function readMetaFile(): Promise<KnowledgeLibraryMeta> {
    try {
      const content = await fs.readFile(metaFilePath, 'utf-8')
      return JSON.parse(content)
    } catch (err) {
      console.error('[KG Routes] Failed to read meta file', err)
      return { version: '1.0.0', knowledgeBases: [] }
    }
  }
  
  // ==========================================================================
  // GET /api/v1/kg/knowledge-bases - 获取知识库列表
  // ==========================================================================
  
  router.get('/kg/knowledge-bases', async (_req: Request, res: Response) => {
    try {
      const meta = await readMetaFile()
      const knowledgeBases = meta.knowledgeBases.map(kb => ({
        id: kb.id,
        name: kb.name,
        description: kb.description,
        databaseName: kb.databaseName
      }))
      
      res.json(success(knowledgeBases))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json(error('INTERNAL_ERROR', 'Failed to list knowledge bases', msg))
    }
  })

  // ==========================================================================
  // GET /api/v1/kg/knowledge-bases/:id/configs - 获取知识库的 KG 配置
  // ==========================================================================
  
  router.get('/kg/knowledge-bases/:id/configs', async (req: Request, res: Response) => {
    try {
      const kbId = parseInt(req.params.id)
      if (isNaN(kbId)) {
        res.status(400).json(error('INVALID_PARAM', 'Invalid knowledge base ID'))
        return
      }

      const meta = await readMetaFile()
      const kb = meta.knowledgeBases.find(k => k.id === kbId)
      if (!kb) {
        res.status(404).json(error('NOT_FOUND', 'Knowledge base not found'))
        return
      }

      // 查询知识库配置
      const sql = `SELECT * FROM kb_config WHERE id = 'global'`
      const result = await dbClient.queryInDatabase('knowledge', kb.databaseName, sql)
      const records = dbClient.extractRecords(result)
      
      if (records.length === 0) {
        res.json(success({ knowledgeGraph: null }))
        return
      }

      const config = records[0]
      res.json(success({
        knowledgeGraph: config.knowledgeGraph || null
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json(error('INTERNAL_ERROR', 'Failed to get KG configs', msg))
    }
  })

  // ==========================================================================
  // GET /api/v1/kg/knowledge-bases/:id/graph-tables - 获取知识库的图谱表信息
  // ==========================================================================
  
  router.get('/kg/knowledge-bases/:id/graph-tables', async (req: Request, res: Response) => {
    try {
      const kbId = parseInt(req.params.id)
      if (isNaN(kbId)) {
        res.status(400).json(error('INVALID_PARAM', 'Invalid knowledge base ID'))
        return
      }

      const meta = await readMetaFile()
      const kb = meta.knowledgeBases.find(k => k.id === kbId)
      if (!kb) {
        res.status(404).json(error('NOT_FOUND', 'Knowledge base not found'))
        return
      }

      // 查询所有表名
      const sql = `INFO FOR DB`
      const result = await dbClient.queryInDatabase('knowledge', kb.databaseName, sql)
      
      // INFO FOR DB 返回的是一个对象，包含 tables 字段
      let tables: string[] = []
      if (result && typeof result === 'object') {
        const dbInfo = Array.isArray(result) ? result[0] : result
        if (dbInfo && dbInfo.tables) {
          // tables 是一个对象，key 是表名
          tables = Object.keys(dbInfo.tables).filter(name => name.startsWith('kg_'))
        }
      }
      
      // 提取唯一的 graphTableBase（去掉后缀）
      const graphTableBases = new Set<string>()
      for (const tableName of tables) {
        // 表名格式：kg_emb_cfg_xxx_entity / kg_emb_cfg_xxx_relates / kg_emb_cfg_xxx_entity_chunks / kg_emb_cfg_xxx_relation_chunks
        if (tableName.endsWith('_entity')) {
          graphTableBases.add(tableName.replace(/_entity$/, ''))
        } else if (tableName.endsWith('_relates')) {
          graphTableBases.add(tableName.replace(/_relates$/, ''))
        } else if (tableName.endsWith('_entity_chunks')) {
          graphTableBases.add(tableName.replace(/_entity_chunks$/, ''))
        } else if (tableName.endsWith('_relation_chunks')) {
          graphTableBases.add(tableName.replace(/_relation_chunks$/, ''))
        }
      }

      // 对每个 graphTableBase，查询实体和关系数量
      const tableInfos = await Promise.all(
        Array.from(graphTableBases).map(async (graphTableBase: string) => {
          try {
            const entityTable = `${graphTableBase}_entity`
            const relatesTable = `${graphTableBase}_relates`

            const [entityResult, relatesResult] = await Promise.all([
              dbClient.queryInDatabase('knowledge', kb.databaseName, `SELECT count() as cnt FROM ${entityTable} GROUP ALL`),
              dbClient.queryInDatabase('knowledge', kb.databaseName, `SELECT count() as cnt FROM ${relatesTable} GROUP ALL`)
            ])

            const entityCount = dbClient.extractRecords(entityResult)[0]?.cnt || 0
            const relationCount = dbClient.extractRecords(relatesResult)[0]?.cnt || 0

            return {
              graphTableBase,
              entityCount,
              relationCount
            }
          } catch (err) {
            console.error(`[KG Routes] Failed to query table ${graphTableBase}:`, err)
            return null
          }
        })
      )

      const validTableInfos = tableInfos.filter(t => t !== null)
      
      res.json(success({
        targetNamespace: 'knowledge',
        targetDatabase: kb.databaseName,
        graphs: validTableInfos
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json(error('INTERNAL_ERROR', 'Failed to get graph tables', msg))
    }
  })

  // ==========================================================================
  // GET /api/v1/kg/models - 获取可用模型列表（复用 rerank-models 逻辑）
  // ==========================================================================
  
  router.get('/kg/models', async (_req: Request, res: Response) => {
    try {
      const result = await bridge.listRerankModels()
      
      if (!result.success) {
        const msg = result.error || 'Unknown error'
        const status = msg.includes('not bound') ? 503 : 500
        res.status(status).json(error('MODEL_LIST_FAILED', 'Failed to list models', msg))
        return
      }
      
      res.json(success(result.data || []))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json(error('INTERNAL_ERROR', 'Internal server error', msg))
    }
  })

  // ==========================================================================
  // POST /api/v1/kg/retrieval - 执行 KG 混合检索
  // ==========================================================================

  router.post('/kg/retrieval', async (req: Request, res: Response) => {
    try {
      const body = req.body || {}
      
      // 基础校验
      if (!body.query || typeof body.query !== 'string') {
        res.status(400).json(error('INVALID_PARAM', 'query is required'))
        return
      }
      if (!body.targetNamespace || !body.targetDatabase || !body.graphTableBase) {
        res.status(400).json(error('INVALID_PARAM', 'Target (namespace, database, graphTableBase) is required'))
        return
      }
      if (!body.embeddingConfig) {
        res.status(400).json(error('INVALID_PARAM', 'embeddingConfig is required'))
        return
      }

      // 构造 Partial<KGRetrievalParams>
      // API 用户可以传入 providerId/modelId，让 Main 进程补全 apiKey/baseUrl
      // 也可以直接传入完整的 apiKey/baseUrl
      const params: Partial<KGRetrievalParams> = {
        query: body.query,
        mode: body.mode || 'hybrid',
        targetNamespace: body.targetNamespace,
        targetDatabase: body.targetDatabase,
        graphTableBase: body.graphTableBase,
        embeddingConfig: body.embeddingConfig,
        keywordExtraction: body.keywordExtraction,
        vectorSearch: body.vectorSearch,
        graphTraversal: body.graphTraversal,
        chunkTableName: body.chunkTableName,
        rerank: body.rerank,
        tokenBudget: body.tokenBudget
      }

      // 设置超长超时 (120s)
      req.setTimeout(120000)

      const result = await bridge.sendKGRetrievalSearch(params)

      if (!result.success) {
        res.status(500).json(error('KG_RETRIEVAL_FAILED', result.error || 'Retrieval failed'))
        return
      }

      res.json(success(result.data))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      res.status(500).json(error('INTERNAL_ERROR', 'Internal server error', msg))
    }
  })

  return router
}
