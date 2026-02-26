# API Server

> Electron Utility Process，运行 Express HTTP 服务器，为外部程序提供知识库数据查询、向量检索、知识图谱检索等 RESTful API。

## 架构概述

```
外部程序 (curl / Python / etc.)
    │
    ▼  HTTP
┌─────────────────────────────────┐
│  API Server (Utility Process)   │  ← Express, 独立 Node 进程
│  默认 http://localhost:3721     │
└────────────┬────────────────────┘
             │ IPC (parentPort)
             ▼
┌─────────────────────────────────┐
│  Main Process                   │  ← 凭证注入、服务调度
│  ├─ VectorRetrievalService      │
│  ├─ ModelConfigService          │
│  └─ KnowledgeGraphBridge ──────────► KG Utility Process
└─────────────────────────────────┘
```

- API Server 作为独立 Utility Process 运行，通过 IPC 与 Main 进程通信
- 敏感信息（API Key、Base URL）由 Main 进程注入，**不会暴露给外部调用方**
- 默认监听 `http://localhost:3721`，CORS 全开放

## 目录结构

```
api-server/
├── entry.ts              # Utility Process 入口，生命周期管理
├── app.ts                # Express 应用配置，中间件 & 路由挂载
├── db/
│   └── surreal-client.ts # SurrealDB 客户端封装
├── ipc/
│   └── main-bridge.ts    # 与 Main 进程的 RPC 通信桥
└── routes/
    ├── knowledge.ts      # 知识库 & 文档查询路由
    ├── retrieval.ts      # 向量检索路由
    ├── rerank-models.ts  # Rerank 模型列表路由
    └── kg.ts             # 知识图谱相关路由（发现 + 检索）
```

## 统一响应格式

所有接口返回 JSON，遵循统一格式：

```jsonc
// 成功
{
  "success": true,
  "data": { ... }
}

// 失败
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": "..."  // 可选
  }
}
```

---

## API 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/status` | 服务状态 |
| GET | `/api/v1/knowledge-bases` | 知识库列表 |
| GET | `/api/v1/knowledge-bases/:id` | 知识库详情 |
| GET | `/api/v1/knowledge-bases/:id/documents` | 文档列表（分页） |
| GET | `/api/v1/knowledge-bases/:id/documents/:fileKey/embeddings` | 文档嵌入状态 |
| GET | `/api/v1/rerank-models` | Rerank 模型列表 |
| POST | `/api/v1/retrieval/search` | 向量检索 |
| GET | `/api/v1/kg/knowledge-bases` | 知识库列表（KG 视角） |
| GET | `/api/v1/kg/knowledge-bases/:id/configs` | KG 配置 |
| GET | `/api/v1/kg/knowledge-bases/:id/graph-tables` | 图谱表信息 |
| GET | `/api/v1/kg/models` | 可用模型列表 |
| POST | `/api/v1/kg/retrieval` | 知识图谱检索 |

---

## API 调用范例

> 以下示例假设服务运行在 `http://localhost:3721`。

### 1. 服务状态

```bash
curl http://localhost:3721/api/v1/status
```

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "uptime": 28786,
    "requestCount": 5
  }
}
```

---

### 2. 知识库查询

#### 2.1 获取所有知识库

```bash
curl http://localhost:3721/api/v1/knowledge-bases
```

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "test1",
      "description": "测试知识库",
      "docCount": 5,
      "chunkCount": 120,
      "createdAt": "2026-02-20T10:00:00Z",
      "lastUpdated": "2026-02-25T14:30:00Z",
      "color": "#3b82f6",
      "icon": "book"
    }
  ]
}
```

#### 2.2 获取知识库详情

```bash
curl http://localhost:3721/api/v1/knowledge-bases/2
```

```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "temp2",
    "description": "",
    "docCount": 3,
    "chunkCount": 44,
    "createdAt": "2026-02-24T10:00:00Z",
    "lastUpdated": "2026-02-25T14:00:00Z",
    "color": "#10b981",
    "icon": "flask",
    "databaseName": "temp2",
    "documentPath": "D:/knowledge-docs/temp2"
  }
}
```

#### 2.3 获取文档列表（分页）

```bash
curl "http://localhost:3721/api/v1/knowledge-bases/2/documents?page=1&pageSize=10"
```

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "abc123",
        "fileKey": "现代分子生物学-part3_0.pdf",
        "fileName": "现代分子生物学-part3_0.pdf",
        "fileType": "pdf",
        "updatedAt": "2026-02-24T14:21:11Z",
        "embeddings": [
          {
            "embeddingConfigId": "cfg_1771920489524",
            "embeddingConfigName": "Qwen3 Embedding 8B",
            "dimensions": 4096,
            "status": "completed",
            "chunkCount": 44,
            "updatedAt": "2026-02-24T14:21:11Z"
          }
        ]
      }
    ],
    "pagination": {
      "total": 3,
      "page": 1,
      "pageSize": 10,
      "totalPages": 1
    }
  }
}
```

#### 2.4 获取文档嵌入状态

```bash
# fileKey 需要 URL 编码
curl "http://localhost:3721/api/v1/knowledge-bases/2/documents/%E7%8E%B0%E4%BB%A3%E5%88%86%E5%AD%90%E7%94%9F%E7%89%A9%E5%AD%A6-part3_0.pdf/embeddings"
```

---

### 3. 模型查询

#### 3.1 获取可用模型列表

```bash
curl http://localhost:3721/api/v1/kg/models
```

```json
{
  "success": true,
  "data": [
    {
      "id": "Qwen/Qwen3-Embedding-8B",
      "displayName": "Qwen/Qwen3-Embedding-8B",
      "group": "Qwen",
      "providerId": "provider-1769568569985",
      "providerName": "siliconflow",
      "protocol": "openai"
    },
    {
      "id": "gemini-2.5-flash-nothinking",
      "displayName": "gemini-2.5-flash-nothinking",
      "group": "gemini-2.5",
      "providerId": "provider-1770896692317",
      "providerName": "kfc",
      "protocol": "openai"
    }
  ]
}
```

#### 3.2 获取 Rerank 模型列表

```bash
curl http://localhost:3721/api/v1/rerank-models
```

---

### 4. 向量检索

```bash
curl -X POST http://localhost:3721/api/v1/retrieval/search \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgeBaseId": 2,
    "tableName": "emb_cfg_cfg_1771920489524_4096_chunks",
    "queryText": "基因表达调控",
    "k": 10,
    "rerankModelId": "BAAI/bge-reranker-v2-m3",
    "rerankTopN": 5
  }'
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `knowledgeBaseId` | number | ✅ | 知识库 ID |
| `tableName` | string | ✅ | 嵌入表名 |
| `queryText` | string | ✅ | 检索文本 |
| `k` | number | 否 | 返回数量（默认 10） |
| `ef` | number | 否 | HNSW ef 参数 |
| `rerankModelId` | string | 否 | 重排模型 ID |
| `rerankTopN` | number | 否 | 重排后保留数量 |
| `fileKey` | string | 否 | 按单个文件筛选 |
| `fileKeys` | string[] | 否 | 按多个文件筛选 |

---

### 5. 知识图谱检索

#### 5.1 发现流程（推荐先执行）

```bash
# Step 1: 获取知识库列表
curl http://localhost:3721/api/v1/kg/knowledge-bases

# Step 2: 查看 KG 配置
curl http://localhost:3721/api/v1/kg/knowledge-bases/2/configs

# Step 3: 查看图谱表信息（含实体/关系数量）
curl http://localhost:3721/api/v1/kg/knowledge-bases/2/graph-tables
```

图谱表信息响应示例：

```json
{
  "success": true,
  "data": {
    "targetNamespace": "knowledge",
    "targetDatabase": "temp2",
    "graphs": [
      {
        "graphTableBase": "kg_emb_cfg_cfg_1771920489524_4096",
        "entityCount": 750,
        "relationCount": 983
      }
    ]
  }
}
```

> `graphTableBase` 和 `targetDatabase` 是后续检索请求的必填参数。

#### 5.2 获取可用模型

```bash
# Step 4: 获取模型列表，找到嵌入模型和 LLM 模型
curl http://localhost:3721/api/v1/kg/models
```

> 从文档嵌入状态 API 可以确认图谱对应的嵌入模型和维度。

#### 5.3 执行 KG 检索

KG 检索支持 4 种模式：`naive`、`local`、`global`、`hybrid`。

##### Naive 模式（仅向量检索，不使用图谱）

```bash
curl -X POST http://localhost:3721/api/v1/kg/retrieval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "基因表达调控",
    "mode": "naive",
    "targetNamespace": "knowledge",
    "targetDatabase": "temp2",
    "graphTableBase": "kg_emb_cfg_cfg_1771920489524_4096",
    "chunkTableName": "emb_cfg_cfg_1771920489524_4096_chunks",
    "embeddingConfig": {
      "providerId": "provider-1769568569985",
      "modelId": "Qwen/Qwen3-Embedding-8B",
      "dimensions": 4096
    },
    "vectorSearch": {
      "chunkTopK": 10
    }
  }'
```

##### Local 模式（LLM 提取关键词 + 实体向量检索 + 图遍历）

```bash
curl -X POST http://localhost:3721/api/v1/kg/retrieval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "基因表达调控",
    "mode": "local",
    "targetNamespace": "knowledge",
    "targetDatabase": "temp2",
    "graphTableBase": "kg_emb_cfg_cfg_1771920489524_4096",
    "chunkTableName": "emb_cfg_cfg_1771920489524_4096_chunks",
    "embeddingConfig": {
      "providerId": "provider-1769568569985",
      "modelId": "Qwen/Qwen3-Embedding-8B",
      "dimensions": 4096
    },
    "keywordExtraction": {
      "useLLM": true,
      "llmProviderId": "provider-1770896692317",
      "llmModelId": "gemini-2.5-flash-nothinking"
    },
    "vectorSearch": {
      "entityTopK": 20,
      "relationTopK": 20,
      "chunkTopK": 30
    },
    "graphTraversal": {
      "maxDepth": 2,
      "maxNeighbors": 10
    }
  }'
```

##### Hybrid 模式（推荐，综合效果最佳）

```bash
curl -X POST http://localhost:3721/api/v1/kg/retrieval \
  -H "Content-Type: application/json" \
  -d '{
    "query": "基因表达调控",
    "mode": "hybrid",
    "targetNamespace": "knowledge",
    "targetDatabase": "temp2",
    "graphTableBase": "kg_emb_cfg_cfg_1771920489524_4096",
    "chunkTableName": "emb_cfg_cfg_1771920489524_4096_chunks",
    "embeddingConfig": {
      "providerId": "provider-1769568569985",
      "modelId": "Qwen/Qwen3-Embedding-8B",
      "dimensions": 4096
    },
    "keywordExtraction": {
      "useLLM": true,
      "llmProviderId": "provider-1770896692317",
      "llmModelId": "gemini-2.5-flash-nothinking"
    },
    "vectorSearch": {
      "entityTopK": 20,
      "relationTopK": 20,
      "chunkTopK": 30
    },
    "graphTraversal": {
      "maxDepth": 2,
      "maxNeighbors": 10
    }
  }'
```

**KG 检索参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | ✅ | 检索文本 |
| `mode` | string | 否 | `naive` / `local` / `global` / `hybrid`（默认 `hybrid`） |
| `targetNamespace` | string | ✅ | 目标命名空间（通常为 `knowledge`） |
| `targetDatabase` | string | ✅ | 目标数据库名（从 graph-tables 获取） |
| `graphTableBase` | string | ✅ | 图谱表前缀（从 graph-tables 获取） |
| `chunkTableName` | string | 否 | 文本块表名（naive 模式需要） |
| `embeddingConfig` | object | ✅ | 嵌入模型配置 |
| `embeddingConfig.providerId` | string | ✅ | 模型提供商 ID（从 models 获取） |
| `embeddingConfig.modelId` | string | ✅ | 模型 ID（从 models 获取） |
| `embeddingConfig.dimensions` | number | ✅ | 向量维度（必须匹配建库时的维度） |
| `keywordExtraction` | object | 否 | 关键词提取配置（local/global/hybrid 模式） |
| `keywordExtraction.useLLM` | boolean | 否 | 是否使用 LLM 提取关键词 |
| `keywordExtraction.llmProviderId` | string | 否 | LLM 提供商 ID |
| `keywordExtraction.llmModelId` | string | 否 | LLM 模型 ID |
| `keywordExtraction.manualHighKeywords` | string | 否 | 手动指定的高级关键词（逗号分隔） |
| `keywordExtraction.manualLowKeywords` | string | 否 | 手动指定的低级关键词（逗号分隔） |
| `vectorSearch` | object | 否 | 向量搜索参数 |
| `vectorSearch.entityTopK` | number | 否 | 实体 TopK（默认 20） |
| `vectorSearch.relationTopK` | number | 否 | 关系 TopK（默认 20） |
| `vectorSearch.chunkTopK` | number | 否 | 文本块 TopK（默认 60） |
| `graphTraversal` | object | 否 | 图遍历参数 |
| `graphTraversal.maxDepth` | number | 否 | 最大遍历深度（默认 1） |
| `graphTraversal.maxNeighbors` | number | 否 | 每层最大邻居数（默认 10） |
| `rerank` | object | 否 | 重排配置 |
| `tokenBudget` | number | 否 | Token 预算限制 |

**KG 检索响应示例**:

```json
{
  "success": true,
  "data": {
    "entities": [...],
    "relations": [...],
    "chunks": [...],
    "meta": {
      "mode": "hybrid",
      "durationMs": 3200,
      "extractedKeywords": {
        "highLevel": ["基因调控", "分子生物学"],
        "lowLevel": ["转录因子", "启动子", "增强子"]
      }
    }
  }
}
```

---

## 检索模式对比

| 模式 | 向量检索 | LLM 关键词 | 图遍历 | 适用场景 |
|------|---------|-----------|--------|---------|
| `naive` | ✅ 文本块 | ❌ | ❌ | 快速检索，不依赖图谱 |
| `local` | ✅ 实体+文本块 | ✅ | ✅ | 精准检索，利用图谱关系 |
| `global` | ❌ | ✅ | ✅ | 全局语义理解 |
| `hybrid` | ✅ 全部 | ✅ | ✅ | 综合效果最佳（推荐） |

---

## 典型调用流程

```
1. GET  /api/v1/status                              ← 确认服务可用
2. GET  /api/v1/kg/knowledge-bases                   ← 发现知识库
3. GET  /api/v1/kg/knowledge-bases/:id/graph-tables  ← 获取图谱表信息
4. GET  /api/v1/kg/models                            ← 获取可用模型
5. POST /api/v1/kg/retrieval                         ← 执行检索
```

---

## 安全说明

- **API Key 注入**: 外部调用只需传 `providerId` + `modelId`，Main 进程自动注入 API Key 和 Base URL
- **CORS**: 默认允许所有来源（`Access-Control-Allow-Origin: *`）
- **仅本地**: 默认绑定 `localhost`，不对外网暴露
- **超时**: KG 检索请求超时 120 秒，普通请求默认超时

## 错误码

| 错误码 | HTTP 状态 | 说明 |
|--------|----------|------|
| `INVALID_PARAM` | 400 | 参数校验失败 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `DB_NOT_CONNECTED` | 503 | 数据库未连接 |
| `MODEL_LIST_FAILED` | 500/503 | 模型列表获取失败 |
| `RETRIEVAL_FAILED` | 500 | 向量检索失败 |
| `KG_RETRIEVAL_FAILED` | 500 | KG 检索失败 |
| `INTERNAL_ERROR` | 500 | 内部错误 |
