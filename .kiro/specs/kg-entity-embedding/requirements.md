# 需求文档：知识图谱实体向量索引层

## 简介

为知识图谱实体添加向量嵌入（Embedding）能力，支持语义检索。在现有的图谱构建流水线（文档 → LLM 抽取 → 图谱 UPSERT）完成后，新增 EmbeddingScheduler 阶段，自动扫描未嵌入的实体、调用嵌入 API 生成向量、写回数据库并创建 HNSW 索引。同时在前端 TaskMonitorView 中新增嵌入状态监控卡片。

## 术语表

- **EmbeddingScheduler**：常驻单例调度器，运行在 Knowledge-graph 子进程中，维护纯内存任务队列，负责扫描、批量嵌入、写回向量。
- **Entity**：知识图谱中的实体记录，存储在 `{graphTableBase}_entity` 表中，包含 entity_name、entity_type、description 等字段。
- **HNSW 索引**：SurrealDB 提供的近似最近邻索引类型，用于高效向量相似度检索。
- **GraphBuildScheduler**：现有的第二阶段调度器，负责从 LLM 缓存解析结果并 UPSERT 到图谱表。
- **KGSurrealClient**：子进程专用的 SurrealDB 客户端，支持 query 和 queryInDatabase（跨库查询）。
- **MessageHandler**：子进程消息路由器，处理 Main ↔ KG 之间的 IPC 消息分发。
- **KnowledgeGraphModelConfig**：知识图谱模型配置，包含 LLM 和嵌入相关的配置参数。
- **EmbeddingModelConfig**：嵌入模型配置，包含 candidates（providerId/modelId）和 dimensions。
- **embedding_hash**：描述内容的哈希值，用于检测实体描述是否发生变更。
- **TaskMonitorView**：前端任务监控页面，展示各类后台任务的运行状态。

## 需求

### 需求 1：实体 Schema 扩展

**用户故事：** 作为系统开发者，我希望实体表包含向量嵌入相关字段，以便存储和管理实体的向量数据。

#### 验收标准

1. THE Graph_Schema_Service SHALL 在 entity 表定义中新增 `embedding`（`array<float> | NONE`）、`embedding_hash`（`string`，默认空字符串）、`embedding_at`（`datetime | NONE`）三个字段。
2. WHEN 新的图谱 Schema 被创建时，THE Graph_Schema_Service SHALL 包含上述三个嵌入相关字段的定义。

### 需求 2：描述变更时清空嵌入状态

**用户故事：** 作为系统开发者，我希望实体描述被追加时自动清空嵌入状态，以便 EmbeddingScheduler 能检测到需要重新嵌入的实体。

#### 验收标准

1. WHEN graph-upsert 对已有实体执行描述追加操作时，THE Graph_Upsert_Service SHALL 将该实体的 `embedding` 设为 NONE、`embedding_hash` 设为空字符串。
2. WHEN graph-upsert 对新实体执行首次插入时，THE Graph_Upsert_Service SHALL 保持 `embedding` 为 NONE、`embedding_hash` 为空字符串（Schema 默认值）。

### 需求 3：EmbeddingScheduler 核心调度与状态机

**用户故事：** 作为系统开发者，我希望有一个常驻单例调度器自动处理实体嵌入任务，具备完整的状态机和中断恢复能力，以便图谱构建完成后自动生成向量索引。

#### 验收标准

1. THE EmbeddingScheduler SHALL 作为常驻单例运行在 Knowledge-graph 子进程中，维护纯内存任务队列（不建中间表）。
2. THE EmbeddingScheduler SHALL 实现以下状态机循环：idle（静息态，5 秒低频轮询）→ 检测到 `embedding IS NONE` 的实体 → active（高频处理）→ 按 batchSize 分批嵌入 → 当前批次完成后再次扫描 → 若仍有未嵌入实体则继续处理 → 所有实体处理完毕 → 创建 HNSW 索引 → 回到 idle。
3. WHILE EmbeddingScheduler 处于 idle 状态时，THE EmbeddingScheduler SHALL 以 5 秒间隔轮询目标知识库，检测是否有新的 `embedding IS NONE` 的实体。
4. WHEN 外部触发（如 GraphBuildScheduler 完成或收到 `kg:trigger-embedding` 消息）时，THE EmbeddingScheduler SHALL 立即从 idle 切换到 active 状态，无需等待下一次轮询。
5. WHEN EmbeddingScheduler 处于 active 状态且当前批次处理完成时，THE EmbeddingScheduler SHALL 再次扫描未嵌入实体，若仍有则继续处理下一批次。
6. THE EmbeddingScheduler SHALL 维护 idle、active、error 三种状态，仅在状态切换和错误时输出日志。

### 需求 3A：中断恢复与数据安全

**用户故事：** 作为系统开发者，我希望 EmbeddingScheduler 在进程中断后能无损恢复，以便保证数据一致性。

#### 验收标准

1. WHEN 子进程中断或重启时，THE EmbeddingScheduler SHALL 丢弃当前内存中未写入数据库的批次数据（因为嵌入结果是逐批写入数据库的，未写入的批次可安全丢弃）。
2. WHEN 子进程重启后 EmbeddingScheduler 初始化时，THE EmbeddingScheduler SHALL 通过扫描 `embedding IS NONE` 的实体自动恢复未完成的嵌入任务，无需额外的恢复逻辑。
3. THE EmbeddingScheduler SHALL 仅在一批实体的向量全部成功获取后，才批量写入数据库（原子性写入），确保不会出现部分写入的脏数据。

### 需求 4：描述截断与嵌入文本构造

**用户故事：** 作为系统开发者，我希望实体描述在嵌入前按合理策略截断，以便在 token 限制内获得最佳嵌入质量。

#### 验收标准

1. WHEN 构造嵌入文本时，THE EmbeddingScheduler SHALL 将实体描述按 `\n---\n` 分隔符分段。
2. WHEN 分段后，THE EmbeddingScheduler SHALL 从头依次累加段落，直到总字符数超过 `maxTokens * 4`（约 maxTokens 个 token），超过阈值的段落不加入。
3. THE EmbeddingScheduler SHALL 将截断后的文本以 `{entity_name}: {truncated_description}` 格式作为嵌入输入。

### 需求 5：嵌入 API 调用

**用户故事：** 作为系统开发者，我希望通过 OpenAI 兼容格式调用嵌入 API，以便支持多种嵌入模型提供商。

#### 验收标准

1. THE EmbeddingScheduler SHALL 使用 OpenAI 兼容格式（`/v1/embeddings`）调用嵌入 API，参考 task-scheduler.ts 中的 fetch + AbortController 模式。
2. WHEN 调用嵌入 API 时，THE EmbeddingScheduler SHALL 从触发消息中获取 providerId/modelId/dimensions 等配置参数（由主进程根据 KnowledgeGraphModelConfig.embeddingConfigId 解析后传入）。
3. WHEN 嵌入 API 返回成功时，THE EmbeddingScheduler SHALL 将返回的向量写入实体的 `embedding` 字段，同时更新 `embedding_hash`（描述内容的哈希）和 `embedding_at`（当前时间）。
4. IF 嵌入 API 调用失败，THEN THE EmbeddingScheduler SHALL 记录错误日志并跳过该批次中失败的实体，继续处理后续批次。

### 需求 6：HNSW 索引管理

**用户故事：** 作为系统开发者，我希望在所有实体嵌入完成后自动创建 HNSW 向量索引，以便支持高效的语义相似度检索。

#### 验收标准

1. WHEN 所有待嵌入实体处理完毕且 EmbeddingScheduler 即将回到 idle 状态时，THE EmbeddingScheduler SHALL 使用 `DEFINE INDEX ... HNSW DIMENSION {dim} DIST COSINE CONCURRENTLY` 创建 HNSW 索引。
2. THE EmbeddingScheduler SHALL 使用内存 Set 缓存已创建索引的表名，避免重复执行 DEFINE INDEX。
3. IF HNSW 索引创建失败，THEN THE EmbeddingScheduler SHALL 记录错误日志但不阻塞调度器回到 idle 状态。

### 需求 7：IPC 消息协议扩展

**用户故事：** 作为系统开发者，我希望扩展 IPC 消息协议以支持嵌入相关的通信，以便主进程能触发和监控嵌入任务。

#### 验收标准

1. THE IPC_Protocol SHALL 新增 `kg:trigger-embedding` 消息类型（Main → KG），携带目标知识库的 namespace、database、graphTableBase、嵌入配置（baseUrl、apiKey、model、dimensions）以及 batchSize、maxTokens 参数。
2. THE IPC_Protocol SHALL 新增 `kg:embedding-progress` 消息类型（KG → Main），携带已完成数、未完成数、总数、调度器状态。
3. THE IPC_Protocol SHALL 新增 `kg:query-embedding-status` 消息类型（Main → KG）和对应的 `kg:embedding-status` 响应消息类型（KG → Main），用于前端轮询嵌入状态。
4. THE MessageHandler SHALL 路由上述新增消息类型到 EmbeddingScheduler 的对应方法。

### 需求 8：GraphBuildScheduler 触发集成

**用户故事：** 作为系统开发者，我希望图谱构建完成后自动触发嵌入流程，以便实现端到端的自动化流水线。

#### 验收标准

1. WHEN GraphBuildScheduler 的 reconcileBuildTaskStatus 检测到 build task status 为 'completed' 时，THE GraphBuildScheduler SHALL 通过 sendMessage 向主进程发送信号，由主进程构造嵌入配置后发送 `kg:trigger-embedding` 消息回子进程。
2. WHEN 主进程收到 `kg:build-completed` 消息时，THE Main_Process SHALL 根据对应知识库的 KnowledgeGraphModelConfig.embeddingConfigId 查找 EmbeddingModelConfig，取 candidates[0] 的 providerId/modelId 和 dimensions，构造 `kg:trigger-embedding` 消息发送给子进程。

### 需求 11：无缝兼容已有数据

**用户故事：** 作为系统开发者，我希望嵌入功能能无缝兼容已有的图谱数据，以便存量实体也能获得向量索引。

#### 验收标准

1. WHEN EmbeddingScheduler 首次启动或进程重启后，THE EmbeddingScheduler SHALL 通过扫描 `embedding IS NONE` 自动发现所有未嵌入的存量实体，与新增实体使用相同的嵌入流程。
2. WHEN 已有实体表尚未包含 embedding/embedding_hash/embedding_at 字段时，THE Graph_Schema_Service SHALL 通过 `DEFINE FIELD IF NOT EXISTS` 语法确保字段定义的幂等性，不影响已有数据。
3. WHEN 已有实体的 embedding 字段为 NONE 时，THE EmbeddingScheduler SHALL 将其视为待嵌入实体进行处理。

### 需求 9：嵌入状态监控 UI

**用户故事：** 作为用户，我希望在任务监控页面看到嵌入任务的实时状态，以便了解向量索引构建的进度。

#### 验收标准

1. THE TaskMonitorView SHALL 在现有 KgMonitorCard 中新增嵌入状态监控区域，展示嵌入任务进度（已完成/未完成/总数）、HNSW 索引构建状态、EmbeddingScheduler 状态（idle/active/error）。
2. THE Embedding_Monitor SHALL 以 0.5 秒间隔通过 `kg:query-embedding-status` IPC 消息轮询嵌入状态数据。
3. WHEN EmbeddingScheduler 状态为 idle 且无待嵌入实体时，THE Embedding_Monitor SHALL 显示"就绪"状态。
4. WHEN EmbeddingScheduler 状态为 active 时，THE Embedding_Monitor SHALL 显示进度条和已完成/总数的数值。
5. IF EmbeddingScheduler 状态为 error，THEN THE Embedding_Monitor SHALL 显示错误状态和最近的错误信息。

### 需求 10：嵌入调度器调试支持

**用户故事：** 作为系统开发者，我希望 EmbeddingScheduler 提供充分的调试信息，以便在纯内存队列模式下快速定位问题。

#### 验收标准

1. WHEN EmbeddingScheduler 状态发生切换时（idle → active、active → idle、任意 → error），THE EmbeddingScheduler SHALL 输出包含前后状态、触发原因、当前队列长度的日志。
2. WHEN 一个批次嵌入完成时，THE EmbeddingScheduler SHALL 输出该批次的处理结果摘要（成功数、失败数、耗时、剩余未嵌入数）。
3. WHEN 嵌入 API 调用失败时，THE EmbeddingScheduler SHALL 输出包含 HTTP 状态码、错误消息、失败实体名称列表的详细错误日志。
4. THE Embedding_Monitor UI SHALL 展示最近一次错误信息和最近一次批次处理的摘要信息（成功数/失败数/耗时）。
5. THE IPC_Protocol 的 `kg:embedding-status` 响应消息 SHALL 包含 lastError（最近错误信息）、lastBatchInfo（最近批次摘要）字段，供前端展示调试信息。

### 需求 10A：KnowledgeGraphModelConfig 扩展

**用户故事：** 作为系统开发者，我希望 KG 配置中包含嵌入批次大小和最大 token 数参数，以便灵活控制嵌入行为。

#### 验收标准

1. THE KnowledgeGraphModelConfig SHALL 新增 `embeddingBatchSize`（number，默认 20）和 `embeddingMaxTokens`（number，默认 1500）两个可选字段。
2. WHEN 创建新的 KG 配置时，THE Knowledge_Config_Store SHALL 使用默认值填充 embeddingBatchSize 和 embeddingMaxTokens。
3. WHEN 触发嵌入任务时，THE Main_Process SHALL 将 embeddingBatchSize 和 embeddingMaxTokens 作为参数传入 `kg:trigger-embedding` 消息。
