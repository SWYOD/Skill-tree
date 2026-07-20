import type { Item, ItemStatus, SkillTree } from '@shared/types'

/**
 * Прогресс узла по чеклисту. Ручная отметка «уже освоено» (manualDone) —
 * для навыков без чеклиста — считается как 100% без необходимости писать пункты.
 */
export function itemProgress(item: Item): { done: number; total: number; pct: number } {
  if (item.manualDone) return { done: 1, total: 1, pct: 100 }
  const total = item.checklist.length
  const done = item.checklist.filter((c) => c.done).length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, pct }
}

export interface DerivedMaps {
  byId: Map<string, Item>
  childrenOf: Map<string | null, Item[]>
}

/** Индексы: узел по id и упорядоченные дети по parentId. */
export function buildMaps(items: Item[]): DerivedMaps {
  const byId = new Map<string, Item>()
  const childrenOf = new Map<string | null, Item[]>()
  for (const it of items) byId.set(it.id, it)
  for (const it of items) {
    const list = childrenOf.get(it.parentId) ?? []
    list.push(it)
    childrenOf.set(it.parentId, list)
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.order - b.order)
  return { byId, childrenOf }
}

/** true — узел без единого пункта в СВОЁМ чеклисте, который существует только
 *  как папка для вложенных узлов (нечего засчитывать ему самому). */
function isTransparentContainer(item: Item, maps: DerivedMaps): boolean {
  if (item.kind !== 'node') return false
  const hasChildren = (maps.childrenOf.get(item.id)?.length ?? 0) > 0
  return hasChildren && itemProgress(item).total === 0
}

/**
 * Базовый статус узла (без учёта разблока):
 * done — чеклист выполнен на 100%; in_progress — частично; иначе available.
 * Узел со СВОИМ чеклистом (или manualDone) берёт статус из него всегда — даже
 * если у него при этом есть дети (см. например «Основные принципы»: у него и
 * свой чеклист, и вложенные под-узлы; чеклист узла — его личный прогресс, а
 * не «обёртка», раньше здесь ошибочно проверялось только hasChildren, из-за
 * чего такой узел никогда не получал done, несмотря на 100% своего чеклиста,
 * и его дети оставались заблокированы навечно).
 * Ветка/группа и «прозрачные» узлы-контейнеры (свой checklist пустой,
 * реальные пункты — только у вложенных, см. «Сеточные системы и
 * компоновка») агрегируют статус по НЕ-прозрачным узлам-потомкам — пропуская
 * такие же пустые узлы-«папки», которым самим нечего засчитывать.
 */
function baseStatus(item: Item, maps: DerivedMaps): ItemStatus {
  if (item.kind === 'node' && item.manualDone) return 'done'
  if (item.kind === 'node') {
    const { total, pct } = itemProgress(item)
    if (total > 0) {
      if (pct === 100) return 'done'
      if (pct > 0) return 'in_progress'
      return 'available'
    }
    if (!isTransparentContainer(item, maps)) return 'available'
  }
  const requiredNodes = collectDescendants(item.id, maps).filter(
    (d) => d.kind === 'node' && !isTransparentContainer(d, maps)
  )
  if (requiredNodes.length === 0) return 'available'
  const allDone = requiredNodes.every((n) => {
    const { total, pct } = itemProgress(n)
    return total > 0 && pct === 100
  })
  if (allDone) return 'done'
  const anyProgress = requiredNodes.some((n) => itemProgress(n).done > 0)
  return anyProgress ? 'in_progress' : 'available'
}

/** Цепочка предков узла от родителя до главной ветки (id-шники). */
export function ancestorsOf(id: string, maps: DerivedMaps): string[] {
  const out: string[] = []
  let cur = maps.byId.get(id)
  while (cur && cur.parentId) {
    out.push(cur.parentId)
    cur = maps.byId.get(cur.parentId)
  }
  return out
}

/** Порог общего числа элементов, начиная с которого дерево считается «большим» и
 *  граф по умолчанию частично сворачивается (см. defaultGraphCollapsed) — на
 *  скромных деревьях такое поведение только мешало бы лишним кликом «развернуть». */
const LARGE_TREE_THRESHOLD = 40
/** Сколько колец глубины от каждой главной ветки показываем полностью (1 — сама
 *  ветка, 2 — её прямые дети, 3 — внуки); всё глубже сворачивается — и в
 *  дефолте на больших деревьях, и в ручном тумблере «3+» на графе. */
const DEFAULT_VISIBLE_RINGS = 3

/**
 * id родителей на границе видимых колец (DEFAULT_VISIBLE_RINGS) — если их
 * свернуть, от каждой главной ветки останутся видны только первые
 * DEFAULT_VISIBLE_RINGS колец, а всё глубже спрячется (раскрыть конкретную
 * ветвь — вручную маркером +/− прямо на графе). Используется и для дефолтного
 * сворачивания больших деревьев (defaultGraphCollapsed), и для ручного
 * тумблера «3+» в GraphCanvas.tsx (там — независимо от размера дерева).
 */
export function ringCollapseIds(items: Item[], maps: DerivedMaps): Set<string> {
  const out = new Set<string>()
  for (const item of items) {
    const depth = ancestorsOf(item.id, maps).length
    const hasChildren = (maps.childrenOf.get(item.id)?.length ?? 0) > 0
    if (depth === DEFAULT_VISIBLE_RINGS - 1 && hasChildren) out.add(item.id)
  }
  return out
}

/**
 * Стартовый набор id, свёрнутых на графе (graphCollapsed) для только что
 * загруженного/импортированного дерева. На небольших деревьях граф по
 * умолчанию показывается целиком (пусто — как решили раньше); на больших —
 * см. ringCollapseIds.
 */
export function defaultGraphCollapsed(items: Item[], maps: DerivedMaps): Set<string> {
  if (items.length <= LARGE_TREE_THRESHOLD) return new Set()
  return ringCollapseIds(items, maps)
}

/**
 * Ближайшая ветка — сам элемент, если это ветка, иначе первый предок с kind
 * 'branch' (узлы теперь могут быть вложены друг в друга сколь угодно глубоко,
 * поэтому «своя» ветка узла — не обязательно прямой родитель).
 */
export function nearestBranch(item: Item, maps: DerivedMaps): Item | null {
  let cur: Item | undefined = item
  while (cur) {
    if (cur.kind === 'branch') return cur
    cur = cur.parentId ? maps.byId.get(cur.parentId) : undefined
  }
  return null
}

/**
 * Цвет элемента — свой (`item.color`, обычно есть только у веток) либо
 * унаследованный от ближайшего цветного предка. Общая логика для графа
 * (`GraphCanvas.tsx`) и левого дерева (`LeftPanel.tsx`) — раньше дерево слева
 * читало только `item.color` напрямую, и узлы без своего цвета показывали
 * кружок нейтральным `currentColor` (в светлой теме — тёмный, заметный на
 * светлом фоне), тогда как граф уже цветил их по ближайшей ветке.
 */
export function colorFor(item: Item, maps: DerivedMaps): string {
  let cur: Item | undefined = item
  while (cur) {
    if (cur.color) return cur.color
    cur = cur.parentId ? maps.byId.get(cur.parentId) : undefined
  }
  return '#8b5cf6'
}

/**
 * Множество узлов «в фокусе» при наведении/выборе (эффект Watch Dogs):
 * сам узел + путь от центра к нему; если это ветка — плюс всё её поддерево.
 */
export function focusSet(activeId: string, maps: DerivedMaps): Set<string> {
  const set = new Set<string>([activeId])
  for (const a of ancestorsOf(activeId, maps)) set.add(a)
  const active = maps.byId.get(activeId)
  if (active?.kind === 'branch' || active?.kind === 'group') {
    for (const d of collectDescendants(activeId, maps)) set.add(d.id)
  }
  return set
}

export function collectDescendants(id: string, maps: DerivedMaps): Item[] {
  const out: Item[] = []
  const stack = [...(maps.childrenOf.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    out.push(cur)
    const kids = maps.childrenOf.get(cur.id)
    if (kids) stack.push(...kids)
  }
  return out
}

/** true, если сам элемент или любой его предок принудительно заблокирован. */
export function isForceLocked(item: Item, maps: DerivedMaps): boolean {
  let cur: Item | undefined = item
  while (cur) {
    if (cur.forceLocked) return true
    cur = cur.parentId ? maps.byId.get(cur.parentId) : undefined
  }
  return false
}

/**
 * Итоговый статус с учётом механики разблока: узел locked, если его
 * родитель-узел ещё не done. Ветки и узлы прямо под веткой не блокируются.
 * Принудительная блокировка (forceLocked) старше всего остального и
 * действует независимо от unlockMechanic и статуса чеклиста.
 */
export function computeStatus(
  item: Item,
  maps: DerivedMaps,
  unlockMechanic: boolean
): ItemStatus {
  if (isForceLocked(item, maps)) return 'locked'
  const base = baseStatus(item, maps)
  if (!unlockMechanic || item.kind !== 'node') return base
  const parent = item.parentId ? maps.byId.get(item.parentId) : null
  if (parent && parent.kind === 'node') {
    const parentStatus = baseStatus(parent, maps)
    if (parentStatus !== 'done' && base !== 'done') return 'locked'
  }
  return base
}

/** Узел с самым свежим updatedAt (для блока «последний изменённый»). */
export function lastModified(tree: SkillTree | null): Item | null {
  if (!tree || tree.items.length === 0) return null
  return tree.items.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
}

/** Агрегированная статистика по дереву (задел под будущий раздел статистики). */
export function treeStats(tree: SkillTree | null): {
  branches: number
  nodes: number
  doneNodes: number
  pct: number
} {
  if (!tree) return { branches: 0, nodes: 0, doneNodes: 0, pct: 0 }
  const nodes = tree.items.filter((i) => i.kind === 'node')
  const branches = tree.items.filter((i) => i.kind === 'branch').length
  const doneNodes = nodes.filter((n) => {
    const { total, pct } = itemProgress(n)
    return total > 0 && pct === 100
  }).length
  const pct = nodes.length === 0 ? 0 : Math.round((doneNodes / nodes.length) * 100)
  return { branches, nodes: nodes.length, doneNodes, pct }
}

/** Сколько узлов-потомков ветки готово / всего (для статистики по конкретной ветке). */
export function branchProgress(
  branchId: string,
  maps: DerivedMaps
): { done: number; total: number } {
  const nodes = collectDescendants(branchId, maps).filter((d) => d.kind === 'node')
  const done = nodes.filter((n) => {
    const { total, pct } = itemProgress(n)
    return total > 0 && pct === 100
  }).length
  return { done, total: nodes.length }
}

/**
 * Частичный («призрачный») прогресс ветки — доля выполнения, усреднённая по
 * ВСЕМ узлам-потомкам (тот же знаменатель, что и в branchProgress: количество
 * узлов), а не по сумме пунктов чеклиста. Раньше суммировались done/total
 * чеклиста напрямую — из-за этого узлы без чеклиста и без manualDone просто
 * выпадали из знаменателя (давали 0/0), и один вручную отмеченный узел в
 * ветке из 10 узлов давал 1/1 = 100% вместо ожидаемых ~10%. Здесь каждый узел
 * вносит свою долю pct/100 в сумму, делённую на общее число узлов.
 */
export function branchChecklistProgress(
  branchId: string,
  maps: DerivedMaps
): { done: number; total: number } {
  const nodes = collectDescendants(branchId, maps).filter((d) => d.kind === 'node')
  let doneFraction = 0
  for (const n of nodes) {
    doneFraction += itemProgress(n).pct / 100
  }
  return { done: doneFraction, total: nodes.length }
}

export type PacePeriod = 'day' | 'week' | 'month'

const PACE_PERIOD_DAYS: Record<PacePeriod, number> = { day: 1, week: 7, month: 30 }

/**
 * Сколько узлов реально завершено (по их completedAt) за последний
 * выбранный период — БЕЗ экстраполяции в «за неделю»: пересчёт дневного
 * всплеска ×7 (был в первой версии) как раз и давал завышенную, шумную
 * цифру для «День» — один активный день выглядел как «126 навыков в
 * неделю». Возвращаем сырое количество, единицы измерения (день/нед/мес)
 * подставляет сам вызывающий код в зависимости от periода.
 */
export function completedInPeriod(nodes: Item[], period: PacePeriod): number {
  const days = PACE_PERIOD_DAYS[period]
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000
  return nodes.filter((n) => n.completedAt && n.completedAt >= sinceMs).length
}
