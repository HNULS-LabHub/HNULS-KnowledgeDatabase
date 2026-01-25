<template>
  <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
    <div
      :class="['h-full rounded-full transition-all duration-500', colorClass]"
      :style="{ width: `${value}%` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TaskStatus } from '@preload/types'

const props = defineProps<{
  value: number
  status: TaskStatus
}>()

const colorClass = computed(() => {
  const colors: Record<TaskStatus, string> = {
    pending: 'bg-amber-500',
    running: 'bg-blue-600',
    paused: 'bg-slate-400',
    completed: 'bg-emerald-500',
    failed: 'bg-rose-500'
  }
  return colors[props.status] || 'bg-blue-600'
})
</script>
