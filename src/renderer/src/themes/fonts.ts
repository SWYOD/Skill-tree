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
