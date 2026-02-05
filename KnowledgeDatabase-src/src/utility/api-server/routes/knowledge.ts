/**
 * @file 知识库 API 路由
 * @description 提供知识库和文档查询的 REST API
 */

import type { Router, Request, Response } from 'express'
import type { SurrealClient } from '../db/surreal-client'
import type {
  KnowledgeBaseInfo,
  KnowledgeBaseDetail,
  DocumentInfo,
  DocumentEmbeddingItem,
  ApiResponse,
  PaginationInfo
} from '@shared/api-server.types'
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
  docCount: number
  chunkCount: number
  lastUpdated: string
  createdAt: string
  color: string
  icon: string
  documentPath?: string
  databaseName: string
}

// ============================================================================
// 日志
// ============================================================================

const log = (msg: string, data?: any): void => {
  if (data) {
    console.log(`[ApiServer:KnowledgeRoutes] ${msg}`, data)
  } else {
    console.log(`[ApiServer:KnowledgeRoutes] ${msg}`)
  }
}

const logError = (msg: string, error?: any): void => {
  console.error(`[ApiServer:KnowledgeRoutes] ${msg}`, error)
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

export function createKnowledgeRoutes(
  router: Router,
  dbClient: SurrealClient,
  metaFilePath: string
): Router {
  /**
   * 读取知识库元数据文件
   */
  async function readMetaFile(): Promise<KnowledgeLibraryMeta> {
    try {
      const content = await fs.readFile(metaFilePath, 'utf-8')
      return JSON.parse(content)
    } catch (err) {
      logError('Failed to read meta file', err)
      return { version: '1.0.0', knowledgeBases: [] }
    }
  }

  /**
   * 转换为 API 响应格式
   */
  function toKnowledgeBaseInfo(kb: KnowledgeBaseMeta): KnowledgeBaseInfo {
    return {
      id: kb.id,
      name: kb.name,
      description: kb.description,
      docCount: kb.docCount,
      chunkCount: kb.chunkCount,
      createdAt: kb.createdAt,
      lastUpdated: kb.lastUpdated,
      color: kb.color,
      icon: kb.icon
    }
  }

  function toKnowledgeBaseDetail(kb: KnowledgeBaseMeta): KnowledgeBaseDetail {
    return {
      ...toKnowledgeBaseInfo(kb),
      databaseName: kb.databaseName,
      documentPath: kb.documentPath
    }
  }

  // ==========================================================================
  // GET /api/v1/knowledge-bases - 获取所有知识库
  // ==========================================================================

  router.get('/knowledge-bases', async (_req: Request, res: Response) => {
    try {
      const meta = await readMetaFile()
      const list = meta.knowledgeBases.map(toKnowledgeBaseInfo)

      log(`Listed ${list.length} knowledge bases`)
      res.json(success(list))
    } catch (err) {
      logError('Failed to list knowledge bases', err)
      res.status(500).json(error('INTERNAL_ERROR', 'Failed to list knowledge bases'))
    }
  })

  // ==========================================================================
  // GET /api/v1/knowledge-bases/:id - 获取知识库详情
  // ==========================================================================

  router.get('/knowledge-bases/:id', async (req: Request, res: Response) => {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const id = parseInt(idParam, 10)
      if (isNaN(id)) {
        res.status(400).json(error('INVALID_ID', 'Invalid knowledge base ID'))
        return
      }

      const meta = await readMetaFile()
      const kb = meta.knowledgeBases.find((k) => k.id === id)

      if (!kb) {
        res.status(404).json(error('NOT_FOUND', `Knowledge base ${id} not found`))
        return
      }

      log(`Got knowledge base: ${kb.name} (ID: ${id})`)
      res.json(success(toKnowledgeBaseDetail(kb)))
    } catch (err) {
      logError('Failed to get knowledge base', err)
      res.status(500).json(error('INTERNAL_ERROR', 'Failed to get knowledge base'))
    }
  })

  // ==========================================================================
  // GET /api/v1/knowledge-bases/:id/documents - 获取知识库内文档列表
  // ==========================================================================

  router.get('/knowledge-bases/:id/documents', async (req: Request, res: Response) => {
    try {
      const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
      const id = parseInt(idParam, 10)
      if (isNaN(id)) {
        res.status(400).json(error('INVALID_ID', 'Invalid knowledge base ID'))
        return
      }

      // 分页参数
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 20))

      // 获取知识库信息
      const meta = await readMetaFile()
      const kb = meta.knowledgeBases.find((k) => k.id === id)

      if (!kb) {
        res.status(404).json(error('NOT_FOUND', `Knowledge base ${id} not found`))
        return
      }

      if (!kb.databaseName) {
        res.status(500).json(error('NO_DATABASE', 'Knowledge base has no database'))
        return
      }

      // 检查数据库连接
      if (!dbClient.isConnected()) {
        res.status(503).json(error('DB_NOT_CONNECTED', 'Database not connected'))
        return
      }

      const namespace = dbClient.getNamespace()

      // 查询文档总数
      const countSql = 'SELECT count() FROM kb_document GROUP ALL;'
      const countResult = await dbClient.queryInDatabase(namespace, kb.databaseName, countSql)
      const countRecords = dbClient.extractRecords(countResult)
      const total = countRecords[0]?.count || 0

      // 计算分页
      const totalPages = Math.ceil(total / pageSize)
      const offset = (page - 1) * pageSize

      // 查询文档基本信息
      const docSql = `
        SELECT
          id,
          file_key,
          file_name,
          file_path,
          file_type,
          updated_at
        FROM kb_document
        ORDER BY updated_at DESC
        LIMIT $limit
        START $offset;
      `

      const docResult = await dbClient.queryInDatabase(namespace, kb.databaseName, docSql, {
        limit: pageSize,
        offset
      })

      const docRecords = dbClient.extractRecords(docResult)

      // 获取所有文档的 file_key 列表
      const fileKeys = docRecords.map((doc: any) => doc.file_key).filter(Boolean)

      // 查询所有文档的嵌入状态（从 kb_document_embedding 表）
      let embeddingMap: Map<string, DocumentEmbeddingItem[]> = new Map()
      if (fileKeys.length > 0) {
        const embeddingSql = `
          SELECT
            file_key,
            embedding_config_id,
            embedding_config_name,
            dimensions,
            status,
            chunk_count,
            updated_at
          FROM kb_document_embedding
          WHERE file_key IN $fileKeys;
        `
        const embeddingResult = await dbClient.queryInDatabase(
          namespace,
          kb.databaseName,
          embeddingSql,
          { fileKeys }
        )
        const embeddingRecords = dbClient.extractRecords(embeddingResult)

        // 按 file_key 分组
        for (const record of embeddingRecords) {
          const key = record.file_key
          if (!embeddingMap.has(key)) {
            embeddingMap.set(key, [])
          }
          embeddingMap.get(key)!.push({
            embeddingConfigId: record.embedding_config_id,
            embeddingConfigName: record.embedding_config_name || undefined,
            dimensions: record.dimensions,
            status: record.status || 'pending',
            chunkCount: record.chunk_count || 0,
            updatedAt: record.updated_at ? String(record.updated_at) : new Date().toISOString()
          })
        }
      }

      // 转换为 API 响应格式
      const documents: DocumentInfo[] = docRecords.map((doc: any) => {
        const fileKey = doc.file_key || ''
        const embeddings = embeddingMap.get(fileKey) || []

        return {
          id: typeof doc.id === 'object' ? doc.id.id || String(doc.id) : String(doc.id),
          fileKey,
          fileName: doc.file_name || '',
          fileType: doc.file_type || '',
          updatedAt: doc.updated_at ? String(doc.updated_at) : new Date().toISOString(),
          embeddings
        }
      })

      const pagination: PaginationInfo = {
        total,
        page,
        pageSize,
        totalPages
      }

      log(`Listed ${documents.length} documents for KB ${kb.name} (page ${page}/${totalPages})`)
      res.json(success({ documents, pagination }))
    } catch (err) {
      logError('Failed to list documents', err)
      res.status(500).json(error('INTERNAL_ERROR', 'Failed to list documents'))
    }
  })

  // ==========================================================================
  // GET /api/v1/knowledge-bases/:id/documents/:fileKey/embeddings - 获取文档嵌入状态
  // ==========================================================================

  router.get(
    '/knowledge-bases/:id/documents/:fileKey/embeddings',
    async (req: Request, res: Response) => {
      try {
        const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
        const id = parseInt(idParam, 10)
        if (isNaN(id)) {
          res.status(400).json(error('INVALID_ID', 'Invalid knowledge base ID'))
          return
        }

        const fileKeyParam = Array.isArray(req.params.fileKey)
          ? req.params.fileKey[0]
          : req.params.fileKey
        const fileKey = decodeURIComponent(fileKeyParam)
        if (!fileKey) {
          res.status(400).json(error('INVALID_FILE_KEY', 'Invalid file key'))
          return
        }

        // 获取知识库信息
        const meta = await readMetaFile()
        const kb = meta.knowledgeBases.find((k) => k.id === id)

        if (!kb) {
          res.status(404).json(error('NOT_FOUND', `Knowledge base ${id} not found`))
          return
        }

        if (!kb.databaseName) {
          res.status(500).json(error('NO_DATABASE', 'Knowledge base has no database'))
          return
        }

        // 检查数据库连接
        if (!dbClient.isConnected()) {
          res.status(503).json(error('DB_NOT_CONNECTED', 'Database not connected'))
          return
        }

        const namespace = dbClient.getNamespace()

        // 查询文档嵌入状态 (支持多配置)
        const sql = `
        SELECT
          file_key,
          embedding_config_id,
          embedding_config_name,
          dimensions,
          status,
          chunk_count,
          updated_at
        FROM kb_document_embedding
        WHERE file_key = $fileKey;
      `

        const result = await dbClient.queryInDatabase(namespace, kb.databaseName, sql, {
          fileKey
        })

        const records = dbClient.extractRecords(result)

        const embeddings = records
          .filter((r: any) => r.file_key && r.embedding_config_id && r.dimensions)
          .map((r: any) => ({
            fileKey: r.file_key,
            embeddingConfigId: r.embedding_config_id,
            embeddingConfigName: r.embedding_config_name || undefined,
            dimensions: r.dimensions,
            status: r.status || 'pending',
            chunkCount: r.chunk_count || 0,
            updatedAt: r.updated_at ? String(r.updated_at) : new Date().toISOString()
          }))

        log(`Got ${embeddings.length} embeddings for file: ${fileKey}`)
        res.json(success(embeddings))
      } catch (err) {
        logError('Failed to get document embeddings', err)
        res.status(500).json(error('INTERNAL_ERROR', 'Failed to get document embeddings'))
      }
    }
  )

  return router
}
