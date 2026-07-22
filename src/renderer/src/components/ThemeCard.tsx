import { Check, Trash2 } from 'lucide-react'
import type { ThemeDef } from '@shared/types'
import { MiniSkillGraph } from './MiniSkillGraph'

interface Props {
  theme: ThemeDef
  active: boolean
  onClick: () => void
  onRemove?: () => void
}

export function ThemeCard({ theme, active, onClick, onRemove }: Props): JSX.Element {
  const palette = theme.branchColors.length > 0 ? theme.branchColors : [theme.vars.accent]

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
          <MiniSkillGraph
            radius={13}
            colors={palette}
            ringColor={theme.vars['border-strong']}
            hubColor={theme.vars['text-faint']}
          />
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
