import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'

/**
 * Preload script exposes a typed API to the renderer process.
 * The renderer never touches ipcRenderer directly — all communication
 * goes through this bridge.
 */

export interface ElectronAPI {
  // Request/Response (renderer → main → renderer)
  invoke: (channel: string, data?: unknown) => Promise<unknown>

  // Push listeners (main → renderer)
  onPlayerUpdate: (callback: (data: unknown) => void) => () => void
  onConnectionStatus: (callback: (data: unknown) => void) => () => void
}

const api: ElectronAPI = {
  invoke: (channel: string, data?: unknown) => {
    // Whitelist only known channels
    const allowed = Object.values(IPC_CHANNELS)
    if (!allowed.includes(channel as any)) {
      return Promise.reject(new Error(`Unknown IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, data)
  },

  onPlayerUpdate: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.PLAYER_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PLAYER_UPDATE, handler)
  },

  onConnectionStatus: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.CONNECTION_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.CONNECTION_STATUS, handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
