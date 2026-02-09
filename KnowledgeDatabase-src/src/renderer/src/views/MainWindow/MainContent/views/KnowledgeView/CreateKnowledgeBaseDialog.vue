<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
        <Transition name="dialog-scale">
          <div v-if="visible" class="dialog-container" @click.stop>
            <div class="dialog-header">
              <h2 class="dialog-title">新建知识库</h2>
              <button class="close-btn" @click="handleClose">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="dialog-body">
              <form @submit.prevent="handleSubmit" class="main-form">
                <div class="form-row">
                  <!-- 左侧：图标预览与颜色设置 -->
                  <div class="form-col-left">
                    <div class="form-group">
                      <label class="form-label">图标预览</label>
                      <div class="icon-preview-box">
                        <div
                          class="kb-icon-preview"
                          :style="{
                            color: formData.color,
                            background: getLightColor(formData.color)
                          }"
                          v-html="formData.icon || defaultIcon"
                        ></div>
                      </div>
                    </div>

                    <div class="form-group color-group">
                      <label class="form-label">主题颜色</label>

                      <!-- RGB 滑轨 -->
                      <div class="rgb-sliders">
                        <div class="slider-item">
                          <label class="slider-label red">R</label>
                          <input
                            type="range"
                            v-model.number="rgb.r"
                            min="0"
                            max="255"
                            class="slider-input red-slider"
                          />
                          <span class="slider-value">{{ rgb.r }}</span>
                        </div>
                        <div class="slider-item">
                          <label class="slider-label green">G</label>
                          <input
                            type="range"
                            v-model.number="rgb.g"
                            min="0"
                            max="255"
                            class="slider-input green-slider"
                          />
                          <span class="slider-value">{{ rgb.g }}</span>
                        </div>
                        <div class="slider-item">
                          <label class="slider-label blue">B</label>
                          <input
                            type="range"
                            v-model.number="rgb.b"
                            min="0"
                            max="255"
                            class="slider-input blue-slider"
                          />
                          <span class="slider-value">{{ rgb.b }}</span>
                        </div>
                      </div>

                      <div class="color-hex-display">
                        <div
                          class="color-preview-dot"
                          :style="{ background: formData.color }"
                        ></div>
                        <span class="hex-text">{{ formData.color.toUpperCase() }}</span>
                      </div>

                      <!-- 快速选择预设 -->
                      <div class="preset-colors">
                        <div
                          v-for="color in presetColors"
                          :key="color"
                          class="preset-color-dot"
                          :style="{ background: color }"
                          @click="setColor(color)"
                        ></div>
                      </div>
                    </div>
                  </div>

                  <!-- 右侧：基本信息 -->
                  <div class="form-col-right">
                    <div class="form-group">
                      <label class="form-label" for="kb-name">
                        知识库名称 <span class="required">*</span>
                      </label>
                      <input
                        id="kb-name"
                        v-model="formData.name"
                        type="text"
                        class="form-input"
                        :class="{ 'input-error': nameError }"
                        placeholder="例如：product_docs"
                        maxlength="64"
                        required
                        @input="validateName"
                        @blur="validateName"
                      />
                      <p v-if="nameError" class="form-error">{{ nameError }}</p>
                      <p v-else class="form-hint naming-hint">
                        💡 只能使用字母、数字和下划线，不能以数字开头，建议使用英文或拼音（如
                        species_research）
                      </p>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="kb-desc">知识库描述</label>
                      <textarea
                        id="kb-desc"
                        v-model="formData.description"
                        class="form-textarea"
                        placeholder="简要描述这个知识库的用途..."
                        rows="2"
                        maxlength="200"
                      ></textarea>
                    </div>

                    <div class="form-group flex-fill-group">
                      <label class="form-label">图标选择</label>
                      <div class="icon-tabs">
                        <button
                          type="button"
                          class="tab-btn"
                          :class="{ active: iconTab === 'preset' }"
                          @click="iconTab = 'preset'"
                        >
                          预设图标
                        </button>
                        <button
                          type="button"
                          class="tab-btn"
                          :class="{ active: iconTab === 'custom' }"
                          @click="iconTab = 'custom'"
                        >
                          自定义 SVG
                        </button>
                      </div>

                      <div class="icon-selector-area">
                        <div v-if="iconTab === 'preset'" class="preset-icons-grid">
                          <div
                            v-for="(svg, idx) in presetIcons"
                            :key="idx"
                            class="preset-icon-item"
                            :class="{ active: formData.icon === svg }"
                            @click="formData.icon = svg"
                            v-html="svg"
                          ></div>
                        </div>

                        <div v-else class="custom-icon-input">
                          <textarea
                            v-model="formData.icon"
                            class="form-textarea code-font fill-height"
                            placeholder='<svg viewBox="0 0 24 24">...</svg>'
                          ></textarea>
                          <p class="form-hint">请粘贴完整的 SVG 代码</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 按钮组 -->
                <div class="form-actions">
                  <button type="button" class="btn btn-secondary" @click="handleClose">取消</button>
                  <button type="submit" class="btn btn-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    创建知识库
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue'

interface Props {
  visible: boolean
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'submit', data: KnowledgeBaseFormData): void
}

export interface KnowledgeBaseFormData {
  name: string
  description: string
  color: string
  icon: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 预设图标 SVG 字符串
const presetIcons = [
  // 文件夹
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
  // 文档
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  // 数据库/层叠
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>`,
  // 代码/技术
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`,
  // 书签/标签
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
  // 档案盒
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`,
  // 地球/网络
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
  // 图表
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
]

const presetColors = [
  '#2563eb',
  '#7c3aed',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899'
]

const defaultIcon = presetIcons[0]

const formData = ref<KnowledgeBaseFormData>({
  name: '',
  description: '',
  color: '#2563eb',
  icon: defaultIcon
})

const iconTab = ref<'preset' | 'custom'>('preset')
const rgb = reactive({ r: 37, g: 99, b: 235 }) // Default blue
const nameError = ref<string>('')

// Helper: Component -> Hex
const componentToHex = (c: number) => {
  const hex = c.toString(16)
  return hex.length === 1 ? '0' + hex : hex
}

// Helper: RGB -> Hex
const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b)
}

// Helper: Hex -> RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

// Watch RGB changes -> Update Hex
watch(rgb, (newRgb) => {
  formData.value.color = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
})

// Set color from preset
const setColor = (hex: string) => {
  formData.value.color = hex
  const newRgb = hexToRgb(hex)
  if (newRgb) {
    rgb.r = newRgb.r
    rgb.g = newRgb.g
    rgb.b = newRgb.b
  }
}

const handleClose = () => {
  emit('update:visible', false)
}

const handleOverlayClick = () => {
  handleClose()
}

/**
 * 验证知识库名称
 */
const validateName = () => {
  const name = formData.value.name.trim()

  if (!name) {
    nameError.value = ''
    return false
  }

  // 1. 长度检查
  if (name.length > 64) {
    nameError.value = '名称不能超过 64 个字符'
    return false
  }

  // 2. 不能以数字开头
  if (/^[0-9]/.test(name)) {
    nameError.value = '名称不能以数字开头'
    return false
  }

  // 3. 只允许字母、数字、下划线
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    nameError.value = '名称只能包含字母、数字和下划线'
    return false
  }

  // 4. 检查保留关键字
  const reserved = ['system', 'admin', 'root', 'database', 'namespace']
  if (reserved.includes(name.toLowerCase())) {
    nameError.value = '不能使用系统保留名称'
    return false
  }

  nameError.value = ''
  return true
}

const handleSubmit = () => {
  if (!formData.value.name.trim()) {
    nameError.value = '知识库名称不能为空'
    return
  }

  // 验证名称
  if (!validateName()) {
    return
  }

  if (!formData.value.icon) {
    formData.value.icon = defaultIcon
  }
  emit('submit', { ...formData.value })
  handleClose()
  resetForm()
}

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    color: '#2563eb',
    icon: defaultIcon
  }
  iconTab.value = 'preset'
  nameError.value = ''
  const defRgb = hexToRgb('#2563eb')
  if (defRgb) {
    Object.assign(rgb, defRgb)
  }
}

// 辅助函数：生成浅色背景色 (Hex 转 RGBA)
const getLightColor = (hex: string) => {
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) return 'rgba(0,0,0,0.05)'

  let c = hex.substring(1).split('')
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]]
  }
  const r = parseInt(c[0] + c[1], 16)
  const g = parseInt(c[2] + c[3], 16)
  const b = parseInt(c[4] + c[5], 16)

  return `rgba(${r}, ${g}, ${b}, 0.1)`
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      // Ensure RGB matches current hex when opening
      const currentRgb = hexToRgb(formData.value.color)
      if (currentRgb) Object.assign(rgb, currentRgb)
    } else {
      setTimeout(resetForm, 300)
    }
  }
)
</script>

<style scoped>
/* 遮罩层 */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

/* 对话框容器 */
.dialog-container {
  background: white;
  border-radius: 1rem;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 900px; /* 增加宽度 */
  height: 650px; /* 固定高度，确保有剩余空间可供填充 */
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.close-btn {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 200ms;
}
.close-btn:hover {
  background: #f1f5f9;
  color: #475569;
}
.close-btn svg {
  width: 1.25rem;
  height: 1.25rem;
}

/* 主体布局 */
.dialog-body {
  flex: 1; /* 撑满剩余高度 */
  overflow: hidden; /* 防止body滚动，使用内部滚动 */
  display: flex;
  flex-direction: column;
}

.main-form {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.form-row {
  display: grid;
  grid-template-columns: 300px 1fr; /* 增加左侧宽度 */
  gap: 2rem;
  flex: 1;
  padding: 1.5rem;
  overflow: hidden; /* 关键：防止网格项目撑开容器 */
}

/* 左侧样式 */
.form-col-left {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%; /* 宽度适应容器 */
  min-width: 0; /* 允许收缩 */
  overflow-x: hidden; /* 防止横向滚动 */
  box-sizing: border-box;
}

.icon-preview-box {
  width: 100%;
  aspect-ratio: 1;
  max-width: 120px; /* 限制最大宽度 */
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}

.kb-icon-preview {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 300ms;
}

.kb-icon-preview :deep(svg) {
  width: 1.5rem;
  height: 1.5rem;
}

/* RGB Slider Styles */
.rgb-sliders {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 0.75rem;
  width: 100%;
  box-sizing: border-box;
}

.slider-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-width: 0; /* 允许收缩 */
}

.slider-label {
  font-size: 0.75rem;
  font-weight: 700;
  width: 1rem;
}
.slider-label.red {
  color: #ef4444;
}
.slider-label.green {
  color: #10b981;
}
.slider-label.blue {
  color: #3b82f6;
}

.slider-input {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: #e2e8f0;
  border-radius: 2px;
  outline: none;
}

.slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: white;
  border: 2px solid #cbd5e1;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  margin-top: -5px; /* (4px height - 14px thumb) / 2 */
}
/* Slider Track custom colors */
.slider-input::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
}
.red-slider::-webkit-slider-thumb {
  border-color: #ef4444;
}
.green-slider::-webkit-slider-thumb {
  border-color: #10b981;
}
.blue-slider::-webkit-slider-thumb {
  border-color: #3b82f6;
}

.slider-value {
  font-size: 0.75rem;
  font-family: monospace;
  color: #64748b;
  width: 1.5rem;
  text-align: right;
}

.color-hex-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  width: 100%;
  box-sizing: border-box;
}

.color-preview-dot {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.hex-text {
  font-family: monospace;
  color: #475569;
  font-size: 0.875rem;
}

.preset-colors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.preset-color-dot {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.375rem;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.1);
  transition: transform 200ms;
}
.preset-color-dot:hover {
  transform: scale(1.1);
}

/* 右侧表单样式 */
.form-col-right {
  display: flex;
  flex-direction: column;
  height: 100%; /* 填满父容器 */
  overflow: hidden;
}

.form-group {
  margin-bottom: 1.25rem;
  flex-shrink: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.form-group.flex-fill-group {
  flex: 1; /* 这个组占据剩余空间 */
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  min-height: 0; /* 允许 flex item 压缩 */
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #0f172a;
  margin-bottom: 0.5rem;
}
.required {
  color: #ef4444;
  margin-left: 0.25rem;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #0f172a;
  transition: all 200ms;
  font-family: inherit;
  box-sizing: border-box;
}
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}
.code-font {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
}

/* 图标 Tabs */
.icon-tabs {
  display: flex;
  gap: 0.25rem;
  background: #f1f5f9;
  padding: 0.25rem;
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  padding: 0.375rem;
  border: none;
  background: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 200ms;
}

.tab-btn.active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 图标选择区域自适应 */
.icon-selector-area {
  flex: 1;
  overflow-y: auto; /* 内部滚动 */
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #fcfcfc;
  display: flex;
  flex-direction: column;
}

.preset-icons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(3rem, 1fr));
  gap: 0.5rem;
  padding: 0.75rem;
  align-content: start;
}

.preset-icon-item {
  aspect-ratio: 1;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  transition: all 200ms;
}

.preset-icon-item:hover {
  background: #f8fafc;
  color: #4f46e5;
  border-color: #cbd5e1;
}

.preset-icon-item.active {
  background: #eff6ff;
  color: #2563eb;
  border-color: #2563eb;
}

.preset-icon-item :deep(svg) {
  width: 1.5rem;
  height: 1.5rem;
}

.custom-icon-input {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
}

.fill-height {
  flex: 1;
  resize: none; /* 禁止手动调整大小 */
  min-height: 100px;
}

.form-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #94a3b8;
  flex-shrink: 0;
}

.naming-hint {
  color: #64748b;
  line-height: 1.4;
}

.form-error {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #ef4444;
  flex-shrink: 0;
}

.input-error {
  border-color: #ef4444 !important;
}

.input-error:focus {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

.naming-hint {
  color: #64748b;
  line-height: 1.4;
}

.form-error {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #ef4444;
  flex-shrink: 0;
}

.input-error {
  border-color: #ef4444 !important;
}

.input-error:focus {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1) !important;
}

/* 按钮组 */
.form-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #f1f5f9;
  background: white;
  flex-shrink: 0;
}
.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms;
  border: none;
}
.btn-secondary {
  background: #f1f5f9;
  color: #475569;
}
.btn-secondary:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.btn-primary {
  background: #0f172a;
  color: white;
}
.btn-primary:hover {
  background: #1e293b;
}
.btn svg {
  width: 1rem;
  height: 1rem;
}

/* 动画 */
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 300ms ease;
}
.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
.dialog-scale-enter-active,
.dialog-scale-leave-active {
  transition: all 300ms ease;
}
.dialog-scale-enter-from,
.dialog-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-1rem);
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .form-col-left {
    overflow: visible;
  }
  .form-col-right {
    height: auto;
    overflow: visible;
  }
  .flex-fill-group {
    flex: none;
  }
  .icon-selector-area {
    height: 200px;
  }
  .dialog-container {
    height: 90vh;
  }
}
</style>
