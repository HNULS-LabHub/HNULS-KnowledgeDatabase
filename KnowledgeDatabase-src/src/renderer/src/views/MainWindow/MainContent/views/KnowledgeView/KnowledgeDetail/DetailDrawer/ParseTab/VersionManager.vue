<template>
  <div
    class="kb-version-manager flex flex-col flex-shrink-0 h-[320px] bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden"
  >
    <div
      class="h-10 px-3 flex items-center justify-between bg-slate-100/50 border-b border-slate-200"
    >
      <div class="flex items-center gap-2 text-xs font-bold text-slate-700">
        <svg
          class="w-3.5 h-3.5 text-slate-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 3v12"></path>
          <path d="M18 9v12"></path>
          <path d="M6 15c3 0 3 6 6 6s3-6 6-6"></path>
        </svg>
        <span>版本管理</span>
      </div>
      <span
        class="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-sm"
      >
        {{ versions.length }} Snapshots
      </span>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-1 relative bg-white">
      <div
        class="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"
      />

      <div
        v-for="v in versions"
        :key="v.id"
        class="group relative flex items-center gap-3 py-2.5 pl-2 pr-2 cursor-pointer select-none transition-all duration-200 ease-out rounded-lg border border-transparent"
        :class="
          activeVersionId === v.id
            ? 'bg-blue-50 border-blue-100 shadow-sm'
            : 'hover:bg-slate-100'
        "
        @click="$emit('switch-version', v.id)"
      >
        <div class="absolute left-[15px] top-0 bottom-0 w-[1px] bg-slate-200 -z-10" />

        <div class="relative z-10 flex-shrink-0 flex items-center justify-center w-4">
          <div
            class="absolute rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            :class="activeVersionId === v.id ? 'w-6 h-6 bg-blue-500/10' : 'w-0 h-0 opacity-0'"
          />
          <div
            class="rounded-full border-2 transition-all duration-300 z-20 box-border"
            :class="
              activeVersionId === v.id
                ? 'w-3 h-3 bg-white border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.1)]'
                : 'w-2 h-2 bg-slate-400 border-white ring-2 ring-white group-hover:border-blue-300 group-hover:bg-blue-100'
            "
          />
        </div>

        <div class="flex-1 min-w-0 flex flex-col">
          <div class="flex justify-between items-baseline">
            <span
              class="text-xs font-mono tracking-tight transition-colors duration-200 truncate"
              :class="
                activeVersionId === v.id
                  ? 'text-blue-700 font-bold'
                  : 'text-slate-600 group-hover:text-slate-900'
              "
            >
              {{ v.id }}
            </span>
            <span
              class="text-[10px] font-mono flex-shrink-0 ml-2"
              :class="activeVersionId === v.id ? 'text-blue-400' : 'text-slate-400'"
            >
              {{ v.timestamp }}
            </span>
          </div>
          <span
            class="text-[11px] truncate transition-colors"
            :class="activeVersionId === v.id ? 'text-blue-600/80' : 'text-slate-500'"
          >
            {{ v.name }}
          </span>
        </div>
      </div>

      <div
        class="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white to-transparent pointer-events-none z-10"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParseVersion } from './types'

defineProps<{
  versions: ParseVersion[]
  activeVersionId: string | null
}>()

defineEmits<{
  'switch-version': [versionId: string]
}>()
</script>
