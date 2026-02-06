<template>
  <div class="kb-rag-view rag-view">
    <RagHeader />

    <div class="rag-content">
      <!-- Left: Input & Config & Pipeline -->
      <div class="left-panel">
        <QueryForm
          v-model="ragStore.query"
          :is-searching="ragStore.isSearching"
          @submit="ragStore.executeSearch"
        />
        <ConfigForm />
        <PipelineSteps :steps="ragStore.steps" :is-searching="ragStore.isSearching" />
      </div>

      <!-- Right: Results -->
      <ResultPanel :is-searching="ragStore.isSearching" :has-completed="ragStore.hasCompleted" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRagStore } from '@renderer/stores/rag/rag.store'
import RagHeader from './RagHeader.vue'
import QueryForm from './QueryForm.vue'
import ConfigForm from './ConfigForm.vue'
import PipelineSteps from './PipelineSteps.vue'
import ResultPanel from './ResultPanel.vue'

const ragStore = useRagStore()

onMounted(() => {
  ragStore.loadModels()
})
</script>
