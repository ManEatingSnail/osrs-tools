import React from 'react'
import { useAppStore } from './stores/appStore'
import { usePlayerUpdateListener, useConnectionStatusListener } from './hooks/useIPC'
import { Sidebar } from './components/layout/Sidebar'
import { DashboardPage } from './pages/DashboardPage'
import { XpTrackerPage } from './pages/XpTrackerPage'
import { SettingsPage } from './pages/SettingsPage'
import {
  CalculatorsPage,
  QuestsPage,
  HistoryPage,
} from './pages/PlaceholderPages'
import { GoalsPage } from './pages/GoalsPage'

const PAGE_MAP: Record<string, React.FC> = {
  dashboard: DashboardPage,
  xptracker: XpTrackerPage,
  calculators: CalculatorsPage,
  quests: QuestsPage,
  goals: GoalsPage,
  history: HistoryPage,
  settings: SettingsPage,
}

export const App: React.FC = () => {
  const activePage = useAppStore((s) => s.activePage)
  const applyPlayerUpdate = useAppStore((s) => s.applyPlayerUpdate)
  const applyConnectionStatus = useAppStore((s) => s.applyConnectionStatus)

  // Subscribe to real-time pushes from main process
  usePlayerUpdateListener(applyPlayerUpdate)
  useConnectionStatusListener(applyConnectionStatus)

  const PageComponent = PAGE_MAP[activePage] ?? DashboardPage

  return (
    <div className="flex h-screen bg-osrs-dark text-osrs-text overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-5">
        <PageComponent />
      </main>
    </div>
  )
}
