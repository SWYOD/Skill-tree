import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { promises as fs } from 'fs'
import type { AppSettings, SkillTree } from '../shared/types'
import { registerAutoUpdater, scheduleUpdateChecks } from './autoUpdater'

const isDev = !app.isPackaged

const DEFAULT_SETTINGS: AppSettings = {
  rootDir: null,
  themeId: 'amoled',
  customThemes: [],
  themeMode: 'primary',
  unlockMechanic: true,
  edgeAnim: 'breathing',
  recentDirs: [],
  fontMode: 'default',
  customFont: null,
  lastCustomFontByCategory: {}
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#0a0d12',
    autoHideMenuBar: true,
    title: 'Skill Tree',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC-обработчики ───────────────────────────────────────────────────────────

function registerIpc(): void {
  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    const saved = await readJson<Partial<AppSettings>>(settingsPath())
    return { ...DEFAULT_SETTINGS, ...(saved ?? {}) }
  })

  ipcMain.handle('settings:save', async (_e, settings: AppSettings): Promise<void> => {
    await writeJson(settingsPath(), settings)
  })

  ipcMain.handle('app:get-version', (): string => app.getVersion())

  ipcMain.handle('dir:select', async (): Promise<string | null> => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Выберите директорию для дерева навыков',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return null
    return res.filePaths[0]
  })

  ipcMain.handle('store:load', async (_e, rootDir: string): Promise<SkillTree | null> => {
    return readJson<SkillTree>(join(rootDir, 'store.json'))
  })

  ipcMain.handle('store:save', async (_e, rootDir: string, tree: SkillTree): Promise<void> => {
    await writeJson(join(rootDir, 'store.json'), tree)
  })

  ipcMain.handle('note:read', async (_e, rootDir: string, notePath: string): Promise<string> => {
    try {
      return await fs.readFile(join(rootDir, notePath), 'utf-8')
    } catch {
      return ''
    }
  })

  ipcMain.handle(
    'note:write',
    async (_e, rootDir: string, notePath: string, content: string): Promise<void> => {
      const full = join(rootDir, notePath)
      await fs.mkdir(dirname(full), { recursive: true })
      await fs.writeFile(full, content, 'utf-8')
    }
  )

  ipcMain.handle(
    'note:rename',
    async (_e, rootDir: string, oldPath: string, newPath: string): Promise<void> => {
      if (oldPath === newPath) return
      const oldFull = join(rootDir, oldPath)
      const newFull = join(rootDir, newPath)
      try {
        await fs.mkdir(dirname(newFull), { recursive: true })
        await fs.rename(oldFull, newFull)
      } catch {
        // Старого файла ещё не было (заметку ни разу не сохраняли) — переносить нечего,
        // новый файл появится сам при следующем note:write.
      }
    }
  )

  ipcMain.handle(
    'json:export',
    async (_e, defaultName: string, data: unknown): Promise<boolean> => {
      if (!mainWindow) return false
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Экспорт',
        defaultPath: defaultName,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePath) return false
      await fs.writeFile(res.filePath, JSON.stringify(data, null, 2), 'utf-8')
      return true
    }
  )

  ipcMain.handle('json:import', async (): Promise<unknown | null> => {
    if (!mainWindow) return null
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Импорт',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return null
    try {
      const raw = await fs.readFile(res.filePaths[0], 'utf-8')
      return JSON.parse(raw)
    } catch {
      return null
    }
  })

  ipcMain.handle(
    'png:save',
    async (_e, defaultName: string, dataUrl: string): Promise<boolean> => {
      if (!mainWindow) return false
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Экспорт графа в PNG',
        defaultPath: defaultName,
        filters: [{ name: 'PNG', extensions: ['png'] }]
      })
      if (res.canceled || !res.filePath) return false
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      await fs.writeFile(res.filePath, Buffer.from(base64, 'base64'))
      return true
    }
  )
}

app.whenReady().then(() => {
  registerIpc()
  registerAutoUpdater()
  createWindow()
  scheduleUpdateChecks()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
