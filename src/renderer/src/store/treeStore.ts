import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { AppSettings, ChecklistEntry, Item, ItemKind, SkillTree, ThemeDef } from '@shared/types'
import { BRANCH_COLORS } from '../theme'
import { buildMaps, defaultGraphCollapsed } from '../domain'
import { BUILTIN_THEMES, DEFAULT_THEME_ID } from '../themes/builtins'

const now = (): number => Date.now()

function newTree(name: string): SkillTree {
  const t = now()
  return { meta: { id: nanoid(), name, createdAt: t, updatedAt: t }, items: [] }
}

function newItem(kind: ItemKind, parentId: string | null, order: number): Item {
  const t = now()
  return {
    id: nanoid(),
    kind,
    parentId,
    title: kind === 'branch' ? 'Новая ветка' : kind === 'group' ? 'Новая группа' : 'Новый узел',
    order,
    checklist: [],
    createdAt: t,
    updatedAt: t
  }
}

interface TreeState {
  settings: AppSettings
  tree: SkillTree | null
  selectedId: string | null
  ready: boolean
  /** Растёт на каждый requestReveal — сигнал «раскрыть путь и подсветить в дереве
   *  слева», отдельный от selectedId, чтобы обычный клик (только выбор) не
   *  разворачивал/скроллил дерево, а двойной клик на графе — разворачивал. */
  revealRequestId: string | null
  revealNonce: number

  init: () => Promise<void>
  chooseRootDir: () => Promise<void>
  createTree: (name: string) => Promise<void>

  select: (id: string | null) => void
  requestReveal: (id: string) => void

  /** Мультивыделение в левом дереве (Ctrl/Cmd + Shift) — в сторе, а не локально
   *  в LeftPanel, чтобы граф тоже мог подсвечивать те же элементы. */
  multiSelected: Set<string>
  setMultiSelected: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void

  /** Свёрнутые ветки/узлы в ЛЕВОЙ ПАНЕЛИ — независимо от графа (см. graphCollapsed). */
  collapsed: Set<string>
  setCollapsed: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void

  /** Свёрнутые ветки/узлы НА ГРАФЕ — своё отдельное состояние, специально НЕ
   *  синхронизировано с левой панелью (пользователь явно просил их разделить).
   *  По умолчанию пусто — граф всегда показывает дерево целиком, схлопывание
   *  доступно только как ручной инструмент прямо на самом графе. */
  graphCollapsed: Set<string>
  setGraphCollapsed: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void

  /** Если включено — сворачивание/разворачивание на графе и в левой панели
   *  используют ОДНО общее состояние (collapsed), а не раздельные. По умолчанию
   *  выключено (граф и дерево независимы) — опциональная кнопка-тумблер в левой
   *  панели. */
  graphTreeLinked: boolean
  setGraphTreeLinked: (v: boolean) => void

  addBranch: () => string
  /** Группа верхнего уровня (parentId=null) — как addBranch, но kind='group'.
   *  На графе отображается как обычный корневой сектор (см. mainBranches в
   *  layout.ts), просто объединяет несколько веток/узлов под одной подписью. */
  addGroup: () => string
  addChild: (parentId: string, kind: ItemKind) => string
  /** Создать новую группу из мультивыделенных элементов и переместить их внутрь
   *  (только те, что реально сиблинги — делят одного родителя с первым id).
   *  Возвращает id новой группы или null. */
  groupItems: (ids: string[]) => string | null
  updateItem: (id: string, patch: Partial<Item>) => void
  deleteItem: (id: string) => void
  /** Сменить branch↔node — чисто типовая смена, вложенность не меняется. */
  changeKind: (id: string, kind: ItemKind) => void
  /** Переместить элемент к новому родителю на позицию index среди сиблингов. */
  moveItem: (id: string, newParentId: string | null, index: number) => void
  /** Массовый перенос (мультивыделение в левом дереве) — та же логика на несколько id. */
  moveItems: (ids: string[], newParentId: string | null, index: number) => void
  /** Массовое удаление (мультивыделение в левом дереве). */
  deleteItems: (ids: string[]) => void
  /** Принудительная блокировка независимо от чеклиста — наследуется потомками. */
  setForceLock: (id: string, on: boolean) => void
  /** Ручная отметка «уже освоено» — для узлов без чеклиста. */
  setManualDone: (id: string, on: boolean) => void
  /** Скрыть/показать элемент на графе (быстрый тумблер «глазик» в дереве). */
  setHidden: (id: string, on: boolean) => void

  addChecklistEntry: (itemId: string, text: string) => void
  toggleChecklistEntry: (itemId: string, entryId: string) => void
  updateChecklistEntry: (itemId: string, entryId: string, text: string) => void
  deleteChecklistEntry: (itemId: string, entryId: string) => void

  setThemeId: (id: string) => void
  /** Быстрый тумблер тёмный/светлый вид ДЛЯ ТЕКУЩЕЙ темы (см. ThemeDef.altVariant). */
  setThemeMode: (mode: 'primary' | 'alt') => void
  /** Импорт/создание — добавляет (или заменяет по id, для «обновить свою
   *  тему») кастомную тему и делает её активной. */
  addCustomTheme: (theme: ThemeDef) => void
  removeCustomTheme: (id: string) => void
  setUnlockMechanic: (on: boolean) => void
  setEdgeAnim: (v: AppSettings['edgeAnim']) => void
  setFontMode: (mode: AppSettings['fontMode']) => void
  /** Выбор конкретного шрифта — переключает fontMode на 'custom' заодно,
   *  отдельно дёргать setFontMode('custom') не нужно. */
  setCustomFont: (family: string | null) => void

  replaceTree: (tree: SkillTree) => void
  appendItems: (items: Item[]) => void
  /** Переименовать дерево (заголовок в шапке приложения + подпись в хабе графа). */
  renameTree: (name: string) => void

  chooseRootDirFrom: (dir: string) => Promise<void>
  removeRecentDir: (dir: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useTree = create<TreeState>((set, get) => {
  /** Дебаунс-сохранение store.json в корневую директорию. */
  function persist(): void {
    const { settings, tree } = get()
    if (!settings.rootDir || !tree) return
    if (saveTimer) clearTimeout(saveTimer)
    const rootDir = settings.rootDir
    saveTimer = setTimeout(() => {
      window.api.saveStore(rootDir, get().tree!).catch((e) => console.error('saveStore', e))
    }, 300)
  }

  /** Обновить дерево: bump updatedAt дерева и затронутого узла, затем persist. */
  function mutate(updater: (tree: SkillTree) => SkillTree): void {
    const cur = get().tree
    if (!cur) return
    const next = updater(cur)
    next.meta.updatedAt = now()
    set({ tree: next })
    persist()
  }

  function patchItem(items: Item[], id: string, patch: Partial<Item>): Item[] {
    return items.map((it) => (it.id === id ? { ...it, ...patch, updatedAt: now() } : it))
  }

  return {
    settings: {
      rootDir: null,
      themeId: 'amoled',
      customThemes: [],
      themeMode: 'primary',
      unlockMechanic: true,
      edgeAnim: 'breathing',
      recentDirs: [],
      fontMode: 'default',
      customFont: null
    },
    tree: null,
    selectedId: null,
    ready: false,
    revealRequestId: null,
    revealNonce: 0,
    multiSelected: new Set(),
    collapsed: new Set(),
    graphCollapsed: new Set(),
    graphTreeLinked: false,

    async init() {
      const raw = await window.api.getSettings()
      // Защита от старых settings.json без recentDirs (созданных до этой версии).
      const settings: AppSettings = { ...raw }
      if (!settings.recentDirs) settings.recentDirs = []
      let tree: SkillTree | null = null
      if (settings.rootDir) {
        tree = await window.api.loadStore(settings.rootDir)
      }
      const graphCollapsed = tree ? defaultGraphCollapsed(tree.items, buildMaps(tree.items)) : new Set<string>()
      set({ settings, tree, ready: true, graphCollapsed })
    },

    async chooseRootDir() {
      const dir = await window.api.selectRootDir()
      if (!dir) return
      await get().chooseRootDirFrom(dir)
    },

    async chooseRootDirFrom(dir: string) {
      const recentDirs = [dir, ...get().settings.recentDirs.filter((d) => d !== dir)].slice(0, 8)
      const settings = { ...get().settings, rootDir: dir, recentDirs }
      await window.api.saveSettings(settings)
      const tree = await window.api.loadStore(dir)
      set({
        settings,
        tree,
        selectedId: null,
        multiSelected: new Set(),
        collapsed: new Set(),
        graphCollapsed: tree ? defaultGraphCollapsed(tree.items, buildMaps(tree.items)) : new Set()
      })
    },

    removeRecentDir(dir: string) {
      const settings = {
        ...get().settings,
        recentDirs: get().settings.recentDirs.filter((d) => d !== dir)
      }
      set({ settings })
      window.api.saveSettings(settings)
    },

    async createTree(name: string) {
      const { settings } = get()
      if (!settings.rootDir) return
      const tree = newTree(name || 'Мои навыки')
      set({ tree })
      await window.api.saveStore(settings.rootDir, tree)
    },

    select(id) {
      set({ selectedId: id })
    },

    requestReveal(id) {
      set((s) => ({ selectedId: id, revealRequestId: id, revealNonce: s.revealNonce + 1 }))
    },

    setMultiSelected(v) {
      const next = typeof v === 'function' ? v(get().multiSelected) : v
      set({ multiSelected: next })
    },

    setCollapsed(v) {
      const next = typeof v === 'function' ? v(get().collapsed) : v
      set({ collapsed: next })
    },

    setGraphCollapsed(v) {
      const next = typeof v === 'function' ? v(get().graphCollapsed) : v
      set({ graphCollapsed: next })
    },

    setGraphTreeLinked(v) {
      set({ graphTreeLinked: v })
    },

    addBranch() {
      const cur = get().tree
      const branchCount = cur ? cur.items.filter((i) => i.kind === 'branch').length : 0
      const item = newItem('branch', null, branchCount)
      item.color = BRANCH_COLORS[branchCount % BRANCH_COLORS.length]
      mutate((t) => ({ ...t, items: [...t.items, item] }))
      set({ selectedId: item.id })
      return item.id
    },

    addGroup() {
      const cur = get().tree
      const rootCount = cur ? cur.items.filter((i) => i.parentId === null).length : 0
      const item = newItem('group', null, rootCount)
      mutate((t) => ({ ...t, items: [...t.items, item] }))
      set({ selectedId: item.id })
      return item.id
    },

    addChild(parentId, kind) {
      const cur = get().tree
      const siblings = cur ? cur.items.filter((i) => i.parentId === parentId) : []
      const item = newItem(kind, parentId, siblings.length)
      mutate((t) => ({ ...t, items: [...t.items, item] }))
      set({ selectedId: item.id })
      return item.id
    },

    groupItems(ids) {
      const cur = get().tree
      if (!cur || ids.length === 0) return null
      const byId = new Map(cur.items.map((it) => [it.id, it]))
      const first = byId.get(ids[0])
      if (!first) return null
      const parentId = first.parentId
      // В группу переезжают только реальные сиблинги первого элемента (общий родитель) —
      // группа может содержать ветки точно так же, как узлы и другие группы.
      const eligible = ids.filter((id) => {
        const it = byId.get(id)
        return it && it.parentId === parentId
      })
      if (eligible.length === 0) return null
      const siblingCount = cur.items.filter((i) => i.parentId === parentId).length
      const group = newItem('group', parentId, siblingCount)
      mutate((t) => ({ ...t, items: [...t.items, group] }))
      get().moveItems(eligible, group.id, 0)
      set({ selectedId: group.id, multiSelected: new Set() })
      return group.id
    },

    updateItem(id, patch) {
      mutate((t) => ({ ...t, items: patchItem(t.items, id, patch) }))
    },

    changeKind(id, kind) {
      const cur = get().tree
      if (!cur) return
      const item = cur.items.find((i) => i.id === id)
      if (!item || item.kind === kind) return
      // branch↔node — чисто визуальное/поведенческое различие (иконка ветки vs
      // узла, кнопка «добавить под-ветку»), а не структурное: узлы точно так же
      // могут иметь детей, как и ветки. Поэтому смена типа НЕ трогает parentId
      // ни у самого элемента, ни у его потомков — вся иерархия остаётся как есть.
      mutate((t) => ({ ...t, items: patchItem(t.items, id, { kind }) }))
    },

    moveItem(id, newParentId, index) {
      const cur = get().tree
      if (!cur) return
      const byId = new Map(cur.items.map((it) => [it.id, it]))
      const moved = byId.get(id)
      if (!moved || moved.parentId === undefined) return

      // Защита от переноса ветки внутрь самой себя или своего потомка.
      let p = newParentId
      while (p) {
        if (p === id) return
        p = byId.get(p)?.parentId ?? null
      }
      // Ветка и группа — контейнеры для чего угодно (включая другие ветки —
      // группа может объединять несколько корневых веток); узел — контейнер
      // только для узлов/групп (ветку внутрь узла вложить нельзя).
      const newParent = newParentId ? byId.get(newParentId) : null
      if (newParent && newParent.kind === 'node' && moved.kind === 'branch') return

      mutate((t) => {
        const siblings = t.items
          .filter((it) => it.parentId === newParentId && it.id !== id)
          .sort((a, b) => a.order - b.order)
        const clamped = Math.max(0, Math.min(index, siblings.length))
        siblings.splice(clamped, 0, moved)
        const orderById = new Map(siblings.map((it, i) => [it.id, i]))
        const ts = now()
        return {
          ...t,
          items: t.items.map((it) => {
            if (it.id === id) {
              return { ...it, parentId: newParentId, order: orderById.get(id) ?? it.order, updatedAt: ts }
            }
            if (orderById.has(it.id)) {
              return { ...it, order: orderById.get(it.id)!, updatedAt: ts }
            }
            return it
          })
        }
      })
    },

    moveItems(ids, newParentId, index) {
      const cur = get().tree
      if (!cur) return
      const byId = new Map(cur.items.map((it) => [it.id, it]))
      const idSet = new Set(ids)

      // Пропускаем потомков, чей предок тоже в выделении — он утащит их за собой сам,
      // двигать их отдельно не нужно (и опасно: порядок/индекс относился бы к другому родителю).
      const topIds = ids.filter((id) => {
        let p = byId.get(id)?.parentId
        while (p) {
          if (idSet.has(p)) return false
          p = byId.get(p)?.parentId
        }
        return true
      })

      const newParent = newParentId ? byId.get(newParentId) : null

      // Те же проверки, что и в moveItem, но невалидные элементы просто пропускаем
      // (а не отменяем перенос целиком) — например, при переносе смешанного
      // выделения веток и узлов на узел-контейнер переедут только узлы.
      const movable = topIds.filter((id) => {
        const item = byId.get(id)
        if (!item || item.parentId === undefined) return false
        if (id === newParentId) return false
        let p = newParentId
        while (p) {
          if (p === id) return false
          p = byId.get(p)?.parentId ?? null
        }
        if (newParent && newParent.kind === 'node' && item.kind === 'branch') return false
        return true
      })

      if (movable.length === 0) return

      mutate((t) => {
        const movedSet = new Set(movable)
        const siblings = t.items
          .filter((it) => it.parentId === newParentId && !movedSet.has(it.id))
          .sort((a, b) => a.order - b.order)
        const clamped = Math.max(0, Math.min(index, siblings.length))
        const movedItems = movable
          .map((id) => byId.get(id)!)
          .sort((a, b) => a.order - b.order)
        siblings.splice(clamped, 0, ...movedItems)
        const orderById = new Map(siblings.map((it, i) => [it.id, i]))
        const ts = now()
        return {
          ...t,
          items: t.items.map((it) => {
            if (movedSet.has(it.id)) {
              return {
                ...it,
                parentId: newParentId,
                order: orderById.get(it.id) ?? it.order,
                updatedAt: ts
              }
            }
            if (orderById.has(it.id)) {
              return { ...it, order: orderById.get(it.id)!, updatedAt: ts }
            }
            return it
          })
        }
      })
    },

    setForceLock(id, on) {
      mutate((t) => ({ ...t, items: patchItem(t.items, id, { forceLocked: on }) }))
    },

    setManualDone(id, on) {
      // completedAt тоже проставляем/чистим здесь (как и при завершении
      // чеклиста в toggleChecklistEntry) — иначе темп по периодам (день/
      // неделя/месяц в StatsBar) не увидит узлы, отмеченные done вручную.
      mutate((t) => ({
        ...t,
        items: t.items.map((it) =>
          it.id === id
            ? {
                ...it,
                manualDone: on,
                completedAt: on ? (it.completedAt ?? now()) : undefined,
                updatedAt: now()
              }
            : it
        )
      }))
    },

    setHidden(id, on) {
      mutate((t) => ({ ...t, items: patchItem(t.items, id, { hidden: on }) }))
    },

    deleteItem(id) {
      get().deleteItems([id])
    },

    deleteItems(ids) {
      if (ids.length === 0) return
      mutate((t) => {
        // рекурсивно удаляем узлы и всех их потомков
        const toRemove = new Set<string>(ids)
        let changed = true
        while (changed) {
          changed = false
          for (const it of t.items) {
            if (it.parentId && toRemove.has(it.parentId) && !toRemove.has(it.id)) {
              toRemove.add(it.id)
              changed = true
            }
          }
        }
        return { ...t, items: t.items.filter((it) => !toRemove.has(it.id)) }
      })
      if (get().selectedId && get().tree?.items.every((i) => i.id !== get().selectedId)) {
        set({ selectedId: null })
      }
    },

    addChecklistEntry(itemId, text) {
      const entry: ChecklistEntry = { id: nanoid(), text, done: false }
      mutate((t) => ({
        ...t,
        items: t.items.map((it) =>
          it.id === itemId
            ? { ...it, checklist: [...it.checklist, entry], updatedAt: now() }
            : it
        )
      }))
    },

    toggleChecklistEntry(itemId, entryId) {
      mutate((t) => ({
        ...t,
        items: t.items.map((it) => {
          if (it.id !== itemId) return it
          const checklist = it.checklist.map((c) =>
            c.id === entryId ? { ...c, done: !c.done } : c
          )
          const allDone = checklist.length > 0 && checklist.every((c) => c.done)
          return {
            ...it,
            checklist,
            updatedAt: now(),
            completedAt: allDone ? (it.completedAt ?? now()) : undefined
          }
        })
      }))
    },

    updateChecklistEntry(itemId, entryId, text) {
      mutate((t) => ({
        ...t,
        items: t.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                checklist: it.checklist.map((c) => (c.id === entryId ? { ...c, text } : c)),
                updatedAt: now()
              }
            : it
        )
      }))
    },

    deleteChecklistEntry(itemId, entryId) {
      mutate((t) => ({
        ...t,
        items: t.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                checklist: it.checklist.filter((c) => c.id !== entryId),
                updatedAt: now()
              }
            : it
        )
      }))
    },

    setThemeId(id) {
      // Тумблер тёмный/светлый сбрасываем на основной вид — alt относился к
      // ПРЕЖНЕЙ теме и мог не иметь смысла (или вообще не существовать) у
      // новой выбранной.
      const settings = { ...get().settings, themeId: id, themeMode: 'primary' as const }
      set({ settings })
      window.api.saveSettings(settings)
    },

    setThemeMode(mode) {
      const settings = { ...get().settings, themeMode: mode }
      set({ settings })
      window.api.saveSettings(settings)
    },

    addCustomTheme(theme) {
      // id встроенной темы не трогаем — иначе она станет недостижимой
      // (resolveTheme ищет сперва среди встроенных, эта запись просто
      // никогда бы не подобралась).
      const clashesBuiltin = BUILTIN_THEMES.some((b) => b.id === theme.id)
      const incoming: ThemeDef = clashesBuiltin ? { ...theme, id: nanoid() } : theme
      const cur = get().settings.customThemes
      const withoutDup = cur.filter((t) => t.id !== incoming.id)
      const settings = {
        ...get().settings,
        customThemes: [...withoutDup, incoming],
        themeId: incoming.id,
        // Как и в setThemeId — тумблер тёмный/светлый относился к ПРЕЖНЕЙ
        // активной теме, для новой (даже только что созданной) начинаем
        // с основного вида.
        themeMode: 'primary' as const
      }
      set({ settings })
      window.api.saveSettings(settings)
    },

    removeCustomTheme(id) {
      const cur = get().settings
      const customThemes = cur.customThemes.filter((t) => t.id !== id)
      const themeId = cur.themeId === id ? DEFAULT_THEME_ID : cur.themeId
      const settings = { ...cur, customThemes, themeId }
      set({ settings })
      window.api.saveSettings(settings)
    },

    setUnlockMechanic(on) {
      const settings = { ...get().settings, unlockMechanic: on }
      set({ settings })
      window.api.saveSettings(settings)
    },

    setEdgeAnim(v) {
      const settings = { ...get().settings, edgeAnim: v }
      set({ settings })
      window.api.saveSettings(settings)
    },

    setFontMode(mode) {
      const settings = { ...get().settings, fontMode: mode }
      set({ settings })
      window.api.saveSettings(settings)
    },

    setCustomFont(family) {
      const settings = { ...get().settings, fontMode: 'custom' as const, customFont: family }
      set({ settings })
      window.api.saveSettings(settings)
    },

    replaceTree(tree) {
      set({
        tree,
        selectedId: null,
        multiSelected: new Set(),
        collapsed: new Set(),
        graphCollapsed: defaultGraphCollapsed(tree.items, buildMaps(tree.items))
      })
      persist()
    },

    appendItems(items) {
      if (items.length === 0) return
      mutate((t) => {
        const branchCount = t.items.filter((i) => i.kind === 'branch' && !i.parentId).length
        // Ставим импортированные корневые ветки в конец порядка
        let extra = 0
        const adjusted = items.map((it) =>
          it.parentId === null ? { ...it, order: branchCount + extra++ } : it
        )
        return { ...t, items: [...t.items, ...adjusted] }
      })
    },

    renameTree(name) {
      const v = name.trim()
      if (!v) return
      mutate((t) => ({ ...t, meta: { ...t.meta, name: v } }))
    }
  }
})
