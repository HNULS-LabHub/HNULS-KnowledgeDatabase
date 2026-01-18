/**
 * 分块相关工具函数
 */

/**
 * 纯文本文件扩展名列表
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

/**
 * 判断文件是否可以进行分块操作
 * @param extension 文件扩展名
 * @param isParsed 是否已解析（对于非纯文本文件，需要先解析）
 * @returns 是否可以进行分块
 */
export function canChunkFile(extension?: string, isParsed?: boolean): boolean {
  if (!extension) return false

  const isPlainText = isPlainTextFile(extension)

  // 纯文本文件可以直接分块
  if (isPlainText) {
    return true
  }

  // 非纯文本文件需要先解析
  return isParsed === true
}
