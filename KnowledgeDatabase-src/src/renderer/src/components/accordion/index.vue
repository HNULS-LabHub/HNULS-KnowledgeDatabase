<template>
  <div class="kb-accordion" :class="rootClass">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="kb-accordion-item"
      :class="{ 'kb-accordion-item-active': activeIndex === index }"
    >
      <button
        class="kb-accordion-trigger"
        @click="toggle(index)"
      >
        <span class="kb-accordion-title">{{ item.title }}</span>
        <svg
          class="kb-accordion-icon"
          :class="{ 'kb-accordion-icon-rotated': activeIndex === index }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <Transition name="accordion-content">
        <div
          v-if="activeIndex === index"
          class="kb-accordion-content"
        >
          <div class="kb-accordion-inner">
            <slot :name="`item-${index}`" :item="item">
              {{ item.content }}
            </slot>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface AccordionItem {
  title: string
  content?: string
  [key: string]: any
}

const props = defineProps<{
  items: AccordionItem[]
  rootClass?: string
}>()

const activeIndex = ref<number | null>(null)

const toggle = (index: number) => {
  if (activeIndex.value === index) {
    activeIndex.value = null
  } else {
    activeIndex.value = index
  }
}
</script>

<style scoped>
.kb-accordion {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kb-accordion-item {
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  background: white;
  transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.kb-accordion-item-active {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
}

.kb-accordion-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background-color 200ms;
}

.kb-accordion-trigger:hover {
  background: #f8fafc;
}

.kb-accordion-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
}

.kb-accordion-icon {
  width: 1rem;
  height: 1rem;
  color: #64748b;
  transition: transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.kb-accordion-icon-rotated {
  transform: rotate(180deg);
}

.kb-accordion-content {
  overflow: hidden;
}

.kb-accordion-inner {
  padding: 0 1rem 1rem 1rem;
  color: #475569;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* 非线性动画 */
.accordion-content-enter-active {
  transition:
    height 500ms cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 400ms cubic-bezier(0.34, 1.56, 0.64, 1),
    padding 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.accordion-content-leave-active {
  transition:
    height 350ms cubic-bezier(0.4, 0, 1, 1),
    opacity 250ms cubic-bezier(0.4, 0, 1, 1),
    padding 350ms cubic-bezier(0.4, 0, 1, 1);
}

.accordion-content-enter-from {
  height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.accordion-content-enter-to {
  height: auto;
  opacity: 1;
}

.accordion-content-leave-from {
  height: auto;
  opacity: 1;
}

.accordion-content-leave-to {
  height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>
