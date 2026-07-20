import * as Lucide from 'lucide-react'
import type { LucideProps } from 'lucide-react'

interface Props extends LucideProps {
  name?: string
}

/** Рендер иконки lucide по её имени с безопасным фолбэком. */
export function LucideIcon({ name, ...props }: Props): JSX.Element {
  const map = Lucide as unknown as Record<string, React.ComponentType<LucideProps>>
  const Cmp = (name && map[name]) || Lucide.Circle
  return <Cmp {...props} />
}
