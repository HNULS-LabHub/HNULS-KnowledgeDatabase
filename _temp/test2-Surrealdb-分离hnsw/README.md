# SurrealDB 嵌入向量分离存储与 HNSW 索引延迟构建测试

## 测试目标

验证 SurrealDB 是否支持"先插入向量数据，后构建 HNSW 索引"的两阶段策略，以及性能表现。

## 测试方案

### Phase 1: 无索引插入测试
**文件**: `test-phase1-insert.ts`

**测试内容**:
1. 创建表（不带 HNSW 索引）
2. 批量插入向量数据（100 / 1000 条）
3. 对比单条插入 vs 批量插入性能
4. 验证数据完整性和向量维度

**预期结果**:
- 无索引时插入速度更快
- 数据能正常存储并保持维度正确

---

### Phase 2: 延迟构建索引测试
**文件**: `test-phase2-build-index.ts`

**测试内容**:
1. 在已有数据的表上执行 `DEFINE INDEX ... HNSW`
2. 测量索引构建时间
3. 验证索引构建后 KNN 查询是否正常
4. 测试索引构建后的插入性能

**预期结果**:
- 索引能在已有数据表上成功构建
- KNN 查询使用索引后性能提升
- 索引构建后插入性能可能下降（正常现象）

---

## 运行方式

### 1. 安装依赖
```powershell
npm install
```

### 2. 启动数据库（必须！）

**在第一个终端窗口**：
```powershell
npm run start-db
```

此命令会启动一个持久运行的 SurrealDB 实例：
- 端口: `8888`
- 用户名: `root`
- 密码: `root`
- 数据目录: `results/surreal-data-test-hnsw/`

**保持该窗口运行，不要关闭！**

### 3. 运行测试

**在第二个终端窗口**：

**单独运行阶段1**:
```powershell
npm run phase1
```

**单独运行阶段2**:
```powershell
npm run phase2
```

**运行完整测试**:
```powershell
npm run test:all
```

### 4. 停止数据库

在数据库窗口按 `Ctrl+C` 停止数据库进程。

---

## 日志输出

### 查询日志
所有查询细节（包括 SQL、参数、结果、执行时间）都会输出到：
- `results/phase1-insert-log.json`
- `results/phase2-build-index-log.json`

### SurrealDB 进程日志
- `results/surreal-process-phase1.log`
- `results/surreal-process-phase2.log`

### 数据目录
- `results/surreal-data-phase1/`
- `results/surreal-data-phase2/`

---

## 关键配置

### SurrealDB 可执行文件
```
KnowledgeDatabase-src/vendor/surrealdb/surreal-v2.4.0.windows-amd64.exe
```

### HNSW 索引参数
```typescript
{
  dimension: 1536,        // 向量维度
  distanceMetric: 'COSINE', // 距离度量
  type: 'F32',           // 数据类型
  efc: 200,              // 构建参数
  m: 16                  // 图连接数
}
```

---

## 测试重点

### ✅ 成功标准
1. 无索引时能正常插入和存储向量
2. 在已有数据表上能成功创建 HNSW 索引
3. 索引创建后 KNN 查询能正常工作
4. 新插入的数据能自动加入索引

### ⚠️ 需要观察
1. 索引构建时间与数据量的关系
2. 有/无索引时的插入性能对比
3. KNN 查询性能（有/无索引对比）
4. 索引构建是否阻塞其他操作

---

## 代码结构

```
_temp/test2-Surrealdb-分离hnsw/
├── start-db.ts                       # 数据库启动脚本（持久运行）
├── utils.ts                          # 工具类
│   ├── SurrealDBQueryLogger          # 查询日志记录器
│   ├── SurrealDBProcessManager       # 进程管理器
│   └── generateTestData()            # 测试数据生成
├── test-phase1-insert.ts             # 阶段1测试（连接外部DB）
├── test-phase2-build-index.ts        # 阶段2测试（连接外部DB）
├── package.json                      # 依赖配置
├── tsconfig.json                     # TS 配置
└── results/                          # 输出目录
    ├── query logs (JSON)
    ├── process logs (TXT)
    └── surreal-data-test-hnsw/       # 数据库数据目录
```

### 架构说明

**分离设计**：
1. `start-db.ts`: 启动一个持久运行的 SurrealDB 进程（端口 8888）
2. 测试脚本: 连接到该持久实例进行测试
3. 好处: 数据库生命周期独立，测试可以多次运行而不需要重启数据库

---

## 核心查询日志示例

每个查询都会记录：
```json
{
  "queryId": "query_1_1234567890",
  "action": "query_success",
  "sql": "INSERT INTO test_emb_chunks ...",
  "params": { ... },
  "duration_ms": 123,
  "result": [ ... ],
  "resultType": "object",
  "resultLength": 1,
  "timestamp": "2026-01-29T13:30:00.000Z"
}
```

---

## 下一步

根据测试结果：
1. 如果成功 → 可以在主项目中实现"导入时禁用索引，导入完成后统一构建"策略
2. 如果失败 → 记录失败原因，评估其他方案（如外部向量索引）
3. 性能数据 → 用于优化索引构建策略和参数调优
