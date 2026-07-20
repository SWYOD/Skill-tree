import { memo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import type { ItemStatus } from '@shared/types'
import type { LaidNode } from './layout'
import { LucideIcon } from './LucideIcon'
import { statusOpacity } from '../theme'
import { itemProgress } from '../domain'

export type NodeEmphasis = 'none' | 'focused' | 'related' | 'dimmed'

/** Серый для «далёких» недостижимых узлов. */
const FAR_GRAY = '#565a63'

interface Props {
  node: LaidNode
  status: ItemStatus
  /** Элемент дальше одного шага от точки блокировки — рисуем серым, но с замком. */
  farLocked: boolean
  selected: boolean
  /** Часть мультивыделения в левом дереве (Ctrl/Cmd/Shift) — граф это только
   *  подсвечивает, управляется выделение из LeftPanel. */
  multiSelected?: boolean
  emphasis: NodeEmphasis
  /** Множитель размера (см. nodeScaleFor) — большие деревья рисуются компактнее. */
  scale: number
  /** Задержка (сек) появления при монтировании — растёт с радиусом, чтобы узлы
   *  «прорастали» от хаба наружу по очереди при перерисовке графа. */
  revealDelay?: number
  /** Свёрнут ли ЭТОТ элемент на графе прямо сейчас (своё, отдельное от левой
   *  панели состояние — см. graphCollapsed в сторе). */
  collapsedSelf?: boolean
  /** Множитель по расстоянию от хаба (см. distanceScaleFor в GraphCanvas) —
   *  дальние узлы рисуются немного мельче ближних. */
  distanceScale?: number
  /** Пока показан поп-ап с полным названием/чеклистом этого узла (см.
   *  GraphCanvas.tsx) — прячем обычную подпись под узлом, чтобы не дублировать
   *  название дважды на экране. */
  hideLabel?: boolean
  /** Число прямых детей — у групп рисуем как бейдж поверх иконки, чтобы было
   *  видно с первого взгляда, сколько веток/узлов объединяет группа. */
  childCount?: number
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  onReveal: (id: string) => void
  /** Клик по маркеру +/− — сворачивает/разворачивает элемент прямо на графе. */
  onToggleCollapse: (id: string) => void
  /** Зажатие (mousedown) — начало отсчёта до показа поп-апа (см. HOVER_POPUP_DELAY
   *  в GraphCanvas.tsx). Закрывается кликом мимо или началом панорамирования
   *  графа — это отслеживается централизованно в GraphCanvas, не здесь. */
  onHoldStart: (id: string) => void
}

/**
 * Мемоизирован: при zoom/pan меняется только transform внешнего <g id="graph-content">
 * в GraphCanvas, а не пропсы отдельных узлов — без memo React.js пере-рендеривал бы
 * все узлы (и вложенные motion.g/иконки) на КАЖДОЕ wheel/pointermove событие, что на
 * деревьях из сотен узлов подвешивало отрисовку при масштабировании/панораме.
 */
export const NodeGlyph = memo(function NodeGlyph({
  node,
  status,
  farLocked,
  selected,
  multiSelected = false,
  emphasis,
  scale: sizeScale,
  distanceScale = 1,
  revealDelay = 0,
  collapsedSelf = false,
  hideLabel = false,
  childCount = 0,
  onSelect,
  onHover,
  onReveal,
  onToggleCollapse,
  onHoldStart
}: Props): JSX.Element {
  // После первого монтирования переключаем transition на «мгновенный» — иначе
  // задержка появления попадала бы и на анимацию hover/emphasis (scale), делая
  // наведение на узел ощутимо «залипающим» после каждой перерисовки графа.
  const [entered, setEntered] = useState(false)
  useEffect(() => setEntered(true), [])

  // Итоговый множитель размера: общий (по числу видимых узлов) × по удалённости
  // от хаба — так дальние кольца выглядят компактнее без потери читаемости центра.
  const s = sizeScale * distanceScale

  const springTransition = entered
    ? { type: 'spring' as const, stiffness: 300, damping: 22 }
    : { type: 'spring' as const, stiffness: 300, damping: 22, delay: revealDelay }

  const isBranch = node.item.kind === 'branch'
  const isGroup = node.item.kind === 'group'
  // Группа — тоже контейнер (как ветка), просто более низкого уровня — рисуем
  // её той же чуть увеличенной, всегда подписанной стилистикой, что и ветку.
  const isContainer = isBranch || isGroup
  // Контейнер лишь немного крупнее узла (не в 1.4×, как раньше) — чтобы иерархия
  // читалась, но кружки веток/групп не доминировали над графом.
  const r = (isContainer ? 24 : 20) * s
  const { pct } = itemProgress(node.item)
  const color = farLocked ? FAR_GRAY : node.color
  const locked = status === 'locked'
  const done = status === 'done'
  // Замок у ЛЮБОЙ блокировки — и у ближней (цветной), и у далёкой (серый, через color).
  const showLock = locked

  // Выбранный узел (и любой из мультивыделения в дереве слева) «залипает» в
  // приподнятом состоянии, даже когда наводят на другой.
  const eff: NodeEmphasis =
    (selected || multiSelected) && (emphasis === 'dimmed' || emphasis === 'none')
      ? 'related'
      : emphasis

  const hoverScale = eff === 'focused' ? 1.26 : eff === 'related' ? 1.1 : 1
  const dim = eff === 'dimmed'
  const lit = eff === 'focused' || eff === 'related'

  const bodyOpacity = dim ? 0.28 : lit ? 1 : statusOpacity(status)
  const strokeW = (eff === 'focused' ? 3.5 : selected || lit ? 2.8 : 2) * Math.max(s, 0.75)
  // Glow (feDropShadow) — тяжёлый SVG-фильтр; на больших деревьях (сотни узлов)
  // применение его КО ВСЕМ незаблокированным узлам разом заметно подтормаживало
  // именно на macOS (Chromium там рендерит SVG-фильтры заметно дороже, чем на
  // Windows). Оставляем его только там, где он реально нужен для акцента:
  // контейнеры (веток/групп немного, не сотни) и активные/выделенные узлы —
  // обычные листья в состоянии покоя обходятся без свечения.
  const glow = !locked && !dim && (isContainer || lit || selected || multiSelected) ? 'url(#glow)' : undefined
  const iconSize = (isContainer ? 24 : 22) * s
  // Глубокие кольца (depth>=2, внуки и глубже) упакованы по дуге плотнее первого
  // (см. node-label-deep в styles.css) — при том же масштабе их подписи заметно
  // легче налезают на соседние узлы, поэтому у них отдельный, более мелкий
  // базовый размер и более низкий пол, а не общий на все узлы. Общий масштаб
  // тоже слегка уменьшен целиком (пользователь попросил ужать текст в
  // компакт-режиме «3+», где кружков всё равно немного и мелкий шрифт вполне читается).
  const isDeepLeaf = !isContainer && node.depth >= 2
  const fontSize = Math.max((isContainer ? 12 : isDeepLeaf ? 9 : 11) * s, isDeepLeaf ? 6 : 8)
  // Ветки/группы и любой активный (наведённый/выбранный/мультивыделенный)
  // элемент — подпись показываем ВСЕГДА. Остальные подписи узлов управляются
  // CSS через .node-label-leaf (см. styles.css) — прячутся, пока не приблизят
  // зумом (класс .zoom-far/.zoom-near на #graph-content), а не JS-пропсом: так
  // граф по умолчанию показывает ВСЁ дерево (все кружки и связи) без
  // наслоения текста, и не нужно пере-рендеривать все узлы на каждый тик зума.
  const forceShowLabel = isContainer || lit || selected || multiSelected
  // При наведении/выборе именно ЭТОГО узла (не просто «на пути») показываем
  // название целиком без обрезки многоточием — сокращения по умолчанию стали
  // короче (см. ниже), так что полная подпись под курсором особенно нужна.
  const showFullTitle = eff === 'focused'

  // Прогресс-кольцо
  const ringR = r + 5 * s
  const circ = 2 * Math.PI * ringR
  const dash = (pct / 100) * circ

  // Маркер +/− — пропорционален размеру самого узла (а не фиксированной
  // константе с нижним порогом), иначе на мелких узлах большого дерева он
  // выглядел непропорционально огромным.
  const markerR = Math.max(4.5, r * 0.32)

  // Подпись всегда снизу от узла — пробовали радиальное/боковое смещение,
  // пользователь попросил вернуть как было: снизу читается привычнее.

  return (
    <g
      data-node-id={node.item.id}
      transform={`translate(${node.x}, ${node.y})`}
      style={{ cursor: 'pointer', color }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(node.item.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onReveal(node.item.id)
      }}
      onMouseEnter={() => onHover(node.item.id)}
      onMouseLeave={() => onHover(null)}
      onMouseDown={(e) => {
        e.stopPropagation()
        onHoldStart(node.item.id)
      }}
    >
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: hoverScale, opacity: 1 }}
        transition={springTransition}
      >
        {/* Невидимая зона захвата курсора (чтобы hover ловился и в зазорах).
            Запас на клик не сжимаем так же агрессивно, как визуальный размер —
            иначе на больших деревьях по мелким узлам сложно попасть курсором. */}
        <circle r={r + Math.max(10, 14 * s)} fill="transparent" />

        {/* Прогресс-кольцо */}
        {pct > 0 && (
          <circle
            r={ringR}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90)"
            opacity={dim ? 0.4 : 0.95}
          />
        )}

        {/* Тело узла — крипкий неоновый обод с тугим glow. У группы обод
            пунктирный — отличает «папку» от обычной ветки на глаз. */}
        <circle
          r={r}
          style={{ fill: 'var(--bg-graph)' }}
          stroke={color}
          strokeWidth={strokeW}
          strokeDasharray={isGroup ? `${r * 0.32} ${r * 0.22}` : undefined}
          opacity={bodyOpacity}
          filter={glow}
        />
        <circle r={r} fill={color} opacity={done ? 0.18 : lit ? 0.12 : 0.06} />

        {/* Пунктирное кольцо мультивыделения — отдельно от emphasis/selected,
            чтобы связь с выделением в левом дереве была однозначно видна. */}
        {multiSelected && (
          <circle
            r={r + 6 * s}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.9}
          />
        )}

        {/* Замок при любой блокировке (цвет ближней/дальней задаёт color) / иконка иначе */}
        {showLock ? (
          <Lock
            x={-iconSize * 0.32}
            y={-iconSize * 0.32}
            width={iconSize * 0.64}
            height={iconSize * 0.64}
            color={color}
            opacity={0.7}
          />
        ) : (
          <LucideIcon
            name={node.item.icon ?? (node.item.kind === 'group' ? 'Boxes' : undefined)}
            x={-iconSize / 2}
            y={-iconSize / 2}
            width={iconSize}
            height={iconSize}
            color={color}
            strokeWidth={2}
            opacity={dim ? 0.4 : 1}
          />
        )}

        {/* Бейдж с числом прямых детей — только у групп, чтобы сразу было видно,
            сколько веток/узлов она объединяет, не разворачивая её. */}
        {isGroup && childCount > 0 && (
          <g transform={`translate(${r * 0.72}, ${-r * 0.72})`}>
            <circle
              r={Math.max(7, r * 0.34)}
              style={{ fill: 'var(--bg-graph)' }}
              stroke={color}
              strokeWidth={1.3}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(8, r * 0.34)}
              fontWeight={700}
              fill={color}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {childCount}
            </text>
          </g>
        )}

        {/* Подпись. Ветки/группы/активные узлы — обычный текст, всегда видимый.
            Остальные узлы — с классом node-label-leaf, который CSS прячет,
            пока не приблизят зумом (см. .zoom-far в styles.css). Глубокие кольца
            (depth>=2, внуки и глубже) тесно упакованы угловым шагом — их подписи
            получают ещё и node-label-deep, требующий БОЛЬШЕГО зума (.zoom-deep),
            иначе на плотных ветках подписи налезали друг на друга и на соседние
            узлы ещё до того, как места вокруг реально стало достаточно. Пока
            открыт поп-ап этого узла (hideLabel) — подпись прячем совсем, иначе
            название дублировалось бы и под узлом, и в самом поп-апе. */}
        {!hideLabel && (
          <text
            className={
              forceShowLabel
                ? undefined
                : `node-label-leaf${node.depth >= 2 ? ' node-label-deep' : ''}`
            }
            y={r + fontSize + 4}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight={isContainer ? 700 : 500}
            opacity={dim ? 0.32 : locked ? 0.5 : 0.92}
            style={{ pointerEvents: 'none', userSelect: 'none', fill: 'var(--text)' }}
          >
            {showFullTitle
              ? node.item.title
              : truncate(node.item.title, isContainer ? 16 : isDeepLeaf ? 9 : 12)}
          </text>
        )}

        {/* Маркер +/− — ручное сворачивание/разворачивание ПРЯМО на графе,
            независимо от левой панели. Показан на любом элементе с детьми:
            «+» если сейчас свёрнут (детей не видно), «−» если развёрнут. */}
        {node.hasChildren && (
          <g
            transform={`translate(${r * 0.71}, ${r * 0.71})`}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse(node.item.id)
            }}
          >
            <circle r={markerR} style={{ fill: 'var(--bg-graph)' }} stroke={color} strokeWidth={1.3} />
            <line
              x1={-markerR * 0.45}
              y1={0}
              x2={markerR * 0.45}
              y2={0}
              stroke={color}
              strokeWidth={1.3}
              strokeLinecap="round"
            />
            {collapsedSelf && (
              <line
                x1={0}
                y1={-markerR * 0.45}
                x2={0}
                y2={markerR * 0.45}
                stroke={color}
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            )}
          </g>
        )}
      </motion.g>
    </g>
  )
})

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}
