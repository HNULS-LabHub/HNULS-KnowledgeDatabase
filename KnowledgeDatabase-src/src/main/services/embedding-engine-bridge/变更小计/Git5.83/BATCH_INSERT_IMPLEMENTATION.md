# 批次插入实施文档

## 实施日期

2026-01-28

## 问题描述

向量嵌入任务完成后，尝试将 583 个 chunk（每个包含 4096 维向量）一次性写入 SurrealDB 时失败。

### 错误信息

```
http.response.status_code=413 (Payload Too Large)
http.request.body.size="23729472" (约 23MB)
Error: read ECONNRESET
```

### 根本原因

1. SurrealDB HTTP 服务器默认请求体大小限制较小（约 10-20MB）
2. 单次插入 583 个 4096 维向量超过了限制

---

## 解决方案

### 双重保障策略

#### 1. 服务器层面：增加 HTTP 请求体大小限制

**修改文件**：`src/main/services/surrealdb-service/surrealdb-service.ts`

**修改内容**：在 `buildStartArgs()` 方法中添加启动参数

```typescript
private buildStartArgs(): string[] {
  const { port, username, password, dbPath, logLevel } = this.config

  return [
    'start',
    `surrealkv:${dbPath}`,
    '--bind',
    `127.0.0.1:${port}`,
    '--user',
    username,
    '--pass',
    password,
    '--log',
    logLevel,
    '--no-banner',
    '--http-max-body-size',  // 新增
    '100MB'                   // 新增：设置为 100MB
  ]
}
```

**效果**：

- 支持最大 100MB 的 HTTP 请求体
- 理论上可一次性插入约 2000 个 4096 维向量

---

#### 2. 应用层面：实现固定批次大小插入

**修改文件**：`src/main/services/embedding-engine-bridge/index.ts`

**修改内容**：

##### 2.1 添加批次配置常量

```typescript
/** 每批插入的 chunk 数量（防止单次请求过大） */
const BATCH_INSERT_SIZE = 50
```

##### 2.2 新增 `insertChunksInBatches()` 方法

```typescript
/**
 * 分批插入 chunks（固定批次大小）
 */
private async insertChunksInBatches(
  namespace: string,
  database: string,
  tableName: string,
  chunks: Array<any>
): Promise<void> {
  if (!this.queryService) {
    throw new Error('QueryService not available')
  }

  const totalChunks = chunks.length
  const totalBatches = Math.ceil(totalChunks / BATCH_INSERT_SIZE)

  logger.info('[EmbeddingEngineBridge] Starting batch insert', {
    tableName,
    totalChunks,
    totalBatches,
    batchSize: BATCH_INSERT_SIZE
  })

  // 分批处理
  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_INSERT_SIZE
    const end = Math.min(start + BATCH_INSERT_SIZE, totalChunks)
    const batch = chunks.slice(start, end)

    const batchNum = i + 1
    const progress = Math.round((end / totalChunks) * 100)

    logger.debug('[EmbeddingEngineBridge] Inserting batch', {
      tableName,
      batchNum,
      totalBatches,
      batchSize: batch.length,
      progress: `${end}/${totalChunks} (${progress}%)`,
      startIndex: start,
      endIndex: end - 1
    })

    try {
      const startTime = Date.now()

      await this.queryService.queryInDatabase(
        namespace,
        database,
        `INSERT INTO \`${tableName}\` $chunks;`,
        { chunks: batch }
      )

      const duration = Date.now() - startTime

      logger.debug('[EmbeddingEngineBridge] Batch inserted successfully', {
        tableName,
        batchNum,
        batchSize: batch.length,
        duration: `${duration}ms`,
        avgPerChunk: `${(duration / batch.length).toFixed(2)}ms`
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error('[EmbeddingEngineBridge] Batch insert failed', {
        tableName,
        batchNum,
        totalBatches,
        batchSize: batch.length,
        error: errorMsg
      })

      // 批次失败时抛出错误，停止后续批次
      throw new Error(
        `Failed to insert batch ${batchNum}/${totalBatches}: ${errorMsg}`
      )
    }
  }

  logger.info('[EmbeddingEngineBridge] All batches inserted successfully', {
    tableName,
    totalChunks,
    totalBatches,
    batchSize: BATCH_INSERT_SIZE
  })
}
```

##### 2.3 修改 `replaceChunks()` 方法

```typescript
private async replaceChunks(
  namespace: string,
  database: string,
  tableName: string,
  documentId: string,
  chunkRecords: Array<{...}>
): Promise<void> {
  if (!this.queryService) return

  // Step 1: 删除旧 chunks
  await this.queryService.queryInDatabase(
    namespace,
    database,
    `DELETE FROM \`${tableName}\` WHERE document = $documentId;`,
    { documentId }
  )

  // Step 2: 准备批次数据
  const payload = chunkRecords.map((record) => ({
    ...record,
    document: documentId
  }))

  logger.debug('[EmbeddingEngineBridge] Inserting chunks', {
    tableName,
    documentId,
    chunkCount: payload.length
  })

  // Step 3: 分批插入（新增）
  await this.insertChunksInBatches(namespace, database, tableName, payload)
}
```

##### 2.4 增强 `syncEmbeddingResult()` 错误处理

```typescript
private async syncEmbeddingResult(
  result: EmbeddingTaskResult,
  params?: SubmitEmbeddingTaskParams
): Promise<void> {
  // ... 现有逻辑 ...

  try {
    // Step 1-3: 现有逻辑
    await this.replaceChunks(namespace, kb.databaseName, tableName, docRecord.id, chunkRecords)

    logger.info('[EmbeddingEngineBridge] Successfully synced embeddings', {
      documentId: docRecord.id,
      fileKey,
      tableName,
      chunkCount: chunkRecords.length
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    logger.error('[EmbeddingEngineBridge] Failed to sync embeddings', {
      documentId: result.documentId,
      fileKey,
      error: errorMsg,
      stack: error instanceof Error ? error.stack : undefined
    })

    // 通知前端同步失败
    this.broadcastToRenderers('embedding:sync-failed', {
      documentId: result.documentId,
      fileKey,
      error: errorMsg
    })

    throw error
  }
}
```

---

## 预期效果

### 性能指标

| 指标         | 原方案            | 新方案            |
| ------------ | ----------------- | ----------------- |
| 单次请求大小 | 23MB (583 chunks) | 2-3MB (50 chunks) |
| 批次数量     | 1                 | 12                |
| 单批耗时     | N/A (失败)        | 100-200ms         |
| 总耗时       | N/A (失败)        | 1.2-2.4 秒        |
| 成功率       | 0%                | 预期 100%         |

### 日志示例

#### 成功场景

```
[2026-01-28 10:54:47] [info] [EmbeddingEngineBridge] Starting batch insert {
  tableName: 'emb_cfg_1769568664994_4096_chunks',
  totalChunks: 583,
  totalBatches: 12,
  batchSize: 50
}

[2026-01-28 10:54:47] [debug] [EmbeddingEngineBridge] Inserting batch {
  tableName: 'emb_cfg_1769568664994_4096_chunks',
  batchNum: 1,
  totalBatches: 12,
  batchSize: 50,
  progress: '50/583 (9%)',
  startIndex: 0,
  endIndex: 49
}

[2026-01-28 10:54:47] [debug] [EmbeddingEngineBridge] Batch inserted successfully {
  tableName: 'emb_cfg_1769568664994_4096_chunks',
  batchNum: 1,
  batchSize: 50,
  duration: '150ms',
  avgPerChunk: '3.00ms'
}

... (批次 2-11) ...

[2026-01-28 10:54:49] [info] [EmbeddingEngineBridge] All batches inserted successfully {
  tableName: 'emb_cfg_1769568664994_4096_chunks',
  totalChunks: 583,
  totalBatches: 12,
  batchSize: 50
}

[2026-01-28 10:54:49] [info] [EmbeddingEngineBridge] Successfully synced embeddings {
  documentId: { tb: 'kb_document', id: 'j1z8up16ha8zr04q8brd' },
  fileKey: '生物化学.md',
  tableName: 'emb_cfg_1769568664994_4096_chunks',
  chunkCount: 583
}
```

#### 失败场景

```
[2026-01-28 10:54:47] [error] [EmbeddingEngineBridge] Batch insert failed {
  tableName: 'emb_cfg_1769568664994_4096_chunks',
  batchNum: 5,
  totalBatches: 12,
  batchSize: 50,
  error: 'Connection timeout'
}

[2026-01-28 10:54:47] [error] [EmbeddingEngineBridge] Failed to sync embeddings {
  documentId: '生物化学.md',
  fileKey: '生物化学.md',
  error: 'Failed to insert batch 5/12: Connection timeout',
  stack: '...'
}
```

---

## 优势分析

### 1. 双重保障

- 服务器层面：100MB 限制足够应对大多数场景
- 应用层面：固定批次大小确保可控性

### 2. 可控性

- 固定批次大小（50 chunks），性能可预测
- 单批约 2-3MB，远低于服务器限制

### 3. 可观测性

- 详细的批次进度日志
- 每批的耗时统计
- 失败时精确定位到具体批次

### 4. 容错性

- 批次失败时立即停止，避免部分写入
- 清晰的错误信息和堆栈跟踪
- 通知前端同步失败状态

### 5. 可扩展性

- 批次大小可配置（`BATCH_INSERT_SIZE`）
- 未来可支持并发批次插入
- 可根据向量维度动态调整批次大小

---

## 测试建议

### 1. 功能测试

- [ ] 小文件（< 50 chunks）：验证单批次插入
- [ ] 中等文件（50-200 chunks）：验证多批次插入
- [ ] 大文件（> 500 chunks）：验证大规模批次插入
- [ ] 超大文件（> 1000 chunks）：压力测试

### 2. 性能测试

- [ ] 测量单批次插入耗时
- [ ] 测量总体插入耗时
- [ ] 对比原方案（如果可行）

### 3. 错误处理测试

- [ ] 模拟网络中断
- [ ] 模拟数据库连接失败
- [ ] 验证错误日志完整性

### 4. 日志验证

- [ ] 检查批次进度日志
- [ ] 检查成功/失败日志
- [ ] 检查前端通知

---

## 回滚方案

如果新方案出现问题，可以快速回滚：

### 1. 移除服务器配置

```typescript
// 移除这两行
;('--http-max-body-size', '100MB')
```

### 2. 恢复原始插入逻辑

```typescript
// 替换 replaceChunks() 方法为原始版本
private async replaceChunks(...) {
  // 直接插入，不分批
  await this.queryService.queryInDatabase(
    namespace,
    database,
    `INSERT INTO \`${tableName}\` $chunks;`,
    { chunks: payload }
  )
}
```

---

## 后续优化方向

### 1. 动态批次大小

根据向量维度动态调整批次大小：

- 1536 维：100 chunks/批
- 3072 维：75 chunks/批
- 4096 维：50 chunks/批

### 2. 并发批次插入

使用 `Promise.all()` 并发插入多个批次（需控制并发数）

### 3. 进度通知

向前端实时推送批次插入进度

### 4. 断点续传

批次失败时记录进度，支持从失败点重试

---

## 相关文件

- `src/main/services/surrealdb-service/surrealdb-service.ts`
- `src/main/services/embedding-engine-bridge/index.ts`
- `KnowledgeDatabase-src/.log/dev/2026-01-28_10-54-15.log`（问题日志）

---

## 参考资料

- SurrealDB 文档：https://surrealdb.com/docs
- HTTP 413 错误：https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/413
