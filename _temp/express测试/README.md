# Express API 测试

## 使用说明

### 1. 启动应用
首先启动 Electron 应用:
```bash
cd ../KnowledgeDatabase-src
pnpm run dev
```

### 2. 等待 API 服务器启动
在应用启动日志中查看以下信息:
```
[ApiServer] HTTP server started on http://0.0.0.0:3721
```

### 3. 运行测试脚本
```bash
node test-api.js
```

## 测试内容

### 测试用例列表

| 序号 | 测试项 | 端点 | 预期结果 |
|------|--------|------|----------|
| 1 | 服务状态检查 | `GET /api/v1/status` | 返回服务运行状态 |
| 2 | 获取所有知识库 | `GET /api/v1/knowledge-bases` | 返回知识库列表 |
| 3 | 获取知识库详情 | `GET /api/v1/knowledge-bases/:id` | 返回指定知识库详情 |
| 4 | 不存在的知识库 | `GET /api/v1/knowledge-bases/99999` | 返回 404 错误 |
| 5 | 获取文档列表 | `GET /api/v1/knowledge-bases/:id/documents` | 返回文档列表和分页信息 |
| 6 | 获取文档嵌入状态 | `GET /api/v1/knowledge-bases/:id/documents/:fileKey/embeddings` | 返回文档嵌入配置列表 |
| 7 | 无效的 ID | `GET /api/v1/knowledge-bases/abc` | 返回 400 错误 |
| 8 | 不存在的端点 | `GET /api/v1/non-existent-endpoint` | 返回 404 错误 |

## API 端点说明

### 1. 服务状态
```
GET /api/v1/status
```
**响应:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "1.0.0",
    "uptime": 123456,
    "requestCount": 10
  }
}
```

### 2. 获取知识库列表
```
GET /api/v1/knowledge-bases
```
**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "我的知识库",
      "description": "描述",
      "docCount": 10,
      "chunkCount": 500,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastUpdated": "2024-01-02T00:00:00.000Z",
      "color": "#3B82F6",
      "icon": "<svg>...</svg>"
    }
  ]
}
```

### 3. 获取知识库详情
```
GET /api/v1/knowledge-bases/:id
```
**响应:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "我的知识库",
    "description": "描述",
    "docCount": 10,
    "chunkCount": 500,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastUpdated": "2024-01-02T00:00:00.000Z",
    "color": "#3B82F6",
    "icon": "<svg>...</svg>",
    "databaseName": "我的知识库",
    "documentPath": "kb_1_我的知识库"
  }
}
```

### 4. 获取文档列表
```
GET /api/v1/knowledge-bases/:id/documents?page=1&pageSize=20
```
**查询参数:**
- `page`: 页码 (默认: 1)
- `pageSize`: 每页数量 (默认: 20, 最大: 100)

**响应:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "kb_document:xxx",
        "fileKey": "folder/file.pdf",
        "fileName": "file.pdf",
        "fileType": "pdf",
        "chunkCount": 50,
        "embeddingStatus": "completed",
        "embeddingModel": "text-embedding-3-large",
        "embeddingDimensions": 3072,
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 100,
      "page": 1,
      "pageSize": 20,
      "totalPages": 5
    }
  }
}
```

### 5. 获取文档嵌入状态
```
GET /api/v1/knowledge-bases/:id/documents/:fileKey/embeddings
```
**注意:** `fileKey` 需要 URL 编码

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "fileKey": "folder/file.pdf",
      "embeddingConfigId": "cfg_1234567890",
      "dimensions": 3072,
      "status": "completed",
      "chunkCount": 50,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细信息"
  }
}
```

### 常见错误代码
| 错误码 | 含义 | HTTP 状态 |
|--------|------|-----------|
| `INVALID_ID` | 无效的 ID | 400 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `NO_DATABASE` | 知识库没有数据库 | 500 |
| `DB_NOT_CONNECTED` | 数据库未连接 | 503 |
| `INTERNAL_ERROR` | 内部错误 | 500 |

## 使用 curl 测试

### 获取服务状态
```bash
curl http://localhost:3721/api/v1/status
```

### 获取知识库列表
```bash
curl http://localhost:3721/api/v1/knowledge-bases
```

### 获取知识库详情
```bash
curl http://localhost:3721/api/v1/knowledge-bases/1
```

### 获取文档列表 (带分页)
```bash
curl "http://localhost:3721/api/v1/knowledge-bases/1/documents?page=1&pageSize=10"
```

### 获取文档嵌入状态
```bash
# 注意: 需要对 fileKey 进行 URL 编码
curl "http://localhost:3721/api/v1/knowledge-bases/1/documents/folder%2Ffile.pdf/embeddings"
```

## 故障排查

### 服务无法连接
1. 检查 Electron 应用是否正常启动
2. 查看应用日志中是否有 API 服务器启动成功的消息
3. 确认端口 3721 没有被其他程序占用

### 测试失败
1. 确保数据库中有知识库数据
2. 检查 SurrealDB 服务是否正常运行
3. 查看应用日志中的错误信息

### 数据库未连接
如果看到 `DB_NOT_CONNECTED` 错误:
1. 检查 SurrealDB 是否成功启动
2. 查看 API Server 日志中的数据库连接信息
3. 确认数据库连接配置正确
