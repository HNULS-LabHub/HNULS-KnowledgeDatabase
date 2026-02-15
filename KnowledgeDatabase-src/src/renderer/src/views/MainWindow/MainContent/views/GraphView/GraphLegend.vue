<template>
  <div class="gv-graph-legend absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg border border-slate-100 shadow-sm px-3 py-2 max-w-[200px]">
    <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">实体类型</p>
    <div class="flex flex-wrap gap-x-3 gap-y-1">
      <div
        v-for="item in legend"
        :key="item.type"
        class="flex items-center gap-1.5"
      >
        <span
          class="w-2.5 h-2.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: item.color }"
        />
        <span class="text-xs text-slate-600 leading-none">{{ item.type }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  legend: Array<{ type: string; color: string }>
}>()
</script>
