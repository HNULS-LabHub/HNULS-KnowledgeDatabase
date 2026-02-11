# 本项目实战规范（KnowledgeDatabase 专用）

> 本模块覆盖单例注入、QueryService 使用、并发安全、日志规范。编写本项目后端代码时必读。

## 1. 单例注入（最高优先级）

### 架构图

```
AppService (单例管理中心)
  ├─ SurrealDBService (单例) → 管理 surreal.exe 生命周期
  │   └─ QueryService (单例) → 唯一的查询入口
  ├─ BusinessServiceA → 通过 setQueryService() 注入
  └─ BusinessServiceB → 通过 setQueryService() 注入
```

### 禁止事项

- ❌ 在 IPC Handler / Bridge / Utility 中 `new SurrealDBQueryService()`
- ❌ 在 Service 构造器内自行创建 DB 连接
- ❌ 通过 `getDb()` 获取原始 `Surreal` 实例后绕过 QueryService 直接操作

### 注入时序（严格遵守）

```typescript
// 必须按此顺序执行，不可调换
1. await surrealDBService.initialize()
2. await surrealDBService.start()
3. const queryService = surrealDBService.getQueryService()  // 此时已连接
4. businessService.setQueryService(queryService)            // 注入
5. ipcManager.initialize(surrealDBService, businessService) // 传入已注入实例
```

### 常见错误

```typescript
// ❌ 错误：IPCManager 中创建新实例
initialize() {
  const service = new KnowledgeLibraryService() // 新实例，没有 QueryService！
  this.handlers.push(new KnowledgeLibraryIPCHandler(service))
}

// ✅ 正确：使用 AppService 提供的实例
initialize(surrealDBService, knowledgeLibraryService) {
  this.handlers.push(new KnowledgeLibraryIPCHandler(knowledgeLibraryService))
}
```

---

## 2. QueryService 使用规范

### 唯一查询实现源

路径：`Public/SharedUtils/surrealdb-query.ts`

Main Process 的 QueryService 是 SharedUtils 的**薄代理**，不得包含独立 CRUD 逻辑。Utility Process 直接使用 `SurrealDBQueryService`。

### CRUD 方法

```typescript
// 简单 CRUD
await queryService.create<T>(table, data)
await queryService.select<T>(table, id?)
await queryService.update<T>(table, id, data)
await queryService.delete(table, id)

// 复杂查询 — 必须参数化
await queryService.query<T>(
  'SELECT * FROM user WHERE age > $minAge',
  { minAge: 18 }
)

// 跨库查询
await queryService.queryInDatabase<T>(namespace, database, sql, params)
```

### 禁止事项

```typescript
// ❌ 禁止拼接 SQL
await queryService.query(`SELECT * FROM user WHERE name = '${name}'`)

// ❌ 禁止盲目取值
const count = result[0][0].count  // 可能 undefined

// ✅ 必须做类型断言和空值检查
const result = await queryService.query<[{ count: number }[]]>(countSql)
const rows = result?.[0]
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error('COUNT query returned unexpected format')
}
```

---

## 3. 并发安全：独占操作链

### opChain / runExclusive 机制

`SurrealDBQueryService` 内置 `runExclusive` 确保同一个 Surreal 实例上的操作**串行执行**。这是防止 `db.use()` 切换竞态（"串库"）的核心机制。

### 禁止事项

- ❌ 绕过 `executeWithErrorHandling` / `runExclusive` 直接调用 `this.db.query()`
- ❌ 在 `queryInDatabase` 之外手动调用 `db.use()` 切换数据库

### queryInDatabase 安全保证

```
1. 进入独占锁
2. db.use(目标库)
3. 执行查询
4. finally: db.use(恢复原库)
   - 恢复失败 + 主查询成功 → 抛 DatabaseOperationError（防止后续串库）
   - 恢复失败 + 主查询失败 → 抛主查询错误（恢复错误记录到 logger）
5. 释放锁
```

---

## 4. 错误处理

### 错误类型（统一从 SharedUtils 导入）

```typescript
import {
  DatabaseOperationError,
  DatabaseConnectionError,
  QuerySyntaxError,
  RecordNotFoundError
} from '@public/SharedUtils/surrealdb-query'
```

### Fail-Fast 原则

```typescript
// ✅ 写失败立即抛出
const result = await queryService.query(upsertSql, params)
if (!result || !result[0]) {
  throw new DatabaseOperationError(
    'UPSERT returned no result', 'UPSERT', table, params, null
  )
}

// ✅ QueryService 不可用时立即抛出
if (!this.queryService?.isConnected()) {
  throw new DatabaseConnectionError('QueryService not available')
}

// ❌ 禁止静默吞错
if (!result) {
  logger.warn('似乎失败了')
  return  // 数据丢失！
}

// ❌ 禁止降级返回空值
if (!this.queryService) {
  return []  // 前端以为"没数据"
}
```

---

## 5. 日志规范

### 禁止 console，必须使用 logger

| 进程 | logger 来源 |
|------|------------|
| Main Process | `logger` from `@main/services/logger` |
| Utility Process | 通过构造器注入 `SurrealDBLogger` 接口 |
| SharedUtils | 通过构造器注入 `SurrealDBLogger` 接口 |

### Logger 注入示例

```typescript
const sharedLogger: SurrealDBLogger = {
  debug: (msg, meta) => logger.debug(msg, { ...meta, instanceId }),
  info:  (msg, meta) => logger.info(msg, { ...meta, instanceId }),
  warn:  (msg, meta) => logger.warn(msg, { ...meta, instanceId }),
  error: (msg, meta) => logger.error(msg, { ...meta, instanceId }),
}
new SurrealDBQueryService({ logger: sharedLogger })
```

### 操作日志（operation_log）

- 默认写入 `operation_log` 表记录所有 CRUD 操作
- `queryInDatabase` **不**写入 operation_log（避免跨库写日志）
- 可通过 `setLogging(false)` 关闭（批量操作时推荐）
- `operationLogSource` 标识来源（`'electron_backend'` / `'vector_indexer'` 等）

---

## 6. Schema 管理

- Schema 定义放在 `surrealdb-service/schema/` 下，使用 TypeScript 描述
- 初始化时由 `SchemaManager` 执行 DEFINE TABLE / DEFINE FIELD / DEFINE INDEX
- Schema 变更必须向后兼容（不得直接 DROP TABLE）
- 新增表/字段必须更新 `tables.ts` 并通过 SchemaManager 验证

---

## 7. 连接生命周期

### 连接状态检查

所有 CRUD 方法内部首先调用 `ensureConnected()`。外部调用者应在依赖注入时机检查，而非每次调用前检查。

### Graceful Shutdown

```typescript
// AppService.shutdown() 中：
1. 停止所有 Bridge/Worker
2. await queryService.disconnect()
3. await surrealDBService.shutdown()  // 关闭 surreal.exe 进程
```

---

## 8. 新增服务检查清单

创建需要访问 SurrealDB 的新 Service 时：

1. ☐ 是否需要 QueryService？（操作 DB → 是 / 只读配置 → 否）
2. ☐ 在 `AppService.constructor()` 中创建实例
3. ☐ 在 `AppService.initialize()` 中注入 QueryService（在 start() 之后）
4. ☐ 在 `AppService` 中添加 getter 暴露给 IPC 层
5. ☐ 在 `IPCManager.initialize()` 中接收注入后的实例（不要 new）
6. ☐ 添加 `setQueryService()` 方法并记录注入日志
7. ☐ 所有 DB 操作使用 try/catch，错误向上抛出不吞掉
