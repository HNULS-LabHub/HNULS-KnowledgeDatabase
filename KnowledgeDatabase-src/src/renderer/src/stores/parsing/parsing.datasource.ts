import * as mock from './parsing.mock'
import type { FileParsingState, StartParsingOptions } from './parsing.types'

export const ParsingDataSource = {
  async getFileParsingState(fileKey: string): Promise<FileParsingState> {
    return mock.mockParsingStateByFileKey(fileKey)
  },

  async startParsing(fileKey: string, options: StartParsingOptions): Promise<FileParsingState> {
    const state = mock.mockParsingStateByFileKey(fileKey)
    return mock.mockStartNewVersion(state, options.parserName)
  }
}
