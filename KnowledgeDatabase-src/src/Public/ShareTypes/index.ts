/**
 * @file 共享类型统一导出
 * @description 跨进程（Main / Utility / Preload / Renderer）共享的类型定义
 */

// 嵌入服务类型
export * from './embedding.types'

// 嵌入引擎 IPC 协议
export * from './embedding-ipc.types'

// 向量索引器 IPC 协议
export * from './vector-indexer-ipc.types'

// 分块类型
export * from './chunking.types'

// 用户配置类型
export * from './user-config.types'

// API 服务器类型
export * from './api-server.types'
