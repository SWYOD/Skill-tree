import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  CirclePlus,
  Trash2,
  GitBranch,
  Circle,
  Boxes,
  Settings,
  MoreVertical,
  Pencil,
  Link2,
  Eye,
  EyeOff
} from 'lucide-react'
import { useTree } from '../store/treeStore'
import { buildMaps, ancestorsOf, colorFor } from '../domain'
import type { Item, ItemKind } from '@shared/types'
import { SettingsPanel } from './SettingsPanel'
import { BranchIcon } from '../components/BranchIcon'

type DropPos = 'before' | 'after' | 'inside'
interface DropTarget {
  id: string
  pos: DropPos
}

/** Собрать id всех веток и групп — контейнеров, которые кнопка «Свернуть всё»
 *  в шапке дерева схлопывает/разворачивает разом. */
function allCollapsibleIds(items: Item[]): string[] {
  return items.filter((i) => i.kind === 'branch' || i.kind === 'group').map((i) => i.id)
}

const KIND_META: Record<ItemKind, { label: string; icon: (size: number, color?: string) => JSX.Element }> = {
  branch: { label: 'веткой', icon: (size, color) => <GitBranch size={size} color={color} /> },
  node: { label: 'узлом', icon: (size, color) => <Circle size={size} color={color} fill={color} opacity={0.5} /> },
  group: { label: 'группой', icon: (size, color) => <Boxes size={size} color={color} /> }
}

/** Плоский порядок ВИДИМЫХ строк дерева (сверху вниз, с учётом свёрнутых веток) —
 *  нужен для диапазонного выделения по Shift. */
function flattenVisible(
  roots: Item[],
  maps: ReturnType<typeof buildMaps>,
  collapsed: Set<string>
): string[] {
  const out: string[] = []
  function walk(item: Item): void {
    out.push(item.id)
    if (collapsed.has(item.id)) return
    for (const c of maps.childrenOf.get(item.id) ?? []) walk(c)
  }
  for (const r of roots) walk(r)
  return out
}

export function LeftPanel(): JSX.Element {
  const tree = useTree((s) => s.tree)
  const addBranch = useTree((s) => s.addBranch)
  const addGroup = useTree((s) => s.addGroup)
  const groupItems = useTree((s) => s.groupItems)
  const moveItems = useTree((s) => s.moveItems)
  const deleteItems = useTree((s) => s.deleteItems)
  const select = useTree((s) => s.select)
  const [showSettings, setShowSettings] = useState(false)
  /** Свёрнутые ветки/узлы — в сторе (не локальный useState), чтобы граф тоже
   *  скрывал те же поддеревья, что свёрнуты в дереве слева. */
  const collapsed = useTree((s) => s.collapsed)
  const setCollapsed = useTree((s) => s.setCollapsed)
  /** Опциональная связь сворачивания графа с этим деревом — по умолчанию
   *  выключена (см. graphTreeLinked в сторе и GraphCanvas.tsx). */
  const graphTreeLinked = useTree((s) => s.graphTreeLinked)
  const setGraphTreeLinked = useTree((s) => s.setGraphTreeLinked)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [dragIds, setDragIds] = useState<string[]>([])
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  /** Мультивыделение (Ctrl/Cmd + Shift) — в сторе (не локальный useState), чтобы
   *  граф тоже мог подсвечивать те же элементы, что выделены в дереве. */
  const multiSelected = useTree((s) => s.multiSelected)
  const setMultiSelected = useTree((s) => s.setMultiSelected)
  const anchorRef = useRef<string | null>(null)

  const revealNonce = useTree((s) => s.revealNonce)
  const revealRequestId = useTree((s) => s.revealRequestId)

  const items = tree?.items ?? []
  const maps = buildMaps(items)
  const roots = maps.childrenOf.get(null) ?? []
  const collapsibleIds = allCollapsibleIds(items)
  // Если хоть один контейнер (ветка/группа) развёрнут — следующий клик всё сворачивает, и наоборот.
  const anyExpanded = collapsibleIds.some((id) => !collapsed.has(id))

  function handleItemClick(item: Item, e: React.MouseEvent): void {
    if (e.shiftKey && anchorRef.current) {
      const flat = flattenVisible(roots, maps, collapsed)
      const ai = flat.indexOf(anchorRef.current)
      const bi = flat.indexOf(item.id)
      if (ai !== -1 && bi !== -1) {
        const [from, to] = ai < bi ? [ai, bi] : [bi, ai]
        setMultiSelected(new Set(flat.slice(from, to + 1)))
      }
      select(item.id)
      return
    }
    if (e.metaKey || e.ctrlKey) {
      setMultiSelected((prev) => {
        const next = new Set(prev)
        if (next.has(item.id)) next.delete(item.id)
        else next.add(item.id)
        return next
      })
      anchorRef.current = item.id
      select(item.id)
      return
    }
    setMultiSelected(new Set())
    anchorRef.current = item.id
    select(item.id)
  }

  // Delete/Backspace с мультивыделением — массовое удаление; Ctrl/Cmd+G —
  // сгруппировать мультивыделение. Игнорируем, если фокус в поле ввода
  // (переименование, чеклист и т.п.), чтобы не перехватывать обычное редактирование текста.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (multiSelected.size === 0) return
      const active = document.activeElement as HTMLElement | null
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return
      }
      if (e.key === 'Delete') {
        if (confirm(`Удалить выбранные элементы (${multiSelected.size}) и всё вложенное?`)) {
          deleteItems([...multiSelected])
          setMultiSelected(new Set())
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        if (multiSelected.size > 1) groupItems([...multiSelected])
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [multiSelected, deleteItems, groupItems])

  // Двойной клик по узлу/ветке в графе (requestReveal) — раскрыть путь к нему
  // в дереве слева и проскроллить к элементу. Отдельно от обычного select,
  // чтобы простой клик не дёргал раскрытие/скролл дерева.
  useEffect(() => {
    if (!revealRequestId) return
    const ancestors = ancestorsOf(revealRequestId, maps)
    if (ancestors.length > 0) {
      setCollapsed((prev) => {
        if (!ancestors.some((a) => prev.has(a))) return prev
        const next = new Set(prev)
        for (const a of ancestors) next.delete(a)
        return next
      })
    }
    // Двойной rAF: ждём, пока React закоммитит развёрнутые ветки в DOM
    // (после setCollapsed), иначе элемент ещё не существует для scrollIntoView.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-item-id="${revealRequestId}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNonce])

  // Закрыть контекстное меню по клику вне его.
  useEffect(() => {
    if (!menuFor) return
    const onDocClick = (e: MouseEvent): void => {
      if (!(e.target as Element).closest('.item-menu, .item-menu-btn')) setMenuFor(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuFor])

  // Закрыть попап настроек по клику вне его (клод-стайл: не разворачивающаяся
  // панель, а плавающий попап поверх контента).
  useEffect(() => {
    if (!showSettings) return
    const onDocClick = (e: MouseEvent): void => {
      if (!(e.target as Element).closest('.settings-popup, .settings-toggle')) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showSettings])

  function handleDrop(targetItem: Item, pos: DropPos): void {
    if (dragIds.length === 0 || dragIds.includes(targetItem.id)) return
    const dragSet = new Set(dragIds)
    if (pos === 'inside') {
      const siblings = (maps.childrenOf.get(targetItem.id) ?? []).filter((c) => !dragSet.has(c.id))
      moveItems(dragIds, targetItem.id, siblings.length)
    } else {
      const siblings = (maps.childrenOf.get(targetItem.parentId) ?? []).filter(
        (c) => !dragSet.has(c.id)
      )
      const idx = siblings.findIndex((s) => s.id === targetItem.id)
      moveItems(dragIds, targetItem.parentId, pos === 'before' ? idx : idx + 1)
    }
    setDragIds([])
    setDropTarget(null)
  }

  return (
    <div className="panel left-panel">
      <div className="panel-head">
        <span className="panel-title">Дерево навыков</span>
        <span className="panel-head-actions">
          <button
            className={`icon-btn${graphTreeLinked ? ' active glow' : ''}`}
            title={
              graphTreeLinked
                ? 'Сворачивание графа и дерева связано — нажмите, чтобы разделить'
                : 'Связать сворачивание графа с деревом'
            }
            onClick={() => setGraphTreeLinked(!graphTreeLinked)}
          >
            <Link2 size={15} />
          </button>
          <button
            className="icon-btn"
            title={anyExpanded ? 'Свернуть всё' : 'Развернуть всё'}
            onClick={() => setCollapsed(anyExpanded ? new Set(collapsibleIds) : new Set())}
          >
            {anyExpanded ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
          </button>
          <button className="icon-btn" title="Добавить ветку" onClick={() => addBranch()}>
            <BranchIcon size={16} />
          </button>
          <button className="icon-btn" title="Добавить группу" onClick={() => addGroup()}>
            <Boxes size={16} />
          </button>
        </span>
      </div>

      <div
        className="tree-scroll"
        onClick={(e) => {
          if (e.target === e.currentTarget) setMultiSelected(new Set())
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          // Дроп на пустое место — перенести в корень, в конец.
          if (e.target === e.currentTarget && dragIds.length > 0) {
            const dragSet = new Set(dragIds)
            const rootSiblings = (maps.childrenOf.get(null) ?? []).filter((c) => !dragSet.has(c.id))
            moveItems(dragIds, null, rootSiblings.length)
            setDragIds([])
            setDropTarget(null)
          }
        }}
      >
        {roots.length === 0 && (
          <div className="dim small pad">Нет веток. Нажмите «+» чтобы создать.</div>
        )}
        {roots.map((r) => (
          <TreeRow
            key={r.id}
            item={r}
            depth={0}
            maps={maps}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            menuFor={menuFor}
            setMenuFor={setMenuFor}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
            dragIds={dragIds}
            setDragIds={setDragIds}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            onDropAt={handleDrop}
            multiSelected={multiSelected}
            onItemClick={handleItemClick}
          />
        ))}
      </div>

      <div className="settings-anchor">
        <button className="settings-toggle" onClick={() => setShowSettings((v) => !v)}>
          <Settings size={15} /> Настройки
        </button>
        {showSettings && <SettingsPanel />}
      </div>
    </div>
  )
}

interface TreeRowProps {
  item: Item
  depth: number
  maps: ReturnType<typeof buildMaps>
  collapsed: Set<string>
  setCollapsed: (s: Set<string>) => void
  menuFor: string | null
  setMenuFor: (id: string | null) => void
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  dragIds: string[]
  setDragIds: (ids: string[]) => void
  dropTarget: DropTarget | null
  setDropTarget: (t: DropTarget | null) => void
  onDropAt: (item: Item, pos: DropPos) => void
  multiSelected: Set<string>
  onItemClick: (item: Item, e: React.MouseEvent) => void
}

function TreeRow({
  item,
  depth,
  maps,
  collapsed,
  setCollapsed,
  menuFor,
  setMenuFor,
  renamingId,
  setRenamingId,
  dragIds,
  setDragIds,
  dropTarget,
  setDropTarget,
  onDropAt,
  multiSelected,
  onItemClick
}: TreeRowProps): JSX.Element {
  const selectedId = useTree((s) => s.selectedId)
  const addChild = useTree((s) => s.addChild)
  const deleteItem = useTree((s) => s.deleteItem)
  const deleteItems = useTree((s) => s.deleteItems)
  const setMultiSelected = useTree((s) => s.setMultiSelected)
  const updateItem = useTree((s) => s.updateItem)
  const changeKind = useTree((s) => s.changeKind)
  const groupItems = useTree((s) => s.groupItems)
  const setHidden = useTree((s) => s.setHidden)

  const children = maps.childrenOf.get(item.id) ?? []
  const hasChildren = children.length > 0
  const isBranch = item.kind === 'branch'
  // Раньше — только item.color (обычно есть лишь у веток), листья без
  // своего цвета показывали кружок нейтральным currentColor: в тёмной теме
  // это давало невзрачный светлый кружок, а в светлой — заметный тёмный
  // «залитый» кружок (то, на что пожаловался пользователь). colorFor
  // наследует цвет ближайшей ветки — та же логика, что уже красит граф.
  const color = colorFor(item, maps)
  const open = !collapsed.has(item.id)
  const isRenaming = renamingId === item.id
  const isDropTarget = dropTarget?.id === item.id
  const [draft, setDraft] = useState(item.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      setDraft(item.title)
      requestAnimationFrame(() => inputRef.current?.select())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenaming])

  function toggleOpen(): void {
    const next = new Set(collapsed)
    if (open) next.add(item.id)
    else next.delete(item.id)
    setCollapsed(next)
  }

  function commitRename(): void {
    const title = draft.trim()
    if (title) updateItem(item.id, { title })
    setRenamingId(null)
  }

  return (
    <div>
      <div
        className={`tree-row${selectedId === item.id ? ' selected' : ''}${
          multiSelected.has(item.id) ? ' multi-selected' : ''
        }${isDropTarget ? ` drop-${dropTarget!.pos}` : ''}${
          dragIds.includes(item.id) ? ' dragging' : ''
        }${item.hidden ? ' item-hidden' : ''}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        data-item-id={item.id}
        draggable={!isRenaming}
        onClick={(e) => onItemClick(item, e)}
        onContextMenu={(e) => {
          e.preventDefault()
          // На macOS Chromium/Electron Ctrl+клик не всегда доходит как обычный
          // click (интерпретируется как «правая кнопка» — прилетает contextmenu
          // с ctrlKey=true) — это по-прежнему только мультивыделение, без меню.
          if (e.ctrlKey) {
            onItemClick(item, e)
            return
          }
          // Обычный правый клик — открыть то же меню действий, что и «⋮»
          // (переименовать/сменить тип/сгруппировать/удалить). Клик по элементу
          // вне текущего мультивыделения сначала выделяет именно его.
          if (!multiSelected.has(item.id)) onItemClick(item, e)
          setMenuFor(item.id)
        }}
        onDragStart={(e) => {
          e.stopPropagation()
          e.dataTransfer.effectAllowed = 'move'
          // Если тянем элемент из мультивыделения — везём весь набор, иначе только его.
          const ids = multiSelected.has(item.id) && multiSelected.size > 1 ? [...multiSelected] : [item.id]
          setDragIds(ids)
        }}
        onDragEnd={() => {
          setDragIds([])
          setDropTarget(null)
        }}
        onDragOver={(e) => {
          if (dragIds.length === 0 || dragIds.includes(item.id)) return
          e.preventDefault()
          e.stopPropagation()
          const rect = e.currentTarget.getBoundingClientRect()
          const relY = (e.clientY - rect.top) / rect.height
          // Ветка и группа принимают что угодно, включая другие ветки; узел —
          // только узлы/группы. При мультивыделении «внутрь» узла доступно
          // только если среди перетаскиваемых нет ни одной ветки.
          const acceptsAnyKind = isBranch || item.kind === 'group'
          const canNestInside =
            acceptsAnyKind || dragIds.every((id) => maps.byId.get(id)?.kind !== 'branch')
          let pos: DropPos
          if (canNestInside && relY > 0.25 && relY < 0.75) pos = 'inside'
          else pos = relY <= 0.5 ? 'before' : 'after'
          setDropTarget({ id: item.id, pos })
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (dropTarget?.id === item.id) onDropAt(item, dropTarget.pos)
        }}
      >
        <span
          className="tree-caret"
          onClick={(e) => {
            e.stopPropagation()
            toggleOpen()
          }}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span style={{ width: 14, display: 'inline-block' }} />
          )}
        </span>
        {isBranch ? (
          <GitBranch size={14} color={color} />
        ) : item.kind === 'group' ? (
          <Boxes size={13} color={color} />
        ) : (
          <Circle size={11} color={color} fill={color} opacity={0.5} />
        )}

        {isRenaming ? (
          <input
            ref={inputRef}
            className="tree-rename-input"
            value={draft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenamingId(null)
            }}
          />
        ) : (
          <span className="tree-label">{item.title}</span>
        )}

        <span className="tree-actions">
          {(isBranch || item.kind === 'group') && (
            <button
              className="icon-btn xs"
              title="Добавить под-ветку"
              onClick={(e) => {
                e.stopPropagation()
                addChild(item.id, 'branch')
              }}
            >
              <BranchIcon size={13} />
            </button>
          )}
          <button
            className="icon-btn xs"
            title="Добавить узел"
            onClick={(e) => {
              e.stopPropagation()
              addChild(item.id, 'node')
            }}
          >
            <CirclePlus size={13} />
          </button>
          <button
            className="icon-btn xs"
            title="Добавить группу"
            onClick={(e) => {
              e.stopPropagation()
              addChild(item.id, 'group')
            }}
          >
            <Boxes size={13} />
          </button>
          <button
            className="icon-btn xs"
            title={item.hidden ? 'Показать на графе' : 'Скрыть с графа'}
            onClick={(e) => {
              e.stopPropagation()
              setHidden(item.id, !item.hidden)
            }}
          >
            {item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <span style={{ position: 'relative' }}>
            <button
              className="icon-btn xs item-menu-btn"
              title="Ещё"
              onClick={(e) => {
                e.stopPropagation()
                setMenuFor(menuFor === item.id ? null : item.id)
              }}
            >
              <MoreVertical size={13} />
            </button>
            {menuFor === item.id && (
              <div className="item-menu" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    setRenamingId(item.id)
                    setMenuFor(null)
                  }}
                >
                  <Pencil size={13} /> Переименовать
                </button>
                {multiSelected.size > 1 && multiSelected.has(item.id) && (
                  <button
                    onClick={() => {
                      groupItems([...multiSelected])
                      setMenuFor(null)
                    }}
                  >
                    <Boxes size={13} /> Сгруппировать выделенное ({multiSelected.size})
                  </button>
                )}
                {(['branch', 'node', 'group'] as ItemKind[])
                  .filter((k) => k !== item.kind)
                  .map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        changeKind(item.id, k)
                        setMenuFor(null)
                      }}
                    >
                      {KIND_META[k].icon(13)} Сделать {KIND_META[k].label}
                    </button>
                  ))}
                <button
                  className="danger"
                  onClick={() => {
                    const multi = multiSelected.size > 1 && multiSelected.has(item.id)
                    const ids = multi ? [...multiSelected] : [item.id]
                    const msg = multi
                      ? `Удалить выбранные элементы (${ids.length}) и всё вложенное?`
                      : `Удалить «${item.title}» и всё вложенное?`
                    if (confirm(msg)) {
                      if (multi) {
                        deleteItems(ids)
                        setMultiSelected(new Set())
                      } else {
                        deleteItem(item.id)
                      }
                    }
                    setMenuFor(null)
                  }}
                >
                  <Trash2 size={13} />
                  {multiSelected.size > 1 && multiSelected.has(item.id)
                    ? `Удалить выделенное (${multiSelected.size})`
                    : 'Удалить'}
                </button>
              </div>
            )}
          </span>
          <button
            className="icon-btn xs danger"
            title="Удалить"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`Удалить «${item.title}» и всё вложенное?`)) deleteItem(item.id)
            }}
          >
            <Trash2 size={13} />
          </button>
        </span>
      </div>

      {open &&
        children.map((c) => (
          <TreeRow
            key={c.id}
            item={c}
            depth={depth + 1}
            maps={maps}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            menuFor={menuFor}
            setMenuFor={setMenuFor}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
            dragIds={dragIds}
            setDragIds={setDragIds}
            dropTarget={dropTarget}
            setDropTarget={setDropTarget}
            onDropAt={onDropAt}
            multiSelected={multiSelected}
            onItemClick={onItemClick}
          />
        ))}
    </div>
  )
}
