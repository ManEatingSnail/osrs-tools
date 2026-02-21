import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import {
  SkillSnapshot,
  SessionRecord,
  GoalRecord,
  TaskRecord,
  QuestProgressRecord,
  SkillName,
  HistoryQuery,
  HistoryDataPoint,
  ConnectionConfig,
  AppSettings,
  DEFAULT_APP_SETTINGS,
} from '@shared/types'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// Database paths
// ============================================================================

function getDataDir(): string {
  const dir = path.join(app.getPath('userData'), 'data')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getPlayerDbPath(playerName: string): string {
  // Sanitize player name for filesystem
  const safeName = playerName.replace(/[^a-zA-Z0-9_-]/g, '_')
  return path.join(getDataDir(), `${safeName}.db`)
}

function getConfigDbPath(): string {
  return path.join(getDataDir(), 'config.db')
}

// ============================================================================
// Schema version & migrations
// ============================================================================

const PLAYER_DB_VERSION = 1
const CONFIG_DB_VERSION = 1

function migratePlayerDb(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS skill_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        skill TEXT NOT NULL,
        xp INTEGER NOT NULL,
        level INTEGER NOT NULL,
        boosted_level INTEGER NOT NULL,
        xp_hr INTEGER NOT NULL,
        actions_hr INTEGER NOT NULL,
        xp_gained INTEGER NOT NULL,
        progress_percent REAL NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_skill_time
        ON skill_snapshots(skill, timestamp);

      CREATE INDEX IF NOT EXISTS idx_snapshots_session
        ON skill_snapshots(session_id);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        total_xp_gained INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT 'custom',
        skill TEXT,
        target_level INTEGER,
        target_xp INTEGER,
        description TEXT,
        completed INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS quest_progress (
        quest_name TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'not_started',
        updated_at INTEGER NOT NULL
      );

      PRAGMA user_version = 1;
    `)
  }

  // Future migrations go here:
  // if (currentVersion < 2) { ... PRAGMA user_version = 2; }

  if (currentVersion < 2) {
    db.exec(`
      ALTER TABLE goals ADD COLUMN pinned INTEGER DEFAULT 0;

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'daily',
        custom_interval_hours INTEGER,
        last_completed_at INTEGER,
        completed_this_period INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        pinned INTEGER DEFAULT 0
      );

      PRAGMA user_version = 2;
    `)
  }
}

function migrateConfigDb(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        host TEXT NOT NULL DEFAULT 'localhost',
        port INTEGER NOT NULL DEFAULT 8080,
        endpoint TEXT NOT NULL DEFAULT '/update',
        poll_interval INTEGER NOT NULL DEFAULT 600,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_merges (
        id TEXT PRIMARY KEY,
        source_player TEXT NOT NULL,
        target_player TEXT NOT NULL,
        merged_at INTEGER NOT NULL
      );

      PRAGMA user_version = 1;
    `)
  }
}

// ============================================================================
// Task reset calculation
// ============================================================================

function getNextResetTime(task: TaskRecord): number {
  if (!task.lastCompletedAt) return 0

  const completed = new Date(task.lastCompletedAt)

  switch (task.frequency) {
    case 'daily': {
      // Resets at midnight UTC of the next day
      const next = new Date(completed)
      next.setUTCHours(0, 0, 0, 0)
      next.setUTCDate(next.getUTCDate() + 1)
      return next.getTime()
    }
    case 'weekly': {
      // Resets at midnight UTC of next Wednesday (OSRS reset day)
      const next = new Date(completed)
      next.setUTCHours(0, 0, 0, 0)
      const daysUntilWed = (3 - next.getUTCDay() + 7) % 7 || 7
      next.setUTCDate(next.getUTCDate() + daysUntilWed)
      return next.getTime()
    }
    case 'custom': {
      const hours = task.customIntervalHours ?? 24
      return task.lastCompletedAt + hours * 60 * 60 * 1000
    }
    default:
      return 0
  }
}

export { getNextResetTime }

// ============================================================================
// Player Database Operations
// ============================================================================

export class PlayerDatabase {
  private db: Database.Database

  constructor(playerName: string) {
    const dbPath = getPlayerDbPath(playerName)
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    migratePlayerDb(this.db)
  }

  // ---- Snapshots ----

  private insertSnapshotStmt: Database.Statement | null = null

  writeSnapshot(snapshot: SkillSnapshot): void {
    if (!this.insertSnapshotStmt) {
      this.insertSnapshotStmt = this.db.prepare(`
        INSERT INTO skill_snapshots
          (timestamp, session_id, skill, xp, level, boosted_level, xp_hr, actions_hr, xp_gained, progress_percent)
        VALUES
          (@timestamp, @sessionId, @skill, @xp, @level, @boostedLevel, @xpHr, @actionsHr, @xpGained, @progressPercent)
      `)
    }

    this.insertSnapshotStmt.run({
      timestamp: snapshot.timestamp,
      sessionId: snapshot.sessionId,
      skill: snapshot.skill,
      xp: snapshot.xp,
      level: snapshot.level,
      boostedLevel: snapshot.boostedLevel,
      xpHr: snapshot.xpHr,
      actionsHr: snapshot.actionsHr,
      xpGained: snapshot.xpGained,
      progressPercent: snapshot.progressPercent,
    })
  }

  writeBatchSnapshots(snapshots: SkillSnapshot[]): void {
    const insertMany = this.db.transaction((items: SkillSnapshot[]) => {
      for (const s of items) {
        this.writeSnapshot(s)
      }
    })
    insertMany(snapshots)
  }

  queryHistory(query: HistoryQuery): HistoryDataPoint[] {
    let sql = 'SELECT timestamp, xp, xp_hr as xpHr, level FROM skill_snapshots WHERE 1=1'
    const params: Record<string, unknown> = {}

    if (query.skill) {
      sql += ' AND skill = @skill'
      params.skill = query.skill
    }
    if (query.startTime) {
      sql += ' AND timestamp >= @startTime'
      params.startTime = query.startTime
    }
    if (query.endTime) {
      sql += ' AND timestamp <= @endTime'
      params.endTime = query.endTime
    }
    if (query.sessionId) {
      sql += ' AND session_id = @sessionId'
      params.sessionId = query.sessionId
    }

    sql += ' ORDER BY timestamp ASC'

    if (query.limit) {
      sql += ' LIMIT @limit'
      params.limit = query.limit
    }

    return this.db.prepare(sql).all(params) as HistoryDataPoint[]
  }

  // ---- Sessions ----

  createSession(id: string, startTime: number): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO sessions (id, start_time) VALUES (?, ?)'
    ).run(id, startTime)
  }

  endSession(id: string, endTime: number, totalXpGained: number): void {
    this.db.prepare(
      'UPDATE sessions SET end_time = ?, total_xp_gained = ? WHERE id = ?'
    ).run(endTime, totalXpGained, id)
  }

  listSessions(limit = 50): SessionRecord[] {
    return this.db.prepare(
      'SELECT id, start_time as startTime, end_time as endTime, total_xp_gained as totalXpGained FROM sessions ORDER BY start_time DESC LIMIT ?'
    ).all(limit) as SessionRecord[]
  }

  // ---- Goals ----

  listGoals(): GoalRecord[] {
    return this.db.prepare(
      'SELECT id, type, skill, target_level as targetLevel, target_xp as targetXp, description, completed, created_at as createdAt, completed_at as completedAt, pinned FROM goals ORDER BY pinned DESC, created_at DESC'
    ).all().map((row: any) => ({ ...row, completed: !!row.completed, pinned: !!row.pinned })) as GoalRecord[]
  }

  createGoal(goal: Omit<GoalRecord, 'id' | 'createdAt' | 'completedAt' | 'completed'>): GoalRecord {
    const id = uuidv4()
    const createdAt = Date.now()

    this.db.prepare(
      'INSERT INTO goals (id, type, skill, target_level, target_xp, description, completed, created_at, pinned) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)'
    ).run(id, goal.type, goal.skill, goal.targetLevel, goal.targetXp, goal.description, createdAt, goal.pinned ? 1 : 0)

    return { ...goal, id, completed: false, createdAt, completedAt: null }
  }

  updateGoal(goal: GoalRecord): void {
    this.db.prepare(
      'UPDATE goals SET type = ?, skill = ?, target_level = ?, target_xp = ?, description = ?, completed = ?, completed_at = ?, pinned = ? WHERE id = ?'
    ).run(goal.type, goal.skill, goal.targetLevel, goal.targetXp, goal.description, goal.completed ? 1 : 0, goal.completedAt, goal.pinned ? 1 : 0, goal.id)
  }

  deleteGoal(id: string): void {
    this.db.prepare('DELETE FROM goals WHERE id = ?').run(id)
  }

  // ---- Tasks (recurring) ----

  listTasks(): TaskRecord[] {
    return this.db.prepare(
      `SELECT id, description, frequency, custom_interval_hours as customIntervalHours,
       last_completed_at as lastCompletedAt, completed_this_period as completedThisPeriod,
       created_at as createdAt, pinned
       FROM tasks ORDER BY pinned DESC, created_at ASC`
    ).all().map((row: any) => ({
      ...row,
      completedThisPeriod: !!row.completedThisPeriod,
      pinned: !!row.pinned,
    })) as TaskRecord[]
  }

  createTask(task: Omit<TaskRecord, 'id' | 'createdAt' | 'lastCompletedAt' | 'completedThisPeriod'>): TaskRecord {
    const id = uuidv4()
    const createdAt = Date.now()

    this.db.prepare(
      'INSERT INTO tasks (id, description, frequency, custom_interval_hours, created_at, pinned) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, task.description, task.frequency, task.customIntervalHours, createdAt, task.pinned ? 1 : 0)

    return { ...task, id, createdAt, lastCompletedAt: null, completedThisPeriod: false }
  }

  updateTask(task: TaskRecord): void {
    this.db.prepare(
      'UPDATE tasks SET description = ?, frequency = ?, custom_interval_hours = ?, pinned = ? WHERE id = ?'
    ).run(task.description, task.frequency, task.customIntervalHours, task.pinned ? 1 : 0, task.id)
  }

  toggleTaskComplete(id: string): TaskRecord | null {
    const existing = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any
    if (!existing) return null

    const nowComplete = !existing.completed_this_period
    const lastCompleted = nowComplete ? Date.now() : existing.last_completed_at

    this.db.prepare(
      'UPDATE tasks SET completed_this_period = ?, last_completed_at = ? WHERE id = ?'
    ).run(nowComplete ? 1 : 0, lastCompleted, id)

    return {
      id: existing.id,
      description: existing.description,
      frequency: existing.frequency,
      customIntervalHours: existing.custom_interval_hours,
      lastCompletedAt: lastCompleted,
      completedThisPeriod: nowComplete,
      createdAt: existing.created_at,
      pinned: !!existing.pinned,
    }
  }

  /** Reset tasks whose period has elapsed */
  resetExpiredTasks(): void {
    const now = Date.now()
    const tasks = this.listTasks()

    for (const task of tasks) {
      if (!task.completedThisPeriod || !task.lastCompletedAt) continue

      const resetTime = getNextResetTime(task)
      if (now >= resetTime) {
        this.db.prepare(
          'UPDATE tasks SET completed_this_period = 0 WHERE id = ?'
        ).run(task.id)
      }
    }
  }

  deleteTask(id: string): void {
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  // ---- Quest Progress ----

  listQuestProgress(): QuestProgressRecord[] {
    return this.db.prepare(
      'SELECT quest_name as questName, status, updated_at as updatedAt FROM quest_progress ORDER BY quest_name'
    ).all() as QuestProgressRecord[]
  }

  updateQuestStatus(questName: string, status: QuestProgressRecord['status']): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO quest_progress (quest_name, status, updated_at) VALUES (?, ?, ?)'
    ).run(questName, status, Date.now())
  }

  // ---- Merge ----

  /** Import all data from another player's database file */
  importFrom(sourceDbPath: string): void {
    const sourceDb = new Database(sourceDbPath, { readonly: true })

    this.db.exec(`ATTACH DATABASE '${sourceDbPath}' AS source`)

    this.db.exec(`
      INSERT INTO skill_snapshots (timestamp, session_id, skill, xp, level, boosted_level, xp_hr, actions_hr, xp_gained, progress_percent)
      SELECT timestamp, session_id, skill, xp, level, boosted_level, xp_hr, actions_hr, xp_gained, progress_percent
      FROM source.skill_snapshots;

      INSERT OR IGNORE INTO sessions (id, start_time, end_time, total_xp_gained)
      SELECT id, start_time, end_time, total_xp_gained
      FROM source.sessions;
    `)

    this.db.exec('DETACH DATABASE source')
    sourceDb.close()
  }

  close(): void {
    this.db.close()
  }
}

// ============================================================================
// Config Database Operations
// ============================================================================

export class ConfigDatabase {
  private db: Database.Database

  constructor() {
    const dbPath = getConfigDbPath()
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    migrateConfigDb(this.db)
  }

  // ---- Connections ----

  listConnections(): ConnectionConfig[] {
    return this.db.prepare(
      `SELECT id, label, host, port, endpoint, poll_interval as pollInterval, enabled
       FROM connections ORDER BY label`
    ).all().map((row: any) => ({
      ...row,
      enabled: !!row.enabled,
    })) as ConnectionConfig[]
  }

  saveConnection(config: ConnectionConfig): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO connections (id, label, host, port, endpoint, poll_interval, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(config.id, config.label, config.host, config.port, config.endpoint, config.pollInterval, config.enabled ? 1 : 0)
  }

  deleteConnection(id: string): void {
    this.db.prepare('DELETE FROM connections WHERE id = ?').run(id)
  }

  // ---- Settings ----

  getSettings(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as Array<{ key: string; value: string }>
    const settings = { ...DEFAULT_APP_SETTINGS }

    for (const row of rows) {
      try {
        (settings as any)[row.key] = JSON.parse(row.value)
      } catch {
        // Ignore malformed settings
      }
    }

    return settings
  }

  updateSettings(partial: Partial<AppSettings>): AppSettings {
    const upsert = this.db.prepare(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)'
    )

    const updateMany = this.db.transaction((entries: Array<[string, unknown]>) => {
      for (const [key, value] of entries) {
        upsert.run(key, JSON.stringify(value))
      }
    })

    updateMany(Object.entries(partial))
    return this.getSettings()
  }

  // ---- Account Merges ----

  recordMerge(sourcePlayer: string, targetPlayer: string): void {
    this.db.prepare(
      'INSERT INTO account_merges (id, source_player, target_player, merged_at) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), sourcePlayer, targetPlayer, Date.now())
  }

  // ---- Players ----

  listPlayers(): string[] {
    const dataDir = getDataDir()
    const files = fs.readdirSync(dataDir)
    return files
      .filter(f => f.endsWith('.db') && f !== 'config.db')
      .map(f => f.replace('.db', ''))
  }

  close(): void {
    this.db.close()
  }
}

// ============================================================================
// Database Manager — singleton factory
// ============================================================================

export class DatabaseManager {
  private configDb: ConfigDatabase | null = null
  private playerDbs = new Map<string, PlayerDatabase>()

  getConfigDb(): ConfigDatabase {
    if (!this.configDb) {
      this.configDb = new ConfigDatabase()
    }
    return this.configDb
  }

  getPlayerDb(playerName: string): PlayerDatabase {
    const safeName = playerName.replace(/[^a-zA-Z0-9_-]/g, '_')
    let db = this.playerDbs.get(safeName)
    if (!db) {
      db = new PlayerDatabase(playerName)
      this.playerDbs.set(safeName, db)
    }
    return db
  }

  closeAll(): void {
    this.configDb?.close()
    this.configDb = null
    for (const db of this.playerDbs.values()) {
      db.close()
    }
    this.playerDbs.clear()
  }
}
