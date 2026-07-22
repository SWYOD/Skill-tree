import { useEffect, useState } from 'react'
import { X, Upload, Download, Wand2 } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { ThemeCard } from '../components/ThemeCard'
import { ThemeEditor } from './ThemeEditor'
import { BUILTIN_THEMES } from '../themes/builtins'
import { isValidThemeDef, resolveTheme } from '../themes/apply'

interface Props {
  onClose: () => void
}

/**
 * Модальное окно «Темы» — по центру экрана (не всплывающая панель, как
 * остальные попапы в приложении), т.к. это выбор из галереи карточек, а не
 * узкий список действий. Закрывается по клику на подложку/Escape/крестику.
 */
export function ThemesPopup({ onClose }: Props): JSX.Element {
  const settings = useTree((s) => s.settings)
  const setThemeId = useTree((s) => s.setThemeId)
  const addCustomTheme = useTree((s) => s.addCustomTheme)
  const removeCustomTheme = useTree((s) => s.removeCustomTheme)
  const [importError, setImportError] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleImport(): Promise<void> {
    setImportError(null)
    const data = await window.api.importJson()
    if (data === null) return
    if (!isValidThemeDef(data)) {
      setImportError('Файл не похож на тему Skill Tree — проверь формат.')
      return
    }
    addCustomTheme(data)
  }

  async function handleExport(): Promise<void> {
    const active = [...BUILTIN_THEMES, ...settings.customThemes].find((t) => t.id === settings.themeId)
    if (!active) return
    await window.api.exportJson(`${active.id}.theme.json`, active)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal themes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Темы</span>
          <div className="modal-head-actions">
            <button className="tb-btn" onClick={handleImport}>
              <Download size={14} /> Импорт
            </button>
            <button className="tb-btn" onClick={handleExport}>
              <Upload size={14} /> Экспорт
            </button>
            <button
              className="tb-btn theme-editor-btn"
              title="Создать тему на основе активной"
              onClick={() => setEditorOpen(true)}
            >
              <Wand2 size={14} /> Редактор темы
            </button>
            <button className="icon-btn" onClick={onClose} title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>

        {importError && <p className="theme-import-error">{importError}</p>}

        <label className="settings-label">Базовые</label>
        <div className="theme-grid">
          {BUILTIN_THEMES.map((t) => (
            <ThemeCard key={t.id} theme={t} active={settings.themeId === t.id} onClick={() => setThemeId(t.id)} />
          ))}
        </div>

        <label className="settings-label" style={{ marginTop: 18 }}>
          Загруженные
        </label>
        {settings.customThemes.length === 0 ? (
          <div className="theme-empty">
            Пока нет загруженных тем — импортируй файл темы или создай свою в редакторе
          </div>
        ) : (
          <div className="theme-grid">
            {settings.customThemes.map((t) => (
              <ThemeCard
                key={t.id}
                theme={t}
                active={settings.themeId === t.id}
                onClick={() => setThemeId(t.id)}
                onRemove={() => removeCustomTheme(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <ThemeEditor
          baseTheme={resolveTheme(settings.themeId, settings.customThemes)}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
