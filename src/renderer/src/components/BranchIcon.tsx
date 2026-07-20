interface Props {
  size?: number
  className?: string
}

/**
 * Иконка «создать ветку» — не сам логотип (он цветной, с фоном, и на кнопках
 * 13-16px рядом с монохромными иконками lucide выглядел чужеродно), а мотив
 * ИЗ логотипа (build/icon-src/icon.svg: хаб + 3 отходящих узла) в том же
 * аутлайн-стиле, что и остальные иконки (currentColor, strokeWidth 2) —
 * визуально уравновешена с GitBranch/Boxes/CirclePlus вокруг неё.
 */
export function BranchIcon({ size = 16, className }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 14.4V8.8M10.8 14.7 7.3 7.6M13.2 14.7l3.5-7.1" />
      <circle cx="12" cy="17" r="2.6" />
      <circle cx="12" cy="7" r="1.8" />
      <circle cx="6.5" cy="6" r="1.8" />
      <circle cx="17.5" cy="6" r="1.8" />
    </svg>
  )
}
