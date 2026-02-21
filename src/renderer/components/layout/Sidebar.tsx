import React from 'react'
// 1. Import useShallow from Zustand
import { useShallow } from 'zustand/react/shallow' 
import { useAppStore, selectPlayerNames, selectConnectionStatuses } from '../../stores/appStore'

type Page = 'dashboard' | 'xptracker' | 'calculators' | 'quests' | 'goals' | 'history' | 'settings'

const NAV_ITEMS: Array<{ page: Page; label: string; icon: string }> = [
  { page: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { page: 'xptracker', label: 'XP Tracker', icon: '📊' },
  { page: 'calculators', label: 'Calculators', icon: '🧮' },
  { page: 'quests', label: 'Quests', icon: '📜' },
  { page: 'goals', label: 'Goals', icon: '🎯' },
  { page: 'history', label: 'History', icon: '📈' },
  { page: 'settings', label: 'Settings', icon: '⚙️' },
]

export const Sidebar: React.FC = () => {
  const activePage = useAppStore((s) => s.activePage)
  const setActivePage = useAppStore((s) => s.setActivePage)
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const activePlayer = useAppStore((s) => s.activePlayer)
  const setActivePlayer = useAppStore((s) => s.setActivePlayer)
  
  // 2. Wrap the derived selectors in useShallow
  const playerNames = useAppStore(useShallow(selectPlayerNames))
  const connectionStatuses = useAppStore(useShallow(selectConnectionStatuses))

  const connectionCount = Object.keys(connectionStatuses).length
  const connectedCount = Object.values(connectionStatuses).filter(
    (c) => c.status === 'connected'
  ).length

  return (
    <aside
      className={`
        h-full bg-osrs-panel border-r border-osrs-border flex flex-col
        transition-all duration-200 ease-out
        ${sidebarCollapsed ? 'w-16' : 'w-56'}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-osrs-border flex items-center justify-between">
        {!sidebarCollapsed && (
          <h1 className="font-display text-sm font-bold text-osrs-gold tracking-wider">
            OSRS TRACKER
          </h1>
        )}
        <button
          onClick={toggleSidebar}
          className="text-osrs-text-dim hover:text-osrs-text transition-colors text-sm p-1"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Player Selector */}
      {playerNames.length > 0 && !sidebarCollapsed && (
        <div className="px-3 py-3 border-b border-osrs-border">
          <label className="text-[10px] uppercase tracking-widest text-osrs-text-dim font-display mb-1 block">
            Player
          </label>
          <select
            value={activePlayer ?? ''}
            onChange={(e) => setActivePlayer(e.target.value || null)}
            className="w-full bg-osrs-panel-light border border-osrs-border rounded px-2 py-1.5 text-sm text-osrs-text font-body focus:outline-none focus:border-osrs-gold/50"
          >
            {playerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(({ page, label, icon }) => {
          const isActive = activePage === page
          return (
            <button
              key={page}
              onClick={() => setActivePage(page)}
              className={`
                w-full flex items-center gap-3 px-4 py-2.5 text-sm font-body
                transition-all duration-150
                ${isActive
                  ? 'bg-osrs-gold/10 text-osrs-gold border-r-2 border-osrs-gold'
                  : 'text-osrs-text-dim hover:text-osrs-text hover:bg-osrs-panel-hover'
                }
                ${sidebarCollapsed ? 'justify-center px-0' : ''}
              `}
              title={sidebarCollapsed ? label : undefined}
            >
              <span className="text-base">{icon}</span>
              {!sidebarCollapsed && <span>{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Connection Status Footer */}
      <div className="p-3 border-t border-osrs-border">
        {!sidebarCollapsed ? (
          <div className="flex items-center gap-2 text-xs font-mono text-osrs-text-dim">
            <span
              className={`w-2 h-2 rounded-full ${
                connectedCount > 0 ? 'bg-osrs-green animate-pulse-slow' : 'bg-red-500'
              }`}
            />
            <span>
              {connectedCount}/{connectionCount} connected
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <span
              className={`w-2 h-2 rounded-full ${
                connectedCount > 0 ? 'bg-osrs-green animate-pulse-slow' : 'bg-red-500'
              }`}
              title={`${connectedCount}/{connectionCount} connected`}
            />
          </div>
        )}
      </div>
    </aside>
  )
}