import { contextBridge, ipcRenderer } from 'electron'
import type { Api, AppSettings, SkillTree } from '../shared/types'

const api: Api = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),

  selectRootDir: () => ipcRenderer.invoke('dir:select'),

  loadStore: (rootDir: string) => ipcRenderer.invoke('store:load', rootDir),
  saveStore: (rootDir: string, tree: SkillTree) => ipcRenderer.invoke('store:save', rootDir, tree),

  readNote: (rootDir: string, notePath: string) =>
    ipcRenderer.invoke('note:read', rootDir, notePath),
  writeNote: (rootDir: string, notePath: string, content: string) =>
    ipcRenderer.invoke('note:write', rootDir, notePath, content),
  renameNote: (rootDir: string, oldPath: string, newPath: string) =>
    ipcRenderer.invoke('note:rename', rootDir, oldPath, newPath),

  exportJson: (defaultName: string, data: unknown) =>
    ipcRenderer.invoke('json:export', defaultName, data),
  importJson: () => ipcRenderer.invoke('json:import'),
  savePng: (defaultName: string, dataUrl: string) =>
    ipcRenderer.invoke('png:save', defaultName, dataUrl)
}

contextBridge.exposeInMainWorld('api', api)
