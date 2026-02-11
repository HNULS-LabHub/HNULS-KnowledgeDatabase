# 图模型与关系

> 本模块覆盖 RELATE 创建边、箭头遍历语法、边属性筛选、FETCH 策略。涉及关联数据或图查询时必读。

## 1. 核心概念：SurrealDB 是文档 + 图的混合体

SurrealDB 不需要 JOIN。关联数据通过两种方式表达：
- **Record ID 引用**：字段直接存储另一条记录的 Record ID（类似外键）
- **图边（Edge）**：通过 RELATE 创建的有向边，边本身也是记录，可以有属性

---

## 2. RELATE — 创建图边

### 基本语法

```sql
RELATE from_record->edge_table->to_record [SET/CONTENT/MERGE ...];
```

### 示例

```sql
-- 用户购买商品
RELATE user:alice->purchased->product:laptop
  SET quantity = 1, price = 999.99, purchased_at = time::now();

-- 用户关注用户
RELATE user:alice->follows->user:bob;

-- 文档属于项目
RELATE document:doc1->belongs_to->project:proj1;
```

### 边是记录

RELATE 创建的边本身就是一条记录，存储在 edge_table 中。它有：
- 自动生成的 `id`（如 `purchased:abc123`）
- `in` 字段 — 指向起始记录
- `out` 字段 — 指向目标记录
- 你通过 SET 添加的任何属性

### 内部存储：四个方向指针

每条边在底层存储四个键，确保双向遍历高效：

```
1. 左指针（from → edge）：从起始记录出发找到边
2. 左内指针（edge ← from）：从边找到起始记录
3. 右内指针（edge → to）：从边找到目标记录
4. 右指针（to ← edge）：从目标记录反向找到边
```

这意味着无论从哪个方向遍历，都是直接索引查找，不需要全表扫描。

---

## 3. 箭头遍历语法

### 三种方向

| 语法 | 方向 | 含义 |
|------|------|------|
| `->` | 出边（Out） | 从当前记录出发的边 |
| `<-` | 入边（In） | 指向当前记录的边 |
| `<->` | 双向（Both） | 两个方向都遍历 |

### 基本遍历

```sql
-- 查询 alice 购买了哪些商品
SELECT ->purchased->product FROM user:alice;

-- 查询哪些用户购买了 laptop
SELECT <-purchased<-user FROM product:laptop;

-- 查询 alice 的所有关联（双向）
SELECT <->follows<->user FROM user:alice;
```

### 多跳遍历

```sql
-- 3 跳：用户 → 购买 → 商品 → 品牌名称
SELECT ->purchased->product->brand.name FROM user:alice;

-- 2 跳：用户 → 关注 → 用户的名字
SELECT ->follows->user.name FROM user:alice;
```

### 边属性筛选

```sql
-- 筛选边上的属性
SELECT ->(purchased WHERE price > 500)->product FROM user:alice;

-- 更复杂的筛选
SELECT ->(SELECT * FROM purchased WHERE purchased_at > time::now() - 30d)->product
FROM user:alice;

-- 边上的聚合
SELECT ->(SELECT count() as count, SUM(price) as total FROM purchased GROUP ALL)
FROM user:alice;

-- 限制数量
SELECT ->(purchased LIMIT 5)->product FROM user:alice;

-- 排序
SELECT ->(SELECT * FROM purchased ORDER BY purchased_at DESC)->product FROM user:alice;
```

---

## 4. FETCH — 加载关联数据

### 问题场景

默认情况下，Record ID 引用字段只返回 ID 字符串：

```sql
SELECT * FROM order;
-- 结果：{ id: 'order:1', user: 'user:alice', product: 'product:laptop' }
-- user 和 product 只是 ID，不是完整对象
```

### FETCH 解决方案

```sql
SELECT * FROM order FETCH user, product;
-- 结果：{
--   id: 'order:1',
--   user: { id: 'user:alice', name: 'Alice', ... },
--   product: { id: 'product:laptop', name: 'Laptop', ... }
-- }
```

### FETCH vs 子查询

| 方式 | 返回结构 | 适用场景 |
|------|---------|---------|
| `FETCH` | 直接展开为完整对象 | 前端直接渲染（推荐） |
| 子查询 | 嵌套数组 | 需要对关联数据做额外处理 |

```sql
-- FETCH：返回扁平对象（推荐用于 Electron/Vue）
SELECT * FROM order FETCH user

-- 子查询：返回嵌套数组
SELECT *, (SELECT * FROM user WHERE id = $parent.user) AS user_detail FROM order
```

**Electron/Vue 场景推荐 FETCH**，返回的 JSON 结构与 Vue 组件 props 直接匹配，无需二次处理。

---

## 5. 关系表定义

```sql
-- 定义关系表（用于 RELATE 的边）
DEFINE TABLE purchased TYPE RELATION;

-- 带 Schema 的关系表
DEFINE TABLE purchased TYPE RELATION SCHEMAFULL;
DEFINE FIELD quantity ON TABLE purchased TYPE int;
DEFINE FIELD price ON TABLE purchased TYPE decimal;
DEFINE FIELD purchased_at ON TABLE purchased TYPE datetime DEFAULT time::now();

-- 带约束的关系表（强制边的两端类型）
DEFINE TABLE purchased TYPE RELATION
  FROM user
  TO product;
```

### 强制关系（enforced）

当关系表定义了 `FROM` 和 `TO` 约束时，SurrealDB 会在创建边时验证两端记录是否存在。

---

## 6. 图查询 vs JOIN 思维对照

| SQL 思维 | SurrealDB 做法 |
|---------|---------------|
| `SELECT * FROM orders JOIN users ON orders.user_id = users.id` | `SELECT * FROM order FETCH user` |
| `SELECT * FROM users JOIN orders ON users.id = orders.user_id` | `SELECT *, ->purchased->product FROM user` |
| 多对多关系表 | `RELATE a->edge->b`（边本身就是关系） |
| 自关联（如组织树） | `SELECT ->reports_to->employee FROM employee:ceo` |
| 递归查询（CTE） | 多跳遍历 `->edge->table->edge->table` |

---

## ⚠️ 不确定时必须查询

图查询的语法细节很多，如果遇到以下情况必须查 deepwiki：
- 不确定某种遍历语法是否合法
- 不确定 FETCH 能否嵌套多层
- 涉及递归遍历的深度限制
- 涉及图索引和性能优化

```
mcp_deepwiki_ask_question(
  repoName: "surrealdb/surrealdb",
  question: "<具体问题>"
)
```
