# Implementation Plan: 知识图谱流式数据查询管线

## Overview

按照设计文档实现流式查询管线，包括 Utility Process 服务、主进程桥接、Preload API 和前端 Store 集成。

## Tasks

- [x] 1. 扩展 IPC 类型定义
  - 在 knowledge-graph-ipc.types.ts 中添加新消息类型
  - _Requirements: 2.4, 3.2_

- [x] 2. 实现 GraphQueryService
  - [x] 2.1 创建 GraphQueryService 类
  - [x] 2.2 实现 startQuery 方法
  - [x] 2.3 实现 cancelQuery 方法
  - [x] 2.4 实现 executeQuery 异步流程
  - _Requirements: 1.1, 1.4, 2.1-2.6, 3.1-3.3, 4.1-4.4, 7.1-7.3_

- [x] 3. 扩展 MessageHandler
  - 添加 kg:query-graph-data 和 kg:cancel-graph-query 处理
  - _Requirements: 1.1, 1.3, 4.1_

- [x] 4. 更新 entry.ts
  - 初始化 GraphQueryService 并注入到 MessageHandler
  - _Requirements: 1.1_

- [x] 5. 扩展 KnowledgeGraphBridge
  - [x] 5.1 添加 queryGraphData 方法
  - [x] 5.2 添加 cancelGraphQuery 方法
  - [x] 5.3 添加事件监听器
  - [x] 5.4 处理新消息类型
  - _Requirements: 5.1-5.6_

- [x] 6. 扩展 Preload API
  - 暴露查询方法和事件监听器给渲染进程
  - _Requirements: 5.1-5.6_

- [x] 7. 更新 GraphViewerStore
  - [x] 7.1 替换 mock 数据为真实 IPC 调用
  - [x] 7.2 实现事件监听和状态更新
  - [x] 7.3 实现查询取消逻辑
  - _Requirements: 6.1-6.6_

- [x] 8. Checkpoint - 确保编译通过

## 实现摘要

### 新增文件
- `src/utility/Knowledge-graph/service/graph-query/index.ts` - GraphQueryService 实现

### 修改文件
- `src/Public/ShareTypes/knowledge-graph-ipc.types.ts` - 新增 IPC 消息类型
- `src/utility/Knowledge-graph/bridge/message-handler.ts` - 添加新消息处理
- `src/utility/Knowledge-graph/entry.ts` - 初始化 GraphQueryService
- `src/main/services/knowledge-graph-bridge/index.ts` - 主进程桥接扩展
- `src/main/ipc/knowledge-graph-handler.ts` - IPC Handler 扩展
- `src/preload/types/knowledge-graph.types.ts` - Preload 类型扩展
- `src/preload/api/knowledge-graph-api.ts` - Preload API 扩展
- `src/renderer/src/views/MainWindow/MainContent/views/GraphView/graph-viewer.store.ts` - 前端 Store 更新
