export interface FontOption {
  id: string
  label: string
  /** Значение CSS font-family для ЭТОГО шрифта (без общего fallback-хвоста —
   *  тот дописывается один раз в resolveFontFamily, см. themes/apply.ts). */
  family: string
  category: 'sans' | 'serif' | 'mono'
}

/**
 * Курируемый список шрифтов для FontsPopup — только реально распространённые
 * системные шрифты macOS/Windows (никакой шрифт здесь не грузится как
 * веб-шрифт, файлов в бандле нет). Если конкретного шрифта нет на машине
 * пользователя — браузер сам молча откатится на fallback-хвост
 * (resolveFontFamily), выбирать/подгружать замену вручную не нужно.
 */
export const FONT_OPTIONS: FontOption[] = [
  { id: 'inter', label: 'Inter', family: 'Inter', category: 'sans' },
  {
    id: 'system-ui',
    label: 'Системный (San Francisco / Segoe UI)',
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI"',
    category: 'sans'
  },
  { id: 'helvetica', label: 'Helvetica Neue', family: '"Helvetica Neue", Helvetica', category: 'sans' },
  { id: 'arial', label: 'Arial', family: 'Arial', category: 'sans' },
  { id: 'roboto', label: 'Roboto', family: 'Roboto', category: 'sans' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana', category: 'sans' },
  { id: 'tahoma', label: 'Tahoma', family: 'Tahoma', category: 'sans' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia', category: 'serif' },
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times', category: 'serif' },
  { id: 'palatino', label: 'Palatino', family: 'Palatino, "Palatino Linotype"', category: 'serif' },
  { id: 'sf-mono', label: 'SF Mono', family: '"SF Mono", ui-monospace', category: 'mono' },
  { id: 'menlo', label: 'Menlo', family: 'Menlo', category: 'mono' },
  { id: 'consolas', label: 'Consolas', family: 'Consolas', category: 'mono' },
  { id: 'courier', label: 'Courier New', family: '"Courier New", Courier', category: 'mono' }
]

export const FONT_CATEGORY_LABEL: Record<FontOption['category'], string> = {
  sans: 'Без засечек',
  serif: 'С засечками',
  mono: 'Моноширинные'
}

/** Грубая эвристика по названию — для шрифтов, введённых вручную (их нет в
 *  FONT_OPTIONS, реальных метаданных о начертании у нас нет). Смотрим на
 *  типичные слова в имени самого шрифта (JetBrains Mono, Fira Code, Times
 *  New Roman и т.п.) — этого достаточно, чтобы решить, в какую категорию
 *  «приколоть» его как последний использованный (см. lastCustomFontByCategory
 *  в AppSettings и FontsPopup). Если ничего не подошло — считаем sans, это
 *  самая частая категория шрифтов по умолчанию. */
export function guessFontCategory(name: string): FontOption['category'] {
  const n = name.toLowerCase()
  if (/mono|code|console|terminal|courier/.test(n)) return 'mono'
  if (/serif/.test(n) && !/sans[\s-]?serif/.test(n)) return 'serif'
  if (/times|georgia|garamond|palatino|book\s?antiqua|cambria/.test(n)) return 'serif'
  return 'sans'
}
