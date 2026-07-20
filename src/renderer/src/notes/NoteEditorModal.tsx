import { useEffect, useState } from 'react'
import { X, Columns2, SquarePen } from 'lucide-react'
import { renderMarkdown } from './markdown'
import { LiveMarkdownEditor } from './LiveMarkdownEditor'

interface Props {
  title: string
  notePath: string
  content: string
  onChange: (v: string) => void
  onClose: () => void
}

/**
 * Полноэкранный редактор заметки — то же содержимое/состояние, что и в узкой
 * панели справа (см. NoteEditor.tsx, который передаёт content/onChange сюда
 * как controlled-проп, а не заводит отдельное — иначе два независимых таймера
 * автосохранения могли бы гоняться друг за другом). Два режима: «Сплит» —
 * сырой markdown и рендер рядом; «Динамический» — Obsidian-style Live
 * Preview в одном поле (см. LiveMarkdownEditor.tsx).
 */
export function NoteEditorModal({ title, notePath, content, onChange, onClose }: Props): JSX.Element {
  const [viewMode, setViewMode] = useState<'split' | 'live'>('live')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal note-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">
            {title} <span className="dim small">— {notePath}</span>
          </span>
          <div className="modal-head-actions">
            <div className="segmented note-editor-modal-modes">
              <button
                className={`seg${viewMode === 'live' ? ' active' : ''}`}
                title="Живое форматирование в одном поле (как в Obsidian)"
                onClick={() => setViewMode('live')}
              >
                <SquarePen size={12} /> Динамический
              </button>
              <button
                className={`seg${viewMode === 'split' ? ' active' : ''}`}
                title="Сырой markdown и рендер рядом"
                onClick={() => setViewMode('split')}
              >
                <Columns2 size={12} /> Сплит
              </button>
            </div>
            <button className="icon-btn" onClick={onClose} title="Закрыть">
              <X size={16} />
            </button>
          </div>
        </div>

        {viewMode === 'split' ? (
          <div className="note-editor-modal-split">
            <textarea
              className="note-area note-editor-modal-pane"
              value={content}
              autoFocus
              placeholder="# Заметки в markdown…"
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="note-area note-preview note-editor-modal-pane">{renderMarkdown(content)}</div>
          </div>
        ) : (
          <div className="note-area note-editor-modal-pane note-editor-modal-live">
            <LiveMarkdownEditor value={content} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  )
}
