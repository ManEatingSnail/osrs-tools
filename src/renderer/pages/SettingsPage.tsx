import React, { useEffect, useState, useCallback } from 'react'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { ConnectionConfig, ConnectionState } from '@shared/types'
import { DEFAULT_CONNECTION } from '@shared/constants'

export const SettingsPage: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionState[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [newHost, setNewHost] = useState(DEFAULT_CONNECTION.host)
  const [newPort, setNewPort] = useState(DEFAULT_CONNECTION.port.toString())
  const [newEndpoint, setNewEndpoint] = useState(DEFAULT_CONNECTION.endpoint)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const loadConnections = useCallback(async () => {
    const result = await window.electronAPI.invoke(IPC_CHANNELS.CONNECTION_LIST)
    setConnections(result as ConnectionState[])
    setLoading(false)
  }, [])

  useEffect(() => { loadConnections() }, [loadConnections])

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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="text-osrs-text-dim font-body">Loading...</span></div>
  }

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
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
    </div>
  )
}
