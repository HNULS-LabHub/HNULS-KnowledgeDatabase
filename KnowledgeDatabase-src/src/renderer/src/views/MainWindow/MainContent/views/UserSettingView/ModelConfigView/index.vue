<template>
  <div class="kb-model-config-a3f9 flex h-full w-full bg-[#f9f9f9] text-gray-800 font-sans overflow-hidden">
    <!-- 左侧边栏 -->
    <div class="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col z-20 shadow-[2px_0_15px_rgba(0,0,0,0.03)]">
      <div class="h-16 flex items-center px-5 border-b border-gray-100">
        <div class="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white mr-3 shadow-md shadow-gray-200">
          <!-- Cpu Icon -->
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
            <rect x="9" y="9" width="6" height="6"></rect>
            <line x1="9" y1="1" x2="9" y2="4"></line>
            <line x1="15" y1="1" x2="15" y2="4"></line>
            <line x1="9" y1="20" x2="9" y2="23"></line>
            <line x1="15" y1="20" x2="15" y2="23"></line>
            <line x1="20" y1="9" x2="23" y2="9"></line>
            <line x1="20" y1="14" x2="23" y2="14"></line>
            <line x1="1" y1="9" x2="4" y2="9"></line>
            <line x1="1" y1="14" x2="4" y2="14"></line>
          </svg>
        </div>
        <span class="font-bold text-lg tracking-tight text-gray-900">模型管理</span>
      </div>

      <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2 mb-1">
          模型服务商
        </div>
        <div
          v-for="provider in store.providers"
          :key="provider.id"
          class="group relative flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 border"
          :class="
            store.selectedProviderId === provider.id
              ? 'bg-blue-50/80 border-blue-200 text-blue-700 shadow-sm'
              : 'bg-white border-transparent hover:bg-gray-100 hover:border-gray-200 text-gray-700'
          "
          @click="store.selectProvider(provider.id)"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <div
              class="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border transition-colors"
              :class="
                store.selectedProviderId === provider.id
                  ? 'bg-white border-blue-100 text-blue-600'
                  : 'bg-gray-50 border-gray-100 text-gray-500'
              "
            >
              <!-- Zap Icon for openai -->
              <svg
                v-if="provider.icon === 'openai'"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
              </svg>
              <!-- Server Icon for server -->
              <svg
                v-else-if="provider.icon === 'server'"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
              <!-- Box Icon for default -->
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div class="flex flex-col min-w-0">
              <span
                class="font-semibold text-sm truncate"
                :class="store.selectedProviderId === provider.id ? 'text-blue-900' : 'text-gray-700'"
              >
                {{ provider.name }}
              </span>
              <span class="text-[10px] text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                <span
                  class="w-1.5 h-1.5 rounded-full"
                  :class="provider.enabled ? 'bg-green-500' : 'bg-gray-300'"
                ></span>
                {{ provider.type === 'openai' ? 'OpenAI Protocol' : 'Custom' }}
              </span>
            </div>
          </div>
          <div class="flex items-center">
            <svg
              v-if="store.selectedProviderId === provider.id"
              class="w-[14px] h-[14px] text-blue-400 opacity-80"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <button
              v-else
              class="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              @click.stop="handleDeleteProvider(provider.id)"
            >
              <!-- Trash2 Icon -->
              <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-gray-100 bg-gray-50/30 backdrop-blur-sm">
        <button
          class="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-md text-gray-600 font-medium py-3 rounded-xl transition-all duration-200 shadow-sm"
          @click="store.isAddProviderModalOpen = true"
        >
          <!-- Plus Icon -->
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span class="text-sm">添加提供商</span>
        </button>
      </div>
    </div>

    <!-- 右侧主区域 -->
    <div class="flex-1 flex flex-col h-full overflow-hidden bg-[#fafafa]">
      <!-- Header -->
      <div class="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-10">
        <div class="flex items-center gap-4">
          <div class="flex flex-col">
            <h1 class="text-xl font-bold text-gray-800 flex items-center gap-2">
              {{ store.selectedProvider?.name }}
              <span
                class="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-mono rounded border border-gray-200 tracking-wide uppercase"
              >
                {{ store.selectedProvider?.type }}
              </span>
            </h1>
          </div>
        </div>
        <div class="flex gap-3">
          <button
            class="px-5 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg shadow-lg shadow-gray-200 transition-all flex items-center gap-2"
            @click="handleSaveConfig"
          >
            <!-- Check Icon -->
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            保存配置
          </button>
        </div>
      </div>

      <!-- 内容滚动区 -->
      <div class="flex-1 overflow-y-auto p-8">
        <div class="max-w-4xl mx-auto space-y-8 pb-20">
          <!-- Settings Card -->
          <section class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <div class="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                <!-- Settings Icon -->
                <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path
                    d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"
                  ></path>
                </svg>
              </div>
              <h2 class="text-lg font-bold text-gray-900">服务配置</h2>
            </div>
            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 grid grid-cols-1 gap-6">
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">API Key</label>
                <input
                  v-model="apiKeyDraft"
                  type="password"
                  class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                  placeholder="sk-..."
                  @blur="handleApiKeyBlur"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">API Host URL</label>
                <input
                  v-model="baseUrlDraft"
                  type="text"
                  class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                  placeholder="https://api.openai.com/v1"
                  @blur="handleBaseUrlBlur"
                />
              </div>
            </div>
          </section>

          <!-- Models Card -->
          <section class="space-y-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                  <!-- Box Icon -->
                  <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                </div>
                <h2 class="text-lg font-bold text-gray-900">模型列表</h2>
                <span
                  class="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full font-medium"
                >
                  {{ store.selectedProvider?.models.length || 0 }}
                </span>
              </div>
              <div class="flex gap-2">
                <button
                  class="text-xs font-medium bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                  @click="handleOpenManageModels"
                >
                  <!-- ListFilter Icon -->
                  <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M7 12h10M11 18h2"></path>
                  </svg>
                  管理模型
                </button>
                <button
                  class="text-xs font-medium bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-all flex items-center gap-1.5 shadow-sm"
                  @click="store.isAddModelModalOpen = true"
                >
                  <!-- Plus Icon -->
                  <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  手动添加
                </button>
              </div>
            </div>

            <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[120px]">
              <table v-if="store.selectedProvider?.models.length" class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-gray-100 text-xs font-semibold text-gray-500 bg-gray-50/50">
                    <th class="px-6 py-4 w-16 text-center">#</th>
                    <th class="px-6 py-4">模型 ID</th>
                    <th class="px-6 py-4">名称</th>
                    <th class="px-6 py-4 text-right">状态</th>
                    <th class="px-6 py-4 w-16"></th>
                  </tr>
                </thead>
                <tbody class="text-sm">
                  <tr
                    v-for="(model, idx) in store.selectedProvider?.models"
                    :key="model.id"
                    class="group hover:bg-blue-50/20 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <td class="px-6 py-4 text-center text-gray-400 text-xs">{{ idx + 1 }}</td>
                    <td class="px-6 py-4">
                      <span class="font-mono text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded border border-gray-200">
                        {{ model.id }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-gray-800 font-medium">{{ model.name }}</td>
                    <td class="px-6 py-4 text-right">
                      <button
                        class="inline-flex items-center transition-colors"
                        :class="model.enabled ? 'text-blue-600' : 'text-gray-300'"
                        @click="store.toggleModelStatus(model.id)"
                      >
                        <!-- ToggleRight/ToggleLeft Icon -->
                        <svg
                          v-if="model.enabled"
                          class="w-8 h-8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect>
                          <circle cx="16" cy="12" r="3"></circle>
                        </svg>
                        <svg v-else class="w-8 h-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="1" y="5" width="22" height="14" rx="7" ry="7"></rect>
                          <circle cx="8" cy="12" r="3"></circle>
                        </svg>
                      </button>
                    </td>
                    <td class="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <button class="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700">
                        <!-- Edit2 Icon -->
                        <svg class="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-else class="flex flex-col items-center justify-center py-12 text-gray-400">
                <p class="text-sm">暂无模型</p>
                <p class="text-xs mt-1 opacity-60">点击"管理模型"从 API 获取列表，或手动添加</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- 弹窗 1：管理模型 -->
    <div
      v-if="store.isManageModelsModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      @click="store.isManageModelsModalOpen = false"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200"
        @click.stop
      >
        <!-- Header -->
        <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-white">
          <div class="flex flex-col">
            <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
              <!-- ListFilter Icon -->
              <svg class="w-[18px] h-[18px] text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M7 12h10M11 18h2"></path>
              </svg>
              管理模型列表
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">从 API 获取模型并勾选需要显示的项目</p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
            @click="store.isManageModelsModalOpen = false"
          >
            <!-- X Icon -->
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          <div v-if="store.isLoadingModels" class="flex flex-col items-center justify-center h-64 space-y-4">
            <!-- RefreshCw Icon (spinning) -->
            <svg class="w-8 h-8 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <p class="text-sm text-gray-500 font-medium">正在连接 API 获取模型列表...</p>
          </div>
          <div v-else class="space-y-6">
            <div
              v-for="[groupName, models] in Object.entries(store.remoteModelGroups)"
              :key="groupName"
              class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ groupName }}</span>
                <span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md">{{ models.length }}</span>
              </div>
              <div class="divide-y divide-gray-50">
                <div
                  v-for="model in models"
                  :key="model.id"
                  class="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors"
                  :class="store.selectedRemoteModels.has(model.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50'"
                  @click="store.toggleRemoteModelSelection(model.id)"
                >
                  <div class="flex items-center gap-3">
                    <div :class="store.selectedRemoteModels.has(model.id) ? 'text-blue-600' : 'text-gray-300'">
                      <!-- CheckSquare/Square Icon -->
                      <svg
                        v-if="store.selectedRemoteModels.has(model.id)"
                        class="w-[18px] h-[18px]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="9 11 12 14 22 4"></polyline>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                      </svg>
                      <svg v-else class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      </svg>
                    </div>
                    <div class="flex flex-col">
                      <span
                        class="text-sm font-medium"
                        :class="store.selectedRemoteModels.has(model.id) ? 'text-gray-900' : 'text-gray-600'"
                      >
                        {{ model.id }}
                      </span>
                      <span class="text-[10px] text-gray-400">
                        Created: {{ new Date(model.created * 1000).toLocaleDateString() }}
                      </span>
                    </div>
                  </div>
                  <span
                    v-if="store.selectedRemoteModels.has(model.id)"
                    class="text-xs font-bold text-blue-600 px-2 py-1 bg-blue-100 rounded"
                  >
                    已选
                  </span>
                </div>
              </div>
            </div>

            <div v-if="Object.keys(store.remoteModelGroups).length === 0" class="text-center py-10 text-gray-400">
              未能获取到模型数据
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-white border-t border-gray-100 flex justify-between items-center z-10">
          <div class="text-xs text-gray-500">
            已选择 <span class="font-bold text-gray-900">{{ store.selectedRemoteModels.size }}</span> 个模型
          </div>
          <div class="flex gap-3">
            <button
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              @click="store.isManageModelsModalOpen = false"
            >
              取消
            </button>
            <button
              class="px-5 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              :disabled="store.isLoadingModels"
              @click="store.handleBatchAddModels()"
            >
              更新列表
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 2：手动添加模型 -->
    <div
      v-if="store.isAddModelModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[1px]"
      @click="store.isAddModelModalOpen = false"
    >
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 p-6" @click.stop>
        <h3 class="text-lg font-bold text-gray-900 mb-4">手动添加模型</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">模型 ID</label>
            <input
              v-model="store.newModelForm.id"
              type="text"
              class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g. gpt-4-32k"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">显示名称</label>
            <input
              v-model="store.newModelForm.name"
              type="text"
              class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g. GPT-4 32K"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            @click="store.isAddModelModalOpen = false"
          >
            取消
          </button>
          <button class="px-4 py-2 text-sm text-white bg-black hover:bg-gray-800 rounded-lg" @click="store.handleManualAddModel()">
            添加
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗 3：添加提供商 -->
    <div
      v-if="store.isAddProviderModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]"
      @click="store.isAddProviderModalOpen = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100" @click.stop>
        <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-800">添加模型服务</h2>
          <button
            class="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
            @click="store.isAddProviderModalOpen = false"
          >
            <!-- X Icon -->
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">类型</label>
            <div class="space-y-2">
              <label
                v-for="type in PROVIDER_TYPES"
                :key="type.id"
                class="flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition-all"
                :class="
                  !type.available
                    ? 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
                    : store.newProviderForm.type === type.id
                      ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                "
              >
                <div class="flex items-center gap-3">
                  <input
                    type="radio"
                    name="providerType"
                    :value="type.id"
                    :checked="store.newProviderForm.type === type.id"
                    :disabled="!type.available"
                    class="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    @change="store.newProviderForm.type = type.id"
                  />
                  <span :class="!type.available ? 'text-gray-400' : 'text-gray-700'" class="text-sm font-medium">
                    {{ type.name }}
                  </span>
                </div>
              </label>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-500 mb-1.5 uppercase">名称</label>
            <input
              v-model="store.newProviderForm.name"
              type="text"
              placeholder="例如：My Workspace"
              class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
            />
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            @click="store.isAddProviderModalOpen = false"
          >
            取消
          </button>
          <button class="px-6 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg shadow-sm transition-all" @click="store.handleAddProvider()">
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useUserModelConfigStore } from '@renderer/stores/user-config/user-model-config.store'
import { PROVIDER_TYPES } from '@renderer/stores/user-config/user-model-config.mock'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const store = useUserModelConfigStore()

// API Key 和 Base URL 的草稿状态
const apiKeyDraft = ref('')
const baseUrlDraft = ref('')

// 初始化
onMounted(async () => {
  await store.fetchProviders()
  if (store.selectedProvider) {
    apiKeyDraft.value = store.selectedProvider.apiKey
    baseUrlDraft.value = store.selectedProvider.baseUrl
  }
})

// 监听选中的提供商变化，更新草稿
const selectedProvider = computed(() => store.selectedProvider)
watch(selectedProvider, (provider) => {
  if (provider) {
    apiKeyDraft.value = provider.apiKey
    baseUrlDraft.value = provider.baseUrl
  }
})


// 处理删除提供商
function handleDeleteProvider(id: string): void {
  store.handleDeleteProvider(id)
}

// 处理打开管理模型
async function handleOpenManageModels(): Promise<void> {
  await store.openManageModels()
}

// 处理保存配置
async function handleSaveConfig(): Promise<void> {
  await store.saveProvidersConfig()
}

// 处理 API Key blur
function handleApiKeyBlur(): void {
  if (!store.selectedProvider) return
  if (apiKeyDraft.value !== store.selectedProvider.apiKey) {
    store.providers = store.providers.map((p) => {
      if (p.id === store.selectedProviderId) {
        return { ...p, apiKey: apiKeyDraft.value }
      }
      return p
    })
  }
}

// 处理 Base URL blur
function handleBaseUrlBlur(): void {
  if (!store.selectedProvider) return
  if (baseUrlDraft.value !== store.selectedProvider.baseUrl) {
    store.providers = store.providers.map((p) => {
      if (p.id === store.selectedProviderId) {
        return { ...p, baseUrl: baseUrlDraft.value }
      }
      return p
    })
  }
}
</script>

<style scoped>
/* Component-specific styles (if needed) will go here */
</style>
