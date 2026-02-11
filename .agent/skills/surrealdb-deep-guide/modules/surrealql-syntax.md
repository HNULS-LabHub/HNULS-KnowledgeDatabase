# SurrealQL 语法精要

> 本模块覆盖 Record ID、类型系统、参数化查询、类型强转。编写任何 SurrealQL 时应先阅读。

## 1. Record ID — 不是主键，是指针

SurrealDB 的 Record ID 采用 `table:key` 格式。它不是传统的自增整数，而是一个**包含表名的全局唯一指针**。

### 支持的 Key 类型

| 类型 | 示例 | 说明 |
|------|------|------|
| Number | `user:1` | i64 整数 |
| String | `user:admin` | 字符串标识符 |
| UUID | `city:u'8e60244d-95f6-4f95-9e30-09a98977efb0'` | 以 `u'` 或 `u"` 前缀 |
| Array | `temperature:['London', d'2022-09-30T20:25:01Z']` | 复合键 |
| Object | `person:{ name: 'John', age: 30 }` | 对象键 |
| Generated | `user:rand()`, `user:ulid()`, `user:uuid()` | 自动生成 |

### 自动生成方式

- `rand()` — 随机 ID（默认，不指定 ID 时使用）
- `ulid()` — 时间排序的 ULID，适合需要按创建时间排序的场景
- `uuid()` — 标准 UUID

### 多态引用

一个字段可以存储**不同表**的 Record ID。例如 `created_by` 字段既可以是 `user:001` 也可以是 `bot:002`。查询时无需 UNION，SurrealDB 原生支持多态 Record ID。

### 实用函数

- `record::id(record_id)` — 提取 ID 部分
- `record::tb(record_id)` — 提取表名部分

### 反模式

- ❌ Range ID 不能作为文档 ID（代码层面显式拒绝）
- ❌ ID 中使用过多特殊字符（影响可读性和调试）
- ❌ ID 过长（增加索引存储压力）
- ❌ 用字符串拼接构造 Record ID（应使用 `type::record()` 或直接写 `table:key`）

---

## 2. 类型系统

SurrealDB 是强类型的文档数据库。核心值类型包括：

| SurrealQL 类型 | 说明 | JS/TS SDK 对应 |
|---------------|------|---------------|
| `none` | 值不存在（类似 undefined） | `undefined` |
| `null` | 显式空值 | `null` |
| `bool` | 布尔值 | `boolean` |
| `int` / `float` / `decimal` | 数值类型 | `number`（大整数和 decimal 有特殊处理） |
| `string` | 字符串 | `string` |
| `datetime` | 日期时间 | `Date` 对象（自动转换） |
| `duration` | 时间段（如 `1d`, `2h30m`） | SDK `Duration` 类 |
| `uuid` | UUID | SDK `Uuid` 类 |
| `array` | 数组 | `Array` |
| `object` | 对象 | `Object` |
| `record` | Record ID 引用 | SDK `RecordId` 类 |
| `geometry` | 地理空间类型 | GeoJSON 对象 |
| `bytes` | 二进制数据 | `TypedArray` |

---

## 3. 参数化查询（必须使用）

### 为什么必须参数化

SurrealQL 支持参数占位符 `$variable`。**禁止字符串拼接**，原因：
- 防止 SurrealQL 注入
- 类型自动转换（SDK 会正确处理 Date → datetime 等）
- 查询可缓存和复用

### 正确用法

```typescript
// ✅ 正确：参数化
await db.query('SELECT * FROM user WHERE age > $minAge', { minAge: 18 })

// ✅ 正确：多参数
await db.query(
  'CREATE user SET name = $name, email = $email, created_at = $now',
  { name: 'Alice', email: 'alice@example.com', now: new Date() }
)

// ❌ 禁止：字符串拼接
await db.query(`SELECT * FROM user WHERE name = '${name}'`)
```

### SDK 绑定方式

- `.bind(key, value)` — 查询级绑定，仅对当前查询生效
- `.set(key, value)` — 连接级绑定，对后续所有查询生效（存储在 RouterState.vars 中，重连后自动重放）

---

## 4. 类型强转

当需要显式转换类型时，使用 `type::` 系列函数：

```sql
-- 字符串转 Record ID
type::record("user:123")

-- 字符串转日期
type::datetime("2024-01-01T00:00:00Z")

-- 字符串转时间段
type::duration("1d2h")

-- 转字符串
type::string(123)

-- 类型检查
type::is::string($value)
type::is::record($value)
type::is::datetime($value)
```

### 方法式调用（链式语法）

```sql
SELECT value.to_datetime(), value.to_string() FROM data
```

支持的方法：`to_array`, `to_bool`, `to_bytes`, `to_datetime`, `to_decimal`, `to_duration`, `to_float`, `to_int`, `to_number`, `to_point`, `to_range`, `to_record`, `to_string`, `to_uuid`

### JS/TS SDK 自动类型转换

SDK 在传参和接收结果时会自动转换：

| JS/TS 类型 | → SurrealQL 类型 | 说明 |
|-----------|-----------------|------|
| `Date` | `datetime` | 使用毫秒时间戳转换 |
| `string` | `string` | 直接映射 |
| `number` | `int` 或 `float` | 根据值自动判断 |
| `boolean` | `bool` | 直接映射 |
| `Array` | `array` | 递归转换元素 |
| `Object` | `object` | 递归转换属性 |
| SDK `RecordId` | `record` | Record ID 对象 |
| SDK `Uuid` | `uuid` | UUID 对象 |
| SDK `Duration` | `duration` | 时间段对象 |

---

## 5. 时间操作

```sql
-- 当前时间
time::now()

-- 时间运算（duration 字面量）
time::now() - 1d        -- 1 天前
time::now() - 2h30m     -- 2.5 小时前
time::now() + 7d        -- 7 天后

-- 时间比较
SELECT * FROM events WHERE created_at > time::now() - 1d

-- 时间提取
time::year(created_at)
time::month(created_at)
time::day(created_at)
```

Duration 字面量支持：`ns`(纳秒), `us`(微秒), `ms`(毫秒), `s`(秒), `m`(分), `h`(时), `d`(天), `w`(周), `y`(年)

---

## ⚠️ 不确定时必须查询

如果遇到本模块未覆盖的语法或函数，**必须**使用 deepwiki 查询：

```
mcp_deepwiki_ask_question(
  repoName: "surrealdb/surrealdb",
  question: "<具体的语法或函数问题>"
)
```

禁止凭 SQL 经验推测 SurrealQL 行为。
