import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Отдельная граница ошибок вокруг графа: сбой рендера одного узла/ребра не должен
 * ронять всё окно приложения. При ошибке показываем фолбэк с перерисовкой графа
 * (сброс через key), не теряя данные дерева. Логируем полный stack — источник
 * диагностики, если редкий рендер-баг проявится снова.
 */
export class GraphErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[GraphErrorBoundary] Graph render crashed:', error, error.stack, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="graph-crash">
          <AlertTriangle size={28} />
          <p>Не удалось отрисовать граф.</p>
          <p className="dim small">{this.state.error.message}</p>
          <button className="tb-btn primary" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={14} /> Перерисовать
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
