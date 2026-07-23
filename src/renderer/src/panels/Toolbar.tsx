import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Image, GitBranch, GitBranchPlus, PanelLeft, PanelRight, Pencil } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { exportTree, exportBranch, importFromFile, importBranchFromFile } from '../io/exportImport'
import { treeStats } from '../domain'
import { BrandLogo } from '../components/BrandLogo'
import { BranchIcon } from '../components/BranchIcon'
import { VersionBadge } from '../components/VersionBadge'
import { ExportPngDialog } from './ExportPngDialog'

interface ToolbarProps {
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}

export function Toolbar({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight
}: ToolbarProps): JSX.Element {
  const tree = useTree((s) => s.tree)
  const selectedId = useTree((s) => s.selectedId)
  const addBranch = useTree((s) => s.addBranch)
  const replaceTree = useTree((s) => s.replaceTree)
  const appendItems = useTree((s) => s.appendItems)
  const renameTree = useTree((s) => s.renameTree)

  const selected = tree?.items.find((i) => i.id === selectedId) ?? null
  const selectedBranch = selected?.kind === 'branch' ? selected : null
  const stats = treeStats(tree)

  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [pngDialogOpen, setPngDialogOpen] = useState(false)

  useEffect(() => {
    if (renaming) {
      setNameDraft(tree?.meta.name ?? '')
      requestAnimationFrame(() => nameInputRef.current?.select())
    }
  }, [renaming, tree?.meta.name])

  function commitName(): void {
    const v = nameDraft.trim()
    if (v) renameTree(v)
    setRenaming(false)
  }

  async function onImport(): Promise<void> {
    const res = await importFromFile()
    if (!res) return
    if (res.kind === 'tree') replaceTree(res.tree)
    else appendItems(res.items)
  }

  async function onImportBranch(): Promise<void> {
    const items = await importBranchFromFile()
    if (items) appendItems(items)
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className={`icon-btn${leftOpen ? ' active' : ''}`}
          title="Левая панель"
          onClick={onToggleLeft}
        >
          <PanelLeft size={17} />
        </button>
        <BrandLogo size={26} variant="plain" className="brand-icon" />
        <span className="brand">Skill Tree</span>
        <VersionBadge />
        {tree &&
          (renaming ? (
            <input
              ref={nameInputRef}
              className="tree-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setRenaming(false)
              }}
            />
          ) : (
            <>
              <span className="tree-name">{tree.meta.name}</span>
              <button
                className="icon-btn xs"
                title="Переименовать дерево"
                onClick={() => setRenaming(true)}
              >
                <Pencil size={13} />
              </button>
            </>
          ))}
        {tree && (
          <span className="stats dim small">
            {stats.branches} веток · {stats.nodes} узлов · {stats.doneNodes} готово ·{' '}
            {stats.pct}%
          </span>
        )}
      </div>

      <div className="toolbar-right">
        <button className="tb-btn primary" onClick={() => addBranch()} disabled={!tree}>
          <BranchIcon size={15} /> Новая ветка
        </button>
        <div className="tb-sep" />
        <button className="tb-btn" onClick={onImport} disabled={!tree} title="Импорт из JSON">
          <Download size={15} /> Импорт
        </button>
        <button
          className="tb-btn"
          onClick={() => tree && exportTree(tree)}
          disabled={!tree}
          title="Экспорт всего дерева в JSON"
        >
          <Upload size={15} /> Экспорт
        </button>
        <button
          className="tb-btn icon-only"
          onClick={onImportBranch}
          disabled={!tree}
          title="Импорт ветки из JSON (всегда как новая ветка — без риска перезаписать текущее дерево и без конфликта id)"
        >
          <GitBranchPlus size={15} />
        </button>
        <button
          className="tb-btn icon-only"
          onClick={() => tree && selectedBranch && exportBranch(tree, selectedBranch.id)}
          disabled={!selectedBranch}
          title="Экспорт выбранной ветки в JSON"
        >
          <GitBranch size={15} />
        </button>
        <button
          className="tb-btn icon-only"
          onClick={() => setPngDialogOpen(true)}
          disabled={!tree}
          title="Экспорт графа в PNG"
        >
          <Image size={15} />
        </button>
        <div className="tb-sep" />
        <button
          className={`icon-btn${rightOpen ? ' active' : ''}`}
          title="Правая панель"
          onClick={onToggleRight}
        >
          <PanelRight size={17} />
        </button>
      </div>
      {pngDialogOpen && <ExportPngDialog onClose={() => setPngDialogOpen(false)} />}
    </div>
  )
}
