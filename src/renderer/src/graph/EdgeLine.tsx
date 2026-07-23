import { memo } from 'react'
import { motion } from 'framer-motion'
import type { EdgeAnim, ItemStatus } from '@shared/types'
import type { LaidEdge } from './layout'

interface Props {
  edge: LaidEdge
  /** Статус целевого узла — определяет «заряженность» ребра. */
  targetStatus: ItemStatus
  /** Ребро на подсвеченном пути (наведение/выбор). */
  lit: boolean
  /** Есть активный фокус, но это ребро вне него — приглушаем. */
  dimmed: boolean
  /** Стиль анимации подсветки (из настроек). */
  anim: EdgeAnim
  /** Задержка (сек) появления при монтировании — см. NodeGlyph.revealDelay. */
  revealDelay?: number
  /** См. NodeGlyph.instant — рендер сразу в конечном состоянии, без fade-in. */
  instant?: boolean
}

/** Мемоизирован по той же причине, что и NodeGlyph — см. комментарий там. */
export const EdgeLine = memo(function EdgeLine({
  edge,
  targetStatus,
  lit,
  dimmed,
  anim,
  revealDelay = 0,
  instant = false
}: Props): JSX.Element {
  const charged = targetStatus === 'done' || targetStatus === 'in_progress'
  const bright = lit || charged
  // «Живая» анимация только у активных рёбер (путь под фокусом или узел в процессе),
  // но не у уже завершённых — те просто статично горят.
  const animated = lit || targetStatus === 'in_progress'
  const animClass =
    animated && anim === 'flow' ? 'edge-flow' : animated && anim === 'breathing' ? 'edge-breathe' : ''

  const baseOpacity = dimmed ? 0.05 : lit ? 0.4 : targetStatus === 'locked' ? 0.14 : 0.26
  const brightOpacity = lit ? 0.95 : targetStatus === 'done' ? 0.9 : 0.65

  const commonProps = {
    x1: edge.from.x,
    y1: edge.from.y,
    x2: edge.to.x,
    y2: edge.to.y,
    stroke: edge.color,
    strokeLinecap: 'round' as const
  }

  return (
    <motion.g
      initial={instant ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={instant ? { duration: 0 } : { duration: 0.3, delay: revealDelay }}
    >
      {/* Базовая линия */}
      <line {...commonProps} strokeWidth={1.5} opacity={baseOpacity} />

      {/* Яркая линия подсветки/заряда — «свечение» без SVG-фильтра (несколько
          полупрозрачных обводок разной толщины), чтобы не зависеть от bbox
          линии (у вертикальных/горизонтальных линий он вырожденный — известный
          баг SVG-фильтров) и не плодить дорогие ресурсы на каждое ребро. */}
      {bright && !dimmed && (
        <g className={animClass} style={{ opacity: brightOpacity, transition: 'opacity 0.2s ease' }}>
          <line {...commonProps} strokeWidth={7} opacity={0.16} />
          <line {...commonProps} strokeWidth={4} opacity={0.3} />
          <line {...commonProps} strokeWidth={lit || targetStatus === 'done' ? 2.2 : 1.8} opacity={1} />
        </g>
      )}
    </motion.g>
  )
})
