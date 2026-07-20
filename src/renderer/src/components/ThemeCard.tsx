import { Check, Trash2 } from 'lucide-react'
import type { ThemeDef } from '@shared/types'

interface Props {
  theme: ThemeDef
  active: boolean
  onClick: () => void
  onRemove?: () => void
}

/** Углы «спиц» мини-графа в превью — фиксированный wireframe-каркас, но
 *  цвета в нём (фон/акцент/палитра веток) всегда берутся из theme, а не
 *  зашиты — так карточка честно показывает, как будет выглядеть КОНКРЕТНАЯ
 *  (в т.ч. импортированная пользователем) тема, а не один и тот же макет. */
const SPOKES = [
  { x: 23, y: -13 },
  { x: 26, y: 5 },
  { x: 9, y: 23 },
  { x: -19, y: 15 },
  { x: -22, y: -9 }
]

export function ThemeCard({ theme, active, onClick, onRemove }: Props): JSX.Element {
  const palette = theme.branchColors.length > 0 ? theme.branchColors : [theme.vars.accent]
  const dotColors = SPOKES.map((_, i) => palette[i % palette.length])

  return (
    <button
      className={`theme-card${active ? ' active' : ''}`}
      onClick={onClick}
      title={theme.name}
    >
      <svg viewBox="0 0 140 88" width="100%" className="theme-card-preview">
        <rect x="0" y="0" width="140" height="88" fill={theme.vars.bg} />
        <rect x="0" y="0" width="140" height="9" fill={theme.vars['bg-panel']} />
        <rect x="6" y="3.5" width="24" height="3" rx="1.5" fill={theme.vars.accent} />
        <rect x="0" y="9" width="24" height="79" fill={theme.vars['bg-panel']} />
        <line x1="7" y1="20" x2="18" y2="20" stroke={theme.vars['text-faint']} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="26" x2="15" y2="26" stroke={theme.vars['text-faint']} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="32" x2="18" y2="32" stroke={theme.vars['text-faint']} strokeWidth="1.5" strokeLinecap="round" />
        <g transform="translate(90,48)">
          <circle r="13" fill="none" stroke={theme.vars['border-strong']} strokeWidth="1.5" />
          {SPOKES.map((p, i) => (
            <line key={i} x1="0" y1="0" x2={p.x} y2={p.y} stroke={dotColors[i]} strokeWidth="1" />
          ))}
          {SPOKES.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={dotColors[i]} />
          ))}
        </g>
      </svg>
      <div className="theme-card-footer">
        <span className="theme-card-name">{theme.name}</span>
        {active && <Check size={13} className="theme-card-check" />}
        {onRemove && !active && (
          <span
            className="icon-btn xs danger theme-card-remove"
            title="Удалить тему"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <Trash2 size={12} />
          </span>
        )}
      </div>
      <div className="theme-card-swatches">
        {palette.slice(0, 6).map((c, i) => (
          <span key={i} style={{ background: c }} />
        ))}
      </div>
    </button>
  )
}
