import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppSettings, SkillTree, UpdateReadyInfo, UpdateStatus } from '../shared/types'

const api: Api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),

  selectRootDir: () => ipcRenderer.invoke('dir:select'),

  loadStore: (rootDir: string) => ipcRenderer.invoke('store:load', rootDir),
  saveStore: (rootDir: string, tree: SkillTree) => ipcRenderer.invoke('store:save', rootDir, tree),

  readNote: (rootDir: string, notePath: string) =>
    ipcRenderer.invoke('note:read', rootDir, notePath),
  writeNote: (rootDir: string, notePath: string, content: string) =>
    ipcRenderer.invoke('note:write', rootDir, notePath, content),
  renameNote: (rootDir: string, oldPath: string, newPath: string) =>
    ipcRenderer.invoke('note:rename', rootDir, oldPath, newPath),
  readNoteImage: (rootDir: string, relPath: string) =>
    ipcRenderer.invoke('note:read-image', rootDir, relPath),

  exportJson: (defaultName: string, data: unknown) =>
    ipcRenderer.invoke('json:export', defaultName, data),
  importJson: () => ipcRenderer.invoke('json:import'),
  savePng: (defaultName: string, dataUrl: string) =>
    ipcRenderer.invoke('png:save', defaultName, dataUrl),

  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, status: UpdateStatus): void => cb(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  onUpdateReady: (cb: (info: UpdateReadyInfo) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, info: UpdateReadyInfo): void => cb(info)
    ipcRenderer.on('updater:ready', listener)
    return () => ipcRenderer.removeListener('updater:ready', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
