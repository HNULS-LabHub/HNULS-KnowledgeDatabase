/**
 * 分块服务工具函数
 */
import * as path from 'path'
import * as fs from 'fs/promises'

/**
 * 安全的文档名称（移除非法字符）
 */
export function safeDocName(input: string): string {
  return input.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'
}

/**
 * 获取分块文档目录
 * @param kbRoot 知识库根目录
 * @param fileName 文件名
 * @returns 文档名称和分块目录路径
 */
export function getChunkDocDir(
  kbRoot: string,
  fileName: string
): { docName: string; chunkDocDir: string } {
  const docName = safeDocName(path.parse(fileName).name)
  const chunkDocDir = path.join(kbRoot, '.ChunkDocument', docName)
  return { docName, chunkDocDir }
}

/**
 * 检查目录是否存在
 */
export async function dirExists(dir: string): Promise<boolean> {
  try {
    const st = await fs.stat(dir)
    return st.isDirectory()
  } catch {
    return false
  }
}

/**
 * 纯文本文件扩展名列表（与前端保持一致）
 */
const PLAIN_TEXT_EXTENSIONS = new Set([
  // 通用文本类
  'txt',
  'log',
  'asc',
  'sig',
  'me',
  '1st',
  'now',
  'msg',
  // 轻量级标记语言
  'md',
  'markdown',
  'rst',
  'adoc',
  'asciidoc',
  'textile',
  'org',
  'wiki',
  // 数据交换与配置文件
  'json',
  'csv',
  'tsv',
  'xml',
  'yaml',
  'yml',
  'ini',
  'conf',
  'config',
  'toml',
  'properties',
  'env',
  'sql',
  // 网页与前端开发
  'html',
  'htm',
  'xhtml',
  'css',
  'scss',
  'sass',
  'less',
  'js',
  'mjs',
  'ts',
  'svg',
  // 源代码格式
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'java',
  'py',
  'rb',
  'php',
  'lua',
  'pl',
  'go',
  'rs',
  'swift',
  'kt',
  'hs',
  'erl',
  'clj',
  'sh',
  'bash',
  'bat',
  'ps1',
  // 学术与科学格式
  'tex',
  'cls',
  'sty',
  'bib'
])

/**
 * 判断文件是否为纯文本格式
 * @param extension 文件扩展名（不含点号，如 'txt', 'pdf'）
 * @returns 是否为纯文本文件
 */
export function isPlainTextFile(extension?: string): boolean {
  if (!extension) return false
  return PLAIN_TEXT_EXTENSIONS.has(extension.toLowerCase())
}
