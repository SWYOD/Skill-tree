import { useEffect } from 'react'
import { Checklist } from '../panels/Checklist'
import { NoteEditor } from '../notes/NoteEditor'
import { ThemeCard } from '../components/ThemeCard'
import { BrandLogo } from '../components/BrandLogo'
import { BUILTIN_THEMES } from '../themes/builtins'
import { applyThemeVars, resolveTheme } from '../themes/apply'
import { useTree } from '../store/treeStore'
import type { Item, SkillTree } from '@shared/types'

/**
 * Дев-only витрина отдельных компонентов с демо-данными — для скриншотов
 * документации вместо навигации по всему приложению. НЕ попадает в прод-сборку
 * (см. main.tsx: динамический импорт за import.meta.env.DEV-гейтом).
 * Открывается на http://localhost:5173/#gallery при запущенном `npm run dev`.
 */

const now = Date.now()

const demoUnlockedNode: Item = {
  id: 'demo-unlocked',
  kind: 'node',
  parentId: null,
  title: 'Основы темы',
  order: 0,
  checklist: [
    { id: 'c1', text: 'Прочитать документацию', done: true },
    { id: 'c2', text: 'Настроить окружение', done: true },
    { id: 'c3', text: 'Собрать первый пример', done: false }
  ],
  createdAt: now,
  updatedAt: now
}

const demoLockedNode: Item = {
  id: 'demo-locked',
  kind: 'node',
  parentId: null,
  title: 'Продвинутая тема',
  order: 1,
  checklist: [
    { id: 'c1', text: 'Изучить основы (заблокировано вручную)', done: false },
    { id: 'c2', text: 'Практика на примерах', done: false }
  ],
  createdAt: now,
  updatedAt: now,
  forceLocked: true
}

const demoNoteNode: Item = {
  id: 'demo-note',
  kind: 'node',
  parentId: null,
  title: 'Заметка о рендер-движках',
  order: 2,
  checklist: [],
  createdAt: now,
  updatedAt: now
}

const demoTree: SkillTree = {
  meta: { id: 'demo', name: 'Демо', createdAt: now, updatedAt: now },
  items: [demoUnlockedNode, demoLockedNode, demoNoteNode]
}

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        display: 'inline-block',
        verticalAlign: 'top',
        margin: '0 24px 24px 0',
        padding: 16,
        background: 'var(--bg)',
        borderRadius: 12
      }}
    >
      <div style={{ color: 'var(--text-faint)', fontSize: 11, marginBottom: 10, fontFamily: 'monospace' }}>
        {title}
      </div>
      <div style={{ width: 340 }}>{children}</div>
    </div>
  )
}

export function Gallery(): JSX.Element {
  const themeId = useTree((s) => s.settings.themeId)
  const customThemes = useTree((s) => s.settings.customThemes)

  useEffect(() => {
    useTree.setState((s) => ({
      tree: demoTree,
      ready: true,
      settings: { ...s.settings, rootDir: '/demo' }
    }))
  }, [])

  useEffect(() => {
    const theme = resolveTheme(themeId, customThemes)
    applyThemeVars({ vars: theme.vars, dark: theme.dark })
  }, [themeId, customThemes])

  return (
    <div style={{ background: 'var(--bg-panel)', minHeight: '100vh', padding: 24, color: 'var(--text)' }}>
      <Card title="Checklist — разблокированный узел">
        <div className="panel right-panel" style={{ padding: 12 }}>
          <Checklist item={demoUnlockedNode} />
        </div>
      </Card>

      <Card title="Checklist — заблокированный узел">
        <div className="panel right-panel" style={{ padding: 12 }}>
          <Checklist item={demoLockedNode} />
        </div>
      </Card>

      <Card title="NoteEditor — заметка">
        <div className="panel right-panel" style={{ padding: 12 }}>
          <NoteEditor item={demoNoteNode} />
        </div>
      </Card>

      <Card title="BrandLogo — boxed (крупный, экран приветствия)">
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <BrandLogo size={64} />
          <BrandLogo size={96} />
        </div>
      </Card>

      <Card title="BrandLogo — plain (компактный, шапка)">
        <div className="toolbar" style={{ padding: '8px 12px', display: 'inline-flex' }}>
          <BrandLogo size={26} variant="plain" />
        </div>
      </Card>

      <Card title="Галерея тем">
        <div className="theme-grid">
          {BUILTIN_THEMES.map((t) => (
            <ThemeCard key={t.id} theme={t} active={t.id === 'amoled'} onClick={() => {}} />
          ))}
        </div>
      </Card>
    </div>
  )
}
