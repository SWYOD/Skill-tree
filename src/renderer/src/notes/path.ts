/** Символы, недопустимые в имени файла на диске, — заменяем дефисом. */
function sanitizeFileName(s: string): string {
  const cleaned = s
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()
  return cleaned || 'Заметка'
}

/**
 * Имя файла заметки — человекочитаемый заголовок + id узла суффиксом.
 * Суффикс держит имя уникальным (у двух узлов может быть одинаковый
 * заголовок) и стабильным при переименовании: меняется только «человеческая»
 * часть (см. эффект переименования в NoteEditor.tsx), id никогда не трогается.
 */
export function computeNotePath(id: string, title: string): string {
  return `notes/${sanitizeFileName(title)}-${id}.md`
}
