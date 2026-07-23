import { forwardRef, useMemo } from 'react'
import type { Item, ItemStatus } from '@shared/types'
import { buildMaps, colorFor, computeStatus } from '../domain'
import { computeLayout, nodeScaleFor, INNER_RADIUS } from './layout'
import { NodeGlyph } from './NodeGlyph'
import { EdgeLine } from './EdgeLine'
import { arcPath } from './GraphCanvas'

const noop = (): void => {}

interface Props {
  items: Item[]
  /** id веток/узлов, свёрнутых в этом конкретном рендере (пустой набор —
   *  дерево показано полностью развёрнутым). */
  collapsed: Set<string>
  unlockMechanic: boolean
  treeName: string
  isDarkTheme: boolean
}

/**
 * Некликабельный, статичный слепок графа — без zoom/pan, без spring-анимаций
 * появления (см. instant у NodeGlyph/EdgeLine), без hover/выделения. Общая
 * основа для live-превью в ExportPngDialog и для самого растеризуемого SVG:
 * оба должны выглядеть идентично, иначе превью врёт пользователю.
 *
 * Намеренно НЕ переиспользует id="graph-content" — на нём в styles.css висят
 * правила, прячущие подписи узлов, пока не приблизят зумом (.zoom-far/
 * .zoom-deep). У статичного графа зума нет вообще, и пользователь явно
 * попросил, чтобы в экспорте подписи ВСЕХ развёрнутых сейчас узлов были
 * видны сразу — другой id гарантирует, что эти правила просто не сработают.
 */
export const StaticGraphSvg = forwardRef<SVGSVGElement, Props>(function StaticGraphSvg(
  { items, collapsed, unlockMechanic, treeName, isDarkTheme },
  ref
): JSX.Element {
  const maps = useMemo(() => buildMaps(items), [items])
  const colorOf = useMemo(() => (item: Item): string => colorFor(item, maps), [maps])
  const layout = useMemo(
    () => computeLayout(items, colorOf, collapsed),
    [items, colorOf, collapsed]
  )
  const statusById = useMemo(() => {
    const m = new Map<string, ItemStatus>()
    for (const it of items) m.set(it.id, computeStatus(it, maps, unlockMechanic))
    return m
  }, [items, maps, unlockMechanic])
  const nodeScale = nodeScaleFor(layout.nodes.length)
  const hubTextScale = Math.max(0.5, layout.innerRadius / INNER_RADIUS)

  function distanceScaleFor(radius: number): number {
    const span = layout.extent - layout.innerRadius
    const ratio = span > 0 ? (radius - layout.innerRadius) / span : 0
    return 1 - Math.min(1, Math.max(0, ratio)) * 0.35
  }

  return (
    <svg id="static-graph-svg" ref={ref} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%" filterUnits="objectBoundingBox">
          <feDropShadow
            dx="0"
            dy="0"
            stdDeviation={isDarkTheme ? 2.5 : 1}
            floodColor="currentColor"
            floodOpacity={isDarkTheme ? 0.9 : 0.35}
          />
        </filter>
      </defs>

      <g id="static-graph-content">
        <circle r={layout.innerRadius} fill="none" style={{ stroke: 'var(--border-strong)' }} strokeWidth={3} />

        {layout.sectors.map((s) => (
          <path
            key={s.branchId}
            d={arcPath(layout.innerRadius, s.startAngle, s.endAngle)}
            fill="none"
            stroke={s.color}
            strokeWidth={4}
            strokeLinecap="round"
            style={{ color: s.color }}
            filter="url(#glow)"
          />
        ))}

        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={22 * hubTextScale}
          fontWeight={700}
          letterSpacing={3 * hubTextScale}
          style={{ fill: 'var(--text)' }}
        >
          {treeName.toUpperCase()}
        </text>

        {layout.edges.map((e) => (
          <EdgeLine
            key={e.id}
            edge={e}
            targetStatus={statusById.get(e.toId) ?? 'available'}
            lit={false}
            dimmed={false}
            anim="static"
            instant
          />
        ))}

        {layout.nodes.map((n) => (
          <NodeGlyph
            key={n.item.id}
            node={n}
            status={statusById.get(n.item.id) ?? 'available'}
            farLocked={false}
            selected={false}
            emphasis="none"
            scale={nodeScale}
            distanceScale={distanceScaleFor(n.radius)}
            childCount={maps.childrenOf.get(n.item.id)?.length ?? 0}
            onSelect={noop}
            onHover={noop}
            onReveal={noop}
            onToggleCollapse={noop}
            onHoldStart={noop}
            instant
          />
        ))}
      </g>
    </svg>
  )
})
