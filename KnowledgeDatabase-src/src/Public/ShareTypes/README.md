# ShareTypes - 跨进程共享类型定义

## 目录职责

`ShareTypes` 是**跨进程类型契约的权威来源**，定义了在 Main Process、Utility Process、Preload 和 Renderer 之间共享的类型定义。

### 核心原则

- **单一事实来源（SSOT）**：所有跨进程通信的类型定义必须在此目录统一维护
- **进程无关性**：类型定义不依赖任何特定进程的运行时环境（如 Electron、Node、Browser API）
- **契约优先**：类型定义即接口契约，修改需谨慎评估影响范围

---

## 目录结构

```
ShareTypes/
├── index.ts                      # 统一导出入口
├── chunking.types.ts             # 分块服务类型
├── embedding.types.ts            # 嵌入服务核心类型
├── embedding-ipc.types.ts        # 嵌入引擎 IPC 协议
├── vector-indexer-ipc.types.ts   # 向量索引器 IPC 协议
└── user-config.types.ts          # 用户配置类型
```

---

## 类型文件说明

### 1. `chunking.types.ts`

**职责**：文档分块服务的类型定义

**核心类型**：

- `ChunkingConfig` - 分块配置（模式、最大字符数）
- `Chunk` - 单个分块数据结构
- `ChunkingResult` - 分块结果
- `ChunkingRequest` - 分块请求参数

**使用场景**：

- Main Process: 分块服务实现
- Renderer: 分块配置管理、结果展示

---

### 2. `embedding.types.ts`

**职责**：嵌入服务的核心业务类型

**核心类型**：

- **任务类型**：
  - `DocumentTask` - 文档级任务
  - `ChunkTask` - Chunk 级任务
  - `EmbeddingTaskInfo` - 用户可见的任务信息
- **配置类型**：
  - `EmbeddingConfig` - 嵌入配置
  - `ChannelConfig` - 通道配置（含熔断状态）
  - `SchedulerConfig` - 调度器配置
- **数据类型**：
  - `ChunkInput` - Chunk 输入
  - `ChunkEmbeddingResult` - Chunk 嵌入结果
  - `VectorStagingRecord` - 向量暂存记录
- **API 契约**：
  - `EmbeddingAPI` - Preload 暴露的嵌入服务接口

**使用场景**：

- Utility Process (Embedding Engine): 任务管理、通道管理
- Main Process: 服务桥接、数据库操作
- Renderer: 任务监控、配置管理

---

### 3. `embedding-ipc.types.ts`

**职责**：Main Process ↔ Embedding Engine (Utility Process) 的 IPC 消息协议

**核心类型**：

- `MainToEngineMessage` - Main 发送给 Engine 的消息
  - 任务控制：`embed:start` / `embed:pause` / `embed:resume` / `embed:cancel`
  - 配置更新：`config:update-channels` / `config:set-concurrency`
  - 状态查询：`query:task-info` / `query:channels`
- `EngineToMainMessage` - Engine 发送给 Main 的消息
  - 生命周期：`ready`
  - 任务状态：`task:started` / `task:progress` / `task:completed` / `task:failed`
  - 流式通知：`chunk:completed`
  - 通道状态：`channel:status-changed`

**使用场景**：

- Main Process: 发送控制指令、接收状态更新
- Utility Process (Embedding Engine): 接收指令、上报状态

---

### 4. `vector-indexer-ipc.types.ts`

**职责**：Main Process ↔ Vector Indexer (Utility Process) 的 IPC 消息协议

**核心类型**：

- `IndexerConfig` - Indexer 运行配置
- `IndexerStats` - 统计信息
- `StagingStatus` - 暂存表状态
- `MainToIndexerMessage` - Main 发送的消息
- `IndexerToMainMessage` - Indexer 发送的消息

**使用场景**：

- Main Process: 启动/停止 Indexer、查询状态
- Utility Process (Vector Indexer): 搬运向量数据、上报进度

---

### 5. `user-config.types.ts`

**职责**：用户配置的类型定义

**核心类型**：

- `UserConfig` - 用户配置根对象
- `MinerUConfig` - MinerU 解析服务配置
- `UserEmbeddingConfig` - 嵌入服务配置

**使用场景**：

- Main Process: 配置读写
- Renderer: 配置管理界面

---

## 使用规范

### 1. 导入方式

```typescript
// ✅ 推荐：从统一入口导入
import type { ChunkingConfig, EmbeddingTaskInfo, MainToEngineMessage } from '@/Public/ShareTypes'

// ❌ 避免：直接导入子文件（除非有特殊需求）
import type { ChunkingConfig } from '@/Public/ShareTypes/chunking.types'
```

### 2. 类型命名约定

- **业务实体**：`PascalCase`（如 `DocumentTask`、`ChunkInput`）
- **枚举/联合类型**：`PascalCase` + `Type` 后缀（如 `DocumentTaskStatus`）
- **配置对象**：`PascalCase` + `Config` 后缀（如 `EmbeddingConfig`）
- **API 接口**：`PascalCase` + `API` 后缀（如 `EmbeddingAPI`）
- **IPC 消息**：`PascalCase` + `Message` 后缀（如 `MainToEngineMessage`）

### 3. 类型扩展原则

- **向后兼容**：新增字段使用可选属性（`?:`）
- **破坏性变更**：必须同步更新所有使用方（Main / Utility / Preload / Renderer）
- **版本管理**：重大变更需在类型注释中标注版本号

---

## 与其他类型目录的关系

### `ShareTypes` vs `preload/types`

| 维度         | ShareTypes                          | preload/types                            |
| ------------ | ----------------------------------- | ---------------------------------------- |
| **职责**     | 跨进程共享的业务类型                | Preload API 的输入输出类型               |
| **使用方**   | Main / Utility / Preload / Renderer | Preload / Renderer                       |
| **依赖关系** | 被 `preload/types` 引用             | 引用 `ShareTypes`                        |
| **示例**     | `EmbeddingTaskInfo`（业务实体）     | `SubmitEmbeddingTaskRequest`（API 请求） |

**原则**：

- `preload/types` 可以引用 `ShareTypes`
- `ShareTypes` 不应引用 `preload/types`（避免循环依赖）

### `ShareTypes` vs `renderer/src/types`

| 维度       | ShareTypes        | renderer/src/types |
| ---------- | ----------------- | ------------------ |
| **职责**   | 跨进程共享类型    | Renderer 内部类型  |
| **使用方** | 所有进程          | 仅 Renderer        |
| **示例**   | `EmbeddingConfig` | `FileCardUIState`  |

**原则**：

- Renderer 内部 UI 状态类型放在 `renderer/src/types`
- 需要与后端通信的类型放在 `ShareTypes`

---

## 维护指南

### 新增类型文件

1. 在 `ShareTypes/` 下创建 `xxx.types.ts`
2. 在 `index.ts` 中添加导出：
   ```typescript
   export * from './xxx.types'
   ```
3. 更新本 README 的"类型文件说明"章节

### 修改现有类型

1. **评估影响范围**：检查所有使用方（Main / Utility / Preload / Renderer）
2. **向后兼容优先**：尽量使用可选属性而非删除字段
3. **同步更新**：确保所有使用方同步更新
4. **测试验证**：运行跨进程通信相关的测试

### 删除废弃类型

1. 先标记为 `@deprecated`，保留至少一个版本周期
2. 确认所有使用方已迁移
3. 删除类型定义并更新 `index.ts`

---

## 常见问题

### Q: 什么类型应该放在 ShareTypes？

**A**: 满足以下任一条件：

- 需要在多个进程间传递（IPC 消息、API 参数）
- 需要在数据库和前端之间共享（数据模型）
- 需要在配置文件和运行时之间共享（配置类型）

### Q: ShareTypes 可以依赖外部库吗？

**A**: 尽量避免。如果必须依赖，确保：

- 依赖库在所有进程环境中都可用
- 仅依赖类型定义（`import type`），不依赖运行时代码

### Q: 如何处理进程特定的类型扩展？

**A**: 使用类型组合：

```typescript
// ShareTypes: 基础类型
export interface BaseTask {
  id: string
  status: string
}

// Main Process: 扩展类型
interface MainProcessTask extends BaseTask {
  internalState: SomeMainOnlyType
}
```

---

## 相关文档

- [Preload Types README](../preload/types/README.md) - Preload API 类型定义
- [Renderer Types README](../renderer/src/types/README.md) - Renderer 内部类型
- [IPC Handler README](../main/ipc/README.md) - IPC 通信规范
