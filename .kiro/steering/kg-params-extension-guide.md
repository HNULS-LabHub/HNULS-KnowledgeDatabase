---
inclusion: manual
---

# kg_params 全链路扩展指南

## 概述

`kg_task.kg_params` 是知识图谱构建任务的自由扩展配置字段，采用 `FLEXIBLE TYPE option<object>` 存储，支持任意嵌套结构。本指南覆盖从前端配置到数据库落盘的完整链路，确保新增字段时不遗漏任何环节。

## 当前 kg_params 结构

```typescript
kgParams: {
  llm: { modelId: string, modelName: string, concurrency: number },
  embedding: { embeddingConfigId: string, concurrency: number }
}
```

## 全链路文件清单（按数据流顺序）

### 1. 前端类型定义
- `src/Public/ShareTypes/knowledge-graph-config.types.ts`
  - `KnowledgeGraphBuildConfig` — 前端配置对象，包含 `llm`、`embedding` 等字段
  - 扩展时：在此接口新增字段（如 `extraction?: ExtractionConfig`）

### 2. 前端 Store（组装 kgParams）
- `src/renderer/src/stores/knowledge-graph/knowledge-graph-config.store.ts`
  - `createKGConfig()` — 创建配置时设置默认值
  - `updateKGConfig()` — 更新配置时合并字段
  - `startBuildKnowledgeGraph()` — **关键**：在此将配置字段打包进 `kgParams`
  - 扩展时：
    1. `createKGConfig` 中添加新字段的默认值
    2. `updateKGConfig` 中添加新字段的合并逻辑
    3. `startBuildKnowledgeGraph` 中将新字段加入 `kgParams` 对象

  ```typescript
  // startBuildKnowledgeGraph 中的 kgParams 组装
  kgParams: JSON.parse(JSON.stringify({
    llm: kgConfig.llm,
    embedding: kgConfig.embedding,
    // ← 新字段加在这里
  }))
  ```

  > **重要**：必须用 `JSON.parse(JSON.stringify(...))` 脱掉 Vue reactive proxy，否则 Electron IPC structured clone 会报错。

### 3. Preload API（透传）
- `src/preload/api/knowledge-graph-api.ts`
  - `KnowledgeGraphAPI.submitBuild` 的参数类型中 `kgParams?: Record<string, unknown>`
  - **通常不需要改**：kgParams 是 `Record<string, unknown>`，天然支持任意结构

### 4. 主进程 IPC Handler（透传）
- `src/main/ipc/knowledge-graph-handler.ts`
  - `SubmitBuildParams.kgParams` → 透传给 `bridge.submitBuild()`
  - **通常不需要改**：只做校验和转发

### 5. IPC 协议定义（透传）
- `src/utility/Knowledge-graph/ipc-protocol.ts`
  - `SubmitBuildData.kgParams?: Record<string, unknown>`
  - **通常不需要改**

### 6. Bridge（透传）
- `src/main/services/knowledge-graph-bridge/index.ts`
  - `submitBuild()` 方法将 `SubmitBuildData` 发送给子进程
  - **通常不需要改**

### 7. 子进程 Entry（写入数据库）
- `src/utility/Knowledge-graph/entry.ts`
  - `submitBuild()` — 解构 `kgParams` 并传给 `createTask()`
  - `createTask()` — 将 `kg_params` 写入 SurrealDB
  - **通常不需要改**：`kg_params` 作为整体对象传入 SQL 参数

### 8. 数据库 Schema
- `src/main/services/surrealdb-service/schema/tables.ts`
  - `kgTaskTable` 中 `DEFINE FIELD kg_params ON kg_task FLEXIBLE TYPE option<object>`
  - **不需要改**：`FLEXIBLE` 允许任意嵌套结构，无需为每个子字段单独 DEFINE

### 9. 共享类型（读取时）
- `src/Public/ShareTypes/kg-chunk-staging.types.ts`
  - `KGTaskRecord.kg_params?: Record<string, unknown>`
  - 扩展时：如果子进程消费 `kg_params` 中的新字段，建议在此细化类型

## 扩展检查清单

新增 kg_params 子字段时，按顺序检查：

- [ ] `knowledge-graph-config.types.ts` — 新增类型定义
- [ ] `knowledge-graph-config.store.ts` — `createKGConfig` 默认值
- [ ] `knowledge-graph-config.store.ts` — `updateKGConfig` 合并逻辑
- [ ] `knowledge-graph-config.store.ts` — `startBuildKnowledgeGraph` 打包进 kgParams
- [ ] 前端 UI 组件 — 新增配置项的编辑界面
- [ ] （可选）`kg-chunk-staging.types.ts` — 细化 `KGTaskRecord.kg_params` 类型
- [ ] （可选）`entry.ts` 中消费新字段的处理逻辑（如 processBatch 使用 LLM 配置）

## 关键约束

1. **Reactive Proxy 脱壳**：前端传给 IPC 的对象必须是纯 JSON，用 `JSON.parse(JSON.stringify(...))` 处理
2. **FLEXIBLE 字段**：`kg_params` 已声明为 `FLEXIBLE`，新增嵌套字段无需改 schema
3. **Record ID 不跨 IPC**：参见 `.kiro/steering/经验教训.md`
4. **中间层透传**：preload → handler → bridge → ipc-protocol 全部用 `Record<string, unknown>`，新增字段无需改这些层
