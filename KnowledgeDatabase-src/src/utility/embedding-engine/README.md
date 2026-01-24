# Embedding Engine Service (Utility Process)

## � 设计思路与架构讨论备忘 (2026-01-24)

> 以下内容基于早期架构讨论整理，用于指导后续功能设计，待具体实现明确后可归档。

### 核心需求与设计原则

1.  **非阻塞异步架构 (Non-blocking I/O)**
    *   **痛点**: Embedding 任务涉及海量 HTTP 请求与大量数据处理，若在 Main Process 执行会严重阻塞 UI（如窗口拖动卡顿）。
    *   **决策**: 采用 Electron `UtilityProcess` 独立进程。Main Process 仅充当 "API Gateway" 转发指令，计算与 I/O 全部下放。

2.  **可控的高吞吐调度 (Manual-Control Scheduler)**
    *   **痛点**: 竞品（如 RAGFlow）常因串行处理导致速度慢，或自动并发不可控导致 429 封号。
    *   **决策**: 
        *   提供 **"手动挡" 并发控制**：用户可实时调节并发数（Semaphore），配合实时 RPM/TPM 仪表盘，找到当前网络环境下的最优解。
        *   **Auto-Batching**: 自动聚合单条 Chunk 请求，大幅减少 HTTP 握手开销。

3.  **多渠道智能降级 (Smart Channel Cascading)**
    *   **痛点**: 使用廉价 Tier-2/Tier-3 模型服务商时，常遇到服务不稳定、并发限制不明等问题。
    *   **决策**: 解耦 "Model" 与 "Channel"。
        *   **优先级队列**: 用户可配置同一模型的多个渠道（如：廉价反代 > Azure 批发 > 官方直连）。
        *   **自动熔断与重试**: 引擎自动优先使用高优先级（廉价）渠道；遇错（5xx/429）自动重试下一个渠道，对上层任务透明。
        *   **成本优化**: 通过"尽可能用廉价渠道、仅在不稳定时回退到贵渠道"的策略，实现成本与稳定性的平衡。

---

## �📌 模块定位
本模块是运行在 Electron `UtilityProcess` 中的独立微服务，负责处理所有高计算量、高 I/O 密集的向量嵌入任务。

**核心职责**:
1.  **任务调度**: 管理分块嵌入请求的并发与队列。
2.  **智能路由**: 提供多渠道（Multiplexing）API 调用与故障自动转移（Failover）。
3.  **高性能 I/O**: 独立于主进程 Event Loop，确保 UI 永不卡顿。

## 🏗 架构说明
由于本模块运行在独立进程中，**严禁**直接引用 Electron 主进程模块（如 `BrowserWindow`, `app`）。

### 通信协议 (IPC)
与主进程通过 `MessagePort` 或标准 IPC 通信。

#### 接收 (Inbound)
- `embedding:start`: 开始处理文档嵌入
- `embedding:pause`: 暂停任务
- `config:update`: 更新渠道配置

#### 发送 (Outbound)
- `task:progress`: 进度更新 (RPM, TPM, Completed/Total)
- `task:completed`: 任务完成
- `error:channel`: 渠道故障报警

## 📂 目录结构
- `entry.ts`: **入口文件**。负责进程初始化与 IPC 握手。
- `scheduler.ts`: **调度器**。实现 Token Bucket 或 Limit Pool 算法。
- `channel-manager.ts`: **渠道管理**。实现优先级队列与熔断机制。
- `provider/`: **API 适配器**。
  - `openai.provider.ts`: OpenAI 兼容协议实现。
