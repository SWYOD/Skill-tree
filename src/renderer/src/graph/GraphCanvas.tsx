import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Minus, Maximize2, RotateCw, ChevronsDownUp, ChevronsUpDown, Check, Trash2 } from 'lucide-react'
import { useTree } from '../store/treeStore'
import { buildMaps, colorFor, collectDescendants, computeStatus, focusSet, ringCollapseIds } from '../domain'
import { effectiveVariant, resolveTheme } from '../themes/apply'
import { computeLayout, nodeScaleFor, INNER_RADIUS } from './layout'
import type { Point } from './layout'
import { NodeGlyph } from './NodeGlyph'
import type { NodeEmphasis } from './NodeGlyph'
import { EdgeLine } from './EdgeLine'
import { Switch } from '../components/Switch'
import type { Item, ItemStatus } from '@shared/types'

interface Transform {
  x: number
  y: number
  k: number
}

const MIN_K = 0.25
const MAX_K = 2.5
/** Максимальная задержка (сек) появления самого дальнего от хаба узла при перерисовке. */
const MAX_REVEAL_STAGGER = 0.5
/**
 * Порог масштаба, ниже которого подписи узлов (не веток) скрываются через CSS
 * (см. .node-label-leaf в styles.css). Граф по умолчанию показывает дерево
 * ПОЛНОСТЬЮ (все кружки и связи — вся форма видна сразу), но при таком общем
 * виде на больших деревьях текст мельче этого масштаба физически нечитаем и
 * только накладывается друг на друга — поэтому подписи отдельных навыков
 * появляются постепенно по мере приближения зумом к нужной области, а не все
 * разом. Меняем только className на #graph-content (один узел), а не пропсы
 * отдельных NodeGlyph — иначе на сотнях узлов каждый тик зума пере-рендерил бы
 * их все и графу это стоило бы производительности.
 */
const ZOOM_LABEL_THRESHOLD = 0.85
/**
 * Второй, более высокий порог — для колец глубины depth>=2 (внуки и глубже,
 * см. LaidNode.depth). Эти кольца угловым шагом упакованы плотнее первого
 * (у каждого depth1-родителя свои depth2-дети внутри той же узкой дуги), и на
 * зуме, где уже комфортно читаются подписи ПЕРВОГО кольца, подписи ВТОРОГО и
 * глубже ещё налезают друг на друга — им нужен собственный, больший порог.
 */
const ZOOM_LABEL_THRESHOLD_DEEP = 1.4
/** Задержка (мс) до появления поп-апа с полным названием и чеклистом узла —
 *  не мгновенно, иначе всплывал бы при простом «пробегании» курсором по графу. */
const HOVER_POPUP_DELAY = 550

export function GraphCanvas(): JSX.Element {
  const tree = useTree((s) => s.tree)
  const selectedId = useTree((s) => s.selectedId)
  const select = useTree((s) => s.select)
  const toggleChecklistEntry = useTree((s) => s.toggleChecklistEntry)
  const setManualDone = useTree((s) => s.setManualDone)
  const deleteItem = useTree((s) => s.deleteItem)
  const addChild = useTree((s) => s.addChild)
  const requestReveal = useTree((s) => s.requestReveal)
  // Мультивыделение из левого дерева — граф только подсвечивает, не управляет им.
  const multiSelected = useTree((s) => s.multiSelected)
  // Свёрнутые ветки/узлы НА ГРАФЕ — своё отдельное состояние (НЕ то же самое,
  // что collapsed в левой панели): по умолчанию пусто, граф всегда показывает
  // дерево целиком; сворачивание — опциональный ручной инструмент на графе.
  const graphCollapsed = useTree((s) => s.graphCollapsed)
  const setGraphCollapsed = useTree((s) => s.setGraphCollapsed)
  // Опциональная связь: если включена кнопкой-тумблером в левой панели —
  // граф и дерево слева используют ОДНО общее состояние свёрнутых элементов.
  const collapsed = useTree((s) => s.collapsed)
  const setCollapsed = useTree((s) => s.setCollapsed)
  const graphTreeLinked = useTree((s) => s.graphTreeLinked)
  const effectiveCollapsed = graphTreeLinked ? collapsed : graphCollapsed
  const setEffectiveCollapsed = graphTreeLinked ? setCollapsed : setGraphCollapsed
  const unlockMechanic = useTree((s) => s.settings.unlockMechanic)
  const edgeAnim = useTree((s) => s.settings.edgeAnim)
  const themeId = useTree((s) => s.settings.themeId)
  const customThemes = useTree((s) => s.settings.customThemes)
  const themeMode = useTree((s) => s.settings.themeMode)
  const isDarkTheme = useMemo(
    () => effectiveVariant(resolveTheme(themeId, customThemes), themeMode).dark,
    [themeId, customThemes, themeMode]
  )

  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [t, setT] = useState<Transform>({ x: 0, y: 0, k: 1 })
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(
    null
  )
  const userAdjusted = useRef(false)
  /** true на время ОДНОГО клика сразу после панорамирования — mouseup, которым
   *  заканчивается перетаскивание графа, порождает нативный click на фоне
   *  графа (не на узле-владельце поп-апа), и без этого флага document-level
   *  click-листенер ниже принимал бы его за «клик мимо» и закрывал поп-ап
   *  сразу после того, как графом просто подвинули. Взводится в onPointerMove
   *  в момент перехода в реальное панорамирование, гасится однократно самим
   *  же обработчиком клика (см. onDocClick). */
  const justPanned = useRef(false)
  const prevTreeId = useRef<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  /** Id узла, для которого сейчас показан поп-ап (название целиком + чеклист) —
   *  появляется, если узел ЗАЖАЛИ (mousedown) и продержали HOVER_POPUP_DELAY.
   *  Закрывается ТОЛЬКО явным кликом мимо (см. document-level листенер ниже) —
   *  ни простое отпускание кнопки, ни панорама/зум графа его не закрывают:
   *  поп-ап остаётся открытым и едет вместе с узлом (позиция считается от
   *  актуального t на каждый рендер, см. px/py в JSX ниже). */
  const [popupId, setPopupId] = useState<string | null>(null)
  // Для document-листенера ниже (регистрируется один раз, closure иначе видел
  // бы popupId только на момент монтирования) — держим синхронную копию.
  const popupIdRef = useRef<string | null>(null)
  popupIdRef.current = popupId
  const popupTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Растёт при нажатии «Перерисовать» — меняет key узлов/рёбер, заставляя их
   *  перемонтироваться и заново проиграть анимацию появления (см. revealDelay). */
  const [replayGen, setReplayGen] = useState(0)

  function closePopup(): void {
    if (popupTimer.current) {
      clearTimeout(popupTimer.current)
      popupTimer.current = null
    }
    setPopupId(null)
  }

  /** Зажали узел (mousedown) — если продержат HOVER_POPUP_DELAY, покажется
   *  поп-ап (закрывает любой уже показанный поп-ап другого узла первым делом). */
  function handleHoldStart(id: string): void {
    closePopup()
    popupTimer.current = setTimeout(() => setPopupId(id), HOVER_POPUP_DELAY)
  }

  // Клик мимо поп-апа (в т.ч. по другому узлу или по фону графа) — закрыть его.
  // ВАЖНО: отпускание зажатой кнопки мыши на ТОМ ЖЕ узле, что открыл поп-ап,
  // тоже порождает нативный click по этому узлу — без исключения это закрывало
  // бы поп-ап сразу же после появления, ещё до того, как палец/курсор успел
  // уйти куда-то ещё. Поэтому клик именно по узлу-владельцу поп-апа игнорируем.
  useEffect(() => {
    function onDocClick(e: MouseEvent): void {
      if (justPanned.current) {
        // Это хвостовой click от только что законченного панорамирования —
        // не «клик мимо», гасим флаг и ничего не закрываем.
        justPanned.current = false
        return
      }
      const target = e.target as Element
      if (target.closest?.('.node-popup')) return
      const heldId = popupIdRef.current
      if (heldId && target.closest?.(`[data-node-id="${heldId}"]`)) return
      closePopup()
    }
    document.addEventListener('click', onDocClick, true)
    return () => document.removeEventListener('click', onDocClick, true)
  }, [])

  const rawItems = tree?.items ?? []
  // Элементы, скрытые «глазиком» в левом дереве (+ всё вложенное в них) — не
  // рисуем на графе вовсе, но сами данные/дерево слева их не теряют. Строим
  // maps по ПОЛНОМУ списку (до фильтра), иначе collectDescendants не увидит
  // детей уже отфильтрованного скрытого родителя.
  const items = useMemo(() => {
    if (!rawItems.some((it) => it.hidden)) return rawItems
    const rawMaps = buildMaps(rawItems)
    const hiddenSet = new Set<string>()
    for (const it of rawItems) {
      if (!it.hidden) continue
      hiddenSet.add(it.id)
      for (const d of collectDescendants(it.id, rawMaps)) hiddenSet.add(d.id)
    }
    return rawItems.filter((it) => !hiddenSet.has(it.id))
  }, [rawItems])

  const colorOf = useMemo(() => {
    const maps = buildMaps(items)
    return (item: Item): string => colorFor(item, maps)
  }, [items])

  const layout = useMemo(
    () => computeLayout(items, (i) => colorOf(i), effectiveCollapsed),
    [items, colorOf, effectiveCollapsed]
  )
  // Масштаб узлов — по числу РЕАЛЬНО нарисованных узлов (после схлопывания),
  // а не по общему числу элементов в дереве: свёрнутые ветки/группы не должны
  // делать оставшиеся видимые узлы мельче, чем нужно.
  const nodeScale = useMemo(() => nodeScaleFor(layout.nodes.length), [layout.nodes.length])
  const maps = useMemo(() => buildMaps(items), [items])
  // Подпись в хабе («МОИ НАВЫКИ») раньше была фиксированного размера — на больших
  // деревьях сам хаб (layout.innerRadius) сжимается вместе с остальным графом
  // (см. radiusScale в layout.ts), а текст оставался прежнего размера и вылезал
  // за пределы кольца. Масштабируем текст той же пропорцией, что и сам хаб.
  const hubTextScale = Math.max(0.5, layout.innerRadius / INNER_RADIUS)

  function toggleGraphCollapse(id: string): void {
    setEffectiveCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Кнопка «3+» — id родителей на границе первых 3 колец от каждой главной
  // ветки (см. ringCollapseIds в domain.ts — та же логика, что и у дефолтного
  // сворачивания больших деревьев, но здесь доступна вручную и независимо от
  // размера дерева). «Активно», если ВСЕ эти id сейчас свёрнуты.
  const ringTargetIds = useMemo(() => ringCollapseIds(items, maps), [items, maps])
  const isRingCompact =
    ringTargetIds.size > 0 && [...ringTargetIds].every((id) => effectiveCollapsed.has(id))
  function toggleRingCompact(): void {
    setEffectiveCollapsed(isRingCompact ? new Set() : new Set(ringTargetIds))
  }

  // Все id (веток и узлов) с реальными детьми — основа для «Свернуть всё» на
  // графе: сворачиваем/разворачиваем именно их, а не производные узлы-группы.
  const idsWithChildren = useMemo(
    () => items.filter((i) => (maps.childrenOf.get(i.id)?.length ?? 0) > 0).map((i) => i.id),
    [items, maps]
  )
  const anyGraphExpanded = idsWithChildren.some((id) => !effectiveCollapsed.has(id))
  function toggleCollapseAllGraph(): void {
    setEffectiveCollapsed(anyGraphExpanded ? new Set(idsWithChildren) : new Set())
  }

  /** Задержка появления по расстоянию от хаба — дальние узлы «прорастают» позже. */
  function revealDelayFor(radius: number): number {
    const maxRadius = layout.extent || 1
    return (radius / maxRadius) * MAX_REVEAL_STAGGER
  }

  /**
   * Дальние узлы рисуем немного мельче ближних (до FAR_SHRINK меньше на самом
   * внешнем кольце) — иначе внешний охват графа целиком определяется размером
   * САМЫХ дальних кружков, и общий fitView() приходится ужимать даже когда
   * основная (ближняя к хабу) часть дерева ещё легко читалась бы крупнее.
   */
  function distanceScaleFor(radius: number): number {
    const span = layout.extent - layout.innerRadius
    const ratio = span > 0 ? (radius - layout.innerRadius) / span : 0
    const FAR_SHRINK = 0.35
    return 1 - Math.min(1, Math.max(0, ratio)) * FAR_SHRINK
  }

  // Bounding box содержимого (для fitView и для ограничения панорамирования —
  // см. boundsRef ниже). Держим и в ref, чтобы замыкания внутри useEffect'ов
  // с пустым deps-массивом (wheel-listener) всегда читали актуальное значение,
  // не пересоздавая сам listener на каждый рендер.
  const contentBounds = useMemo(() => {
    let minX = -layout.innerRadius
    let maxX = layout.innerRadius
    let minY = -layout.innerRadius
    let maxY = layout.innerRadius
    for (const n of layout.nodes) {
      const m = (n.item.kind === 'branch' || n.item.kind === 'group' ? 46 : 40) * nodeScale
      minX = Math.min(minX, n.x - m)
      maxX = Math.max(maxX, n.x + m)
      minY = Math.min(minY, n.y - m)
      maxY = Math.max(maxY, n.y + m + 24) // запас на подпись снизу
    }
    return { minX, maxX, minY, maxY }
  }, [layout.nodes, nodeScale])
  const boundsRef = useRef(contentBounds)
  boundsRef.current = contentBounds

  /**
   * Не даёт панораме/зуму увести содержимое ПОЛНОСТЬЮ за пределы экрана.
   * Без этого лёгкий уйти «в никуда» несколькими быстрыми зумами/жестами —
   * граф пропадает из вида, и выглядит это как «не удалось отрисовать граф»,
   * хотя рендер на самом деле в порядке, просто камера далеко от содержимого.
   * Кнопка «по центру» это чинит, но пользователь не обязан о ней знать.
   */
  function clampPan(x: number, y: number, k: number, viewW: number, viewH: number): Point {
    const b = boundsRef.current
    const MIN_VISIBLE = 72
    let nx = x
    let ny = y
    const vcx = viewW / 2
    const vcy = viewH / 2
    const left = vcx + nx + b.minX * k
    const right = vcx + nx + b.maxX * k
    if (right < MIN_VISIBLE) nx += MIN_VISIBLE - right
    else if (left > viewW - MIN_VISIBLE) nx -= left - (viewW - MIN_VISIBLE)
    const top = vcy + ny + b.minY * k
    const bottom = vcy + ny + b.maxY * k
    if (bottom < MIN_VISIBLE) ny += MIN_VISIBLE - bottom
    else if (top > viewH - MIN_VISIBLE) ny -= top - (viewH - MIN_VISIBLE)
    return { x: nx, y: ny }
  }

  const statusById = useMemo(() => {
    const m = new Map<string, ItemStatus>()
    for (const it of items) m.set(it.id, computeStatus(it, maps, unlockMechanic))
    return m
  }, [items, maps, unlockMechanic])

  // Фокус (эффект Watch Dogs): наведение приоритетнее всего (даже открытого
  // поп-апа) — hover на ДРУГОМ узле должен подсвечивать его путь как обычно.
  // Но когда курсор уходит с узлов совсем (например, во время панорамирования
  // графа за пустое место — см. комментарий про justPanned выше), подсветка
  // раньше «спадала» до selectedId, из-за чего путь узла с открытым поп-апом
  // гас, хотя поп-ап оставался на экране. Поэтому второй приоритет — popupId:
  // пока поп-ап открыт, его путь остаётся зафиксирован, даже если он не
  // совпадает с выбранным (selectedId) узлом.
  const activeId = hoveredId ?? popupId ?? selectedId
  const focus = useMemo(() => {
    if (!activeId || !maps.byId.has(activeId)) return null
    return { id: activeId, set: focusSet(activeId, maps) }
  }, [activeId, maps])

  // Та же подсветка пути, что и у hover/select, но сразу для ВСЕХ элементов
  // мультивыделения из левого дерева — объединяем их focusSet (путь до хаба +
  // поддерево, если это ветка) в один набор.
  const multiFocusSet = useMemo(() => {
    if (multiSelected.size === 0) return null
    const set = new Set<string>()
    for (const id of multiSelected) {
      if (!maps.byId.has(id)) continue
      for (const f of focusSet(id, maps)) set.add(f)
    }
    return set
  }, [multiSelected, maps])

  // Объединённый набор «подсвеченного»: путь под hover/select + пути всех
  // мультивыделенных узлов. Если активен хоть один из источников — всё, что
  // вне набора, притемняется (как раньше умел только одиночный фокус).
  const highlighted = useMemo(() => {
    if (!focus && !multiFocusSet) return null
    const set = new Set<string>(focus?.set ?? [])
    if (multiFocusSet) for (const id of multiFocusSet) set.add(id)
    return set
  }, [focus, multiFocusSet])

  function emphasisOf(id: string): NodeEmphasis {
    if (!highlighted) return 'none'
    if (id === focus?.id) return 'focused'
    if (highlighted.has(id)) return 'related'
    return 'dimmed'
  }

  function edgeLit(fromId: string | null, toId: string): boolean {
    if (!highlighted) return false
    return (fromId === null || highlighted.has(fromId)) && highlighted.has(toId)
  }

  /**
   * «Далёкая» блокировка: элемент заблокирован и находится дальше одного шага
   * от точки блокировки — рисуем серым (но с замком). Точка блокировки — это
   * либо родитель с явным forceLocked (ручная блокировка начинается СРАЗУ под
   * ним, поэтому его прямые дети всегда «near»), либо обычный каскад: если сам
   * родитель уже locked (независимо от причины), значит текущий элемент как
   * минимум на шаг дальше точки блокировки. Работает одинаково для обеих
   * механик (прогрессия и ручной forceLock) и не зависит от kind.
   */
  function isFarLocked(id: string): boolean {
    if (statusById.get(id) !== 'locked') return false
    const parentId = maps.byId.get(id)?.parentId
    if (!parentId) return false
    const parent = maps.byId.get(parentId)
    if (parent?.forceLocked) return false
    return statusById.get(parentId) === 'locked'
  }

  // Таймер поп-апа переживать размонтирование графа не должен.
  useEffect(() => () => {
    if (popupTimer.current) clearTimeout(popupTimer.current)
  }, [])

  // Размер контейнера
  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  function fitView(): void {
    const { minX, maxX, minY, maxY } = contentBounds
    const pad = 70
    const bw = maxX - minX + pad * 2
    const bh = maxY - minY + pad * 2
    const k = Math.max(MIN_K, Math.min(MAX_K, Math.min(size.w / bw, size.h / bh)))
    const ccx = (minX + maxX) / 2
    const ccy = (minY + maxY) / 2
    setT({ k, x: -ccx * k, y: -ccy * k })
    userAdjusted.current = false
  }

  // Смена дерева сбрасывает «ручной» флаг — новое дерево подгоняем заново.
  if (tree && prevTreeId.current !== tree.meta.id) {
    prevTreeId.current = tree.meta.id
    userAdjusted.current = false
  }

  // Авто-подгон под содержимое, пока пользователь сам не зумил/панорамировал.
  // Срабатывает и при установлении размера контейнера, и при росте дерева.
  useEffect(() => {
    if (!tree || items.length === 0) return
    if (userAdjusted.current) return
    fitView()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree?.meta.id, items.length, layout.extent, size.w, size.h])

  const cx = size.w / 2
  const cy = size.h / 2

  // Зум колесом — нативный listener с passive:false (гарантированный preventDefault).
  // Событий wheel/pointermove на большом дереве может приходить десятки в секунду —
  // без rAF-троттлинга каждое из них вызывало бы отдельный React-рендер (setT), что на
  // деревьях из сотен узлов подвешивало отрисовку. Копим множитель/смещение в ref и
  // применяем максимум раз за кадр.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let raf: number | null = null
    let acc: { factor: number; x: number; y: number } | null = null

    const flush = (): void => {
      raf = null
      if (!acc) return
      const { factor, x, y } = acc
      acc = null
      const rect = el.getBoundingClientRect()
      const mx = x - rect.left
      const my = y - rect.top
      const ccx = rect.width / 2
      const ccy = rect.height / 2
      setT((prev) => {
        const newK = Math.max(MIN_K, Math.min(MAX_K, prev.k * factor))
        const wx = (mx - (ccx + prev.x)) / prev.k
        const wy = (my - (ccy + prev.y)) / prev.k
        const nx = mx - ccx - wx * newK
        const ny = my - ccy - wy * newK
        const clamped = clampPan(nx, ny, newK, rect.width, rect.height)
        return { k: newK, x: clamped.x, y: clamped.y }
      })
    }

    const handler = (e: WheelEvent): void => {
      // Нативный listener — срабатывает раньше, чем React успел бы отреагировать
      // на onWheel самого поп-апа (тот висит выше по дереву, но это два разных
      // события-механизма, React не может опередить уже сработавший нативный).
      // Поэтому проверяем цель прямо здесь: колесо над поп-апом — это скролл его
      // чеклиста, а не зум графа.
      if ((e.target as Element).closest?.('.node-popup')) return
      e.preventDefault()
      const tick = e.deltaY < 0 ? 1.1 : 1 / 1.1
      acc = { factor: (acc?.factor ?? 1) * tick, x: e.clientX, y: e.clientY }
      userAdjusted.current = true
      if (raf == null) raf = requestAnimationFrame(flush)
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => {
      el.removeEventListener('wheel', handler)
      if (raf != null) cancelAnimationFrame(raf)
    }
  }, [])

  const dragRaf = useRef<number | null>(null)
  const dragPending = useRef<{ dx: number; dy: number } | null>(null)

  function onPointerDown(e: React.PointerEvent): void {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y, moved: false }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent): void {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 3) {
      // Панорама/зум графа больше НЕ закрывают поп-ап — он остаётся открытым и
      // едет вместе с узлом (px/py ниже и так пересчитываются от актуального
      // t на каждый рендер, так что «следование» не требует отдельного кода).
      // Закрытие — только явный клик мимо (см. document-level click ниже).
      // justPanned — чтобы хвостовой click, которым закончится это же
      // перетаскивание (на mouseup), сам не сошёл за такой «клик мимо».
      if (!drag.current.moved) justPanned.current = true
      drag.current.moved = true
      userAdjusted.current = true
    }
    dragPending.current = { dx, dy }
    if (dragRaf.current == null) {
      dragRaf.current = requestAnimationFrame(() => {
        dragRaf.current = null
        const pending = dragPending.current
        dragPending.current = null
        if (!pending || !drag.current) return
        // Снимок ДО setT: читать drag.current заново ВНУТРИ updater-колбэка небезопасно —
        // если React вызовет колбэк не в тот же синхронный момент (или повторно), к тому
        // времени drag.current мог уже стать null (например, сработал onPointerUp), и
        // .tx/.ty упадёт на null. Это и было настоящей причиной «не удалось отрисовать граф».
        const base = drag.current
        setT((prev) => {
          const clamped = clampPan(base.tx + pending.dx, base.ty + pending.dy, prev.k, size.w, size.h)
          return { ...prev, x: clamped.x, y: clamped.y }
        })
      })
    }
  }
  function onPointerUp(): void {
    // Если pointerup случился раньше следующего кадра, накопленное смещение из
    // последнего pointermove ещё не применено — досчитываем его синхронно,
    // иначе быстрый «мазок» мышью не сдвигает граф вообще (drag «теряется»).
    if (dragRaf.current != null) {
      cancelAnimationFrame(dragRaf.current)
      dragRaf.current = null
    }
    const pending = dragPending.current
    dragPending.current = null
    if (pending && drag.current) {
      const base = drag.current
      setT((prev) => {
        const clamped = clampPan(base.tx + pending.dx, base.ty + pending.dy, prev.k, size.w, size.h)
        return { ...prev, x: clamped.x, y: clamped.y }
      })
    }
    drag.current = null
  }

  return (
    <div
      ref={wrapRef}
      className="graph-wrap"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <svg id="skill-graph-svg" width={size.w} height={size.h}>
        <defs>
          {/* Тугой неоновый glow (крипко, без «мыла») — область фильтра фиксированного
              размера в userSpace, чтобы не раздувалась при масштабе и не дропалась.
              На светлом фоне тот же blur-радиус/интенсивность, что читается как чистое
              неоновое свечение на чёрном (AMOLED), превращается в грязное блёклое пятно —
              нет тёмного «холста», на котором glow обычно «горит». Поэтому в светлой теме
              держим его значительно слабее (почти акцент-обводка, не свечение). */}
          <filter
            id="glow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            filterUnits="objectBoundingBox"
          >
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation={isDarkTheme ? 2.5 : 1}
              floodColor="currentColor"
              floodOpacity={isDarkTheme ? 0.9 : 0.35}
            />
          </filter>
        </defs>

        {/* Фон-хит для пана и снятия выделения */}
        <rect
          x={0}
          y={0}
          width={size.w}
          height={size.h}
          fill="transparent"
          onClick={() => select(null)}
        />

        <g
          id="graph-content"
          className={`${t.k >= ZOOM_LABEL_THRESHOLD ? 'zoom-near' : 'zoom-far'}${
            t.k >= ZOOM_LABEL_THRESHOLD_DEEP ? ' zoom-deep' : ''
          }`}
          transform={`translate(${cx + t.x}, ${cy + t.y}) scale(${t.k})`}
          style={{ willChange: 'transform' }}
        >
          {/* Центральное кольцо — крипкое, без размытия */}
          <circle
            r={layout.innerRadius}
            fill="none"
            style={{ stroke: 'var(--border-strong)' }}
            strokeWidth={3}
          />
          {/* Цветные секторы веток на кольце — крипкие неоновые дуги */}
          {layout.sectors.map((s) => {
            const sLit = focus?.set.has(s.branchId)
            const sDim = !!focus && !sLit
            return (
              <path
                key={s.branchId}
                d={arcPath(layout.innerRadius, s.startAngle, s.endAngle)}
                fill="none"
                stroke={s.color}
                strokeWidth={sLit ? 5 : 4}
                strokeLinecap="round"
                style={{ color: s.color }}
                filter={sDim ? undefined : 'url(#glow)'}
                opacity={sDim ? 0.25 : 1}
              />
            )
          })}
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={22 * hubTextScale}
            fontWeight={700}
            letterSpacing={3 * hubTextScale}
            style={{ fill: 'var(--text)' }}
          >
            {(tree?.meta.name ?? 'НАВЫКИ').toUpperCase()}
          </text>

          {/* Рёбра под узлами */}
          {layout.edges.map((e) => (
            <EdgeLine
              key={`${e.id}:${replayGen}`}
              edge={e}
              targetStatus={statusById.get(e.toId) ?? 'available'}
              lit={edgeLit(e.fromId, e.toId)}
              dimmed={!!focus && !edgeLit(e.fromId, e.toId)}
              anim={edgeAnim}
              revealDelay={revealDelayFor(Math.hypot(e.to.x, e.to.y))}
            />
          ))}

          {/* Узлы: наведённые/связанные — крупнее (эмфазис по порядку рендера).
              Сортируем так, чтобы фокусный/связанные рисовались поверх остальных. */}
          {[...layout.nodes]
            .sort((a, b) => rank(emphasisOf(a.item.id)) - rank(emphasisOf(b.item.id)))
            .map((n) => (
              <NodeGlyph
                key={`${n.item.id}:${replayGen}`}
                node={n}
                status={statusById.get(n.item.id) ?? 'available'}
                farLocked={isFarLocked(n.item.id)}
                selected={n.item.id === selectedId}
                multiSelected={multiSelected.has(n.item.id)}
                emphasis={emphasisOf(n.item.id)}
                scale={nodeScale}
                distanceScale={distanceScaleFor(n.radius)}
                revealDelay={revealDelayFor(n.radius)}
                collapsedSelf={effectiveCollapsed.has(n.item.id)}
                hideLabel={popupId === n.item.id}
                childCount={maps.childrenOf.get(n.item.id)?.length ?? 0}
                onSelect={select}
                onHover={setHoveredId}
                onReveal={requestReveal}
                onToggleCollapse={toggleGraphCollapse}
                onHoldStart={handleHoldStart}
              />
            ))}
        </g>
      </svg>

      {popupId &&
        (() => {
          const n = layout.nodes.find((nn) => nn.item.id === popupId)
          if (!n) return null
          const px = cx + t.x + n.x * t.k
          const py = cy + t.y + n.y * t.k
          const doneCount = n.item.checklist.filter((c) => c.done).length
          // Тот же прогресс-гейт, что и в графе/правой панели: пока узел
          // заблокирован механикой разблока (или вручную), пункты чеклиста
          // смотреть можно, а отмечать выполненными — нет.
          const gateLocked = statusById.get(n.item.id) === 'locked'
          return (
            <div
              className="node-popup"
              style={{ left: px, top: py, ['--node-color' as string]: n.color }}
            >
              <div className="node-popup-header">
                <span className="node-popup-title">{n.item.title}</span>
                {n.item.checklist.length > 0 && (
                  <span className="node-popup-progress">
                    {doneCount}/{n.item.checklist.length}
                  </span>
                )}
              </div>
              {n.item.kind === 'node' && (
                <label
                  className="node-popup-manual-row"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>Пометить как выполненное</span>
                  <Switch
                    checked={!!n.item.manualDone}
                    onChange={(on) => setManualDone(n.item.id, on)}
                  />
                </label>
              )}
              {n.item.checklist.length > 0 && (
                <ul className="node-popup-checklist">
                  {n.item.checklist.map((c) => (
                    <li
                      key={c.id}
                      className={`${c.done ? 'done' : ''}${gateLocked ? ' locked' : ''}`}
                      title={gateLocked ? 'Разблокируйте узел, чтобы отмечать пункты' : undefined}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (gateLocked) return
                        toggleChecklistEntry(n.item.id, c.id)
                      }}
                    >
                      <span className="node-popup-check">{c.done && <Check size={10} />}</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="node-popup-actions">
                <button
                  className="node-popup-action"
                  onClick={(e) => {
                    e.stopPropagation()
                    addChild(n.item.id, 'node')
                    closePopup()
                  }}
                >
                  <Plus size={13} /> Создать узел
                </button>
                <button
                  className="node-popup-action danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Удалить «${n.item.title}» и всё вложенное?`)) deleteItem(n.item.id)
                  }}
                >
                  <Trash2 size={13} /> Удалить
                </button>
              </div>
            </div>
          )
        })()}

      {items.length === 0 && (
        <div className="graph-empty">
          <p>Дерево пустое.</p>
          <p className="dim">Создайте первую ветку в левой панели или кнопкой ниже.</p>
        </div>
      )}

      <div className="graph-controls-top">
        <button
          className="gc-btn"
          title="Перерисовать граф"
          onClick={() => setReplayGen((g) => g + 1)}
        >
          <RotateCw size={15} />
        </button>
        <button
          className="gc-btn"
          title={anyGraphExpanded ? 'Свернуть всё' : 'Развернуть всё'}
          onClick={toggleCollapseAllGraph}
        >
          {anyGraphExpanded ? <ChevronsDownUp size={15} /> : <ChevronsUpDown size={15} />}
        </button>
        <button
          className={`gc-btn${isRingCompact ? ' active' : ''}`}
          title={isRingCompact ? 'Показать всё дерево' : 'Показывать первые 3 кольца от хаба'}
          onClick={toggleRingCompact}
        >
          <span style={{ fontSize: 12, fontWeight: 700 }}>3+</span>
        </button>
      </div>

      <div className="graph-controls">
        <button
          className="gc-btn"
          title="Уменьшить"
          onClick={() => {
            userAdjusted.current = true
            setT((p) => ({ ...p, k: Math.max(MIN_K, p.k / 1.2) }))
          }}
        >
          <Minus size={16} />
        </button>
        <button className="gc-btn" title="По центру" onClick={fitView}>
          <Maximize2 size={15} />
        </button>
        <button
          className="gc-btn"
          title="Увеличить"
          onClick={() => {
            userAdjusted.current = true
            setT((p) => ({ ...p, k: Math.min(MAX_K, p.k * 1.2) }))
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="graph-hint">колесо — зум · перетаскивание — панорама</div>
    </div>
  )
}

/** Порядок отрисовки узлов по эмфазису: фокусный — поверх остальных. */
function rank(e: NodeEmphasis): number {
  return { dimmed: 0, none: 1, related: 2, focused: 3 }[e]
}

/** SVG-путь дуги окружности радиуса r от startAngle до endAngle. */
export function arcPath(r: number, a0: number, a1: number): string {
  const x0 = Math.cos(a0) * r
  const y0 = Math.sin(a0) * r
  const x1 = Math.cos(a1) * r
  const y1 = Math.sin(a1) * r
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}
