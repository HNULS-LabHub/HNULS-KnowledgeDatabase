<template>
  <div class="kb-rag-pipeline steps-container">
    <div v-for="(step, idx) in steps" :key="step.id" class="step-item">
      <div :class="['step-icon', step.colorClass]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          v-html="step.iconPath"
        ></svg>
      </div>
      <div class="step-content">
        <p class="step-text">{{ step.text }}</p>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>
      <svg
        v-if="idx === steps.length - 1 && isSearching"
        class="zap-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
    </div>
    <div v-if="steps.length === 0 && !isSearching" class="empty-state">
      <svg
        class="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <p>输入查询以开始检索模拟</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RagStep } from '@renderer/stores/rag/rag.types'

defineProps<{
  steps: RagStep[]
  isSearching: boolean
}>()
</script>
