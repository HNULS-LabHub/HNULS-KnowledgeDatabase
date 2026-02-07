<template>
  <div class="agent-timeline">
    <div class="timeline-header flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-gray-700">执行时间线</h3>
      <span class="text-xs text-gray-500">{{ timelineItems.length }} 个步骤</span>
    </div>

    <div v-if="timelineItems.length === 0" class="text-sm text-gray-400 italic p-4">
      暂无执行记录
    </div>

    <div v-else class="timeline-list space-y-2">
      <div
        v-for="(item, index) in timelineItems"
        :key="index"
        class="timeline-item p-3 rounded-lg border"
        :class="getItemClasses(item)"
      >
        <div class="flex items-start gap-3">
          <!-- 图标 -->
          <div class="timeline-icon flex-shrink-0 mt-0.5">
            <component :is="getIcon(item)" class="w-4 h-4" :class="getIconColor(item)" />
          </div>

          <!-- 内容 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-sm font-medium" :class="getTitleColor(item)">
                {{ getTitle(item) }}
              </span>
              <span class="text-xs text-gray-400">
                {{ formatTime(item.at) }}
              </span>
            </div>

            <!-- 额外数据 -->
            <div v-if="item.data" class="text-xs text-gray-600 mt-1">
              <template v-if="item.type === 'node_completed' && item.data.rationale">
                <span class="font-medium">决策：</span>{{ item.data.rationale }}
              </template>
              <template v-else-if="item.data">
                {{ JSON.stringify(item.data) }}
              </template>
            </div>

            <!-- 展开详情 -->
            <div v-if="item.type === 'tool_called' || item.type === 'tool_result'" class="mt-2">
              <button
                class="text-xs text-blue-500 hover:text-blue-600"
                @click="toggleExpand(index)"
              >
                {{ expandedItems.has(index) ? '收起' : '展开详情' }}
              </button>
              <div v-if="expandedItems.has(index)" class="mt-2 p-2 bg-gray-50 rounded text-xs">
                <pre class="whitespace-pre-wrap overflow-x-auto">{{ formatToolData(item) }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import type { AgentEvent } from '@renderer/stores/rag/agent.types'

const agentStore = useAgentStore()

// 展开的项目
const expandedItems = ref(new Set<number>())

// 时间线项目（按时间顺序）
const timelineItems = computed(() => {
  return agentStore.currentEvents.sort((a, b) => a.at - b.at)
})

// 切换展开
function toggleExpand(index: number) {
  if (expandedItems.value.has(index)) {
    expandedItems.value.delete(index)
  } else {
    expandedItems.value.add(index)
  }
}

// 获取标题
function getTitle(item: AgentEvent): string {
  switch (item.type) {
    case 'run_started':
      return '运行开始'
    case 'run_completed':
      return '运行完成'
    case 'node_started':
      return `节点开始：${item.node}`
    case 'node_completed':
      return `节点完成：${item.node}`
    case 'tool_called':
      return `调用工具：${item.tool}`
    case 'tool_result':
      return `工具结果：${item.tool}`
    case 'retrieval_results':
      return `检索结果：${item.docs.length} 个文档`
    case 'error':
      return `错误：${item.node || '未知节点'}`
    default:
      return item.type
  }
}

// 获取图标
function getIcon(item: AgentEvent) {
  switch (item.type) {
    case 'run_started':
    case 'node_started':
      return 'svg'
    case 'run_completed':
    case 'node_completed':
      return 'svg'
    case 'tool_called':
    case 'tool_result':
      return 'svg'
    case 'retrieval_results':
      return 'svg'
    case 'error':
      return 'svg'
    default:
      return 'svg'
  }
}

// 获取图标颜色
function getIconColor(item: AgentEvent): string {
  switch (item.type) {
    case 'run_started':
    case 'node_started':
      return 'text-blue-500'
    case 'run_completed':
    case 'node_completed':
      return 'text-emerald-500'
    case 'tool_called':
    case 'tool_result':
      return 'text-purple-500'
    case 'retrieval_results':
      return 'text-amber-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
}

// 获取标题颜色
function getTitleColor(item: AgentEvent): string {
  if (item.type === 'error') return 'text-red-600'
  return 'text-gray-700'
}

// 获取项目样式
function getItemClasses(item: AgentEvent): string {
  switch (item.type) {
    case 'error':
      return 'border-red-200 bg-red-50'
    case 'run_completed':
    case 'node_completed':
      return 'border-emerald-200 bg-emerald-50'
    case 'node_started':
      return 'border-blue-200 bg-blue-50'
    default:
      return 'border-gray-200 bg-white'
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

// 格式化工具数据
function formatToolData(item: AgentEvent): string {
  if (item.type === 'tool_called' && item.input) {
    return JSON.stringify(item.input, null, 2)
  }
  if (item.type === 'tool_result' && item.output) {
    return JSON.stringify(item.output, null, 2)
  }
  return '无数据'
}
</script>
