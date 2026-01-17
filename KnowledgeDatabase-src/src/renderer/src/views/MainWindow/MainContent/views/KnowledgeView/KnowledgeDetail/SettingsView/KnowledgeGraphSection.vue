<template>
  <div
    class="kb-knowledge-graph-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100"
  >
    <div class="kb-knowledge-graph-header">
      <h3 class="kb-knowledge-graph-title text-lg font-semibold text-slate-900 mb-1">
        知识图谱配置
      </h3>
      <p class="kb-knowledge-graph-desc text-sm text-slate-500">
        配置知识图谱相关参数（功能开发中）
      </p>
    </div>
    <div class="kb-knowledge-graph-placeholder text-center py-12 text-slate-400">
      <p>知识图谱配置功能即将推出</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  knowledgeBaseId: number
}>()
</script>
