import { useState } from 'react'
import { FolderOpen, Check, X, Palette } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { Switch } from '../components/Switch'
import { ThemesPopup } from './ThemesPopup'
import { BUILTIN_THEMES } from '../themes/builtins'

const EDGE_ANIMS: { value: 'static' | 'breathing' | 'flow'; label: string }[] = [
  { value: 'static', label: 'Статика' },
  { value: 'breathing', label: 'Дыхание' },
  { value: 'flow', label: 'Поток' }
]

/** Короткое имя директории для списка (последний сегмент пути). */
function dirName(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] || path
}

export function SettingsPanel(): JSX.Element {
  const settings = useTree((s) => s.settings)
  const chooseRootDir = useTree((s) => s.chooseRootDir)
  const chooseRootDirFrom = useTree((s) => s.chooseRootDirFrom)
  const removeRecentDir = useTree((s) => s.removeRecentDir)
  const setUnlock = useTree((s) => s.setUnlockMechanic)
  const setEdgeAnim = useTree((s) => s.setEdgeAnim)
  const [themesOpen, setThemesOpen] = useState(false)

  const others = settings.recentDirs.filter((d) => d !== settings.rootDir)
  const activeThemeName =
    [...BUILTIN_THEMES, ...settings.customThemes].find((t) => t.id === settings.themeId)?.name ?? ''

  return (
    <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
      <label className="settings-label">Директория дерева</label>
      <div className="dir-list">
        {settings.rootDir && (
          <div className="dir-row dir-row-current">
            <Check size={13} />
            <span className="dir-row-name" title={settings.rootDir}>
              {dirName(settings.rootDir)}
            </span>
          </div>
        )}
        {others.map((d) => (
          <div key={d} className="dir-row" onClick={() => chooseRootDirFrom(d)}>
            <span className="dir-row-name" title={d}>
              {dirName(d)}
            </span>
            <button
              className="icon-btn xs danger"
              title="Убрать из списка"
              onClick={(e) => {
                e.stopPropagation()
                removeRecentDir(d)
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button className="tb-btn" style={{ width: '100%', marginTop: 8 }} onClick={() => chooseRootDir()}>
        <FolderOpen size={14} /> Открыть другую…
      </button>

      <div className="settings-sep" />

      <button className="settings-row settings-row-btn" onClick={() => setThemesOpen(true)}>
        <span>Темы</span>
        <span className="settings-row-value">
          <Palette size={13} /> {activeThemeName}
        </span>
      </button>
      {themesOpen && <ThemesPopup onClose={() => setThemesOpen(false)} />}

      <div className="settings-row">
        <span>Механика разблокировки</span>
        <Switch checked={settings.unlockMechanic} onChange={setUnlock} />
      </div>
      <p className="dim small">
        Узлы блокируются, пока не выполнен родительский узел (как в игре).
      </p>

      <label className="settings-label">Подсветка пути</label>
      <div className="segmented">
        {EDGE_ANIMS.map((o) => (
          <button
            key={o.value}
            className={`seg${settings.edgeAnim === o.value ? ' active' : ''}`}
            onClick={() => setEdgeAnim(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
