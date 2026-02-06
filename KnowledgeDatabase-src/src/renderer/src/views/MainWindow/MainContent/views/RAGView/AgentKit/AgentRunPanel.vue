<template>
  <div class="h-full flex flex-col bg-gray-50">
    <!-- 内容区域 -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="!currentRun" class="text-center text-gray-400 py-12">
        <p class="text-sm mb-2">暂无运行记录</p>
        <p class="text-xs">在上方输入框提交问题开始 Agent 流程</p>
      </div>

      <div v-else class="space-y-4">
        <!-- 错误面板 -->
        <AgentErrorPanel />

        <!-- 答案 -->
        <AgentAnswer />

        <!-- 引用文档 -->
        <AgentCitations />

        <!-- 时间线 -->
        <AgentTimeline />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import AgentAnswer from './AgentAnswer.vue'
import AgentTimeline from './AgentTimeline.vue'
import AgentCitations from './AgentCitations.vue'
import AgentErrorPanel from './AgentErrorPanel.vue'

const agentStore = useAgentStore()

// 计算属性
const currentRun = computed(() => agentStore.currentRun)
</script>
