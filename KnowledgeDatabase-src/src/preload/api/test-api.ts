import { ipcRenderer } from 'electron';

export const testAPI = {
  /**
   * 发送 ping 请求到主进程
   */
  ping: (): Promise<{ success: boolean; message: string; timestamp: number }> => {
    return ipcRenderer.invoke('test:ping');
  },

  /**
   * 发送 echo 请求到主进程
   */
  echo: (message: string): Promise<{ success: boolean; echo: string }> => {
    return ipcRenderer.invoke('test:echo', message);
  }
};