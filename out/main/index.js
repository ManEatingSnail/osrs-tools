"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");
const crypto = require("node:crypto");
const http = require("http");
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
const rnds8Pool = new Uint8Array(256);
let poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    crypto.randomFillSync(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
const native = {
  randomUUID: crypto.randomUUID
};
function v4(options, buf, offset) {
  if (native.randomUUID && true && !options) {
    return native.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  return unsafeStringify(rnds);
}
const SKILL_NAMES = [
  "Attack",
  "Strength",
  "Defence",
  "Ranged",
  "Prayer",
  "Magic",
  "Runecraft",
  "Construction",
  "Hitpoints",
  "Agility",
  "Herblore",
  "Thieving",
  "Crafting",
  "Fletching",
  "Slayer",
  "Hunter",
  "Mining",
  "Smithing",
  "Fishing",
  "Cooking",
  "Firemaking",
  "Woodcutting",
  "Farming",
  "Sailing"
];
const DEFAULT_APP_SETTINGS = {
  theme: "dark",
  compactNumbers: true,
  showBoostedLevels: true,
  dashboardLayout: "grid",
  chartUpdateInterval: 5e3,
  skillSortMode: "category"
};
function getDataDir() {
  const dir = path.join(electron.app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getPlayerDbPath(playerName) {
  const safeName = playerName.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(getDataDir(), `${safeName}.db`);
}
function getConfigDbPath() {
  return path.join(getDataDir(), "config.db");
}
function migratePlayerDb(db) {
  const currentVersion = db.pragma("user_version", { simple: true });
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
    `);
  }
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
    `);
  }
}
function migrateConfigDb(db) {
  const currentVersion = db.pragma("user_version", { simple: true });
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
    `);
  }
}
function getNextResetTime(task) {
  if (!task.lastCompletedAt) return 0;
  const completed = new Date(task.lastCompletedAt);
  switch (task.frequency) {
    case "daily": {
      const next = new Date(completed);
      next.setUTCHours(0, 0, 0, 0);
      next.setUTCDate(next.getUTCDate() + 1);
      return next.getTime();
    }
    case "weekly": {
      const next = new Date(completed);
      next.setUTCHours(0, 0, 0, 0);
      const daysUntilWed = (3 - next.getUTCDay() + 7) % 7 || 7;
      next.setUTCDate(next.getUTCDate() + daysUntilWed);
      return next.getTime();
    }
    case "custom": {
      const hours = task.customIntervalHours ?? 24;
      return task.lastCompletedAt + hours * 60 * 60 * 1e3;
    }
    default:
      return 0;
  }
}
class PlayerDatabase {
  db;
  constructor(playerName) {
    const dbPath = getPlayerDbPath(playerName);
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    migratePlayerDb(this.db);
  }
  // ---- Snapshots ----
  insertSnapshotStmt = null;
  writeSnapshot(snapshot) {
    if (!this.insertSnapshotStmt) {
      this.insertSnapshotStmt = this.db.prepare(`
        INSERT INTO skill_snapshots
          (timestamp, session_id, skill, xp, level, boosted_level, xp_hr, actions_hr, xp_gained, progress_percent)
        VALUES
          (@timestamp, @sessionId, @skill, @xp, @level, @boostedLevel, @xpHr, @actionsHr, @xpGained, @progressPercent)
      `);
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
      progressPercent: snapshot.progressPercent
    });
  }
  writeBatchSnapshots(snapshots) {
    const insertMany = this.db.transaction((items) => {
      for (const s of items) {
        this.writeSnapshot(s);
      }
    });
    insertMany(snapshots);
  }
  queryHistory(query) {
    let sql = "SELECT timestamp, xp, xp_hr as xpHr, level FROM skill_snapshots WHERE 1=1";
    const params = {};
    if (query.skill) {
      sql += " AND skill = @skill";
      params.skill = query.skill;
    }
    if (query.startTime) {
      sql += " AND timestamp >= @startTime";
      params.startTime = query.startTime;
    }
    if (query.endTime) {
      sql += " AND timestamp <= @endTime";
      params.endTime = query.endTime;
    }
    if (query.sessionId) {
      sql += " AND session_id = @sessionId";
      params.sessionId = query.sessionId;
    }
    sql += " ORDER BY timestamp ASC";
    if (query.limit) {
      sql += " LIMIT @limit";
      params.limit = query.limit;
    }
    return this.db.prepare(sql).all(params);
  }
  // ---- Sessions ----
  createSession(id, startTime) {
    this.db.prepare(
      "INSERT OR REPLACE INTO sessions (id, start_time) VALUES (?, ?)"
    ).run(id, startTime);
  }
  endSession(id, endTime, totalXpGained) {
    this.db.prepare(
      "UPDATE sessions SET end_time = ?, total_xp_gained = ? WHERE id = ?"
    ).run(endTime, totalXpGained, id);
  }
  listSessions(limit = 50) {
    return this.db.prepare(
      "SELECT id, start_time as startTime, end_time as endTime, total_xp_gained as totalXpGained FROM sessions ORDER BY start_time DESC LIMIT ?"
    ).all(limit);
  }
  // ---- Goals ----
  listGoals() {
    return this.db.prepare(
      "SELECT id, type, skill, target_level as targetLevel, target_xp as targetXp, description, completed, created_at as createdAt, completed_at as completedAt, pinned FROM goals ORDER BY pinned DESC, created_at DESC"
    ).all().map((row) => ({ ...row, completed: !!row.completed, pinned: !!row.pinned }));
  }
  createGoal(goal) {
    const id = v4();
    const createdAt = Date.now();
    this.db.prepare(
      "INSERT INTO goals (id, type, skill, target_level, target_xp, description, completed, created_at, pinned) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)"
    ).run(id, goal.type, goal.skill, goal.targetLevel, goal.targetXp, goal.description, createdAt, goal.pinned ? 1 : 0);
    return { ...goal, id, completed: false, createdAt, completedAt: null };
  }
  updateGoal(goal) {
    this.db.prepare(
      "UPDATE goals SET type = ?, skill = ?, target_level = ?, target_xp = ?, description = ?, completed = ?, completed_at = ?, pinned = ? WHERE id = ?"
    ).run(goal.type, goal.skill, goal.targetLevel, goal.targetXp, goal.description, goal.completed ? 1 : 0, goal.completedAt, goal.pinned ? 1 : 0, goal.id);
  }
  deleteGoal(id) {
    this.db.prepare("DELETE FROM goals WHERE id = ?").run(id);
  }
  // ---- Tasks (recurring) ----
  listTasks() {
    return this.db.prepare(
      `SELECT id, description, frequency, custom_interval_hours as customIntervalHours,
       last_completed_at as lastCompletedAt, completed_this_period as completedThisPeriod,
       created_at as createdAt, pinned
       FROM tasks ORDER BY pinned DESC, created_at ASC`
    ).all().map((row) => ({
      ...row,
      completedThisPeriod: !!row.completedThisPeriod,
      pinned: !!row.pinned
    }));
  }
  createTask(task) {
    const id = v4();
    const createdAt = Date.now();
    this.db.prepare(
      "INSERT INTO tasks (id, description, frequency, custom_interval_hours, created_at, pinned) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, task.description, task.frequency, task.customIntervalHours, createdAt, task.pinned ? 1 : 0);
    return { ...task, id, createdAt, lastCompletedAt: null, completedThisPeriod: false };
  }
  updateTask(task) {
    this.db.prepare(
      "UPDATE tasks SET description = ?, frequency = ?, custom_interval_hours = ?, pinned = ? WHERE id = ?"
    ).run(task.description, task.frequency, task.customIntervalHours, task.pinned ? 1 : 0, task.id);
  }
  toggleTaskComplete(id) {
    const existing = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!existing) return null;
    const nowComplete = !existing.completed_this_period;
    const lastCompleted = nowComplete ? Date.now() : existing.last_completed_at;
    this.db.prepare(
      "UPDATE tasks SET completed_this_period = ?, last_completed_at = ? WHERE id = ?"
    ).run(nowComplete ? 1 : 0, lastCompleted, id);
    return {
      id: existing.id,
      description: existing.description,
      frequency: existing.frequency,
      customIntervalHours: existing.custom_interval_hours,
      lastCompletedAt: lastCompleted,
      completedThisPeriod: nowComplete,
      createdAt: existing.created_at,
      pinned: !!existing.pinned
    };
  }
  /** Reset tasks whose period has elapsed */
  resetExpiredTasks() {
    const now = Date.now();
    const tasks = this.listTasks();
    for (const task of tasks) {
      if (!task.completedThisPeriod || !task.lastCompletedAt) continue;
      const resetTime = getNextResetTime(task);
      if (now >= resetTime) {
        this.db.prepare(
          "UPDATE tasks SET completed_this_period = 0 WHERE id = ?"
        ).run(task.id);
      }
    }
  }
  deleteTask(id) {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }
  // ---- Quest Progress ----
  listQuestProgress() {
    return this.db.prepare(
      "SELECT quest_name as questName, status, updated_at as updatedAt FROM quest_progress ORDER BY quest_name"
    ).all();
  }
  updateQuestStatus(questName, status) {
    this.db.prepare(
      "INSERT OR REPLACE INTO quest_progress (quest_name, status, updated_at) VALUES (?, ?, ?)"
    ).run(questName, status, Date.now());
  }
  // ---- Merge ----
  /** Import all data from another player's database file */
  importFrom(sourceDbPath) {
    const sourceDb = new Database(sourceDbPath, { readonly: true });
    this.db.exec(`ATTACH DATABASE '${sourceDbPath}' AS source`);
    this.db.exec(`
      INSERT INTO skill_snapshots (timestamp, session_id, skill, xp, level, boosted_level, xp_hr, actions_hr, xp_gained, progress_percent)
      SELECT timestamp, session_id, skill, xp, level, boosted_level, xp_hr, actions_hr, xp_gained, progress_percent
      FROM source.skill_snapshots;

      INSERT OR IGNORE INTO sessions (id, start_time, end_time, total_xp_gained)
      SELECT id, start_time, end_time, total_xp_gained
      FROM source.sessions;
    `);
    this.db.exec("DETACH DATABASE source");
    sourceDb.close();
  }
  close() {
    this.db.close();
  }
}
class ConfigDatabase {
  db;
  constructor() {
    const dbPath = getConfigDbPath();
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    migrateConfigDb(this.db);
  }
  // ---- Connections ----
  listConnections() {
    return this.db.prepare(
      `SELECT id, label, host, port, endpoint, poll_interval as pollInterval, enabled
       FROM connections ORDER BY label`
    ).all().map((row) => ({
      ...row,
      enabled: !!row.enabled
    }));
  }
  saveConnection(config) {
    this.db.prepare(
      `INSERT OR REPLACE INTO connections (id, label, host, port, endpoint, poll_interval, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(config.id, config.label, config.host, config.port, config.endpoint, config.pollInterval, config.enabled ? 1 : 0);
  }
  deleteConnection(id) {
    this.db.prepare("DELETE FROM connections WHERE id = ?").run(id);
  }
  // ---- Settings ----
  getSettings() {
    const rows = this.db.prepare("SELECT key, value FROM app_settings").all();
    const settings = { ...DEFAULT_APP_SETTINGS };
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
      }
    }
    return settings;
  }
  updateSettings(partial) {
    const upsert = this.db.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
    );
    const updateMany = this.db.transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run(key, JSON.stringify(value));
      }
    });
    updateMany(Object.entries(partial));
    return this.getSettings();
  }
  // ---- Account Merges ----
  recordMerge(sourcePlayer, targetPlayer) {
    this.db.prepare(
      "INSERT INTO account_merges (id, source_player, target_player, merged_at) VALUES (?, ?, ?, ?)"
    ).run(v4(), sourcePlayer, targetPlayer, Date.now());
  }
  // ---- Players ----
  listPlayers() {
    const dataDir = getDataDir();
    const files = fs.readdirSync(dataDir);
    return files.filter((f) => f.endsWith(".db") && f !== "config.db").map((f) => f.replace(".db", ""));
  }
  close() {
    this.db.close();
  }
}
class DatabaseManager {
  configDb = null;
  playerDbs = /* @__PURE__ */ new Map();
  getConfigDb() {
    if (!this.configDb) {
      this.configDb = new ConfigDatabase();
    }
    return this.configDb;
  }
  getPlayerDb(playerName) {
    const safeName = playerName.replace(/[^a-zA-Z0-9_-]/g, "_");
    let db = this.playerDbs.get(safeName);
    if (!db) {
      db = new PlayerDatabase(playerName);
      this.playerDbs.set(safeName, db);
    }
    return db;
  }
  closeAll() {
    this.configDb?.close();
    this.configDb = null;
    for (const db of this.playerDbs.values()) {
      db.close();
    }
    this.playerDbs.clear();
  }
}
const SKILL_NAME_SET$1 = new Set(SKILL_NAMES);
function validatePayload(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const obj = raw;
  if (typeof obj.player !== "string" || obj.player.length === 0) return null;
  if (typeof obj.logged_in !== "boolean") return null;
  if (typeof obj.timestamp !== "number") return null;
  const activeSkill = typeof obj.active_skill === "string" ? obj.active_skill : null;
  if (typeof obj.skills !== "object" || obj.skills === null) return null;
  const rawSkills = obj.skills;
  const validatedSkills = {};
  for (const [name, data] of Object.entries(rawSkills)) {
    if (!SKILL_NAME_SET$1.has(name)) continue;
    const validated = validateSkillData(data);
    if (validated) {
      validatedSkills[name] = validated;
    }
  }
  return {
    player: obj.player,
    logged_in: obj.logged_in,
    active_skill: activeSkill && SKILL_NAME_SET$1.has(activeSkill) ? activeSkill : null,
    timestamp: obj.timestamp,
    skills: validatedSkills
  };
}
function validateSkillData(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const obj = raw;
  const xp = asNumber(obj.xp);
  const level = asNumber(obj.level);
  const boostedLevel = asNumber(obj.boosted_level);
  const xpHr = asNumber(obj.xp_hr);
  const actionsHr = asNumber(obj.actions_hr);
  const xpGained = asNumber(obj.xp_gained);
  const progressPercent = asNumber(obj.progress_percent);
  const lastGain = asNumber(obj.last_gain);
  if (xp === null || level === null || boostedLevel === null) return null;
  return {
    xp,
    level,
    boosted_level: boostedLevel,
    xp_hr: xpHr ?? 0,
    actions_hr: actionsHr ?? 0,
    time_to_level: typeof obj.time_to_level === "string" ? obj.time_to_level : "",
    xp_gained: xpGained ?? 0,
    progress_percent: progressPercent ?? 0,
    last_gain: lastGain ?? 0
  };
}
function asNumber(val) {
  if (typeof val === "number" && !isNaN(val)) return val;
  return null;
}
const SKILL_NAME_SET = new Set(SKILL_NAMES);
function normalizePayload(raw) {
  const skills = {};
  for (const [name, data] of Object.entries(raw.skills)) {
    if (!SKILL_NAME_SET.has(name)) continue;
    skills[name] = {
      xp: data.xp,
      level: data.level,
      boostedLevel: data.boosted_level,
      xpHr: data.xp_hr,
      actionsHr: data.actions_hr,
      timeToLevel: data.time_to_level,
      xpGained: data.xp_gained,
      progressPercent: data.progress_percent,
      lastGain: data.last_gain
    };
  }
  return {
    playerName: raw.player,
    loggedIn: raw.logged_in,
    activeSkill: raw.active_skill,
    timestamp: raw.timestamp,
    skills
  };
}
function computeDiff(connectionId, previous, current, session) {
  if (previous === null) {
    return {
      playerName: current.playerName,
      connectionId,
      loggedIn: current.loggedIn,
      activeSkill: current.activeSkill,
      timestamp: current.timestamp,
      skills: { ...current.skills },
      session
    };
  }
  const changedSkills = {};
  let hasChanges = false;
  if (previous.loggedIn !== current.loggedIn || previous.activeSkill !== current.activeSkill) {
    hasChanges = true;
  }
  for (const [name, skillData] of Object.entries(current.skills)) {
    const skillName = name;
    const prev = previous.skills[skillName];
    if (!prev || hasSkillChanged(prev, skillData)) {
      changedSkills[skillName] = skillData;
      hasChanges = true;
    }
  }
  if (!hasChanges) return null;
  return {
    playerName: current.playerName,
    connectionId,
    loggedIn: current.loggedIn,
    activeSkill: current.activeSkill,
    timestamp: current.timestamp,
    skills: changedSkills,
    session
  };
}
function hasSkillChanged(prev, curr) {
  return prev.xp !== curr.xp || prev.level !== curr.level || prev.boostedLevel !== curr.boostedLevel || prev.xpHr !== curr.xpHr || prev.actionsHr !== curr.actionsHr || prev.xpGained !== curr.xpGained || prev.progressPercent !== curr.progressPercent || prev.timeToLevel !== curr.timeToLevel;
}
class PlayerContext {
  playerName;
  sessionId;
  sessionStartTime;
  currentSkills = {};
  firstSeenXp = {};
  loggedIn = false;
  activeSkill = null;
  timestamp = 0;
  lastSnapshotTime = 0;
  constructor(playerName, sessionId2) {
    this.playerName = playerName;
    this.sessionId = sessionId2;
    this.sessionStartTime = Date.now();
  }
  /**
   * Ingest a normalized tick payload. Updates internal state and returns
   * the previous state for diffing.
   */
  ingest(payload) {
    const previousSkills = { ...this.currentSkills };
    const previousLoggedIn = this.loggedIn;
    const previousActiveSkill = this.activeSkill;
    this.loggedIn = payload.loggedIn;
    this.activeSkill = payload.activeSkill;
    this.timestamp = payload.timestamp;
    for (const [name, data] of Object.entries(payload.skills)) {
      const skillName = name;
      this.currentSkills[skillName] = data;
      if (!(skillName in this.firstSeenXp)) {
        this.firstSeenXp[skillName] = data.xp;
      }
    }
    return { previousSkills, previousLoggedIn, previousActiveSkill };
  }
  /** Get the current session state with derived metrics */
  getSessionState() {
    const skillXpGained = {};
    let totalXpGained = 0;
    for (const [name, data] of Object.entries(this.currentSkills)) {
      const skillName = name;
      const firstXp = this.firstSeenXp[skillName];
      if (firstXp !== void 0 && data) {
        const gained = data.xp - firstXp;
        if (gained > 0) {
          skillXpGained[skillName] = gained;
          totalXpGained += gained;
        }
      }
    }
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      duration: Date.now() - this.sessionStartTime,
      totalXpGained,
      skillXpGained
    };
  }
  /** Get the full player state snapshot */
  getPlayerState() {
    return {
      playerName: this.playerName,
      loggedIn: this.loggedIn,
      activeSkill: this.activeSkill,
      timestamp: this.timestamp,
      skills: { ...this.currentSkills },
      session: this.getSessionState()
    };
  }
  /** Check if enough time has elapsed for a 1-minute snapshot */
  shouldSnapshot() {
    const now = Date.now();
    if (now - this.lastSnapshotTime >= 6e4) {
      this.lastSnapshotTime = now;
      return true;
    }
    return false;
  }
  getCurrentSkills() {
    return this.currentSkills;
  }
  isLoggedIn() {
    return this.loggedIn;
  }
}
const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_POLL_INTERVAL = 5e3;
class ConnectionManager {
  connections = /* @__PURE__ */ new Map();
  sessionId;
  onPlayerUpdate;
  onConnectionStatus;
  onSnapshotDue;
  constructor(sessionId2, onPlayerUpdate, onConnectionStatus, onSnapshotDue) {
    this.sessionId = sessionId2;
    this.onPlayerUpdate = onPlayerUpdate;
    this.onConnectionStatus = onConnectionStatus;
    this.onSnapshotDue = onSnapshotDue;
  }
  /** Add and start a connection */
  addConnection(config) {
    if (this.connections.has(config.id)) {
      this.removeConnection(config.id);
    }
    const conn = {
      config,
      timer: null,
      status: "disconnected",
      consecutiveFailures: 0,
      lastError: null,
      inFlight: false,
      playerContext: null,
      previousState: null
    };
    this.connections.set(config.id, conn);
    if (config.enabled) {
      this.startPolling(conn);
    }
  }
  /** Remove and stop a connection */
  removeConnection(id) {
    const conn = this.connections.get(id);
    if (conn) {
      this.stopPolling(conn);
      this.connections.delete(id);
    }
  }
  /** Update connection config (stops and restarts polling) */
  updateConnection(config) {
    this.removeConnection(config.id);
    this.addConnection(config);
  }
  /** Stop all connections */
  stopAll() {
    for (const conn of this.connections.values()) {
      this.stopPolling(conn);
    }
    this.connections.clear();
  }
  /** Get current status of all connections */
  getConnectionStates() {
    return Array.from(this.connections.values()).map((conn) => ({
      config: conn.config,
      status: conn.status,
      lastPlayer: conn.playerContext?.playerName ?? null,
      lastError: conn.lastError
    }));
  }
  /** Get a player context by name (for persistence queries) */
  getPlayerContext(playerName) {
    for (const conn of this.connections.values()) {
      if (conn.playerContext?.playerName === playerName) {
        return conn.playerContext;
      }
    }
    return null;
  }
  // ---- Private ----
  startPolling(conn) {
    const interval = conn.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? BACKOFF_POLL_INTERVAL : conn.config.pollInterval;
    conn.timer = setInterval(() => this.poll(conn), interval);
    this.poll(conn);
  }
  stopPolling(conn) {
    if (conn.timer) {
      clearInterval(conn.timer);
      conn.timer = null;
    }
  }
  async poll(conn) {
    if (conn.inFlight) return;
    conn.inFlight = true;
    try {
      const raw = await this.fetchEndpoint(conn.config);
      const validated = validatePayload(raw);
      if (!validated) {
        this.handleFailure(conn, "Invalid JSON payload from plugin");
        return;
      }
      const normalized = normalizePayload(validated);
      conn.consecutiveFailures = 0;
      if (conn.status !== "connected") {
        conn.status = "connected";
        conn.lastError = null;
        this.emitConnectionStatus(conn);
        this.stopPolling(conn);
        this.startPolling(conn);
      }
      if (!conn.playerContext || conn.playerContext.playerName !== normalized.playerName) {
        conn.playerContext = new PlayerContext(normalized.playerName, this.sessionId);
        conn.previousState = null;
      }
      const { previousSkills, previousLoggedIn, previousActiveSkill } = conn.playerContext.ingest(normalized);
      const prevState = conn.previousState;
      if (!prevState) {
        console.log(`[ESP32Tracker] First tick for ${normalized.playerName}: ${Object.keys(normalized.skills).length} skills in payload`);
      }
      const diff = computeDiff(
        conn.config.id,
        prevState,
        normalized,
        conn.playerContext.getSessionState()
      );
      conn.previousState = {
        loggedIn: normalized.loggedIn,
        activeSkill: normalized.activeSkill,
        skills: { ...normalized.skills }
      };
      if (diff) {
        console.log(`[ESP32Tracker] Pushing diff: ${Object.keys(diff.skills).length} skills`);
        this.onPlayerUpdate(diff);
      }
      if (conn.playerContext.shouldSnapshot() && conn.playerContext.isLoggedIn()) {
        this.onSnapshotDue(normalized.playerName, conn.playerContext);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      this.handleFailure(conn, message);
    } finally {
      conn.inFlight = false;
    }
  }
  handleFailure(conn, error) {
    conn.consecutiveFailures++;
    conn.lastError = error;
    const newStatus = conn.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? "reconnecting" : "error";
    if (conn.status !== newStatus) {
      conn.status = newStatus;
      this.emitConnectionStatus(conn);
      if (newStatus === "reconnecting") {
        this.stopPolling(conn);
        this.startPolling(conn);
      }
    }
  }
  emitConnectionStatus(conn) {
    this.onConnectionStatus({
      connectionId: conn.config.id,
      status: conn.status,
      lastError: conn.lastError,
      playerName: conn.playerContext?.playerName ?? null
    });
  }
  fetchEndpoint(config) {
    const url = `http://${config.host}:${config.port}${config.endpoint}`;
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: 2e3 }, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Failed to parse JSON response"));
          }
        });
      });
      req.on("error", (err) => reject(err));
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });
    });
  }
}
async function testConnection(host, port, endpoint) {
  const url = `http://${host}:${port}${endpoint}`;
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3e3 }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          const validated = validatePayload(parsed);
          if (validated) {
            resolve({ success: true, player: validated.player });
          } else {
            resolve({ success: false, error: "Response is not a valid plugin payload" });
          }
        } catch {
          resolve({ success: false, error: "Invalid JSON response" });
        }
      });
    });
    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, error: "Connection timed out" });
    });
  });
}
const IPC_CHANNELS = {
  // Main → Renderer (push)
  PLAYER_UPDATE: "player:update",
  CONNECTION_STATUS: "connection:status",
  // Renderer → Main (request/response)
  CONNECTION_ADD: "connection:add",
  CONNECTION_REMOVE: "connection:remove",
  CONNECTION_UPDATE: "connection:update",
  CONNECTION_LIST: "connection:list",
  CONNECTION_TEST: "connection:test",
  PLAYER_LIST: "player:list",
  PLAYER_GET_STATE: "player:get-state",
  PLAYER_MERGE: "player:merge",
  HISTORY_QUERY: "history:query",
  SESSION_LIST: "session:list",
  GOAL_LIST: "goal:list",
  GOAL_CREATE: "goal:create",
  GOAL_UPDATE: "goal:update",
  GOAL_DELETE: "goal:delete",
  TASK_LIST: "task:list",
  TASK_CREATE: "task:create",
  TASK_UPDATE: "task:update",
  TASK_DELETE: "task:delete",
  TASK_TOGGLE_COMPLETE: "task:toggle-complete",
  QUEST_LIST: "quest:list",
  QUEST_UPDATE_STATUS: "quest:update-status",
  SETTINGS_GET: "settings:get",
  SETTINGS_UPDATE: "settings:update",
  APP_GET_VERSION: "app:get-version"
};
function registerIpcHandlers(dbManager2, connectionManager2, getMainWindow) {
  const configDb = dbManager2.getConfigDb();
  electron.ipcMain.handle(IPC_CHANNELS.CONNECTION_LIST, () => {
    return connectionManager2.getConnectionStates();
  });
  electron.ipcMain.handle(IPC_CHANNELS.CONNECTION_ADD, (_event, data) => {
    const config = { ...data, id: v4() };
    configDb.saveConnection(config);
    connectionManager2.addConnection(config);
    return config;
  });
  electron.ipcMain.handle(IPC_CHANNELS.CONNECTION_REMOVE, (_event, data) => {
    configDb.deleteConnection(data.id);
    connectionManager2.removeConnection(data.id);
    return { success: true };
  });
  electron.ipcMain.handle(IPC_CHANNELS.CONNECTION_UPDATE, (_event, config) => {
    configDb.saveConnection(config);
    connectionManager2.updateConnection(config);
    return config;
  });
  electron.ipcMain.handle(IPC_CHANNELS.CONNECTION_TEST, async (_event, data) => {
    return testConnection(data.host, data.port, data.endpoint);
  });
  electron.ipcMain.handle(IPC_CHANNELS.PLAYER_LIST, () => {
    return configDb.listPlayers();
  });
  electron.ipcMain.handle(IPC_CHANNELS.PLAYER_GET_STATE, (_event, data) => {
    const context = connectionManager2.getPlayerContext(data.playerName);
    return context?.getPlayerState() ?? null;
  });
  electron.ipcMain.handle(IPC_CHANNELS.PLAYER_MERGE, (_event, data) => {
    try {
      const targetDb = dbManager2.getPlayerDb(data.targetPlayer);
      const sourceSafeName = data.sourcePlayer.replace(/[^a-zA-Z0-9_-]/g, "_");
      const { app } = require("electron");
      const path2 = require("path");
      const sourceDbPath = path2.join(app.getPath("userData"), "data", `${sourceSafeName}.db`);
      targetDb.importFrom(sourceDbPath);
      configDb.recordMerge(data.sourcePlayer, data.targetPlayer);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "Merge failed" };
    }
  });
  electron.ipcMain.handle(IPC_CHANNELS.HISTORY_QUERY, (_event, data) => {
    const { playerName, ...query } = data;
    const playerDb = dbManager2.getPlayerDb(playerName);
    return playerDb.queryHistory(query);
  });
  electron.ipcMain.handle(IPC_CHANNELS.SESSION_LIST, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    return playerDb.listSessions(data.limit);
  });
  electron.ipcMain.handle(IPC_CHANNELS.GOAL_LIST, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    return playerDb.listGoals();
  });
  electron.ipcMain.handle(IPC_CHANNELS.GOAL_CREATE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    return playerDb.createGoal(data.goal);
  });
  electron.ipcMain.handle(IPC_CHANNELS.GOAL_UPDATE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    playerDb.updateGoal(data.goal);
    return data.goal;
  });
  electron.ipcMain.handle(IPC_CHANNELS.GOAL_DELETE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    playerDb.deleteGoal(data.goalId);
    return { success: true };
  });
  electron.ipcMain.handle(IPC_CHANNELS.TASK_LIST, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    playerDb.resetExpiredTasks();
    return playerDb.listTasks();
  });
  electron.ipcMain.handle(IPC_CHANNELS.TASK_CREATE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    return playerDb.createTask(data.task);
  });
  electron.ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    playerDb.updateTask(data.task);
    return data.task;
  });
  electron.ipcMain.handle(IPC_CHANNELS.TASK_DELETE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    playerDb.deleteTask(data.taskId);
    return { success: true };
  });
  electron.ipcMain.handle(IPC_CHANNELS.TASK_TOGGLE_COMPLETE, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    return playerDb.toggleTaskComplete(data.taskId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.QUEST_LIST, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    return playerDb.listQuestProgress();
  });
  electron.ipcMain.handle(IPC_CHANNELS.QUEST_UPDATE_STATUS, (_event, data) => {
    const playerDb = dbManager2.getPlayerDb(data.playerName);
    playerDb.updateQuestStatus(data.questName, data.status);
    return { success: true };
  });
  electron.ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return configDb.getSettings();
  });
  electron.ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, partial) => {
    return configDb.updateSettings(partial);
  });
  electron.ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    const { app } = require("electron");
    return app.getVersion();
  });
}
function createConnectionCallbacks(dbManager2, getMainWindow) {
  function pushToRenderer(channel, data) {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
  const onPlayerUpdate = (diff) => {
    pushToRenderer(IPC_CHANNELS.PLAYER_UPDATE, diff);
  };
  const onConnectionStatus = (update) => {
    pushToRenderer(IPC_CHANNELS.CONNECTION_STATUS, update);
  };
  const onSnapshotDue = (playerName, context) => {
    const playerDb = dbManager2.getPlayerDb(playerName);
    const skills = context.getCurrentSkills();
    const session = context.getSessionState();
    const now = Date.now();
    const snapshots = [];
    for (const [name, data] of Object.entries(skills)) {
      if (data) {
        snapshots.push({
          timestamp: now,
          sessionId: session.sessionId,
          skill: name,
          xp: data.xp,
          level: data.level,
          boostedLevel: data.boostedLevel,
          xpHr: data.xpHr,
          actionsHr: data.actionsHr,
          xpGained: data.xpGained,
          progressPercent: data.progressPercent
        });
      }
    }
    if (snapshots.length > 0) {
      playerDb.writeBatchSnapshots(snapshots);
    }
  };
  return { onPlayerUpdate, onConnectionStatus, onSnapshotDue };
}
let mainWindow = null;
const dbManager = new DatabaseManager();
let connectionManager = null;
const sessionId = v4();
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "OSRS XP Tracker",
    backgroundColor: "#0E0E0E",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
      // Required for better-sqlite3 native module
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.app.whenReady().then(() => {
  const { onPlayerUpdate, onConnectionStatus, onSnapshotDue } = createConnectionCallbacks(
    dbManager,
    () => mainWindow
  );
  connectionManager = new ConnectionManager(
    sessionId,
    onPlayerUpdate,
    onConnectionStatus,
    onSnapshotDue
  );
  registerIpcHandlers(dbManager, connectionManager);
  createWindow();
  mainWindow.webContents.on("did-finish-load", () => {
    setTimeout(() => {
      const configDb = dbManager.getConfigDb();
      const savedConnections = configDb.listConnections();
      for (const config of savedConnections) {
        connectionManager.addConnection(config);
      }
      console.log(`[ESP32Tracker] Renderer ready, started ${savedConnections.length} connection(s)`);
    }, 500);
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("before-quit", () => {
  if (connectionManager) {
    const states = connectionManager.getConnectionStates();
    for (const state of states) {
      if (state.lastPlayer) {
        const context = connectionManager.getPlayerContext(state.lastPlayer);
        if (context) {
          const playerDb = dbManager.getPlayerDb(state.lastPlayer);
          const session = context.getSessionState();
          playerDb.endSession(session.sessionId, Date.now(), session.totalXpGained);
        }
      }
    }
    connectionManager.stopAll();
  }
  dbManager.closeAll();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
