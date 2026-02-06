<template>
  <div class="h-full flex flex-col">
    <!-- 聊天消息区域 -->
    <div ref="chatContainer" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
      <div v-if="!currentRun" class="flex items-center justify-center h-full text-gray-400">
        <div class="text-center">
          <svg class="w-10 h-10 mx-auto mb-3 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
          <p class="text-sm">在上方输入问题，开始 Agent 对话</p>
        </div>
      </div>

      <template v-else>
        <!-- 用户消息气泡（右侧） -->
        <div class="flex justify-end">
          <div class="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-blue-500 text-white text-sm leading-relaxed shadow-sm">
            {{ currentRun.question }}
          </div>
        </div>

        <!-- Agent 回复气泡（左侧） -->
        <div class="flex justify-start">
          <div class="max-w-[85%] w-full">
            <!-- 思考过程（可折叠） -->
            <AgentThinking />

            <!-- 回复内容 -->
            <AgentAnswer />

            <!-- 引用文档（回复下方） -->
            <AgentCitations />

            <!-- 错误 -->
            <AgentErrorPanel />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useAgentStore } from '@renderer/stores/rag/agent.store'
import AgentAnswer from './AgentAnswer.vue'
import AgentThinking from './AgentThinking.vue'
import AgentCitations from './AgentCitations.vue'
import AgentErrorPanel from './AgentErrorPanel.vue'

const agentStore = useAgentStore()
const chatContainer = ref<HTMLElement>()

const currentRun = computed(() => agentStore.currentRun)

// 自动滚动到底部
watch(
  () => agentStore.currentAnswer,
  () => {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    })
  }
)

watch(
  () => agentStore.currentEvents.length,
  () => {
    nextTick(() => {
      if (chatContainer.value) {
        chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      }
    })
  }
)
</script>
