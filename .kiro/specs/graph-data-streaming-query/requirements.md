# Requirements Document

## Introduction

本功能为知识图谱可视化模块提供流式数据查询管线。在 Electron 应用的 Utility Process (`Knowledge-graph`) 中新增异步查询 handler，支持分页流式返回图谱实体和关系数据，通过主进程桥接转发给渲染进程，实现大规模图谱数据的渐进式加载。

## Glossary

- **Query_Pipeline**: 流式查询管线，负责异步执行分页查询并批量返回数据
- **KG_Utility_Process**: 知识图谱 Utility Process，运行在独立 Node 进程中
- **Message_Handler**: 消息处理器，解析 Main → KG 消息并分发到对应服务
- **KG_Bridge**: 主进程中的知识图谱通信桥，负责与 Utility Process 通信
- **Graph_Entity**: 图谱实体，包含 id、name、entity_type、description 字段
- **Graph_Relation**: 图谱关系，包含 id、source、target、keywords、description、weight 字段
- **Batch**: 数据批次，每次查询返回的一组记录
- **Query_Session**: 查询会话，标识一次完整的流式查询过程

## Requirements

### Requirement 1: 流式查询任务提交

**User Story:** 作为前端开发者，我希望能够提交图谱数据查询任务，以便获取指定图谱的实体和关系数据。

#### Acceptance Criteria

1. WHEN 主进程发送 `kg:query-graph-data` 消息 THEN Message_Handler SHALL 创建新的 Query_Session 并返回 sessionId
2. THE Query_Pipeline SHALL 接受查询参数：targetNamespace、targetDatabase、graphTableBase、batchSize
3. WHEN 查询参数缺失必填字段 THEN Message_Handler SHALL 返回参数校验错误
4. THE Query_Pipeline SHALL 为每个 Query_Session 生成唯一的 sessionId 格式为 `qs_{timestamp}_{random}`

### Requirement 2: 分页流式数据返回

**User Story:** 作为前端开发者，我希望图谱数据能够分批次流式返回，以便实现渐进式渲染而不阻塞 UI。

#### Acceptance Criteria

1. WHEN Query_Pipeline 执行查询 THEN Query_Pipeline SHALL 使用 LIMIT/START 分页查询实体表
2. WHEN Query_Pipeline 执行查询 THEN Query_Pipeline SHALL 使用 LIMIT/START 分页查询关系表
3. WHEN 每个 Batch 查询完成 THEN Query_Pipeline SHALL 发送 `kg:graph-data-batch` 消息包含当前批次数据
4. THE `kg:graph-data-batch` 消息 SHALL 包含 sessionId、entities 数组、relations 数组、progress 信息
5. WHEN 所有数据查询完成 THEN Query_Pipeline SHALL 发送 `kg:graph-data-complete` 消息
6. THE Query_Pipeline SHALL 在批次之间使用 setImmediate 让出事件循环

### Requirement 3: 查询进度反馈

**User Story:** 作为前端开发者，我希望能够获取查询进度信息，以便向用户展示加载状态。

#### Acceptance Criteria

1. WHEN Query_Pipeline 开始查询 THEN Query_Pipeline SHALL 先查询实体和关系的总数
2. THE `kg:graph-data-batch` 消息 SHALL 包含 entitiesLoaded、entitiesTotal、relationsLoaded、relationsTotal 字段
3. WHEN 查询过程中发生错误 THEN Query_Pipeline SHALL 发送 `kg:graph-data-error` 消息包含错误信息

### Requirement 4: 查询取消支持

**User Story:** 作为前端开发者，我希望能够取消正在进行的查询，以便在用户切换图谱时停止旧查询。

#### Acceptance Criteria

1. WHEN 主进程发送 `kg:cancel-graph-query` 消息 THEN Query_Pipeline SHALL 标记对应 Query_Session 为已取消
2. WHEN Query_Session 被标记为已取消 THEN Query_Pipeline SHALL 在下一个批次前停止查询
3. WHEN 查询被取消 THEN Query_Pipeline SHALL 发送 `kg:graph-data-cancelled` 消息
4. THE Query_Pipeline SHALL 支持同时存在多个 Query_Session，互不干扰

### Requirement 5: 主进程桥接层

**User Story:** 作为系统架构师，我希望主进程能够桥接查询请求和数据流，以便渲染进程能够接收流式数据。

#### Acceptance Criteria

1. THE KG_Bridge SHALL 提供 `queryGraphData` 方法接受查询参数并返回 sessionId
2. THE KG_Bridge SHALL 提供 `cancelGraphQuery` 方法接受 sessionId 取消查询
3. THE KG_Bridge SHALL 提供 `onGraphDataBatch` 事件监听器接收批次数据
4. THE KG_Bridge SHALL 提供 `onGraphDataComplete` 事件监听器接收完成通知
5. THE KG_Bridge SHALL 提供 `onGraphDataError` 事件监听器接收错误通知
6. THE KG_Bridge SHALL 提供 `onGraphDataCancelled` 事件监听器接收取消通知

### Requirement 6: 前端 Store 集成

**User Story:** 作为前端开发者，我希望 GraphView store 能够使用真实后端数据，以便替换现有的 mock 数据。

#### Acceptance Criteria

1. WHEN 用户选择图谱 THEN GraphViewerStore SHALL 调用 IPC 接口提交查询任务
2. WHEN 收到 `kg:graph-data-batch` 事件 THEN GraphViewerStore SHALL 追加实体和关系到本地状态
3. WHEN 收到 `kg:graph-data-batch` 事件 THEN GraphViewerStore SHALL 更新加载进度
4. WHEN 用户切换图谱 THEN GraphViewerStore SHALL 取消当前查询并重置状态
5. WHEN 收到 `kg:graph-data-complete` 事件 THEN GraphViewerStore SHALL 将 loadState 设置为 'ready'
6. WHEN 收到 `kg:graph-data-error` 事件 THEN GraphViewerStore SHALL 将 loadState 设置为 'error' 并记录错误信息

### Requirement 7: 数据字段精简

**User Story:** 作为系统架构师，我希望查询只返回可视化所需的核心字段，以便减少数据传输量。

#### Acceptance Criteria

1. THE Query_Pipeline SHALL 查询实体时只选择 id、name、entity_type、description 字段
2. THE Query_Pipeline SHALL 查询关系时只选择 id、in、out、keywords、description、weight 字段
3. THE Query_Pipeline SHALL 不查询 source_ids、file_keys 等溯源字段
