import * as fs from 'fs/promises'
import * as path from 'path'

export function safeDocName(input: string): string {
  return input.replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'
}

export function getDocDir(kbRoot: string, fileName: string): { docName: string; docDir: string } {
  const docName = safeDocName(path.parse(fileName).name)
  const docDir = path.join(kbRoot, '.ParserDocument', docName)
  return { docName, docDir }
}

export async function dirExists(dir: string): Promise<boolean> {
  try {
    const st = await fs.stat(dir)
    return st.isDirectory()
  } catch {
    return false
  }
}

export async function listExistingVersions(params: {
  kbRoot: string
  fileName: string
}): Promise<string[]> {
  const { docDir } = getDocDir(params.kbRoot, params.fileName)

  try {
    const entries = await fs.readdir(docDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => /^version-\d+$/.test(name))
      .sort((a, b) => {
        const na = Number(a.replace('version-', ''))
        const nb = Number(b.replace('version-', ''))
        return nb - na
      })
  } catch {
    return []
  }
}

export async function nextVersionId(params: { kbRoot: string; fileName: string }): Promise<string> {
  const existing = await listExistingVersions(params)
  const max = existing
    .map((v) => Number(v.replace('version-', '')))
    .filter((n) => Number.isFinite(n))
    .reduce((acc, n) => Math.max(acc, n), 0)

  return `version-${max + 1}`
}
