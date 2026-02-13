# SurrealQL 内存数据库测试指南

> **用途**：使用项目自带的 SurrealDB exe 启动临时内存数据库，快速验证 SurrealQL 语法和行为。
> **版本**：SurrealDB v2.4.0
> **exe 路径**：`KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe`

---

## 一、启动方式

### 方式一：单窗口交互 Shell（推荐，最简单）

```powershell
# 在项目根目录执行（D:\code\...\HNULS-KnowledgeDatabase）
.\KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe sql --endpoint memory --namespace test --database test --username root --password root --pretty
```

- 直接进入交互式 REPL
- 输入 SurrealQL 语句，按回车执行
- `--pretty` 让输出格式化（推荐）
- 进程退出后数据清零
- Ctrl+C 退出

### 方式二：管道批量执行（适合自动化验证）

```powershell
echo "CREATE person:1 SET name='Alice', age=30; SELECT * FROM person;" | .\KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe sql --endpoint memory --namespace test --database test --username root --password root --pretty
```

PowerShell 多行用 `` `n `` 换行：
```powershell
echo "语句1;`n语句2;`n语句3;" | .\KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe sql --endpoint memory --namespace test --database test --username root --password root --pretty
```

### 方式三：两窗口模式（模拟生产环境）

**窗口 1 — 启动服务器**：
```powershell
.\KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe start --user root --pass root memory
# 默认监听 127.0.0.1:8000
```

**窗口 2 — 连接查询**：
```powershell
.\KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe sql --endpoint http://127.0.0.1:8000 --namespace test --database test --username root --password root --pretty
```

---

## 二、基本语法速查

### 2.1 表定义

```sql
-- 严格模式（必须先定义字段才能写入）
DEFINE TABLE person SCHEMAFULL;
DEFINE FIELD name ON person TYPE string;
DEFINE FIELD age ON person TYPE int DEFAULT 0;

-- 灵活模式（可以写任意字段）
DEFINE TABLE log SCHEMALESS;

-- 带 ASSERT 的枚举字段
DEFINE FIELD status ON task TYPE string DEFAULT 'pending'
  ASSERT $value IN ['pending', 'progressing', 'completed', 'failed'];

-- 可选字段
DEFINE FIELD error ON task TYPE option<string>;

-- 灵活对象字段（允许内部任意结构）
DEFINE FIELD config ON task FLEXIBLE TYPE object DEFAULT {};

-- 泛型数组（v2.4.0 SCHEMAFULL 表必须指定元素类型）
DEFINE FIELD tags ON task TYPE array<string> DEFAULT [];

-- 自动更新时间戳
DEFINE FIELD created_at ON task TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON task TYPE datetime VALUE time::now();

-- 索引
DEFINE INDEX idx_status ON task COLUMNS status;
DEFINE INDEX uniq_name ON person COLUMNS name UNIQUE;
```

### 2.2 CRUD

```sql
-- CREATE（自动生成 ID）
CREATE person CONTENT { name: 'Alice', age: 30 };

-- CREATE（指定 ID）
CREATE person:alice CONTENT { name: 'Alice', age: 30 };

-- SELECT
SELECT * FROM person;
SELECT * FROM person:alice;
SELECT * FROM person WHERE age > 25 ORDER BY age DESC LIMIT 10;

-- UPDATE
UPDATE person:alice SET age = 31;
UPDATE person SET status = 'active' WHERE age > 25;

-- UPSERT（不存在则创建，存在则更新）
UPSERT person:alice SET name = 'Alice', age = 32;

-- DELETE
DELETE person:alice;
DELETE person WHERE age < 18;
```

### 2.3 参数化查询

```sql
-- 定义变量
LET $name = 'Alice';
LET $age = 30;
SELECT * FROM person WHERE name = $name AND age > $age;

-- 在 SDK 中，参数通过第二个参数传递：
-- await db.query('SELECT * FROM person WHERE name = $name', { name: 'Alice' })
```

### 2.4 聚合查询

```sql
-- 计数
SELECT count() AS total FROM person GROUP ALL;

-- 条件计数
SELECT
  count(status = 'completed') AS completed,
  count(status = 'failed') AS failed,
  count(status = 'pending') AS pending,
  count() AS total
FROM task WHERE task_id = $tid GROUP ALL;

-- 分组
SELECT status, count() AS cnt FROM task GROUP BY status;
```

---

## 三、UPSERT 高级用法

### 3.1 条件字段更新（IF 表达式）

```sql
-- 首次写入用 THEN，后续追加用 ELSE
UPSERT entity:Test SET
  name = 'Test',
  description = IF description IS NONE OR description = ''
    THEN 'First description'
    ELSE string::concat(description, '\n---\n', 'New description')
  END;
```

### 3.2 数组合并（array::union）

```sql
-- ⚠️ v2.4.0 中 ?? 运算符在 UPSERT SET 中无效，必须用 IF
-- ❌ 错误写法
UPSERT entity:Test SET source_ids = array::union(source_ids ?? [], ['chunk_1']);

-- ✅ 正确写法
UPSERT entity:Test SET
  source_ids = IF source_ids IS NONE
    THEN ['chunk_1']
    ELSE array::union(source_ids, ['chunk_1'])
  END;
```

### 3.3 完整的幂等 UPSERT 模式

```sql
UPSERT entity:Machine_Learning SET
  name = 'Machine Learning',
  type = 'Concept',
  description = IF description IS NONE OR description = ''
    THEN $desc
    ELSE string::concat(description, '\n---\n', $desc)
  END,
  source_ids = IF source_ids IS NONE
    THEN [$chunkId]
    ELSE array::union(source_ids, [$chunkId])
  END,
  file_keys = IF file_keys IS NONE
    THEN [$fileKey]
    ELSE array::union(file_keys, [$fileKey])
  END;
```

---

## 四、RELATION 表（图数据库功能）

### 4.1 定义关系表

```sql
DEFINE TABLE kg_entity SCHEMAFULL;
DEFINE FIELD name ON kg_entity TYPE string;

-- TYPE RELATION 定义：FROM/TO 指定允许连接的表
DEFINE TABLE kg_relates TYPE RELATION FROM kg_entity TO kg_entity SCHEMAFULL;
DEFINE FIELD keywords ON kg_relates TYPE string DEFAULT '';
DEFINE FIELD description ON kg_relates TYPE string DEFAULT '';
-- ⚠️ 数组字段必须用泛型 array<string>，不能用 array
DEFINE FIELD source_ids ON kg_relates TYPE array<string> DEFAULT [];
```

### 4.2 创建关系

```sql
-- 基本语法：RELATE <from> -> <relation_table> -> <to>
RELATE kg_entity:Alice -> kg_relates -> kg_entity:Bob
  SET keywords = 'friend', description = 'They are friends';

-- 指定确定性 ID（推荐，用于幂等更新）
RELATE kg_entity:Alice -> kg_relates:Alice_Bob -> kg_entity:Bob
  SET keywords = 'friend', description = 'They are friends';

-- 再次 RELATE 相同 ID → 原地更新（不创建重复边）
RELATE kg_entity:Alice -> kg_relates:Alice_Bob -> kg_entity:Bob
  SET keywords = 'best friend', description = 'Updated relationship';
```

### 4.3 ⚠️ v2.4.0 已知问题

```sql
-- ❌ RELATE UNIQUE 不去重（v2.4.0 bug，会创建重复边）
RELATE a -> rel -> b UNIQUE SET ...;  -- 不要用！

-- ✅ 用确定性 Record ID 替代
RELATE a -> rel:deterministic_id -> b SET ...;  -- 同 ID 会原地更新

-- ❌ TYPE array 在 SCHEMAFULL RELATION 表上赋值无效
DEFINE FIELD tags ON rel TYPE array DEFAULT [];
RELATE a -> rel:x -> b SET tags = ['a', 'b'];  -- tags 会是 []

-- ✅ 改用 TYPE array<string>
DEFINE FIELD tags ON rel TYPE array<string> DEFAULT [];
RELATE a -> rel:x -> b SET tags = ['a', 'b'];  -- tags 正常 ['a', 'b']
```

### 4.4 图遍历查询

```sql
-- 一跳邻居（出边）
SELECT ->kg_relates->kg_entity AS neighbors 
FROM kg_entity:Machine_Learning;

-- 一跳邻居（入边）
SELECT <-kg_relates<-kg_entity AS sources 
FROM kg_entity:Deep_Learning;

-- 两跳遍历
SELECT ->kg_relates->kg_entity->kg_relates->kg_entity AS two_hop
FROM kg_entity:Machine_Learning;

-- 获取关系详情 + 目标实体
SELECT ->kg_relates.* AS out_relations 
FROM kg_entity:Machine_Learning;

-- 获取所有关系
SELECT * FROM kg_relates;

-- 计数
SELECT count() AS edge_count FROM kg_relates GROUP ALL;
```

### 4.5 RELATION 表上的字段更新（用 RELATE + 确定性 ID）

```sql
-- 在 RELATION 表上不能用 UPSERT（会报错）
-- 必须用 RELATE + 固定 ID 实现"更新已有边"

RELATE kg_entity:A -> kg_relates:A_B -> kg_entity:B SET
  keywords = 'updated',
  description = IF description IS NONE OR description = ''
    THEN 'New desc'
    ELSE string::concat(description, '\n---\n', 'New desc')
  END,
  source_ids = IF source_ids IS NONE
    THEN ['chunk_2']
    ELSE array::union(source_ids, ['chunk_2'])
  END;
```

---

## 五、跨数据库查询

```sql
-- 切换 namespace/database
USE NS knowledge DB my_knowledge_base;

-- 切回
USE NS system DB system;
```

在 SDK 中通过 `db.use({ namespace, database })` 实现，项目中封装为：
```typescript
await client.queryInDatabase(namespace, database, sql, params)
// 内部: use → query → finally restore
```

---

## 六、常用调试技巧

### 6.1 查看表结构

```sql
INFO FOR TABLE kg_entity;
INFO FOR TABLE kg_relates;
INFO FOR DB;
INFO FOR NS;
```

### 6.2 清空表

```sql
DELETE person;  -- 删除所有记录但保留表定义
REMOVE TABLE person;  -- 完全删除表
```

### 6.3 Record ID 格式

```sql
-- 简单 ID
CREATE person:alice ...;

-- 含特殊字符的 ID 用尖括号转义
CREATE person:⟨my-complex-id⟩ ...;
CREATE person:⟨hello world⟩ ...;

-- 数值 ID
CREATE person:1 ...;
```

### 6.4 事务

```sql
BEGIN TRANSACTION;
CREATE account:alice SET balance = 100;
CREATE account:bob SET balance = 50;
UPDATE account:alice SET balance -= 30;
UPDATE account:bob SET balance += 30;
COMMIT TRANSACTION;

-- 出错时回滚
BEGIN TRANSACTION;
-- ... 操作 ...
CANCEL TRANSACTION;
```

---

## 七、本项目测试用例（可直接粘贴执行）

### 7.1 完整 KG 图谱表验证

将以下内容直接粘贴到交互 shell 中（方式一启动后）：

```sql
DEFINE TABLE kg_entity SCHEMAFULL;
DEFINE FIELD entity_name ON kg_entity TYPE string;
DEFINE FIELD entity_type ON kg_entity TYPE string;
DEFINE FIELD description ON kg_entity TYPE string DEFAULT '';
DEFINE FIELD source_ids ON kg_entity TYPE array<string> DEFAULT [];
DEFINE FIELD file_keys ON kg_entity TYPE array<string> DEFAULT [];
DEFINE FIELD meta ON kg_entity FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD created_at ON kg_entity TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON kg_entity TYPE datetime VALUE time::now();
DEFINE INDEX uniq_entity_name ON kg_entity COLUMNS entity_name UNIQUE;
DEFINE INDEX idx_entity_type ON kg_entity COLUMNS entity_type;

DEFINE TABLE kg_relates TYPE RELATION FROM kg_entity TO kg_entity SCHEMAFULL;
DEFINE FIELD keywords ON kg_relates TYPE string DEFAULT '';
DEFINE FIELD description ON kg_relates TYPE string DEFAULT '';
DEFINE FIELD weight ON kg_relates TYPE float DEFAULT 1.0;
DEFINE FIELD source_ids ON kg_relates TYPE array<string> DEFAULT [];
DEFINE FIELD file_keys ON kg_relates TYPE array<string> DEFAULT [];
DEFINE FIELD meta ON kg_relates FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD created_at ON kg_relates TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON kg_relates TYPE datetime VALUE time::now();

DEFINE TABLE kg_entity_chunks SCHEMAFULL;
DEFINE FIELD entity_name ON kg_entity_chunks TYPE string;
DEFINE FIELD chunk_ids ON kg_entity_chunks TYPE array<string> DEFAULT [];
DEFINE FIELD updated_at ON kg_entity_chunks TYPE datetime VALUE time::now();
DEFINE INDEX uniq_ec_name ON kg_entity_chunks COLUMNS entity_name UNIQUE;

DEFINE TABLE kg_relation_chunks SCHEMAFULL;
DEFINE FIELD relation_key ON kg_relation_chunks TYPE string;
DEFINE FIELD chunk_ids ON kg_relation_chunks TYPE array<string> DEFAULT [];
DEFINE FIELD updated_at ON kg_relation_chunks TYPE datetime VALUE time::now();
DEFINE INDEX uniq_rc_key ON kg_relation_chunks COLUMNS relation_key UNIQUE;
```

### 7.2 模拟 Chunk 1 处理

```sql
UPSERT kg_entity:Machine_Learning SET entity_name='Machine Learning', entity_type='Concept', description=IF description IS NONE OR description='' THEN 'A field of AI' ELSE string::concat(description, '\n---\n', 'A field of AI') END, source_ids=IF source_ids IS NONE THEN ['chunk_1'] ELSE array::union(source_ids, ['chunk_1']) END, file_keys=IF file_keys IS NONE THEN ['file_a'] ELSE array::union(file_keys, ['file_a']) END;

UPSERT kg_entity:Deep_Learning SET entity_name='Deep Learning', entity_type='Concept', description='Neural networks', source_ids=IF source_ids IS NONE THEN ['chunk_1'] ELSE array::union(source_ids, ['chunk_1']) END, file_keys=IF file_keys IS NONE THEN ['file_a'] ELSE array::union(file_keys, ['file_a']) END;

RELATE kg_entity:Machine_Learning -> kg_relates:Deep_Learning_Machine_Learning -> kg_entity:Deep_Learning SET keywords='subfield', description='DL is subfield of ML', source_ids=['chunk_1'], file_keys=['file_a'];

UPSERT kg_entity_chunks:Machine_Learning SET entity_name='Machine Learning', chunk_ids=IF chunk_ids IS NONE THEN ['chunk_1'] ELSE array::union(chunk_ids, ['chunk_1']) END;
UPSERT kg_entity_chunks:Deep_Learning SET entity_name='Deep Learning', chunk_ids=IF chunk_ids IS NONE THEN ['chunk_1'] ELSE array::union(chunk_ids, ['chunk_1']) END;
UPSERT kg_relation_chunks:Deep_Learning_Machine_Learning SET relation_key='Deep_Learning::Machine_Learning', chunk_ids=IF chunk_ids IS NONE THEN ['chunk_1'] ELSE array::union(chunk_ids, ['chunk_1']) END;
```

### 7.3 模拟 Chunk 2 处理（验证增量合并）

```sql
UPSERT kg_entity:Machine_Learning SET entity_name='Machine Learning', entity_type='Concept', description=IF description IS NONE OR description='' THEN 'Learns from data' ELSE string::concat(description, '\n---\n', 'Learns from data') END, source_ids=IF source_ids IS NONE THEN ['chunk_2'] ELSE array::union(source_ids, ['chunk_2']) END, file_keys=IF file_keys IS NONE THEN ['file_a'] ELSE array::union(file_keys, ['file_a']) END;

RELATE kg_entity:Machine_Learning -> kg_relates:Deep_Learning_Machine_Learning -> kg_entity:Deep_Learning SET keywords='subfield', description=IF description IS NONE OR description='' THEN 'DL extends ML' ELSE string::concat(description, '\n---\n', 'DL extends ML') END, source_ids=IF source_ids IS NONE THEN ['chunk_2'] ELSE array::union(source_ids, ['chunk_2']) END, file_keys=IF file_keys IS NONE THEN ['file_a'] ELSE array::union(file_keys, ['file_a']) END;

UPSERT kg_entity_chunks:Machine_Learning SET entity_name='Machine Learning', chunk_ids=IF chunk_ids IS NONE THEN ['chunk_2'] ELSE array::union(chunk_ids, ['chunk_2']) END;
```

### 7.4 验证结果

```sql
SELECT * FROM kg_entity;
SELECT * FROM kg_relates;
SELECT count() AS edge_count FROM kg_relates GROUP ALL;
SELECT ->kg_relates->kg_entity AS neighbors FROM kg_entity:Machine_Learning;
SELECT * FROM kg_entity_chunks;
SELECT * FROM kg_relation_chunks;
```

**预期**：
- `kg_entity:Machine_Learning` 的 `source_ids` = `['chunk_1', 'chunk_2']`，`description` 含两段拼接
- `kg_relates` 只有 1 条边（确定性 ID 去重），`source_ids` = `['chunk_1', 'chunk_2']`
- 图遍历返回 `[kg_entity:Deep_Learning]`（不重复）
