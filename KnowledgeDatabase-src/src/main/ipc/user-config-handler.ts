import { BaseIPCHandler } from './base-handler'
import { UserConfigService } from '../services/user-config-service'

export class UserConfigIPCHandler extends BaseIPCHandler {
  constructor(private readonly userConfigService: UserConfigService) {
    super()
    this.register()
  }

  protected getChannelPrefix(): string {
    return 'userConfig'
  }

  async handleGet(): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
    const config = await this.userConfigService.getConfig()
    return { success: true, data: config }
  }

  async handleUpdate(
    _event: unknown,
    patch: unknown
  ): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
    const config = await this.userConfigService.updateConfig(patch)
    return { success: true, data: config }
  }
}
