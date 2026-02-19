/**
 * @file 实体类型颜色自动分配
 * 使用 HSL 色相均匀分布（光谱取色），与类型数量无关
 */

const FALLBACK_COLOR = '#94a3b8'

/**
 * HSL 转 RGB Hex
 * @param h 色相 0-360
 * @param s 饱和度 0-100
 * @param l 亮度 0-100
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * 根据实体类型列表生成颜色映射
 * 按类型名排序后，使用 HSL 色相均匀分布
 */
export function buildColorMap(types: string[]): Map<string, string> {
  const map = new Map<string, string>()
  const sorted = [...types].sort()
  const n = sorted.length

  if (n === 0) return map

  // 使用固定的饱和度和亮度，只变化色相
  const saturation = 65
  const lightness = 55

  for (let i = 0; i < n; i++) {
    // 色相从 0 到 360 均匀分布，避开最后一段（接近红色）
    const hue = (i / n) * 330
    map.set(sorted[i], hslToHex(hue, saturation, lightness))
  }

  return map
}

/**
 * 获取类型对应颜色
 */
export function getTypeColor(colorMap: Map<string, string>, type: string): string {
  return colorMap.get(type) ?? FALLBACK_COLOR
}

/**
 * 将颜色映射转为图例数组
 */
export function colorMapToLegend(
  colorMap: Map<string, string>
): Array<{ type: string; color: string }> {
  return Array.from(colorMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, color]) => ({ type, color }))
}

/**
 * 解析 hex 颜色为 RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 148, g: 163, b: 184 } // fallback gray
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  }
}

/**
 * RGB 转 hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
}

/**
 * 混合两个颜色（用于边的中间色）
 */
export function blendColors(color1: string, color2: string, ratio = 0.5): string {
  const c1 = hexToRgb(color1)
  const c2 = hexToRgb(color2)
  return rgbToHex(
    c1.r * (1 - ratio) + c2.r * ratio,
    c1.g * (1 - ratio) + c2.g * ratio,
    c1.b * (1 - ratio) + c2.b * ratio
  )
}
