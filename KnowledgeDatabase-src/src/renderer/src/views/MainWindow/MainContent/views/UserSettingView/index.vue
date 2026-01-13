<template>
  <div class="UserSettingView flex flex-col h-full overflow-hidden">
    <!-- TopBar will be automatically added by MainContent -->
    
    <div class="UserSettingView_content flex-1 overflow-auto p-8">
      <div class="max-w-4xl mx-auto">
        <h1 class="UserSettingView_title text-2xl font-bold text-slate-900 mb-8">
          用户设置
        </h1>
        
        <!-- Secret Management Section -->
        <div class="UserSettingView_section mb-10">
          <h2 class="UserSettingView_sectionTitle text-lg font-semibold text-slate-800 mb-4">
            秘钥管理
          </h2>
          
          <div class="UserSettingView_sectionContent bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h3 class="UserSettingView_subsectionTitle text-base font-medium text-slate-700 mb-4">
              minerU
            </h3>
            
            <div class="UserSettingView_formGroup">
              <label class="UserSettingView_label block text-sm font-medium text-slate-700 mb-2">
                API 密钥
              </label>
              <div class="relative">
                <input
                  v-model="draftMinerUApiKey"
                  type="password"
                  class="UserSettingView_input w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
                  placeholder="输入您的 minerU API 密钥"
                  @blur="handleMinerUBlur"
                />
                <div
                  class="UserSettingView_status absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                  :class="statusClass"
                >
                  {{ statusText }}
                </div>
              </div>
              <p class="UserSettingView_helpText mt-2 text-sm text-slate-500">
                此密钥将用于 minerU 服务认证，请妥善保管。离开输入框后自动保存。
              </p>
            </div>
          </div>
        </div>
        
        <!-- More sections can be added here in the future -->
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useUserConfigStore } from '@renderer/stores/user-config/user-config.store'

const userConfigStore = useUserConfigStore()

const draftMinerUApiKey = ref('')

onMounted(async () => {
  await userConfigStore.fetch()
  draftMinerUApiKey.value = userConfigStore.config?.minerU.apiKey || ''
})

const statusText = computed(() => {
  if (userConfigStore.saveStatus === 'saving') return '保存中...'
  if (userConfigStore.saveStatus === 'saved') return '已保存'
  if (userConfigStore.saveStatus === 'error') return '保存失败'
  return ''
})

const statusClass = computed(() => {
  if (userConfigStore.saveStatus === 'error') return 'text-rose-500'
  if (userConfigStore.saveStatus === 'saved') return 'text-emerald-600'
  return 'text-slate-400'
})

const handleMinerUBlur = async () => {
  const current = userConfigStore.config?.minerU.apiKey || ''
  if (draftMinerUApiKey.value === current) return

  try {
    await userConfigStore.updateMinerUApiKey(draftMinerUApiKey.value)
  } catch {
    // store already holds error state
  }
}
</script>

<style scoped>
/* Component-specific styles (if needed) will go here */
</style>