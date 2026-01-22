<template>
  <div
    class="kb-parse-nav-bar flex items-center gap-1 px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto"
  >
    <button
      v-for="section in sections"
      :key="section.id"
      class="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200"
      :class="{
        'bg-blue-50 text-blue-600': activeSection === section.id,
        'text-slate-600 hover:bg-slate-50': activeSection !== section.id
      }"
      @click="$emit('scroll-to-section', section.id)"
    >
      {{ section.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Section } from './types'

defineProps<{
  sections: Section[]
  activeSection: string
}>()

defineEmits<{
  'scroll-to-section': [sectionId: string]
}>()
</script>
