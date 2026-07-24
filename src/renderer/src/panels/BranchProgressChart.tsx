import { useState } from 'react'
import { ChevronDown, ChevronUp, BarChart2 } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { buildMaps, branchProgress, branchChecklistProgress } from '../domain'

/**
 * Сворачиваемая панель со столбчатым графиком прогресса по каждой главной
 * ветке — чтобы отставание какой-то одной ветки было видно с первого взгляда,
 * а не только по цифрам. В каждом столбце ДВА слоя: сплошной — доля полностью
 * освоенных навыков (branchProgress, как раньше), и полупрозрачный «призрак»
 * позади него повыше — суммарный прогресс по ВСЕМ пунктам чеклиста ветки
 * (branchChecklistProgress), включая ещё не закрытые до конца навыки. По мере
 * освоения сплошная шкала «догоняет» полупрозрачную.
 */
export function BranchProgressChart(): JSX.Element | null {
  const tree = useTree((s) => s.tree)
  const select = useTree((s) => s.select)
  const [collapsed, setCollapsed] = useState(false)

  if (!tree) return null
  const maps = buildMaps(tree.items)
  // Корневая группа — такой же полноценный столбец, как ветка (см. mainBranches
  // в layout.ts): её прогресс — это агрегат всех узлов внутри, независимо от
  // того, лежат они прямо в ней или во вложенных ветках/группах.
  const branches = tree.items.filter(
    (i) => (i.kind === 'branch' || i.kind === 'group') && i.parentId === null
  )
  if (branches.length === 0) return null

  return (
    <div className="stats-bar">
      <button className="stats-bar-head" onClick={() => setCollapsed((v) => !v)}>
        <span className="stats-bar-title">
          <BarChart2 size={14} /> Прогресс по веткам
        </span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {!collapsed && (
        <div className="branch-chart-body">
          {branches.map((b) => {
            const { done, total } = branchProgress(b.id, maps)
            const pct = total === 0 ? 0 : Math.round((done / total) * 100)
            const { done: doneItems, total: totalItems } = branchChecklistProgress(b.id, maps)
            const partialPct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100)
            const color = b.color ?? '#8b5cf6'
            // Оба слоя имеют минимальную видимую высоту — при маленьких процентах она
            // «схлопывает» их в одинаковый размер, и полупрозрачный слой (он ниже по
            // z-index) прячется под сплошным. Поэтому высоту «призрака» всегда держим
            // заметно (на 4 п.п.) выше отрисованной высоты сплошного слоя.
            const solidHeight = total > 0 ? Math.max(pct, 3) : 0
            const ghostHeight =
              totalItems > 0 && partialPct > 0
                ? Math.min(100, Math.max(partialPct, solidHeight + 4))
                : 0
            // Подпись «призрачного» процента печатается НАД точкой bottom:X% —
            // на высоких значениях (около 100%) она вылезала за верхний край
            // трека и накладывалась на основной процент (тот — отдельная
            // строка ВЫШЕ трека, см. .branch-chart-pct). Ограничиваем позицию
            // именно ПОДПИСИ (не саму заливку — та остаётся точной высотой),
            // оставляя гарантированный зазор под её высоту у трека 64px
            // (см. .branch-chart-track в styles.css).
            const ghostLabelPct = Math.min(ghostHeight, 78)
            return (
              <button
                key={b.id}
                className="branch-chart-col"
                title={`${b.title}: освоено ${done}/${total} (${pct}%) · общий прогресс (${partialPct}%)`}
                onClick={() => select(b.id)}
              >
                <span className="branch-chart-pct" style={{ color }}>
                  {pct}%
                </span>
                <span className="branch-chart-track">
                  {ghostHeight > 0 && (
                    <span
                      className="branch-chart-fill branch-chart-fill-partial"
                      style={{ height: `${ghostHeight}%`, background: color }}
                    />
                  )}
                  {ghostHeight > 0 && partialPct < 100 && (
                    <span
                      className="branch-chart-partial-pct"
                      style={{ bottom: `${ghostLabelPct}%`, color }}
                    >
                      {partialPct}%
                    </span>
                  )}
                  <span
                    className="branch-chart-fill"
                    style={{
                      height: `${solidHeight}%`,
                      background: color,
                      boxShadow: `0 0 8px 0 ${color}88`
                    }}
                  />
                </span>
                <span className="branch-chart-name">{truncate(b.title, 10)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
