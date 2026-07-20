import { useMemo, useState } from 'react'
import { Plus, X, Check, Lock, Unlock, CheckCircle2 } from 'lucide-react'
import { useTree } from '../store/treeStore'
import type { Item } from '@shared/types'
import { buildMaps, computeStatus, itemProgress } from '../domain'
import { Switch } from '../components/Switch'

export function Checklist({ item }: { item: Item }): JSX.Element {
  const addEntry = useTree((s) => s.addChecklistEntry)
  const toggle = useTree((s) => s.toggleChecklistEntry)
  const remove = useTree((s) => s.deleteChecklistEntry)
  const setForceLock = useTree((s) => s.setForceLock)
  const setManualDone = useTree((s) => s.setManualDone)
  const treeItems = useTree((s) => s.tree?.items ?? [])
  const unlockMechanic = useTree((s) => s.settings.unlockMechanic)
  const [text, setText] = useState('')

  const { done, total, pct } = itemProgress(item)
  const forceLockOn = !!item.forceLocked
  const manualDone = !!item.manualDone
  const isNode = item.kind === 'node'
  // Тот же прогресс-гейт, что и на графе: пока узел заблокирован (механикой
  // разблока ИЛИ вручную), пункты чеклиста можно видеть/редактировать текст,
  // но нельзя отмечать выполненными — раньше здесь проверялся только ручной
  // forceLocked, и прогрессия молча игнорировалась, позволяя «протыкать»
  // чеклист на ещё не разблокированном узле.
  const maps = useMemo(() => buildMaps(treeItems), [treeItems])
  const gateLocked = computeStatus(item, maps, unlockMechanic) === 'locked'

  function submit(): void {
    const v = text.trim()
    if (!v) return
    addEntry(item.id, v)
    setText('')
  }

  return (
    <div className="block">
      <div className="settings-row lock-row">
        <span>
          {forceLockOn ? <Lock size={14} /> : <Unlock size={14} />} Заблокировать вручную
        </span>
        <Switch checked={forceLockOn} onChange={(on) => setForceLock(item.id, on)} />
      </div>
      {forceLockOn && (
        <p className="dim small lock-hint">
          Узел и всё вложенное заблокированы независимо от прогресса чеклиста.
        </p>
      )}
      {!forceLockOn && gateLocked && (
        <p className="dim small lock-hint">
          Узел ещё заблокирован механикой разблока — выполните родительский узел, чтобы отмечать пункты.
        </p>
      )}

      {isNode && (
        <div className="settings-row lock-row">
          <span>
            <CheckCircle2 size={14} /> Пометить как выполненное
          </span>
          <Switch checked={manualDone} onChange={(on) => setManualDone(item.id, on)} />
        </div>
      )}
      {manualDone && (
        <p className="dim small lock-hint">
          Навык считается освоенным без заполнения чеклиста.
        </p>
      )}

      <div className="block-head">
        <span>Чеклист</span>
        <span className="dim small">
          {done}/{total} · {pct}%
        </span>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <ul className="checklist">
        {item.checklist.map((c) => (
          <li key={c.id} className={c.done ? 'done' : ''}>
            <button
              className="check"
              disabled={gateLocked}
              title={gateLocked ? 'Разблокируйте узел, чтобы отмечать пункты' : undefined}
              onClick={() => toggle(item.id, c.id)}
            >
              {c.done && <Check size={13} />}
            </button>
            <span className="check-text">{c.text}</span>
            <button className="icon-btn xs danger" onClick={() => remove(item.id, c.id)}>
              <X size={13} />
            </button>
          </li>
        ))}
        {item.checklist.length === 0 && <li className="dim small">Пунктов пока нет.</li>}
      </ul>

      <div className="checklist-add">
        <input
          value={text}
          placeholder="Новый пункт…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="icon-btn" onClick={submit}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
