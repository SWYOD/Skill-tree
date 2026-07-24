import { useEffect, useRef, useState } from 'react'
import { FileText, Save, Pencil, Eye, Maximize2 } from 'lucide-react'
import { useTree } from '../store/treeStore'
import type { Item } from '@shared/types'
import { renderMarkdown } from './markdown'
import { NoteEditorModal } from './NoteEditorModal'
import { computeNotePath } from './path'
import { useMarkdownContext } from './useMarkdownContext'

export function NoteEditor({ item }: { item: Item }): JSX.Element {
  const rootDir = useTree((s) => s.settings.rootDir)
  const updateItem = useTree((s) => s.updateItem)
  const markdownCtx = useMarkdownContext()
  const [content, setContent] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [expanded, setExpanded] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const noteTitle = item.noteTitle ?? item.title
  const notePath = item.notePath ?? computeNotePath(item.id, noteTitle)
  const notePathRef = useRef(notePath)
  const [titleDraft, setTitleDraft] = useState(noteTitle)

  // Черновик заголовка синхронизируем с реальным значением при смене узла
  // (или если название узла сменилось, а свой заголовок заметки не задан).
  useEffect(() => {
    setTitleDraft(noteTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, noteTitle])

  // Смена узла — просто синхронизируем ref с его актуальным путём, БЕЗ
  // переименования (см. следующий эффект, который сравнивает с этим ref —
  // иначе просто открыв другой узел с другим заголовком мы бы приняли это за
  // «заголовок сменился» и попытались переименовать чужой файл).
  useEffect(() => {
    notePathRef.current = notePath
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  // Заголовок заметки реально сменился (сам пользователь отредактировал его,
  // либо — если свой заголовок не задан — сменилось название узла) — физически
  // переименовываем файл на диске, сохраняя id-суффикс и не трогая содержимое.
  useEffect(() => {
    if (!rootDir) return
    const newPath = computeNotePath(item.id, noteTitle)
    const oldPath = notePathRef.current
    if (newPath === oldPath) return
    notePathRef.current = newPath
    window.api.renameNote(rootDir, oldPath, newPath)
    updateItem(item.id, { notePath: newPath })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTitle, rootDir])

  function commitTitle(): void {
    const v = titleDraft.trim()
    if (!v || v === noteTitle) {
      setTitleDraft(noteTitle)
      return
    }
    updateItem(item.id, { noteTitle: v })
  }

  // Загрузка содержимого заметки при смене узла
  useEffect(() => {
    let alive = true
    setLoaded(false)
    if (!rootDir) return
    window.api.readNote(rootDir, notePathRef.current).then((c) => {
      if (!alive) return
      setContent(c)
      setLoaded(true)
      setDirty(false)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, rootDir])

  function persist(next: string): void {
    if (!rootDir) return
    const path = notePathRef.current
    window.api.writeNote(rootDir, path, next).then(() => setDirty(false))
    if (!item.notePath) updateItem(item.id, { notePath: path })
  }

  function onChange(v: string): void {
    setContent(v)
    setDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => persist(v), 600)
  }

  return (
    <div className="block note-block">
      <div className="block-head">
        <span>
          <FileText size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          Заметка (.md)
        </span>
        <span className="dim small">{dirty ? 'сохранение…' : 'сохранено'}</span>
      </div>

      <input
        className="note-title-input"
        value={titleDraft}
        placeholder={item.title}
        onChange={(e) => setTitleDraft(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') setTitleDraft(noteTitle)
        }}
      />

      <div className="note-toolbar">
        <div className="segmented">
          <button
            className={`seg${mode === 'write' ? ' active' : ''}`}
            onClick={() => setMode('write')}
          >
            <Pencil size={12} /> Правка
          </button>
          <button
            className={`seg${mode === 'preview' ? ' active' : ''}`}
            onClick={() => setMode('preview')}
          >
            <Eye size={12} /> Просмотр
          </button>
        </div>
        <button
          className="icon-btn xs"
          title="Открыть в полноэкранном редакторе"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {mode === 'write' ? (
        <textarea
          className="note-area"
          value={content}
          disabled={!rootDir || !loaded}
          placeholder={rootDir ? '# Заметки в markdown…' : 'Сначала выберите директорию дерева'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (dirty) persist(content)
          }}
        />
      ) : (
        <div className="note-area note-preview">{renderMarkdown(content, markdownCtx)}</div>
      )}

      <div className="note-path dim small">
        <Save size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
        {notePath}
      </div>

      {expanded && (
        <NoteEditorModal
          title={noteTitle}
          notePath={notePath}
          content={content}
          onChange={onChange}
          onClose={() => {
            if (dirty) persist(content)
            setExpanded(false)
          }}
        />
      )}
    </div>
  )
}
