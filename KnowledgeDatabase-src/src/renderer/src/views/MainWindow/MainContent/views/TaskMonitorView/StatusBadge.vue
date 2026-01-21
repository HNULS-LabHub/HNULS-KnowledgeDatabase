<template>
  <span :class="['inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', badgeClass]">
    <component :is="iconComponent" :class="['w-3 h-3', { 'animate-spin': status === 'running' }]" />
    {{ formattedStatus }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@renderer/stores/global-monitor-panel/task-monitor.types'

const props = defineProps<{
  status: TaskStatus
}>()

const badgeClass = computed(() => {
  const styles: Record<TaskStatus, string> = {
    running: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    queued: 'bg-amber-50 text-amber-700 border-amber-200',
    paused: 'bg-slate-100 text-slate-600 border-slate-200'
  }
  return styles[props.status] || styles.queued
})

const iconComponent = computed(() => {
  const icons: Record<TaskStatus, any> = {
    running: {
      template: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      `
    },
    completed: {
      template: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      `
    },
    failed: {
      template: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      `
    },
    queued: {
      template: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      `
    },
    paused: {
      template: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="10" y1="15" x2="10" y2="9" />
          <line x1="14" y1="15" x2="14" y2="9" />
        </svg>
      `
    }
  }
  return icons[props.status] || icons.queued
})

const formattedStatus = computed(() => {
  return props.status.charAt(0).toUpperCase() + props.status.slice(1)
})
</script>
