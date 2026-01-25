# 全局任务监控服务 (Global Monitor Service)

## 概述

这是一个运行在 Electron `UtilityProcess` 中的全局任务监控微服务。它负责管理整个应用程序中所有任务的状态，作为 **Single Source of Truth (SSOT)**。

## 架构

```
Renderer Process                    Main Process                    Utility Process
     │                                   │                               │
     │ window.api.taskMonitor            │                               │
     ├──────────────────────────────────►│                               │
     │                                   │ MessagePort                   │
     │                                   ├──────────────────────────────►│
     │                                   │                               │ TaskRegistry
     │                                   │                               │ (内存 Map)
     │                                   │◄──────────────────────────────┤
     │◄──────────────────────────────────┤ tasksChanged                  │
     │                                   │                               │
```

## 文件结构

```
global-monitor/
├── entry.ts           # 进程入口
├── task-registry.ts   # 任务注册表（内存存储）
├── ipc-protocol.ts    # IPC 消息协议定义
└── README.md          # 本文档
```

## IPC 协议

### Main → Utility

| 消息类型         | 说明         |
| ---------------- | ------------ |
| `create`         | 创建任务     |
| `updateProgress` | 更新进度     |
| `complete`       | 完成任务     |
| `fail`           | 任务失败     |
| `pause`          | 暂停任务     |
| `resume`         | 恢复任务     |
| `remove`         | 移除任务     |
| `clear`          | 清除任务     |
| `getAll`         | 获取所有任务 |
| `batchPause`     | 批量暂停     |
| `batchResume`    | 批量恢复     |

### Utility → Main

| 消息类型       | 说明             |
| -------------- | ---------------- |
| `tasksChanged` | 任务列表变更通知 |
| `createResult` | 创建任务结果     |
| `getAllResult` | 获取任务列表结果 |
| `clearResult`  | 清除任务结果     |
| `ready`        | 服务就绪         |
| `error`        | 错误信息         |

## 使用方式

业务模块通过 `window.api.taskMonitor` 创建和更新任务：

```typescript
// 创建任务
const handle = await window.api.taskMonitor.createTask({
  type: 'embedding',
  title: '文档嵌入 - example.pdf',
  meta: { fileKey: 'xxx', totalChunks: 100 }
})

// 更新进度
handle.updateProgress(50, { processedChunks: 50 })

// 完成任务
handle.complete({ totalVectors: 100 })
```
