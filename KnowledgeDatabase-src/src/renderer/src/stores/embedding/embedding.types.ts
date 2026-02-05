/**
 * Ƕ��״̬���Ͷ��壨renderer��
 */

export interface EmbeddingViewConfig {
  configId: string // Ƕ������ ID������֪ʶ�����ã�
  providerId: string // �ṩ�� ID
  modelId: string // ģ�� ID
  dimensions?: number // ����ά��
}

export interface EmbeddingVector {
  id: string // ���� ID
  content: string // ԭʼ����
  vector: number[] // ��������
  chunkId: string // �����ķֿ� ID
}

export interface FileEmbeddingState {
  fileKey: string // �ļ���ʶ��·�������ƣ�
  config: EmbeddingViewConfig // ʹ�õ�����
  vectors: EmbeddingVector[] // �����б�
  status: 'idle' | 'running' | 'completed' | 'failed' // ״̬
  progress?: number // ���� 0-100
  totalVectors?: number // ��������
  processedVectors?: number // �Ѵ���������
  lastUpdated?: string // ������ʱ��
  error?: string // ������Ϣ
}
