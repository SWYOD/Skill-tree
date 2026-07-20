import type { Item } from '@shared/types'
import { buildMaps } from '../domain'

export const INNER_RADIUS = 135
export const RING_GAP = 125
/** Доля окружности, реально занятая секторами (остальное — зазоры между ними). */
const PACKING_FACTOR = 0.92
/**
 * Минимальный АБСОЛЮТНЫЙ зазор (рад) между соседними ветками — сверх того, что
 * даёт PACKING_FACTOR. PACKING_FACTOR срезает долю от wedge каждой ветки
 * ПРОПОРЦИОНАЛЬНО её же размеру — у веток с маленькой долей листьев (мало
 * видимых детей, особенно после схлопывания) получавшийся зазор был настолько
 * крошечным, что первые кольца соседних веток фактически накладывались друг на
 * друга прямо на стыке. Абсолютный пол не зависит от размера wedge.
 */
const MIN_WEDGE_GAP = 0.05
/** Мягкий потолок на долю круга под одну ветку, чтобы одинокая большая ветка
 *  не обвивала почти весь круг, оставляя остальные в узкой щели. */
const MAX_WEDGE_SHARE = 0.62
/**
 * Радиусы кружков (px, до масштаба radiusScale) — должны буквально совпадать
 * с isContainer-развилкой в NodeGlyph.tsx (r = (isContainer ? 24 : 20) * s),
 * иначе минимальный зазор здесь и реальный размер нарисованного круга разъедутся.
 */
const NODE_RADIUS_PX = 20
const CONTAINER_RADIUS_PX = 24
/** Небольшой запас (px, до масштаба) сверх суммы радиусов двух соседних кругов —
 *  без него любые двое соседей едва касаются друг друга впритык. */
const NODE_GAP_PX = 6
/**
 * Небольшой запас (px, до масштаба) между СОСЕДЯМИ внутри контура (см.
 * buildSubtree ниже) — специально отдельно от MIN_WEDGE_GAP: тот фиксирован
 * в радианах и одинаков что для главных веток (большой радиус), что для
 * глубоко вложенных узлов (маленький локальный own из-за большого радиуса
 * кольца) — на глубоких узких кольцах этот фиксированный довесок начинал
 * ДОМИНИРОВАТЬ над честным геометрическим требованием и раздувал зазор
 * непропорционально (Red Team «отталкивался» от соседних листьев намного
 * сильнее, чем требовали их собственные кружки). EXTRA_GAP_PX переводится в
 * радианы через ЛОКАЛЬНЫЙ radiusForDepth той же глубины, где сравниваются
 * контуры — согласовано по единицам с own, а не константа сама по себе.
 */
const EXTRA_GAP_PX = 3
/**
 * Какая доля недостающего радиуса уходит в рост самого хаба (INNER_RADIUS), а не
 * в шаг между кольцами. Хаб можно немного увеличивать (иначе весь запас идёт в
 * расстояние между кольцами, и линия от ветки до первого ребёнка выглядит
 * неоправданно длинной). 0.15 = 15% в хаб, 85% — поровну между кольцами.
 */
const HUB_GROWTH_SHARE = 0.15
/**
 * На сколько «эталонных» колец (RING_GAP-шагов от хаба) распределяем недостающий
 * запас радиуса. РАНЬШЕ весь запас уходил ЦЕЛИКОМ в первый хоп «ветка → её прямые
 * дети» (первое кольцо резко отлетало от хаба, а все следующие кольца шли обычным
 * шагом) — при дефолтном схлопывании глубоких деревьев (см. defaultGraphCollapsed
 * в domain.ts) реальная «толпа» узлов, ради которой этот запас вообще нужен, чаще
 * оказывается на 2-3-м кольце, а не на первом, так что раздувать именно первый
 * прыжок было не только не нужно, но и визуально выглядело как неоправданно
 * длинный «спик» от центра до первой ветки. Теперь запас размазывается РАВНОМЕРНО
 * по REFERENCE_HOP_COUNT кольцам — каждый шаг растёт на одну и ту же (гораздо
 * меньшую) величину, а не всё сразу в первом.
 */
const REFERENCE_HOP_COUNT = 3

export interface Point {
  x: number
  y: number
}

export interface LaidNode {
  item: Item
  x: number
  y: number
  /** Угол (рад) от центра — для ориентации подписей. */
  angle: number
  radius: number
  /** Глубина ВНУТРИ поддерева ветки (0 = сама ветка) — используется, чтобы
   *  прятать подписи глубоких (тесно упакованных) колец до бОльшего зума, чем
   *  у первого кольца (см. ZOOM_LABEL_THRESHOLD_DEEP в GraphCanvas.tsx). */
  depth: number
  branchId: string
  color: string
  /** Реально имеет детей (независимо от того, свёрнут ли сейчас на графе) —
   *  на графе рисуем маркер +/− для ручного сворачивания/разворачивания. */
  hasChildren: boolean
}

export interface LaidEdge {
  id: string
  fromId: string | null // null = центр
  toId: string
  from: Point
  to: Point
  color: string
}

export interface BranchSector {
  branchId: string
  color: string
  startAngle: number
  endAngle: number
}

export interface Layout {
  nodes: LaidNode[]
  edges: LaidEdge[]
  sectors: BranchSector[]
  /** Радиус до самого дальнего узла (для авто-масштаба). */
  extent: number
  /** Фактический радиус внутреннего кольца в этой раскладке (см. BASELINE_LEAVES). */
  innerRadius: number
}

/** Число «листьев» поддерева — того, что реально нужно расставить по дуге.
 *  Родитель без единого ВИДИМОГО потомка (схлопнут, или правда бездетный)
 *  считается за 1 (сам выступает как лист). */
function countLeaves(
  id: string,
  maps: ReturnType<typeof buildMaps>,
  collapsed: Set<string>
): number {
  const kids = collapsed.has(id) ? [] : maps.childrenOf.get(id) ?? []
  if (kids.length === 0) return 1
  return kids.reduce((sum, k) => sum + countLeaves(k.id, maps, collapsed), 0)
}

/**
 * Делит totalWedge между несколькими соседями: каждый сперва гарантированно
 * получает свой mins[i] (то, что ему реально нужно), а весь ОСТАТОК сверху
 * распределяется пропорционально weights[i] (честная доля по числу листьев).
 * Раньше вместо этого каждый сосед получал max(доля_от_ВСЕГО_totalWedge, min) —
 * из-за этого лист рядом с крупной веткой получал долю от УЖЕ раздутого ради
 * этой ветки totalWedge, а не от того, что нужно ЕМУ САМОМУ — вокруг листа
 * оставалась пустая, никем не занятая дуга (см. скриншот с «Информационная
 * безопасность»: два узла-листа рядом с «Red Team» стояли с большими пустыми
 * промежутками). Здесь лишнее место достаётся ТОЛЬКО тем, у кого выше вес,
 * а не размазывается по всем поровну от общей суммы.
 * Сумма результата всегда равна totalWedge (без отдельного шага-корректора).
 */
function allocateSlices(totalWedge: number, mins: number[], weights: number[]): number[] {
  const sumMin = mins.reduce((a, b) => a + b, 0)
  if (sumMin >= totalWedge || mins.length === 0) {
    // Даже голые минимумы не помещаются — сжимаем все пропорционально (крайний
    // случай; при нормальной работе бинарный поиск по extra этого не допускает).
    const shrink = sumMin > 0 ? totalWedge / sumMin : 0
    return mins.map((m) => m * shrink)
  }
  const leftover = totalWedge - sumMin
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1
  return mins.map((m, i) => m + (weights[i] / totalWeight) * leftover)
}

/**
 * Радиальная раскладка: главные ветки/группы распределяются по окружности —
 * угол каждой пропорционален числу листьев в её поддереве (иначе большая
 * ветка получает тот же угол, что и маленькая, и её содержимое слипается).
 * Поддерево каждой ветки раскладывается РЕКУРСИВНО (см. placeSubtree) — на
 * каждом уровне угловой сектор родителя делится между его детьми в той же
 * пропорционально-с-полом логике, что и главные ветки между собой. Раньше
 * это работало только на самом верхнем уровне, а дальше внутрь ветки отдавали
 * d3.hierarchy+tree().separation() — тот расставляет соседей эвристически (по
 * относительному «весу» листьев), но не знает, что у разных колец РАЗНЫЙ
 * радиус, а значит один и тот же угол на кольце №1 (близко к хабу) даёт
 * заметно более короткую дугу, чем на кольце №3 — из-за этого узкие ветки
 * (мало общих потомков, но несколько собственных прямых детей на первом
 * кольце) регулярно накладывались друг на друга, и патчи по частным случаям
 * (вес по числу листьев, вес по глубине) снимали симптом, но не сам источник.
 * `collapsed` — id, свёрнутые НА САМОМ ГРАФЕ (своё, отдельное от левой панели
 * состояние — см. graphCollapsed в сторе): их дети не попадают ни в подсчёт
 * листьев, ни в саму раскладку. По умолчанию пусто — граф показывает дерево
 * целиком; схлопывание — опциональный ручной инструмент прямо на графе.
 */
export function computeLayout(
  items: Item[],
  color: (item: Item) => string,
  collapsed: Set<string> = new Set()
): Layout {
  const maps = buildMaps(items)
  const childrenOfVisible = (id: string): Item[] =>
    collapsed.has(id) ? [] : maps.childrenOf.get(id) ?? []
  // Корневые сектора — ветки И группы (группа верхнего уровня — тоже полноценный
  // сектор графа, просто объединяет несколько веток/узлов под одной подписью;
  // раньше сюда попадали только 'branch', и любая ветка, перенесённая внутрь
  // корневой группы, вместе со всем поддеревом просто пропадала с графа).
  const mainBranches = (maps.childrenOf.get(null) ?? []).filter(
    (i) => i.kind === 'branch' || i.kind === 'group'
  )

  const nodes: LaidNode[] = []
  const edges: LaidEdge[] = []
  const sectors: BranchSector[] = []

  const leafCounts = mainBranches.map((b) => countLeaves(b.id, maps, collapsed))
  const totalLeaves = leafCounts.reduce((a, b) => a + b, 0) || 1

  /** Число ВСЕХ видимых узлов (не только листьев) — GraphCanvas.tsx считает
   *  визуальный размер кружков именно от него (nodeScaleFor(layout.nodes.length)).
   *  Нужен здесь же (не только там), чтобы минимальный зазор ниже считался от
   *  ТОГО ЖЕ масштаба, что и реальный нарисованный радиус круга — иначе при
   *  частичном сворачивании (см. graphCollapsed/«3+») число листьев и число
   *  видимых узлов расходятся по-разному, и рассинхрон между «на сколько
   *  сжались круги» и «на сколько сжались зазоры между ними» давал наложение. */
  function countVisible(id: string): number {
    const kids = childrenOfVisible(id)
    return 1 + kids.reduce((sum, k) => sum + countVisible(k.id), 0)
  }
  const totalVisibleNodes = mainBranches.reduce((sum, b) => sum + countVisible(b.id), 0) || 1

  // Базовые константы (INNER_RADIUS/RING_GAP/радиусы кружков) сжимаются тем же
  // множителем, что и сами узлы (nodeScaleFor) — иначе на больших деревьях узлы
  // становятся мельче, а расстояния между кольцами остаются теми же самыми
  // «взрослыми» значениями, и граф выглядит непропорционально разрежённым
  // (пользователь явно попросил ужать ВСЕ кольца целиком, не только первое).
  // Расстояние нужно меньше, когда сами круги меньше — масштабируем оба вместе.
  const radiusScale = nodeScaleFor(totalVisibleNodes)
  const innerRadiusBase = INNER_RADIUS * radiusScale
  const ringGapBase = RING_GAP * radiusScale
  /** Радиус круга ИМЕННО ТАКОГО же вида, что рисует NodeGlyph.tsx для этого
   *  item — используется, чтобы минимум по дуге считался от РЕАЛЬНОГО размера
   *  круга, а не от приблизительной константы «на лист», которая раньше не
   *  учитывала, что ветки/группы рисуются заметно крупнее узлов. */
  function circleRadiusFor(item: Item): number {
    return (item.kind === 'node' ? NODE_RADIUS_PX : CONTAINER_RADIUS_PX) * radiusScale
  }

  /** Контур поддерева: для каждой АБСОЛЮТНОЙ глубины, встречающейся внутри —
   *  половина требуемой угловой ширины влево/вправо ОТ УГЛА САМОГО item. */
  interface Profile {
    left: Map<number, number>
    right: Map<number, number>
  }
  /** Узел построенного (снизу вверх) дерева контуров — offsets[i] — угол
   *  центра children[i] ОТНОСИТЕЛЬНО угла САМОГО item (уже отцентрирован). */
  interface ContourNode {
    item: Item
    depth: number
    profile: Profile
    offsets: number[]
    children: ContourNode[]
  }

  /**
   * Для пробного запаса радиуса extraCandidate строит контур каждого главного
   * сектора СНИЗУ ВВЕРХ и упаковывает детей ВПЛОТНУЮ слева направо на каждом
   * уровне — раздвигая пару соседей только там (на той глубине), где их
   * контуры реально пересекаются, а не резервируя каждому одну и ту же
   * колонку на всю глубину его поддерева (как раньше делал minWedgeFor —
   * узел-лист рядом с веткой получал долю от уже раздутой ради этой ветки
   * ширины, и вокруг листа оставалась пустая, никем не занятая дуга).
   * footprintOf(item) = максимум left+right НЕЗАВИСИМО по каждой стороне (не
   * max одной и той же глубины) — то, сколько РЕАЛЬНО нужно сектору целиком;
   * если брать max(left[d]+right[d]) на одной глубине, у асимметричных
   * поддеревьев (пик слева и пик справа на разных глубинах) получится MEНЬШЕ
   * реального — сектор резервировался бы уже, чем есть на самом деле, и
   * оказывался — при отрисовке — вылезал в соседнюю главную ветку.
   */
  function contourFor(extraCandidate: number): {
    radiusForDepth: (depth: number) => number
    build: (item: Item, depth: number) => ContourNode
    footprintOf: (item: Item, depth: number) => number
  } {
    const innerR = innerRadiusBase + extraCandidate * HUB_GROWTH_SHARE
    const rGap = ringGapBase + (extraCandidate * (1 - HUB_GROWTH_SHARE)) / REFERENCE_HOP_COUNT
    const radiusForDepth = (depth: number): number => (depth <= 0 ? innerR : innerR + depth * rGap)
    const cache = new Map<string, ContourNode>()

    function build(item: Item, depth: number): ContourNode {
      const cached = cache.get(item.id)
      if (cached) return cached
      const own = (circleRadiusFor(item) + (NODE_GAP_PX * radiusScale) / 2) / radiusForDepth(depth)
      const kids = childrenOfVisible(item.id)
      let node: ContourNode
      if (kids.length === 0) {
        node = {
          item,
          depth,
          profile: { left: new Map([[depth, own]]), right: new Map([[depth, own]]) },
          offsets: [],
          children: []
        }
      } else {
        const childDepth = depth + 1
        const children = kids.map((k) => build(k, childDepth))
        const offsets: number[] = [0]
        const mergedRight = new Map<number, number>(children[0].profile.right)
        for (let i = 1; i < children.length; i++) {
          let need = 0
          for (const [d, lv] of children[i].profile.left) {
            const rv = mergedRight.get(d)
            if (rv !== undefined) {
              need = Math.max(need, rv + lv + (EXTRA_GAP_PX * radiusScale) / radiusForDepth(d))
            }
          }
          offsets.push(need)
          for (const [d, rv] of children[i].profile.right) {
            mergedRight.set(d, Math.max(mergedRight.get(d) ?? -Infinity, offsets[i] + rv))
          }
        }
        // Центрируем item над серединой между первым и последним ребёнком
        // (как в классическом Reingold–Tilford), а не над всей колонкой.
        const centerShift = (offsets[0] + offsets[offsets.length - 1]) / 2
        for (let i = 0; i < offsets.length; i++) offsets[i] -= centerShift
        const left = new Map<number, number>([[depth, own]])
        const right = new Map<number, number>([[depth, own]])
        children.forEach((cr, i) => {
          for (const [d, lv] of cr.profile.left) left.set(d, Math.max(left.get(d) ?? 0, lv - offsets[i]))
          for (const [d, rv] of cr.profile.right) right.set(d, Math.max(right.get(d) ?? 0, rv + offsets[i]))
        })
        node = { item, depth, profile: { left, right }, offsets, children }
      }
      cache.set(item.id, node)
      return node
    }

    // ВАЖНО: только для ГЛАВНЫХ секторов (footprintOf вызывается исключительно
    // на mainBranches, не рекурсивно внутри build) — симметрично, 2×max(left,
    // right), а не просто maxLeft+maxRight. Сама ветка/группа рисуется ПРЯМО
    // на дуге сектора на кольце хаба, и глаз ожидает, что её кружок стоит по
    // центру своего же неонового сегмента; asymmetричный футпринт (когда
    // maxLeft != maxRight — например, соседи узкие слева и широкие справа,
    // как «Криптография/Основы pentest» слева и «Red Team» справа) иначе
    // заставлял бы САМУ ветку сместиться от центра сектора, чтобы не
    // сжимать более требовательную сторону — геометрически безопасно, но
    // визуально выглядело как баг (см. скриншот пользователя). Небольшая
    // цена — чуть больше запасного места на этом (и только этом) уровне.
    function footprintOf(item: Item, depth: number): number {
      const n = build(item, depth)
      let maxLeft = 0
      let maxRight = 0
      for (const v of n.profile.left.values()) maxLeft = Math.max(maxLeft, v)
      for (const v of n.profile.right.values()) maxRight = Math.max(maxRight, v)
      return 2 * Math.max(maxLeft, maxRight)
    }

    return { radiusForDepth, build, footprintOf }
  }

  // Растим запас радиуса (extra), пока сумма настоящих футпринтов всех
  // главных секторов не влезет в полный круг — гарантирует отсутствие
  // наложений НА ЛЮБОЙ глубине сразу, поскольку рост extra монотонно
  // увеличивает radiusForDepth на каждой глубине и тем самым монотонно
  // уменьшает footprintOf — обычный бинарный поиск.
  function totalFootprintSum(extraCandidate: number): number {
    const { footprintOf } = contourFor(extraCandidate)
    let sum = 0
    for (const b of mainBranches) sum += footprintOf(b, 0) + MIN_WEDGE_GAP
    return sum
  }
  let hi = 2000
  while (totalFootprintSum(hi) > Math.PI * 2 && hi < 1e7) hi *= 2
  let lo = 0
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (totalFootprintSum(mid) <= Math.PI * 2) hi = mid
    else lo = mid
  }
  const extra = hi
  const { radiusForDepth, build, footprintOf } = contourFor(extra)
  const innerRadius = radiusForDepth(0)

  let extent = innerRadius

  const rawSlices = allocateSlices(
    Math.PI * 2,
    mainBranches.map((b) => footprintOf(b, 0) + MIN_WEDGE_GAP),
    leafCounts.map((n) => Math.min(n / totalLeaves, MAX_WEDGE_SHARE))
  )

  function place(
    node: ContourNode,
    angle: number,
    parentPos: Point,
    parentId: string | null,
    branchId: string,
    branchColor: string
  ): void {
    const radius = radiusForDepth(node.depth)
    const pos: Point = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    extent = Math.max(extent, radius)
    nodes.push({
      item: node.item,
      x: pos.x,
      y: pos.y,
      angle,
      radius,
      depth: node.depth,
      branchId,
      color: color(node.item),
      hasChildren: (maps.childrenOf.get(node.item.id)?.length ?? 0) > 0
    })
    edges.push({
      id: `${parentId ?? 'center'}->${node.item.id}`,
      fromId: parentId,
      toId: node.item.id,
      from: parentPos,
      to: pos,
      color: branchColor
    })
    node.children.forEach((child, i) => place(child, angle + node.offsets[i], pos, node.item.id, branchId, branchColor))
  }

  let cursor = -Math.PI / 2 // старт сверху, идём по часовой стрелке

  mainBranches.forEach((branch, i) => {
    const fullSlice = rawSlices[i]
    const packed = Math.max(0, Math.min(fullSlice * PACKING_FACTOR, fullSlice - MIN_WEDGE_GAP))
    const footprint = footprintOf(branch, 0)
    // Финальный сектор никогда не сжимается ниже собственного футпринта ветки,
    // даже если PACKING_FACTOR/общее сжатие иначе увели бы его меньше.
    const wedge = Math.min(fullSlice, Math.max(packed, footprint))
    const baseAngle = cursor + fullSlice / 2
    cursor += fullSlice

    const branchColor = color(branch)

    sectors.push({
      branchId: branch.id,
      color: branchColor,
      startAngle: baseAngle - wedge / 2,
      endAngle: baseAngle + wedge / 2
    })

    // Сама ветка стоит ТОЧНО по центру своего сектора (baseAngle) — footprintOf
    // для главных секторов уже симметричный (2×max(left,right), см. выше),
    // так что и левая, и правая половина её поддерева гарантированно
    // помещаются в [baseAngle-wedge/2, baseAngle+wedge/2] без доп. сдвига.
    const built = build(branch, 0)
    const centerEdgeFrom: Point = {
      x: Math.cos(baseAngle) * innerRadius,
      y: Math.sin(baseAngle) * innerRadius
    }
    place(built, baseAngle, centerEdgeFrom, null, branch.id, branchColor)
  })

  return { nodes, edges, sectors, extent, innerRadius }
}

/**
 * Множитель размера узла/шрифта в зависимости от общего числа элементов —
 * без этого большие деревья превращаются в нечитаемое и некликабельное
 * месиво из одинаково крупных кружков.
 */
export function nodeScaleFor(totalItems: number): number {
  if (totalItems <= 24) return 1
  if (totalItems <= 45) return 0.88
  if (totalItems <= 70) return 0.76
  if (totalItems <= 110) return 0.64
  if (totalItems <= 180) return 0.55
  if (totalItems <= 280) return 0.46
  return 0.4
}
