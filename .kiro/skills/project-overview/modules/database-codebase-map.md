# 数据库相关代码模块地图与查询指引

> 当 `database-snapshot.md` 过时时，使用本文件中的代码路径和 Devin 查询词来获取最新信息。

## 一、核心代码模块

### 1.1 Schema 定义（表结构的源头）

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema/tables.ts` | 所有 `DEFINE TABLE` / `DEFINE FIELD` / `DEFINE INDEX` 的 SurrealQL 语句 |
| `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema/index.ts` | Schema 导出入口，分为通用 Schema (`schemas`) 和知识库专用 Schema (`knowledgeBaseSchemas`) |
| `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema-manager.ts` | Schema 初始化执行器，在 SurrealDB 启动时执行 DEFINE 语句 |

### 1.2 QueryService 架构

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/Public/SharedUtils/surrealdb-query.ts` | **核心查询器**，封装 WebSocket 连接、query/queryInDatabase、操作日志记录。主进程和 Utility 进程共用 |
| `KnowledgeDatabase-src/src/main/services/surrealdb-service/query-service.ts` | 主进程的 QueryService，是 `surrealdb-query.ts` 的薄代理 |

架构关系：
```
QueryService (main process 代理)
  └─ SurrealDBQueryService (surrealdb-query.ts, 共享实现)
       ├─ 主进程使用
       └─ Utility 进程也可独立实例化使用
```

`queryInDatabase(db, sql, params)` 方法可以在不切换当前连接的情况下查询指定数据库，避免并发竞态。

### 1.3 知识库管理（动态创建数据库和表）

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/main/services/knowledgeBase-library/` | 知识库 CRUD 服务，创建知识库时动态创建数据库 + 初始化表 |

创建流程：
1. `DEFINE DATABASE \`${name}\`` — 在 knowledge 命名空间下创建新库
2. 在新库中执行 `kbDocumentTable.sql` — 初始化 `kb_document` 表
3. 后续的 embedding 表和 KG 表在配置嵌入/构建图谱时动态创建

### 1.4 动态表名生成

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/main/services/knowledgeBase-library/` | `getChunksTableName(configId, dimensions)` 生成向量表名 |
| `KnowledgeDatabase-src/src/renderer/src/stores/knowledge-library/knowledge-config.store.ts` | 前端生成 `graphTableBase`（KG 表名前缀） |

命名规则：
- 向量分块表：`emb_{safeConfigId}_{dimensions}_chunks`
- KG 实体表：`kg_{safeConfigId}_{dimensions}_entity`
- KG 关系表：`kg_{safeConfigId}_{dimensions}_relates`
- KG 实体分块映射：`kg_{safeConfigId}_{dimensions}_entity_chunks`
- KG 关系分块映射：`kg_{safeConfigId}_{dimensions}_relation_chunks`

其中 `safeConfigId` = configId 中非字母数字字符替换为下划线。

### 1.5 向量处理流水线

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/utility/vector-indexer/` | 向量索引子进程，含 `StagingPoller`（轮询 vector_staging）和 `TransferWorker`（写入 HNSW 表） |
| `KnowledgeDatabase-src/src/main/services/vector-indexer-bridge/` | `VectorIndexerBridge` — 主进程与 vector-indexer 的通信桥 |
| `KnowledgeDatabase-src/src/main/services/vector-staging/` | `VectorStagingService` — 向量暂存写入服务 |

数据流：
```
文档 → embedding-engine(生成向量) → vector_staging(暂存)
  → StagingPoller(轮询) → TransferWorker(创建HNSW表+写入) → emb_xxx_chunks
```

### 1.6 知识图谱处理流水线

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/utility/Knowledge-graph/` | KG 构建子进程，从文档分块中提取实体和关系 |
| `KnowledgeDatabase-src/src/main/services/knowledge-graph-bridge/` | `KnowledgeGraphBridge` — 主进程与 KG 子进程的通信桥 |
| `KnowledgeDatabase-src/src/main/services/knowledge-graph-monitor/` | KG 构建任务监控 |

数据流：
```
文档分块(kg_chunk) → LLM提取(实体+关系) → kg_build_task/chunk(构建任务)
  → 写入目标库的 entity/relates/entity_chunks/relation_chunks 表
```

### 1.7 IPC 与服务注入

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/main/services/base-service/app-service.ts` | 服务实例的统一创建和依赖注入中心 |
| `KnowledgeDatabase-src/src/main/ipc/index.ts` | IPCManager，注册所有 IPC Handler |
| `KnowledgeDatabase-src/src/main/index.ts` | 应用入口，串联 AppService → IPCManager |

### 1.8 类型定义

| 路径 | 职责 |
|------|------|
| `KnowledgeDatabase-src/src/preload/types/` | 跨进程类型的唯一权威来源 |
| `KnowledgeDatabase-src/src/Public/ShareTypes/` | IPC 消息协议类型 |

---

## 二、Devin 查询指引

当快照过时或需要了解最新实现细节时，使用以下查询词向 Devin 提问：

### Schema 与表结构

```
"tables.ts 中定义了哪些表？每个表的字段和索引是什么？"
"SchemaManager 是如何初始化数据库 Schema 的？"
"knowledgeBaseSchemas 包含哪些表定义？"
```

### 动态表名

```
"getChunksTableName 函数的实现逻辑是什么？"
"graphTableBase 是如何生成的？在哪些地方使用？"
"动态创建的 HNSW 索引表的完整 DEFINE 语句是什么？"
```

### 向量处理

```
"StagingPoller 的轮询逻辑和 TransferWorker 的写入逻辑"
"vector_staging 表的数据是如何写入和消费的？"
"VectorStagingService 和 VectorStagingRecord 的定义"
```

### 知识图谱

```
"知识图谱构建的完整流程，从 kg_task 到 entity/relates 表"
"KG 实体向量嵌入是如何实现的？embedding_hash 的作用"
"entity_chunks 和 relation_chunks 映射表的用途和写入逻辑"
```

### 知识库生命周期

```
"KnowledgeLibraryService.create() 的完整流程"
"知识库删除时如何清理数据库和文件？"
"kb_document 和 kb_document_embedding 的关系"
```

### QueryService 架构

```
"surrealdb-query.ts 的 queryInDatabase 方法如何避免并发竞态？"
"QueryService 在主进程和 Utility 进程中的使用方式有何不同？"
"操作日志 operation_log 是在哪里记录的？"
```
