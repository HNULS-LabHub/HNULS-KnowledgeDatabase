<template>
  <div class="gv-graph-selector flex items-center gap-3">
    <label class="text-sm text-slate-500 whitespace-nowrap">选择图谱</label>
    <WhiteSelect
      :model-value="modelValue?.configId ?? null"
      :options="selectOptions"
      placeholder="请选择知识图谱..."
      root-class="w-64"
      @update:model-value="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'
import type { GraphOption } from './types'

const props = defineProps<{
  options: GraphOption[]
  modelValue: GraphOption | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GraphOption | null]
}>()

const selectOptions = computed(() =>
  props.options.map((opt) => ({
    label: `${opt.kbName} / ${opt.configName}`,
    value: opt.configId
  }))
)

function handleChange(configId: string | number | null): void {
  if (!configId) {
    emit('update:modelValue', null)
    return
  }
  const opt = props.options.find((o) => o.configId === configId) ?? null
  emit('update:modelValue', opt)
}
</script>
