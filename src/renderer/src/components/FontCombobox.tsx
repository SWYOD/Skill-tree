import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export interface FontComboboxOption {
  label: string
  /** CSS font-family значение этого варианта (без общего fallback-хвоста). */
  value: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: FontComboboxOption[]
  placeholder?: string
}

/**
 * Поле выбора шрифта «два в одном»: клик без ввода показывает полный список
 * (ведёт себя как обычный select), а печать фильтрует его по подстроке
 * (автоподсказка) — и всё равно можно ввести произвольное название, которого
 * нет в списке (шрифт, установленный в системе, но не входящий в курируемый
 * FONT_OPTIONS). Один контрол вместо раздельных select+текстового поля.
 */
export function FontCombobox({ value, onChange, options, placeholder }: Props): JSX.Element {
  const [draft, setDraft] = useState(value)
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => setDraft(value), [value])

  const filtered = draft.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(draft.toLowerCase()))
    : options

  function commit(v: string): void {
    const trimmed = v.trim()
    if (trimmed) onChange(trimmed)
    setOpen(false)
    setActiveIdx(-1)
  }

  function selectOption(o: FontComboboxOption): void {
    setDraft(o.value)
    onChange(o.value)
    setOpen(false)
    setActiveIdx(-1)
  }

  return (
    <div className="font-combobox" ref={rootRef}>
      <input
        className="font-combobox-input"
        value={draft}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setDraft(e.target.value)
          setOpen(true)
          setActiveIdx(-1)
        }}
        onBlur={() => {
          // Небольшая задержка — иначе blur успевает закрыть список ДО того,
          // как успеет сработать onMouseDown по пункту списка.
          window.setTimeout(() => commit(draft), 120)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            if (activeIdx >= 0 && filtered[activeIdx]) selectOption(filtered[activeIdx])
            else commit(draft)
          } else if (e.key === 'Escape') {
            setOpen(false)
            setActiveIdx(-1)
          }
        }}
      />
      <ChevronDown size={14} className="font-combobox-caret" />
      {open && filtered.length > 0 && (
        <div className="font-combobox-list">
          {filtered.map((o, i) => (
            <div
              key={o.label}
              className={`font-combobox-option${i === activeIdx ? ' active' : ''}`}
              style={{ fontFamily: o.value }}
              onMouseDown={(e) => {
                e.preventDefault()
                selectOption(o)
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
