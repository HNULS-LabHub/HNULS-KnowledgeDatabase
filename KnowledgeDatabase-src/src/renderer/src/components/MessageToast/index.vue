<template>
  <Teleport to="body">
    <TransitionGroup
      tag="div"
      class="msg-toast-container fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-x-8"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 translate-x-8"
    >
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm max-w-sm"
        :class="typeClass(msg.type)"
      >
        <!-- Icon -->
        <svg
          v-if="msg.type === 'success'"
          class="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <svg
          v-else-if="msg.type === 'error'"
          class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <svg
          v-else-if="msg.type === 'warning'"
          class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <svg
          v-else
          class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-900">{{ msg.title }}</p>
          <p v-if="msg.content" class="text-xs text-slate-600 mt-0.5 whitespace-pre-line">
            {{ msg.content }}
          </p>
        </div>
        <button class="text-slate-400 hover:text-slate-600 flex-shrink-0" @click="remove(msg.id)">
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export type MessageType = 'success' | 'error' | 'warning' | 'info'

interface ToastMessage {
  id: number
  type: MessageType
  title: string
  content?: string
}

const messages = ref<ToastMessage[]>([])
let nextId = 0

function typeClass(type: MessageType): string {
  switch (type) {
    case 'success':
      return 'bg-emerald-50/95 border-emerald-200'
    case 'error':
      return 'bg-red-50/95 border-red-200'
    case 'warning':
      return 'bg-amber-50/95 border-amber-200'
    default:
      return 'bg-blue-50/95 border-blue-200'
  }
}

function add(type: MessageType, title: string, content?: string, duration = 4000): void {
  const id = nextId++
  messages.value.push({ id, type, title, content })
  if (duration > 0) {
    setTimeout(() => remove(id), duration)
  }
}

function remove(id: number): void {
  const idx = messages.value.findIndex((m) => m.id === id)
  if (idx > -1) messages.value.splice(idx, 1)
}

function success(title: string, content?: string, duration?: number): void {
  add('success', title, content, duration)
}
function error(title: string, content?: string, duration?: number): void {
  add('error', title, content, duration ?? 6000)
}
function warning(title: string, content?: string, duration?: number): void {
  add('warning', title, content, duration)
}
function info(title: string, content?: string, duration?: number): void {
  add('info', title, content, duration)
}

defineExpose({ success, error, warning, info, add, remove })
</script>
