# SurrealDB 错误处理指南

## 概述

本项目为 SurrealDB 操作实现了完整的错误处理机制，确保所有数据库操作失败时都能：
1. 记录详细的错误日志
2. 返回结构化的错误信息
3. 提供足够的上下文用于调试

## 错误类型

### 1. DatabaseOperationError（数据库操作错误）
所有 CRUD 操作失败时抛出的基础错误类。

```typescript
import { DatabaseOperationError } from '@/services/surrealdb-service'

try {
  await queryService.create('user', data)
} catch (error) {
  if (error instanceof DatabaseOperationError) {
    console.log(error.operation)  // 'CREATE'
    console.log(error.table)      // 'user'
    console.log(error.params)     // { data: {...} }
    console.log(error.toJSON())   // 完整错误信息
  }
}
```

### 2. DatabaseConnectionError（连接错误）
数据库连接失败时抛出。

```typescript
import { DatabaseConnectionError } from '@/services/surrealdb-service'

try {
  await queryService.connect(serverUrl, config)
} catch (error) {
  if (error instanceof DatabaseConnectionError) {
    console.log('数据库连接失败:', error.message)
  }
}
```

### 3. QuerySyntaxError（查询语法错误）
SQL 语法错误时抛出。

```typescript
import { QuerySyntaxError } from '@/services/surrealdb-service'

try {
  await queryService.query('INVALID SQL')
} catch (error) {
  if (error instanceof QuerySyntaxError) {
    console.log('SQL 语法错误:', error.message)
  }
}
```

### 4. RecordNotFoundError（记录不存在）
查询或更新不存在的记录时抛出。

```typescript
import { RecordNotFoundError } from '@/services/surrealdb-service'

try {
  await queryService.select('user', 'non-existent-id')
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('记录不存在')
  }
}
```

## QueryService 错误处理

### 自动错误处理
所有 QueryService 方法都会自动：
1. 捕获错误
2. 记录详细日志（包括操作类型、表名、参数、耗时）
3. 解析 SurrealDB 错误信息
4. 包装成结构化错误对象

```typescript
// 示例：创建记录
const queryService = surrealDBService.getQueryService()

try {
  const user = await queryService.create('user', {
    name: 'John',
    email: 'john@example.com'
  })
  console.log('创建成功:', user)
} catch (error) {
  // 错误已经被包装和记录
  console.error('创建失败:', error.message)
}
```

### 错误日志示例

**成功操作：**
```
[DEBUG] DB CREATE succeeded {
  table: 'user',
  duration: '15ms',
  resultCount: 1
}
```

**失败操作：**
```
[ERROR] DB CREATE failed {
  table: 'user',
  params: { data: {...} },
  duration: '8ms',
  error: '记录已存在',
  details: 'user:john already exists',
  code: 'DUPLICATE'
}
```

## IPC Handler 错误处理

### 统一错误处理模式

所有 IPC Handler 都应该使用统一的错误处理：

```typescript
import { IPCErrorHandler } from '../ipc/error-handler-util'

export class MyIPCHandler extends BaseIPCHandler {
  async handleCreate(_event: IpcMainInvokeEvent, data: any) {
    try {
      // 验证输入
      if (!data.name) {
        return IPCErrorHandler.validationError('名称不能为空', 'name')
      }

      // 执行操作
      const result = await this.service.create(data)
      
      // 记录成功
      IPCErrorHandler.logSuccess('my-handler:create', { id: result.id })
      
      // 返回成功响应
      return IPCErrorHandler.success(result)
    } catch (error) {
      // 统一错误处理
      return IPCErrorHandler.handle('my-handler:create', error, { data })
    }
  }
}
```

### IPC 响应格式

**成功响应：**
```typescript
{
  success: true,
  data: {
    id: 'user:123',
    name: 'John',
    email: 'john@example.com'
  }
}
```

**错误响应（数据库错误）：**
```typescript
{
  success: false,
  error: {
    message: '数据库操作失败 [CREATE] user: 记录已存在',
    type: 'DATABASE_ERROR',
    operation: 'CREATE',
    table: 'user',
    details: {
      name: 'DatabaseOperationError',
      message: '...',
      operation: 'CREATE',
      table: 'user',
      params: {...}
    }
  }
}
```

**错误响应（验证错误）：**
```typescript
{
  success: false,
  error: {
    message: '名称不能为空',
    type: 'VALIDATION_ERROR',
    field: 'name'
  }
}
```

**错误响应（记录不存在）：**
```typescript
{
  success: false,
  error: {
    message: '知识库不存在 (ID: 123)',
    type: 'NOT_FOUND',
    id: 123
  }
}
```

## 前端错误处理

### 处理 IPC 响应

```typescript
// 在 datasource 中
async create(data: any) {
  const response = await window.api.knowledgeLibrary.create(data)
  
  if (!response.success) {
    // 根据错误类型处理
    switch (response.error?.type) {
      case 'DATABASE_ERROR':
        throw new Error(`数据库错误: ${response.error.message}`)
      case 'VALIDATION_ERROR':
        throw new Error(`验证失败: ${response.error.message}`)
      case 'NOT_FOUND':
        throw new Error(`资源不存在: ${response.error.message}`)
      default:
        throw new Error(response.error?.message || '未知错误')
    }
  }
  
  return response.data
}
```

### 在 Store 中显示错误

```typescript
// 在 Pinia store 中
import { ElMessage } from 'element-plus'

const knowledgeLibraryStore = defineStore('knowledgeLibrary', () => {
  const create = async (data: any) => {
    try {
      const result = await datasource.create(data)
      ElMessage.success('创建成功')
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建失败'
      ElMessage.error(message)
      throw error
    }
  }
  
  return { create }
})
```

## 调试技巧

### 1. 查看详细日志
在开发环境中，所有数据库操作都会记录详细日志：
- 操作类型（CREATE/SELECT/UPDATE/DELETE）
- 表名
- 参数
- 执行时间
- 结果数量或错误信息

### 2. 检查错误类型
使用 `isDatabaseError()` 判断是否为数据库错误：

```typescript
import { isDatabaseError } from '@/services/surrealdb-service'

try {
  await queryService.create('user', data)
} catch (error) {
  if (isDatabaseError(error)) {
    console.log('这是数据库错误')
    console.log('操作:', error.operation)
    console.log('表:', error.table)
  }
}
```

### 3. 查看操作日志
使用 `getOperationLogs()` 查看历史操作：

```typescript
const logs = await queryService.getOperationLogs({
  limit: 100,
  table: 'user',
  action: 'CREATE'
})

console.log('最近的创建操作:', logs)
```

## 常见错误场景

### 1. 连接未建立
```
错误: QueryService is not connected. Call connect() first.
解决: 确保在使用 QueryService 前已调用 connect()
```

### 2. 记录不存在
```
错误: Record not found: user:123
解决: 检查 ID 是否正确，或先查询确认记录存在
```

### 3. SQL 语法错误
```
错误: SQL 语法错误
解决: 检查 SQL 语句是否符合 SurrealDB 语法
```

### 4. 重复记录
```
错误: 记录已存在
解决: 检查唯一性约束，或使用 update 代替 create
```

## 最佳实践

1. **总是使用 try-catch**：所有数据库操作都应该包裹在 try-catch 中
2. **记录上下文信息**：在错误日志中包含足够的上下文（参数、状态等）
3. **向用户显示友好错误**：将技术错误转换为用户可理解的消息
4. **不要吞掉错误**：确保错误被正确传播到调用方
5. **使用类型检查**：使用 `isDatabaseError()` 等工具判断错误类型

## 迁移指南

### 旧代码（无错误处理）
```typescript
async handleCreate(_event: IpcMainInvokeEvent, data: any) {
  const result = await this.service.create(data)
  return result
}
```

### 新代码（完整错误处理）
```typescript
async handleCreate(_event: IpcMainInvokeEvent, data: any) {
  try {
    if (!data.name) {
      return IPCErrorHandler.validationError('名称不能为空', 'name')
    }
    
    const result = await this.service.create(data)
    IPCErrorHandler.logSuccess('handler:create', { id: result.id })
    return IPCErrorHandler.success(result)
  } catch (error) {
    return IPCErrorHandler.handle('handler:create', error, { data })
  }
}
```
