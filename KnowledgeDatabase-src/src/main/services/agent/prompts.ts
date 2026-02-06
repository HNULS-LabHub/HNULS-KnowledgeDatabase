/**
 * @file Agent 节点 Prompt 定义
 * @description grade / generate 节点的 system prompt
 */

/**
 * Grade 节点 Prompt
 * 要求 LLM 判断检索到的文档是否足以回答用户问题
 * 返回严格的 JSON 格式
 */
export const GRADE_SYSTEM_PROMPT = `你是一个文档相关性评估专家。

你的任务是判断给定的检索文档是否足以回答用户的问题。

请严格按以下 JSON 格式返回，不要包含任何其他文字：
{"needMore": true/false, "rationale": "简要理由"}

评估标准：
- 如果文档内容与问题高度相关且包含足够的信息来回答问题，返回 needMore: false
- 如果文档内容不相关、信息不足、或只覆盖了问题的部分内容，返回 needMore: true
- rationale 用一句话说明判断理由

只返回 JSON，不要有其他输出。`

/**
 * Generate 节点 Prompt
 * 基于检索文档生成答案
 */
export const GENERATE_SYSTEM_PROMPT = `你是一个知识库问答助手。请根据以下提供的参考文档来回答用户的问题。

要求：
1. 仅基于提供的参考文档内容作答，不要编造信息
2. 如果文档中没有足够信息回答问题，请如实说明
3. 回答要清晰、有条理
4. 适当引用文档来源（如文件名）以增加可信度
5. 使用 Markdown 格式组织回答`

/**
 * 构建 grade 节点的用户消息
 */
export function buildGradeUserMessage(question: string, docSummaries: string): string {
  return `问题：${question}

检索到的文档摘要：
${docSummaries}`
}

/**
 * 构建 generate 节点的用户消息
 */
export function buildGenerateUserMessage(question: string, docContents: string): string {
  return `参考文档：
${docContents}

用户问题：${question}`
}

/**
 * 将文档列表压缩为摘要文本（给 grade 节点用）
 */
export function summarizeDocs(
  docs: Array<{ content: string; file_name?: string }>
): string {
  if (docs.length === 0) return '（无文档）'

  return docs
    .map((d, i) => {
      const source = d.file_name ? ` [来源: ${d.file_name}]` : ''
      // 截断过长内容，grade 只需要摘要
      const content = d.content.length > 300 ? d.content.slice(0, 300) + '...' : d.content
      return `[${i + 1}]${source}\n${content}`
    })
    .join('\n\n')
}

/**
 * 将文档列表构建为完整上下文（给 generate 节点用）
 */
export function buildDocContext(
  docs: Array<{ content: string; file_name?: string }>
): string {
  if (docs.length === 0) return '（无参考文档）'

  return docs
    .map((d, i) => {
      const source = d.file_name ? ` [来源: ${d.file_name}]` : ''
      return `--- 文档 ${i + 1}${source} ---\n${d.content}`
    })
    .join('\n\n')
}
