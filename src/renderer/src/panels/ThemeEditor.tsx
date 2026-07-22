import { useState } from 'react'
import { X, Plus, Trash2, Save, Trash } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useTree } from '../store/treeStore'
import { Switch } from '../components/Switch'
import { MiniSkillGraph } from '../components/MiniSkillGraph'
import { resolveAccentText } from '../themes/apply'
import type { ThemeDef, ThemeVars } from '@shared/types'

interface Variant {
  vars: ThemeVars
  branchColors: string[]
}

/** dark — яркость ИМЕННО этого вида (а не всей темы), нужна только чтобы
 *  подставить резонный accent-text в старые темы/JSON, где его ещё нет
 *  (см. ThemeVars['accent-text'] и resolveAccentText в themes/apply.ts). */
function cloneVariant(v: { vars: ThemeVars; branchColors: string[] }, dark: boolean): Variant {
  return {
    vars: { ...v.vars, 'accent-text': resolveAccentText(v.vars, dark) },
    branchColors: [...v.branchColors]
  }
}

const VAR_LABELS: Record<keyof ThemeVars, string> = {
  bg: 'Фон приложения',
  'bg-panel': 'Фон панелей',
  'bg-graph': 'Фон графа',
  surface: 'Поверхность',
  'surface-2': 'Поверхность (вторая)',
  hover: 'Наведение (hover)',
  border: 'Граница',
  'border-strong': 'Граница (акцент)',
  text: 'Текст',
  'text-dim': 'Текст приглушённый',
  'text-faint': 'Текст едва заметный',
  accent: 'Акцент',
  'accent-soft': 'Акцент (мягкий)',
  'accent-text': 'Текст на акценте',
  danger: 'Опасность/удаление',
  shadow: 'Тень'
}
const VAR_ORDER = Object.keys(VAR_LABELS) as (keyof ThemeVars)[]

interface Props {
  /** Тема, от которой стартует черновик — обычно активная (редактор всегда
   *  работает как «дублировать и настроить», встроенные темы не трогаются). */
  baseTheme: ThemeDef
  onClose: () => void
}

/**
 * Полноценный редактор темы — вместо прежней заглушки «в разработке».
 * Всегда создаёт НОВУЮ пользовательскую тему (см. addCustomTheme в
 * treeStore.ts — сам разрулит коллизию id со встроенными), а не правит
 * baseTheme на месте. Поддерживает второй вид (тёмный/светлый тумблер, см.
 * ThemeDef.altVariant) — так же, как у встроенных тем.
 */
export function ThemeEditor({ baseTheme, onClose }: Props): JSX.Element {
  const addCustomTheme = useTree((s) => s.addCustomTheme)
  const [name, setName] = useState(`${baseTheme.name} (копия)`)
  const [dark, setDark] = useState(baseTheme.dark)
  const [primary, setPrimary] = useState<Variant>(() => cloneVariant(baseTheme, baseTheme.dark))
  const [hasAlt, setHasAlt] = useState(!!baseTheme.altVariant)
  const [alt, setAlt] = useState<Variant>(() =>
    cloneVariant(baseTheme.altVariant ?? baseTheme, !baseTheme.dark)
  )

  function updateVar(which: 'primary' | 'alt', key: keyof ThemeVars, value: string): void {
    const setter = which === 'primary' ? setPrimary : setAlt
    setter((p) => ({ ...p, vars: { ...p.vars, [key]: value } }))
  }
  function updateBranchColor(which: 'primary' | 'alt', idx: number, value: string): void {
    const setter = which === 'primary' ? setPrimary : setAlt
    setter((p) => ({ ...p, branchColors: p.branchColors.map((c, i) => (i === idx ? value : c)) }))
  }
  function addBranchColor(which: 'primary' | 'alt'): void {
    const setter = which === 'primary' ? setPrimary : setAlt
    setter((p) => ({ ...p, branchColors: [...p.branchColors, '#8b5cf6'] }))
  }
  function removeBranchColor(which: 'primary' | 'alt', idx: number): void {
    const setter = which === 'primary' ? setPrimary : setAlt
    setter((p) => ({ ...p, branchColors: p.branchColors.filter((_, i) => i !== idx) }))
  }

  function handleSave(): void {
    const trimmed = name.trim()
    if (!trimmed) return
    const theme: ThemeDef = {
      id: nanoid(),
      name: trimmed,
      dark,
      vars: primary.vars,
      branchColors: primary.branchColors,
      ...(hasAlt ? { altVariant: { vars: alt.vars, branchColors: alt.branchColors } } : {})
    }
    addCustomTheme(theme)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal theme-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Редактор темы</span>
          <div className="modal-head-actions">
            <button className="tb-btn primary" onClick={handleSave}>
              <Save size={14} /> Сохранить
            </button>
            <button className="icon-btn" onClick={onClose} title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="theme-editor-body">
          <div className="theme-editor-form">
            <label className="settings-label">Название</label>
            <input
              className="title-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название темы"
            />

            <div className="settings-row" style={{ marginTop: 2 }}>
              <span>Тёмная по умолчанию</span>
              <Switch checked={dark} onChange={setDark} />
            </div>

            <VariantFields
              title="Основной вид"
              variant={primary}
              onVarChange={(k, v) => updateVar('primary', k, v)}
              onColorChange={(i, v) => updateBranchColor('primary', i, v)}
              onAddColor={() => addBranchColor('primary')}
              onRemoveColor={(i) => removeBranchColor('primary', i)}
            />

            <div className="settings-row" style={{ marginTop: 16 }}>
              <span>Второй вид (тумблер тёмный/светлый)</span>
              <Switch checked={hasAlt} onChange={setHasAlt} />
            </div>

            {hasAlt && (
              <VariantFields
                title={dark ? 'Светлый вид' : 'Тёмный вид'}
                variant={alt}
                onVarChange={(k, v) => updateVar('alt', k, v)}
                onColorChange={(i, v) => updateBranchColor('alt', i, v)}
                onAddColor={() => addBranchColor('alt')}
                onRemoveColor={(i) => removeBranchColor('alt', i)}
              />
            )}
          </div>

          <div className="theme-editor-preview">
            <label className="settings-label">Превью — основной вид</label>
            <ThemePreviewMock variant={primary} label={name || 'Без названия'} />
            {hasAlt && (
              <>
                <label className="settings-label" style={{ marginTop: 4 }}>
                  Превью — {dark ? 'светлый' : 'тёмный'} вид
                </label>
                <ThemePreviewMock variant={alt} label={name || 'Без названия'} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function VariantFields({
  title,
  variant,
  onVarChange,
  onColorChange,
  onAddColor,
  onRemoveColor
}: {
  title: string
  variant: Variant
  onVarChange: (key: keyof ThemeVars, value: string) => void
  onColorChange: (idx: number, value: string) => void
  onAddColor: () => void
  onRemoveColor: (idx: number) => void
}): JSX.Element {
  return (
    <div className="theme-editor-variant">
      <label className="settings-label">{title}</label>
      {VAR_ORDER.map((key) => {
        const raw = variant.vars[key] ?? ''
        return (
          <div className="theme-editor-row" key={key}>
            <span className="theme-editor-row-label">{VAR_LABELS[key]}</span>
            <input
              type="color"
              className="swatch-custom"
              value={/^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#000000'}
              onChange={(e) => onVarChange(key, e.target.value)}
            />
            <input
              type="text"
              className="theme-editor-row-text"
              value={raw}
              onChange={(e) => onVarChange(key, e.target.value)}
            />
          </div>
        )
      })}
      <label className="settings-label" style={{ marginTop: 10 }}>
        Цвета веток
      </label>
      <div className="swatches">
        {variant.branchColors.map((c, i) => (
          <span key={i} className="theme-editor-swatch-wrap">
            <input
              type="color"
              className="swatch-custom"
              value={c}
              onChange={(e) => onColorChange(i, e.target.value)}
            />
            <button
              className="icon-btn xs danger theme-editor-swatch-remove"
              onClick={() => onRemoveColor(i)}
              title="Удалить цвет"
            >
              <Trash2 size={11} />
            </button>
          </span>
        ))}
        <button className="icon-btn xs" onClick={onAddColor} title="Добавить цвет">
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

/**
 * Развёрнутый мини-макет реального интерфейса — в отличие от ThemeCard
 * (компактная карточка в галерее, использует только 4-5 переменных для
 * узнаваемого силуэта) здесь задействованы ВСЕ 15 переменных темы, каждая —
 * на заметном, однозначно узнаваемом элементе, чтобы правка любого поля в
 * форме была сразу видна в превью.
 */
function ThemePreviewMock({ variant, label }: { variant: Variant; label: string }): JSX.Element {
  const v = variant.vars
  const colors = variant.branchColors.length > 0 ? variant.branchColors : [v.accent]

  return (
    <div className="theme-editor-mock" style={{ background: v.bg, color: v.text }}>
      <div
        className="theme-editor-mock-topbar"
        style={{ background: v['bg-panel'], borderBottom: `1px solid ${v.border}` }}
      >
        <span className="theme-editor-mock-brand">{label}</span>
        <span className="theme-editor-mock-btn" style={{ background: v.accent, color: v['accent-text'] }}>
          Новая ветка
        </span>
      </div>

      <div className="theme-editor-mock-body">
        <div
          className="theme-editor-mock-side"
          style={{ background: v['bg-panel'], borderRight: `1px solid ${v.border}` }}
        >
          <div style={{ color: v['text-dim'] }}>Обычная</div>
          <div className="theme-editor-mock-row-hover" style={{ background: v.hover, color: v.text }}>
            Наведение
          </div>
          <div
            className="theme-editor-mock-row-active"
            style={{ background: v['accent-soft'], color: v.accent, borderLeft: `2px solid ${v.accent}` }}
          >
            Выбрано
          </div>
          <div style={{ color: v['text-faint'] }}>Едва заметно</div>
        </div>

        <div className="theme-editor-mock-graph" style={{ background: v['bg-graph'] }}>
          <svg viewBox="0 0 200 120" width="100%" height="100%">
            <g transform="translate(100,60)">
              <MiniSkillGraph radius={38} colors={colors} ringColor={v['border-strong']} hubColor={v.text} />
            </g>
          </svg>
        </div>
      </div>

      <div
        className="theme-editor-mock-card"
        style={{ background: v.surface, border: `1px solid ${v.border}`, boxShadow: v.shadow }}
      >
        <span className="theme-editor-mock-chip" style={{ background: v['surface-2'], color: v['text-dim'] }}>
          Чек-лист 2/3
        </span>
        <span className="theme-editor-mock-danger" style={{ color: v.danger }}>
          <Trash size={12} /> Удалить
        </span>
      </div>
    </div>
  )
}
