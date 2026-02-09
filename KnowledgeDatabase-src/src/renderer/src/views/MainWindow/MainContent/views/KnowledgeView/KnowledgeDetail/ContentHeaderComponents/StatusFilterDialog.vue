<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
        @click.self="handleClose"
      >
        <div
          class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
          @click.stop
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h3 class="text-lg font-semibold text-slate-900">文档状态筛选</h3>
            <button
              class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              @click="handleClose"
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <!-- 内容 -->
          <div class="px-6 py-5">
            <div class="text-xs text-slate-500 mb-4">选择状态条件（包含为 OR，排除为 NOT）</div>

            <div class="flex flex-col gap-3">
              <div
                v-for="opt in statusOptions"
                :key="opt.value"
                class="flex items-center justify-between py-2"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="inline-flex items-center justify-center w-3 h-3 rounded-full"
                    :class="opt.dotClass"
                  ></span>
                  <span class="text-sm font-medium text-slate-700">{{ opt.label }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button
                    class="kb-filter-pill"
                    :class="{ 'kb-filter-pill-active': localState[opt.value] === 'include' }"
                    @click="() => setLocalState(opt.value, 'include')"
                  >
                    包含
                  </button>
                  <button
                    class="kb-filter-pill"
                    :class="{ 'kb-filter-pill-active': localState[opt.value] === 'exclude' }"
                    @click="() => setLocalState(opt.value, 'exclude')"
                  >
                    排除
                  </button>
                  <button
                    class="kb-filter-pill"
                    :class="{ 'kb-filter-pill-active': localState[opt.value] === 'ignore' }"
                    @click="() => setLocalState(opt.value, 'ignore')"
                  >
                    忽略
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部操作 -->
          <div
            class="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200"
          >
            <button class="kb-filter-action-btn" @click="handleReset">重置</button>
            <button class="kb-filter-action-btn" @click="handleClose">取消</button>
            <button class="kb-filter-action-btn kb-filter-action-btn-primary" @click="handleApply">
              应用筛选
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { FileNode } from '@renderer/stores/knowledge-library/file.types'

type StatusKey = 'embedded' | 'parsed' | 'parsing' | 'pending' | 'failed'
type StatusState = 'include' | 'exclude' | 'ignore'

const props = defineProps<{
  modelValue: boolean
  initialState?: Record<StatusKey, StatusState>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'apply', predicate: (file: FileNode) => boolean): void
  (e: 'reset'): void
}>()

const statusOptions: Array<{ value: StatusKey; label: string; dotClass: string }> = [
  { value: 'embedded', label: '已嵌入', dotClass: 'bg-purple-500' },
  { value: 'parsed', label: '已解析', dotClass: 'bg-emerald-500' },
  { value: 'parsing', label: '解析中', dotClass: 'bg-amber-500' },
  { value: 'pending', label: '待解析', dotClass: 'bg-slate-400' },
  { value: 'failed', label: '失败', dotClass: 'bg-rose-500' }
]

const localState = reactive<Record<StatusKey, StatusState>>({
  embedded: 'ignore',
  parsed: 'ignore',
  parsing: 'ignore',
  pending: 'ignore',
  failed: 'ignore'
})

// 监听初始状态变化
watch(
  () => props.initialState,
  (newState) => {
    if (newState) {
      Object.assign(localState, newState)
    }
  },
  { immediate: true, deep: true }
)

const setLocalState = (key: StatusKey, state: StatusState) => {
  localState[key] = state
}

const buildPredicate = () => {
  const includeList = (Object.keys(localState) as StatusKey[]).filter(
    (k) => localState[k] === 'include'
  )
  const excludeList = (Object.keys(localState) as StatusKey[]).filter(
    (k) => localState[k] === 'exclude'
  )

  return (file: FileNode) => {
    const status = (file.status || 'pending') as StatusKey
    if (excludeList.includes(status)) return false
    if (includeList.length === 0) return true
    return includeList.includes(status)
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleApply = () => {
  const predicate = buildPredicate()
  emit('apply', predicate)
  handleClose()
}

const handleReset = () => {
  ;(Object.keys(localState) as StatusKey[]).forEach((k) => {
    localState[k] = 'ignore'
  })
  emit('reset')
}
</script>

<style scoped>
/* 模态框动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 200ms ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .bg-white,
.modal-fade-leave-active .bg-white {
  transition:
    transform 200ms ease,
    opacity 200ms ease;
}

.modal-fade-enter-from .bg-white {
  transform: scale(0.95);
  opacity: 0;
}

.modal-fade-leave-to .bg-white {
  transform: scale(0.95);
  opacity: 0;
}

/* 筛选按钮样式 */
.kb-filter-pill {
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid #e2e8f0;
  color: #475569;
  background: #f8fafc;
  transition: all 150ms;
  cursor: pointer;
}

.kb-filter-pill:hover {
  border-color: #cbd5e1;
  background: #f1f5f9;
}

.kb-filter-pill-active {
  border-color: #4f46e5;
  color: #312e81;
  background: #ede9fe;
  font-weight: 500;
}

/* 操作按钮样式 */
.kb-filter-action-btn {
  padding: 0.5rem 1rem;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #475569;
  background: #fff;
  transition: all 150ms;
  cursor: pointer;
}

.kb-filter-action-btn:hover {
  border-color: #cbd5e1;
  color: #0f172a;
  background: #f8fafc;
}

.kb-filter-action-btn-primary {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #fff;
}

.kb-filter-action-btn-primary:hover {
  background: #4338ca;
  border-color: #4338ca;
}
</style>
