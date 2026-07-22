import { useEffect, useState } from 'react'
import { FolderOpen, Check, X, Palette, Type, RefreshCw, Moon, Sun } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { Switch } from '../components/Switch'
import { ThemesPopup } from './ThemesPopup'
import { FontsPopup } from './FontsPopup'
import { BUILTIN_THEMES } from '../themes/builtins'
import type { UpdateStatus } from '@shared/types'

const FONT_MODE_LABEL: Record<'default' | 'theme' | 'custom', string> = {
  default: 'По умолчанию',
  theme: 'Как в теме',
  custom: 'Свой'
}

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

function updateStatusText(status: UpdateStatus | null): string {
  if (!status) return ''
  switch (status.state) {
    case 'checking':
      return 'Проверка обновлений…'
    case 'available':
      return `Найдена версия ${status.version ?? ''} — загружается…`
    case 'not-available':
      return 'У вас последняя версия.'
    case 'downloaded':
      return `Версия ${status.version ?? ''} загружена — перезапустите приложение.`
    case 'error':
      return status.message ?? 'Не удалось проверить обновления.'
    default:
      return ''
  }
}

export function SettingsPanel(): JSX.Element {
  const settings = useTree((s) => s.settings)
  const chooseRootDir = useTree((s) => s.chooseRootDir)
  const chooseRootDirFrom = useTree((s) => s.chooseRootDirFrom)
  const removeRecentDir = useTree((s) => s.removeRecentDir)
  const setUnlock = useTree((s) => s.setUnlockMechanic)
  const setEdgeAnim = useTree((s) => s.setEdgeAnim)
  const setThemeMode = useTree((s) => s.setThemeMode)
  const [themesOpen, setThemesOpen] = useState(false)
  const [fontsOpen, setFontsOpen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)

  useEffect(() => window.api.onUpdateStatus(setUpdateStatus), [])

  const others = settings.recentDirs.filter((d) => d !== settings.rootDir)
  const activeTheme = [...BUILTIN_THEMES, ...settings.customThemes].find(
    (t) => t.id === settings.themeId
  )

  return (
    <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
      <div className="settings-section">
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
        <button className="tb-btn" style={{ width: '100%' }} onClick={() => chooseRootDir()}>
          <FolderOpen size={14} /> Открыть другую…
        </button>
      </div>

      <div className="settings-sep" />

      <div className="settings-section">
        <label className="settings-label">Внешний вид</label>

        <button className="settings-row settings-row-btn" onClick={() => setThemesOpen(true)}>
          <span>Темы</span>
          <span className="settings-row-value">
            <Palette size={13} /> {activeTheme?.name ?? ''}
          </span>
        </button>
        {themesOpen && <ThemesPopup onClose={() => setThemesOpen(false)} />}

        <button className="settings-row settings-row-btn" onClick={() => setFontsOpen(true)}>
          <span>Шрифт</span>
          <span className="settings-row-value">
            <Type size={13} /> {FONT_MODE_LABEL[settings.fontMode]}
          </span>
        </button>
        {fontsOpen && <FontsPopup onClose={() => setFontsOpen(false)} />}

        {activeTheme?.altVariant &&
          (() => {
            // Какой из режимов (primary/alt) тёмный, а какой светлый — зависит
            // от того, тёмная ли САМА тема по умолчанию (обычно primary тёмный,
            // alt светлый, но кастомная тема теоретически может быть наоборот).
            const darkMode: 'primary' | 'alt' = activeTheme.dark ? 'primary' : 'alt'
            const lightMode: 'primary' | 'alt' = activeTheme.dark ? 'alt' : 'primary'
            return (
              <div className="segmented">
                <button
                  className={`seg${settings.themeMode === darkMode ? ' active' : ''}`}
                  onClick={() => setThemeMode(darkMode)}
                >
                  <Moon size={12} /> Тёмная
                </button>
                <button
                  className={`seg${settings.themeMode === lightMode ? ' active' : ''}`}
                  onClick={() => setThemeMode(lightMode)}
                >
                  <Sun size={12} /> Светлая
                </button>
              </div>
            )
          })()}

        <span className="settings-sublabel">Подсветка пути</span>
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

      <div className="settings-sep" />

      <div className="settings-section">
        <div className="settings-row">
          <span>Механика разблокировки</span>
          <Switch checked={settings.unlockMechanic} onChange={setUnlock} />
        </div>
        <p className="dim small">
          Узлы блокируются, пока не выполнен родительский узел (как в игре).
        </p>
      </div>

      <div className="settings-sep" />

      <div className="settings-section">
        <div className="settings-row">
          <span>Обновления</span>
          <button
            className="icon-btn xs"
            title="Проверить обновления"
            disabled={updateStatus?.state === 'checking'}
            onClick={() => window.api.checkForUpdate()}
          >
            <RefreshCw size={13} className={updateStatus?.state === 'checking' ? 'spin' : undefined} />
          </button>
        </div>
        {updateStatus && <p className="dim small">{updateStatusText(updateStatus)}</p>}
      </div>
    </div>
  )
}
