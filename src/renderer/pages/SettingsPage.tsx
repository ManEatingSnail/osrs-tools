import React, { useEffect, useState, useCallback } from 'react'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { ConnectionConfig, ConnectionState } from '@shared/types'
import { DEFAULT_CONNECTION } from '@shared/constants'

// ============================================================================
// Update status types
// ============================================================================

interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseDate?: string
  percent?: number
  transferred?: number
  total?: number
  bytesPerSecond?: number
  message?: string
}

// ============================================================================
// Settings Page
// ============================================================================

export const SettingsPage: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionState[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newHost, setNewHost] = useState(DEFAULT_CONNECTION.host)
  const [newPort, setNewPort] = useState(DEFAULT_CONNECTION.port.toString())
  const [newEndpoint, setNewEndpoint] = useState(DEFAULT_CONNECTION.endpoint)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  // Update state
  const [appVersion, setAppVersion] = useState('...')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' })

  const loadConnections = useCallback(async () => {
    const result = await window.electronAPI.invoke(IPC_CHANNELS.CONNECTION_LIST)
    setConnections(result as ConnectionState[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadConnections()
    // Get app version
    window.electronAPI.invoke(IPC_CHANNELS.APP_GET_VERSION).then((v) => setAppVersion(v as string))
  }, [loadConnections])

  // Listen for update status pushes from main process
  useEffect(() => {
    const unsub = window.electronAPI.onUpdateStatus((data) => {
      setUpdateStatus(data as UpdateStatus)
    })
    return unsub
  }, [])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.electronAPI.invoke(IPC_CHANNELS.CONNECTION_TEST, {
        host: newHost, port: parseInt(newPort, 10), endpoint: newEndpoint,
      }) as { success: boolean; player?: string; error?: string }
      setTestResult(result.success ? `Connected! Player: ${result.player}` : `Failed: ${result.error}`)
    } catch { setTestResult('Test failed') }
    setTesting(false)
  }

  const handleAdd = async () => {
    if (!newLabel.trim()) return
    await window.electronAPI.invoke(IPC_CHANNELS.CONNECTION_ADD, {
      label: newLabel.trim(), host: newHost, port: parseInt(newPort, 10),
      endpoint: newEndpoint, pollInterval: DEFAULT_CONNECTION.pollInterval, enabled: true,
    })
    setNewLabel(''); setNewHost(DEFAULT_CONNECTION.host)
    setNewPort(DEFAULT_CONNECTION.port.toString()); setNewEndpoint(DEFAULT_CONNECTION.endpoint)
    setTestResult(null); loadConnections()
  }

  const handleRemove = async (id: string) => {
    await window.electronAPI.invoke(IPC_CHANNELS.CONNECTION_REMOVE, { id })
    loadConnections()
  }

  const handleToggle = async (conn: ConnectionState) => {
    await window.electronAPI.invoke(IPC_CHANNELS.CONNECTION_UPDATE, {
      ...conn.config, enabled: !conn.config.enabled,
    })
    loadConnections()
  }

  const handleCheckUpdate = async () => {
    setUpdateStatus({ status: 'checking' })
    await window.electronAPI.invoke(IPC_CHANNELS.APP_CHECK_UPDATE)
  }

  const handleInstallUpdate = async () => {
    await window.electronAPI.invoke(IPC_CHANNELS.APP_INSTALL_UPDATE)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-osrs-text-dim font-body">Loading...</span></div>
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      {/* ================================================================
          Connections
          ================================================================ */}
      <h2 className="font-display text-lg font-bold text-osrs-text tracking-wide">Connections</h2>

      {connections.length > 0 && (
        <div className="space-y-2">
          {connections.map((conn) => (
            <div key={conn.config.id} className="bg-osrs-panel-light border border-osrs-border rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${conn.status === 'connected' ? 'bg-osrs-green' : conn.status === 'error' || conn.status === 'reconnecting' ? 'bg-osrs-orange' : 'bg-red-500'}`} />
                <div>
                  <div className="text-sm font-display text-osrs-text font-medium">{conn.config.label}</div>
                  <div className="text-xs font-mono text-osrs-text-dim">
                    {conn.config.host}:{conn.config.port}{conn.config.endpoint}
                    {conn.lastPlayer && <span className="ml-2 text-osrs-gold">• {conn.lastPlayer}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(conn)} className={`px-3 py-1 rounded text-xs font-display transition-colors ${conn.config.enabled ? 'bg-osrs-green/20 text-osrs-green hover:bg-osrs-green/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>
                  {conn.config.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button onClick={() => handleRemove(conn.config.id)} className="px-3 py-1 rounded text-xs font-display text-red-400 hover:bg-red-500/20 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-osrs-panel-light border border-osrs-border rounded-lg p-5">
        <h3 className="text-sm font-display font-bold text-osrs-text mb-4">Add Connection</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim mb-1 block">Label</label>
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Main Account"
              className="w-full bg-osrs-dark border border-osrs-border rounded px-3 py-2 text-sm text-osrs-text font-body focus:outline-none focus:border-osrs-gold/50 placeholder:text-osrs-text-dim/40" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim mb-1 block">Host</label>
            <input type="text" value={newHost} onChange={(e) => setNewHost(e.target.value)}
              className="w-full bg-osrs-dark border border-osrs-border rounded px-3 py-2 text-sm text-osrs-text font-mono focus:outline-none focus:border-osrs-gold/50" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim mb-1 block">Port</label>
            <input type="number" value={newPort} onChange={(e) => setNewPort(e.target.value)}
              className="w-full bg-osrs-dark border border-osrs-border rounded px-3 py-2 text-sm text-osrs-text font-mono focus:outline-none focus:border-osrs-gold/50" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim mb-1 block">Endpoint</label>
            <input type="text" value={newEndpoint} onChange={(e) => setNewEndpoint(e.target.value)}
              className="w-full bg-osrs-dark border border-osrs-border rounded px-3 py-2 text-sm text-osrs-text font-mono focus:outline-none focus:border-osrs-gold/50" />
          </div>
        </div>

        {testResult && (
          <div className={`mt-3 px-3 py-2 rounded text-xs font-mono ${testResult.startsWith('Connected') ? 'bg-osrs-green/10 text-osrs-green' : 'bg-red-500/10 text-red-400'}`}>
            {testResult}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={handleTest} disabled={testing}
            className="px-4 py-2 rounded text-xs font-display bg-osrs-panel-hover border border-osrs-border text-osrs-text hover:border-osrs-gold/30 transition-colors disabled:opacity-50">
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button onClick={handleAdd} disabled={!newLabel.trim()}
            className="px-4 py-2 rounded text-xs font-display bg-osrs-gold/20 text-osrs-gold hover:bg-osrs-gold/30 transition-colors disabled:opacity-50">
            Add Connection
          </button>
        </div>
      </div>

      {/* ================================================================
          Updates
          ================================================================ */}
      <h2 className="font-display text-lg font-bold text-osrs-text tracking-wide pt-2">Updates</h2>

      <div className="bg-osrs-panel-light border border-osrs-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-display text-osrs-text font-medium">OSRS XP Tracker</div>
            <div className="text-xs font-mono text-osrs-text-dim mt-0.5">v{appVersion}</div>
          </div>
          <UpdateBadge status={updateStatus} />
        </div>

        {/* Download progress bar */}
        {updateStatus.status === 'downloading' && (
          <div className="mb-4">
            <div className="w-full h-2 bg-osrs-dark rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-osrs-gold transition-[width] duration-300"
                style={{ width: `${updateStatus.percent ?? 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] font-mono text-osrs-text-dim/60">
                {formatBytes(updateStatus.transferred ?? 0)} / {formatBytes(updateStatus.total ?? 0)}
              </span>
              <span className="text-[10px] font-mono text-osrs-text-dim/60">
                {formatBytes(updateStatus.bytesPerSecond ?? 0)}/s
              </span>
            </div>
          </div>
        )}

        {/* Status message */}
        {updateStatus.status === 'available' && (
          <div className="mb-4 px-3 py-2 rounded bg-osrs-gold/10 text-xs font-body text-osrs-gold">
            Version {updateStatus.version} is available.
          </div>
        )}
        {updateStatus.status === 'up-to-date' && (
          <div className="mb-4 px-3 py-2 rounded bg-osrs-green/10 text-xs font-body text-osrs-green">
            You're running the latest version.
          </div>
        )}
        {updateStatus.status === 'downloaded' && (
          <div className="mb-4 px-3 py-2 rounded bg-osrs-green/10 text-xs font-body text-osrs-green">
            Version {updateStatus.version} is ready to install. The app will restart.
          </div>
        )}
        {updateStatus.status === 'error' && (
          <div className="mb-4 px-3 py-2 rounded bg-red-500/10 text-xs font-mono text-red-400">
            {updateStatus.message || 'Update check failed'}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {(updateStatus.status === 'idle' || updateStatus.status === 'up-to-date' || updateStatus.status === 'error') && (
            <button
              onClick={handleCheckUpdate}
              className="px-4 py-2 rounded text-xs font-display bg-osrs-panel-hover border border-osrs-border text-osrs-text hover:border-osrs-gold/30 transition-colors"
            >
              Check for Updates
            </button>
          )}
          {updateStatus.status === 'checking' && (
            <button disabled className="px-4 py-2 rounded text-xs font-display bg-osrs-panel-hover border border-osrs-border text-osrs-text-dim opacity-60">
              Checking...
            </button>
          )}
          {updateStatus.status === 'available' && (
            <button
              onClick={handleInstallUpdate}
              className="px-4 py-2 rounded text-xs font-display bg-osrs-gold/20 text-osrs-gold hover:bg-osrs-gold/30 transition-colors"
            >
              Download & Install
            </button>
          )}
          {updateStatus.status === 'downloading' && (
            <button disabled className="px-4 py-2 rounded text-xs font-display bg-osrs-gold/20 text-osrs-gold/50 opacity-60">
              Downloading...
            </button>
          )}
          {updateStatus.status === 'downloaded' && (
            <button
              onClick={handleInstallUpdate}
              className="px-4 py-2 rounded text-xs font-display bg-osrs-green/20 text-osrs-green hover:bg-osrs-green/30 transition-colors"
            >
              Restart & Update
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

const UpdateBadge: React.FC<{ status: UpdateStatus }> = ({ status }) => {
  switch (status.status) {
    case 'checking':
      return <span className="text-[10px] font-mono px-2 py-1 rounded bg-osrs-gold/10 text-osrs-gold/70">Checking...</span>
    case 'available':
      return <span className="text-[10px] font-mono px-2 py-1 rounded bg-osrs-gold/15 text-osrs-gold">Update available</span>
    case 'downloading':
      return <span className="text-[10px] font-mono px-2 py-1 rounded bg-osrs-gold/10 text-osrs-gold/70">{status.percent ?? 0}%</span>
    case 'downloaded':
      return <span className="text-[10px] font-mono px-2 py-1 rounded bg-osrs-green/15 text-osrs-green">Ready to install</span>
    case 'up-to-date':
      return <span className="text-[10px] font-mono px-2 py-1 rounded bg-osrs-green/10 text-osrs-green/60">Up to date</span>
    case 'error':
      return <span className="text-[10px] font-mono px-2 py-1 rounded bg-red-500/10 text-red-400">Error</span>
    default:
      return null
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
