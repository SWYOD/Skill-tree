import type { ThemeDef, ThemeVars, ThemeVariant } from '@shared/types'
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from './builtins'

// accent-text намеренно не входит сюда — это единственное опциональное поле
// ThemeVars (обратная совместимость со старыми JSON-темами), у него свой
// путь применения через resolveAccentText с фолбэком (см. applyThemeVars).
const THEME_VAR_KEYS: Exclude<keyof ThemeVars, 'accent-text'>[] = [
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

/**
 * Действующий вид темы с учётом тумблера тёмный/светлый (themeMode): если
 * запрошен 'alt', но у темы нет altVariant (обычные темы без пары) — просто
 * остаёмся на основном виде, тумблер в UI для таких тем и не показывается.
 */
export function effectiveVariant(
  theme: ThemeDef,
  mode: 'primary' | 'alt'
): ThemeVariant & { dark: boolean } {
  if (mode === 'alt' && theme.altVariant) {
    return { ...theme.altVariant, dark: !theme.dark }
  }
  return { vars: theme.vars, branchColors: theme.branchColors, dark: theme.dark }
}

/** Цвет текста поверх заливки accent — с фолбэком для тем/JSON-файлов, где
 *  accent-text ещё не задан (см. комментарий у ThemeVars['accent-text']). */
export function resolveAccentText(vars: ThemeVars, dark: boolean): string {
  return vars['accent-text'] ?? (dark ? '#0a0410' : '#ffffff')
}

/** Применяет тему как inline CSS custom properties на :root — так тема может
 *  быть произвольным JSON-объектом (импортированным/созданным пользователем),
 *  а не одним из захардкоженных в styles.css блоков. */
export function applyThemeVars(variant: { vars: ThemeVars; dark: boolean }): void {
  const root = document.documentElement.style
  for (const key of THEME_VAR_KEYS) root.setProperty(`--${key}`, variant.vars[key])
  root.setProperty('--accent-text', resolveAccentText(variant.vars, variant.dark))
}

/** То же самое, что и applyThemeVars, но возвращает набор CSS custom
 *  properties как обычный объект вместо мутации :root — нужно для рендера
 *  ГРАФА в НЕЗАВИСИМОЙ от текущих настроек приложения теме (превью и экспорт
 *  PNG в ExportPngDialog: пользователь может выбрать тему/шрифт, отличные от
 *  тех, что сейчас реально применены в интерфейсе), задавая их как inline
 *  style на локальном wrapper-элементе, а не на всём документе. */
export function themeVarsStyle(
  variant: { vars: ThemeVars; dark: boolean },
  fontFamily: string
): Record<string, string> {
  const style: Record<string, string> = {}
  for (const key of THEME_VAR_KEYS) style[`--${key}`] = variant.vars[key]
  style['--accent-text'] = resolveAccentText(variant.vars, variant.dark)
  style['--font-ui'] = fontFamily
  return style
}

function isValidVariantShape(v: unknown): v is ThemeVariant {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  if (!t.vars || typeof t.vars !== 'object') return false
  const vars = t.vars as Record<string, unknown>
  if (!THEME_VAR_KEYS.every((k) => typeof vars[k] === 'string')) return false
  // accent-text опционален (обратная совместимость), но если задан — строка.
  if (vars['accent-text'] !== undefined && typeof vars['accent-text'] !== 'string') return false
  if (!Array.isArray(t.branchColors) || !t.branchColors.every((c) => typeof c === 'string')) return false
  return true
}

/** Грубая, но достаточная проверка формы импортированного JSON — защищает
 *  от применения мусора (не тот файл выбрали) без падения приложения. */
export function isValidThemeDef(v: unknown): v is ThemeDef {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  if (typeof t.id !== 'string' || typeof t.name !== 'string' || typeof t.dark !== 'boolean') return false
  if (!isValidVariantShape({ vars: t.vars, branchColors: t.branchColors })) return false
  // altVariant опционален, но если задан — должен быть валидной парой vars+branchColors.
  if (t.altVariant !== undefined && !isValidVariantShape(t.altVariant)) return false
  if (t.font !== undefined && typeof t.font !== 'string') return false
  return true
}

/** Fallback-хвост для UI-шрифта — тот же список, что раньше был жёстко
 *  зашит в body{} (styles.css). Дописывается один раз здесь, а не в каждом
 *  вызывающем месте, чтобы 'default'/'theme'/'custom' гарантированно вели
 *  себя одинаково при отсутствии выбранного шрифта в системе. */
export const FONT_FALLBACK_TAIL = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

/** Итоговое значение --font-ui с учётом settings.fontMode:
 *  'default' — стандартный стек (как было всегда);
 *  'theme'   — шрифт активной темы, если он задан, иначе как 'default';
 *  'custom'  — явно выбранный пользователем шрифт (из списка или свой). */
export function resolveFontFamily(
  fontMode: 'default' | 'theme' | 'custom',
  customFont: string | null,
  theme: ThemeDef
): string {
  if (fontMode === 'custom' && customFont && customFont.trim()) {
    return `${customFont}, ${FONT_FALLBACK_TAIL}`
  }
  if (fontMode === 'theme' && theme.font) {
    return `${theme.font}, ${FONT_FALLBACK_TAIL}`
  }
  return `'Inter', ${FONT_FALLBACK_TAIL}`
}

/** Применяет UI-шрифт как CSS custom property на :root — тот же приём, что
 *  и applyThemeVars, чтобы шрифт можно было менять в рантайме без reload. */
export function applyFont(family: string): void {
  document.documentElement.style.setProperty('--font-ui', family)
}
