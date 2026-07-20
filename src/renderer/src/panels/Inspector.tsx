import { useState } from 'react'
import { useTree } from '../store/treeStore'
import type { Item } from '@shared/types'
import { BRANCH_COLORS, NODE_ICONS } from '../theme'
import { LucideIcon } from '../graph/LucideIcon'

export function Inspector({ item }: { item: Item }): JSX.Element {
  const updateItem = useTree((s) => s.updateItem)
  const [iconOpen, setIconOpen] = useState(false)

  const isBranch = item.kind === 'branch'
  const kindLabel = item.kind === 'branch' ? 'Ветка' : item.kind === 'group' ? 'Группа' : 'Узел'

  return (
    <div className="block">
      <div className="block-head">
        <span>{kindLabel}</span>
      </div>

      <input
        className="title-input"
        value={item.title}
        onChange={(e) => updateItem(item.id, { title: e.target.value })}
        placeholder="Название"
      />

      <label className="settings-label">Цвет</label>
      <div className="swatches">
        {BRANCH_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch${item.color === c ? ' active' : ''}`}
            style={{ background: c }}
            onClick={() => updateItem(item.id, { color: c })}
          />
        ))}
        <input
          type="color"
          className="swatch-custom"
          value={item.color ?? '#8b5cf6'}
          onChange={(e) => updateItem(item.id, { color: e.target.value })}
          title="Свой цвет"
        />
        {!isBranch && item.color && (
          <button
            className="link-btn"
            onClick={() => updateItem(item.id, { color: undefined })}
          >
            сбросить к цвету ветки
          </button>
        )}
      </div>

      <label className="settings-label">Иконка</label>
      <button className="icon-pick" onClick={() => setIconOpen((v) => !v)}>
        <LucideIcon name={item.icon} size={18} color={item.color ?? '#8b5cf6'} />
        <span>{item.icon ?? 'выбрать'}</span>
      </button>
      {iconOpen && (
        <div className="icon-grid">
          {NODE_ICONS.map((name) => (
            <button
              key={name}
              className={`icon-cell${item.icon === name ? ' active' : ''}`}
              title={name}
              onClick={() => {
                updateItem(item.id, { icon: name })
                setIconOpen(false)
              }}
            >
              <LucideIcon name={name} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
