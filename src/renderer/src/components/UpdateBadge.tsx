import { useEffect, useState } from 'react'
import { ArrowRight, RotateCw } from 'lucide-react'

/** Плашка «обновление готово» — появляется, только когда electron-updater
 *  уже СКАЧАЛ новую версию (см. src/main/autoUpdater.ts), и пропадает после
 *  установки/выхода. Клик — quitAndInstall (перезапуск с заменой файлов). */
export function UpdateBadge(): JSX.Element | null {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    return window.api.onUpdateReady((info) => setVersion(info.version))
  }, [])

  if (!version) return null

  return (
    <button className="update-badge" onClick={() => window.api.installUpdate()}>
      <span className="update-badge-icon">
        <RotateCw size={14} />
      </span>
      <span className="update-badge-text">
        <span className="update-badge-title">Перезапустить для обновления</span>
        <span className="dim small">версия {version}</span>
      </span>
      <ArrowRight size={14} className="update-badge-arrow" />
    </button>
  )
}
