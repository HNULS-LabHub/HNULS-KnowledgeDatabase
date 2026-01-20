<template>
  <div
    class="kb-model-config-a3f9 flex h-full w-full bg-[#f9f9f9] text-gray-800 font-sans overflow-hidden"
  >
    <!-- 左侧边栏 -->
    <div
      class="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col z-20 shadow-[2px_0_15px_rgba(0,0,0,0.03)]"
    >
      <div class="h-16 flex items-center px-5 border-b border-gray-100">
        <div
          class="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white mr-3 shadow-md shadow-gray-200"
        >
          <!-- Cpu Icon -->
          <svg
            class="w-[18px] h-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
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
              <svg
                v-else
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                ></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
            </div>
            <div class="flex flex-col min-w-0">
              <span
                class="font-semibold text-sm truncate"
                :class="
                  store.selectedProviderId === provider.id ? 'text-blue-900' : 'text-gray-700'
                "
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
              <svg
                class="w-[14px] h-[14px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="3 6 5 6 21 6"></polyline>
                <path
                  d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                ></path>
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
          <svg
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
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
      <div
        v-if="store.selectedProvider"
        class="h-16 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-10"
      >
        <div class="flex items-center gap-4">
          <div class="flex flex-col">
            <h1 class="text-xl font-bold text-gray-800 flex items-center gap-2">
              {{ store.selectedProvider.name }}
              <span
                class="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-mono rounded border border-gray-200 tracking-wide uppercase"
              >
                {{ store.selectedProvider.type }}
              </span>
            </h1>
          </div>
        </div>
      </div>

      <!-- 内容滚动区 -->
      <div class="flex-1 overflow-y-auto p-8">
        <!-- 骨架屏：没有提供商时显示 -->
        <div
          v-if="!store.selectedProvider && store.providers.length === 0"
          class="max-w-4xl mx-auto space-y-8 pb-20"
        >
          <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-8">
            <div class="animate-pulse space-y-6">
              <div class="h-4 bg-gray-200 rounded w-1/4"></div>
              <div class="space-y-4">
                <div class="h-3 bg-gray-200 rounded w-1/6"></div>
                <div class="h-10 bg-gray-100 rounded"></div>
              </div>
              <div class="space-y-4">
                <div class="h-3 bg-gray-200 rounded w-1/6"></div>
                <div class="h-10 bg-gray-100 rounded"></div>
              </div>
            </div>
            <div class="mt-8 pt-8 border-t border-gray-100 text-center">
              <p class="text-sm text-gray-500">请先添加模型服务商</p>
            </div>
          </div>
        </div>

        <!-- 正常内容：有提供商时显示 -->
        <div v-else class="max-w-4xl mx-auto space-y-8 pb-20">
          <!-- Settings Card -->
          <section class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <div class="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                <!-- Settings Icon -->
                <svg
                  class="w-[18px] h-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="3"></circle>
                  <path
                    d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"
                  ></path>
                </svg>
              </div>
              <h2 class="text-lg font-bold text-gray-900">服务配置</h2>
            </div>
            <div
              class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-6 grid grid-cols-1 gap-6"
            >
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2"
                  >API Key</label
                >
                <input
                  v-model="apiKeyDraft"
                  type="password"
                  class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                  placeholder="sk-..."
                  @blur="handleApiKeyBlur"
                />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2"
                  >API Host URL</label
                >
                <input
                  v-model="baseUrlDraft"
                  type="text"
                  class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                  placeholder="https://api.openai.com"
                  @blur="handleBaseUrlBlur"
                />
                <!-- 端点信息提示 -->
                <div class="mt-2 space-y-1">
                  <p class="text-[10px] text-gray-400 font-mono">
                    <span class="text-gray-500">端点：</span>
                    <span v-if="baseUrlDraft">{{ computedModelsEndpoint }}</span>
                    <span v-else class="text-gray-300">请输入 API Host URL</span>
                  </p>
                  <p class="text-[10px] text-gray-400 font-mono">
                    <span class="text-gray-500">Chat：</span>
                    <span v-if="baseUrlDraft">{{ computedChatEndpoint }}</span>
                    <span v-else class="text-gray-300">请输入 API Host URL</span>
                  </p>
                  <p class="text-[10px] text-gray-400 font-mono">
                    <span class="text-gray-500">Completion：</span>
                    <span v-if="baseUrlDraft">{{ computedCompletionEndpoint }}</span>
                    <span v-else class="text-gray-300">请输入 API Host URL</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Models Card -->
          <section class="space-y-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <div class="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                  <!-- Box Icon -->
                  <svg
                    class="w-[18px] h-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
                    ></path>
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
                  <svg
                    class="w-[14px] h-[14px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M3 6h18M7 12h10M11 18h2"></path>
                  </svg>
                  管理模型
                </button>
                <button
                  class="text-xs font-medium bg-black text-white px-3 py-2 rounded-lg hover:bg-gray-800 transition-all flex items-center gap-1.5 shadow-sm"
                  @click="store.isAddModelModalOpen = true"
                >
                  <!-- Plus Icon -->
                  <svg
                    class="w-[14px] h-[14px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  手动添加
                </button>
              </div>
            </div>

            <div
              class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[120px]"
            >
              <!-- 按分组显示模型列表 -->
              <div v-if="groupedModels.length > 0" class="divide-y divide-gray-100">
                <div
                  v-for="[groupName, models] in groupedModels"
                  :key="groupName"
                  class="p-4"
                >
                  <!-- 分组标题 -->
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{
                        groupName || '未分组'
                      }}</span>
                      <span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md">{{
                        models.length
                      }}</span>
                    </div>
                  </div>
                  <!-- 模型列表 -->
                  <div class="space-y-2">
                    <div
                      v-for="model in models"
                      :key="model.id"
                      class="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div class="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          class="font-mono text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded border border-gray-200 truncate"
                        >
                          {{ model.id }}
                        </span>
                        <span class="text-sm text-gray-800 font-medium truncate">{{
                          model.name
                        }}</span>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button
                          class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          @click="store.removeModel(model.id)"
                          title="删除模型"
                        >
                          <!-- Minus Icon -->
                          <svg
                            class="w-4 h-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
              <svg
                class="w-[18px] h-[18px] text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 6h18M7 12h10M11 18h2"></path>
              </svg>
              管理模型列表
            </h2>
            <p class="text-xs text-gray-500 mt-0.5">从 API 获取模型，点击 + 按钮添加模型或整组</p>
          </div>
          <button
            class="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors"
            @click="store.isManageModelsModalOpen = false"
          >
            <!-- X Icon -->
            <svg
              class="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          <div
            v-if="store.isLoadingModels"
            class="flex flex-col items-center justify-center h-64 space-y-4"
          >
            <!-- RefreshCw Icon (spinning) -->
            <svg
              class="w-8 h-8 animate-spin text-blue-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
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
              <div
                class="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{
                    groupName
                  }}</span>
                  <span class="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md">{{
                    models.length
                  }}</span>
                </div>
                <!-- 批量添加/取消订阅整组按钮 -->
                <button
                  v-if="isGroupFullyAdded(groupName, models)"
                  class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  @click="handleRemoveGroupModels(groupName, models)"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  取消订阅整组
                </button>
                <button
                  v-else
                  class="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                  @click="handleAddGroupModels(groupName, models)"
                >
                  <svg
                    class="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  添加整组
                </button>
              </div>
              <div class="divide-y divide-gray-50">
                <div
                  v-for="model in models"
                  :key="model.id"
                  class="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-sm font-medium text-gray-900 truncate">
                      {{ model.id }}
                    </span>
                    <span class="text-[10px] text-gray-400">
                      Created: {{ new Date(model.created * 1000).toLocaleDateString() }}
                    </span>
                  </div>
                  <!-- 添加/取消订阅单个模型按钮（双态） -->
                  <button
                    v-if="isModelAdded(model.id)"
                    class="flex-shrink-0 ml-3 p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                    @click="handleRemoveSingleModel(model.id)"
                    title="取消订阅"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                  <button
                    v-else
                    class="flex-shrink-0 ml-3 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                    @click="handleAddSingleModel(model)"
                    title="添加模型"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="Object.keys(store.remoteModelGroups).length === 0"
              class="text-center py-10 text-gray-400"
            >
              未能获取到模型数据
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 bg-white border-t border-gray-100 flex justify-between items-center z-10"
        >
          <button
            class="px-5 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg shadow-lg transition-all"
            @click="store.isManageModelsModalOpen = false"
          >
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- 弹窗 2：手动添加模型 -->
    <div
      v-if="store.isAddModelModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[1px]"
      @click="store.isAddModelModalOpen = false"
    >
      <div
        class="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-gray-100 p-6"
        @click.stop
      >
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
          <div>
            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">分组</label>
            <input
              v-model="store.newModelForm.group"
              type="text"
              class="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              placeholder="e.g. deepseek, gemini 2.5, gpt-4 系列"
            />
            <p class="mt-1 text-xs text-gray-400">用于聚合 API 提供商的模型分组管理，可为空</p>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            @click="store.isAddModelModalOpen = false"
          >
            取消
          </button>
          <button
            class="px-4 py-2 text-sm text-white bg-black hover:bg-gray-800 rounded-lg"
            @click="store.handleManualAddModel()"
          >
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
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100"
        @click.stop
      >
        <div class="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 class="text-lg font-bold text-gray-800">添加模型服务</h2>
          <button
            class="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
            @click="store.isAddProviderModalOpen = false"
          >
            <!-- X Icon -->
            <svg
              class="w-[18px] h-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
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
                  <span
                    :class="!type.available ? 'text-gray-400' : 'text-gray-700'"
                    class="text-sm font-medium"
                  >
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
          <button
            class="px-6 py-2 text-sm font-medium text-white bg-black hover:bg-gray-800 rounded-lg shadow-sm transition-all"
            @click="store.handleAddProvider()"
          >
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

// 计算端点 URL
const computedModelsEndpoint = computed(() => {
  if (!baseUrlDraft.value) return ''
  const base = baseUrlDraft.value.trim().replace(/\/$/, '')
  return `${base}/v1/models`
})

const computedChatEndpoint = computed(() => {
  if (!baseUrlDraft.value) return ''
  const base = baseUrlDraft.value.trim().replace(/\/$/, '')
  return `${base}/v1/chat/completions`
})

const computedCompletionEndpoint = computed(() => {
  if (!baseUrlDraft.value) return ''
  const base = baseUrlDraft.value.trim().replace(/\/$/, '')
  return `${base}/v1/completions`
})

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

// 处理 API Key blur（自动保存）
async function handleApiKeyBlur(): Promise<void> {
  if (!store.selectedProvider || !store.selectedProviderId) return
  if (apiKeyDraft.value !== store.selectedProvider.apiKey) {
    await store.updateProviderApiKey(store.selectedProviderId, apiKeyDraft.value)
  }
}

// 处理 Base URL blur（自动保存）
async function handleBaseUrlBlur(): Promise<void> {
  if (!store.selectedProvider || !store.selectedProviderId) return
  if (baseUrlDraft.value !== store.selectedProvider.baseUrl) {
    await store.updateProviderBaseUrl(store.selectedProviderId, baseUrlDraft.value)
  }
}

// 按分组组织模型列表
const groupedModels = computed(() => {
  if (!store.selectedProvider?.models.length) return []
  const groups: Record<string, typeof store.selectedProvider.models> = {}
  store.selectedProvider.models.forEach((model) => {
    const group = model.group || 'default'
    if (!groups[group]) {
      groups[group] = []
    }
    groups[group].push(model)
  })
  return Object.entries(groups).sort(([a], [b]) => {
    if (a === 'default') return 1
    if (b === 'default') return -1
    return a.localeCompare(b)
  })
})

// 检查模型是否已添加
function isModelAdded(modelId: string): boolean {
  return store.selectedProvider?.models.some((m) => m.id === modelId) || false
}

// 检查组内是否全部已添加
function isGroupFullyAdded(groupName: string, models: any[]): boolean {
  if (!models.length) return false
  return models.every((model) => isModelAdded(model.id))
}

// 添加单个模型
async function handleAddSingleModel(model: any): Promise<void> {
  if (!store.selectedProviderId) return
  await store.addSingleRemoteModel(model)
}

// 删除单个模型
async function handleRemoveSingleModel(modelId: string): Promise<void> {
  if (!store.selectedProviderId) return
  await store.removeSingleRemoteModel(modelId)
}

// 批量添加整组模型
async function handleAddGroupModels(groupName: string, models: any[]): Promise<void> {
  if (!store.selectedProviderId) return
  await store.addGroupModels(groupName, models)
}

// 批量删除整组模型
async function handleRemoveGroupModels(groupName: string, models: any[]): Promise<void> {
  if (!store.selectedProviderId) return
  await store.removeGroupModels(groupName, models)
}
</script>

<style scoped>
/* Component-specific styles (if needed) will go here */
</style>
