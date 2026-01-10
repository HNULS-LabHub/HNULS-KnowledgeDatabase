# Context Bridge 桥接层

负责安全地将 API 暴露给渲染进程，是 Preload 脚本的核心。

## 职责

### 1. API 聚合

将各个业务域的 API 聚合成统一的接口：

```typescript
const customAPI = {
  test: testAPI,
  file: fileAPI,
  database: databaseAPI,
  window: windowAPI
}
```

### 2. 安全暴露

通过 `contextBridge` 安全地暴露 API：

```typescript
contextBridge.exposeInMainWorld('api', customAPI)
```

### 3. 兼容处理

处理上下文隔离启用/禁用的兼容性：

```typescript
if (process.contextIsolated) {
  // 安全模式：使用 contextBridge
  contextBridge.exposeInMainWorld('api', customAPI)
} else {
  // 兼容模式：直接挂载到 window
  ;(window as any).api = customAPI
}
```

## 安全考虑

### 1. 最小权限原则

只暴露渲染进程真正需要的 API，避免暴露敏感功能。

### 2. 参数验证

在 API 层进行基础的参数类型检查。

### 3. 错误隔离

确保主进程的错误不会直接暴露给渲染进程。

## 使用方式

### 在 preload/index.ts 中调用

```typescript
import { exposeBridge } from './bridge'

exposeBridge()
```

### 渲染进程中的类型定义

```typescript
// 在 renderer 中定义全局类型
declare global {
  interface Window {
    api: typeof customAPI
    electron: ElectronAPI
  }
}
```

## 扩展新 API

1. 在对应的 `api/xxx-api.ts` 中定义 API
2. 在 `bridge/index.ts` 中导入并添加到 `customAPI`
3. 更新渲染进程的类型定义
