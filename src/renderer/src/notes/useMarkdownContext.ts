import { useMemo } from 'react'
import { useTree } from '../store/treeStore'
import { findItemByNoteTitle } from '../domain'
import type { MarkdownContext } from './markdown'

/** Общий контекст для renderMarkdown — резолв и переход по вики-ссылкам
 *  между заметками узлов, плюс rootDir для эмбедов изображений. Один хук,
 *  чтобы NoteEditor/NoteEditorModal/поп-ап узла на графе не дублировали
 *  сборку контекста по отдельности. */
export function useMarkdownContext(): MarkdownContext {
  const items = useTree((s) => s.tree?.items ?? [])
  const rootDir = useTree((s) => s.settings.rootDir)
  const select = useTree((s) => s.select)
  return useMemo(
    () => ({
      resolveLink: (title: string) => findItemByNoteTitle(items, title),
      onNavigate: select,
      rootDir
    }),
    [items, rootDir, select]
  )
}
