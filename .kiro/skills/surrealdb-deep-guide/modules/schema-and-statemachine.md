# Schema 设计与状态机

> 本模块覆盖 DEFINE FIELD/EVENT/ASSERT、COMPUTED 字段、有限状态机（FSM）设计模式。设计 Schema 或状态流转时必读。

## 1. DEFINE FIELD — 字段定义与约束

### 基本语法

```sql
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD age ON TABLE user TYPE int;
DEFINE FIELD email ON TABLE user TYPE string
  ASSERT string::is::email($value);
DEFINE FIELD status ON TABLE order TYPE string
  ASSERT $value INSIDE ['pending', 'paid', 'shipped', 'done'];
```

### 可用子句

| 子句 | 作用 | 说明 |
|------|------|------|
| `TYPE` | 类型约束 | 支持 `option<T>` 表示可选 |
| `DEFAULT` | 默认值 | 记录创建时未提供则使用默认值 |
| `VALUE` | 写时计算 | 每次创建/更新时执行表达式并存储结果 |
| `ASSERT` | 验证规则 | 表达式必须返回 true，否则拒绝写入 |
| `PERMISSIONS` | 字段级权限 | 控制谁能读写此字段 |
| `READONLY` | 只读 | 创建后不可修改 |
| `FLEXIBLE` | 灵活模式 | 允许嵌套字段不受 schema 约束 |
| `COMPUTED` | 读时计算 | 每次查询时动态计算（不存储） |

### ASSERT — 字段验证

ASSERT 在字段处理管道中执行，**验证发生在值存储之前**。

可用的上下文变量：
- `$value` — 当前要写入的值
- `$before` — 更新前的记录（仅 UPDATE 时可用）
- `$after` — 更新后的记录
- `$input` — 用户原始输入值

```sql
-- 枚举约束
DEFINE FIELD status ON TABLE task TYPE string
  ASSERT $value INSIDE ['todo', 'doing', 'done'];

-- 正则约束
DEFINE FIELD code ON TABLE product TYPE string
  ASSERT $value = /^[A-Z]{2}-\d{4}$/;

-- 范围约束
DEFINE FIELD age ON TABLE user TYPE int
  ASSERT $value >= 0 AND $value <= 150;

-- 非空约束
DEFINE FIELD name ON TABLE user TYPE string
  ASSERT $value != NONE AND $value != '';
```

### VALUE vs COMPUTED

这两个子句**互斥**，不能同时使用。

| 特性 | VALUE | COMPUTED |
|------|-------|---------|
| 计算时机 | 写入时（CREATE/UPDATE） | 读取时（SELECT） |
| 是否存储 | ✅ 存储计算结果 | ❌ 不存储，每次查询重新计算 |
| 可搭配 | TYPE, ASSERT, DEFAULT, READONLY | 仅 TYPE, PERMISSIONS |
| 适用场景 | 写入时确定的值（如 updated_at） | 动态派生值（如年龄、统计） |

```sql
-- VALUE：写入时计算并存储
DEFINE FIELD updated_at ON TABLE doc TYPE datetime
  VALUE time::now();

-- COMPUTED：每次查询时动态计算
DEFINE FIELD can_drive ON TABLE person
  COMPUTED time::now() > birthday + 18y;

-- COMPUTED：反向关联（图遍历）
DEFINE FIELD authored ON TABLE person
  COMPUTED <~post;
```

---

## 2. DEFINE EVENT — 事件触发器

### 基本语法

```sql
DEFINE EVENT event_name ON TABLE table_name
  WHEN condition
  THEN (action);
```

### 可用的上下文变量

| 变量 | 说明 | 可用时机 |
|------|------|---------|
| `$before` | 变更前的记录状态 | UPDATE, DELETE |
| `$after` | 变更后的记录状态 | CREATE, UPDATE |
| `$event` | 操作类型字符串 | 始终可用 |
| `$this` | 当前记录的 Record ID | 始终可用 |
| `$value` | 等同于 `$after` | CREATE, UPDATE |

`$event` 的值为：`'CREATE'`, `'UPDATE'`, `'DELETE'`

### 示例

```sql
-- 邮箱变更时记录活动日志
DEFINE EVENT email_changed ON TABLE user
  WHEN $before.email != $after.email
  THEN (
    CREATE activity SET
      user = $this,
      old_email = $before.email,
      new_email = $after.email,
      action = $event,
      timestamp = time::now()
  );

-- 仅在 UPDATE 时触发
DEFINE EVENT on_update ON TABLE doc
  WHEN $event = 'UPDATE'
  THEN (
    UPDATE $this SET updated_at = time::now()
  );

-- 删除时级联清理
DEFINE EVENT on_delete ON TABLE project
  WHEN $event = 'DELETE'
  THEN (
    DELETE task WHERE project = $this
  );
```

---

## 3. 有限状态机（FSM）设计模式

结合 DEFINE FIELD ASSERT + DEFINE EVENT，可以在数据库层实现完整的状态机。

### 设计思路

```
1. 用 DEFINE FIELD ASSERT 约束合法状态值
2. 用 DEFINE FIELD ASSERT + $before 约束合法状态转换路径
3. 用 DEFINE EVENT 在状态变更时触发副作用
```

### 完整示例：订单状态机

```sql
-- 1. 定义表
DEFINE TABLE order SCHEMAFULL;

-- 2. 定义字段
DEFINE FIELD customer ON TABLE order TYPE record<user>;
DEFINE FIELD items ON TABLE order TYPE array<object>;
DEFINE FIELD total ON TABLE order TYPE decimal;
DEFINE FIELD created_at ON TABLE order TYPE datetime
  DEFAULT time::now()
  READONLY;

-- 3. 状态字段 + 枚举约束
DEFINE FIELD status ON TABLE order TYPE string
  DEFAULT 'created'
  ASSERT $value INSIDE ['created', 'paid', 'shipped', 'completed', 'cancelled'];

-- 4. 状态转换守卫（核心）
-- 只允许合法的状态转换路径
DEFINE FIELD status ON TABLE order TYPE string
  DEFAULT 'created'
  ASSERT $value INSIDE ['created', 'paid', 'shipped', 'completed', 'cancelled']
    AND (
      -- 新建记录允许任何初始状态
      $before = NONE
      -- 或者是合法的状态转换
      OR ($before.status = 'created' AND $value INSIDE ['paid', 'cancelled'])
      OR ($before.status = 'paid' AND $value INSIDE ['shipped', 'cancelled'])
      OR ($before.status = 'shipped' AND $value = 'completed')
      -- 终态不可变更
      -- completed 和 cancelled 不在任何 OR 分支中，自然不可变更
    );

-- 5. 状态变更事件 — 自动创建通知
DEFINE EVENT order_status_changed ON TABLE order
  WHEN $before.status != $after.status
  THEN (
    CREATE notification SET
      target = $after.customer,
      message = 'Order status changed to ' + $after.status,
      order = $this,
      created_at = time::now()
  );

-- 6. 支付完成事件 — 更新统计
DEFINE EVENT order_paid ON TABLE order
  WHEN $before.status = 'created' AND $after.status = 'paid'
  THEN (
    UPDATE $after.customer SET stats.total_spent += $after.total
  );
```

### 状态转换图

```
created → paid → shipped → completed
   ↓        ↓
cancelled  cancelled
```

### 设计要点

1. **终态保护**：`completed` 和 `cancelled` 不出现在任何转换的起始状态中，自然不可变更
2. **原子性**：ASSERT 在写入前验证，EVENT 在写入后触发，整个过程在同一事务中
3. **可审计**：通过 EVENT 自动记录所有状态变更
4. **前端友好**：前端只需 `UPDATE order:xxx SET status = 'paid'`，数据库自动验证和触发副作用

---

## 4. DEFINE TABLE 选项

```sql
-- 普通表（默认）
DEFINE TABLE user;

-- 严格模式（只允许已定义的字段）
DEFINE TABLE user SCHEMAFULL;

-- 灵活模式（允许未定义的字段，但已定义的字段仍受约束）
DEFINE TABLE user SCHEMALESS;

-- 关系表（用于 RELATE 创建的边）
DEFINE TABLE likes TYPE RELATION;

-- 带权限的表
DEFINE TABLE user PERMISSIONS
  FOR select FULL
  FOR create WHERE $auth.role = 'admin'
  FOR update WHERE id = $auth.id
  FOR delete WHERE $auth.role = 'admin';
```

---

## ⚠️ 不确定时必须查询

Schema 设计涉及的细节很多，如果遇到以下情况必须查 deepwiki：
- 不确定某个 ASSERT 表达式是否合法
- 不确定 EVENT 中能否执行某种操作
- 不确定 COMPUTED 字段的性能影响
- 涉及 DEFINE INDEX、DEFINE ACCESS 等本模块未覆盖的内容

```
mcp_deepwiki_ask_question(
  repoName: "surrealdb/surrealdb",
  question: "<具体问题>"
)
```
