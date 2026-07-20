import { useEffect, useRef } from 'react'
import { EditorState, RangeSetBuilder } from '@codemirror/state'
import type { SelectionRange } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { minimalSetup } from 'codemirror'

interface Props {
  value: string
  onChange: (v: string) => void
}

function touchesRange(ranges: readonly SelectionRange[], from: number, to: number): boolean {
  return ranges.some((r) => r.from <= to && r.to >= from)
}

const INLINE_RE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_)/g

/**
 * Живая подстановка стилей markdown прямо в текст редактора (Obsidian-style
 * Live Preview): синтаксические маркеры (#, **, *, `, []()) скрываются, пока
 * курсор/выделение не касается их диапазона — тогда они снова показываются
 * для редактирования. Правила разбора (заголовки/списки/цитаты/callout'ы)
 * специально держим в одном стиле с renderMarkdown из markdown.tsx — то же
 * визуальное поведение, что и во вкладке «Просмотр».
 */
function buildDecorations(state: EditorState, hasFocus: boolean): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  // Без фокуса раскрывать маркеры незачем — иначе позиция курсора/выделения,
  // унаследованная от предыдущего открытия (или дефолтная позиция 0 в начале
  // документа при первом монтировании), навсегда держала бы «раскрытой» ту
  // строку, на которой она случайно оказалась, даже когда редактор не активен.
  const ranges = hasFocus ? state.selection.ranges : []
  const doc = state.doc
  let calloutType: string | null = null
  let inFence = false

  function markPair(from: number, to: number, markerLen: number, cls: string, touched: boolean): void {
    if (touched) {
      builder.add(from, to, Decoration.mark({ class: cls }))
      return
    }
    builder.add(from, from + markerLen, Decoration.replace({}))
    builder.add(from + markerLen, to - markerLen, Decoration.mark({ class: cls }))
    builder.add(to - markerLen, to, Decoration.replace({}))
  }

  function markLink(from: number, to: number, textLen: number, touched: boolean): void {
    if (touched) {
      builder.add(from, to, Decoration.mark({ class: 'cm-link' }))
      return
    }
    builder.add(from, from + 1, Decoration.replace({}))
    builder.add(from + 1, from + 1 + textLen, Decoration.mark({ class: 'cm-link' }))
    builder.add(from + 1 + textLen, to, Decoration.replace({}))
  }

  function applyInline(text: string, lineStart: number, skipChars: number): void {
    INLINE_RE.lastIndex = skipChars
    let m: RegExpExecArray | null
    while ((m = INLINE_RE.exec(text))) {
      const from = lineStart + m.index
      const to = lineStart + m.index + m[0].length
      const touched = touchesRange(ranges, from, to)
      if (m[2] !== undefined) markPair(from, to, 2, 'cm-bold', touched)
      else if (m[3] !== undefined) markPair(from, to, 1, 'cm-code', touched)
      else if (m[4] !== undefined) markLink(from, to, m[4].length, touched)
      else if (m[6] !== undefined || m[7] !== undefined) markPair(from, to, 1, 'cm-italic', touched)
    }
  }

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const lineTouched = touchesRange(ranges, line.from, line.to)

    if (/^```/.test(text.trim())) {
      inFence = !inFence
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-fence-line' }))
      continue
    }
    if (inFence) {
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-code-line' }))
      continue
    }

    const h = /^(#{1,6})(\s+)/.exec(text)
    if (h) {
      const level = Math.min(h[1].length, 4)
      builder.add(line.from, line.from, Decoration.line({ class: `cm-h cm-h${level}` }))
      if (!lineTouched) builder.add(line.from, line.from + h[0].length, Decoration.replace({}))
      applyInline(text, line.from, h[0].length)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text.trim())) {
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-hr-line' }))
      continue
    }

    const q = /^>\s?/.exec(text)
    if (q) {
      const rest = text.slice(q[0].length)
      const calloutMatch = /^\[!([\w-]+)\]\s*/.exec(rest)
      if (calloutMatch) calloutType = calloutMatch[1].toLowerCase()
      // md-callout-* переиспользует те же --callout-color переменные, что и
      // превью (см. markdown.tsx/.md-callout-* в styles.css) — один источник
      // цветов на оба режима просмотра.
      const cls = calloutType
        ? `cm-quote-line cm-callout-line md-callout-${calloutType}`
        : 'cm-quote-line'
      builder.add(line.from, line.from, Decoration.line({ class: cls }))
      let skip = q[0].length
      if (calloutMatch) skip += calloutMatch[0].length
      if (!lineTouched) builder.add(line.from, line.from + skip, Decoration.replace({}))
      applyInline(text, line.from, skip)
      continue
    }
    calloutType = null

    applyInline(text, line.from, 0)
  }

  return builder.finish()
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state, view.hasFocus)
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.state, update.view.hasFocus)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

/** CodeMirror-редактор с «живым» превью форматирования прямо во время ввода. */
export function LiveMarkdownEditor({ value, onChange }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return
    const state = EditorState.create({
      doc: value,
      extensions: [
        minimalSetup,
        EditorView.lineWrapping,
        livePreviewPlugin,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString())
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit' },
          // caret-color через обычный CSS (styles.css) проигрывал встроенным
          // стилям CodeMirror — те подключаются через собственный механизм
          // StyleModule и оказываются позже в каскаде независимо от порядка
          // импорта. Задаём его тем же способом, что и остальную тему
          // редактора, чтобы гарантированно выиграть приоритет.
          '.cm-content': { padding: '11px', caretColor: 'var(--accent)' },
          '.cm-cursor, .cm-cursor-primary': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' }
        })
      ]
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    return () => view.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Внешние изменения value (смена узла) — применяем, только если реально
  // разошлись с текущим содержимым редактора; иначе наш же onChange заставил
  // бы курсор прыгать в начало на каждое нажатие клавиши.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
  }, [value])

  return <div className="cm-host" ref={hostRef} />
}
