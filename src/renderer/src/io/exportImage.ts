const SVGNS = 'http://www.w3.org/2000/svg'

/**
 * Сериализует текущий граф в PNG: клонирует SVG, кадрирует по bbox содержимого,
 * растеризует через canvas в 2× и отдаёт main-процессу на сохранение.
 */
export async function exportGraphPng(defaultName: string): Promise<boolean> {
  const svg = document.getElementById('skill-graph-svg') as SVGSVGElement | null
  if (!svg) return false
  const content = svg.querySelector('#graph-content') as SVGGElement | null
  if (!content) return false

  const bbox = content.getBBox()
  if (bbox.width === 0 || bbox.height === 0) return false

  const pad = 80
  const vbX = bbox.x - pad
  const vbY = bbox.y - pad
  const vbW = bbox.width + pad * 2
  const vbH = bbox.height + pad * 2

  const clone = svg.cloneNode(true) as SVGSVGElement
  const cloneContent = clone.querySelector('#graph-content') as SVGGElement
  cloneContent.removeAttribute('transform')

  // Сериализованный SVG рендерится браузером как отдельный документ и не
  // наследует font-family из styles.css (body) — без явного шрифта на корне
  // <text> падает на дефолтный UA-шрифт (на Windows это засечковый), поэтому
  // прописываем тот же стек шрифтов, что и в styles.css, прямо на клоне.
  clone.setAttribute(
    'font-family',
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  )

  // Удаляем прозрачный hit-прямоугольник панорамы
  clone.querySelectorAll(':scope > rect').forEach((r) => r.remove())

  clone.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`)
  clone.setAttribute('width', String(vbW))
  clone.setAttribute('height', String(vbH))

  // Тёмный фон
  const bg = document.createElementNS(SVGNS, 'rect')
  bg.setAttribute('x', String(vbX))
  bg.setAttribute('y', String(vbY))
  bg.setAttribute('width', String(vbW))
  bg.setAttribute('height', String(vbH))
  bg.setAttribute('fill', '#000000')
  clone.insertBefore(bg, clone.firstChild)

  const xml = new XMLSerializer().serializeToString(clone)
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vbW * scale)
  canvas.height = Math.round(vbH * scale)
  const ctx = canvas.getContext('2d')!

  const dataUrl = await new Promise<string | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = url
  })

  if (!dataUrl) return false
  return window.api.savePng(defaultName, dataUrl)
}
