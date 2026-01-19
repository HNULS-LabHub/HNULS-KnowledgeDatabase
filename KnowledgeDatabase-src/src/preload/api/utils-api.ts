import { webUtils } from 'electron'
import type { UtilsAPI } from '../types'

export const utilsAPI: UtilsAPI = {
  getPathForFile: (file: File): string => {
    return webUtils.getPathForFile(file)
  }
}

