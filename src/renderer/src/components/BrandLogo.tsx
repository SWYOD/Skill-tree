interface Props {
  size?: number
  className?: string
  /** boxed — тот же фирменный значок, что и иконка приложения (тёмный
   *  скруглённый квадрат + узел с тремя ветками), для крупных мест вроде
   *  экрана приветствия. plain — тот же узел БЕЗ фона, только сам глиф, но
   *  перерисованный компактно (сплошная заливка вместо тонких контуров),
   *  чтобы не превращаться в нечитаемое пятно в мелких местах вроде шапки. */
  variant?: 'boxed' | 'plain'
}

/**
 * Цвета берутся из текущей темы (var(--accent) / var(--bg-panel)), а не
 * захардкожены — логотип внутри приложения подстраивается под активную тему
 * (фиолетовый в AMOLED, зелёный в Nuxt и т.д.). Статическая иконка приложения
 * в ОС (build/icon-src/icon.svg → .icns/.ico) — отдельный файл, собирается
 * один раз при сборке и темой рантайма не управляется в принципе.
 *
 * geometry этого компонента (variant="boxed") и иконки ОС больше НЕ совпадают
 * один в один — иконка ОС часто показывается совсем мелко (16-32px в
 * таскбаре/доке), поэтому у неё узлы перерисованы сплошной заливкой без
 * тонких колец. variant="boxed" здесь всегда рендерится крупно (экран
 * приветствия), поэтому детальный вид с кольцами там уместен и не трогался.
 */
export function BrandLogo({ size = 22, className, variant = 'boxed' }: Props): JSX.Element {
  if (variant === 'plain') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Хаб (r=3) и листья (r=2.15) вместе не симметричны относительно
            центра viewBox сами по себе — координаты подобраны так, чтобы
            центр их ОБЩЕГО видимого силуэта совпадал с центром viewBox
            (иначе в строке шапки глиф визуально сползает вниз). */}
        <g stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" fill="none">
          <line x1="12" y1="15.03" x2="12" y2="9.23" />
          <line x1="12" y1="15.03" x2="7.5" y2="8.93" />
          <line x1="12" y1="15.03" x2="16.5" y2="8.93" />
        </g>
        <circle cx="12" cy="15.03" r="3" fill="var(--accent)" />
        <circle cx="12" cy="8.13" r="2.15" fill="var(--accent)" />
        <circle cx="7" cy="8.13" r="2.15" fill="var(--accent)" />
        <circle cx="17" cy="8.13" r="2.15" fill="var(--accent)" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="16" y="16" width="480" height="480" rx="112" ry="112" fill="var(--bg-panel)" />

      {/* Глиф чуть крупнее относительно рамки, чем в исходной иконке —
          масштаб вокруг геометрического центра кластера узлов (256,262). */}
      <g transform="translate(256,262) scale(1.08) translate(-256,-262)">
        <g stroke="var(--accent)" strokeWidth={10} strokeLinecap="round" fill="none">
          <line x1="256" y1="340" x2="256" y2="230" />
          <line x1="256" y1="340" x2="160" y2="200" />
          <line x1="256" y1="340" x2="352" y2="200" />
        </g>

        <circle cx="256" cy="340" r="46" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth={12} />
        <circle cx="256" cy="340" r="46" fill="var(--accent)" opacity={0.16} />

        <circle cx="256" cy="212" r="30" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth={10} />
        <circle cx="256" cy="212" r="30" fill="var(--accent)" opacity={0.16} />

        <circle cx="152" cy="184" r="30" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth={10} />
        <circle cx="152" cy="184" r="30" fill="var(--accent)" opacity={0.16} />

        <circle cx="360" cy="184" r="30" fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth={10} />
        <circle cx="360" cy="184" r="30" fill="var(--accent)" opacity={0.16} />
      </g>
    </svg>
  )
}
