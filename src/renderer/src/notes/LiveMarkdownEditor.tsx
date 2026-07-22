import { useEffect, useRef } from 'react'
import { EditorState, Prec, RangeSetBuilder } from '@codemirror/state'
import type { SelectionRange } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { minimalSetup } from 'codemirror'

interface Props {
  value: string
  onChange: (v: string) => void
}

function touchesRange(ranges: readonly SelectionRange[], from: number, to: number): boolean {
  return ranges.some((r) => r.from <= to && r.to >= from)
}

// Порядок альтернатив важен: **bold** и ~~strike~~/==mark== должны проверяться
// раньше одиночных */`_` , иначе `**x**` частично съедается как `*` + текст.
const INLINE_RE =
  /(\*\*([^*]+)\*\*|~~([^~]+)~~|==([^=]+)==|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_)/g

function indentDepth(indent: string): number {
  const spaces = indent.replace(/\t/g, '  ').length
  return Math.min(Math.floor(spaces / 2), 6)
}

class BulletWidget extends WidgetType {
  constructor(readonly depth: number) {
    super()
  }
  eq(other: WidgetType): boolean {
    return other instanceof BulletWidget && other.depth === this.depth
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '•'
    return span
  }
}

class OrderedWidget extends WidgetType {
  constructor(readonly n: number) {
    super()
  }
  eq(other: WidgetType): boolean {
    return other instanceof OrderedWidget && other.n === this.n
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-ol-marker'
    span.textContent = `${this.n}.`
    return span
  }
}

/** Клик по чекбоксу переключает символ внутри `[ ]`/`[x]` прямо в документе —
 *  без раскрытия сырого синтаксиса, как в Obsidian. */
class TaskCheckboxWidget extends WidgetType {
  constructor(
    readonly view: EditorView,
    readonly checked: boolean,
    readonly bracketPos: number
  ) {
    super()
  }
  eq(other: WidgetType): boolean {
    return (
      other instanceof TaskCheckboxWidget &&
      other.checked === this.checked &&
      other.bracketPos === this.bracketPos
    )
  }
  toDOM(): HTMLElement {
    const label = document.createElement('span')
    label.className = 'cm-task-checkbox'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.checked
    input.onmousedown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.view.dispatch({
        changes: { from: this.bracketPos, to: this.bracketPos + 1, insert: this.checked ? ' ' : 'x' }
      })
    }
    label.appendChild(input)
    return label
  }
  ignoreEvent(): boolean {
    return true
  }
}

interface ListFrame {
  depth: number
  ordered: boolean
  counter: number
}

/**
 * Живая подстановка стилей markdown прямо в текст редактора (Obsidian-style
 * Live Preview): синтаксические маркеры (#, **, *, `, [](), списки, чек-боксы)
 * скрываются и заменяются отрисованным видом, пока курсор/выделение не
 * коснётся их диапазона — тогда они снова показываются для редактирования
 * (чек-боксы — исключение, они остаются кликабельным виджетом всегда, как в
 * Obsidian). Правила разбора держим в одном стиле с renderMarkdown из
 * markdown.tsx — то же визуальное поведение, что и во вкладке «Просмотр».
 */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const hasFocus = view.hasFocus
  const state = view.state
  // Без фокуса раскрывать маркеры незачем — иначе позиция курсора/выделения,
  // унаследованная от предыдущего открытия (или дефолтная позиция 0 в начале
  // документа при первом монтировании), навсегда держала бы «раскрытой» ту
  // строку, на которой она случайно оказалась, даже когда редактор не активен.
  const ranges = hasFocus ? state.selection.ranges : []
  const doc = state.doc
  let calloutType: string | null = null
  let inFence = false
  let listStack: ListFrame[] = []

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
      else if (m[3] !== undefined) markPair(from, to, 2, 'cm-strike', touched)
      else if (m[4] !== undefined) markPair(from, to, 2, 'cm-highlight', touched)
      else if (m[5] !== undefined) markPair(from, to, 1, 'cm-code', touched)
      else if (m[6] !== undefined) markLink(from, to, m[6].length, touched)
      else if (m[8] !== undefined || m[9] !== undefined) markPair(from, to, 1, 'cm-italic', touched)
    }
  }

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text
    const lineTouched = touchesRange(ranges, line.from, line.to)

    if (text.trim() === '') {
      listStack = []
      continue
    }

    if (/^```/.test(text.trim())) {
      inFence = !inFence
      listStack = []
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-fence-line' }))
      continue
    }
    if (inFence) {
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-code-line' }))
      continue
    }

    const h = /^(#{1,6})(\s+)/.exec(text)
    if (h) {
      listStack = []
      const level = Math.min(h[1].length, 4)
      builder.add(line.from, line.from, Decoration.line({ class: `cm-h cm-h${level}` }))
      if (!lineTouched) builder.add(line.from, line.from + h[0].length, Decoration.replace({}))
      applyInline(text, line.from, h[0].length)
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(text.trim())) {
      listStack = []
      builder.add(line.from, line.from, Decoration.line({ class: 'cm-hr-line' }))
      continue
    }

    const q = /^>\s?/.exec(text)
    if (q) {
      listStack = []
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

    const orderedMatch = /^(\s*)(\d+)([.)])(\s+)(.*)$/.exec(text)
    const bulletMatch = !orderedMatch ? /^(\s*)([-*+])(\s+)(.*)$/.exec(text) : null
    if (orderedMatch || bulletMatch) {
      const match = (orderedMatch ?? bulletMatch)!
      const indent = match[1]
      const depth = indentDepth(indent)
      const ordered = !!orderedMatch

      while (listStack.length && listStack[listStack.length - 1].depth > depth) listStack.pop()
      const top = listStack[listStack.length - 1]
      let counter: number
      if (top && top.depth === depth && top.ordered === ordered) {
        top.counter += 1
        counter = top.counter
      } else {
        if (top && top.depth === depth) listStack.pop()
        counter = 1
        listStack.push({ depth, ordered, counter })
      }

      let markerLen: number
      let taskChecked: boolean | null = null
      let taskBracketPos = -1

      if (ordered) {
        const [, , num, punct, spaces] = orderedMatch!
        markerLen = indent.length + num.length + punct.length + spaces.length
      } else {
        const [, , marker, spaces, rest] = bulletMatch!
        const bulletLen = indent.length + marker.length + spaces.length
        const taskMatch = /^\[([ xX])\](\s+)(.*)$/.exec(rest)
        if (taskMatch) {
          taskChecked = taskMatch[1].toLowerCase() === 'x'
          taskBracketPos = line.from + bulletLen + 1
          // '[' + символ-состояние + ']' — три символа, не два.
          markerLen = bulletLen + 3 + taskMatch[2].length
        } else {
          markerLen = bulletLen
        }
      }

      const lineClass = [
        'cm-list-line',
        ordered ? 'cm-list-ordered' : 'cm-list-bullet',
        taskChecked ? 'cm-task-done' : ''
      ]
        .filter(Boolean)
        .join(' ')
      // У .cm-line по умолчанию свой встроенный padding-left:6px (дефолт
      // самого CodeMirror, см. .cm-line в devtools) — inline-стиль полностью
      // ПЕРЕЗАПИСЫВАЕТ его, а не складывается с ним, поэтому нужно явно
      // прибавлять эту базовую отступ, а не только свой по глубине вложенности
      // — иначе строки списка (depth=0) съезжают на 6px левее обычного текста.
      const BASE_LINE_PADDING_PX = 6
      builder.add(
        line.from,
        line.from,
        Decoration.line({
          class: lineClass,
          attributes: { style: `padding-left:${BASE_LINE_PADDING_PX + depth * 20}px` }
        })
      )

      if (taskChecked !== null) {
        builder.add(
          line.from,
          line.from + markerLen,
          Decoration.replace({ widget: new TaskCheckboxWidget(view, taskChecked, taskBracketPos) })
        )
      } else if (!lineTouched) {
        const widget = ordered ? new OrderedWidget(counter) : new BulletWidget(depth)
        builder.add(line.from, line.from + markerLen, Decoration.replace({ widget }))
      }

      applyInline(text, line.from, markerLen)
      continue
    }
    listStack = []

    applyInline(text, line.from, 0)
  }

  return builder.finish()
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations }
)

const LIST_LINE_RE = /^(\s*)([-*+])(\s+)(.*)$/
const ORDERED_LINE_RE = /^(\s*)(\d+)([.)])(\s+)(.*)$/

/** Enter в конце пункта списка — продолжает список (с автопереносом чек-бокса
 *  и инкрементом номера); Enter на ПУСТОМ пункте — выходит из списка. */
function continueList(view: EditorView): boolean {
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false
  const line = state.doc.lineAt(sel.head)
  if (sel.head !== line.to) return false
  const text = line.text

  const bulletMatch = LIST_LINE_RE.exec(text)
  if (bulletMatch) {
    const [, indent, marker, , rest] = bulletMatch
    const taskMatch = /^\[([ xX])\]\s+(.*)$/.exec(rest)
    const content = taskMatch ? taskMatch[2] : rest
    if (content.trim() === '') {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: '' } })
      return true
    }
    const newMarker = `${indent}${marker} ${taskMatch ? '[ ] ' : ''}`
    view.dispatch({
      changes: { from: sel.head, insert: '\n' + newMarker },
      selection: { anchor: sel.head + 1 + newMarker.length }
    })
    return true
  }

  const orderedMatch = ORDERED_LINE_RE.exec(text)
  if (orderedMatch) {
    const [, indent, num, punct, , rest] = orderedMatch
    if (rest.trim() === '') {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: '' } })
      return true
    }
    const newMarker = `${indent}${Number(num) + 1}${punct} `
    view.dispatch({
      changes: { from: sel.head, insert: '\n' + newMarker },
      selection: { anchor: sel.head + 1 + newMarker.length }
    })
    return true
  }

  return false
}

function isListLine(text: string): boolean {
  return LIST_LINE_RE.test(text) || ORDERED_LINE_RE.test(text)
}

function indentListLine(view: EditorView): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  if (!isListLine(line.text)) return false
  view.dispatch({ changes: { from: line.from, insert: '  ' } })
  return true
}

function outdentListLine(view: EditorView): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  if (!isListLine(line.text)) return false
  const m = /^(\s{1,2})/.exec(line.text)
  if (!m) return false
  view.dispatch({ changes: { from: line.from, to: line.from + m[1].length, insert: '' } })
  return true
}

const listKeymap = Prec.highest(
  keymap.of([
    { key: 'Enter', run: continueList },
    { key: 'Tab', run: indentListLine },
    { key: 'Shift-Tab', run: outdentListLine }
  ])
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
        listKeymap,
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
