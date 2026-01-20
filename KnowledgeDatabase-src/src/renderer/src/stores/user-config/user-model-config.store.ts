import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { UserModelConfigDataSource } from './user-model-config.datasource'
import { MOCK_REMOTE_MODELS } from './user-model-config.mock'
import type {
  ModelProvider,
  RemoteModelGroups,
  NewProviderForm,
  NewModelForm
} from './user-model-config.types'

/**
 * 模型配置 Store
 * 照搬原型代码的所有状态和逻辑
 */
export const useUserModelConfigStore = defineStore('user-model-config', () => {
  // === 状态 ===
  const providers = ref<ModelProvider[]>([])
  const selectedProviderId = ref<string | null>(null)

  // 弹窗状态
  const isAddProviderModalOpen = ref(false)
  const isAddModelModalOpen = ref(false)
  const isManageModelsModalOpen = ref(false)

  // 管理模型弹窗的状态
  const isLoadingModels = ref(false)
  const remoteModelGroups = ref<RemoteModelGroups>({})
  const selectedRemoteModels = ref<Set<string>>(new Set())

  // 表单状态
  const newProviderForm = ref<NewProviderForm>({ type: 'openai', name: '' })
  const newModelForm = ref<NewModelForm>({ id: '', name: '', group: '' })

  // === Computed ===
  const selectedProvider = computed(() => {
    return providers.value.find((p) => p.id === selectedProviderId.value) || providers.value[0]
  })

  // === Actions ===

  /**
   * 1. 打开管理模态框并模拟 Fetch
   */
  async function openManageModels(): Promise<void> {
    isManageModelsModalOpen.value = true
    isLoadingModels.value = true
    remoteModelGroups.value = {}

    try {
      // 模拟网络请求延迟
      await new Promise((resolve) => setTimeout(resolve, 1200))
      remoteModelGroups.value = { ...MOCK_REMOTE_MODELS }

      // 默认选中当前列表中已存在的模型
      const currentModelIds = new Set(selectedProvider.value?.models.map((m) => m.id) || [])
      selectedRemoteModels.value = currentModelIds
    } finally {
      isLoadingModels.value = false
    }
  }

  /**
   * 2. 处理远程模型的勾选/取消
   */
  function toggleRemoteModelSelection(modelId: string): void {
    const newSet = new Set(selectedRemoteModels.value)
    if (newSet.has(modelId)) {
      newSet.delete(modelId)
    } else {
      newSet.add(modelId)
    }
    selectedRemoteModels.value = newSet
  }

  /**
   * 3. 确认批量添加模型
   */
  function handleBatchAddModels(): void {
    if (!selectedProvider.value) return

    // 找出所有被选中的模型详情
    const modelsToAdd: ModelProvider['models'] = []
    Object.values(remoteModelGroups.value)
      .flat()
      .forEach((remoteModel) => {
        if (selectedRemoteModels.value.has(remoteModel.id)) {
          // 检查是否已存在，如果存在保留旧配置(如 enabled 状态)，如果不存在则新建
          const existing = selectedProvider.value?.models.find((m) => m.id === remoteModel.id)
          if (existing) {
            modelsToAdd.push(existing)
          } else {
            modelsToAdd.push({
              id: remoteModel.id,
              name: remoteModel.id, // 默认用 ID 作名称
              enabled: true
            })
          }
        }
      })

    // 更新 Provider
    providers.value = providers.value.map((p) => {
      if (p.id === selectedProviderId.value) {
        return { ...p, models: modelsToAdd }
      }
      return p
    })

    isManageModelsModalOpen.value = false
  }

  /**
   * 4. 手动添加单个模型
   */
  function handleManualAddModel(): void {
    if (!newModelForm.value.id || !selectedProviderId.value) return

    const newModel = {
      ...newModelForm.value,
      enabled: true,
      group: newModelForm.value.group || undefined // 空字符串转为 undefined
    }
    providers.value = providers.value.map((p) => {
      if (p.id === selectedProviderId.value) {
        return { ...p, models: [...p.models, newModel] }
      }
      return p
    })
    isAddModelModalOpen.value = false
    newModelForm.value = { id: '', name: '', group: '' }
  }

  /**
   * 5. 添加提供商
   */
  function handleAddProvider(): void {
    const newProvider: ModelProvider = {
      id: `provider-${Date.now()}`,
      type: newProviderForm.value.type,
      name: newProviderForm.value.name || 'New Provider',
      apiKey: '',
      baseUrl: '',
      icon: 'box',
      enabled: true,
      models: []
    }
    providers.value = [...providers.value, newProvider]
    selectedProviderId.value = newProvider.id
    isAddProviderModalOpen.value = false
    newProviderForm.value = { type: 'openai', name: '' }
  }

  /**
   * 6. 删除提供商
   */
  function handleDeleteProvider(id: string): void {
    const newList = providers.value.filter((p) => p.id !== id)
    providers.value = newList
    if (selectedProviderId.value === id && newList.length > 0) {
      selectedProviderId.value = newList[0].id
    } else if (newList.length === 0) {
      selectedProviderId.value = null
    }
  }

  /**
   * 7. Toggle 开关
   */
  function toggleModelStatus(modelId: string): void {
    providers.value = providers.value.map((p) => {
      if (p.id === selectedProviderId.value) {
        return {
          ...p,
          models: p.models.map((m) => (m.id === modelId ? { ...m, enabled: !m.enabled } : m))
        }
      }
      return p
    })
  }

  /**
   * 初始化：获取提供商列表
   */
  async function fetchProviders(): Promise<void> {
    providers.value = await UserModelConfigDataSource.getProviders()
    if (providers.value.length > 0 && !selectedProviderId.value) {
      selectedProviderId.value = providers.value[0].id
    }
  }

  /**
   * 选择提供商
   */
  function selectProvider(id: string): void {
    selectedProviderId.value = id
  }

  /**
   * 保存配置
   */
  async function saveProvidersConfig(): Promise<void> {
    await UserModelConfigDataSource.saveProviders(providers.value)
  }

  return {
    // 状态
    providers,
    selectedProviderId,
    isAddProviderModalOpen,
    isAddModelModalOpen,
    isManageModelsModalOpen,
    isLoadingModels,
    remoteModelGroups,
    selectedRemoteModels,
    newProviderForm,
    newModelForm,

    // Computed
    selectedProvider,

    // Actions
    openManageModels,
    toggleRemoteModelSelection,
    handleBatchAddModels,
    handleManualAddModel,
    handleAddProvider,
    handleDeleteProvider,
    toggleModelStatus,
    fetchProviders,
    selectProvider,
    saveProvidersConfig
  }
})
