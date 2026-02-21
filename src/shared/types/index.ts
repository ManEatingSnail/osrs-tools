// ============================================================================
// Core Domain Types
// ============================================================================

/** All 24 OSRS skills (excluding OVERALL) */
export const SKILL_NAMES = [
  'Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic',
  'Runecraft', 'Construction', 'Hitpoints', 'Agility', 'Herblore',
  'Thieving', 'Crafting', 'Fletching', 'Slayer', 'Hunter',
  'Mining', 'Smithing', 'Fishing', 'Cooking', 'Firemaking',
  'Woodcutting', 'Farming', 'Sailing'
] as const

export type SkillName = typeof SKILL_NAMES[number]

/** Raw skill data as received from the RuneLite plugin JSON */
export interface RawSkillData {
  xp: number
  level: number
  boosted_level: number
  xp_hr: number
  actions_hr: number
  time_to_level: string
  xp_gained: number
  progress_percent: number
  last_gain: number
}

/** Raw JSON payload from the RuneLite plugin HTTP endpoint */
export interface RawPluginPayload {
  player: string
  logged_in: boolean
  active_skill: string | null
  timestamp: number
  skills: Record<string, RawSkillData>
}

// ============================================================================
// Normalized App Types (camelCase, validated)
// ============================================================================

export interface SkillState {
  xp: number
  level: number
  boostedLevel: number
  xpHr: number
  actionsHr: number
  timeToLevel: string
  xpGained: number
  progressPercent: number
  lastGain: number
}

export interface PlayerState {
  playerName: string
  loggedIn: boolean
  activeSkill: SkillName | null
  timestamp: number
  skills: Partial<Record<SkillName, SkillState>>
  session: SessionState
}

export interface SessionState {
  sessionId: string
  startTime: number
  duration: number
  totalXpGained: number
  skillXpGained: Partial<Record<SkillName, number>>
}

// ============================================================================
// Connection Types
// ============================================================================

export interface ConnectionConfig {
  id: string
  label: string
  host: string
  port: number
  endpoint: string
  pollInterval: number
  enabled: boolean
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting'

export interface ConnectionState {
  config: ConnectionConfig
  status: ConnectionStatus
  lastPlayer: string | null
  consecutiveFailures: number
  lastError: string | null
}

// ============================================================================
// Diff Types (main → renderer IPC pushes)
// ============================================================================

/** Partial update sent to renderer — only contains changed fields */
export interface PlayerUpdateDiff {
  playerName: string
  connectionId: string
  loggedIn: boolean
  activeSkill: SkillName | null
  timestamp: number
  /** Only skills whose data changed since last push */
  skills: Partial<Record<SkillName, SkillState>>
  session: SessionState
}

export interface ConnectionStatusUpdate {
  connectionId: string
  status: ConnectionStatus
  lastError: string | null
  playerName: string | null
}

// ============================================================================
// Persistence Types
// ============================================================================

export interface SkillSnapshot {
  id?: number
  timestamp: number
  sessionId: string
  skill: SkillName
  xp: number
  level: number
  boostedLevel: number
  xpHr: number
  actionsHr: number
  xpGained: number
  progressPercent: number
}

export interface SessionRecord {
  id: string
  startTime: number
  endTime: number | null
  totalXpGained: number
}

export interface GoalRecord {
  id: string
  type: 'custom' | 'diary' | 'collection_log'
  skill: SkillName | null
  targetLevel: number | null
  targetXp: number | null
  description: string
  completed: boolean
  createdAt: number
  completedAt: number | null
  /** Pin to dashboard widget */
  pinned: boolean
}

// ============================================================================
// Recurring Task Types
// ============================================================================

export type TaskFrequency = 'daily' | 'weekly' | 'custom'

export interface TaskRecord {
  id: string
  description: string
  frequency: TaskFrequency
  /** For custom frequency: interval in hours */
  customIntervalHours: number | null
  /** Last time this task was marked done (epoch ms) */
  lastCompletedAt: number | null
  /** Whether the task is currently done for its period */
  completedThisPeriod: boolean
  createdAt: number
  pinned: boolean
}

/** Computed runtime state for a task */
export interface TaskWithStatus extends TaskRecord {
  /** When the current period resets */
  nextReset: number
  /** Whether the task is overdue */
  overdue: boolean
}

export interface QuestProgressRecord {
  questName: string
  status: 'not_started' | 'in_progress' | 'completed'
  updatedAt: number
}

// ============================================================================
// History Query Types
// ============================================================================

export interface HistoryQuery {
  skill?: SkillName
  startTime?: number
  endTime?: number
  sessionId?: string
  limit?: number
}

export interface HistoryDataPoint {
  timestamp: number
  xp: number
  xpHr: number
  level: number
}

// ============================================================================
// App Settings
// ============================================================================

export type SkillSortMode = 'category' | 'active' | 'level' | 'name'

export interface AppSettings {
  theme: 'dark' | 'light'
  compactNumbers: boolean
  showBoostedLevels: boolean
  dashboardLayout: 'grid' | 'list'
  chartUpdateInterval: number  // ms, default 5000
  skillSortMode: SkillSortMode
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  compactNumbers: true,
  showBoostedLevels: true,
  dashboardLayout: 'grid',
  chartUpdateInterval: 5000,
  skillSortMode: 'category',
}
