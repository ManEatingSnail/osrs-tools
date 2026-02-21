import { create } from 'zustand'
import {
  PlayerState,
  SkillState,
  SkillName,
  SessionState,
  PlayerUpdateDiff,
  ConnectionStatus,
  ConnectionStatusUpdate,
  ConnectionConfig,
  AppSettings,
  SkillSortMode,
  DEFAULT_APP_SETTINGS,
} from '@shared/types'

// ============================================================================
// Store Shape
// ============================================================================

export interface AppStore {
  // Active player shown on dashboard
  activePlayer: string | null

  // All known players (keyed by player name)
  players: Record<string, PlayerState>

  // Connection statuses (keyed by connection ID)
  connectionStatuses: Record<string, {
    status: ConnectionStatus
    lastError: string | null
    playerName: string | null
  }>

  // UI state
  activePage: 'dashboard' | 'xptracker' | 'calculators' | 'quests' | 'goals' | 'history' | 'settings'
  sidebarCollapsed: boolean

  // Settings
  settings: AppSettings

  // Actions
  applyPlayerUpdate: (diff: PlayerUpdateDiff) => void
  applyConnectionStatus: (update: ConnectionStatusUpdate) => void
  setActivePlayer: (playerName: string | null) => void
  setActivePage: (page: AppStore['activePage']) => void
  toggleSidebar: () => void
  updateSettings: (partial: Partial<AppSettings>) => void
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAppStore = create<AppStore>((set, get) => ({
  activePlayer: null,
  players: {},
  connectionStatuses: {},
  activePage: 'dashboard',
  sidebarCollapsed: false,
  settings: DEFAULT_APP_SETTINGS,

  applyPlayerUpdate: (diff: PlayerUpdateDiff) => {
    set((state) => {
      const existingPlayer = state.players[diff.playerName]

      // Merge skills — only update changed skills, keep rest
      const mergedSkills: Partial<Record<SkillName, SkillState>> = {
        ...(existingPlayer?.skills ?? {}),
        ...diff.skills,
      }

      const updatedPlayer: PlayerState = {
        playerName: diff.playerName,
        loggedIn: diff.loggedIn,
        activeSkill: diff.activeSkill,
        timestamp: diff.timestamp,
        skills: mergedSkills,
        session: diff.session,
      }

      const newPlayers = {
        ...state.players,
        [diff.playerName]: updatedPlayer,
      }

      // Auto-select first player if none active
      const activePlayer = state.activePlayer ?? diff.playerName

      return { players: newPlayers, activePlayer }
    })
  },

  applyConnectionStatus: (update: ConnectionStatusUpdate) => {
    set((state) => ({
      connectionStatuses: {
        ...state.connectionStatuses,
        [update.connectionId]: {
          status: update.status,
          lastError: update.lastError,
          playerName: update.playerName,
        },
      },
    }))
  },

  setActivePlayer: (playerName) => set({ activePlayer: playerName }),
  setActivePage: (page) => set({ activePage: page }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  updateSettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
}))

// ============================================================================
// Selectors — for surgical re-render control
// ============================================================================

/** Select a single skill for the active player */
export const selectSkill = (skillName: SkillName) => (state: AppStore) => {
  const player = state.activePlayer ? state.players[state.activePlayer] : null
  return player?.skills[skillName] ?? null
}

/** Select session state for the active player */
export const selectSession = (state: AppStore) => {
  const player = state.activePlayer ? state.players[state.activePlayer] : null
  return player?.session ?? null
}

/** Select the active skill name */
export const selectActiveSkill = (state: AppStore) => {
  const player = state.activePlayer ? state.players[state.activePlayer] : null
  return player?.activeSkill ?? null
}

/** Select logged-in state */
export const selectLoggedIn = (state: AppStore) => {
  const player = state.activePlayer ? state.players[state.activePlayer] : null
  return player?.loggedIn ?? false
}

/** Select player names */
export const selectPlayerNames = (state: AppStore) => Object.keys(state.players)

/** Select all connection statuses */
export const selectConnectionStatuses = (state: AppStore) => state.connectionStatuses
