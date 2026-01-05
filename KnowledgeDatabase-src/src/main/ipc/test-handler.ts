import { IpcMainInvokeEvent } from 'electron';
import { BaseIPCHandler } from './base-handler';

export class TestIPCHandler extends BaseIPCHandler {
  protected getChannelPrefix(): string {
    return 'test';
  }

  async handlePing(_event: IpcMainInvokeEvent): Promise<{ success: boolean; message: string; timestamp: number }> {
    console.log('Received ping from renderer');
    return {
      success: true,
      message: 'pong',
      timestamp: Date.now()
    };
  }

  async handleEcho(_event: IpcMainInvokeEvent, message: string): Promise<{ success: boolean; echo: string }> {
    return {
      success: true,
      echo: `Echo: ${message}`
    };
  }

  constructor() {
    super();
    this.register();
  }
}