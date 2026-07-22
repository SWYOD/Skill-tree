import { useEffect, useState } from 'react'
import { X, Check } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { resolveTheme, resolveFontFamily } from '../themes/apply'
import { FONT_OPTIONS, FONT_CATEGORY_LABEL } from '../themes/fonts'
import type { FontOption } from '../themes/fonts'

interface Props {
  onClose: () => void
}

const MODE_LABEL: Record<'default' | 'theme' | 'custom', string> = {
  default: 'По умолчанию',
  theme: 'Как в теме',
  custom: 'Свой'
}

const PREVIEW_TEXT = 'Skill Tree — дерево навыков Аа Бб Вв 0123'

/**
 * Модальное окно «Шрифт» — тот же паттерн, что и «Темы» (ThemesPopup):
 * по центру экрана, галерея карточек с живым предпросмотром. Три источника
 * шрифта интерфейса (см. AppSettings.fontMode): дефолтный стек, шрифт
 * активной темы (ThemeDef.font — не у каждой темы задан) или явный выбор
 * пользователя из курируемого списка/свободного ввода.
 */
export function FontsPopup({ onClose }: Props): JSX.Element {
  const settings = useTree((s) => s.settings)
  const setFontMode = useTree((s) => s.setFontMode)
  const setCustomFont = useTree((s) => s.setCustomFont)
  const [customDraft, setCustomDraft] = useState(settings.customFont ?? '')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const activeTheme = resolveTheme(settings.themeId, settings.customThemes)

  function previewStyle(family: string): { fontFamily: string } {
    return { fontFamily: family }
  }

  const categories: FontOption['category'][] = ['sans', 'serif', 'mono']

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal fonts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Шрифт интерфейса</span>
          <div className="modal-head-actions">
            <button className="icon-btn" onClick={onClose} title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="segmented fonts-mode-seg">
          {(['default', 'theme', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              className={`seg${settings.fontMode === mode ? ' active' : ''}`}
              onClick={() => setFontMode(mode)}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>

        {settings.fontMode === 'default' && (
          <div className="font-preview-solo">
            <div className="font-preview-solo-label">Стандартный стек — Inter, иначе системный шрифт</div>
            <div className="font-preview-solo-text" style={previewStyle(resolveFontFamily('default', null, activeTheme))}>
              {PREVIEW_TEXT}
            </div>
          </div>
        )}

        {settings.fontMode === 'theme' && (
          <div className="font-preview-solo">
            <div className="font-preview-solo-label">
              {activeTheme.font
                ? `Шрифт темы «${activeTheme.name}» — ${activeTheme.font}`
                : `У темы «${activeTheme.name}» свой шрифт не задан — используется стандартный стек`}
            </div>
            <div className="font-preview-solo-text" style={previewStyle(resolveFontFamily('theme', null, activeTheme))}>
              {PREVIEW_TEXT}
            </div>
          </div>
        )}

        {settings.fontMode === 'custom' && (
          <>
            {categories.map((cat) => (
              <div key={cat}>
                <label className="settings-label">{FONT_CATEGORY_LABEL[cat]}</label>
                <div className="font-grid">
                  {FONT_OPTIONS.filter((f) => f.category === cat).map((f) => (
                    <button
                      key={f.id}
                      className={`font-card${settings.customFont === f.family ? ' active' : ''}`}
                      onClick={() => {
                        setCustomFont(f.family)
                        setCustomDraft(f.family)
                      }}
                    >
                      <div className="font-card-head">
                        <span className="font-card-name">{f.label}</span>
                        {settings.customFont === f.family && <Check size={13} className="font-card-check" />}
                      </div>
                      <div className="font-card-preview" style={previewStyle(f.family)}>
                        {PREVIEW_TEXT}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <label className="settings-label" style={{ marginTop: 4 }}>
              Свой вариант (название шрифта, установленного в системе)
            </label>
            <div className="font-custom-row">
              <input
                className="font-custom-input"
                value={customDraft}
                placeholder="Например: Fira Code"
                onChange={(e) => setCustomDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setCustomFont(customDraft)
                }}
              />
              <button className="tb-btn primary" onClick={() => setCustomFont(customDraft)}>
                Применить
              </button>
            </div>
            {customDraft.trim() && (
              <div className="font-preview-solo-text" style={previewStyle(customDraft)}>
                {PREVIEW_TEXT}
              </div>
            )}
            <p className="dim small">
              Если такого шрифта нет в системе, автоматически применится стандартный стек — ничего
              ломаться не будет.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
