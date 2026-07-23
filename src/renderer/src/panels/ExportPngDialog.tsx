import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { X, Download, Moon, Sun } from 'lucide-react'
import { useTree } from '../store/treeStore'
import {
  allThemes,
  effectiveVariant,
  resolveFontFamily,
  resolveTheme,
  themeVarsStyle,
  FONT_FALLBACK_TAIL
} from '../themes/apply'
import { FONT_OPTIONS } from '../themes/fonts'
import { StaticGraphSvg } from '../graph/StaticGraphSvg'
import { rasterizeGraphSvg, saveGraphPng } from '../io/exportImage'
import { Switch } from '../components/Switch'
import { ThemeCard } from '../components/ThemeCard'
import { FontCombobox } from '../components/FontCombobox'

interface Props {
  onClose: () => void
}

/** Стабильная ссылка — паттерн «полностью развёрнутый» передаёт пустой набор
 *  свёрнутых id; без общей константы каждый рендер создавал бы новый Set и
 *  зря пересчитывал бы layout внутри StaticGraphSvg. */
const EMPTY_SET = new Set<string>()

const FONT_COMBOBOX_OPTIONS = FONT_OPTIONS.map((f) => ({ label: f.label, value: f.family }))

/**
 * Диалог экспорта графа в PNG — тема/шрифт/фон/паттерн узлов независимы от
 * текущих настроек приложения (можно экспортировать в ДРУГОЙ теме, не меняя
 * реальный интерфейс), с живым превью. Превью и финальный рендер — один и
 * тот же StaticGraphSvg с идентичными пропами, так что превью не врёт: что
 * видно в диалоге, то и попадёт в файл (см. handleExport — растеризует
 * ИМЕННО этот же <svg> через rasterizeGraphSvg).
 */
export function ExportPngDialog({ onClose }: Props): JSX.Element | null {
  const tree = useTree((s) => s.tree)
  const settings = useTree((s) => s.settings)
  const graphCollapsed = useTree((s) => s.graphCollapsed)
  const collapsed = useTree((s) => s.collapsed)
  const graphTreeLinked = useTree((s) => s.graphTreeLinked)
  const currentCollapsed = graphTreeLinked ? collapsed : graphCollapsed

  const themes = useMemo(() => allThemes(settings.customThemes), [settings.customThemes])
  const [themeId, setThemeId] = useState(settings.themeId)
  const [themeMode, setThemeMode] = useState<'primary' | 'alt'>('primary')
  const [fontChoice, setFontChoice] = useState<'app' | 'custom'>('app')
  const [customFontValue, setCustomFontValue] = useState('Inter')
  const [background, setBackground] = useState(true)
  const [pattern, setPattern] = useState<'current' | 'expanded'>('current')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const selectedTheme =
    themes.find((t) => t.id === themeId) ?? resolveTheme(settings.themeId, settings.customThemes)
  const variant = effectiveVariant(selectedTheme, themeMode)
  // Какой режим тёмный/светлый — как в SettingsPanel: зависит от того, тёмная
  // ли сама тема по умолчанию (обычно primary тёмный, alt светлый).
  const darkMode: 'primary' | 'alt' = selectedTheme.dark ? 'primary' : 'alt'
  const lightMode: 'primary' | 'alt' = selectedTheme.dark ? 'alt' : 'primary'

  const fontFamily = useMemo(() => {
    if (fontChoice === 'custom') {
      return customFontValue.trim()
        ? `${customFontValue}, ${FONT_FALLBACK_TAIL}`
        : `'Inter', ${FONT_FALLBACK_TAIL}`
    }
    return resolveFontFamily(
      settings.fontMode,
      settings.customFont,
      resolveTheme(settings.themeId, settings.customThemes)
    )
  }, [fontChoice, customFontValue, settings.fontMode, settings.customFont, settings.themeId, settings.customThemes])

  const varsStyle = useMemo(() => themeVarsStyle(variant, fontFamily), [variant, fontFamily])
  const previewCollapsed = pattern === 'expanded' ? EMPTY_SET : currentCollapsed

  const svgRef = useRef<SVGSVGElement>(null)

  // Подгоняем viewBox превью под фактический bbox содержимого — те же
  // координаты содержимого потом использует и rasterizeGraphSvg (он считает
  // bbox заново сам, с бОльшим паддингом под финальный файл).
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg || !tree) return
    const content = svg.querySelector('#static-graph-content') as SVGGElement | null
    if (!content) return
    const bbox = content.getBBox()
    if (bbox.width === 0 || bbox.height === 0) return
    const pad = 50
    svg.setAttribute(
      'viewBox',
      `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`
    )
  }, [tree, previewCollapsed, settings.unlockMechanic])

  async function handleExport(): Promise<void> {
    if (!svgRef.current || !tree) return
    setSaving(true)
    try {
      const dataUrl = await rasterizeGraphSvg(svgRef.current, 'static-graph-content', {
        varsStyle,
        background,
        scale: 2
      })
      if (dataUrl) await saveGraphPng(`${tree.meta.name}.png`, dataUrl)
    } finally {
      setSaving(false)
    }
  }

  if (!tree) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal theme-editor-modal export-png-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">Экспорт графа в PNG</span>
          <div className="modal-head-actions">
            <button className="tb-btn primary" onClick={handleExport} disabled={saving}>
              <Download size={14} /> {saving ? 'Сохранение…' : 'Экспортировать'}
            </button>
            <button className="icon-btn" onClick={onClose} title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="theme-editor-body">
          <div className="theme-editor-form">
            <div className="export-png-theme-head">
              <label className="settings-label">Тема</label>
              {selectedTheme.altVariant && (
                <div className="segmented export-png-theme-mode">
                  <button
                    className={`seg${themeMode === darkMode ? ' active' : ''}`}
                    onClick={() => setThemeMode(darkMode)}
                  >
                    <Moon size={12} /> Тёмная
                  </button>
                  <button
                    className={`seg${themeMode === lightMode ? ' active' : ''}`}
                    onClick={() => setThemeMode(lightMode)}
                  >
                    <Sun size={12} /> Светлая
                  </button>
                </div>
              )}
            </div>
            <div className="theme-grid export-png-theme-grid">
              {themes.map((t) => (
                <ThemeCard key={t.id} theme={t} active={themeId === t.id} onClick={() => setThemeId(t.id)} />
              ))}
            </div>

            <label className="settings-label" style={{ marginTop: 16 }}>
              Шрифт
            </label>
            <div className="segmented">
              <button
                className={`seg${fontChoice === 'app' ? ' active' : ''}`}
                onClick={() => setFontChoice('app')}
              >
                Как в приложении
              </button>
              <button
                className={`seg${fontChoice === 'custom' ? ' active' : ''}`}
                onClick={() => setFontChoice('custom')}
              >
                Свой
              </button>
            </div>
            {fontChoice === 'custom' && (
              <FontCombobox
                value={customFontValue}
                onChange={setCustomFontValue}
                options={FONT_COMBOBOX_OPTIONS}
                placeholder="Название шрифта…"
              />
            )}

            <label className="settings-label" style={{ marginTop: 14 }}>
              Паттерн узлов
            </label>
            <div className="segmented">
              <button
                className={`seg${pattern === 'current' ? ' active' : ''}`}
                onClick={() => setPattern('current')}
              >
                Как сейчас в графе
              </button>
              <button
                className={`seg${pattern === 'expanded' ? ' active' : ''}`}
                onClick={() => setPattern('expanded')}
              >
                Полностью развёрнутый
              </button>
            </div>

            <div className="settings-row" style={{ marginTop: 14 }}>
              <span>Фон</span>
              <Switch checked={background} onChange={setBackground} />
            </div>
            <p className="dim small" style={{ margin: '4px 0 0' }}>
              {background
                ? 'Сплошная заливка цветом фона выбранной темы.'
                : 'Прозрачный PNG, без заливки фона.'}
            </p>
          </div>

          <div className="theme-editor-preview">
            <label className="settings-label">Превью</label>
            <div
              className={`export-png-preview${background ? '' : ' checkerboard'}`}
              style={
                {
                  ...varsStyle,
                  background: background ? 'var(--bg-graph)' : undefined,
                  fontFamily: 'var(--font-ui)'
                } as React.CSSProperties
              }
            >
              <StaticGraphSvg
                ref={svgRef}
                items={tree.items}
                collapsed={previewCollapsed}
                unlockMechanic={settings.unlockMechanic}
                treeName={tree.meta.name}
                isDarkTheme={variant.dark}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
