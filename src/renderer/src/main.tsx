import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installMockApi } from './store/apiMock'
import './styles.css'

// В обычном браузере (dev-проверка) подменяем window.api заглушкой.
installMockApi()

const root = ReactDOM.createRoot(document.getElementById('root')!)

// Дев-only витрина отдельных компонентов с демо-данными (см. dev/Gallery.tsx)
// — для скриншотов документации вместо навигации по всему приложению.
// Динамический импорт + DEV-гейт: код витрины не попадает в прод-сборку.
if (import.meta.env.DEV && window.location.hash.startsWith('#gallery')) {
  import('./dev/Gallery').then(({ Gallery }) => root.render(<Gallery />))
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
