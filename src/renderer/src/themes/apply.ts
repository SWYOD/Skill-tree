import type { ThemeDef, ThemeVars } from '@shared/types'
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from './builtins'

const THEME_VAR_KEYS: (keyof ThemeVars)[] = [
  'bg',
  'bg-panel',
  'bg-graph',
  'surface',
  'surface-2',
  'hover',
  'border',
  'border-strong',
  'text',
  'text-dim',
  'text-faint',
  'accent',
  'accent-soft',
  'danger',
  'shadow'
]

export function allThemes(customThemes: ThemeDef[]): ThemeDef[] {
  return [...BUILTIN_THEMES, ...customThemes]
}

/** Находит тему по id среди встроенных и пользовательских; если не нашлась
 *  (например, id из настроек указывает на удалённую кастомную тему) —
 *  откатывается на дефолтную встроенную, а не падает/рисует пустоту. */
export function resolveTheme(themeId: string, customThemes: ThemeDef[]): ThemeDef {
  const found = allThemes(customThemes).find((t) => t.id === themeId)
  if (found) return found
  return BUILTIN_THEMES.find((t) => t.id === DEFAULT_THEME_ID) ?? BUILTIN_THEMES[0]
}

/** Применяет тему как inline CSS custom properties на :root — так тема может
 *  быть произвольным JSON-объектом (импортированным/созданным пользователем),
 *  а не одним из захардкоженных в styles.css блоков. */
export function applyThemeVars(vars: ThemeVars): void {
  const root = document.documentElement.style
  for (const key of THEME_VAR_KEYS) root.setProperty(`--${key}`, vars[key])
}

/** Грубая, но достаточная проверка формы импортированного JSON — защищает
 *  от применения мусора (не тот файл выбрали) без падения приложения. */
export function isValidThemeDef(v: unknown): v is ThemeDef {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.dark !== 'boolean') return false
  if (!t.vars || typeof t.vars !== 'object') return false
  const vars = t.vars as Record<string, unknown>
  if (!THEME_VAR_KEYS.every((k) => typeof vars[k] === 'string')) return false
  if (!Array.isArray(t.branchColors) || !t.branchColors.every((c) => typeof c === 'string')) return false
  return true
}
