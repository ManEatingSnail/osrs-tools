import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { DatabaseManager } from './persistence/database'
import { ConnectionManager } from './connections/connection-manager'
import { registerIpcHandlers, createConnectionCallbacks } from './ipc/handlers'
import { autoUpdater } from 'electron-updater';

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
    title: 'OSRS Tools',
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
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  // Create connection callbacks
  const { onPlayerUpdate, onConnectionStatus, onSnapshotDue } = createConnectionCallbacks(
    dbManager,
    () => mainWindow
  )

  function setupAutoUpdater() {
  // Check for updates on startup
  autoUpdater.checkForUpdatesAndNotify(); 

  // Check again every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);

  autoUpdater.on('update-available', (info) => {
    console.info(`Update available: ${info.version}`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // Prompt user via IPC, or auto-install on next quit
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.webContents.send('update:ready', info.version);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error(`Auto-update error: ${err.message}`);
  });
}

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
