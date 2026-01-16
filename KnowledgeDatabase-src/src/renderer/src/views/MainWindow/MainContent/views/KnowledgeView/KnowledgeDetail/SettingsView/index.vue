<template>
  <div class="kb-settings-view flex flex-col h-full overflow-hidden">
    <!-- TabBar 横向导航 -->
    <div
      class="kb-settings-tabbar flex items-center gap-1 px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto"
    >
      <button
        v-for="section in sections"
        :key="section.id"
        class="kb-settings-tab px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200"
        :class="{
          'kb-settings-tab-active bg-blue-50 text-blue-600': activeSection === section.id,
          'kb-settings-tab-inactive text-slate-600 hover:bg-slate-50': activeSection !== section.id
        }"
        @click="scrollToSection(section.id)"
      >
        {{ section.label }}
      </button>
    </div>

    <!-- 主内容区 -->
    <div
      ref="contentRef"
      class="kb-settings-content flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
    >
      <!-- 文档解析配置区 -->
      <DocumentParsingSection
        ref="documentParsingRef"
        :knowledge-base-id="knowledgeBaseId"
      />

      <!-- 分块配置区 -->
      <ChunkingSection
        ref="chunkingRef"
        :knowledge-base-id="knowledgeBaseId"
      />

      <!-- 嵌入配置区 -->
      <EmbeddingSection
        ref="embeddingRef"
        :knowledge-base-id="knowledgeBaseId"
      />

      <!-- 知识图谱配置区 -->
      <KnowledgeGraphSection
        ref="knowledgeGraphRef"
        :knowledge-base-id="knowledgeBaseId"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import DocumentParsingSection from './DocumentParsingSection.vue'
import ChunkingSection from './ChunkingSection.vue'
import EmbeddingSection from './EmbeddingSection.vue'
import KnowledgeGraphSection from './KnowledgeGraphSection.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const sections = [
  { id: 'document-parsing', label: '文档解析' },
  { id: 'chunking', label: '分块' },
  { id: 'embedding', label: '嵌入' },
  { id: 'knowledge-graph', label: '知识图谱' }
]

const activeSection = ref<string>(sections[0].id)
const contentRef = ref<HTMLElement | null>(null)
const documentParsingRef = ref<InstanceType<typeof DocumentParsingSection> | null>(null)
const chunkingRef = ref<InstanceType<typeof ChunkingSection> | null>(null)
const embeddingRef = ref<InstanceType<typeof EmbeddingSection> | null>(null)
const knowledgeGraphRef = ref<InstanceType<typeof KnowledgeGraphSection> | null>(null)

const sectionRefs = {
  'document-parsing': documentParsingRef,
  'chunking': chunkingRef,
  'embedding': embeddingRef,
  'knowledge-graph': knowledgeGraphRef
}

let observer: IntersectionObserver | null = null

const scrollToSection = (sectionId: string) => {
  activeSection.value = sectionId
  const sectionRef = sectionRefs[sectionId as keyof typeof sectionRefs]?.value
  if (sectionRef && contentRef.value) {
    const element = (sectionRef.$el as HTMLElement) || sectionRef
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// 监听滚动，更新 activeSection
onMounted(() => {
  if (!contentRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
          const sectionId = entry.target.getAttribute('data-section-id')
          if (sectionId) {
            activeSection.value = sectionId
          }
        }
      })
    },
    { threshold: 0.5, rootMargin: '-100px 0px' }
  )

  Object.keys(sectionRefs).forEach((sectionId) => {
    const ref = sectionRefs[sectionId as keyof typeof sectionRefs]?.value
    if (ref) {
      const element = (ref.$el as HTMLElement) || ref
      element.setAttribute('data-section-id', sectionId)
      observer?.observe(element)
    }
  })
})

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>
