# 分块服务 (Chunking Service)

分块服务负责将文档分割成更小的、可管理的块，用于后续的嵌入和检索。

## 目录结构

```
chunking/
├── index.ts                    # 导出入口
├── chunking-service.ts          # 主服务类
├── types.ts                     # 类型定义
├── chunk-meta-store.ts         # 分块元数据存储
├── util.ts                      # 工具函数
├── strategies/                  # 分块策略插件目录
│   ├── base-strategy.ts         # 策略接口
│   ├── recursive-strategy.ts    # 段落分块策略实现
│   └── index.ts                 # 策略导出
└── README.md                    # 本文档
```

## 核心设计

### 1. 插件化架构

分块服务采用插件化设计，所有分块策略都实现 `IChunkingStrategy` 接口：

```typescript
interface IChunkingStrategy {
  readonly name: string
  readonly description: string
  chunk(content: string, config: ChunkingConfig): Promise<Chunk[]>
  validateConfig(config: ChunkingConfig): boolean
}
```

### 2. 数据存储

- **元数据存储**：`.ChunkDocument/{docName}/meta.json`
  - 存储分块配置和结果历史
  - 支持按配置快速查询

- **文件位置**：`data/.ChunkDocument/{docName}/` 目录下对应文件的目录

### 3. 文档内容读取

- **纯文本文件**：直接读取文件内容
- **非纯文本文件**：从 MinerU 解析结果读取 `full.md`

## 使用方法

### 后端服务调用

```typescript
import { ChunkingService } from '../services/chunking'

const chunkingService = new ChunkingService()

// 执行分块
const result = await chunkingService.chunkDocument({
  knowledgeBaseId: 1,
  fileRelativePath: 'documents/example.pdf',
  config: {
    mode: 'recursive',
    maxChars: 1000
  },
  parsingVersionId: 'version-1' // 非纯文本文件需要指定
})

// 获取分块结果
const existingResult = await chunkingService.getChunkingResult({
  knowledgeBaseId: 1,
  fileRelativePath: 'documents/example.pdf',
  config: {
    mode: 'recursive',
    maxChars: 1000
  }
})
```

### 前端 IPC 调用

```typescript
// 在 renderer 进程中使用
import { chunkingAPI } from '@preload/api'

// 执行分块
const result = await chunkingAPI.chunkDocument({
  knowledgeBaseId: 1,
  fileRelativePath: 'documents/example.pdf',
  config: {
    mode: 'recursive',
    maxChars: 1000
  },
  parsingVersionId: 'version-1' // 非纯文本文件需要指定
})

if (result.success && result.data) {
  console.log('分块成功，共', result.data.chunks.length, '个分块')
} else {
  console.error('分块失败:', result.error)
}

// 获取分块结果
const getResult = await chunkingAPI.getChunkingResult({
  knowledgeBaseId: 1,
  fileRelativePath: 'documents/example.pdf',
  config: {
    mode: 'recursive',
    maxChars: 1000
  }
})

if (getResult.success && getResult.data) {
  console.log('获取到', getResult.data.chunks.length, '个分块')
}
```

## 分块策略

### 段落分块策略 (Recursive)

**模式名称**：`recursive`

**算法逻辑**：

1. 按照 `maxChars` 尽量凑满
2. 优先在段尾结束
3. 其次在句尾结束

**配置要求**：

- `mode`: `'recursive'`
- `maxChars`: 100-10000 字符

## 扩展新策略

要添加新的分块策略，只需：

1. 在 `strategies/` 目录下创建新的策略文件
2. 实现 `IChunkingStrategy` 接口
3. 在 `ChunkingService` 构造函数中注册策略

示例：

```typescript
// strategies/fixed-size-strategy.ts
export class FixedSizeChunkingStrategy implements IChunkingStrategy {
  readonly name = 'fixed-size'
  readonly description = '固定大小分块'

  validateConfig(config: ChunkingConfig): boolean {
    return config.mode === 'fixed-size' && config.maxChars > 0
  }

  async chunk(content: string, config: ChunkingConfig): Promise<Chunk[]> {
    // 实现固定大小分块逻辑
  }
}

// chunking-service.ts
constructor() {
  this.registerStrategy(new RecursiveChunkingStrategy())
  this.registerStrategy(new FixedSizeChunkingStrategy()) // 注册新策略
}
```

## IPC 通道

- `chunking:chunkdocument` - 执行分块
- `chunking:getchunkingresult` - 获取分块结果

## 注意事项

1. **非纯文本文件**：必须先完成文档解析才能进行分块
2. **缓存机制**：相同配置的分块结果会被缓存，不会重复计算
3. **文件类型判断**：自动识别纯文本文件，非纯文本文件需要指定解析版本
