import { Clock } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { lastModified, itemProgress } from '../domain'
import { Inspector } from './Inspector'
import { Checklist } from './Checklist'
import { NoteEditor } from '../notes/NoteEditor'
import { LucideIcon } from '../graph/LucideIcon'

export function RightPanel(): JSX.Element {
  const tree = useTree((s) => s.tree)
  const selectedId = useTree((s) => s.selectedId)
  const select = useTree((s) => s.select)

  const selected = tree?.items.find((i) => i.id === selectedId) ?? null
  const recent = lastModified(tree)

  return (
    <div className="panel right-panel">
      {/* Блок «последний изменённый» */}
      <div className="block last-modified">
        <div className="block-head">
          <span>
            <Clock size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Последний изменённый
          </span>
        </div>
        {recent ? (
          <button className="recent-card" onClick={() => select(recent.id)}>
            <LucideIcon
              name={
                recent.kind === 'branch'
                  ? 'GitBranch'
                  : (recent.icon ?? (recent.kind === 'group' ? 'Boxes' : undefined))
              }
              size={18}
              color={recent.color ?? '#8b5cf6'}
            />
            <div className="recent-meta">
              <span className="recent-title">{recent.title}</span>
              <span className="dim small">
                {recent.kind === 'branch' ? 'ветка' : recent.kind === 'group' ? 'группа' : 'узел'} ·{' '}
                {new Date(recent.updatedAt).toLocaleString('ru-RU', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            <span className="recent-pct">{itemProgress(recent).pct}%</span>
          </button>
        ) : (
          <div className="dim small pad">Пока нет изменений.</div>
        )}
      </div>

      {selected ? (
        <>
          <Inspector item={selected} />
          <Checklist item={selected} />
          <NoteEditor item={selected} />
        </>
      ) : (
        <div className="dim small pad">Выберите узел в графе или дереве слева.</div>
      )}
    </div>
  )
}
