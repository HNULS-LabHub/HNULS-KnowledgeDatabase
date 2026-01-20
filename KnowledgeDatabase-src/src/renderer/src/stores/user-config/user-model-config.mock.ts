/**
 * 模型配置 Mock 数据
 * 照搬原型代码的模拟数据
 */
import type {
  ModelProvider,
  RemoteModelGroups,
  ProviderTypeOption,
  Model
} from './user-model-config.types'

// 本地已保存的初始提供商数据
export const MOCK_INITIAL_PROVIDERS: ModelProvider[] = [
  {
    id: 'openai-1',
    type: 'openai',
    name: 'OpenAI',
    apiKey: 'sk-xxxxxxxxxxxxxxxx',
    baseUrl: 'https://api.openai.com/v1',
    icon: 'openai',
    enabled: true,
    models: [{ id: 'gpt-4o', name: 'GPT-4o', enabled: true }] as Model[]
  },
  {
    id: 'custom-1',
    type: 'openai',
    name: 'DeepSeek (OpenAI)',
    apiKey: 'sk-deepseek-xxxx',
    baseUrl: 'https://api.deepseek.com',
    icon: 'server',
    enabled: true,
    models: [{ id: 'deepseek-chat', name: 'DeepSeek V3', enabled: true }]
  }
]

// 模拟从 API (如 GET /v1/models) 获取的远程模型列表
export const MOCK_REMOTE_MODELS: RemoteModelGroups = {
  'GPT-4 Series': [
    { id: 'gpt-4o', object: 'model', created: 1715367049, owned_by: 'system' },
    { id: 'gpt-4-turbo', object: 'model', created: 1712361441, owned_by: 'system' },
    { id: 'gpt-4-0125-preview', object: 'model', created: 1706037612, owned_by: 'system' },
    { id: 'gpt-4-vision-preview', object: 'model', created: 1698894907, owned_by: 'system' }
  ],
  'GPT-3.5 Series': [
    { id: 'gpt-3.5-turbo', object: 'model', created: 1677610602, owned_by: 'openai' },
    { id: 'gpt-3.5-turbo-0125', object: 'model', created: 1706048358, owned_by: 'system' },
    { id: 'gpt-3.5-turbo-16k', object: 'model', created: 1683758102, owned_by: 'openai-internal' }
  ],
  Embeddings: [
    { id: 'text-embedding-3-large', object: 'model', created: 1705953180, owned_by: 'system' },
    { id: 'text-embedding-3-small', object: 'model', created: 1705953180, owned_by: 'system' },
    {
      id: 'text-embedding-ada-002',
      object: 'model',
      created: 1671217299,
      owned_by: 'openai-internal'
    }
  ]
}

export const PROVIDER_TYPES: ProviderTypeOption[] = [
  { id: 'openai', name: 'OpenAI', description: '标准 OpenAI 格式', available: true },
  { id: 'gemini', name: 'Google Gemini', description: 'Google Generative AI', available: false },
  { id: 'oneapi', name: 'OneAPI', description: '统一接口聚合', available: false }
]
