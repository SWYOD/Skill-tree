import type { Api, AppSettings, SkillTree } from '@shared/types'

/**
 * Заглушка window.api для запуска renderer в обычном браузере (без Electron) —
 * нужна только для визуальной проверки/разработки. В Electron window.api всегда
 * задаётся preload-скриптом, поэтому этот мок там не активируется.
 */
export function installMockApi(): void {
  const w = window as unknown as { api?: Api }
  if (w.api) return

  const ls = window.localStorage
  const get = <T>(k: string, d: T): T => {
    try {
      const v = ls.getItem(k)
      return v ? (JSON.parse(v) as T) : d
    } catch {
      return d
    }
  }
  const set = (k: string, v: unknown): void => ls.setItem(k, JSON.stringify(v))

  const mock: Api = {
    getSettings: async () =>
      get<AppSettings>('mock:settings', {
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
      }),
    saveSettings: async (s: AppSettings) => set('mock:settings', s),
    getAppVersion: async () => '0.0.0-mock',
    selectRootDir: async () => '/mock/skill-tree',
    loadStore: async (root: string) => get<SkillTree | null>(`mock:store:${root}`, null),
    saveStore: async (root: string, tree: SkillTree) => set(`mock:store:${root}`, tree),
    readNote: async (root: string, path: string) => get<string>(`mock:note:${root}:${path}`, ''),
    writeNote: async (root: string, path: string, c: string) =>
      set(`mock:note:${root}:${path}`, c),
    renameNote: async (root: string, oldPath: string, newPath: string) => {
      if (oldPath === newPath) return
      const k = `mock:note:${root}:${oldPath}`
      const v = ls.getItem(k)
      if (v != null) {
        set(`mock:note:${root}:${newPath}`, JSON.parse(v))
        ls.removeItem(k)
      }
    },
    exportJson: async () => {
      console.info('[mock] exportJson')
      return true
    },
    importJson: async () => null,
    savePng: async () => {
      console.info('[mock] savePng')
      return true
    },
    // Автообновление недоступно в браузере — заглушки-нооп, чтобы UI не падал.
    checkForUpdate: async () => console.info('[mock] checkForUpdate'),
    installUpdate: async () => console.info('[mock] installUpdate'),
    onUpdateStatus: () => () => {},
    onUpdateReady: () => () => {}
  }

  w.api = mock
  console.info('[mock] window.api installed (browser dev mode)')
}
