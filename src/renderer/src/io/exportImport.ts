import { nanoid } from 'nanoid'
import type { Item, SkillTree } from '@shared/types'
import { collectDescendants, buildMaps } from '../domain'

const FORMAT = 'skill-tree'
const VERSION = 1

interface Bundle {
  format: typeof FORMAT
  version: number
  kind: 'tree' | 'branch'
  name: string
  items: Item[]
  meta?: SkillTree['meta']
}

/** Экспорт всего дерева в JSON-файл. */
export async function exportTree(tree: SkillTree): Promise<boolean> {
  const bundle: Bundle = {
    format: FORMAT,
    version: VERSION,
    kind: 'tree',
    name: tree.meta.name,
    meta: tree.meta,
    items: tree.items
  }
  const safe = tree.meta.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')
  return window.api.exportJson(`${safe || 'skill-tree'}.json`, bundle)
}

/** Экспорт отдельной ветки с поддеревом. */
export async function exportBranch(tree: SkillTree, branchId: string): Promise<boolean> {
  const maps = buildMaps(tree.items)
  const branch = maps.byId.get(branchId)
  if (!branch) return false
  const subtree = [branch, ...collectDescendants(branchId, maps)]
  // Отвязываем корень ветки от родителя для переносимости
  const items = subtree.map((it) =>
    it.id === branchId ? { ...it, parentId: null } : { ...it }
  )
  const bundle: Bundle = {
    format: FORMAT,
    version: VERSION,
    kind: 'branch',
    name: branch.title,
    items
  }
  const safe = branch.title.replace(/[^\p{L}\p{N}_-]+/gu, '_')
  return window.api.exportJson(`${safe || 'branch'}.json`, bundle)
}

function isBundle(x: unknown): x is Bundle {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as Bundle).format === FORMAT &&
    Array.isArray((x as Bundle).items)
  )
}

/** Перегенерация id при импорте ветки (чтобы не конфликтовать с текущими). */
function regenIds(items: Item[]): Item[] {
  const idMap = new Map<string, string>()
  for (const it of items) idMap.set(it.id, nanoid())
  return items.map((it) => ({
    ...it,
    id: idMap.get(it.id)!,
    parentId: it.parentId ? idMap.get(it.parentId) ?? null : null,
    // Заметки привязаны к id — сбрасываем путь, т.к. файл не переносится вместе с JSON
    notePath: undefined
  }))
}

/**
 * Импорт файла ЛЮБОГО kind как ветки — не заменяет текущее дерево, а
 * добавляет содержимое файла поверх него с перегенерацией id, независимо
 * от того, что записано в kind самого файла (tree или branch). Отдельная
 * кнопка в тулбаре — чтобы пользователь не мог случайно импортировать файл
 * дерева как замену всего текущего дерева, когда на самом деле хотел
 * добавить ветку.
 */
export async function importBranchFromFile(): Promise<Item[] | null> {
  const raw = await window.api.importJson()
  if (!isBundle(raw)) return null
  return regenIds(raw.items)
}

export type ImportResult =
  | { kind: 'tree'; tree: SkillTree }
  | { kind: 'branch'; items: Item[] }
  | null

/**
 * Импорт из JSON. Дерево — заменяет текущее; ветка — возвращает элементы
 * с новыми id для добавления в текущее дерево.
 */
export async function importFromFile(): Promise<ImportResult> {
  const raw = await window.api.importJson()
  if (!isBundle(raw)) return null

  if (raw.kind === 'tree') {
    const now = Date.now()
    const tree: SkillTree = {
      meta: raw.meta ?? { id: nanoid(), name: raw.name, createdAt: now, updatedAt: now },
      items: raw.items
    }
    return { kind: 'tree', tree }
  }

  return { kind: 'branch', items: regenIds(raw.items) }
}
