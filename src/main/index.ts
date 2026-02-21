import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { autoUpdater } from 'electron-updater'
import { DatabaseManager } from './persistence/database'
import { ConnectionManager } from './connections/connection-manager'
import { registerIpcHandlers, createConnectionCallbacks } from './ipc/handlers'
import { IPC_CHANNELS } from '@shared/ipc-channels'

// ============================================================================
// App State
// ============================================================================

let mainWindow: BrowserWindow | null = null
const dbManager = new DatabaseManager()
let connectionManager: ConnectionManager | null = null
const sessionId = uuidv4()

// ============================================================================
// Window Creation
// ============================================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'OSRS XP Tracker',
    backgroundColor: '#0E0E0E',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for better-sqlite3 native module
    },
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ============================================================================
// Auto-Updater
// ============================================================================

function setupAutoUpdater(): void {
  // Don't auto-download — let the user decide
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  function pushUpdateStatus(status: string, info?: Record<string, unknown>): void {
    const win = mainWindow
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC_CHANNELS.APP_UPDATE_STATUS, { status, ...info })
    }
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for update...')
    pushUpdateStatus('checking')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[Updater] Update available: ${info.version}`)
    pushUpdateStatus('available', { version: info.version, releaseDate: info.releaseDate })
  })

  autoUpdater.on('update-not-available', (info) => {
    console.log(`[Updater] Already up to date: ${info.version}`)
    pushUpdateStatus('up-to-date', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    pushUpdateStatus('downloading', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[Updater] Update downloaded: ${info.version}`)
    pushUpdateStatus('downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error(`[Updater] Error: ${err.message}`)
    pushUpdateStatus('error', { message: err.message })
  })

  // IPC: Check for updates (triggered by Settings UI)
  ipcMain.handle(IPC_CHANNELS.APP_CHECK_UPDATE, async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // IPC: Download and install
  ipcMain.handle(IPC_CHANNELS.APP_INSTALL_UPDATE, async () => {
    try {
      await autoUpdater.downloadUpdate()
      // Once downloaded, quit and install
      setImmediate(() => autoUpdater.quitAndInstall())
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // IPC: Get current version
  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion()
  })
}

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Setup auto-updater
  setupAutoUpdater()

  // Create connection callbacks
  const { onPlayerUpdate, onConnectionStatus, onSnapshotDue } = createConnectionCallbacks(
    dbManager,
    () => mainWindow
  )

  // Create connection manager
  connectionManager = new ConnectionManager(
    sessionId,
    onPlayerUpdate,
    onConnectionStatus,
    onSnapshotDue
  )

  // Register IPC handlers
  registerIpcHandlers(dbManager, connectionManager, () => mainWindow)

  // Create window
  createWindow()

  // Load saved connections AFTER the renderer has loaded
  // (otherwise the first tick's IPC push is lost before React mounts)
  mainWindow!.webContents.on('did-finish-load', () => {
    // Small delay to ensure React has mounted and IPC listeners are registered
    setTimeout(() => {
      const configDb = dbManager.getConfigDb()
      const savedConnections = configDb.listConnections()
      for (const config of savedConnections) {
        connectionManager!.addConnection(config)
      }
      console.log(`[ESP32Tracker] Renderer ready, started ${savedConnections.length} connection(s)`)
    }, 500)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  // Finalize sessions — end time and total XP
  if (connectionManager) {
    const states = connectionManager.getConnectionStates()
    for (const state of states) {
      if (state.lastPlayer) {
        const context = connectionManager.getPlayerContext(state.lastPlayer)
        if (context) {
          const playerDb = dbManager.getPlayerDb(state.lastPlayer)
          const session = context.getSessionState()
          playerDb.endSession(session.sessionId, Date.now(), session.totalXpGained)
        }
      }
    }
    connectionManager.stopAll()
  }

  dbManager.closeAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
