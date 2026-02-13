# 知识图谱第二阶段：Graph Build 完整实施计划

> **用途**：本文档是跨对话的完整交接文档，包含所有设计决策、验证结论、代码模式和实施步骤。
> **日期**：2026-02-13
> **状态**：P0 验证完成，P1-P13 待实施

---

## 一、项目背景与目标

### 1.1 已有架构（第一阶段，已实现）

```
文档 → chunks → kg_task + kg_chunk → TaskScheduler → LLM 提取 → kg_llm_result_cache
                     (system DB)                          (raw_response 缓存)
```

**已有文件**：
- `src/utility/Knowledge-graph/entry.ts` — 子进程入口
- `src/utility/Knowledge-graph/core/task-scheduler.ts` — 第一阶段调度器（chunk → LLM）
- `src/utility/Knowledge-graph/service/task-submission/index.ts` — 任务提交 + Schema 初始化
- `src/utility/Knowledge-graph/bridge/message-handler.ts` — IPC 消息路由
- `src/utility/Knowledge-graph/db/surreal-client.ts` — SurrealDB 客户端
- `src/Public/ShareTypes/knowledge-graph-ipc.types.ts` — IPC 类型定义
- `src/preload/types/knowledge-config.types.ts` — 知识图谱配置类型
- `src/renderer/src/stores/knowledge-library/knowledge-config.store.ts` — 前端配置 store
- `src/renderer/src/stores/knowledge-graph/kg-build.store.ts` — 前端构建 store
- `src/renderer/src/views/.../KnowledgeGraphSection/index.vue` — KG 配置面板
- `src/renderer/src/views/.../KnowledgeGraphSection/CreateKgConfigDialog.vue` — 创建配置弹窗

### 1.2 第二阶段目标

1. **创建 KG 配置时同步在目标知识库中创建图谱表**（表名与嵌入表绑定）
2. **任务提交管线新增 target 字段**（指向目标知识库）
3. **新增 GraphBuildScheduler**：从 `kg_llm_result_cache` 解析 → 最终图谱表 upsert
4. **不使用中间暂存表**（直接从缓存到最终表）
5. **不集成全局监控系统**
6. **不考虑数据迁移**（会删除物理文件重建）

---

## 二、P0 验证结论（已完成 ✅）

### 2.1 验证环境

```powershell
# 使用项目自带的 SurrealDB exe 启动内存数据库交互 shell
.\KnowledgeDatabase-src\vendor\surrealdb\surreal-v2.4.0.windows-amd64.exe sql --endpoint memory --namespace test --database test --username root --password root --pretty
```

### 2.2 验证结论汇总

| 验证项 | 结论 | 备注 |
|--------|------|------|
| Entity UPSERT + IF...END 表达式 | ✅ 可用 | 首次 THEN 分支，后续 ELSE 分支 |
| `array::union` 去重合并 | ✅ 可用 | 但必须用 `IF ... IS NONE` 而不是 `??` |
| `??` 运算符在 UPSERT SET 中 | ❌ 无效 | v2.4.0 bug，改用 IF 替代 |
| `RELATE ... UNIQUE` 去重 | ❌ 不去重 | v2.4.0 中 UNIQUE 无效，创建重复边 |
| **确定性 Record ID** 去重 | ✅ 完美 | `RELATE A -> table:fixed_id -> B` 同 ID 原地更新 |
| `TYPE array` 在 SCHEMAFULL RELATION 表 | ❌ 赋值无效 | 改用 `TYPE array<string>` |
| `TYPE array<string>` | ✅ 可用 | 所有数组字段必须用泛型数组 |
| 图遍历 `->table->table` | ✅ 正常 | 一跳和两跳均正常 |
| `RELATE ... SET` 引用已有字段 | ✅ 可用 | IF + array::union + string::concat 均正常 |

### 2.3 最终确认的 SQL 模式

#### Entity UPSERT（普通表）

```sql
UPSERT kg_entity:Sanitized_Name SET
  entity_name = 'Original Name',
  entity_type = $type,
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

#### Relation（确定性 ID + TYPE RELATION 表）

```sql
RELATE kg_entity:Src -> kg_relates:Src_Tgt -> kg_entity:Tgt SET
  keywords = $keywords,
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

#### 数组字段定义（必须用泛型）

```sql
-- ✅ 正确
DEFINE FIELD source_ids ON kg_entity TYPE array<string> DEFAULT [];
-- ❌ 错误（SCHEMAFULL RELATION 表上赋值无效）
DEFINE FIELD source_ids ON kg_relates TYPE array DEFAULT [];
```

---

## 三、表命名规则

### 3.1 嵌入表命名（已有）

```
emb_cfg_{safeConfigId}_{dimensions}_chunks
```

例如：嵌入配置 ID 为 `cfg_1707840000000`，维度 3072
→ 表名 `emb_cfg_cfg_1707840000000_3072_chunks`

生成函数在多处存在，统一逻辑：
```typescript
function getChunksTableName(configId: string, dimensions: number): string {
  const safeId = configId.replace(/[^a-zA-Z0-9_]/g, '_')
  return `emb_cfg_${safeId}_${dimensions}_chunks`
}
```

### 3.2 KG 表命名（新增）

**规则**：取嵌入表的基名（去掉 `_chunks` 后缀），加 `kg_` 前缀，再加图谱表类型后缀。

```
嵌入表:     emb_cfg_{safeId}_{dim}_chunks
KG实体表:   kg_emb_cfg_{safeId}_{dim}_entity
KG关系表:   kg_emb_cfg_{safeId}_{dim}_relates
KG实体映射: kg_emb_cfg_{safeId}_{dim}_entity_chunks
KG关系映射: kg_emb_cfg_{safeId}_{dim}_relation_chunks
```

**生成函数**：

```typescript
function getKgTableNames(embeddingConfigId: string, dimensions: number) {
  const safeId = embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
  const base = `kg_emb_cfg_${safeId}_${dimensions}`
  return {
    entity: `${base}_entity`,
    relates: `${base}_relates`,
    entityChunks: `${base}_entity_chunks`,
    relationChunks: `${base}_relation_chunks`
  }
}
```

**示例**：
- 嵌入配置 ID: `cfg_1707840000000`，维度: 3072
- 嵌入表: `emb_cfg_cfg_1707840000000_3072_chunks`
- KG 实体表: `kg_emb_cfg_cfg_1707840000000_3072_entity`
- KG 关系表: `kg_emb_cfg_cfg_1707840000000_3072_relates`

### 3.3 KG 表存放位置

KG 图谱表与嵌入表在**同一个知识库数据库**中（同 namespace + database），不在 system DB。

```
knowledge.{databaseName}
├── kb_document
├── kb_document_embedding
├── emb_cfg_xxx_3072_chunks        ← 嵌入表（已有）
├── kg_emb_cfg_xxx_3072_entity     ← KG 实体表（新增）
├── kg_emb_cfg_xxx_3072_relates    ← KG 关系表（新增）
├── kg_emb_cfg_xxx_3072_entity_chunks    ← 溯源映射（新增）
└── kg_emb_cfg_xxx_3072_relation_chunks  ← 溯源映射（新增）

system.system
├── kg_task                        ← 第一阶段任务（已有）
├── kg_chunk                       ← 第一阶段分块（已有）
├── kg_llm_result_cache            ← LLM 缓存（已有）
├── kg_build_task                  ← 第二阶段任务（新增）
└── kg_build_chunk                 ← 第二阶段分块（新增）
```

---

## 四、Schema 定义

### 4.1 System DB — kg_build_task（新增）

```sql
DEFINE TABLE IF NOT EXISTS kg_build_task SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS source_task_id    ON kg_build_task TYPE string;
DEFINE FIELD IF NOT EXISTS file_key          ON kg_build_task TYPE string;
DEFINE FIELD IF NOT EXISTS status            ON kg_build_task TYPE string DEFAULT 'pending'
  ASSERT $value IN ['pending', 'progressing', 'completed', 'failed'];
DEFINE FIELD IF NOT EXISTS target_namespace  ON kg_build_task TYPE string;
DEFINE FIELD IF NOT EXISTS target_database   ON kg_build_task TYPE string;
DEFINE FIELD IF NOT EXISTS target_table_base ON kg_build_task TYPE string;
DEFINE FIELD IF NOT EXISTS config            ON kg_build_task FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS chunks_total      ON kg_build_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS chunks_completed  ON kg_build_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS chunks_failed     ON kg_build_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS entities_upserted ON kg_build_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS relations_upserted ON kg_build_task TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS created_at        ON kg_build_task TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at        ON kg_build_task TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS idx_kbt_status    ON kg_build_task COLUMNS status;
```

### 4.2 System DB — kg_build_chunk（新增）

```sql
DEFINE TABLE IF NOT EXISTS kg_build_chunk SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS task_id         ON kg_build_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS chunk_index     ON kg_build_chunk TYPE int;
DEFINE FIELD IF NOT EXISTS cache_key       ON kg_build_chunk TYPE string;
DEFINE FIELD IF NOT EXISTS status          ON kg_build_chunk TYPE string DEFAULT 'pending'
  ASSERT $value IN ['pending', 'progressing', 'completed', 'failed'];
DEFINE FIELD IF NOT EXISTS entities_count  ON kg_build_chunk TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS relations_count ON kg_build_chunk TYPE int DEFAULT 0;
DEFINE FIELD IF NOT EXISTS error           ON kg_build_chunk TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at      ON kg_build_chunk TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at      ON kg_build_chunk TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS idx_kbc_task    ON kg_build_chunk COLUMNS task_id;
DEFINE INDEX IF NOT EXISTS idx_kbc_status  ON kg_build_chunk COLUMNS status;
DEFINE INDEX IF NOT EXISTS idx_kbc_task_status ON kg_build_chunk COLUMNS task_id, status;
```

### 4.3 kg_task 追加字段

```sql
DEFINE FIELD IF NOT EXISTS target_namespace  ON kg_task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS target_database   ON kg_task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS target_table_base ON kg_task TYPE option<string>;
```

### 4.4 目标知识库 DB — KG 图谱表（动态创建）

以下 SQL 中的表名用 `{entity_table}` / `{relates_table}` 等占位符，实际由 `getKgTableNames()` 生成。

```sql
-- ============ kg_entity ============
DEFINE TABLE IF NOT EXISTS {entity_table} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS entity_name   ON {entity_table} TYPE string;
DEFINE FIELD IF NOT EXISTS entity_type   ON {entity_table} TYPE string;
DEFINE FIELD IF NOT EXISTS description   ON {entity_table} TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS source_ids    ON {entity_table} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS file_keys     ON {entity_table} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS meta          ON {entity_table} FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS created_at    ON {entity_table} TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at    ON {entity_table} TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS uniq_entity_name ON {entity_table} COLUMNS entity_name UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_entity_type  ON {entity_table} COLUMNS entity_type;

-- ============ kg_relates (TYPE RELATION) ============
DEFINE TABLE IF NOT EXISTS {relates_table} TYPE RELATION FROM {entity_table} TO {entity_table} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS keywords      ON {relates_table} TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS description   ON {relates_table} TYPE string DEFAULT '';
DEFINE FIELD IF NOT EXISTS weight        ON {relates_table} TYPE float DEFAULT 1.0;
DEFINE FIELD IF NOT EXISTS source_ids    ON {relates_table} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS file_keys     ON {relates_table} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS meta          ON {relates_table} FLEXIBLE TYPE object DEFAULT {};
DEFINE FIELD IF NOT EXISTS created_at    ON {relates_table} TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at    ON {relates_table} TYPE datetime VALUE time::now();

-- ============ kg_entity_chunks（溯源映射）============
DEFINE TABLE IF NOT EXISTS {entity_chunks_table} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS entity_name   ON {entity_chunks_table} TYPE string;
DEFINE FIELD IF NOT EXISTS chunk_ids     ON {entity_chunks_table} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS updated_at    ON {entity_chunks_table} TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS uniq_ec_name  ON {entity_chunks_table} COLUMNS entity_name UNIQUE;

-- ============ kg_relation_chunks（溯源映射）============
DEFINE TABLE IF NOT EXISTS {relation_chunks_table} SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS relation_key  ON {relation_chunks_table} TYPE string;
DEFINE FIELD IF NOT EXISTS chunk_ids     ON {relation_chunks_table} TYPE array<string> DEFAULT [];
DEFINE FIELD IF NOT EXISTS updated_at    ON {relation_chunks_table} TYPE datetime VALUE time::now();
DEFINE INDEX IF NOT EXISTS uniq_rc_key   ON {relation_chunks_table} COLUMNS relation_key UNIQUE;
```

---

## 五、现有代码中的查询模式（必须遵循）

### 5.1 查询执行方式

**项目中所有查询都是拼 SQL 字符串 + 参数化变量**，通过 `KGSurrealClient` 执行：

```typescript
// 当前数据库（system DB）执行
const result = await this.client.query(sql, { param1, param2 })
const records = this.client.extractRecords(result)

// 跨库执行（如读取知识库中的嵌入表）
const result = await this.client.queryInDatabase(
  namespace, database, sql, params
)
const records = this.client.extractRecords(result)
```

### 5.2 典型查询模式参考

**CREATE**（参考 task-submission/index.ts:188-201）：
```typescript
const sql = `CREATE kg_task CONTENT {
  status: 'pending',
  file_key: $fileKey,
  source_namespace: $sourceNamespace,
  ...
};`
await this.client.query(sql, { fileKey, sourceNamespace, ... })
```

**SELECT**（参考 task-scheduler.ts:534-536）：
```typescript
const result = this.client.extractRecords(
  await this.client.query(
    `SELECT task_id FROM kg_chunk WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;`
  )
)
```

**UPDATE**（参考 task-scheduler.ts:622）：
```typescript
await this.client.query(`UPDATE ${chunkIdStr} SET status = 'progressing';`)
```

**批量 CREATE（拼接多条 SQL）**（参考 task-submission/index.ts:224-243）：
```typescript
const insertStatements = batch.map((chunk, idx) => `
  CREATE kg_chunk CONTENT {
    task_id: '${taskIdStr}',
    chunk_index: ${chunk.chunk_index},
    content: $content_${idx},
    status: 'pending'
  };`
).join('\n')
const batchParams = {}
batch.forEach((chunk, idx) => { batchParams[`content_${idx}`] = chunk.content })
await this.client.query(insertStatements, batchParams)
```

**DELETE**（参考 task-scheduler.ts:489）：
```typescript
await this.client.query(`DELETE kg_chunk WHERE task_id = $tid;`, { tid: taskId })
```

**聚合统计**（参考 task-scheduler.ts:736-745）：
```typescript
const statsResult = this.client.extractRecords(
  await this.client.query(
    `SELECT
       count(status = 'completed') AS completed,
       count(status = 'failed') AS failed,
       count(status = 'pending') AS pending,
       count() AS total
     FROM kg_chunk WHERE task_id = $tid GROUP ALL;`,
    { tid: taskIdStr }
  )
)
```

**RecordId 处理**（参考 task-submission/index.ts:26-30）：
```typescript
function rid(id: any): string {
  if (typeof id === 'string') return id
  if (id && typeof id.toString === 'function') return id.toString()
  return String(id)
}
```

### 5.3 关键注意事项

1. **所有查询都是拼 SQL 字符串**，不使用 ORM 或 query builder
2. **参数化使用 `$paramName`**，参数通过第二个参数对象传递
3. **表名直接拼进 SQL 字符串中**（因为 SurrealDB 不支持参数化表名）
4. **RecordId 通过 `rid()` 函数统一转换为字符串**
5. **跨库查询后自动切回原库**（在 `queryInDatabase` 的 finally 中）
6. **extractRecords() 处理 SDK 返回格式差异**

---

## 六、数据流与生命周期

### 6.1 完整数据流

```
                  第一阶段（已实现）                   衔接                    第二阶段（新增）
             ┌─────────────────────┐            ┌───────────┐          ┌──────────────────────┐
文档 chunks →│ kg_task + kg_chunk  │ completed →│ 自动检测   │ 创建 →  │ kg_build_task         │
             │ TaskScheduler      │            │           │          │ kg_build_chunk        │
             │ → LLM 提取         │            │           │          │ GraphBuildScheduler   │
             │ → kg_llm_result_cache           │           │          │ → 解析 raw_response   │
             └─────────────────────┘            └───────────┘          │ → UPSERT entity/rel  │
                  system DB                                            └──────────┬───────────┘
                                                                                  │
                                                                                  ▼
                                                                   目标知识库 DB 图谱表
                                                                   kg_emb_cfg_xxx_entity
                                                                   kg_emb_cfg_xxx_relates
                                                                   kg_emb_cfg_xxx_entity_chunks
                                                                   kg_emb_cfg_xxx_relation_chunks
```

### 6.2 生命周期管理

```
数据类型                     清理条件                                    负责方
─────────────────────────────────────────────────────────────────────────────
kg_task + kg_chunk          completed + 已存在对应 kg_build_task       TaskScheduler.cleanup()
kg_build_task + kg_build_chunk  completed（全部 chunks done）          GraphBuildScheduler.cleanup()
kg_llm_result_cache         永不自动清理（跨任务复用）                  手动/可选
目标库图谱表                 用户手动管理                               —
```

**TaskScheduler.cleanup() 修改**：
```sql
-- 原来的条件：
SELECT id FROM kg_task WHERE status = 'completed' AND chunks_completed = chunks_total_origin

-- 改为：增加"已被第二阶段接管"条件
SELECT id FROM kg_task 
WHERE status = 'completed'
  AND chunks_completed = chunks_total_origin
  AND string::is::string(id) AND (
    (SELECT VALUE source_task_id FROM kg_build_task WHERE source_task_id IS NOT NONE)
    CONTAINS id
  )
```

注意：上面的 SQL 逻辑可能需要在实现时调整为更可靠的写法，比如：
```typescript
// 应用层逻辑替代：
const completedTasks = ... // 查询 completed 的 kg_task
for (const taskId of completedTasks) {
  const buildExists = this.client.extractRecords(
    await this.client.query(
      `SELECT id FROM kg_build_task WHERE source_task_id = $tid LIMIT 1;`,
      { tid: taskId }
    )
  )
  if (buildExists.length > 0) {
    // 安全清理
    await this.client.query(`DELETE kg_chunk WHERE task_id = $tid;`, { tid: taskId })
    await this.client.query(`DELETE ${taskId};`)
  }
}
```

---

## 七、GraphBuildScheduler 详细设计

### 7.1 文件结构

```
src/utility/Knowledge-graph/
├── core/
│   ├── task-scheduler.ts              ← 已有，需修改 cleanup()
│   ├── graph-build-scheduler.ts       ← 新增：第二阶段调度器
│   ├── response-parser.ts            ← 新增：LLM 返回解析纯函数
│   └── graph-upsert.ts               ← 新增：entity/relation upsert 逻辑
├── service/
│   ├── task-submission/index.ts       ← 已有，需修改 schema + submitTask
│   └── graph-schema/index.ts          ← 新增：目标库图谱表 schema 创建
├── bridge/
│   └── message-handler.ts             ← 已有，需修改
├── db/
│   └── surreal-client.ts              ← 已有，不改
└── entry.ts                           ← 已有，需修改
```

### 7.2 GraphBuildScheduler 核心逻辑

```typescript
export class GraphBuildScheduler {
  private client: KGSurrealClient
  private sendMessage: (msg: KGToMainMessage) => void
  
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private isProcessing = false
  private cleanupDone = false
  private isActive = false
  
  private readonly POLL_INTERVAL = 2000
  private readonly BATCH_SIZE = 5  // 每批处理的 chunk 数
  
  constructor(client, sendMessage) { ... }
  
  async start(): Promise<void> { ... }
  stop(): void { ... }
  kick(): void { ... }
  
  // 启动清理（仅一次）
  private async cleanup(): Promise<void> {
    // 1. progressing build_chunks → failed (interrupted)
    // 2. 删除 completed build_tasks + 对应 build_chunks
  }
  
  // 轮询
  private async poll(): Promise<void> {
    // 1. 优先处理已有 pending build_chunks
    // 2. 若无 → 检查是否有新 completed kg_task 需要衔接
    // 3. 都没有 → idle
  }
  
  // 衔接检测：查找 completed 的 kg_task 但尚未创建 build_task 的
  private async checkAndCreateBuildTasks(): Promise<boolean> {
    const sql = `
      SELECT * FROM kg_task 
      WHERE status = 'completed' 
        AND target_namespace IS NOT NONE
      ORDER BY created_at ASC;
    `
    // 对每个 completed task 检查是否已有对应 build_task
    // 若无 → 创建 build_task + batch build_chunks
    // 返回是否创建了新任务
  }
  
  // 处理单个 chunk
  private async processBuildChunk(chunk, buildTask): Promise<void> {
    // 1. 标记 progressing
    // 2. 通过 cache_key 从 kg_llm_result_cache 读取 raw_response
    // 3. 调用 parseRawResponse() 解析
    // 4. 调用 upsertGraphData() 写入目标库
    // 5. 更新 entity_chunks / relation_chunks 映射
    // 6. 标记 completed + 记录 entities_count / relations_count
  }
  
  // 状态派生（与 TaskScheduler.deriveStatus 完全相同）
  private deriveStatus(stats): string { ... }
  private async reconcileBuildTaskStatus(taskIdStr): Promise<void> { ... }
}
```

### 7.3 衔接机制

**方案：entry.ts 中注册回调**（零延迟 + 低耦合）

```typescript
// entry.ts 中
const graphBuildScheduler = new GraphBuildScheduler(surrealClient, sendMessage)
graphBuildScheduler.start()

// 胶水：第一阶段完成 → kick 第二阶段
scheduler.onTaskCompleted = () => graphBuildScheduler.kick()
```

**TaskScheduler 需要新增**：
```typescript
// task-scheduler.ts 中
public onTaskCompleted: (() => void) | null = null

// 在 reconcileTaskStatus 中 status === 'completed' 时调用：
if (status === 'completed') {
  this.sendMessage({ type: 'kg:task-completed', taskId: taskIdStr })
  this.onTaskCompleted?.()  // ← 新增这一行
}
```

### 7.4 response-parser.ts

```typescript
export const TUPLE_DELIMITER = '<|#|>'
export const COMPLETION_DELIMITER = '<|COMPLETE|>'

export interface ParsedEntity {
  name: string       // 原始名称
  sanitizedName: string  // 消毒后的 Record ID 安全名称
  type: string
  description: string
}

export interface ParsedRelation {
  srcName: string
  srcSanitized: string
  tgtName: string
  tgtSanitized: string
  keywords: string
  description: string
}

export interface ParseResult {
  entities: ParsedEntity[]
  relations: ParsedRelation[]
}

// 实体名消毒：用于 Record ID
// 规则：空格→下划线，只保留字母数字下划线中文，截断到 100 字符
export function sanitizeEntityName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '')
    .slice(0, 100)
}

// 关系确定性 ID：sorted([src, tgt]).join('_') 保证无向去重
export function makeRelationId(src: string, tgt: string): string {
  const sorted = [src, tgt].sort()
  return `${sorted[0]}_${sorted[1]}`
}

export function parseRawResponse(raw: string): ParseResult {
  const entities: ParsedEntity[] = []
  const relations: ParsedRelation[] = []
  
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  
  for (const line of lines) {
    if (line.includes(COMPLETION_DELIMITER)) break
    
    const parts = line.split(TUPLE_DELIMITER)
    
    if (parts[0]?.trim().toLowerCase() === 'entity' && parts.length >= 4) {
      const name = parts[1]?.trim()
      if (!name) continue
      entities.push({
        name,
        sanitizedName: sanitizeEntityName(name),
        type: parts[2]?.trim() || 'Other',
        description: parts[3]?.trim() || ''
      })
    } else if (parts[0]?.trim().toLowerCase() === 'relation' && parts.length >= 5) {
      const srcName = parts[1]?.trim()
      const tgtName = parts[2]?.trim()
      if (!srcName || !tgtName) continue
      relations.push({
        srcName,
        srcSanitized: sanitizeEntityName(srcName),
        tgtName,
        tgtSanitized: sanitizeEntityName(tgtName),
        keywords: parts[3]?.trim() || '',
        description: parts[4]?.trim() || ''
      })
    }
    // 不匹配的行：静默跳过
  }
  
  return { entities, relations }
}
```

### 7.5 graph-upsert.ts

```typescript
import type { KGSurrealClient } from '../db/surreal-client'
import type { ParsedEntity, ParsedRelation } from './response-parser'
import { makeRelationId } from './response-parser'

export interface UpsertResult {
  entitiesUpserted: number
  relationsUpserted: number
}

/**
 * 将解析后的 entities 和 relations 批量 upsert 到目标知识库
 * 
 * @param client - SurrealDB 客户端
 * @param namespace - 目标 namespace
 * @param database - 目标 database  
 * @param tableNames - 图谱表名 { entity, relates, entityChunks, relationChunks }
 * @param entities - 解析后的实体列表
 * @param relations - 解析后的关系列表
 * @param chunkId - 来源 chunk 标识（用于 source_ids 溯源）
 * @param fileKey - 来源文件标识
 */
export async function upsertGraphData(
  client: KGSurrealClient,
  namespace: string,
  database: string,
  tableNames: { entity: string; relates: string; entityChunks: string; relationChunks: string },
  entities: ParsedEntity[],
  relations: ParsedRelation[],
  chunkId: string,
  fileKey: string
): Promise<UpsertResult> {
  let entitiesUpserted = 0
  let relationsUpserted = 0
  
  // 构建批量 SQL
  const statements: string[] = []
  const params: Record<string, any> = {}
  
  // ---- Entity UPSERT ----
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    const paramPrefix = `e${i}`
    statements.push(`
      UPSERT ${tableNames.entity}:⟨${e.sanitizedName}⟩ SET
        entity_name = $${paramPrefix}_name,
        entity_type = $${paramPrefix}_type,
        description = IF description IS NONE OR description = ''
          THEN $${paramPrefix}_desc
          ELSE string::concat(description, '\n---\n', $${paramPrefix}_desc)
        END,
        source_ids = IF source_ids IS NONE
          THEN [$${paramPrefix}_chunk]
          ELSE array::union(source_ids, [$${paramPrefix}_chunk])
        END,
        file_keys = IF file_keys IS NONE
          THEN [$${paramPrefix}_fk]
          ELSE array::union(file_keys, [$${paramPrefix}_fk])
        END;
    `)
    params[`${paramPrefix}_name`] = e.name
    params[`${paramPrefix}_type`] = e.type
    params[`${paramPrefix}_desc`] = e.description
    params[`${paramPrefix}_chunk`] = chunkId
    params[`${paramPrefix}_fk`] = fileKey
  }
  
  // ---- Entity Chunks 映射 ----
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i]
    statements.push(`
      UPSERT ${tableNames.entityChunks}:⟨${e.sanitizedName}⟩ SET
        entity_name = $e${i}_name,
        chunk_ids = IF chunk_ids IS NONE
          THEN [$e${i}_chunk]
          ELSE array::union(chunk_ids, [$e${i}_chunk])
        END;
    `)
  }
  
  // ---- Relation RELATE ----
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i]
    const relId = makeRelationId(r.srcSanitized, r.tgtSanitized)
    const paramPrefix = `r${i}`
    statements.push(`
      RELATE ${tableNames.entity}:⟨${r.srcSanitized}⟩ -> ${tableNames.relates}:⟨${relId}⟩ -> ${tableNames.entity}:⟨${r.tgtSanitized}⟩ SET
        keywords = $${paramPrefix}_kw,
        description = IF description IS NONE OR description = ''
          THEN $${paramPrefix}_desc
          ELSE string::concat(description, '\n---\n', $${paramPrefix}_desc)
        END,
        source_ids = IF source_ids IS NONE
          THEN [$${paramPrefix}_chunk]
          ELSE array::union(source_ids, [$${paramPrefix}_chunk])
        END,
        file_keys = IF file_keys IS NONE
          THEN [$${paramPrefix}_fk]
          ELSE array::union(file_keys, [$${paramPrefix}_fk])
        END;
    `)
    params[`${paramPrefix}_kw`] = r.keywords
    params[`${paramPrefix}_desc`] = r.description
    params[`${paramPrefix}_chunk`] = chunkId
    params[`${paramPrefix}_fk`] = fileKey
  }
  
  // ---- Relation Chunks 映射 ----
  for (let i = 0; i < relations.length; i++) {
    const r = relations[i]
    const relId = makeRelationId(r.srcSanitized, r.tgtSanitized)
    statements.push(`
      UPSERT ${tableNames.relationChunks}:⟨${relId}⟩ SET
        relation_key = $r${i}_relkey,
        chunk_ids = IF chunk_ids IS NONE
          THEN [$r${i}_chunk]
          ELSE array::union(chunk_ids, [$r${i}_chunk])
        END;
    `)
    params[`r${i}_relkey`] = `${r.srcSanitized}::${r.tgtSanitized}`
  }
  
  // 在目标库中执行所有语句
  if (statements.length > 0) {
    await client.queryInDatabase(
      namespace,
      database,
      statements.join('\n'),
      params
    )
    entitiesUpserted = entities.length
    relationsUpserted = relations.length
  }
  
  return { entitiesUpserted, relationsUpserted }
}
```

**注意**：`⟨...⟩` 是 SurrealDB 的 Record ID 转义语法，用于包含特殊字符的 ID。如果 sanitize 后的名称只含字母数字下划线，也可以不用 `⟨⟩`，直接用 `:Name` 格式。实现时需要确认哪种在 SDK 中更可靠。

### 7.6 日志策略

```
场景                              级别      是否输出
─────────────────────────────────────────────────────
idle ↔ active 切换               info      ✅
每批处理完成摘要                   info      ✅  "Batch: 5 chunks → +23 entities, +14 relations [1.2s]"
衔接触发（新 build_task 创建）    info      ✅  "Build task created for kg_task:xxx (42 chunks)"
单个 chunk 成功                   —         ❌
单个 chunk 失败                   error     ✅  含 task_id, chunk_id, 错误详情
解析出 0 结果                     warn      ✅
DB upsert 失败                    error     ✅
启动清理摘要                      info      ✅
轮询心跳（idle 时）               —         ❌
```

---

## 八、前端配置面板扩展

### 8.1 当前行为

`CreateKgConfigDialog.vue` 提交 `{ name, embeddingConfigId }` → `knowledge-config.store.ts` 的 `createKgConfig()` → 写入配置 JSON 文件。

**不涉及数据库操作**，只是在本地配置文件中记录。

### 8.2 扩展：创建配置时同步创建图谱表

**流程**：

```
1. 用户选择嵌入配置 → 弹窗提交
2. createKgConfig() 写入配置文件（已有）
3. ★ 新增：调用 IPC 在目标知识库 DB 中创建图谱表
4. 返回创建结果（表名列表 + 字段定义）供前端确认
```

**需要的信息**：
- `embeddingConfigId` → 从 `KnowledgeGraphModelConfig` 中获取
- `dimensions` → 从对应的 `EmbeddingModelConfig` 中获取（或通过 IPC 查询）
- `namespace` + `database` → 当前知识库的命名空间和数据库名

**关键**：`EmbeddingModelConfig` 中有 `dimensions?: number` 字段，但可能为空。需要确保创建 KG 配置时 dimensions 已知。

### 8.3 需要修改的文件

#### 8.3.1 `KnowledgeGraphModelConfig` 类型扩展

文件：`src/preload/types/knowledge-config.types.ts`

```typescript
export interface KnowledgeGraphModelConfig {
  id: string
  name: string
  embeddingConfigId: string
  llmProviderId: string
  llmModelId: string
  chunkConcurrency: number
  entityTypes: string[]
  outputLanguage: string
  // ★ 新增
  graphTableBase?: string    // 图谱表基名，如 'kg_emb_cfg_xxx_3072'
  graphTablesCreated?: boolean  // 图谱表是否已创建
}
```

#### 8.3.2 `CreateKgConfigDialog.vue` 不需要改

创建弹窗本身不需要改，图谱表创建在 store 层处理。

#### 8.3.3 `knowledge-config.store.ts` 的 `createKgConfig` 扩展

```typescript
async function createKgConfig(
  kbId: number,
  configData: Omit<KnowledgeGraphModelConfig, 'id'>
): Promise<KnowledgeGraphModelConfig> {
  // 1. 获取嵌入配置的 dimensions
  const embConfig = getEmbeddingConfigs.value(kbId)
    .find(c => c.id === configData.embeddingConfigId)
  const dimensions = embConfig?.dimensions ?? 0
  
  // 2. 生成图谱表基名
  const safeId = configData.embeddingConfigId.replace(/[^a-zA-Z0-9_]/g, '_')
  const graphTableBase = `kg_emb_cfg_${safeId}_${dimensions}`
  
  const newConfig: KnowledgeGraphModelConfig = {
    id: `kg_cfg_${Date.now()}`,
    ...configData,
    graphTableBase,
    graphTablesCreated: false
  }
  
  // 3. 写入配置文件（已有逻辑）
  const currentConfigs = getKgConfigs.value(kbId)
  const currentDefaultId = getDefaultKgConfigId.value(kbId)
  const updatedKg = {
    configs: JSON.parse(JSON.stringify([...currentConfigs, newConfig])),
    defaultConfigId: currentDefaultId ?? undefined
  }
  await updateGlobalConfig(kbId, { knowledgeGraph: updatedKg })
  
  // 4. ★ 调用 IPC 在目标知识库中创建图谱表
  // 这步可以异步执行，不阻塞配置创建
  // 但在首次提交 KG 构建任务前必须确保已完成
  try {
    await window.api.knowledgeGraph.createGraphSchema({
      knowledgeBaseId: kbId,
      embeddingConfigId: configData.embeddingConfigId,
      dimensions,
      graphTableBase
    })
    // 更新 graphTablesCreated 标记
    newConfig.graphTablesCreated = true
    await updateKgConfig(kbId, newConfig.id, { graphTablesCreated: true })
  } catch (error) {
    console.error('Failed to create graph schema, will retry on first build', error)
  }
  
  return newConfig
}
```

### 8.4 IPC 消息扩展

#### `knowledge-graph-ipc.types.ts` 新增

```typescript
// 在 KGSubmitTaskParams 中新增
export interface KGSubmitTaskParams {
  fileKey: string
  sourceNamespace: string
  sourceDatabase: string
  sourceTable: string
  config: KGTaskConfig
  // ★ 新增
  targetNamespace?: string
  targetDatabase?: string
  targetTableBase?: string  // 图谱表基名
}

// 新增消息类型
export type MainToKGMessage =
  | { type: 'kg:init'; dbConfig: KGDBConfig }
  | { type: 'kg:submit-task'; requestId: string; data: KGSubmitTaskParams }
  | { type: 'kg:query-status'; requestId: string }
  | { type: 'kg:update-concurrency'; maxConcurrency: number }
  | { type: 'kg:concurrency-response'; value: number }
  | { type: 'kg:update-model-providers'; providers: KGModelProviderConfig[] }
  // ★ 新增
  | { type: 'kg:create-graph-schema'; requestId: string; data: KGCreateSchemaParams }
  | { type: 'kg:query-build-status'; requestId: string }

export interface KGCreateSchemaParams {
  targetNamespace: string
  targetDatabase: string
  graphTableBase: string
}

export type KGToMainMessage =
  | ... // 已有的
  // ★ 新增
  | { type: 'kg:schema-created'; requestId: string; tables: string[] }
  | { type: 'kg:schema-error'; requestId: string; error: string }
  | { type: 'kg:build-progress'; taskId: string; completed: number; failed: number; total: number; entitiesTotal: number; relationsTotal: number }
  | { type: 'kg:build-completed'; taskId: string }
  | { type: 'kg:build-status'; requestId: string; tasks: KGBuildTaskStatus[] }

export interface KGBuildTaskStatus {
  taskId: string
  sourceTaskId: string
  fileKey: string
  status: string
  chunksTotal: number
  chunksCompleted: number
  chunksFailed: number
  entitiesUpserted: number
  relationsUpserted: number
}
```

### 8.5 kg-build.store.ts 修改

`startBuild()` 需要传入 target 信息：

```typescript
async function startBuild(params: StartBuildParams): Promise<{ success: boolean; error?: string }> {
  const { fileKey, databaseName, kgConfig, embeddingTableName } = params
  
  // ... 现有逻辑 ...
  
  const result = await window.api.knowledgeGraph.submitTask({
    fileKey,
    sourceNamespace: 'knowledge',
    sourceDatabase: databaseName,
    sourceTable: embeddingTableName,
    config: { ... },
    // ★ 新增
    targetNamespace: 'knowledge',
    targetDatabase: databaseName,
    targetTableBase: kgConfig.graphTableBase
  })
  
  // ...
}
```

---

## 九、分步实施计划

### Phase 0：验证 ✅ 已完成

### Phase 1：类型 + Schema（基础设施）

| 步骤 | 文件 | 变更内容 | 依赖 |
|------|------|----------|------|
| **P1** | `src/Public/ShareTypes/knowledge-graph-ipc.types.ts` | `KGSubmitTaskParams` 新增 `targetNamespace`/`targetDatabase`/`targetTableBase`；新增 `KGCreateSchemaParams`、`KGBuildTaskStatus` 类型；`MainToKGMessage` 新增 `kg:create-graph-schema`/`kg:query-build-status`；`KGToMainMessage` 新增 build 相关消息 | 无 |
| **P2** | `src/preload/types/knowledge-config.types.ts` | `KnowledgeGraphModelConfig` 新增 `graphTableBase?: string`、`graphTablesCreated?: boolean` | 无 |
| **P3** | `src/utility/Knowledge-graph/service/task-submission/index.ts` | `KG_TASK_SCHEMA` 追加 3 个 FIELD（`target_namespace`/`target_database`/`target_table_base`）；新增 `KG_BUILD_TASK_SCHEMA` + `KG_BUILD_CHUNK_SCHEMA` 常量；`ensureSchema()` 中一并初始化 | 无 |

**P1、P2、P3 互相独立，可连续完成。**

### Phase 2：核心处理模块（3 个新文件）

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| **P4** | 新建 `core/response-parser.ts` | 纯函数 `parseRawResponse()`、`sanitizeEntityName()`、`makeRelationId()`。参见第七节 7.4 | 无 |
| **P5** | 新建 `core/graph-upsert.ts` | `upsertGraphData()` 函数。参见第七节 7.5 | P4 |
| **P6** | 新建 `service/graph-schema/index.ts` | `createGraphSchema(client, namespace, database, tableBase)` — 在目标库执行 Schema SQL，返回创建的表名列表 | 无 |

**P4 和 P6 互相独立可并行；P5 依赖 P4。**

### Phase 3：核心调度器

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| **P7** | 新建 `core/graph-build-scheduler.ts` | 第二阶段循环调度器。参见第七节 7.2 | P4, P5, P6 |

### Phase 4：管线修改

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| **P8** | `service/task-submission/index.ts` | `submitTask()` 从 params 读取 target 字段写入 kg_task 记录 | P3 |
| **P9** | `core/task-scheduler.ts` | ① `cleanup()` 清理条件增加"已创建 build_task"判断 ② 新增 `onTaskCompleted` 回调属性 ③ `reconcileTaskStatus` 中 completed 时调用回调 | P3 |

### Phase 5：集成装配

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| **P10** | `bridge/message-handler.ts` | 构造函数接收 `GraphBuildScheduler`；新增 `kg:create-graph-schema` 处理（调用 P6）；新增 `kg:query-build-status` 处理 | P6, P7 |
| **P11** | `entry.ts` | 实例化 `GraphBuildScheduler` 并传入 `MessageHandler`；注册 `scheduler.onTaskCompleted = () => graphBuildScheduler.kick()` | P7, P10 |

### Phase 6：前端扩展

| 步骤 | 文件 | 内容 | 依赖 |
|------|------|------|------|
| **P12a** | `preload/types/knowledge-graph.types.ts` | `KnowledgeGraphAPI` 新增 `createGraphSchema()` 方法类型 | P1 |
| **P12b** | `renderer/src/stores/knowledge-library/knowledge-config.store.ts` | `createKgConfig()` 扩展：生成 graphTableBase、调用 IPC 创建图谱表、更新 graphTablesCreated 标记 | P12a |
| **P12c** | `renderer/src/stores/knowledge-graph/kg-build.store.ts` | `startBuild()` 传入 `targetNamespace`/`targetDatabase`/`targetTableBase` | P1 |
| **P12d** | Preload API 实现层 + Main 进程 IPC 转发 | 新增 `createGraphSchema` 的 IPC handler，转发到 KG utility process | P10 |

### Phase 7：验证

| 步骤 | 内容 |
|------|------|
| **P13** | 端到端验证：①创建 KG 配置 → 确认图谱表已在目标库创建 ②提交任务 → LLM 提取 → 自动衔接 → 图谱写入 ③验证 entity/relation 数据正确性 ④重启进程验证清理逻辑 ⑤重复提交同文档验证幂等性 |

### 依赖关系图

```
P1(类型) ──→ P8(submitTask) ──→ P11(entry 装配)
P2(config类型) ──→ P12b(store)
P3(schema) ──→ P8, P9

P4(parser) ──→ P5(upsert) ──→ P7(scheduler) ──→ P10(handler) ──→ P11(entry)
P6(graph-schema) ──→ P10

P9(task-scheduler 改) ──→ P11

P12a ──→ P12b, P12c, P12d

全部 ──→ P13(验证)
```

**推荐执行顺序**：`P1 → P2 → P3 → P4 → P6 → P5 → P7 → P8 → P9 → P10 → P11 → P12a → P12b → P12c → P12d → P13`

---

## 十、幂等性设计总结

**幂等 = 同一操作执行 N 次，结果与执行 1 次完全相同。**

| 操作 | 幂等方案 |
|------|----------|
| Entity UPSERT | Record ID 固定为 `{entityTable}:⟨sanitizedName⟩`，UPSERT 天然幂等 |
| Entity description 拼接 | 应用层先查 source_ids 判断该 chunk 是否已处理过，是则跳过拼接 |
| Entity source_ids/file_keys | `array::union` 集合合并，天然幂等 |
| Relation 创建 | 确定性 ID `{relatesTable}:⟨sorted_src_tgt⟩`，同 ID RELATE 原地更新 |
| entity_chunks / relation_chunks 映射 | `array::union` 合并 chunk_ids，天然幂等 |
| kg_build_chunk 处理 | 失败重试：reset → pending，重新处理；entity/relation 的幂等性保证数据一致 |

**描述合并策略（首期拼接）**：
- 首次写入直接使用新描述
- 后续追加用 `\n---\n` 分隔
- 应用层通过 source_ids 检查防止同 chunk 重复拼接
- 后续可选：描述超长时调用 LLM 摘要压缩（作为独立后处理任务）

---

## 十一、并发模型

```
GraphBuildScheduler
├── 每次 poll 处理 1 个 build_task 的 1 批 chunks
├── 每批最多 BATCH_SIZE = 5 个 chunks 并行
│   ├── chunk_0: parse → upsert (跨库 queryInDatabase)
│   ├── chunk_1: parse → upsert
│   ├── chunk_2: parse → upsert
│   ├── chunk_3: parse → upsert
│   └── chunk_4: parse → upsert
└── 批次间串行
```

**SurrealDB 并发安全**：单个 UPSERT 是 record-level 原子操作（DeepWiki 确认：先 CREATE，冲突则回滚重试 UPDATE）。`array::union` 在并发 UPSERT 中可能丢失一个更新（乐观并发），但 `source_ids` 和 `file_keys` 的完整性不影响图谱正确性，可接受。

---

## 十二、与 LightRAG 查询兼容性

| LightRAG 查询模式 | 需要的数据 | 我们的表支持 |
|----------|-----------|-------------|
| **Local**（实体中心） | entity 名称/描述 → 一跳关系 → 关联 chunks | `entity` (name UNIQUE 索引) → `relates` (图遍历) → `entity_chunks` (溯源) |
| **Global**（社区级） | 社区检测 + 摘要 | `entity.meta.community_id`（预留 FLEXIBLE 字段） |
| **Hybrid** | Local + Global | 同上 |

**查询示例**：
```sql
-- 一跳邻居
SELECT ->kg_emb_cfg_xxx_3072_relates->kg_emb_cfg_xxx_3072_entity AS neighbors 
FROM kg_emb_cfg_xxx_3072_entity:⟨Machine_Learning⟩;

-- 两跳
SELECT ->kg_emb_cfg_xxx_3072_relates->kg_emb_cfg_xxx_3072_entity->kg_emb_cfg_xxx_3072_relates->kg_emb_cfg_xxx_3072_entity AS two_hop
FROM kg_emb_cfg_xxx_3072_entity:⟨Machine_Learning⟩;

-- 按类型过滤
SELECT * FROM kg_emb_cfg_xxx_3072_entity WHERE entity_type = 'Concept';

-- 实体溯源
SELECT chunk_ids FROM kg_emb_cfg_xxx_3072_entity_chunks WHERE entity_name = 'Machine Learning';
```
