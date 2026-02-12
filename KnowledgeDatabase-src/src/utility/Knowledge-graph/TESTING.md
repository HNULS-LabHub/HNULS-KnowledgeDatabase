# Knowledge Graph E2E 测试指南

本文档用于指导如何通过端到端（E2E）测试**全面验证知识图谱构建链路**，覆盖从前端配置 → IPC → Utility Process → SurrealDB 的完整闭环。

> 说明：当前仓库未内置 E2E 自动化框架，本文档包含“可手工执行的 E2E 流程”和“推荐的自动化方案”。你可先手工跑通，再按需引入自动化。

---

## 1. 覆盖范围（目标）

至少覆盖以下功能面：

1. **模型提供商配置**同步到 KG 子进程（providerId / modelId 可用）
2. **知识图谱任务提交**（嵌入表 → kg_task + kg_chunk）
3. **真实 LLM 调用**（成功返回 raw_response）
4. **共享缓存命中**（kg_llm_result_cache 写入/复用）
5. **两级并发**（外层 userConfig、内层 KG config）
6. **重新嵌入版本判定**（embeddingUpdatedAt 变化 → 走新 cacheKey）
7. **任务监控**（进度、完成、失败状态一致）

---

## 2. 准备条件

1. **模型配置**：至少配置一个可用的 OpenAI 兼容 Provider（baseUrl + apiKey）
2. **文档数据**：准备一份文本/markdown/pdf 文档
3. **Embedding 完成**：确保该文档已有嵌入结果（能在嵌入表查询到 chunks）

---

## 3. 手工 E2E 流程（推荐先跑一遍）

### 3.1 启动应用

在 `KnowledgeDatabase-src` 目录运行：

```shell path=null start=null
npm run dev
```

> 若你使用 pnpm，可替换为 `pnpm dev`。

### 3.2 配置模型提供商

在应用 UI 中进入 **模型配置**，确保：

- Provider `enabled = true`
- baseUrl / apiKey 正确
- 模型列表中包含目标模型

验证点：
- 任务提交后 **不会提示“Provider not found / disabled”**

### 3.3 导入文档并完成嵌入

1. 创建知识库
2. 导入文档
3. 等待嵌入完成（Embedding 引擎产出 chunks）

验证点：
- embedding 表中可查询到 `file_key` 对应的 chunks

### 3.4 发起知识图谱构建

在知识图谱面板选择：

- 目标 LLM Provider / Model
- 并发数（llmConcurrency）
- 输出语言与实体类型

点击“开始构建”。

验证点：
- `kg_task` 新增记录
- `kg_chunk` 新增记录，状态从 pending → progressing → completed
- `kg_chunk.result.raw_response` 有内容

### 3.5 验证共享缓存

对同一文档再次发起 KG 构建（同样配置）：

验证点：
- `kg_chunk.cache_hit = true`
- `kg_llm_result_cache` 不重复新增（同 cache_key）
- 日志中无重复 LLM 请求（可通过主进程日志观察）

### 3.6 重新嵌入版本验证（方案 A）

1. 修改嵌入配置或重新嵌入该文档
2. 重新发起 KG 构建

验证点：
- 由于 `embeddingUpdatedAt` 变化，`cache_key` 不同
- 新任务会重新走 LLM（cache_hit = false）

### 3.7 并发验证

1. 修改**用户配置**中的 `knowledgeGraph.chunkConcurrency`（外层）
2. 修改 KG 配置中的 `llmConcurrency`（内层）

验证点：
- 每次轮询只处理**一批** chunks（外层生效）
- 每批内实际并发 ≤ llmConcurrency

---

## 4. 自动化 E2E（推荐方案）

> 当前项目未集成 E2E 框架，如需自动化，可按以下方案落地。

### 4.1 推荐工具

- **Playwright + Electron**：主流、稳定、可控

### 4.2 关键建议（实现要点）

1. **启动应用**：在测试前启动 electron-vite dev（或打包后的产物）
2. **固定数据**：使用测试专用知识库与固定文档，避免噪声
3. **断言数据库**：通过 SurrealDB 查询断言 kg_task / kg_chunk / cache 表
4. **日志断言**：捕获主进程日志，确认 LLM 调用次数
5. **测试隔离**：每次测试前清理 kg_task / kg_chunk / kg_llm_result_cache

### 4.3 自动化覆盖建议

| 测试用例 | 断言点 |
| --- | --- |
| 提交任务 | kg_task/kg_chunk 创建 |
| LLM 调用 | chunk status=completed + raw_response 有值 |
| 缓存命中 | cache_hit=true + cache_key 复用 |
| 并发策略 | 同批最大并发不超限 |
| 版本切换 | embeddingUpdatedAt 变化导致 cache miss |

---

## 5. 常见问题排查

1. **Provider not found / disabled**  
   - 检查模型配置是否已保存
   - 检查 KG 子进程启动后是否收到 provider 更新

2. **cache 一直 miss**  
   - 检查 cache_key 是否随 embeddingUpdatedAt 变化
   - 检查 kg_llm_result_cache 是否写入成功

3. **chunk 一直 pending**  
   - 检查 KG 子进程是否初始化完成
   - 检查 provider 是否可用（baseUrl / apiKey）

---

## 6. 数据库快速验证语句（可选）

```sql path=null start=null
SELECT * FROM kg_task ORDER BY created_at DESC LIMIT 5;
SELECT * FROM kg_chunk WHERE task_id = $taskId ORDER BY chunk_index ASC LIMIT 10;
SELECT * FROM kg_llm_result_cache ORDER BY create_time DESC LIMIT 5;
```

