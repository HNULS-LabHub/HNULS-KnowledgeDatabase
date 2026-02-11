# 数据操作范式

> 本模块覆盖 SET/MERGE/CONTENT/PATCH 的行为差异、+=/-= 操作符陷阱、NONE vs NULL 语义。做数据创建/更新操作时必读。

## 1. 四种更新方式对比（核心避坑区）

这是 SurrealDB 新手最容易踩坑的地方。四种方式对已有字段、数组、嵌套对象的处理**完全不同**。

### 对比表

| 操作 | 未提及的字段 | 数组字段 | 嵌套对象 | 适用场景 |
|------|------------|---------|---------|---------|
| `SET field = value` | 保留不动 | 整体替换 | 可用点号精确更新 | 精确更新单个/多个字段 |
| `CONTENT {...}` | **删除** | 整体替换 | 整体替换 | 完全重写整个文档 |
| `MERGE {...}` | 保留不动 | **整体替换** | **递归合并** | 部分更新，保留未提及字段 |
| `PATCH [...]` | 保留不动 | 支持索引操作 | 支持路径操作 | 精确的结构化修改（RFC 6902） |

### 详细说明

#### SET — 逐字段赋值
```sql
-- 只更新 name，其他字段不变
UPDATE user:1 SET name = 'Alice';

-- 点号语法更新嵌套字段
UPDATE user:1 SET address.city = 'Beijing';

-- 支持 +=, -= 操作符
UPDATE user:1 SET tags += 'new_tag';
UPDATE user:1 SET score += 10;
```

#### CONTENT — 完全替换（危险！）
```sql
-- ⚠️ 这会删除 user:1 上所有未提及的字段！
UPDATE user:1 CONTENT {
  name: 'Alice',
  email: 'alice@example.com'
};
-- 如果之前有 age, address 等字段，它们会被删除
```

#### MERGE — 递归合并对象，但替换数组
```sql
UPDATE person:test MERGE {
  name: {
    title: 'Mr',
    initials: NONE,        -- ← NONE 会删除这个字段
    suffix: ['BSc', 'MSc'] -- ← 数组会被整体替换，不是追加
  }
};
```

MERGE 的关键行为：
- 嵌套对象：**递归合并**，保留未提及的子字段
- 数组：**整体替换**，不是追加或合并
- 设为 `NONE`：**删除该字段**
- 设为 `NULL`：将字段值设为显式 null

#### PATCH — JSON Patch（RFC 6902）
```sql
UPDATE person:test PATCH [
  { op: 'replace', path: '/name/title', value: 'Dr' },
  { op: 'add', path: '/tags/-', value: 'new_tag' },
  { op: 'remove', path: '/deprecated_field' }
];
```

支持的操作：`add`, `remove`, `replace`, `copy`, `move`, `test`

---

## 2. += 和 -= 操作符（重要陷阱）

### 对数字
```sql
UPDATE user:1 SET score += 10;  -- score 变为 score + 10
UPDATE user:1 SET score -= 5;   -- score 变为 score - 5
```

### 对数组
```sql
-- += 追加元素（单个值追加到末尾）
UPDATE user:1 SET tags += 'new_tag';

-- += 合并数组（数组合并到末尾）
UPDATE user:1 SET tags += ['tag1', 'tag2'];

-- -= 移除所有匹配的元素
UPDATE user:1 SET tags -= 'deprecated';
UPDATE user:1 SET tags -= ['old1', 'old2'];
```

### ⚠️ 关键陷阱：+= 不会去重！

```sql
-- 假设 tags = ['a', 'b']
UPDATE user:1 SET tags += 'a';
-- 结果：tags = ['a', 'b', 'a']  ← 'a' 出现了两次！
```

如果需要去重，必须手动使用 `array::distinct()`：
```sql
UPDATE user:1 SET tags = array::distinct(array::concat(tags, ['new_tag']));
```

### 对不存在的字段
```sql
-- 字段不存在时，+= 对数字会从 0 开始
UPDATE user:1 SET score += 10;  -- score = 10（如果之前不存在）

-- 字段不存在时，+= 对数组会创建新数组
UPDATE user:1 SET tags += 'first';  -- tags = ['first']
```

---

## 3. NONE vs NULL（关键语义差异）

这是 SurrealDB 独有的概念，**不能用 SQL 的 NULL 思维理解**。

### 对比表

| 特性 | NONE | NULL |
|------|------|------|
| 语义 | 值不存在（类似 JS `undefined`） | 显式空值（类似 SQL `NULL`） |
| 存储 | 会被 `clean_none()` 自动清理，不存储 | 正常存储 |
| 在对象中 | 字段会被移除 | 字段存在，值为 null |
| 在数组中 | 保留（不会被清理） | 保留 |
| 排序 | `NONE < NULL`（NONE 排在 NULL 前面） | — |
| 相等性 | `NONE = NONE` → true | `NONE = NULL` → false |
| `is_nullish` | true | true |
| MERGE 中 | 设为 NONE → **删除字段** | 设为 NULL → 字段值变为 null |

### 实际影响

```sql
-- MERGE 中使用 NONE 删除字段
UPDATE user:1 MERGE { deprecated_field: NONE };
-- 结果：deprecated_field 字段被移除

-- MERGE 中使用 NULL 设置空值
UPDATE user:1 MERGE { optional_field: NULL };
-- 结果：optional_field = null（字段存在）

-- 类型检查
type::is::none(NONE)  -- true
type::is::null(NULL)   -- true
type::is::none(NULL)   -- false
type::is::null(NONE)   -- false
```

### clean_none 机制

SurrealDB 在存储文档时会自动执行 `clean_none`：
- 递归遍历对象，移除值为 NONE 的键值对
- **不会**移除数组中的 NONE 元素
- 这意味着 NONE 在对象中等同于"删除字段"

---

## 4. CREATE vs UPSERT vs INSERT

```sql
-- CREATE：记录必须不存在，否则报错
CREATE user:1 SET name = 'Alice';

-- UPSERT：存在则更新，不存在则创建
UPSERT user:1 SET name = 'Alice', updated_at = time::now();

-- INSERT：批量插入，支持 ON DUPLICATE KEY UPDATE
INSERT INTO user [
  { id: user:1, name: 'Alice' },
  { id: user:2, name: 'Bob' }
];
```

---

## ⚠️ 常见错误场景

### 错误 1：用 CONTENT 做部分更新
```sql
-- ❌ 想更新 name，但会删除所有其他字段
UPDATE user:1 CONTENT { name: 'New Name' };

-- ✅ 应该用 SET 或 MERGE
UPDATE user:1 SET name = 'New Name';
UPDATE user:1 MERGE { name: 'New Name' };
```

### 错误 2：用 MERGE 追加数组元素
```sql
-- ❌ 这会替换整个 tags 数组，不是追加
UPDATE user:1 MERGE { tags: ['new_tag'] };

-- ✅ 应该用 SET +=
UPDATE user:1 SET tags += 'new_tag';
```

### 错误 3：假设 += 会去重
```sql
-- ❌ 不会去重
UPDATE user:1 SET tags += 'existing_tag';

-- ✅ 手动去重
UPDATE user:1 SET tags = array::distinct(array::concat(tags, ['existing_tag']));
```

### 错误 4：混淆 NONE 和 NULL
```sql
-- ❌ 想设置空值但用了 NONE（字段会被删除）
UPDATE user:1 MERGE { bio: NONE };

-- ✅ 想设置空值应该用 NULL
UPDATE user:1 MERGE { bio: NULL };

-- ✅ 想删除字段应该用 NONE
UPDATE user:1 MERGE { deprecated: NONE };
```
