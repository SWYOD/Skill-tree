interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** Стилизованный toggle-switch (не нативный checkbox) — для бинарных настроек. */
export function Switch({ checked, onChange }: Props): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  )
}
