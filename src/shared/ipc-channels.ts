import type {
  PlayerUpdateDiff,
  ConnectionStatusUpdate,
  ConnectionConfig,
  ConnectionState,
  HistoryQuery,
  HistoryDataPoint,
  GoalRecord,
  QuestProgressRecord,
  SessionRecord,
  AppSettings,
  PlayerState,
} from './types'

// ============================================================================
// IPC Channel Names
// ============================================================================

export const IPC_CHANNELS = {
  // Main → Renderer (push)
  PLAYER_UPDATE: 'player:update',
  CONNECTION_STATUS: 'connection:status',
  ALL_CONNECTIONS: 'connection:all',

  // Renderer → Main (request/response)
  CONNECTION_ADD: 'connection:add',
  CONNECTION_REMOVE: 'connection:remove',
  CONNECTION_UPDATE: 'connection:update',
  CONNECTION_LIST: 'connection:list',
  CONNECTION_TEST: 'connection:test',

  PLAYER_LIST: 'player:list',
  PLAYER_GET_STATE: 'player:get-state',
  PLAYER_MERGE: 'player:merge',

  HISTORY_QUERY: 'history:query',
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',

  GOAL_LIST: 'goal:list',
  GOAL_CREATE: 'goal:create',
  GOAL_UPDATE: 'goal:update',
  GOAL_DELETE: 'goal:delete',

  TASK_LIST: 'task:list',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_TOGGLE_COMPLETE: 'task:toggle-complete',

  QUEST_LIST: 'quest:list',
  QUEST_UPDATE_STATUS: 'quest:update-status',

  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',

  APP_GET_VERSION: 'app:get-version',
} as const

// ============================================================================
// IPC Payload Types — Request / Response pairs
// ============================================================================

export interface IPCHandlers {
  // Connection management
  [IPC_CHANNELS.CONNECTION_ADD]: {
    request: Omit<ConnectionConfig, 'id'>
    response: ConnectionConfig
  }
  [IPC_CHANNELS.CONNECTION_REMOVE]: {
    request: { id: string }
    response: { success: boolean }
  }
  [IPC_CHANNELS.CONNECTION_UPDATE]: {
    request: ConnectionConfig
    response: ConnectionConfig
  }
  [IPC_CHANNELS.CONNECTION_LIST]: {
    request: void
    response: ConnectionState[]
  }
  [IPC_CHANNELS.CONNECTION_TEST]: {
    request: { host: string; port: number; endpoint: string }
    response: { success: boolean; player?: string; error?: string }
  }

  // Player data
  [IPC_CHANNELS.PLAYER_LIST]: {
    request: void
    response: string[]
  }
  [IPC_CHANNELS.PLAYER_GET_STATE]: {
    request: { playerName: string }
    response: PlayerState | null
  }
  [IPC_CHANNELS.PLAYER_MERGE]: {
    request: { sourcePlayer: string; targetPlayer: string }
    response: { success: boolean; error?: string }
  }

  // History
  [IPC_CHANNELS.HISTORY_QUERY]: {
    request: HistoryQuery & { playerName: string }
    response: HistoryDataPoint[]
  }
  [IPC_CHANNELS.SESSION_LIST]: {
    request: { playerName: string; limit?: number }
    response: SessionRecord[]
  }

  // Goals
  [IPC_CHANNELS.GOAL_LIST]: {
    request: { playerName: string }
    response: GoalRecord[]
  }
  [IPC_CHANNELS.GOAL_CREATE]: {
    request: { playerName: string; goal: Omit<GoalRecord, 'id' | 'createdAt' | 'completedAt' | 'completed'> }
    response: GoalRecord
  }
  [IPC_CHANNELS.GOAL_UPDATE]: {
    request: { playerName: string; goal: GoalRecord }
    response: GoalRecord
  }
  [IPC_CHANNELS.GOAL_DELETE]: {
    request: { playerName: string; goalId: string }
    response: { success: boolean }
  }

  // Settings
  [IPC_CHANNELS.SETTINGS_GET]: {
    request: void
    response: AppSettings
  }
  [IPC_CHANNELS.SETTINGS_UPDATE]: {
    request: Partial<AppSettings>
    response: AppSettings
  }

  [IPC_CHANNELS.APP_GET_VERSION]: {
    request: void
    response: string
  }
}
