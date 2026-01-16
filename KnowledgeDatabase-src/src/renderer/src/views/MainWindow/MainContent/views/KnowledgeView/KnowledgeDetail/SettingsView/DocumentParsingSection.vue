<template>
  <div class="kb-document-parsing-section flex flex-col gap-6 p-6 bg-white border-b border-slate-100">
    <div class="kb-document-parsing-header">
      <h3 class="kb-document-parsing-title text-lg font-semibold text-slate-900 mb-1">
        文档解析配置
      </h3>
      <p class="kb-document-parsing-desc text-sm text-slate-500">
        配置 MinerU 文档解析参数（当前为 Mock 数据）
      </p>
    </div>

    <div class="kb-document-parsing-form flex flex-col gap-6">
      <!-- 模型版本 -->
      <div class="kb-document-parsing-field">
        <label class="kb-document-parsing-label block text-sm font-medium text-slate-700 mb-2">
          模型版本
        </label>
        <WhiteSelect
          v-model="parsingConfig.modelVersion"
          :options="modelVersionOptions"
          placeholder="请选择模型版本"
        />
      </div>

      <!-- 公式识别 -->
      <div class="kb-document-parsing-field">
        <label class="kb-document-parsing-label flex items-center gap-2 mb-2">
          <input
            v-model="parsingConfig.enableFormula"
            type="checkbox"
            class="kb-document-parsing-checkbox w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-sm font-medium text-slate-700">启用公式识别</span>
        </label>
        <p class="text-xs text-slate-400 ml-6">
          仅对 pipeline 模型且非 HTML 文件有效，默认开启
        </p>
      </div>

      <!-- 表格识别 -->
      <div class="kb-document-parsing-field">
        <label class="kb-document-parsing-label flex items-center gap-2 mb-2">
          <input
            v-model="parsingConfig.enableTable"
            type="checkbox"
            class="kb-document-parsing-checkbox w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-sm font-medium text-slate-700">启用表格识别</span>
        </label>
        <p class="text-xs text-slate-400 ml-6">
          仅对 pipeline 模型且非 HTML 文件有效，默认开启
        </p>
      </div>

      <!-- 文档语言 -->
      <div class="kb-document-parsing-field">
        <label class="kb-document-parsing-label block text-sm font-medium text-slate-700 mb-2">
          文档语言
        </label>
        <WhiteSelect
          v-model="parsingConfig.language"
          :options="languageOptions"
          placeholder="请选择文档语言"
        />
        <p class="text-xs text-slate-400 mt-1">
          仅对 pipeline 模型且非 HTML 文件有效，默认中文
        </p>
      </div>

      <!-- OCR 功能 -->
      <div class="kb-document-parsing-field">
        <label class="kb-document-parsing-label flex items-center gap-2 mb-2">
          <input
            v-model="parsingConfig.isOcr"
            type="checkbox"
            class="kb-document-parsing-checkbox w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span class="text-sm font-medium text-slate-700">启用 OCR 功能</span>
        </label>
        <p class="text-xs text-slate-400 ml-6">
          仅对 pipeline 模型且非 HTML 文件有效，默认关闭
        </p>
      </div>

      <!-- 页码范围 -->
      <div class="kb-document-parsing-field">
        <label class="kb-document-parsing-label block text-sm font-medium text-slate-700 mb-2">
          页码范围
        </label>
        <input
          v-model="parsingConfig.pageRanges"
          type="text"
          class="kb-document-parsing-input w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="例如：1-600 或 2,4-6"
        />
        <p class="text-xs text-slate-400 mt-1">
          格式：逗号分隔的字符串，如 "2,4-6" 表示第2页、第4-6页
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import WhiteSelect from '@renderer/components/select/WhiteSelect.vue'

const props = defineProps<{
  knowledgeBaseId: number
}>()

const modelVersionOptions = [
  { label: 'Pipeline', value: 'pipeline' },
  { label: 'VLM', value: 'vlm' }
]

const languageOptions = [
  { label: '中文', value: 'ch' },
  { label: '英文', value: 'en' },
  { label: '日文', value: 'japan' },
  { label: '韩文', value: 'korean' }
]

const parsingConfig = ref({
  modelVersion: 'pipeline',
  enableFormula: true,
  enableTable: true,
  language: 'ch',
  isOcr: false,
  pageRanges: ''
})
</script>
