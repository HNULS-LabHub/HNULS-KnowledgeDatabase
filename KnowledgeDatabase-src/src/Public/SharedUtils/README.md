# SharedUtils - 跨进程共享工具库

## 📌 概述

本目录包含从 Main Process 的 `QueryService` 提取并提权的 SurrealDB CRUD 操作，使其可以在所有进程中共享使用。

## 🎯 核心特性

### 1. 统一的错误处理

- ✅ 所有数据库错误自动打印 **error 级别日志**
- ✅ 详细的错误上下文（操作类型、表名、参数、执行时长）
- ✅ 自定义错误类型（DatabaseOperationError、RecordNotFoundError 等）

### 2. 类型安全的 CRUD 操作

- `create()` - 创建记录
- `select()` - 查询记录（支持单条/全部）
- `update()` - 更新记录
- `delete()` - 删除记录
- `query()` - 原始 SQL 查询

### 3. 高级功能

- `queryInDatabase()` - 跨数据库查询
- `vectorSearch()` - 向量检索（KNN）
- `getOperationLogs()` - 查询操作日志

## 📁 目录结构

```
SharedUtils/
├── README.md              # 本文件
├── index.ts               # 统一导出
└── surrealdb-query.ts     # SurrealDB 查询服务类
```

## 🚀 使用方式

### 在 Embedding Engine (Utility Process) 中使用

```typescript
// src/utility/embedding-engine/core/db-manager.ts
import { SurrealDBQueryService } from '@shared-utils'

export class DBManager {
  private queryService: SurrealDBQueryService

  constructor() {
    this.queryService = new SurrealDBQueryService()
  }

  async initialize(serverUrl: string) {
    // 连接数据库
    await this.queryService.connect(serverUrl, {
      username: 'root',
      password: 'root',
      namespace: 'test',
      database: 'test'
    })
  }

  async saveChunkEmbedding(chunkId: string, embedding: number[]) {
    // 创建记录
    return this.queryService.create('chunk', {
      id: chunkId,
      embedding: embedding,
      created_at: new Date()
    })
  }

  async getChunk(chunkId: string) {
    // 查询记录
    return this.queryService.select('chunk', chunkId)
  }
}
```

### 在 Main Process 中使用

```typescript
// src/main/services/my-service.ts
import { SurrealDBQueryService, DatabaseOperationError } from '@shared-utils'

export class MyService {
  private db = new SurrealDBQueryService()

  async init() {
    await this.db.connect('ws://localhost:8000', {
      username: 'root',
      password: 'root',
      namespace: 'app',
      database: 'main'
    })
  }

  async createUser(name: string, age: number) {
    try {
      const user = await this.db.create('user', { name, age })
      return user
    } catch (error) {
      // 错误已经被自动记录为 error 级别日志
      if (error instanceof DatabaseOperationError) {
        console.log('操作失败:', error.operation, error.table)
      }
      throw error
    }
  }
}
```

### 在 Renderer Process 中使用（通过 Preload）

```typescript
// src/preload/api/database-api.ts
import { SurrealDBQueryService } from '@shared-utils'

export function createDatabaseAPI() {
  const db = new SurrealDBQueryService()

  return {
    async query(sql: string, params?: any) {
      return await db.query(sql, params)
    }
  }
}
```

## 📦 API 文档

### SurrealDBQueryService

#### 连接管理

```typescript
// 连接数据库
await queryService.connect(serverUrl: string, config: SurrealDBConfig)

// 断开连接
await queryService.disconnect()

// 检查连接状态
const isConnected = queryService.isConnected()

// 获取当前命名空间/数据库
const namespace = queryService.getNamespace()
const database = queryService.getDatabase()
```

#### CRUD 操作

```typescript
// 创建记录
const user = await queryService.create<User>('user', {
  name: 'John',
  age: 30
})

// 查询所有记录
const users = await queryService.select<User>('user')

// 查询单条记录
const john = await queryService.select<User>('user', 'user_123')

// 更新记录
const updated = await queryService.update<User>('user', 'user_123', {
  age: 31
})

// 删除记录
await queryService.delete('user', 'user_123')
```

#### 高级查询

```typescript
// 原始 SQL 查询
const result = await queryService.query(`
  SELECT * FROM user WHERE age > $age
`, { age: 18 })

// 跨数据库查询
const result = await queryService.queryInDatabase(
  'other_namespace',
  'other_database',
  'SELECT * FROM table'
)

// 向量检索
const results = await queryService.vectorSearch(
  'knowledge',
  'kb_001',
  queryVector,
  k: 10,      // 返回前 10 个结果
  ef: 100     // HNSW ef 参数
)
```

#### 日志查询

```typescript
// 查询操作日志
const logs = await queryService.getOperationLogs({
  limit: 100,
  table: 'user',
  action: 'CREATE',
  startDate: new Date('2024-01-01'),
  endDate: new Date()
})
```

## ⚠️ 错误处理

所有数据库操作失败时会自动打印 **error 级别日志**，包含以下信息：

```typescript
console.error('[SurrealDBQueryService] DB CREATE failed', {
  table: 'user',
  params: { data: { name: 'John', age: 30 } },
  duration: '45ms',
  error: '记录已存在',
  details: 'Duplicate key value...',
  code: 'DUPLICATE'
})
```

### 错误类型

```typescript
import {
  DatabaseOperationError, // 数据库操作错误基类
  DatabaseConnectionError, // 连接错误
  QuerySyntaxError, // SQL 语法错误
  RecordNotFoundError // 记录不存在
} from '@shared-utils'

try {
  await db.select('user', 'not_exist_id')
} catch (error) {
  if (error instanceof RecordNotFoundError) {
    console.log('记录不存在')
  } else if (error instanceof DatabaseOperationError) {
    console.log('操作失败:', error.operation, error.table)
  }
}
```

## 🔧 配置

### 路径别名

已在 `tsconfig.node.json` 和 `electron.vite.config.ts` 中配置：

```json
{
  "paths": {
    "@shared-utils": ["src/Public/SharedUtils"],
    "@shared-utils/*": ["src/Public/SharedUtils/*"]
  }
}
```

### 使用导入

```typescript
// 方式 1: 导入特定类/函数
import { SurrealDBQueryService, parseSurrealDBError } from '@shared-utils'

// 方式 2: 导入类型
import type { SurrealDBConfig } from '@shared-utils'

// 方式 3: 从特定文件导入
import { SurrealDBQueryService } from '@shared-utils/surrealdb-query'
```

## 📊 与原 QueryService 的区别

| 特性         | 原 QueryService (Main Process) | SurrealDBQueryService (Shared)   |
| ------------ | ------------------------------ | -------------------------------- |
| **运行位置** | 仅 Main Process                | 所有进程（Main/Utility/Preload） |
| **日志系统** | 使用 logger 服务               | 使用 console.error/debug         |
| **服务追踪** | 有 ServiceTracker              | 无（轻量级）                     |
| **日志来源** | `electron_backend`             | `shared_utils`                   |
| **依赖**     | 依赖 logger 服务               | 无额外依赖                       |

## 🔄 迁移指南

如果你已经在使用 Main Process 的 `QueryService`，可以这样迁移：

### Before (仅在 Main Process)

```typescript
import { QueryService } from '@/services/surrealdb-service'

const queryService = new QueryService()
await queryService.connect(url, config)
```

### After (在任何进程)

```typescript
import { SurrealDBQueryService } from '@shared-utils'

const queryService = new SurrealDBQueryService()
await queryService.connect(url, config)
```

API 完全兼容，无需修改业务代码！

## ✅ 最佳实践

1. **错误处理**: 所有错误已自动打印日志，业务代码只需 catch 后处理逻辑

   ```typescript
   try {
     await db.create('user', data)
   } catch (error) {
     // 错误已经被打印，这里只需要业务处理
     return { success: false }
   }
   ```

2. **连接复用**: 在进程生命周期内复用同一个实例

   ```typescript
   // ✅ 好 - 全局单例
   const globalDB = new SurrealDBQueryService()

   // ❌ 差 - 每次创建新实例
   function doSomething() {
     const db = new SurrealDBQueryService()
     await db.connect(...)
   }
   ```

3. **类型安全**: 使用泛型指定返回类型

   ```typescript
   interface User {
     id: string
     name: string
     age: number
   }

   const user = await db.select<User>('user', 'user_123')
   // user 的类型是 User
   ```

## 🚦 下一步

1. **在 Embedding Engine 中集成**
   - 在 embedding-engine 中创建 DB Manager
   - 使用 `SurrealDBQueryService` 存储 chunk embeddings
2. **扩展功能**
   - 添加批量操作（batchCreate、batchUpdate）
   - 添加事务支持
   - 添加连接池管理

3. **性能优化**
   - 实现查询缓存
   - 添加连接重试机制
   - 实现请求队列

---

**创建时间**: 2026-01-30  
**版本**: v1.0  
**来源**: 从 `src/main/services/surrealdb-service/query-service.ts` 提取
