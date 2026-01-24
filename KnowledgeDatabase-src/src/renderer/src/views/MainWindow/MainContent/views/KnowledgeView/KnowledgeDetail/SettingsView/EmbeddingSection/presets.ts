export interface EmbeddingPreset {
    id: string
    name: string
    description: string
    defaultDimensions?: number
    providerKeywords: string[] // Keywords to help filter compatible models
    recommended?: boolean
}

export const EMBEDDING_PRESETS: EmbeddingPreset[] = [
    {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
        description: 'High performance, cost-effective model, suitable for most tasks.',
        defaultDimensions: 1536,
        providerKeywords: ['openai', 'azure'],
        recommended: true
    },
    {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        description: 'Higher precision embedding, best for semantic search.',
        defaultDimensions: 3072,
        providerKeywords: ['openai', 'azure']
    },
    {
        id: 'text-embedding-ada-002',
        name: 'Text Embedding Ada 002',
        description: 'Legacy OpenAI model, widely supported.',
        defaultDimensions: 1536,
        providerKeywords: ['openai', 'azure']
    },
    {
        id: 'bge-m3',
        name: 'BAAI BGE M3',
        description: 'Multi-lingual, multi-functionality, multi-granularity.',
        defaultDimensions: 1024,
        providerKeywords: ['bge', 'baai', 'local', 'ollama']
    },
    {
        id: 'bge-large-zh-v1.5',
        name: 'BGE Large ZH v1.5',
        description: 'Optimized for Chinese language tasks.',
        defaultDimensions: 1024,
        providerKeywords: ['bge', 'baai', 'local']
    },
    {
        id: 'bge-large-en-v1.5',
        name: 'BGE Large EN v1.5',
        description: 'Optimized for English language tasks.',
        defaultDimensions: 1024,
        providerKeywords: ['bge', 'baai', 'local']
    },
    {
        id: 'embed-english-v3.0',
        name: 'Cohere English v3.0',
        description: 'State-of-the-art embedding model from Cohere.',
        defaultDimensions: 1024,
        providerKeywords: ['cohere']
    },
    {
        id: 'embed-multilingual-v3.0',
        name: 'Cohere Multilingual v3.0',
        description: 'Multilingual support from Cohere.',
        defaultDimensions: 1024,
        providerKeywords: ['cohere']
    },
    {
        id: 'nomic-embed-text-v1.5',
        name: 'Nomic Embed Text v1.5',
        description: 'High quality open weights model, handle long context.',
        defaultDimensions: 768,
        providerKeywords: ['nomic', 'ollama', 'local']
    },
    {
        id: 'gte-large-en',
        name: 'GTE Large',
        description: 'General Text Embeddings.',
        defaultDimensions: 1024,
        providerKeywords: ['gte', 'alibaba']
    }
]
