const SVGNS = 'http://www.w3.org/2000/svg'

export interface RasterizeOptions {
  /** Резолвленные CSS custom properties (--text, --bg-graph, --font-ui, ...) —
   *  инлайнятся на корневой <svg> клона, см. комментарий ниже про var(). */
  varsStyle: Record<string, string>
  /** Рисовать сплошной фон цветом varsStyle['--bg-graph'] или оставить
   *  прозрачным (альфа-канал PNG). */
  background: boolean
  /** Множитель разрешения растеризации (2 = экспорт в 2×). */
  scale?: number
}

/**
 * Растеризует граф (любой <svg> с известным id корневой группы контента —
 * у живого интерактивного графа это "graph-content", у StaticGraphSvg —
 * "static-graph-content") в PNG data URL: клонирует, кадрирует по bbox
 * содержимого, сериализует в отдельный SVG-документ и рисует через canvas в
 * заданном масштабе.
 */
export async function rasterizeGraphSvg(
  svg: SVGSVGElement,
  contentId: string,
  { varsStyle, background, scale = 2 }: RasterizeOptions
): Promise<string | null> {
  const content = svg.querySelector(`#${CSS.escape(contentId)}`) as SVGGElement | null
  if (!content) return null

  const bbox = content.getBBox()
  if (bbox.width === 0 || bbox.height === 0) return null

  const pad = 80
  const vbX = bbox.x - pad
  const vbY = bbox.y - pad
  const vbW = bbox.width + pad * 2
  const vbH = bbox.height + pad * 2

  const clone = svg.cloneNode(true) as SVGSVGElement
  const cloneContent = clone.querySelector(`#${CSS.escape(contentId)}`) as SVGGElement
  cloneContent.removeAttribute('transform')

  // Сериализованный SVG рендерится браузером как ОТДЕЛЬНЫЙ документ (см.
  // new Image()/data: URL ниже) и не видит ни styles.css, ни :root — любой
  // var(--xxx) без явного значения в этом документе падает на initial (для
  // fill это чёрный), что на тёмном фоне выглядит как «текст вообще
  // пропал». Инлайним РЕЗОЛВЛЕННЫЕ значения нужных custom properties прямо на
  // корневой <svg> клона — вниз по дереву они наследуются обычным CSS-
  // каскадом независимо от контекста документа, в котором их парсят.
  const varsCss = Object.entries(varsStyle)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
  clone.setAttribute('style', varsCss)
  clone.setAttribute('font-family', varsStyle['--font-ui'] ?? "'Inter', sans-serif")

  // Удаляем прозрачный hit-прямоугольник панорамы (у живого интерактивного графа).
  clone.querySelectorAll(':scope > rect').forEach((r) => r.remove())

  clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
  clone.setAttribute('width', String(vbW))
  clone.setAttribute('height', String(vbH))

  if (background) {
    const bg = document.createElementNS(SVGNS, 'rect')
    bg.setAttribute('x', String(vbX))
    bg.setAttribute('y', String(vbY))
    bg.setAttribute('width', String(vbW))
    bg.setAttribute('height', String(vbH))
    bg.setAttribute('fill', varsStyle['--bg-graph'] ?? '#000000')
    clone.insertBefore(bg, clone.firstChild)
  }

  const xml = new XMLSerializer().serializeToString(clone)
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vbW * scale)
  canvas.height = Math.round(vbH * scale)
  const ctx = canvas.getContext('2d')!

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export async function saveGraphPng(defaultName: string, dataUrl: string): Promise<boolean> {
  return window.api.savePng(defaultName, dataUrl)
}
