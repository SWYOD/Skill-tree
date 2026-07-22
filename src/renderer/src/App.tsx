import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { useTree } from './store/treeStore'
import { Toolbar } from './panels/Toolbar'
import { LeftPanel } from './panels/LeftPanel'
import { RightPanel } from './panels/RightPanel'
import { GraphCanvas } from './graph/GraphCanvas'
import { GraphErrorBoundary } from './graph/GraphErrorBoundary'
import { BrandLogo } from './components/BrandLogo'
import { StatsBar } from './panels/StatsBar'
import { BranchProgressChart } from './panels/BranchProgressChart'
import { applyThemeVars, effectiveVariant, resolveTheme } from './themes/apply'

export default function App(): JSX.Element {
  const ready = useTree((s) => s.ready)
  const settings = useTree((s) => s.settings)
  const tree = useTree((s) => s.tree)
  const init = useTree((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    const theme = resolveTheme(settings.themeId, settings.customThemes)
    applyThemeVars(effectiveVariant(theme, settings.themeMode))
  }, [settings.themeId, settings.customThemes, settings.themeMode])

  if (!ready) return <div className="center-screen">Загрузка…</div>
  if (!settings.rootDir) return <Welcome stage="dir" />
  if (!tree) return <Welcome stage="create" />

  return <Shell />
}

function Shell(): JSX.Element {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)

  return (
    <div className="app">
      <Toolbar
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />
      <Workspace leftOpen={leftOpen} rightOpen={rightOpen} />
    </div>
  )
}

function Workspace({
  leftOpen,
  rightOpen
}: {
  leftOpen: boolean
  rightOpen: boolean
}): JSX.Element {
  const [leftW, setLeftW] = useState(260)
  const [rightW, setRightW] = useState(340)

  return (
    <div className="workspace">
      {leftOpen && (
        <>
          <div style={{ width: leftW }} className="col">
            <LeftPanel />
          </div>
          <Resizer onDrag={(dx) => setLeftW((w) => clamp(w + dx, 200, 480))} />
        </>
      )}
      <div className="col center-col">
        <StatsBar />
        <div className="graph-area">
          <GraphErrorBoundary>
            <GraphCanvas />
          </GraphErrorBoundary>
        </div>
        <BranchProgressChart />
      </div>
      {rightOpen && (
        <>
          <Resizer onDrag={(dx) => setRightW((w) => clamp(w - dx, 260, 560))} />
          <div style={{ width: rightW }} className="col">
            <RightPanel />
          </div>
        </>
      )}
    </div>
  )
}

function Resizer({ onDrag }: { onDrag: (dx: number) => void }): JSX.Element {
  const last = useRef<number | null>(null)
  return (
    <div
      className="resizer"
      onPointerDown={(e) => {
        last.current = e.clientX
        ;(e.target as Element).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (last.current === null) return
        const dx = e.clientX - last.current
        last.current = e.clientX
        onDrag(dx)
      }}
      onPointerUp={() => (last.current = null)}
    />
  )
}

function Welcome({ stage }: { stage: 'dir' | 'create' }): JSX.Element {
  const chooseRootDir = useTree((s) => s.chooseRootDir)
  const createTree = useTree((s) => s.createTree)
  const [name, setName] = useState('Мои навыки')

  return (
    <div className="center-screen welcome">
      <BrandLogo size={64} className="brand-icon" />
      <h1>Skill Tree</h1>
      <p className="dim">Дерево навыков в стиле игровых скилл-три.</p>

      {stage === 'dir' ? (
        <>
          <p>Выберите директорию, где будут храниться дерево и .md-заметки.</p>
          <button className="tb-btn primary" onClick={() => chooseRootDir()}>
            <FolderOpen size={16} /> Выбрать директорию
          </button>
        </>
      ) : (
        <>
          <p>Директория выбрана. Создайте дерево навыков.</p>
          <div className="create-row">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
            <button className="tb-btn primary" onClick={() => createTree(name)}>
              <Plus size={16} /> Создать
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v))
}
