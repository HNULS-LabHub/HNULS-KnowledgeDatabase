<template>
  <div class="PageSizeSelector_container" ref="selectorRef">
    <div class="PageSizeSelector_wrapper">
      <span class="PageSizeSelector_label">每页显示</span>
      <div 
        class="PageSizeSelector_trigger"
        @click="toggleDropdown"
      >
        <span class="PageSizeSelector_value">{{ modelValue }}</span>
        <svg 
          class="PageSizeSelector_arrow"
          :class="{ 'PageSizeSelector_arrow_open': isOpen }"
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <span class="PageSizeSelector_label">条</span>
    </div>

    <!-- Dropdown Menu -->
    <Transition name="dropdown">
      <div 
        v-if="isOpen"
        class="PageSizeSelector_dropdown"
      >
        <button
          v-for="option in options"
          :key="option"
          class="PageSizeSelector_option"
          :class="{ 'PageSizeSelector_option_active': option === modelValue }"
          @click="selectOption(option)"
        >
          {{ option }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const options = [10, 20, 50, 100]
const isOpen = ref(false)
const selectorRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectOption = (value: number) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (selectorRef.value && !selectorRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.PageSizeSelector_container {
  position: relative;
}

.PageSizeSelector_wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.PageSizeSelector_label {
  color: #64748b;
  font-size: 0.875rem;
}

.PageSizeSelector_trigger {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.375rem;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: background 150ms;
  user-select: none;
}

.PageSizeSelector_trigger:hover {
  background: #f8fafc;
}

.PageSizeSelector_value {
  color: #0f172a;
  font-weight: 500;
  min-width: 2rem;
  text-align: center;
}

.PageSizeSelector_arrow {
  width: 1rem;
  height: 1rem;
  color: #64748b;
  transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.PageSizeSelector_arrow_open {
  transform: rotate(180deg);
}

/* Dropdown */
.PageSizeSelector_dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 8rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 0.5rem;
  z-index: 1000;
  overflow: hidden;
}

.PageSizeSelector_option {
  width: 100%;
  padding: 0.625rem 1rem;
  border: none;
  background: transparent;
  color: #334155;
  font-size: 0.875rem;
  text-align: left;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.PageSizeSelector_option:hover {
  background: #f8fafc;
  color: #0f172a;
}

.PageSizeSelector_option_active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 500;
}

.PageSizeSelector_option_active:hover {
  background: #dbeafe;
}

.PageSizeSelector_option_active::after {
  content: '✓';
  color: #2563eb;
  font-weight: 600;
}

/* Dropdown Animation - 非线性动画 */
.dropdown-enter-active {
  animation: dropdown-in 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dropdown-leave-active {
  animation: dropdown-out 200ms cubic-bezier(0.4, 0, 1, 1);
}

@keyframes dropdown-in {
  0% {
    opacity: 0;
    transform: translateY(-0.5rem) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes dropdown-out {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-0.5rem) scale(0.95);
  }
}
</style>
