export interface EmbeddingPreset {
  id: string
  name: string
  description: string
  defaultDimensions?: number
  providerKeywords: string[] // Keywords to help filter compatible models
  recommended?: boolean
}

export const EMBEDDING_PRESETS: EmbeddingPreset[] = [
  // Top Performance Models (Rank 1-5)
  {
    id: 'KaLM-Embedding-Gemma3-12B-2511',
    name: 'KaLM Embedding Gemma3 12B',
    description: 'Top-ranked model with 73% avg score, 3840 dimensions, 32K context.',
    defaultDimensions: 3840,
    providerKeywords: ['kalm', 'gemma', 'local', 'ollama', 'huggingface'],
    recommended: true
  },
  {
    id: 'llama-embed-nemotron-8b',
    name: 'Llama Embed Nemotron 8B',
    description: 'NVIDIA model, rank #2, 4096 dimensions, excellent performance.',
    defaultDimensions: 4096,
    providerKeywords: ['nvidia', 'llama', 'nemotron', 'local', 'ollama', 'huggingface'],
    recommended: true
  },
  {
    id: 'Qwen3-Embedding-8B',
    name: 'Qwen3 Embedding 8B',
    description: 'Alibaba Qwen3 8B, rank #3, 4096 dimensions, 32K context.',
    defaultDimensions: 4096,
    providerKeywords: ['qwen', 'alibaba', 'local', 'ollama', 'huggingface']
  },
  {
    id: 'gemini-embedding-001',
    name: 'Gemini Embedding 001',
    description: 'Google Gemini embedding, rank #4, 3072 dimensions.',
    defaultDimensions: 3072,
    providerKeywords: ['google', 'gemini', 'vertex']
  },
  {
    id: 'Qwen3-Embedding-4B',
    name: 'Qwen3 Embedding 4B',
    description: 'Smaller Qwen3 model, rank #5, 2560 dimensions, efficient.',
    defaultDimensions: 2560,
    providerKeywords: ['qwen', 'alibaba', 'local', 'ollama', 'huggingface']
  },

  // High Performance Models (Rank 6-10)
  {
    id: 'Octen-Embedding-8B',
    name: 'Octen Embedding 8B',
    description: 'Rank #6, 4096 dimensions, 32K context support.',
    defaultDimensions: 4096,
    providerKeywords: ['octen', 'local', 'huggingface']
  },
  {
    id: 'Seed1.6-embedding-1215',
    name: 'Seed 1.6 Embedding',
    description: 'Doubao embedding vision, rank #7, 2048 dimensions.',
    defaultDimensions: 2048,
    providerKeywords: ['seed', 'doubao', 'volcengine']
  },
  {
    id: 'Qwen3-Embedding-0.6B',
    name: 'Qwen3 Embedding 0.6B',
    description: 'Lightweight Qwen3, rank #8, 1024 dimensions, very efficient.',
    defaultDimensions: 1024,
    providerKeywords: ['qwen', 'alibaba', 'local', 'ollama', 'huggingface']
  },
  {
    id: 'gte-Qwen2-7B-instruct',
    name: 'GTE Qwen2 7B Instruct',
    description: 'Alibaba GTE-Qwen2, rank #9, 3584 dimensions, instruction-tuned.',
    defaultDimensions: 3584,
    providerKeywords: ['gte', 'qwen', 'alibaba', 'local', 'huggingface']
  },
  {
    id: 'Linq-Embed-Mistral',
    name: 'Linq Embed Mistral',
    description: 'Rank #10, 4096 dimensions, based on Mistral architecture.',
    defaultDimensions: 4096,
    providerKeywords: ['linq', 'mistral', 'local', 'huggingface']
  },

  // Popular Open Source Models (Rank 11-20)
  {
    id: 'multilingual-e5-large-instruct',
    name: 'Multilingual E5 Large Instruct',
    description: 'Rank #11, 1024 dimensions, multilingual support.',
    defaultDimensions: 1024,
    providerKeywords: ['e5', 'multilingual', 'local', 'huggingface']
  },
  {
    id: 'embeddinggemma-300m',
    name: 'Embedding Gemma 300M',
    description: 'Google lightweight model, rank #12, 768 dimensions.',
    defaultDimensions: 768,
    providerKeywords: ['gemma', 'google', 'local', 'huggingface']
  },
  {
    id: 'SFR-Embedding-Mistral',
    name: 'SFR Embedding Mistral',
    description: 'Salesforce model, rank #13, 4096 dimensions.',
    defaultDimensions: 4096,
    providerKeywords: ['salesforce', 'sfr', 'mistral', 'local', 'huggingface']
  },
  {
    id: 'text-multilingual-embedding-002',
    name: 'Text Multilingual Embedding 002',
    description: 'Google Vertex AI, rank #14, 768 dimensions.',
    defaultDimensions: 768,
    providerKeywords: ['google', 'vertex', 'multilingual']
  },
  {
    id: 'GritLM-7B',
    name: 'GritLM 7B',
    description: 'Rank #15, 4096 dimensions, 32K context.',
    defaultDimensions: 4096,
    providerKeywords: ['grit', 'local', 'huggingface']
  },
  {
    id: 'GritLM-8x7B',
    name: 'GritLM 8x7B',
    description: 'Larger GritLM, rank #16, 32768 dimensions.',
    defaultDimensions: 32768,
    providerKeywords: ['grit', 'local', 'huggingface']
  },
  {
    id: 'e5-mistral-7b-instruct',
    name: 'E5 Mistral 7B Instruct',
    description: 'Rank #17, 4096 dimensions, instruction-tuned.',
    defaultDimensions: 4096,
    providerKeywords: ['e5', 'mistral', 'local', 'huggingface']
  },
  {
    id: 'embed-multilingual-v3.0',
    name: 'Cohere Multilingual v3.0',
    description: 'Cohere API, rank #18, 512 dimensions, multilingual.',
    defaultDimensions: 512,
    providerKeywords: ['cohere']
  },
  {
    id: 'gte-Qwen2-1.5B-instruct',
    name: 'GTE Qwen2 1.5B Instruct',
    description: 'Compact GTE-Qwen2, rank #19, 8960 dimensions.',
    defaultDimensions: 8960,
    providerKeywords: ['gte', 'qwen', 'alibaba', 'local', 'huggingface']
  },
  {
    id: 'bilingual-embedding-large',
    name: 'Bilingual Embedding Large',
    description: 'Rank #20, 1024 dimensions, bilingual support.',
    defaultDimensions: 1024,
    providerKeywords: ['bilingual', 'local', 'huggingface']
  },

  // Additional Quality Models (Rank 21-30)
  {
    id: 'SFR-Embedding-2_R',
    name: 'SFR Embedding 2 R',
    description: 'Salesforce v2, rank #21, 4096 dimensions.',
    defaultDimensions: 4096,
    providerKeywords: ['salesforce', 'sfr', 'local', 'huggingface']
  },
  {
    id: 'gte-Qwen1.5-7B-instruct',
    name: 'GTE Qwen1.5 7B Instruct',
    description: 'Rank #22, 4096 dimensions, instruction-tuned.',
    defaultDimensions: 4096,
    providerKeywords: ['gte', 'qwen', 'alibaba', 'local', 'huggingface']
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    description: 'OpenAI flagship, rank #23, 3072 dimensions.',
    defaultDimensions: 3072,
    providerKeywords: ['openai', 'azure'],
    recommended: true
  },
  {
    id: 'stella_en_1.5B_v5',
    name: 'Stella EN 1.5B v5',
    description: 'Rank #24, 8960 dimensions, English optimized.',
    defaultDimensions: 8960,
    providerKeywords: ['stella', 'local', 'huggingface']
  },
  {
    id: 'jasper_en_vision_language_v1',
    name: 'Jasper EN Vision Language v1',
    description: 'Rank #25, 8960 dimensions, vision+language support.',
    defaultDimensions: 8960,
    providerKeywords: ['jasper', 'vision', 'local', 'huggingface']
  },
  {
    id: 'NV-Embed-v2',
    name: 'NV Embed v2',
    description: 'NVIDIA v2, rank #26, 4096 dimensions.',
    defaultDimensions: 4096,
    providerKeywords: ['nvidia', 'local', 'huggingface']
  },
  {
    id: 'Solon-embeddings-large-0.1',
    name: 'Solon Embeddings Large',
    description: 'Rank #27, 1024 dimensions, French optimized.',
    defaultDimensions: 1024,
    providerKeywords: ['solon', 'local', 'huggingface']
  },
  {
    id: 'voyage-3.5',
    name: 'Voyage 3.5',
    description: 'Voyage AI latest, rank #28, 1024 dimensions.',
    defaultDimensions: 1024,
    providerKeywords: ['voyage']
  },
  {
    id: 'jina-embeddings-v3',
    name: 'Jina Embeddings v3',
    description: 'Rank #29, 1024 dimensions, 8K context.',
    defaultDimensions: 1024,
    providerKeywords: ['jina', 'local', 'huggingface']
  },
  {
    id: 'bge-m3',
    name: 'BAAI BGE M3',
    description: 'Rank #30, 1024 dimensions, multi-lingual/functionality/granularity.',
    defaultDimensions: 1024,
    providerKeywords: ['bge', 'baai', 'local', 'ollama', 'huggingface']
  },

  // Efficient & Specialized Models (Rank 31-44)
  {
    id: 'KaLM-embedding-multilingual-mini-v1',
    name: 'KaLM Multilingual Mini v1',
    description: 'Rank #31, 896 dimensions, compact multilingual.',
    defaultDimensions: 896,
    providerKeywords: ['kalm', 'multilingual', 'local', 'huggingface']
  },
  {
    id: 'multilingual-e5-large',
    name: 'Multilingual E5 Large',
    description: 'Rank #32, 1024 dimensions, multilingual.',
    defaultDimensions: 1024,
    providerKeywords: ['e5', 'multilingual', 'local', 'huggingface']
  },
  {
    id: 'gte-multilingual-base',
    name: 'GTE Multilingual Base',
    description: 'Rank #33, 768 dimensions, multilingual base model.',
    defaultDimensions: 768,
    providerKeywords: ['gte', 'alibaba', 'multilingual', 'local', 'huggingface']
  },
  {
    id: 'bilingual-embedding-base',
    name: 'Bilingual Embedding Base',
    description: 'Rank #34, 768 dimensions, bilingual base.',
    defaultDimensions: 768,
    providerKeywords: ['bilingual', 'local', 'huggingface']
  },
  {
    id: 'NV-Embed-v1',
    name: 'NV Embed v1',
    description: 'NVIDIA v1, rank #36, 4096 dimensions.',
    defaultDimensions: 4096,
    providerKeywords: ['nvidia', 'local', 'huggingface']
  },
  {
    id: 'embed-english-v3.0',
    name: 'Cohere English v3.0',
    description: 'Cohere English-only, 1024 dimensions.',
    defaultDimensions: 1024,
    providerKeywords: ['cohere']
  },
  {
    id: 'Cohere-embed-multilingual-light-v3.0',
    name: 'Cohere Multilingual Light v3.0',
    description: 'Rank #37, 384 dimensions, lightweight.',
    defaultDimensions: 384,
    providerKeywords: ['cohere']
  },
  {
    id: 'snowflake-arctic-embed-l-v2.0',
    name: 'Snowflake Arctic Embed L v2',
    description: 'Rank #40, 1024 dimensions, 8K context.',
    defaultDimensions: 1024,
    providerKeywords: ['snowflake', 'arctic', 'local', 'huggingface']
  },
  {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    description: 'OpenAI efficient model, rank #41, 1536 dimensions.',
    defaultDimensions: 1536,
    providerKeywords: ['openai', 'azure'],
    recommended: true
  },
  {
    id: 'multilingual-e5-base',
    name: 'Multilingual E5 Base',
    description: 'Rank #42, 768 dimensions, multilingual base.',
    defaultDimensions: 768,
    providerKeywords: ['e5', 'multilingual', 'local', 'huggingface']
  },
  {
    id: 'voyage-3-lite',
    name: 'Voyage 3 Lite',
    description: 'Rank #43, 512 dimensions, lightweight.',
    defaultDimensions: 512,
    providerKeywords: ['voyage']
  },
  {
    id: 'multilingual-e5-small',
    name: 'Multilingual E5 Small',
    description: 'Rank #44, 384 dimensions, compact multilingual.',
    defaultDimensions: 384,
    providerKeywords: ['e5', 'multilingual', 'local', 'huggingface']
  },

  // Legacy Models
  {
    id: 'text-embedding-ada-002',
    name: 'Text Embedding Ada 002',
    description: 'Legacy OpenAI model, widely supported.',
    defaultDimensions: 1536,
    providerKeywords: ['openai', 'azure']
  },
  {
    id: 'bge-large-zh-v1.5',
    name: 'BGE Large ZH v1.5',
    description: 'Optimized for Chinese language tasks.',
    defaultDimensions: 1024,
    providerKeywords: ['bge', 'baai', 'local', 'huggingface']
  },
  {
    id: 'bge-large-en-v1.5',
    name: 'BGE Large EN v1.5',
    description: 'Optimized for English language tasks.',
    defaultDimensions: 1024,
    providerKeywords: ['bge', 'baai', 'local', 'huggingface']
  },
  {
    id: 'nomic-embed-text-v1.5',
    name: 'Nomic Embed Text v1.5',
    description: 'High quality open weights model, handle long context.',
    defaultDimensions: 768,
    providerKeywords: ['nomic', 'ollama', 'local', 'huggingface']
  },
  {
    id: 'gte-large-en',
    name: 'GTE Large',
    description: 'General Text Embeddings.',
    defaultDimensions: 1024,
    providerKeywords: ['gte', 'alibaba', 'local', 'huggingface']
  }
]
