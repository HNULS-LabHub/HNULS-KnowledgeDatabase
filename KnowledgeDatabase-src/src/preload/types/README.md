# Preload 类型定义

定义 Preload 层的 API 接口类型，确保主进程和渲染进程之间的类型安全。

## 类型分类

### 1. 通用响应类型
```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 2. 业务域类型
按业务域组织类型定义：
- 测试相关：`TestPingResult`, `TestEchoResult`
- 文件相关：`FileReadResult`, `FileWriteResult`
- 数据库相关：`DatabaseQueryResult`

### 3. 事件类型
定义主进程向渲染进程发送的事件类型：
```typescript
interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}
```

## 使用方式

### 在 API 层使用
```typescript
import { TestPingResult } from '../types';

export const testAPI = {
  ping: (): Promise<TestPingResult> => {
    return ipcRenderer.invoke('test:ping');
  }
};
```

### 在渲染进程使用
```typescript
// 类型会自动推导
const result = await window.api.test.ping(); // result: TestPingResult
```

## 设计原则

- **契约优先**：类型定义即接口契约
- **版本兼容**：新增字段使用可选属性
- **文档化**：复杂类型添加 JSDoc 注释
- **复用性**：通用类型可被多个业务域使用