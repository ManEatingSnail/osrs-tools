import { ConnectionConfig, ConnectionStatus, ConnectionStatusUpdate, PlayerUpdateDiff, SkillName, SkillState } from '@shared/types'
import { validatePayload } from '../data/validator'
import { normalizePayload, NormalizedPayload } from '../data/normalizer'
import { computeDiff } from '../data/diff-engine'
import { PlayerContext } from '../data/player-context'
import { v4 as uuidv4 } from 'uuid'
import http from 'http'

const MAX_CONSECUTIVE_FAILURES = 5
const BACKOFF_POLL_INTERVAL = 5000  // 5 seconds when in backoff

export type OnPlayerUpdate = (diff: PlayerUpdateDiff) => void
export type OnConnectionStatus = (update: ConnectionStatusUpdate) => void
export type OnSnapshotDue = (playerName: string, context: PlayerContext) => void

interface ActiveConnection {
  config: ConnectionConfig
  timer: ReturnType<typeof setInterval> | null
  status: ConnectionStatus
  consecutiveFailures: number
  lastError: string | null
  inFlight: boolean
  playerContext: PlayerContext | null
  previousState: {
    loggedIn: boolean
    activeSkill: SkillName | null
    skills: Partial<Record<SkillName, SkillState>>
  } | null
}

/**
 * Manages all active connections to RuneLite plugin endpoints.
 * Each connection runs its own independent poll loop.
 */
export class ConnectionManager {
  private connections = new Map<string, ActiveConnection>()
  private sessionId: string
  private onPlayerUpdate: OnPlayerUpdate
  private onConnectionStatus: OnConnectionStatus
  private onSnapshotDue: OnSnapshotDue

  constructor(
    sessionId: string,
    onPlayerUpdate: OnPlayerUpdate,
    onConnectionStatus: OnConnectionStatus,
    onSnapshotDue: OnSnapshotDue
  ) {
    this.sessionId = sessionId
    this.onPlayerUpdate = onPlayerUpdate
    this.onConnectionStatus = onConnectionStatus
    this.onSnapshotDue = onSnapshotDue
  }

  /** Add and start a connection */
  addConnection(config: ConnectionConfig): void {
    if (this.connections.has(config.id)) {
      this.removeConnection(config.id)
    }

    const conn: ActiveConnection = {
      config,
      timer: null,
      status: 'disconnected',
      consecutiveFailures: 0,
      lastError: null,
      inFlight: false,
      playerContext: null,
      previousState: null,
    }

    this.connections.set(config.id, conn)

    if (config.enabled) {
      this.startPolling(conn)
    }
  }

  /** Remove and stop a connection */
  removeConnection(id: string): void {
    const conn = this.connections.get(id)
    if (conn) {
      this.stopPolling(conn)
      this.connections.delete(id)
    }
  }

  /** Update connection config (stops and restarts polling) */
  updateConnection(config: ConnectionConfig): void {
    this.removeConnection(config.id)
    this.addConnection(config)
  }

  /** Stop all connections */
  stopAll(): void {
    for (const conn of this.connections.values()) {
      this.stopPolling(conn)
    }
    this.connections.clear()
  }

  /** Get current status of all connections */
  getConnectionStates(): Array<{ config: ConnectionConfig; status: ConnectionStatus; lastPlayer: string | null; lastError: string | null }> {
    return Array.from(this.connections.values()).map(conn => ({
      config: conn.config,
      status: conn.status,
      lastPlayer: conn.playerContext?.playerName ?? null,
      lastError: conn.lastError,
    }))
  }

  /** Get a player context by name (for persistence queries) */
  getPlayerContext(playerName: string): PlayerContext | null {
    for (const conn of this.connections.values()) {
      if (conn.playerContext?.playerName === playerName) {
        return conn.playerContext
      }
    }
    return null
  }

  // ---- Private ----

  private startPolling(conn: ActiveConnection): void {
    const interval = conn.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
      ? BACKOFF_POLL_INTERVAL
      : conn.config.pollInterval

    conn.timer = setInterval(() => this.poll(conn), interval)

    // Immediate first poll
    this.poll(conn)
  }

  private stopPolling(conn: ActiveConnection): void {
    if (conn.timer) {
      clearInterval(conn.timer)
      conn.timer = null
    }
  }

  private async poll(conn: ActiveConnection): Promise<void> {
    // Skip if previous request still in flight
    if (conn.inFlight) return

    conn.inFlight = true

    try {
      const raw = await this.fetchEndpoint(conn.config)
      const validated = validatePayload(raw)

      if (!validated) {
        this.handleFailure(conn, 'Invalid JSON payload from plugin')
        return
      }

      const normalized = normalizePayload(validated)

      // Success — reset failure counter
      conn.consecutiveFailures = 0

      // Update status
      if (conn.status !== 'connected') {
        conn.status = 'connected'
        conn.lastError = null
        this.emitConnectionStatus(conn)

        // If we were in backoff, restart at normal interval
        this.stopPolling(conn)
        this.startPolling(conn)
      }

      // Create or update player context
      if (!conn.playerContext || conn.playerContext.playerName !== normalized.playerName) {
        conn.playerContext = new PlayerContext(normalized.playerName, this.sessionId)
        conn.previousState = null
      }

      // Ingest and diff
      const { previousSkills, previousLoggedIn, previousActiveSkill } = conn.playerContext.ingest(normalized)

      const prevState = conn.previousState
      
      // Debug: log skill count on first tick
      if (!prevState) {
        console.log(`[ESP32Tracker] First tick for ${normalized.playerName}: ${Object.keys(normalized.skills).length} skills in payload`)
      }

      const diff = computeDiff(
        conn.config.id,
        prevState,
        normalized,
        conn.playerContext.getSessionState()
      )

      // Update previous state for next diff
      conn.previousState = {
        loggedIn: normalized.loggedIn,
        activeSkill: normalized.activeSkill,
        skills: { ...normalized.skills },
      }

      // Push diff to renderer if something changed
      if (diff) {
        console.log(`[ESP32Tracker] Pushing diff: ${Object.keys(diff.skills).length} skills`)
        this.onPlayerUpdate(diff)
      }

      // Check if 1-minute snapshot is due
      if (conn.playerContext.shouldSnapshot() && conn.playerContext.isLoggedIn()) {
        this.onSnapshotDue(normalized.playerName, conn.playerContext)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.handleFailure(conn, message)
    } finally {
      conn.inFlight = false
    }
  }

  private handleFailure(conn: ActiveConnection, error: string): void {
    conn.consecutiveFailures++
    conn.lastError = error

    const newStatus: ConnectionStatus =
      conn.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES ? 'reconnecting' : 'error'

    if (conn.status !== newStatus) {
      conn.status = newStatus
      this.emitConnectionStatus(conn)

      // Switch to backoff interval
      if (newStatus === 'reconnecting') {
        this.stopPolling(conn)
        this.startPolling(conn) // Will use BACKOFF_POLL_INTERVAL
      }
    }
  }

  private emitConnectionStatus(conn: ActiveConnection): void {
    this.onConnectionStatus({
      connectionId: conn.config.id,
      status: conn.status,
      lastError: conn.lastError,
      playerName: conn.playerContext?.playerName ?? null,
    })
  }

  private fetchEndpoint(config: ConnectionConfig): Promise<unknown> {
    const url = `http://${config.host}:${config.port}${config.endpoint}`

    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: 2000 }, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error('Failed to parse JSON response'))
          }
        })
      })

      req.on('error', (err) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request timed out'))
      })
    })
  }
}

/**
 * Test a connection without starting a poll loop.
 * Used by the connection settings UI to validate before saving.
 */
export async function testConnection(
  host: string,
  port: number,
  endpoint: string
): Promise<{ success: boolean; player?: string; error?: string }> {
  const url = `http://${host}:${port}${endpoint}`

  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          const validated = validatePayload(parsed)
          if (validated) {
            resolve({ success: true, player: validated.player })
          } else {
            resolve({ success: false, error: 'Response is not a valid plugin payload' })
          }
        } catch {
          resolve({ success: false, error: 'Invalid JSON response' })
        }
      })
    })

    req.on('error', (err) => resolve({ success: false, error: err.message }))
    req.on('timeout', () => {
      req.destroy()
      resolve({ success: false, error: 'Connection timed out' })
    })
  })
}
