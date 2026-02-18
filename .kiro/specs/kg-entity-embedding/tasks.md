# 实现计划：知识图谱实体向量索引层

## 概述

基于已批准的需求和设计文档，将实现分为：类型定义 → Schema 扩展 → Upsert 修改 → EmbeddingScheduler 核心 → IPC 集成 → 主进程桥接 → 前端监控 UI → 配置扩展。每个阶段包含实现和可选测试子任务。

## 任务

- [ ] 1. IPC 类型定义与配置类型扩展
  - [ ] 1.1 在 `knowledge-graph-ipc.types.ts` 中新增嵌入相关 IPC 消息类型
    - 新增 `KGTriggerEmbeddingParams` 接口（targetNamespace, targetDatabase, graphTableBase, baseUrl, apiKey, model, dimensions, batchSize, maxTokens）
    - 新增 `KGEmbeddingProgressData` 接口（state, completed, pending, total, hnswIndexReady, lastError, lastBatchInfo）
    - 在 `MainToKGMessage` 联合类型中新增 `kg:trigger-embedding` 和 `kg:query-embedding-status`
    - 在 `KGToMainMessage` 联合类型中新增 `kg:embedding-progress` 和 `kg:embedding-status`
    - _需求: 7.1, 7.2, 7.3, 10.5_

  - [ ] 1.2 在 `knowledge-config.types.ts` 的 `KnowledgeGraphModelConfig` 中新增 `embeddingBatchSize?: number` 和 `embeddingMaxTokens?: number` 字段
    - _需求: 10A.1_

- [ ] 2. Entity Schema 扩展与 Upsert 修改
  - [ ] 2.1 修改 `graph-schema/index.ts`，在 entity 表 Schema 中新增 embedding/embedding_hash/embedding_at 字段定义
    - 使用 `DEFINE FIELD IF NOT EXISTS` 确保幂等性
    - embedding: `option<array<float>>`，embedding_hash: `string DEFAULT ''`，embedding_at: `option<datetime>`
    - _需求: 1.1, 1.2, 11.2_

  - [ ] 2.2 修改 `graph-upsert.ts`，在 entity UPSERT 语句中追加 `embedding = NONE, embedding_hash = ''`
    - 确保描述追加和新建两种路径都会清空/保持嵌入状态
    - _需求: 2.1, 2.2_

  - [ ]* 2.3 为 upsert 嵌入状态清空逻辑编写属性测试
    - **Property 1: Upsert 后嵌入状态正确性**
    - **验证: 需求 2.1, 2.2**

- [ ] 3. EmbeddingScheduler 核心实现
  - [ ] 3.1 新建 `core/embedding-scheduler.ts`，实现 EmbeddingScheduler 类骨架
    - 定义 EmbeddingConfig、TargetInfo、SchedulerState、BatchResult、EmbeddingStatus 接口
    - 实现构造函数、start()、stop()、trigger()、getStatus()
    - 实现状态机：idle（5s 轮询）→ active → indexing → idle，含 error 状态
    - 实现 setState() 方法，输出状态切换日志（前后状态、触发原因、队列长度）
    - _需求: 3.1, 3.2, 3.3, 3.4, 3.6, 10.1_

  - [ ] 3.2 实现 `buildEmbeddingText` 纯函数
    - 按 `\n---\n` 分段，从头累加到 maxTokens*4 字符，格式化为 `{name}: {text}`
    - _需求: 4.1, 4.2, 4.3_

  - [ ]* 3.3 为 buildEmbeddingText 编写属性测试
    - **Property 2: 嵌入文本构造正确性**
    - **验证: 需求 4.1, 4.2, 4.3**

  - [ ] 3.4 实现 `callEmbeddingAPI` 方法
    - 使用 fetch + AbortController 调用 /v1/embeddings，参考 task-scheduler.ts 的 callOpenAIChat 模式
    - 30s 超时，错误处理（HTTP 错误、超时、空响应）
    - _需求: 5.1, 5.2_

  - [ ] 3.5 实现 `scanPendingEntities`、`processBatch`、`writeBatchToDb` 方法
    - scanPendingEntities: 在目标库中查询 `WHERE embedding IS NONE LIMIT batchSize`
    - processBatch: 构造嵌入文本 → 调用 API → 计算 hash → 批量写入
    - writeBatchToDb: 拼接所有 UPDATE 语句一次性执行（原子性），仅在向量数组完整时写入
    - 输出批次摘要日志（成功/失败/耗时/剩余）
    - _需求: 3.5, 5.3, 3A.3, 10.2, 10.3_

  - [ ] 3.6 实现 `ensureHnswIndex` 方法
    - 使用内存 Set 缓存已创建索引的表名
    - 执行 `DEFINE INDEX IF NOT EXISTS ... HNSW DIMENSION {dim} DIST COSINE CONCURRENTLY`
    - 失败时记录日志但不阻塞
    - _需求: 6.1, 6.2, 6.3_

  - [ ] 3.7 实现 poll() 主循环
    - idle 态：5s 轮询，扫描未嵌入实体，有则切换到 active
    - active 态：快速循环处理批次，完成后再扫描，无则进入 indexing
    - indexing 态：调用 ensureHnswIndex，完成后回到 idle
    - 每次循环发送 kg:embedding-progress 消息
    - _需求: 3.2, 3.3, 3.5, 3A.1, 3A.2_

  - [ ]* 3.8 为状态机转换编写属性测试
    - **Property 7: 状态机转换合法性**
    - **验证: 需求 3.2**

- [ ] 4. Checkpoint - 确保核心模块编译通过
  - 确保所有测试通过，如有问题请向用户确认。

- [ ] 5. IPC 集成与消息路由
  - [ ] 5.1 修改 `message-handler.ts`，新增 EmbeddingScheduler 依赖注入和消息路由
    - 构造函数新增 embeddingScheduler 参数
    - handle() 中新增 `kg:trigger-embedding` → embeddingScheduler.trigger()
    - handle() 中新增 `kg:query-embedding-status` → embeddingScheduler.getStatus() → sendMessage
    - _需求: 7.4_

  - [ ] 5.2 修改 `entry.ts`，初始化 EmbeddingScheduler 并注入到 MessageHandler
    - 创建 EmbeddingScheduler 实例
    - 传入 MessageHandler 构造函数
    - 调用 embeddingScheduler.start()
    - _需求: 3.1_

- [ ] 6. 主进程桥接层扩展
  - [ ] 6.1 修改 `knowledge-graph-bridge/index.ts`，新增嵌入相关方法和消息处理
    - 新增 triggerEmbedding(params) 方法
    - 新增 queryEmbeddingStatus() 方法
    - 在 handleMessage 中处理 kg:embedding-progress 和 kg:embedding-status
    - 新增 onEmbeddingProgress 事件监听器
    - _需求: 7.1, 7.2, 7.3_

  - [ ] 6.2 在主进程中实现 build-completed → trigger-embedding 的自动触发逻辑
    - 在 onBuildCompleted 回调中，根据 KnowledgeGraphModelConfig.embeddingConfigId 查找 EmbeddingModelConfig
    - 取 candidates[0] 的 providerId/modelId，查找对应 provider 的 baseUrl/apiKey
    - 构造 KGTriggerEmbeddingParams 并调用 triggerEmbedding
    - _需求: 8.1, 8.2_

- [ ] 7. Preload API 扩展
  - [ ] 7.1 在 preload 层新增嵌入状态查询 API
    - 新增 queryEmbeddingStatus() 方法暴露给渲染进程
    - 新增 onEmbeddingProgress 事件监听暴露给渲染进程
    - _需求: 7.3, 9.2_

- [ ] 8. 前端监控 UI
  - [ ] 8.1 在 KgMonitorCard 中新增嵌入状态监控区域
    - 状态指示灯（idle=绿色、active=蓝色闪烁、error=红色）
    - 进度条（已完成/总数）
    - HNSW 索引状态标签
    - 最近批次摘要（成功/失败/耗时）
    - 最近错误信息（可折叠）
    - 0.5s 间隔轮询 kg:query-embedding-status
    - 根容器定位类：`tm-kg-embedding-monitor-xxxx`
    - _需求: 9.1, 9.2, 9.3, 9.4, 9.5, 10.4_

- [ ] 9. 配置 Store 适配
  - [ ] 9.1 修改 `knowledge-config.store.ts` 的 createKgConfig 方法，为新建 KG 配置填充 embeddingBatchSize=20 和 embeddingMaxTokens=1500 默认值
    - _需求: 10A.2, 10A.3_

- [ ] 10. 最终 Checkpoint
  - 确保所有测试通过，TypeScript 编译无错误，如有问题请向用户确认。

## 备注

- 标记 `*` 的子任务为可选测试任务，可跳过以加速 MVP
- 每个任务引用了具体的需求编号以便追溯
- 属性测试使用 `fast-check` 库，每个属性至少 100 次迭代
- Checkpoint 任务用于阶段性验证，确保增量正确性
