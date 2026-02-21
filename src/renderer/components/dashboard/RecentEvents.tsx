import React, { memo, useState, useEffect, useRef } from 'react'
import { useAppStore } from '../../stores/appStore'
import { SKILL_NAMES, SkillName, SkillState } from '@shared/types'
import { SKILL_COLORS } from '@shared/constants'
import { formatCompact } from '../../utils/format'
import { useShallow } from 'zustand/react/shallow'

interface EventItem {
  id: string
  type: 'xp_gain' | 'level_up'
  skill: SkillName
  value: number         // xp gained or new level
  timestamp: number
}

/**
 * Rolling feed of recent events: XP drops, level-ups.
 * Derived from comparing ticks — no DB dependency.
 */
export const RecentEvents: React.FC = memo(() => {
  const [events, setEvents] = useState<EventItem[]>([])
  const prevSkillsRef = useRef<Partial<Record<SkillName, SkillState>>>({})

  // Subscribe to full skills to detect changes
  const skills = useAppStore(useShallow((s) => {
    const player = s.activePlayer ? s.players[s.activePlayer] : null
    return player?.skills ?? {}
  }))

  useEffect(() => {
    const prev = prevSkillsRef.current
    const newEvents: EventItem[] = []
    const now = Date.now()

    for (const skillName of SKILL_NAMES) {
      const current = skills[skillName]
      const previous = prev[skillName]
      if (!current || !previous) continue

      // Detect level up
      if (current.level > previous.level) {
        newEvents.push({
          id: `lvl-${skillName}-${now}`,
          type: 'level_up',
          skill: skillName,
          value: current.level,
          timestamp: now,
        })
      }

      // Detect XP gain (batch per tick, not per drop)
      if (current.xpGained > previous.xpGained) {
        const gained = current.xpGained - previous.xpGained
        if (gained > 0) {
          newEvents.push({
            id: `xp-${skillName}-${now}`,
            type: 'xp_gain',
            skill: skillName,
            value: gained,
            timestamp: now,
          })
        }
      }
    }

    if (newEvents.length > 0) {
      setEvents((prev) => [...newEvents, ...prev].slice(0, 50))
    }

    prevSkillsRef.current = { ...skills }
  }, [skills])

  return (
    <div className="bg-[#111827]/60 border border-[#1E293B]/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest font-display text-osrs-text-dim/60">
          Recent Events
        </h3>
        {events.length > 0 && (
          <button
            onClick={() => setEvents([])}
            className="text-[10px] font-display text-osrs-text-dim/30 hover:text-osrs-text-dim/50 transition-colors uppercase tracking-wider"
          >
            Clear
          </button>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-osrs-text-dim/30 text-xs font-body">
            No events yet this session
          </div>
          <div className="text-osrs-text-dim/20 text-[10px] font-body mt-1">
            XP gains and level-ups will appear here
          </div>
        </div>
      ) : (
        <div className="space-y-1 max-h-[280px] overflow-y-auto">
          {events.map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
})

const EventRow: React.FC<{ event: EventItem }> = memo(({ event }) => {
  const color = SKILL_COLORS[event.skill]
  const isLevelUp = event.type === 'level_up'

  const timeAgo = getTimeAgo(event.timestamp)

  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors ${
      isLevelUp ? 'bg-osrs-gold/5' : 'bg-[#0B1120]/30'
    }`}>
      {/* Icon */}
      <div className="w-5 text-center flex-shrink-0">
        {isLevelUp ? (
          <span className="text-xs">🎉</span>
        ) : (
          <div className="w-1.5 h-1.5 rounded-full mx-auto" style={{ backgroundColor: color }} />
        )}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        {isLevelUp ? (
          <span className="text-xs font-body">
            <span className="text-osrs-gold font-semibold">{event.skill}</span>
            <span className="text-osrs-text/70"> reached level </span>
            <span className="text-osrs-gold font-bold">{event.value}</span>
          </span>
        ) : (
          <span className="text-xs font-body">
            <span className="text-osrs-text/70" style={{ color: `${color}CC` }}>{event.skill}</span>
            <span className="text-osrs-text-dim/50"> +</span>
            <span className="text-osrs-green font-mono text-[11px]">{formatCompact(event.value)}</span>
            <span className="text-osrs-text-dim/40"> xp</span>
          </span>
        )}
      </div>

      {/* Time */}
      <span className="text-[9px] font-mono text-osrs-text-dim/30 flex-shrink-0 w-10 text-right">
        {timeAgo}
      </span>
    </div>
  )
})

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return 'now'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

RecentEvents.displayName = 'RecentEvents'
EventRow.displayName = 'EventRow'
