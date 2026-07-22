import {
  Info,
  Lightbulb,
  AlertTriangle,
  Flame,
  CheckCircle2,
  HelpCircle,
  ListChecks,
  Quote as QuoteIcon
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * Лёгкий самописный markdown-рендер (без внешней библиотеки — заметки личные,
 * не нужен полный CommonMark). Поддерживает: заголовки, жирный/курсив/
 * зачёркнутый/выделенный текст, инлайн-код, ссылки вида [текст](url), вложенные
 * списки (- / 1.) с чек-боксами задач (- [ ] / - [x]), код-блоки в оградах из
 * обратных кавычек, разделитель ---, и Obsidian-callout'ы — цитата, первая
 * строка которой имеет вид [!note] Заголовок, тело — следующие строки цитаты.
 */

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

type Block =
  | { type: 'heading'; level: number; text: string }
  | ListBlock
  | { type: 'code'; text: string }
  | { type: 'callout'; kind: string; title: string; lines: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'hr' }
  | { type: 'p'; text: string }

const CALLOUT_META: Record<string, { icon: LucideIcon; label: string }> = {
  note: { icon: Info, label: 'Note' },
  info: { icon: Info, label: 'Info' },
  tip: { icon: Lightbulb, label: 'Tip' },
  hint: { icon: Lightbulb, label: 'Hint' },
  success: { icon: CheckCircle2, label: 'Success' },
  check: { icon: CheckCircle2, label: 'Check' },
  done: { icon: CheckCircle2, label: 'Done' },
  warning: { icon: AlertTriangle, label: 'Warning' },
  caution: { icon: AlertTriangle, label: 'Caution' },
  danger: { icon: Flame, label: 'Danger' },
  error: { icon: Flame, label: 'Error' },
  failure: { icon: Flame, label: 'Failure' },
  question: { icon: HelpCircle, label: 'Question' },
  faq: { icon: HelpCircle, label: 'FAQ' },
  example: { icon: ListChecks, label: 'Example' },
  quote: { icon: QuoteIcon, label: 'Quote' },
  cite: { icon: QuoteIcon, label: 'Cite' }
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
          title: calloutMatch[2] || CALLOUT_META[kind]?.label || calloutMatch[1],
          lines: qLines.slice(1).filter((l) => l.trim() !== '')
        })
      } else {
        blocks.push({ type: 'quote', lines: qLines })
      }
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

/** Инлайн-форматирование внутри строки: жирный, курсив, зачёркнутый,
 *  выделенный, код, [текст](url). */
function renderInline(text: string): JSX.Element {
  const re =
    /(\*\*([^*]+)\*\*|~~([^~]+)~~|==([^=]+)==|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*|_([^_]+)_)/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    if (m[2] !== undefined) parts.push(<strong key={key++}>{m[2]}</strong>)
    else if (m[3] !== undefined) parts.push(<del key={key++}>{m[3]}</del>)
    else if (m[4] !== undefined) parts.push(<mark key={key++}>{m[4]}</mark>)
    else if (m[5] !== undefined) parts.push(<code key={key++}>{m[5]}</code>)
    else if (m[6] !== undefined)
      parts.push(
        <a key={key++} href={m[7]} target="_blank" rel="noreferrer">
          {m[6]}
        </a>
      )
    else if (m[8] !== undefined) parts.push(<em key={key++}>{m[8]}</em>)
    else if (m[9] !== undefined) parts.push(<em key={key++}>{m[9]}</em>)
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

function renderList(block: ListBlock, key: number | string): JSX.Element {
  const Tag = block.ordered ? 'ol' : 'ul'
  return (
    <Tag key={key}>
      {block.items.map((it, j) => (
        <li key={j} className={it.task !== 'none' ? `md-task-item${it.task === 'checked' ? ' md-task-done' : ''}` : undefined}>
          {it.task !== 'none' && <input type="checkbox" checked={it.task === 'checked'} disabled readOnly />}
          <span>{renderInline(it.text)}</span>
          {it.children.map((child, k) => renderList(child, `${key}-${k}`))}
        </li>
      ))}
    </Tag>
  )
}

export function renderMarkdown(src: string): JSX.Element {
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
            return <Tag key={i}>{renderInline(b.text)}</Tag>
          }
          case 'hr':
            return <hr key={i} />
          case 'list':
            return renderList(b, i)
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
                  <p key={j}>{renderInline(l)}</p>
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
                  <p key={j}>{renderInline(l)}</p>
                ))}
              </div>
            )
          }
          case 'p':
          default:
            return <p key={i}>{renderInline(b.text)}</p>
        }
      })}
    </div>
  )
}
