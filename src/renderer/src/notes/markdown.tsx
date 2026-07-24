import { useEffect, useState } from 'react'
import {
  Pencil,
  ClipboardList,
  Info,
  CheckCircle2,
  Flame,
  Check,
  HelpCircle,
  AlertTriangle,
  X,
  Zap,
  Bug,
  List,
  Quote as QuoteIcon,
  Lightbulb,
  ImageOff
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Лёгкий самописный markdown-рендер (без внешней библиотеки — заметки личные,
 * не нужен полный CommonMark). Поддерживает: заголовки, жирный/курсив/
 * зачёркнутый/выделенный текст, инлайн-код, ссылки [текст](url), картинки
 * ![alt](url), вики-ссылки [[Заметка]]/[[Заметка|текст]] и вики-эмбеды
 * ![[картинка.png]], таблицы, вложенные списки (- / 1.) с чек-боксами задач
 * (- [ ] / - [x]), код-блоки в оградах из обратных кавычек, разделитель ---,
 * и Obsidian-callout'ы — цитата, первая строка которой имеет вид
 * [!note] Заголовок, тело — следующие строки цитаты.
 */

export interface MarkdownContext {
  /** Резолвит заголовок вики-ссылки/эмбеда в реальный узел дерева — по
   *  noteTitle (или title, если своего заголовка заметки нет). Без него
   *  вики-ссылки рисуются как обычный (нерезолвленный) текст. */
  resolveLink?: (title: string) => { id: string; title: string } | null
  /** Переход к узлу по клику на резолвленную вики-ссылку. */
  onNavigate?: (id: string) => void
  /** Директория дерева — нужна, чтобы резолвить относительные пути эмбедов
   *  изображений (![[img.png]] и ![alt](img.png)) в реальный файл на диске
   *  через IPC (см. window.api.readNoteImage). Без неё такие эмбеды рисуются
   *  как подпись с именем файла. */
  rootDir?: string | null
}

interface ListItem {
  text: string
  task: 'none' | 'unchecked' | 'checked'
  children: ListBlock[]
}
interface ListBlock {
  type: 'list'
  ordered: boolean
  items: ListItem[]
}
interface TableBlock {
  type: 'table'
  header: string[]
  align: (Align | null)[]
  rows: string[][]
}
type Align = 'left' | 'center' | 'right'

type Block =
  | { type: 'heading'; level: number; text: string }
  | ListBlock
  | TableBlock
  | { type: 'code'; text: string }
  | { type: 'callout'; kind: string; title: string; lines: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'p'; text: string }

/** Палитра и иконки — реальные дефолты Obsidian (сгруппированы по тем же
 *  цветам, что и в самом Obsidian: note/info/todo — синий, abstract/tip —
 *  циан, success — зелёный, question/warning — оранжевый, danger/failure/
 *  bug — красный, example — фиолетовый, quote — серый), плюс один кастомный
 *  каллаут — [!idea], реально настроенный в Callout Manager пользователя
 *  (иконка lucide-lightbulb, цвет rgb(233, 151, 63)). Сами цвета — в
 *  styles.css (.md-callout-*), здесь только иконка и дефолтный заголовок
 *  (когда после [!kind] на той же строке ничего не написано). */
export const CALLOUT_META: Record<string, { icon: LucideIcon; label: string }> = {
  note: { icon: Pencil, label: 'Note' },
  abstract: { icon: ClipboardList, label: 'Abstract' },
  summary: { icon: ClipboardList, label: 'Summary' },
  tldr: { icon: ClipboardList, label: 'TLDR' },
  info: { icon: Info, label: 'Info' },
  todo: { icon: CheckCircle2, label: 'Todo' },
  tip: { icon: Flame, label: 'Tip' },
  hint: { icon: Flame, label: 'Hint' },
  important: { icon: Flame, label: 'Important' },
  success: { icon: Check, label: 'Success' },
  check: { icon: Check, label: 'Check' },
  done: { icon: Check, label: 'Done' },
  question: { icon: HelpCircle, label: 'Question' },
  help: { icon: HelpCircle, label: 'Help' },
  faq: { icon: HelpCircle, label: 'FAQ' },
  warning: { icon: AlertTriangle, label: 'Warning' },
  caution: { icon: AlertTriangle, label: 'Caution' },
  attention: { icon: AlertTriangle, label: 'Attention' },
  failure: { icon: X, label: 'Failure' },
  fail: { icon: X, label: 'Fail' },
  missing: { icon: X, label: 'Missing' },
  danger: { icon: Zap, label: 'Danger' },
  error: { icon: Zap, label: 'Error' },
  bug: { icon: Bug, label: 'Bug' },
  example: { icon: List, label: 'Example' },
  quote: { icon: QuoteIcon, label: 'Quote' },
  cite: { icon: QuoteIcon, label: 'Cite' },
  idea: { icon: Lightbulb, label: 'Idea' }
}

/** «Заголовок по умолчанию» для каллаута — если после [!kind] в той же
 *  строке ничего не написано: реальный лейбл, если kind известен, иначе имя
 *  самого kind с заглавной буквы (а не голый нижний регистр из regexp). */
export function calloutFallbackTitle(kind: string, raw: string): string {
  const meta = CALLOUT_META[kind]
  if (meta) return meta.label
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line)
}
function isQuote(line: string): boolean {
  return /^>\s?/.test(line)
}
function isFence(line: string): boolean {
  return line.trim().startsWith('```')
}
function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
}
/** Строка таблицы — содержит хотя бы один `|` (грубо, но commonmark-таблицы
 *  без хотя бы одного разделителя в принципе не бывают). */
function isTableRow(line: string): boolean {
  return line.trim() !== '' && line.includes('|')
}
/** Строка-разделитель заголовка таблицы: `| --- | :---: | ---: |` (пайпы по
 *  краям необязательны). */
function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)
}
function splitTableRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((c) => c.trim())
}
function parseAlign(cell: string): Align | null {
  const left = cell.startsWith(':')
  const right = cell.endsWith(':')
  if (left && right) return 'center'
  if (right) return 'right'
  if (left) return 'left'
  return null
}

/** Строка-пункт списка (маркированного или нумерованного), с учётом отступа
 *  вложенности — табы считаются как 2 пробела, тот же счёт, что и в
 *  LiveMarkdownEditor.tsx, чтобы вложенность в редакторе и превью совпадала. */
function listLineInfo(line: string): { indent: number; ordered: boolean; text: string } | null {
  const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
  if (!m) return null
  return { indent: m[1].replace(/\t/g, '  ').length, ordered: /^\d/.test(m[2]), text: m[3] }
}

function parseList(lines: string[], start: number, levelIndent: number): { block: ListBlock; next: number } {
  const first = listLineInfo(lines[start])!
  const ordered = first.ordered
  const items: ListItem[] = []
  let i = start
  while (i < lines.length) {
    const info = listLineInfo(lines[i])
    if (!info || info.indent < levelIndent) break
    if (info.indent > levelIndent) {
      if (items.length === 0) break
      const { block, next } = parseList(lines, i, info.indent)
      items[items.length - 1].children.push(block)
      i = next
      continue
    }
    if (info.ordered !== ordered) break
    const taskMatch = /^\[([ xX])\]\s+(.*)$/.exec(info.text)
    items.push({
      text: taskMatch ? taskMatch[2] : info.text,
      task: taskMatch ? (taskMatch[1].toLowerCase() === 'x' ? 'checked' : 'unchecked') : 'none',
      children: []
    })
    i++
  }
  return { block: { type: 'list', ordered, items }, next: i }
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    if (isFence(line)) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !isFence(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      i++ // закрывающий ```
      blocks.push({ type: 'code', text: codeLines.join('\n') })
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, text: h[2] })
      i++
      continue
    }
    if (isHr(line)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }
    if (isQuote(line)) {
      const qLines: string[] = []
      while (i < lines.length && isQuote(lines[i])) {
        qLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      const calloutMatch = /^\[!([\w-]+)\]\s*(.*)$/.exec(qLines[0] ?? '')
      if (calloutMatch) {
        const kind = calloutMatch[1].toLowerCase()
        blocks.push({
          type: 'callout',
          kind,
          title: calloutMatch[2] || calloutFallbackTitle(kind, calloutMatch[1]),
          lines: qLines.slice(1).filter((l) => l.trim() !== '')
        })
      } else {
        blocks.push({ type: 'quote', lines: qLines })
      }
      continue
    }
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitTableRow(line)
      const align = splitTableRow(lines[i + 1]).map(parseAlign)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
        rows.push(splitTableRow(lines[i]))
        i++
      }
      blocks.push({ type: 'table', header, align, rows })
      continue
    }
    const info = listLineInfo(line)
    if (info) {
      const { block, next } = parseList(lines, i, info.indent)
      blocks.push(block)
      i = next
      continue
    }
    const pLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isHeading(lines[i]) &&
      !isQuote(lines[i]) &&
      !listLineInfo(lines[i]) &&
      !isFence(lines[i]) &&
      !isHr(lines[i])
    ) {
      pLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', text: pLines.join(' ') })
  }
  return blocks
}

// Порядок альтернатив важен: более специфичные/длинные конструкции раньше
// более общих, иначе они частично «съедаются» — ! [[эмбед]] должен
// проверяться раньше [[вики-ссылки]] (иначе ведущий ! достанется тексту
// снаружи, а [[...]] распарсится отдельно), а ![картинка](url) — раньше
// обычной [ссылки](url) по той же причине (см. историю бага с эмбедами).
const INLINE_RE = new RegExp(
  [
    '(?<bold>\\*\\*(?<boldText>[^*]+)\\*\\*)',
    '(?<strike>~~(?<strikeText>[^~]+)~~)',
    '(?<mark>==(?<markText>[^=]+)==)',
    '(?<code>`(?<codeText>[^`]+)`)',
    '(?<embed>!\\[\\[(?<embedTarget>[^\\]|]+)(?:\\|(?<embedAlt>[^\\]]+))?\\]\\])',
    '(?<wikilink>\\[\\[(?<wikiTarget>[^\\]|]+)(?:\\|(?<wikiAlias>[^\\]]+))?\\]\\])',
    '(?<image>!\\[(?<imgAlt>[^\\]]*)\\]\\((?<imgUrl>[^)]+)\\))',
    '(?<link>\\[(?<linkText>[^\\]]+)\\]\\((?<linkUrl>[^)]+)\\))',
    '(?<italicStar>\\*(?<italicStarText>[^*]+)\\*)',
    '(?<italicUnd>_(?<italicUndText>[^_]+)_)'
  ].join('|'),
  'g'
)

function isAbsoluteUrl(url: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(url) || url.startsWith('data:')
}

/** Эмбед изображения (вики ![[img.png]] или относительный путь в обычном
 *  ![alt](img.png)) — грузит файл асинхронно через IPC (см.
 *  window.api.readNoteImage), т.к. чистая функция renderMarkdown не может
 *  сходить на диск сама. Пока грузится — подпись с именем файла; если файла
 *  нет (или неизвестна rootDir) — «битый» эмбед, тем же визуальным языком,
 *  что и нерезолвленная вики-ссылка. */
function NoteImageEmbed({
  src,
  alt,
  rootDir
}: {
  src: string
  alt: string
  rootDir: string | null | undefined
}): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setDataUrl(null)
    setFailed(false)
    if (!rootDir) {
      setFailed(true)
      return
    }
    window.api.readNoteImage(rootDir, src.trim()).then((d) => {
      if (!alive) return
      if (d) setDataUrl(d)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [src, rootDir])

  if (failed) {
    return (
      <span className="md-embed-broken" title={`Изображение «${src}» не найдено`}>
        <ImageOff size={13} /> {alt || src}
      </span>
    )
  }
  if (!dataUrl) {
    return <span className="md-embed-loading">{alt || src}…</span>
  }
  return <img className="md-embed-image" src={dataUrl} alt={alt || src} />
}

function renderImage(url: string, alt: string, ctx: MarkdownContext | undefined, key: number): JSX.Element {
  if (isAbsoluteUrl(url)) {
    return <img key={key} className="md-embed-image" src={url} alt={alt} />
  }
  return <NoteImageEmbed key={key} src={url} alt={alt} rootDir={ctx?.rootDir} />
}

/** Вики-ссылка [[Заголовок]] / [[Заголовок|текст]] — резолвится по заголовку
 *  заметки среди ВСЕХ узлов дерева (см. findItemByNoteTitle в domain.ts,
 *  ctx.resolveLink). Резолвится — кликабельная ссылка, переходящая к узлу
 *  (ctx.onNavigate); нет — просто помечается как «битая» ссылка тем же
 *  визуальным языком, что и в Obsidian (не рвём рендер, не прячем текст). */
function renderWikiLink(
  target: string,
  alias: string | undefined,
  ctx: MarkdownContext | undefined,
  key: number
): JSX.Element {
  const label = (alias ?? target).trim()
  const resolved = ctx?.resolveLink?.(target.trim())
  if (!resolved) {
    return (
      <span key={key} className="md-wikilink md-wikilink-broken" title={`Заметка «${target.trim()}» не найдена`}>
        {label}
      </span>
    )
  }
  return (
    <a
      key={key}
      className="md-wikilink"
      href="#"
      onClick={(e) => {
        e.preventDefault()
        ctx?.onNavigate?.(resolved.id)
      }}
    >
      {label}
    </a>
  )
}

/** Инлайн-форматирование внутри строки: жирный, курсив, зачёркнутый,
 *  выделенный, код, ссылки/картинки, вики-ссылки/эмбеды. */
function renderInline(text: string, ctx?: MarkdownContext): JSX.Element {
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  let key = 0
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text))) {
    const g = m.groups!
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    if (g.bold !== undefined) parts.push(<strong key={key++}>{g.boldText}</strong>)
    else if (g.strike !== undefined) parts.push(<del key={key++}>{g.strikeText}</del>)
    else if (g.mark !== undefined) parts.push(<mark key={key++}>{g.markText}</mark>)
    else if (g.code !== undefined) parts.push(<code key={key++}>{g.codeText}</code>)
    else if (g.embed !== undefined)
      parts.push(
        <NoteImageEmbed key={key++} src={g.embedTarget} alt={g.embedAlt ?? g.embedTarget} rootDir={ctx?.rootDir} />
      )
    else if (g.wikilink !== undefined) parts.push(renderWikiLink(g.wikiTarget, g.wikiAlias, ctx, key++))
    else if (g.image !== undefined) parts.push(renderImage(g.imgUrl, g.imgAlt, ctx, key++))
    else if (g.link !== undefined)
      parts.push(
        <a key={key++} href={g.linkUrl} target="_blank" rel="noreferrer">
          {g.linkText}
        </a>
      )
    else if (g.italicStar !== undefined) parts.push(<em key={key++}>{g.italicStarText}</em>)
    else if (g.italicUnd !== undefined) parts.push(<em key={key++}>{g.italicUndText}</em>)
    lastIndex = INLINE_RE.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function renderList(block: ListBlock, key: number | string, ctx: MarkdownContext | undefined): JSX.Element {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <Tag key={key}>
      {block.items.map((it, j) => (
        <li key={j} className={it.task !== 'none' ? `md-task-item${it.task === 'checked' ? ' md-task-done' : ''}` : undefined}>
          {it.task !== 'none' && <input type="checkbox" checked={it.task === 'checked'} disabled readOnly />}
          <span>{renderInline(it.text, ctx)}</span>
          {it.children.map((child, k) => renderList(child, `${key}-${k}`, ctx))}
        </li>
      ))}
    </Tag>
  )
}

function renderTable(b: TableBlock, key: number, ctx: MarkdownContext | undefined): JSX.Element {
  return (
    <div key={key} className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>
            {b.header.map((h, j) => (
              <th key={j} style={b.align[j] ? { textAlign: b.align[j]! } : undefined}>
                {renderInline(h, ctx)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {b.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci} style={b.align[ci] ? { textAlign: b.align[ci]! } : undefined}>
                  {renderInline(c, ctx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function renderMarkdown(src: string, ctx?: MarkdownContext): JSX.Element {
  const blocks = parseBlocks(src)
  if (blocks.length === 0) {
    return <p className="dim small">Пусто.</p>
  }
  return (
    <div className="md-preview">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading': {
            const level = Math.min(b.level, 4)
            const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
            return <Tag key={i}>{renderInline(b.text, ctx)}</Tag>
          }
          case 'hr':
            return <hr key={i} />
          case 'list':
            return renderList(b, i, ctx)
          case 'table':
            return renderTable(b, i, ctx)
          case 'code':
            return (
              <pre key={i}>
                <code>{b.text}</code>
              </pre>
            )
          case 'quote':
            return (
              <blockquote key={i}>
                {b.lines.map((l, j) => (
                  <p key={j}>{renderInline(l, ctx)}</p>
                ))}
              </blockquote>
            )
          case 'callout': {
            const meta = CALLOUT_META[b.kind] ?? CALLOUT_META.note
            const Icon = meta.icon
            return (
              <div key={i} className={`md-callout md-callout-${b.kind in CALLOUT_META ? b.kind : 'note'}`}>
                <div className="md-callout-title">
                  <Icon size={14} /> {b.title}
                </div>
                {b.lines.map((l, j) => (
                  <p key={j}>{renderInline(l, ctx)}</p>
                ))}
              </div>
            )
          }
          case 'p':
          default:
            return <p key={i}>{renderInline(b.text, ctx)}</p>
        }
      })}
    </div>
  )
}
