# Design Document: 知识图谱流式数据查询管线

## Overview

本设计为知识图谱可视化模块提供流式数据查询能力。在现有的 `Knowledge-graph` Utility Process 架构基础上，新增 `GraphQueryService` 服务和对应的消息处理逻辑，实现异步分页查询图谱数据并流式返回给前端。

### 设计目标

1. **非阻塞**: 查询任务异步执行，不影响现有图谱构建任务
2. **流式返回**: 分批次返回数据，支持渐进式渲染
3. **可取消**: 支持取消正在进行的查询
4. **低耦合**: 新增服务与现有服务解耦，通过消息机制通信

### 技术选型

- 使用现有的 `KGSurrealClient` 执行数据库查询
- 使用 `setImmediate` 在批次间让出事件循环
- 使用 `Map` 管理多个并发查询会话
- 复用现有的 MessagePort 通信机制

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Renderer Process                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  GraphViewerStore                                                │   │
│  │  - loadGraph() → 调用 IPC                                        │   │
│  │  - 监听批次数据事件                                               │   │
│  │  - 追加 entities/relations                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ IPC (contextBridge)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            Main Process                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  KnowledgeGraphBridge                                            │   │
│  │  - queryGraphData(params) → sessionId                            │   │
│  │  - cancelGraphQuery(sessionId)                                   │   │
│  │  - onGraphDataBatch / onGraphDataComplete / onGraphDataError     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ MessagePort (postMessage)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Utility Process (Knowledge-graph)                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  MessageHandler                                                  │   │
│  │  - handle('kg:query-graph-data') → GraphQueryService.startQuery  │   │
│  │  - handle('kg:cancel-graph-query') → GraphQueryService.cancel    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  GraphQueryService (新增)                                        │   │
│  │  - sessions: Map<sessionId, QuerySession>                        │   │
│  │  - startQuery(params) → 异步执行分页查询                          │   │
│  │  - cancelQuery(sessionId) → 标记取消                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  KGSurrealClient (现有)                                          │   │
│  │  - query() → 执行 SQL                                            │   │
│  │  - queryInDatabase() → 跨库查询                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. GraphQueryService (新增)

位置: `src/utility/Knowledge-graph/service/graph-query/index.ts`

```typescript
interface QuerySession {
  sessionId: string
  params: GraphQueryParams
  cancelled: boolean
  entitiesTotal: number
  relationsTotal: number
  entitiesLoaded: number
  relationsLoaded: number
}

interface GraphQueryParams {
  targetNamespace: string
  targetDatabase: string
  graphTableBase: string
  batchSize?: number  // 默认 100
}

class GraphQueryService {
  private sessions: Map<string, QuerySession>
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void

  constructor(client: KGSurrealClient, sendMessage: (msg: KGToMainMessage) => void)

  /** 开始查询，返回 sessionId */
  startQuery(params: GraphQueryParams): string

  /** 取消查询 */
  cancelQuery(sessionId: string): boolean

  /** 内部：执行异步查询流程 */
  private async executeQuery(session: QuerySession): Promise<void>

  /** 内部：查询总数 */
  private async queryTotals(session: QuerySession): Promise<void>

  /** 内部：分页查询实体 */
  private async queryEntitiesBatch(session: QuerySession, start: number): Promise<GraphEntity[]>

  /** 内部：分页查询关系 */
  private async queryRelationsBatch(session: QuerySession, start: number): Promise<GraphRelation[]>
}
```

### 2. MessageHandler 扩展

在现有 `MessageHandler` 中添加两个新的消息处理分支：

```typescript
case 'kg:query-graph-data':
  await this.handleQueryGraphData(msg.requestId, msg.data)
  break

case 'kg:cancel-graph-query':
  await this.handleCancelGraphQuery(msg.sessionId)
  break
```

### 3. KnowledgeGraphBridge 扩展

在主进程桥接层添加新方法和事件监听器：

```typescript
// 新增方法
async queryGraphData(params: GraphQueryParams): Promise<string>  // 返回 sessionId
cancelGraphQuery(sessionId: string): void

// 新增事件监听器
onGraphDataBatch(listener: (data: GraphDataBatchEvent) => void): () => void
onGraphDataComplete(listener: (sessionId: string) => void): () => void
onGraphDataError(listener: (sessionId: string, error: string) => void): () => void
onGraphDataCancelled(listener: (sessionId: string) => void): () => void
```

### 4. Preload API 扩展

在 `preload` 层暴露新的 IPC 接口：

```typescript
// knowledgeGraphAPI
queryGraphData: (params: GraphQueryParams) => Promise<string>
cancelGraphQuery: (sessionId: string) => void
onGraphDataBatch: (callback: (data: GraphDataBatchEvent) => void) => () => void
onGraphDataComplete: (callback: (sessionId: string) => void) => () => void
onGraphDataError: (callback: (sessionId: string, error: string) => void) => () => void
onGraphDataCancelled: (callback: (sessionId: string) => void) => () => void
```

## Data Models

### IPC 消息类型扩展

```typescript
// Main → KG 消息 (新增)
| { type: 'kg:query-graph-data'; requestId: string; data: GraphQueryParams }
| { type: 'kg:cancel-graph-query'; sessionId: string }

// KG → Main 消息 (新增)
| { type: 'kg:graph-query-started'; requestId: string; sessionId: string }
| {
    type: 'kg:graph-data-batch'
    sessionId: string
    entities: GraphEntity[]
    relations: GraphRelation[]
    progress: {
      entitiesLoaded: number
      entitiesTotal: number
      relationsLoaded: number
      relationsTotal: number
    }
  }
| { type: 'kg:graph-data-complete'; sessionId: string }
| { type: 'kg:graph-data-error'; sessionId: string; error: string }
| { type: 'kg:graph-data-cancelled'; sessionId: string }
```

### 查询参数类型

```typescript
interface GraphQueryParams {
  targetNamespace: string
  targetDatabase: string
  graphTableBase: string
  batchSize?: number  // 默认 100
}
```

### 批次数据事件类型

```typescript
interface GraphDataBatchEvent {
  sessionId: string
  entities: GraphEntity[]
  relations: GraphRelation[]
  progress: {
    entitiesLoaded: number
    entitiesTotal: number
    relationsLoaded: number
    relationsTotal: number
  }
}
```

### 实体和关系类型 (复用现有)

```typescript
// 来自 GraphView/types.ts
interface GraphEntity {
  id: string
  name: string
  type: string       // 对应数据库 entity_type
  description: string
}

interface GraphRelation {
  id: string
  source: string     // 对应数据库 out
  target: string     // 对应数据库 in
  keywords: string
  description: string
  weight: number
}
```

### SQL 查询模板

```sql
-- 查询实体总数
SELECT count() FROM {graphTableBase}_entity GROUP ALL;

-- 查询关系总数
SELECT count() FROM {graphTableBase}_relates GROUP ALL;

-- 分页查询实体 (只选择核心字段)
SELECT 
  meta::id(id) as id,
  name,
  entity_type,
  description
FROM {graphTableBase}_entity
LIMIT $batchSize START $start;

-- 分页查询关系 (只选择核心字段)
SELECT 
  meta::id(id) as id,
  meta::id(in) as target,
  meta::id(out) as source,
  keywords,
  description,
  weight
FROM {graphTableBase}_relates
LIMIT $batchSize START $start;
```

</content>
</invoke>


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Session 创建与 ID 唯一性

*For any* 有效的查询参数，调用 `startQuery` 应该返回一个符合 `qs_{timestamp}_{random}` 格式的 sessionId，且多次调用返回的 sessionId 互不相同。

**Validates: Requirements 1.1, 1.4**

### Property 2: 参数校验错误处理

*For any* 缺少必填字段（targetNamespace、targetDatabase、graphTableBase）的查询参数，Message_Handler 应该返回参数校验错误而不是创建 session。

**Validates: Requirements 1.3**

### Property 3: 分页查询使用 LIMIT/START

*For any* 查询执行过程，生成的实体和关系查询 SQL 都应该包含 `LIMIT` 和 `START` 子句实现分页。

**Validates: Requirements 2.1, 2.2**

### Property 4: 批次消息结构完整性

*For any* 发送的 `kg:graph-data-batch` 消息，应该包含 sessionId、entities 数组、relations 数组，以及包含 entitiesLoaded、entitiesTotal、relationsLoaded、relationsTotal 的 progress 对象。

**Validates: Requirements 2.3, 2.4, 3.2**

### Property 5: 查询完成消息发送

*For any* 成功完成的查询（所有实体和关系都已返回），应该发送一条 `kg:graph-data-complete` 消息，且消息中的 sessionId 与查询启动时返回的一致。

**Validates: Requirements 2.5**

### Property 6: 错误消息发送

*For any* 查询过程中发生的数据库错误，应该发送一条 `kg:graph-data-error` 消息，包含 sessionId 和错误描述。

**Validates: Requirements 3.3**

### Property 7: 取消标记与停止行为

*For any* 正在进行的查询，发送取消消息后，该 session 应该被标记为已取消，且后续不再发送新的批次数据。

**Validates: Requirements 4.1, 4.2**

### Property 8: 取消消息发送

*For any* 被取消的查询，应该发送一条 `kg:graph-data-cancelled` 消息，且不再发送 complete 或 error 消息。

**Validates: Requirements 4.3**

### Property 9: 多会话并发隔离

*For any* 同时进行的多个查询会话，每个会话的数据、进度、取消状态应该相互独立，一个会话的取消不影响其他会话。

**Validates: Requirements 4.4**

### Property 10: Store 批次数据累积

*For any* 收到的 `kg:graph-data-batch` 事件，GraphViewerStore 的 entities 和 relations 数组长度应该增加相应数量，且 progress 状态应该更新为事件中的值。

**Validates: Requirements 6.2, 6.3**

### Property 11: Store 状态转换正确性

*For any* 收到的 `kg:graph-data-complete` 事件，loadState 应该变为 'ready'；*For any* 收到的 `kg:graph-data-error` 事件，loadState 应该变为 'error' 且 errorMessage 应该包含错误信息。

**Validates: Requirements 6.5, 6.6**

### Property 12: SQL 字段精简

*For any* 生成的实体查询 SQL，应该只选择 id、name、entity_type、description 字段；*For any* 生成的关系查询 SQL，应该只选择 id、in、out、keywords、description、weight 字段，不包含 source_ids、file_keys 等溯源字段。

**Validates: Requirements 7.1, 7.2, 7.3**

## Error Handling

### 1. 参数校验错误

- **触发条件**: 查询参数缺少必填字段
- **处理方式**: 立即返回 `kg:graph-query-error` 消息，不创建 session
- **错误信息**: 明确指出缺少哪个字段

### 2. 数据库连接错误

- **触发条件**: KGSurrealClient 未连接或连接断开
- **处理方式**: 发送 `kg:graph-data-error` 消息
- **错误信息**: "Database not connected"

### 3. 查询执行错误

- **触发条件**: SQL 执行失败（表不存在、语法错误等）
- **处理方式**: 发送 `kg:graph-data-error` 消息，清理 session
- **错误信息**: 包含原始数据库错误信息

### 4. Session 不存在

- **触发条件**: 取消一个不存在的 sessionId
- **处理方式**: 静默忽略，不发送任何消息
- **原因**: 可能是已完成或已取消的查询

### 5. 跨库查询错误

- **触发条件**: 目标 namespace/database 不存在
- **处理方式**: 发送 `kg:graph-data-error` 消息
- **错误信息**: 包含目标库信息和原始错误

## Testing Strategy

### 单元测试

1. **GraphQueryService 测试**
   - 测试 sessionId 生成格式
   - 测试参数校验逻辑
   - 测试取消标记设置
   - Mock KGSurrealClient 验证 SQL 生成

2. **MessageHandler 扩展测试**
   - 测试新消息类型路由
   - 测试错误消息返回

3. **KnowledgeGraphBridge 扩展测试**
   - 测试新方法存在性
   - 测试事件监听器注册/注销

### 属性测试

使用 fast-check 进行属性测试，每个测试运行至少 100 次迭代。

1. **Property 1 测试**: 生成随机有效参数，验证 sessionId 格式和唯一性
2. **Property 2 测试**: 生成缺少各种必填字段的参数组合，验证错误返回
3. **Property 4 测试**: Mock 数据库返回随机数据，验证批次消息结构
4. **Property 9 测试**: 并发启动多个查询，验证隔离性
5. **Property 12 测试**: 验证生成的 SQL 字段列表

### 集成测试

1. **端到端流式查询测试**
   - 启动 Utility Process
   - 提交查询任务
   - 验证批次数据流
   - 验证完成消息

2. **取消查询测试**
   - 启动查询
   - 中途取消
   - 验证停止行为

3. **前端集成测试**
   - Mock IPC 层
   - 验证 Store 状态变化
   - 验证 UI 渲染

### 测试标签格式

每个属性测试必须包含注释标签：

```typescript
// Feature: graph-data-streaming-query, Property 1: Session 创建与 ID 唯一性
```
