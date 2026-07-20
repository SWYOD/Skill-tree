import { useState } from 'react'
import { ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'
import { useTree } from '../store/treeStore'
import {
  buildMaps,
  treeStats,
  branchProgress,
  completedInPeriod,
  nearestBranch,
  collectDescendants
} from '../domain'
import type { PacePeriod } from '../domain'

const PERIOD_LABEL: Record<PacePeriod, string> = { day: 'День', week: 'Неделя', month: 'Месяц' }
const PERIOD_UNIT: Record<PacePeriod, string> = {
  day: 'навыка/день',
  week: 'навыка/нед',
  month: 'навыка/мес'
}

/** Свёрнутая/развёрнутая полоса статистики над графом — освоено/осталось и
 *  темп освоения (сколько реально завершено за выбранный период), по
 *  всему дереву и по выбранной ветке. */
export function StatsBar(): JSX.Element | null {
  const tree = useTree((s) => s.tree)
  const selectedId = useTree((s) => s.selectedId)
  const [collapsed, setCollapsed] = useState(false)
  const [period, setPeriod] = useState<PacePeriod>('week')

  if (!tree) return null

  const stats = treeStats(tree)
  const remaining = stats.nodes - stats.doneNodes
  const allNodes = tree.items.filter((i) => i.kind === 'node')
  const treePace = completedInPeriod(allNodes, period)

  const maps = buildMaps(tree.items)
  const selected = selectedId ? maps.byId.get(selectedId) : null
  // Ближайшая ветка от текущего выделения — если выбран узел внутри ветки
  // (в т.ч. глубоко вложенный узел-в-узле), статистика по ветке всё равно
  // должна подтягиваться, а не только когда выбрана сама ветка.
  const selectedBranch = selected ? nearestBranch(selected, maps) : null
  const branchStat = selectedBranch ? branchProgress(selectedBranch.id, maps) : null
  const branchPace = selectedBranch
    ? completedInPeriod(
        collectDescendants(selectedBranch.id, maps).filter((d) => d.kind === 'node'),
        period
      )
    : null

  return (
    <div className="stats-bar">
      <button className="stats-bar-head" onClick={() => setCollapsed((v) => !v)}>
        <span className="stats-bar-title">
          <BarChart3 size={14} /> Статистика
        </span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {!collapsed && (
        <div className="stats-bar-body">
          <div className="stats-item">
            <span className="stats-label">Освоено</span>
            <span className="stats-value">
              {stats.doneNodes} / {stats.nodes} ({stats.pct}%)
            </span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Осталось</span>
            <span className="stats-value">{remaining}</span>
          </div>
          <div className="stats-item">
            <span className="stats-label">Темп (всё дерево)</span>
            <span className="stats-value">
              {treePace} {PERIOD_UNIT[period]}
            </span>
          </div>
          {selectedBranch && branchStat && branchPace !== null && (
            <div className="stats-item">
              <span className="stats-label">Темп «{truncate(selectedBranch.title, 20)}»</span>
              <span className="stats-value">
                {branchPace} {PERIOD_UNIT[period]} ({branchStat.done}/{branchStat.total})
              </span>
            </div>
          )}
          <div className="stats-item stats-period">
            <span className="stats-label">Период</span>
            <div className="segmented stats-period-seg">
              {(['day', 'week', 'month'] as PacePeriod[]).map((p) => (
                <button
                  key={p}
                  className={`seg${period === p ? ' active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
