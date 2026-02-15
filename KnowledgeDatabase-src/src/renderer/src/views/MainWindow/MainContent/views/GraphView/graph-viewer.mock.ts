/**
 * @file 知识图谱 Mock 数据
 * @description 模拟后端返回的图谱数据，用于前端 demo 开发
 */

import type { GraphEntity, GraphRelation, GraphOption } from './types'

// ============================================================================
// Mock 图谱选项（模拟知识库 + KG 配置列表）
// ============================================================================

export const MOCK_GRAPH_OPTIONS: GraphOption[] = [
  {
    kbId: 1,
    kbName: '机器学习基础',
    configId: 'kg_cfg_001',
    configName: '默认图谱配置',
    graphTableBase: 'kg_emb_cfg_001_1536',
    databaseName: 'kb_ml_basics'
  },
  {
    kbId: 2,
    kbName: '自然语言处理',
    configId: 'kg_cfg_002',
    configName: 'NLP 图谱',
    graphTableBase: 'kg_emb_cfg_002_3072',
    databaseName: 'kb_nlp'
  },
  {
    kbId: 3,
    kbName: '计算机视觉',
    configId: 'kg_cfg_003',
    configName: 'CV 图谱',
    graphTableBase: 'kg_emb_cfg_003_1536',
    databaseName: 'kb_cv'
  }
]

// ============================================================================
// Mock 实体数据
// ============================================================================

const ENTITY_TYPES = [
  'Person', 'Organization', 'Concept', 'Method',
  'Data', 'Artifact', 'Event', 'Location', 'Content'
]

function randomType(): string {
  return ENTITY_TYPES[Math.floor(Math.random() * ENTITY_TYPES.length)]
}

const MOCK_ENTITIES_RAW: Array<{ name: string; type: string; desc: string }> = [
  { name: 'Transformer', type: 'Method', desc: '一种基于自注意力机制的深度学习架构，广泛应用于 NLP 和 CV 领域。' },
  { name: 'BERT', type: 'Method', desc: '双向编码器表示模型，通过掩码语言模型和下一句预测进行预训练。' },
  { name: 'GPT', type: 'Method', desc: '生成式预训练模型，使用自回归方式生成文本。' },
  { name: 'Attention Mechanism', type: 'Concept', desc: '允许模型在处理序列时关注不同位置的信息。' },
  { name: 'Self-Attention', type: 'Concept', desc: '注意力机制的一种，计算序列内部元素之间的关系。' },
  { name: 'Multi-Head Attention', type: 'Concept', desc: '将注意力分成多个头，捕获不同子空间的信息。' },
  { name: 'Positional Encoding', type: 'Concept', desc: '为序列中的每个位置添加位置信息。' },
  { name: 'Feed-Forward Network', type: 'Concept', desc: 'Transformer 中的前馈神经网络层。' },
  { name: 'Layer Normalization', type: 'Concept', desc: '对层的输出进行归一化处理。' },
  { name: 'Residual Connection', type: 'Concept', desc: '跳跃连接，缓解深层网络的梯度消失问题。' },
  { name: 'Google', type: 'Organization', desc: '提出 Transformer 架构的公司。' },
  { name: 'OpenAI', type: 'Organization', desc: 'GPT 系列模型的开发者。' },
  { name: 'Vaswani et al.', type: 'Person', desc: '"Attention Is All You Need" 论文的作者团队。' },
  { name: 'ImageNet', type: 'Data', desc: '大规模图像数据集，推动了计算机视觉的发展。' },
  { name: 'Word2Vec', type: 'Method', desc: '将词语映射到向量空间的方法。' },
  { name: 'Embedding', type: 'Concept', desc: '将离散符号映射到连续向量空间的技术。' },
  { name: 'Tokenization', type: 'Concept', desc: '将文本分割为 token 的过程。' },
  { name: 'BPE', type: 'Method', desc: 'Byte Pair Encoding，一种子词分词算法。' },
  { name: 'Fine-Tuning', type: 'Method', desc: '在预训练模型基础上针对特定任务进行微调。' },
  { name: 'Transfer Learning', type: 'Concept', desc: '将一个任务学到的知识迁移到另一个任务。' },
  { name: 'Pre-Training', type: 'Concept', desc: '在大规模无标注数据上进行的初始训练阶段。' },
  { name: 'Masked Language Model', type: 'Method', desc: 'BERT 的预训练目标之一，预测被遮蔽的词。' },
  { name: 'Autoregressive Model', type: 'Concept', desc: '按顺序生成序列的模型。' },
  { name: 'Cross-Entropy Loss', type: 'Concept', desc: '分类任务中常用的损失函数。' },
  { name: 'Softmax', type: 'Concept', desc: '将向量转换为概率分布的函数。' },
  { name: 'Backpropagation', type: 'Method', desc: '通过链式法则计算梯度的算法。' },
  { name: 'Adam Optimizer', type: 'Method', desc: '自适应学习率优化算法。' },
  { name: 'Dropout', type: 'Method', desc: '训练时随机丢弃神经元以防止过拟合。' },
  { name: 'Batch Normalization', type: 'Method', desc: '对每个 mini-batch 进行归一化。' },
  { name: 'CNN', type: 'Method', desc: '卷积神经网络，擅长处理网格结构数据。' },
  { name: 'RNN', type: 'Method', desc: '循环神经网络，处理序列数据。' },
  { name: 'LSTM', type: 'Method', desc: '长短期记忆网络，解决 RNN 的长期依赖问题。' },
  { name: 'GAN', type: 'Method', desc: '生成对抗网络，通过对抗训练生成数据。' },
  { name: 'VAE', type: 'Method', desc: '变分自编码器，学习数据的潜在分布。' },
  { name: 'Reinforcement Learning', type: 'Concept', desc: '通过与环境交互学习最优策略。' },
  { name: 'Knowledge Distillation', type: 'Method', desc: '将大模型的知识压缩到小模型中。' },
  { name: 'ViT', type: 'Method', desc: 'Vision Transformer，将 Transformer 应用于图像分类。' },
  { name: 'CLIP', type: 'Method', desc: '对比语言-图像预训练，连接文本和图像。' },
  { name: 'Diffusion Model', type: 'Method', desc: '通过逐步去噪生成数据的模型。' },
  { name: 'RAG', type: 'Method', desc: '检索增强生成，结合检索和生成提升回答质量。' },
]

export function generateMockEntities(): GraphEntity[] {
  return MOCK_ENTITIES_RAW.map((e, i) => ({
    id: e.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
    name: e.name,
    type: e.type,
    description: e.desc
  }))
}

// ============================================================================
// Mock 关系数据
// ============================================================================

const RELATION_DEFS: Array<[string, string, string, string]> = [
  // [source_name, target_name, keywords, description]
  ['Transformer', 'Attention Mechanism', '基于', 'Transformer 基于注意力机制构建'],
  ['Transformer', 'Self-Attention', '使用', 'Transformer 使用自注意力机制'],
  ['Transformer', 'Multi-Head Attention', '包含', 'Transformer 包含多头注意力'],
  ['Transformer', 'Positional Encoding', '需要', 'Transformer 需要位置编码'],
  ['Transformer', 'Feed-Forward Network', '包含', 'Transformer 包含前馈网络'],
  ['Transformer', 'Layer Normalization', '使用', 'Transformer 使用层归一化'],
  ['Transformer', 'Residual Connection', '使用', 'Transformer 使用残差连接'],
  ['BERT', 'Transformer', '基于', 'BERT 基于 Transformer 架构'],
  ['BERT', 'Masked Language Model', '使用', 'BERT 使用掩码语言模型预训练'],
  ['BERT', 'Pre-Training', '采用', 'BERT 采用预训练策略'],
  ['BERT', 'Fine-Tuning', '支持', 'BERT 支持下游任务微调'],
  ['BERT', 'Google', '开发者', 'BERT 由 Google 开发'],
  ['GPT', 'Transformer', '基于', 'GPT 基于 Transformer 架构'],
  ['GPT', 'Autoregressive Model', '属于', 'GPT 是自回归模型'],
  ['GPT', 'OpenAI', '开发者', 'GPT 由 OpenAI 开发'],
  ['GPT', 'Fine-Tuning', '支持', 'GPT 支持微调'],
  ['Vaswani et al.', 'Transformer', '提出', 'Vaswani 等人提出了 Transformer'],
  ['Vaswani et al.', 'Google', '隶属', '作者团队来自 Google'],
  ['Self-Attention', 'Multi-Head Attention', '组成', '自注意力是多头注意力的基础'],
  ['Attention Mechanism', 'Self-Attention', '包含', '注意力机制包含自注意力'],
  ['Transfer Learning', 'Pre-Training', '包含', '迁移学习包含预训练阶段'],
  ['Transfer Learning', 'Fine-Tuning', '包含', '迁移学习包含微调阶段'],
  ['Embedding', 'Word2Vec', '实现', 'Word2Vec 是嵌入的一种实现'],
  ['Tokenization', 'BPE', '方法', 'BPE 是分词方法之一'],
  ['BERT', 'Tokenization', '需要', 'BERT 需要分词处理'],
  ['GPT', 'BPE', '使用', 'GPT 使用 BPE 分词'],
  ['Cross-Entropy Loss', 'Softmax', '配合', '交叉熵损失常与 Softmax 配合使用'],
  ['Backpropagation', 'Adam Optimizer', '配合', '反向传播与 Adam 优化器配合'],
  ['Dropout', 'Transformer', '应用于', 'Dropout 应用于 Transformer'],
  ['CNN', 'ImageNet', '训练于', 'CNN 在 ImageNet 上训练'],
  ['RNN', 'LSTM', '改进', 'LSTM 是 RNN 的改进版本'],
  ['ViT', 'Transformer', '基于', 'ViT 基于 Transformer'],
  ['ViT', 'ImageNet', '评估于', 'ViT 在 ImageNet 上评估'],
  ['CLIP', 'Transformer', '基于', 'CLIP 基于 Transformer'],
  ['CLIP', 'OpenAI', '开发者', 'CLIP 由 OpenAI 开发'],
  ['Diffusion Model', 'VAE', '相关', '扩散模型与 VAE 有理论联系'],
  ['GAN', 'Backpropagation', '使用', 'GAN 使用反向传播训练'],
  ['Knowledge Distillation', 'BERT', '应用于', '知识蒸馏可应用于 BERT'],
  ['RAG', 'Embedding', '使用', 'RAG 使用嵌入进行检索'],
  ['RAG', 'GPT', '结合', 'RAG 结合 GPT 进行生成'],
  ['Reinforcement Learning', 'GPT', '用于', 'RLHF 用于 GPT 对齐'],
  ['Batch Normalization', 'CNN', '应用于', 'BN 常应用于 CNN'],
]

export function generateMockRelations(): GraphRelation[] {
  const entities = generateMockEntities()
  const idMap = new Map(entities.map(e => [e.name, e.id]))

  return RELATION_DEFS
    .filter(([src, tgt]) => idMap.has(src) && idMap.has(tgt))
    .map(([src, tgt, kw, desc], i) => ({
      id: `rel_${i}`,
      source: idMap.get(src)!,
      target: idMap.get(tgt)!,
      keywords: kw,
      description: desc,
      weight: 0.5 + Math.random() * 1.5
    }))
}
