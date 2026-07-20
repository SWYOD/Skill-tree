interface Props {
  size?: number
  className?: string
}

/**
 * Точная копия утверждённого логотипа приложения — та же геометрия,
 * что и в build/icon-src/icon.svg (координаты не пересчитываются вручную).
 */
export function BrandLogo({ size = 22, className }: Props): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="#08080a" />

      <g stroke="#8b5cf6" strokeWidth={10} strokeLinecap="round" fill="none">
        <line x1="256" y1="340" x2="256" y2="230" />
        <line x1="256" y1="340" x2="160" y2="200" />
        <line x1="256" y1="340" x2="352" y2="200" />
      </g>

      <circle cx="256" cy="340" r="46" fill="#08080a" stroke="#8b5cf6" strokeWidth={12} />
      <circle cx="256" cy="340" r="46" fill="#8b5cf6" opacity={0.16} />

      <circle cx="256" cy="212" r="30" fill="#08080a" stroke="#8b5cf6" strokeWidth={10} />
      <circle cx="256" cy="212" r="30" fill="#8b5cf6" opacity={0.16} />

      <circle cx="152" cy="184" r="30" fill="#08080a" stroke="#8b5cf6" strokeWidth={10} />
      <circle cx="152" cy="184" r="30" fill="#8b5cf6" opacity={0.16} />

      <circle cx="360" cy="184" r="30" fill="#08080a" stroke="#8b5cf6" strokeWidth={10} />
      <circle cx="360" cy="184" r="30" fill="#8b5cf6" opacity={0.16} />
    </svg>
  )
}
