<template>
  <div
    class="kb-pending-feature-card relative overflow-hidden rounded-lg border border-slate-200 bg-white p-3 group hover:border-slate-300 hover:shadow-sm transition-all"
  >
    <div
      class="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity"
    >
      <div
        class="p-1.5 rounded bg-slate-100 group-hover:bg-slate-200/50 text-slate-500 group-hover:text-slate-700"
      >
        <svg
          v-if="icon === 'embedding'"
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
        <svg
          v-else-if="icon === 'knowledge-graph'"
          class="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="6" cy="12" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
          <path d="M7.7 11.2l8-4.4" />
          <path d="M7.7 12.8l8 4.4" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="text-xs font-semibold text-slate-700">{{ title }}</h3>
        <span
          class="text-[10px] font-mono text-amber-600/80 border border-amber-200 bg-amber-50 px-1 rounded inline-block mt-0.5"
          >PENDING</span
        >
      </div>
    </div>
    <div
      class="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px] opacity-20 pointer-events-none"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  icon: 'embedding' | 'knowledge-graph'
}>()
</script>
