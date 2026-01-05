# Preload API 层

封装 IPC 调用，为渲染进程提供类型安全的 API 接口。

## 设计原则

### 1. 按业务域分模块
每个业务域一个 API 文件：
- `test-api.ts` - 测试相关 API
- `file-api.ts` - 文件操作 API  
- `database-api.ts` - 数据库操作 API
- `window-api.ts` - 窗口控制 API

### 2. 类型安全
所有 API 都提供完整的 TypeScript 类型定义：

```typescript
export const fileAPI = {
  readFile: (path: string): Promise<FileReadResult> => {
    return ipcRenderer.invoke('file:read', path);
  }
};
```

### 3. 错误处理
API 层不处理业务错误，只负责：
- 参数验证
- 类型转换
- IPC 通信

### 4. 文档注释
每个 API 方法都应该有 JSDoc 注释：

```typescript
/**
 * 读取文件内容
 * @param path 文件路径
 * @returns 文件内容或错误信息
 */
readFile: (path: string): Promise<FileReadResult>
```

## 使用方式

### 在 preload/index.ts 中注册

```typescript
import { testAPI } from './api/test-api';
import { fileAPI } from './api/file-api';

const api = {
  test: testAPI,
  file: fileAPI
};

contextBridge.exposeInMainWorld('api', api);
```

### 在渲染进程中使用

```typescript
// 在 Vue 组件或 composables 中
const result = await window.api.test.ping();
const content = await window.api.file.readFile('/path/to/file');
```

## 命名规范

- API 对象使用 `xxxAPI` 命名
- 方法名使用 camelCase
- 与 IPC channel 保持对应关系