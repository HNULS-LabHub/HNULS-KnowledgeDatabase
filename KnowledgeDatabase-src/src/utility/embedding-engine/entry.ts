import { parentPort } from 'worker_threads'

// 简单的日志封装，带进程标识
const log = (msg: string) => {
    console.log(`[Embedding-Engine] ${msg}`)
}

log('Starting Embedding Engine Process...')

if (!parentPort) {
    log('Error: Not running inside a UtilityProcess or Worker thread.')
    process.exit(1)
}

// 握手确认
log('Process initialized successfully. Waiting for instructions...')

// 简单的消息监听，证明连通性
parentPort.on('message', (message) => {
    log(`Received message: ${JSON.stringify(message)}`)

    // 回复
    if (message.type === 'ping') {
        parentPort?.postMessage({ type: 'pong', timestamp: Date.now() })
    }
})

// 防止进程退出的保活机制（在实际业务中会被长连接或任务队列替代）
setInterval(() => {
    // heartbeat
}, 1000 * 60)
