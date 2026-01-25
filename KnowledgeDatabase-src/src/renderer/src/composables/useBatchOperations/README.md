# useBatchOperations Composable

批量文档解析和分块操作的并发控制与任务管理。

## 功能概述

- ✅ 批量解析文档（带并发控制）
- ✅ 批量分块（带并发控制）
- ✅ 自动任务监控集成
- ✅ 智能文件过滤
- ✅ 错误处理（单个文件失败不影响其他文件）

## 使用方式

```typescript
import { useBatchOperations } from '@renderer/composables/useBatchOperations'

// 在组件中使用
const { isBatchParsing, isBatchChunking, batchParseDocuments, batchChunkDocuments } =
  useBatchOperations()

// 批量解析文档
const result = await batchParseDocuments(selectedFiles, knowledgeBaseId)
console.log(`成功: ${result.success}, 失败: ${result.failed}`)

// 批量分块（自动读取每个文件的配置）
const result = await batchChunkDocuments(selectedFiles, knowledgeBaseId)
```

## API

### 状态

- `isBatchParsing: Ref<boolean>` - 是否正在批量解析
- `isBatchChunking: Ref<boolean>` - 是否正在批量分块

### 方法

#### batchParseDocuments

批量解析文档。

```typescript
async function batchParseDocuments(
  files: FileNode[],
  knowledgeBaseId: number
): Promise<BatchOperationResult>
```

**参数**：

- `files` - 要解析的文件列表
- `knowledgeBaseId` - 知识库 ID

**返回**：

- `BatchOperationResult` - 包含 `success` 和 `failed` 数量

**行为**：

- 自动过滤文件夹，只处理文件
- 为每个文件创建任务监控记录
- 并发处理（默认并发数：3）
- 单个文件失败不影响其他文件

#### batchChunkDocuments

批量分块。

```typescript
async function batchChunkDocuments(
  files: FileNode[],
  knowledgeBaseId: number
): Promise<BatchOperationResult>
```

**参数**：

- `files` - 要分块的文件列表
- `knowledgeBaseId` - 知识库 ID

**返回**：

- `BatchOperationResult` - 包含 `success` 和 `failed` 数量

**行为**：

- 自动过滤不可分块的文件（非纯文本且未解析）
- 通过 `parsingStore` 检查文件是否已解析（而不是依赖 `file.status`）
- 读取每个文件当前选择的解析版本
- 读取每个文件已设定的分块配置（如果存在），否则使用默认配置
- 为每个文件创建任务监控记录
- 并发处理（默认并发数：5）
- 单个文件失败不影响其他文件

## 配置

```typescript
export const BATCH_CONFIG = {
  // 文档解析并发数（云端 API，避免限流）
  PARSING_CONCURRENCY: 3,

  // 分块并发数（本地 CPU 密集型，避免卡顿）
  CHUNKING_CONCURRENCY: 5,

  // 默认分块配置
  DEFAULT_CHUNKING_CONFIG: {
    mode: 'recursive' as const,
    maxChars: 1000
  }
}
```

**调整建议**：

- `PARSING_CONCURRENCY`：根据 API 限流策略调整（建议 3-5）
- `CHUNKING_CONCURRENCY`：根据 CPU 性能调整（建议 3-8）
- `DEFAULT_CHUNKING_CONFIG`：根据业务需求调整分块大小

## 类型定义

```typescript
interface BatchOperationResult {
  success: number // 成功处理的文件数
  failed: number // 失败的文件数
}
```

## 实现细节

### 文件解析状态判断

批量分块时，通过 `parsingStore` 检查文件是否已解析，而不是依赖 `file.status` 字段：

```typescript
function isFileParsed(fileKey: string, fileExtension?: string): boolean {
  // 纯文本文件不需要解析
  if (isPlainTextFile(fileExtension)) {
    return true
  }

  // 非纯文本文件需要检查解析状态
  const state = parsingStore.getState(fileKey)
  if (!state || !state.activeVersionId) return false

  const version = state.versions.find((v) => v.id === state.activeVersionId)
  return version?.name.includes('完成') || false
}
```

### 分块配置读取

批量分块时，会自动读取每个文件已设定的分块配置：

1. 优先使用文件已有的分块配置（通过 `chunkingStore.getState(fileKey)` 获取）
2. 如果文件没有设定配置，则使用默认配置 `BATCH_CONFIG.DEFAULT_CHUNKING_CONFIG`

这样可以保持每个文件的个性化配置。

使用队列机制控制并发：

1. 维护一个待处理队列
2. 同时运行 N 个任务（N = 并发数）
3. 一个任务完成后，从队列中取下一个
4. 直到所有任务完成

### 任务监控集成

- 文档解析：自动添加到全局监控面板，任务名称格式：`知识库名-文档名-文档解析`
- 分块：自动添加到全局监控面板，任务名称格式：`知识库名-文档名-分块`

### 错误处理

- 单个文件失败不会中断整个批量操作
- 失败的文件会被记录到 `failed` 计数
- 错误信息会输出到控制台

## 使用示例

### 在 ContentHeader.vue 中使用

```vue
<script setup lang="ts">
import { useBatchOperations } from '@renderer/composables/useBatchOperations'

const { isBatchParsing, isBatchChunking, batchParseDocuments, batchChunkDocuments } =
  useBatchOperations()

async function handleBatchParsing() {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) {
    console.warn('请先选择要解析的文件')
    return
  }

  const result = await batchParseDocuments(selectedFiles, knowledgeBaseId)
  console.log(`批量解析完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
}

async function handleBatchChunking() {
  const selectedFiles = getSelectedFiles()
  if (selectedFiles.length === 0) {
    console.warn('请先选择要分块的文件')
    return
  }

  const result = await batchChunkDocuments(selectedFiles, knowledgeBaseId)
  console.log(`批量分块完成：成功 ${result.success} 个，失败 ${result.failed} 个`)
}
</script>

<template>
  <button :disabled="isBatchParsing" @click="handleBatchParsing">
    {{ isBatchParsing ? '解析中...' : '解析文档' }}
  </button>

  <button :disabled="isBatchChunking" @click="handleBatchChunking">
    {{ isBatchChunking ? '分块中...' : '分块' }}
  </button>
</template>
```

## 注意事项

1. **并发控制**：不要同时调用多次批量操作，会被自动忽略
2. **文件过滤**：分块操作会自动过滤不可分块的文件
3. **解析状态判断**：通过 `parsingStore` 检查文件是否已解析，而不是依赖 `file.status`
4. **配置读取**：批量分块会自动读取每个文件已设定的分块配置
5. **任务监控**：所有批量操作会自动添加到全局监控面板
6. **错误处理**：单个文件失败不影响其他文件，但会记录到失败计数

## 相关文件

- `index.ts` - 主实现文件
- `README.md` - 本文档
- `@renderer/stores/parsing/parsing.store.ts` - 文档解析 Store
- `@renderer/stores/chunking/chunking.store.ts` - 分块 Store
- `@renderer/stores/global-monitor-panel/task-monitor.store.ts` - 任务监控 Store
