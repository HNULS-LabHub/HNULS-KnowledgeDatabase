<template>
  <div class="relative" ref="menuRef">
    <button
      class="p-2 text-slate-400 bg-transparent border-none cursor-pointer rounded-lg transition-all duration-200 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0"
      @click.stop="toggleMenu"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="19" cy="12" r="1"></circle>
        <circle cx="5" cy="12" r="1"></circle>
      </svg>
    </button>

    <!-- 下拉菜单 -->
    <Transition name="menu">
      <div
        v-if="visible"
        class="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[160px] z-50"
        @click.stop
      >
        <button
          class="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
          @click="handleDelete"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="w-4 h-4"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            ></path>
          </svg>
          <span>删除知识库</span>
        </button>
      </div>
    </Transition>

    <!-- 确认删除对话框 -->
    <Teleport to="body">
      <Transition name="dialog">
        <div
          v-if="showConfirmDialog"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          @click.self="showConfirmDialog = false"
        >
          <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div class="flex items-start gap-4 mb-6">
              <div
                class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="w-6 h-6 text-red-600"
                >
                  <path
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  ></path>
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-slate-900 mb-2">确认删除</h3>
                <p class="text-sm text-slate-600">
                  确定要删除知识库
                  <span class="font-medium text-slate-900">"{{ kbName }}"</span> 吗？
                </p>
                <p class="text-xs text-red-600 mt-2">
                  此操作将永久删除知识库及其所有文档，且无法恢复。
                </p>
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <button
                class="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                @click="showConfirmDialog = false"
              >
                取消
              </button>
              <button
                class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                @click="confirmDelete"
                :disabled="deleting"
              >
                {{ deleting ? '删除中...' : '确认删除' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  kbId: number
  kbName: string
}>()

const emit = defineEmits<{
  (e: 'delete', id: number): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const visible = ref(false)
const showConfirmDialog = ref(false)
const deleting = ref(false)

function toggleMenu(): void {
  visible.value = !visible.value
}

function handleDelete(): void {
  visible.value = false
  showConfirmDialog.value = true
}

async function confirmDelete(): Promise<void> {
  deleting.value = true
  try {
    emit('delete', props.kbId)
    showConfirmDialog.value = false
  } catch (error) {
    console.error('Failed to delete knowledge base:', error)
    // TODO: 显示错误提示
  } finally {
    deleting.value = false
  }
}

function handleClickOutside(event: MouseEvent): void {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    visible.value = false
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
.menu-enter-active,
.menu-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active > div,
.dialog-leave-active > div {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.dialog-enter-from > div,
.dialog-leave-to > div {
  transform: scale(0.95);
  opacity: 0;
}
</style>
