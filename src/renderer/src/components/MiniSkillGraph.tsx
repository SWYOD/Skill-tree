interface Props {
  /** Радиус хаб-кольца — вся остальная геометрия считается от него, так
   *  фрагмент можно переиспользовать что в крошечной карточке темы, что в
   *  крупном превью редактора темы, просто с другим radius. */
  radius: number
  colors: string[]
  ringColor: string
  hubColor?: string
}

/**
 * Мини-версия РЕАЛЬНОГО графа (см. GraphCanvas.tsx/NodeGlyph.tsx) для превью
 * тем — хаб-кольцо, ветки прямо НА кольце (крупные узлы), от каждой ветки
 * тонкий луч дальше к листовому узлу (узел мельче) того же цвета. Раньше тут
 * были просто «спицы» из центра — этот вариант ближе к силуэту настоящего
 * графа (кольцо + два уровня узлов на возрастающем радиусе), как и просили.
 * Возвращает голый `<g>` — вызывающий сам оборачивает в
 * `<g transform="translate(cx, cy)">` на нужной позиции.
 */
export function MiniSkillGraph({ radius, colors, ringColor, hubColor }: Props): JSX.Element {
  const palette = colors.length > 0 ? colors : ['#8b5cf6']
  const n = Math.min(palette.length, 6)
  const leafRadius = radius * 2.3
  const branchR = Math.max(1.2, radius * 0.24)
  const leafR = Math.max(0.9, radius * 0.16)
  const ringWidth = Math.max(0.8, radius * 0.11)
  const lineWidth = Math.max(0.6, radius * 0.09)

  const nodes = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return {
      color: palette[i % palette.length],
      bx: Math.cos(angle) * radius,
      by: Math.sin(angle) * radius,
      lx: Math.cos(angle) * leafRadius,
      ly: Math.sin(angle) * leafRadius
    }
  })

  return (
    <g>
      <circle r={radius} fill="none" stroke={ringColor} strokeWidth={ringWidth} />
      {nodes.map((node, i) => (
        <line
          key={`l${i}`}
          x1={node.bx}
          y1={node.by}
          x2={node.lx}
          y2={node.ly}
          stroke={node.color}
          strokeWidth={lineWidth}
        />
      ))}
      {nodes.map((node, i) => (
        <circle key={`leaf${i}`} cx={node.lx} cy={node.ly} r={leafR} fill={node.color} />
      ))}
      {nodes.map((node, i) => (
        <circle key={`branch${i}`} cx={node.bx} cy={node.by} r={branchR} fill={node.color} />
      ))}
      <circle r={Math.max(0.8, radius * 0.14)} fill={hubColor ?? ringColor} />
    </g>
  )
}
