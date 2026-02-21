import React, { memo, useEffect, useState } from 'react'
import { useAppStore, selectSession, selectLoggedIn } from '../../stores/appStore'
import { formatDuration, formatCompact } from '../../utils/format'

export const SessionSummary: React.FC = memo(() => {
  const session = useAppStore(selectSession)
  const loggedIn = useAppStore(selectLoggedIn)
  const activePlayer = useAppStore((s) => s.activePlayer)
  const [displayDuration, setDisplayDuration] = useState('0s')

  useEffect(() => {
    if (!session) return
    const update = () => setDisplayDuration(formatDuration(Date.now() - session.startTime))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [session?.startTime])

  if (!activePlayer) {
    return (
      <div className="bg-[#111827]/40 border border-[#1E293B]/40 rounded-xl p-5 flex items-center justify-center">
        <span className="text-sm text-osrs-text-dim/40 font-body">
          Connect to a RuneLite plugin to start tracking
        </span>
      </div>
    )
  }

  return (
    <div className="bg-[#111827]/60 border border-[#1E293B]/60 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        {/* Player + Status */}
        <div className="flex items-center gap-3">
          {/* Avatar circle */}
          <div className="w-9 h-9 rounded-full bg-[#1E293B] flex items-center justify-center">
            <span className="text-sm font-display font-bold text-osrs-gold/80">
              {activePlayer.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-osrs-text tracking-wide">
              {activePlayer}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${loggedIn ? 'bg-osrs-green animate-pulse-slow' : 'bg-red-500/60'}`} />
              <span className="text-[10px] font-mono text-osrs-text-dim/50 uppercase">
                {loggedIn ? 'In-Game' : 'Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Session Stats */}
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-[0.15em] font-display text-osrs-text-dim/40">Session</div>
            <div className="text-sm font-mono text-osrs-text/80 font-semibold tabular-nums">{displayDuration}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-[0.15em] font-display text-osrs-text-dim/40">Total XP</div>
            <div className="text-sm font-mono text-osrs-cyan/80 font-semibold">
              {session && session.totalXpGained > 0 ? `+${formatCompact(session.totalXpGained)}` : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

SessionSummary.displayName = 'SessionSummary'
