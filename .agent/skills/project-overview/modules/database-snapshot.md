# 数据库结构快照

> **快照时间**：2026-02-24
> **注意**：此文件是某个时间点的快照，数据库结构可能已变更。如需确认最新状态，请使用 SurrealDB MCP 工具执行 `INFO FOR DB` / `INFO FOR TABLE`，或读取 `KnowledgeDatabase-src/src/main/services/surrealdb-service/schema/tables.ts`。

## 命名空间：`knowledge`

该命名空间下包含 1 个系统库 + N 个知识库实例库（每个知识库对应一个独立数据库）。

---

## 一、`system` 数据库 — 全局系统库

管理用户、文档、任务调度、缓存、日志等全局数据。

### 1.1 `user` — 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| username | string | 用户名（3-50字符，UNIQUE） |
| email | string | 邮箱（email 格式校验，UNIQUE） |
| password_hash | string | 密码哈希 |
| is_active | bool | 是否激活，默认 true |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间（自动） |

### 1.2 `document` — 文档表

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 标题（1-200字符，NOT NONE） |
| content | string | 内容，默认空串 |
| author | option\<record\<user\>\> | 作者关联 |
| tags | array | 标签数组，默认 [] |
| is_deleted | bool | 软删除标记 |
| created_at | datetime | 创建时间（有索引） |
| updated_at | datetime | 更新时间（自动） |

### 1.3 `kg_task` — 知识图谱提取任务

管理从文档中提取知识图谱的任务。

| 字段 | 类型 | 说明 |
|------|------|------|
| file_key | string | 文件标识 |
| status | string | 状态：pending/progressing/paused/completed/failed |
| chunks_total | int | 总分块数 |
| chunks_total_origin | int | 原始总分块数 |
| chunks_completed | int | 已完成分块数 |
| chunks_failed | int | 失败分块数 |
| config | object (FLEXIBLE) | 任务配置 |
| source_namespace | string | 源命名空间 |
| source_database | string | 源数据库 |
| source_table | string | 源表名 |
| target_namespace | option\<string\> | 目标命名空间 |
| target_database | option\<string\> | 目标数据库 |
| target_table_base | option\<string\> | 目标表名基础 |

### 1.4 `kg_chunk` — KG 提取分块

| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | string | 关联任务 ID |
| chunk_index | int | 分块序号 |
| content | string | 分块内容 |
| status | string | pending/progressing/paused/completed/failed |
| result | object (FLEXIBLE) | 提取结果 |
| cache_hit | option\<bool\> | 是否命中缓存 |
| cache_key | option\<string\> | 缓存键 |
| extracted_at | option\<datetime\> | 提取完成时间 |
| error | option\<string\> | 错误信息 |

### 1.5 `kg_build_task` — KG 构建任务

将提取结果写入目标知识图谱库的任务。

| 字段 | 类型 | 说明 |
|------|------|------|
| file_key | string | 文件标识 |
| source_task_id | string | 源提取任务 ID |
| status | string | pending/progressing/completed/failed |
| chunks_total / completed / failed | int | 分块进度 |
| entities_upserted | int | 已写入实体数 |
| relations_upserted | int | 已写入关系数 |
| target_namespace / database / table_base | string | 目标位置 |
| config | object (FLEXIBLE) | 构建配置 |

### 1.6 `kg_build_chunk` — KG 构建分块

| 字段 | 类型 | 说明 |
|------|------|------|
| task_id | string | 关联构建任务 ID |
| chunk_index | int | 分块序号 |
| cache_key | string | 缓存键 |
| status | string | pending/progressing/completed/failed |
| entities_count | int | 实体数量 |
| relations_count | int | 关系数量 |
| error | option\<string\> | 错误信息 |

### 1.7 `kg_llm_result_cache` — LLM 结果缓存

| 字段 | 类型 | 说明 |
|------|------|------|
| cache_key | string | 缓存键（UNIQUE） |
| cache_type | string | 缓存类型 |
| return | string | 缓存的 LLM 返回结果 |
| create_time | datetime | 创建时间 |

### 1.8 `operation_log` — 操作日志

| 字段 | 类型 | 说明 |
|------|------|------|
| action | string | CREATE/UPDATE/DELETE/SELECT/QUERY |
| table_name | string | 操作的表名 |
| query | string | 执行的查询 |
| params | option\<object\> | 查询参数 |
| result_count | option\<number\> | 结果数量 |
| source | string | 来源，默认 'electron_backend' |
| timestamp | datetime | 时间戳 |

### 1.9 `vector_staging` — 向量暂存表（SCHEMALESS）

暂存待转移到 HNSW 索引表的向量数据。由 `VectorStagingService` 写入，`StagingPoller`（vector-indexer 子进程）轮询消费。

索引：`idx_staging_processed` on `processed` 字段

常用键（代码中定义，非 Schema 强制）：
- `embedding` — 向量数据
- `embedding_config_id` — 嵌入配置 ID
- `dimensions` — 向量维度
- `target_database` — 目标数据库
- `document_id` — 文档 ID
- `chunk_index` — 分块序号
- `content` — 文本内容
- `processed` — 是否已处理

---

## 二、知识库实例数据库（动态创建）

每个知识库对应一个独立数据库（库名 = 知识库名称）。以下以 `temp2` 为例，embedding config 为 `cfg_1771729907891_4096`。

### 2.1 `kb_document` — 知识库文档表（SCHEMAFULL）

| 字段 | 类型 | 说明 |
|------|------|------|
| file_key | string | 文件标识（UNIQUE） |
| file_name | string | 文件名 |
| file_path | string | 文件路径 |
| file_type | string | 文件类型 |
| created_at | datetime | 创建时间 |
| updated_at | datetime | 更新时间（自动） |

### 2.2 `kb_document_embedding` — 文档嵌入状态表（SCHEMALESS）

跟踪每个文档的嵌入处理状态。

常用键：`file_key`、`embedding_config_id`、`dimensions`、`status`、`chunk_count`

### 2.3 `emb_{configId}_{dimensions}_chunks` — 向量分块表（SCHEMALESS，动态表名）

存储文档分块的向量嵌入，带 HNSW 索引。

- 索引：`hnsw_embedding` — HNSW DIMENSION {dimensions} DIST COSINE
- 索引：`uniq_doc_chunk` — UNIQUE on (document, chunk_index)
- 常用键：`embedding`、`document`、`chunk_index`、`file_key`、`content`

### 2.4 `kg_{configId}_{dimensions}_entity` — 知识图谱实体表（SCHEMAFULL）

| 字段 | 类型 | 说明 |
|------|------|------|
| entity_name | string | 实体名称（UNIQUE） |
| entity_type | string | 实体类型 |
| description | string | 描述 |
| file_keys | array\<string\> | 来源文件 |
| source_ids | array\<string\> | 来源 ID |
| embedding | option\<array\<float\>\> | 实体向量（HNSW 索引） |
| embedding_hash | string | 嵌入哈希（用于判断是否需要重新嵌入） |
| embedding_at | option\<datetime\> | 嵌入时间 |
| meta | object (FLEXIBLE) | 元数据 |

### 2.5 `kg_{configId}_{dimensions}_relates` — 知识图谱关系表（RELATION, SCHEMAFULL）

类型：`RELATION IN entity OUT entity`

| 字段 | 类型 | 说明 |
|------|------|------|
| in | record\<entity\> | 源实体 |
| out | record\<entity\> | 目标实体 |
| description | string | 关系描述 |
| keywords | string | 关键词 |
| weight | float | 权重，默认 1.0 |
| file_keys | array\<string\> | 来源文件 |
| source_ids | array\<string\> | 来源 ID |
| meta | object (FLEXIBLE) | 元数据 |

### 2.6 `kg_{configId}_{dimensions}_entity_chunks` — 实体-分块映射

| 字段 | 类型 | 说明 |
|------|------|------|
| entity_name | string | 实体名称（UNIQUE） |
| chunk_ids | array\<string\> | 关联的分块 ID 列表 |

### 2.7 `kg_{configId}_{dimensions}_relation_chunks` — 关系-分块映射

| 字段 | 类型 | 说明 |
|------|------|------|
| relation_key | string | 关系键（UNIQUE） |
| chunk_ids | array\<string\> | 关联的分块 ID 列表 |

---

## 三、当前实例一览（快照时间 2026-02-24）

| 数据库名 | 类型 | embedding config | 备注 |
|----------|------|-----------------|------|
| system | 系统库 | — | 全局数据 |
| temp2 | 知识库实例 | cfg_1771729907891_4096 | SCHEMAFULL，较新 |
| test1 | 知识库实例 | cfg_1770654996316_4096 | SCHEMALESS，早期测试数据 |
