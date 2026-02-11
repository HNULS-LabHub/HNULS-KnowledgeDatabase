# 架构集成

> 本模块覆盖 Sidecar vs WASM 集成模式、WebSocket 连接管理、Live Query、权限模型。讨论架构或连接管理时必读。

## 1. Electron 集成模式

### Sidecar 独立进程模式（本项目采用）

通过 Electron 主进程启动独立的 `surreal.exe` 二进制，应用通过 WebSocket 通信。

优势：
- 完整的文件系统存储（RocksDB/SurrealKV），无容量限制
- 独立内存空间，可使用 jemalloc 优化
- 支持完整的 Export/Import 备份
- 完整多线程支持

劣势：
- 需要管理子进程生命周期
- WebSocket 通信有网络开销

### WASM 嵌入式模式（了解即可）

SurrealDB 可编译为 WASM，在浏览器/渲染进程中运行。

限制：
- 存储仅支持 `kv-mem`（内存）或 `kv-indxdb`（IndexedDB，受浏览器配额限制）
- 不支持 Export/Import 备份功能
- 无多线程（WASM 无 Send trait）
- IndexedDB 不支持版本化查询

---

## 2. WebSocket 连接管理

### 心跳机制

- 客户端和服务端都每 **5 秒**发送一次 ping
- 如果期间有其他消息活动，ping 可能跳过

### 消息大小限制

| 端 | 最大帧 | 最大消息 |
|----|--------|---------|
| 服务端 | 16 MiB | 128 MiB |
| 客户端（Native SDK） | 16 MiB | 64 MiB |

可通过环境变量调整：
- `SURREAL_WEBSOCKET_MAX_FRAME_SIZE`
- `SURREAL_WEBSOCKET_MAX_MESSAGE_SIZE`

### 自动重连

SDK 内置自动重连机制：
1. 检测到断线（发送/接收错误或连接关闭）
2. 以 **1 秒间隔**持续重试连接
3. 重连成功后自动**重放状态**

### 重连后状态重放

`RouterState` 维护以下需要重放的状态：

| 状态 | 说明 |
|------|------|
| `vars` | 通过 `.set()` 设置的连接级变量 |
| `replay` | 需要重放的命令：`Use`, `Signup`, `Signin`, `Invalidate`, `Authenticate` |
| `live_queries` | 活跃的 Live Query 订阅 |
| `pending_requests` | 等待响应的请求 |

### Electron 特定建议

- 监听窗口 `suspend`/`resume` 事件，主动管理连接
- 长时间挂起可能导致服务端超时，需要主动断开和重连
- 在 `before-quit` 事件中优雅关闭连接

---

## 3. Live Query（实时查询）

### 基本语法

```sql
-- 订阅表的所有变更
LIVE SELECT * FROM user;

-- 带条件过滤
LIVE SELECT * FROM order WHERE status = 'pending';

-- Diff 模式（只传输变更差异，更高效）
LIVE SELECT DIFF FROM user;

-- 带 FETCH
LIVE SELECT * FROM order WHERE true FETCH user;
```

### 通知内容

每个通知包含：
- `query_id` — Live Query 的 UUID
- `action` — 操作类型：`CREATE`, `UPDATE`, `DELETE`, `KILLED`
- `data` — 受影响的记录数据（或 diff）

### Diff 模式

启用 `LIVE SELECT DIFF` 后，通知中的 data 不是完整记录，而是变更操作列表：
- `Add` — 新增字段/元素
- `Remove` — 删除字段/元素
- `Change` — 字符串差异（使用 diff-match-patch 算法）
- `Replace` — 值替换

适合大文档的增量同步场景。

### 生命周期

- Live Query 绑定到 WebSocket 连接
- 连接断开时，服务端会清理对应的 Live Query
- 客户端可通过 `KILL <query_id>` 主动取消订阅
- 重连后需要重新订阅

### Electron 多窗口同步

- 每个窗口可以独立订阅 Live Query
- 本地 Sidecar 模式下，所有窗口通过 WebSocket 接收通知
- 可以利用 Live Query 实现窗口间数据同步，无需通过主进程 IPC 转发

---

## 4. 权限与安全模型

### DEFINE ACCESS（替代旧的 DEFINE SCOPE）

```sql
-- 定义记录级访问控制
DEFINE ACCESS user_access ON DATABASE TYPE RECORD
  SIGNUP (CREATE user SET email = $email, password = crypto::argon2::generate($password))
  SIGNIN (SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password))
  DURATION FOR SESSION 24h FOR TOKEN 1h;
```

### 表级权限

```sql
DEFINE TABLE post PERMISSIONS
  FOR select WHERE published = true OR user = $auth.id
  FOR create, update WHERE user = $auth.id
  FOR delete WHERE user = $auth.id OR $auth.role = 'admin';
```

### $auth 变量

认证成功后，`$auth` 变量包含当前用户的记录信息：
- `$auth.id` — 用户的 Record ID
- `$auth.role` — 用户角色（如果有定义）
- 其他自定义字段

### 字段级权限

```sql
DEFINE FIELD email ON TABLE user PERMISSIONS
  FOR select WHERE id = $auth.id OR $auth.role = 'admin'
  FOR update WHERE id = $auth.id;
```

### Electron 本地应用中的权限意义

虽然本地文件可以被直接访问，但在数据库层实施权限有以下价值：
1. **逻辑一致性** — 同一份代码在云端和本地遵循相同规则
2. **审计日志** — 权限检查失败可以被记录
3. **防御深度** — 即使文件被篡改，应用层仍执行权限验证

---

## ⚠️ 不确定时必须查询

架构和连接管理涉及很多运行时细节，如果遇到以下情况必须查 deepwiki：
- 不确定某个 SDK 方法的行为
- 涉及连接池、并发限制
- 涉及存储引擎选择和配置
- 涉及集群部署和分布式特性

```
mcp_deepwiki_ask_question(
  repoName: "surrealdb/surrealdb",
  question: "<具体问题>"
)
```
