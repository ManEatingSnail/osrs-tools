import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { ConnectionConfig, PlayerUpdateDiff, ConnectionStatusUpdate, SkillSnapshot, SkillName } from '@shared/types'
import { ConnectionManager, testConnection } from '../connections/connection-manager'
import { DatabaseManager } from '../persistence/database'
import { PlayerContext } from '../data/player-context'
import { v4 as uuidv4 } from 'uuid'

/**
 * Registers all IPC handlers and wires up the connection manager
 * to push real-time data to the renderer.
 */
export function registerIpcHandlers(
  dbManager: DatabaseManager,
  connectionManager: ConnectionManager,
  getMainWindow: () => BrowserWindow | null
): void {
  const configDb = dbManager.getConfigDb()

  // ---- Push helpers ----

  function pushToRenderer(channel: string, data: unknown): void {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  // Wire up connection manager callbacks
  // (These are called from the ConnectionManager when data arrives)

  // ---- Connection Management ----

  ipcMain.handle(IPC_CHANNELS.CONNECTION_LIST, () => {
    return connectionManager.getConnectionStates()
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTION_ADD, (_event, data: Omit<ConnectionConfig, 'id'>) => {
    const config: ConnectionConfig = { ...data, id: uuidv4() }
    configDb.saveConnection(config)
    connectionManager.addConnection(config)
    return config
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTION_REMOVE, (_event, data: { id: string }) => {
    configDb.deleteConnection(data.id)
    connectionManager.removeConnection(data.id)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTION_UPDATE, (_event, config: ConnectionConfig) => {
    configDb.saveConnection(config)
    connectionManager.updateConnection(config)
    return config
  })

  ipcMain.handle(IPC_CHANNELS.CONNECTION_TEST, async (_event, data: { host: string; port: number; endpoint: string }) => {
    return testConnection(data.host, data.port, data.endpoint)
  })

  // ---- Player Data ----

  ipcMain.handle(IPC_CHANNELS.PLAYER_LIST, () => {
    return configDb.listPlayers()
  })

  ipcMain.handle(IPC_CHANNELS.PLAYER_GET_STATE, (_event, data: { playerName: string }) => {
    const context = connectionManager.getPlayerContext(data.playerName)
    return context?.getPlayerState() ?? null
  })

  ipcMain.handle(IPC_CHANNELS.PLAYER_MERGE, (_event, data: { sourcePlayer: string; targetPlayer: string }) => {
    try {
      const targetDb = dbManager.getPlayerDb(data.targetPlayer)
      const sourceSafeName = data.sourcePlayer.replace(/[^a-zA-Z0-9_-]/g, '_')

      // Import requires the source DB path — reconstruct it
      const { app } = require('electron')
      const path = require('path')
      const sourceDbPath = path.join(app.getPath('userData'), 'data', `${sourceSafeName}.db`)

      targetDb.importFrom(sourceDbPath)
      configDb.recordMerge(data.sourcePlayer, data.targetPlayer)

      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Merge failed' }
    }
  })

  // ---- History ----

  ipcMain.handle(IPC_CHANNELS.HISTORY_QUERY, (_event, data) => {
    const { playerName, ...query } = data
    const playerDb = dbManager.getPlayerDb(playerName)
    return playerDb.queryHistory(query)
  })

  ipcMain.handle(IPC_CHANNELS.SESSION_LIST, (_event, data: { playerName: string; limit?: number }) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    return playerDb.listSessions(data.limit)
  })

  // ---- Goals ----

  ipcMain.handle(IPC_CHANNELS.GOAL_LIST, (_event, data: { playerName: string }) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    return playerDb.listGoals()
  })

  ipcMain.handle(IPC_CHANNELS.GOAL_CREATE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    return playerDb.createGoal(data.goal)
  })

  ipcMain.handle(IPC_CHANNELS.GOAL_UPDATE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    playerDb.updateGoal(data.goal)
    return data.goal
  })

  ipcMain.handle(IPC_CHANNELS.GOAL_DELETE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    playerDb.deleteGoal(data.goalId)
    return { success: true }
  })

  // ---- Quest Progress ----

  ipcMain.handle(IPC_CHANNELS.TASK_LIST, (_event, data: { playerName: string }) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    playerDb.resetExpiredTasks()
    return playerDb.listTasks()
  })

  ipcMain.handle(IPC_CHANNELS.TASK_CREATE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    return playerDb.createTask(data.task)
  })

  ipcMain.handle(IPC_CHANNELS.TASK_UPDATE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    playerDb.updateTask(data.task)
    return data.task
  })

  ipcMain.handle(IPC_CHANNELS.TASK_DELETE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    playerDb.deleteTask(data.taskId)
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.TASK_TOGGLE_COMPLETE, (_event, data) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    return playerDb.toggleTaskComplete(data.taskId)
  })

  // ---- Quest Progress (existing) ----

  ipcMain.handle(IPC_CHANNELS.QUEST_LIST, (_event, data: { playerName: string }) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    return playerDb.listQuestProgress()
  })

  ipcMain.handle(IPC_CHANNELS.QUEST_UPDATE_STATUS, (_event, data: { playerName: string; questName: string; status: string }) => {
    const playerDb = dbManager.getPlayerDb(data.playerName)
    playerDb.updateQuestStatus(data.questName, data.status as any)
    return { success: true }
  })

  // ---- Settings ----

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, () => {
    return configDb.getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, (_event, partial) => {
    return configDb.updateSettings(partial)
  })

  // ---- App ----

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    const { app } = require('electron')
    return app.getVersion()
  })
}

/**
 * Creates the callback functions that the ConnectionManager uses
 * to push data to the renderer and persistence layer.
 */
export function createConnectionCallbacks(
  dbManager: DatabaseManager,
  getMainWindow: () => BrowserWindow | null
) {
  function pushToRenderer(channel: string, data: unknown): void {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  const onPlayerUpdate = (diff: PlayerUpdateDiff) => {
    pushToRenderer(IPC_CHANNELS.PLAYER_UPDATE, diff)
  }

  const onConnectionStatus = (update: ConnectionStatusUpdate) => {
    pushToRenderer(IPC_CHANNELS.CONNECTION_STATUS, update)
  }

  const onSnapshotDue = (playerName: string, context: PlayerContext) => {
    const playerDb = dbManager.getPlayerDb(playerName)
    const skills = context.getCurrentSkills()
    const session = context.getSessionState()
    const now = Date.now()

    const snapshots: SkillSnapshot[] = []
    for (const [name, data] of Object.entries(skills)) {
      if (data) {
        snapshots.push({
          timestamp: now,
          sessionId: session.sessionId,
          skill: name as SkillName,
          xp: data.xp,
          level: data.level,
          boostedLevel: data.boostedLevel,
          xpHr: data.xpHr,
          actionsHr: data.actionsHr,
          xpGained: data.xpGained,
          progressPercent: data.progressPercent,
        })
      }
    }

    if (snapshots.length > 0) {
      playerDb.writeBatchSnapshots(snapshots)
    }
  }

  return { onPlayerUpdate, onConnectionStatus, onSnapshotDue }
}
