---
name: SurrealDB Operations & Code Standards
description: 规范所有 SurrealDB 相关操作的编写方式，涵盖实例管理、查询模式、错误处理、并发安全、跨库查询、日志规范和类型安全。基于 KnowledgeDatabase 项目重构中总结的实战教训，防止"查询静默失败"、"并发串库"、"重复实例"三大顽疾。适用于 Main Process、Utility Process 及 SharedUtils 中所有与 SurrealDB 交互的代码。
---
## Skill 正文

### 1. 实例管理：单例 + 统一注入（最高优先级）

**原则**：整个应用生命周期中，`SurrealDBQueryService` 只能存在**一个实例**，通过 `AppService` 统一创建、注入、暴露。

```
AppService (单例管理中心)
  ├─ SurrealDBService (单例) → 管理 surreal.exe 生命周期
  │   └─ QueryService (单例) → 唯一的查询入口
  ├─ BusinessServiceA → 通过 setQueryService() 注入
  └─ BusinessServiceB → 通过 setQueryService() 注入
```
**禁止**：
- 在 IPC Handler / Bridge / Utility 中 `new SurrealDBQueryService()`
- 在 Service 构造器内自行创建 DB 连接
- 通过 `getDb()` 获取原始 `Surreal` 实例后绕过 QueryService 直接操作

**注入时序**（必须严格遵守）：
```
1. await surrealDBService.initialize()
2. await surrealDBService.start()
3. const queryService = surrealDBService.getQueryService()  // 此时已连接
4. businessService.setQueryService(queryService)            // 注入
5. ipcManager.initialize(surrealDBService, businessService) // 传入已注入实例
```
---

### 2. 查询操作规范

#### 2.1 必须使用 SharedUtils 的 `SurrealDBQueryService`
- Main Process 的 `QueryService` 是 SharedUtils 的**薄代理**（thin adapter），不得包含独立 CRUD 逻辑
- Utility Process 直接使用 `SurrealDBQueryService`，注入对应的 logger adapter

#### 2.2 CRUD 方法选择
```typescript
// ✅ 简单 CRUD — 使用封装方法
await queryService.create<T>(table, data)
await queryService.select<T>(table, id?)
await queryService.update<T>(table, id, data)
await queryService.delete(table, id)

// ✅ 复杂查询 — 使用 query()，必须参数化
await queryService.query<T>('SELECT * FROM user WHERE age > $minAge', { minAge: 18 })

// ❌ 禁止拼接 SQL
await queryService.query(`SELECT * FROM user WHERE name = '${name}'`)  // SQL 注入风险

// ✅ 跨库查询 — 使用 queryInDatabase()
await queryService.queryInDatabase<T>(namespace, database, sql, params)
```
#### 2.3 查询结果必须做类型断言和空值检查
```typescript
// ✅ 正确
const result = await queryService.query<[{ count: number }[]]>(countSql)
const rows = result?.[0]
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error('COUNT query returned unexpected format')
}
const count = rows[0].count

// ❌ 禁止盲目取值
const count = result[0][0].count  // 可能 undefined/null → 静默错误
```
---

### 3. 错误处理：Fail-Fast，禁止静默吞错

#### 3.1 错误类型层级（统一从 SharedUtils 导入）
```
DatabaseOperationError (基类)
  ├─ QuerySyntaxError        // SQL 语法/跨库查询失败
  ├─ RecordNotFoundError     // 记录不存在
  └─ ConstraintViolationError // Main 特有：约束违反
DatabaseConnectionError       // 连接失败（独立类）
```
**禁止**在 Main Process 中重新定义这些类（`instanceof` 会失效）。Main 的 `database-errors.ts` 只做 re-export + 添加 Main 特有子类。

#### 3.2 关键写入路径必须 fail-fast
```typescript
// ✅ 正确：写失败立即抛出
const upsertResult = await queryService.query(upsertSql, params)
if (!upsertResult || !upsertResult[0]) {
  throw new DatabaseOperationError('UPSERT returned no result', 'UPSERT', table, params, null)
}

// ❌ 禁止：warn + return（数据丢失）
if (!result) {
  logger.warn('UPSERT 似乎失败了')
  return  // 静默吞掉！
}
```
#### 3.3 QueryService 不可用时的处理
```typescript
// ✅ 正确：立即抛出，不降级
if (!this.queryService?.isConnected()) {
  throw new DatabaseConnectionError('QueryService not available or not connected')
}

// ❌ 禁止：降级返回空/默认值（掩盖注入失败）
if (!this.queryService) {
  logger.warn('QueryService not available')
  return []  // 前端以为"没数据"，实际是注入失败
}
```
---

### 4. 并发安全：独占操作链

#### 4.1 `runExclusive` 机制
`SurrealDBQueryService` 内置的 `opChain` 确保同一个 Surreal 实例上的操作**串行执行**。这是防止 `db.use()` 切换竞态（"串库"）的核心机制。

**禁止**：
- 绕过 `executeWithErrorHandling` / `runExclusive` 直接调用 `this.db.query()`
- 在 `queryInDatabase` 之外手动调用 `db.use()` 切换数据库

#### 4.2 `queryInDatabase` 的安全保证
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

### 5. 日志规范

#### 5.1 禁止 console，必须使用 logger
- Main Process：使用 `logger` from `@main/services/logger`
- Utility Process / SharedUtils：通过构造器注入 `SurrealDBLogger` 接口

```typescript
// ✅ 正确：注入 logger adapter
const sharedLogger: SurrealDBLogger = {
  debug: (msg, meta) => logger.debug(msg, { ...meta, instanceId }),
  info:  (msg, meta) => logger.info(msg, { ...meta, instanceId }),
  warn:  (msg, meta) => logger.warn(msg, { ...meta, instanceId }),
  error: (msg, meta) => logger.error(msg, { ...meta, instanceId }),
}
new SurrealDBQueryService({ logger: sharedLogger })
```
#### 5.2 操作日志（operation_log）
- 默认写入 `operation_log` 表记录所有 CRUD 操作
- `queryInDatabase` **不**写入 operation_log（避免跨库写日志）
- 可通过 `setLogging(false)` 关闭（批量操作时推荐）
- `operationLogSource` 标识来源（`'electron_backend'` / `'vector_indexer'` 等）

---

### 6. 连接生命周期

#### 6.1 连接状态检查
所有 CRUD 方法内部首先调用 `ensureConnected()`。外部调用者应在依赖注入时机检查，而非每次调用前检查。

#### 6.2 Graceful Shutdown
```typescript
// AppService.shutdown() 中：
1. 停止所有 Bridge/Worker
2. await queryService.disconnect()
3. await surrealDBService.shutdown()  // 关闭 surreal.exe 进程
```
---

### 7. Schema 管理

- Schema 定义放在 `surrealdb-service/schema/` 下，使用 TypeScript 描述（非 .surql 文件）
- 初始化时由 `SchemaManager` 执行 DEFINE TABLE / DEFINE FIELD / DEFINE INDEX
- Schema 变更必须向后兼容（不得直接 DROP TABLE）
- 新增表/字段必须更新 `tables.ts` 并通过 SchemaManager 的验证流程

---

### 8. 跨项目复用

`Public/SharedUtils/surrealdb-query.ts` 是**唯一的查询实现源**：
- 错误类、查询逻辑、并发锁全部在此定义
- Main QueryService 和 Utility Process 均委托到此
- 修改查询行为只需改此文件，两端自动生效
- **禁止**在 Main 或 Utility 中复制粘贴查询逻辑

---

### 9. 新增服务的检查清单

创建需要访问 SurrealDB 的新 Service 时：

1. **是否需要 QueryService？** 操作 DB → 是 / 只读配置文件 → 否
2. **在 `AppService.constructor()` 中创建实例**
3. **在 `AppService.initialize()` 中注入 QueryService**（在 `surrealDBService.start()` 之后）
4. **在 `AppService` 中添加 getter**，暴露给 IPC 层
5. **在 `IPCManager.initialize()` 中接收注入后的实例**（不要 new）
6. **添加 `setQueryService()` 方法**并记录注入日志
7. **所有 DB 操作使用 try/catch**，错误向上抛出不吞掉

---

以上就是完整的 skill 内容。名称和 description 总结：

- **名称**: `SurrealDB Operations & Code Standards`
- **Description**: 规范 SurrealDB 实例管理（单例注入）、查询模式（参数化/类型安全）、错误处理（fail-fast 禁止静默吞错）、并发安全（独占操作链防串库）、跨库查询（queryInDatabase 安全保证）、日志规范（禁止 console）、Schema 管理及跨项目复用策略。适用于 Main/Utility/SharedUtils 所有 SurrealDB 交互代码。