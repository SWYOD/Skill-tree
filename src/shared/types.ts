// Общие типы для main- и renderer-процессов.

export type ItemKind = 'branch' | 'node' | 'group'

export type ItemStatus = 'locked' | 'available' | 'in_progress' | 'done'

export interface ChecklistEntry {
  id: string
  text: string
  done: boolean
}

export interface Item {
  id: string
  kind: ItemKind
  /** null у главных веток (крепятся к центру «НАВЫКИ») */
  parentId: string | null
  title: string
  /** Цвет ветки; узел может переопределить (доп. цвет узла). */
  color?: string
  /** Имя иконки из lucide-react (напр. "Cpu", "Music"). */
  icon?: string
  /**
   * Ручной порядок среди сиблингов (для стабильной раскладки).
   * Меньше — раньше.
   */
  order: number
  checklist: ChecklistEntry[]
  /** Относительный путь к заметке, напр. "notes/<id>.md". */
  notePath?: string
  /** Заголовок заметки — по умолчанию совпадает с title узла, но можно задать
   *  свой (независимо переименовать заметку, не трогая сам узел). */
  noteTitle?: string
  createdAt: number
  updatedAt: number
  completedAt?: number
  /** Принудительная блокировка (независимо от чеклиста) — наследуется потомками. */
  forceLocked?: boolean
  /** Ручная отметка «уже освоено» для узлов без чеклиста — не считать прогресс. */
  manualDone?: boolean
  /** Скрыт с графа (быстрый тумблер «глазик» в левом дереве) — сам элемент
   *  остаётся в дереве и данных, просто не рисуется на графе; распространяется
   *  на всё вложенное (см. фильтрацию в GraphCanvas.tsx). */
  hidden?: boolean
}

export interface TreeMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export interface SkillTree {
  meta: TreeMeta
  items: Item[]
}

/** Стиль подсветки пути при наведении/выборе. */
export type EdgeAnim = 'static' | 'breathing' | 'flow'

/**
 * Значения CSS custom properties темы — ключи БЕЗ ведущих `--`, но иначе
 * буквально совпадают с именами переменных в styles.css (`bg-panel` →
 * `--bg-panel`), чтобы применение темы было прямым маппингом без перевода.
 */
export interface ThemeVars {
  bg: string
  'bg-panel': string
  'bg-graph': string
  surface: string
  'surface-2': string
  hover: string
  border: string
  'border-strong': string
  text: string
  'text-dim': string
  'text-faint': string
  accent: string
  'accent-soft': string
  danger: string
  shadow: string
  /** Цвет текста/иконок ПОВЕРХ заливки accent (кнопки primary, активный
   *  segmented-таб, чекбокс в состоянии done и т.п.) — раньше эти места были
   *  захардкожены в чёрный, из-за чего на светлых темах текст на акценте
   *  выглядел неправильно. Опционален для обратной совместимости со старыми
   *  экспортированными JSON-темами: если не задан, resolveAccentText() в
   *  themes/apply.ts подставляет чёрный на тёмном accent-фоне и белый на
   *  светлом (см. ThemeDef.dark соответствующего вида темы). */
  'accent-text'?: string
}

/** Второй («альтернативный») вид той же темы — обратный по яркости режим
 *  (тёмный↔светлый) той же темы, а не отдельная тема в галерее. Если задан,
 *  в UI появляется быстрый тумблер тёмный/светлый прямо для этой темы. */
export interface ThemeVariant {
  vars: ThemeVars
  branchColors: string[]
}

export interface ThemeDef {
  id: string
  name: string
  /** Тёмная или светлая по своей сути (основной вид, см. altVariant для
   *  обратного) — влияет на интенсивность neon-glow фильтра на графе (сильный
   *  на тёмном фоне, приглушённый на светлом, иначе на светлом фоне свечение
   *  выглядит грязным пятном, а не неоном). */
  dark: boolean
  vars: ThemeVars
  /** Палитра для авто-назначения цвета новым веткам под этой темой. */
  branchColors: string[]
  /** true у отгруженных с приложением тем — их нельзя удалить/перезаписать. */
  builtin?: boolean
  /** Обратный по яркости вид ЭТОЙ ЖЕ темы (см. ThemeVariant) — опционально. */
  altVariant?: ThemeVariant
  /** Предлагаемое темой семейство шрифтов (CSS font-family, без обёртки в
   *  кавычки) — применяется, только если settings.fontMode === 'theme'. Не у
   *  каждой темы задано; если нет — режим «как в теме» ведёт себя как
   *  «по умолчанию» для этой конкретной темы. */
  font?: string
}

export interface AppSettings {
  /** Последняя открытая корневая директория дерева. */
  rootDir: string | null
  /** id активной темы — встроенной (см. themes.ts) или из customThemes. */
  themeId: string
  /** Импортированные/созданные пользователем темы (хранятся в settings.json). */
  customThemes: ThemeDef[]
  /** Какой вид активной темы показывать — основной или altVariant (если у
   *  темы вообще есть обратный по яркости вид, см. ThemeDef.altVariant). */
  themeMode: 'primary' | 'alt'
  /** Механика игрового разблока (узлы блокируются до выполнения родителя). */
  unlockMechanic: boolean
  /** Как анимируется подсвеченный путь: статика / «дыхание» / поток. */
  edgeAnim: EdgeAnim
  /** Недавно открытые корневые директории (для быстрого переключения), новые сначала. */
  recentDirs: string[]
  /** Источник шрифта интерфейса: стандартный стек (Inter/системный), шрифт,
   *  предложенный активной темой (ThemeDef.font), или явно выбранный
   *  пользователем (см. customFont). */
  fontMode: 'default' | 'theme' | 'custom'
  /** Имя шрифта для fontMode === 'custom' (CSS font-family, без кавычек) —
   *  либо выбран из курируемого списка в FontsPopup, либо введён вручную.
   *  Если шрифта нет в системе, CSS сам откатится на стандартный стек
   *  (тот же fallback, что и у fontMode 'default'), ничего дополнительно
   *  проверять/подставлять не нужно. */
  customFont: string | null
}

/** Статус проверки/загрузки автообновления — транслируется из главного
 *  процесса в рендерер по мере продвижения electron-updater. */
export interface UpdateStatus {
  state: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'
  version?: string
  message?: string
}

export interface UpdateReadyInfo {
  version: string
}

// ── Контракт IPC (window.api) ────────────────────────────────────────────────

export interface Api {
  // Настройки приложения (userData)
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings): Promise<void>
  /** Версия приложения из package.json (для бейджа в шапке). */
  getAppVersion(): Promise<string>

  // Корневая директория дерева
  selectRootDir(): Promise<string | null>

  // Хранилище дерева
  loadStore(rootDir: string): Promise<SkillTree | null>
  saveStore(rootDir: string, tree: SkillTree): Promise<void>

  // Markdown-заметки
  readNote(rootDir: string, notePath: string): Promise<string>
  writeNote(rootDir: string, notePath: string, content: string): Promise<void>
  renameNote(rootDir: string, oldPath: string, newPath: string): Promise<void>

  // Импорт/экспорт
  exportJson(defaultName: string, data: unknown): Promise<boolean>
  importJson(): Promise<unknown | null>
  savePng(defaultName: string, dataUrl: string): Promise<boolean>

  // Автообновление (electron-updater, см. src/main/autoUpdater.ts)
  checkForUpdate(): Promise<void>
  installUpdate(): Promise<void>
  /** Возвращает функцию отписки. */
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void
  onUpdateReady(cb: (info: UpdateReadyInfo) => void): () => void
}
