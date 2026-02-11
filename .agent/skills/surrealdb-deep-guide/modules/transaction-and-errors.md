# 事务与错误处理

> 本模块覆盖 BEGIN/COMMIT/CANCEL 事务语法、THROW 手动回滚、错误类型。涉及事务或错误处理时必读。

## 1. 事务语法

### 基本结构

```sql
BEGIN TRANSACTION;
  CREATE person:tobie SET name = 'Tobie';
  CREATE person:jaime SET name = 'Jaime';
COMMIT TRANSACTION;
```

`TRANSACTION` 关键字可省略：`BEGIN;` ... `COMMIT;` 也合法。

### 三个关键字

| 关键字 | 作用 | 说明 |
|--------|------|------|
| `BEGIN` | 开启事务 | 后续语句在同一事务中执行 |
| `COMMIT` | 提交事务 | 所有变更持久化 |
| `CANCEL` | 取消事务 | 所有变更回滚 |

### ⚠️ 是 CANCEL，不是 ROLLBACK

SurrealQL 使用 `CANCEL` 而非 SQL 的 `ROLLBACK`。内部实现上 `cancel()` 就是执行回滚操作，但语法层面用的是 `CANCEL`。

---

## 2. 事务失败行为

### 自动回滚

如果事务中**任何一条语句失败**，整个事务自动取消，所有之前成功的操作也会回滚。

```sql
BEGIN;
  CREATE person:tobie;  -- 成功
  CREATE person:jaime;  -- 成功
  CREATE person:tobie;  -- 失败！重复 ID
COMMIT;
-- 结果：三条语句全部回滚，person:tobie 和 person:jaime 都不存在
```

失败后，所有语句的结果都会变为 `QueryNotExecuted` 或 `QueryCancelled` 错误。

### Drop 时自动回滚

如果事务对象在未显式 COMMIT 或 CANCEL 的情况下被销毁（如程序崩溃），写事务会自动回滚。这是安全兜底机制。

---

## 3. THROW — 手动中止事务

`THROW` 语句用于在事务中手动触发错误，导致事务回滚。

```sql
BEGIN;
  LET $user = (SELECT * FROM user:123);
  
  IF $user.balance < 100 {
    THROW "Insufficient balance";
  };
  
  UPDATE user:123 SET balance -= 100;
  CREATE purchase SET user = user:123, amount = 100;
COMMIT;
```

THROW 会产生 `SqlError::Thrown` 错误，触发与语句失败相同的回滚机制。

### IF ... THROW 模式

这是实现业务规则验证的常用模式：

```sql
BEGIN;
  -- 检查库存
  LET $stock = (SELECT quantity FROM product:abc).quantity;
  IF $stock < $requested_qty {
    THROW "Insufficient stock";
  };
  
  -- 检查余额
  LET $balance = (SELECT balance FROM user:123).balance;
  IF $balance < $total_price {
    THROW "Insufficient balance";
  };
  
  -- 执行操作
  UPDATE product:abc SET quantity -= $requested_qty;
  UPDATE user:123 SET balance -= $total_price;
  CREATE order SET user = user:123, product = product:abc, quantity = $requested_qty;
COMMIT;
```

---

## 4. 错误类型

### SurrealDB 内部错误类型

| 错误类型 | 含义 | 场景 |
|---------|------|------|
| `TxFinished` | 事务已结束 | 对已提交/取消的事务执行操作 |
| `TxReadonly` | 只读事务写入 | 在只读事务中尝试写操作 |
| `TxRetryable` | 可重试冲突 | 并发事务的读写冲突（乐观锁） |
| `TxKeyAlreadyExists` | 键已存在 | CREATE 重复记录 |
| `TxConditionNotMet` | 条件不满足 | 条件写入失败 |
| `Thrown` | 手动抛出 | THROW 语句 |

### 本项目错误类型层级

本项目在 `SharedUtils/surrealdb-query.ts` 中定义了统一的错误类型：

```
DatabaseOperationError (基类)
  ├─ QuerySyntaxError        — SQL 语法/跨库查询失败
  ├─ RecordNotFoundError     — 记录不存在
  └─ ConstraintViolationError — 约束违反（Main 特有）
DatabaseConnectionError       — 连接失败（独立类）
```

**禁止**在 Main Process 中重新定义这些类（`instanceof` 会失效）。Main 的错误类只做 re-export + 添加 Main 特有子类。

---

## 5. 错误处理原则：Fail-Fast

### 写操作必须 fail-fast

```typescript
// ✅ 正确：写失败立即抛出
const result = await queryService.query(upsertSql, params)
if (!result || !result[0]) {
  throw new DatabaseOperationError(
    'UPSERT returned no result', 'UPSERT', table, params, null
  )
}

// ❌ 禁止：warn + return（数据丢失风险）
if (!result) {
  logger.warn('UPSERT 似乎失败了')
  return  // 静默吞掉！前端以为成功了
}
```

### QueryService 不可用时

```typescript
// ✅ 正确：立即抛出
if (!this.queryService?.isConnected()) {
  throw new DatabaseConnectionError('QueryService not available or not connected')
}

// ❌ 禁止：降级返回空值
if (!this.queryService) {
  logger.warn('QueryService not available')
  return []  // 前端以为"没数据"，实际是注入失败
}
```

---

## 6. 查询结果验证

SurrealDB 的查询结果格式需要注意：

```typescript
// query() 返回的是数组的数组
const result = await queryService.query<[{ count: number }[]]>(
  'SELECT count() FROM user GROUP ALL'
)

// 必须做类型断言和空值检查
const rows = result?.[0]
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error('COUNT query returned unexpected format')
}
const count = rows[0].count
```

### 常见陷阱

```typescript
// ❌ 盲目取值 — 可能 undefined
const count = result[0][0].count

// ❌ 假设单条结果 — SELECT 总是返回数组
const user = await queryService.query('SELECT * FROM user:123')
// user 是 [[{ id: 'user:123', ... }]]，不是单个对象

// ✅ 正确处理
const [users] = await queryService.query<[any[]]>('SELECT * FROM user:123')
const user = users?.[0]
```
