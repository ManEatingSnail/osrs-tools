import React, { memo, useState, useRef, useEffect } from 'react'
import { useAppStore, selectSkill } from '../../stores/appStore'
import { SkillName } from '@shared/types'
import { SKILL_COLORS } from '@shared/constants'
import {
  formatCompact,
  formatFull,
  formatXpRate,
  formatPercent,
  formatTimeToLevel,
  formatRelativeTime,
} from '../../utils/format'
import { shallow } from 'zustand/shallow'

interface SkillCardProps {
  skillName: SkillName
}

export const SkillCard: React.FC<SkillCardProps> = memo(({ skillName }) => {
  const skill = useAppStore(selectSkill(skillName), shallow)
  const [showFull, setShowFull] = useState(false)
  const [flashing, setFlashing] = useState(false)
  const prevXpRef = useRef(skill?.xp ?? 0)

  useEffect(() => {
    if (skill && skill.xp > prevXpRef.current) {
      setFlashing(true)
      const timer = setTimeout(() => setFlashing(false), 600)
      prevXpRef.current = skill.xp
      return () => clearTimeout(timer)
    }
    if (skill) prevXpRef.current = skill.xp
  }, [skill?.xp])

  if (!skill) {
    return (
      <div className="bg-[#111827]/60 border border-[#1E293B] rounded-xl p-4 opacity-30">
        <div className="text-xs font-display text-osrs-text-dim">{skillName}</div>
        <div className="text-sm text-osrs-text-dim/40 mt-1">Waiting for data...</div>
      </div>
    )
  }

  const color = SKILL_COLORS[skillName]
  const isActive = skill.xpHr > 0
  const isBoosted = skill.boostedLevel !== skill.level
  const isMaxed = skill.level >= 99

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl p-4 cursor-default group
        transition-all duration-300 ease-out
        ${isActive
          ? 'bg-[#111827] border border-[#1E293B] shadow-[0_0_24px_rgba(255,215,0,0.04)]'
          : 'bg-[#111827]/60 border border-[#1E293B]/60 hover:border-[#1E293B]'
        }
        ${flashing ? 'animate-xp-flash' : ''}
      `}
      onMouseEnter={() => setShowFull(true)}
      onMouseLeave={() => setShowFull(false)}
    >
      {/* Subtle gradient glow for active skills */}
      {isActive && (
        <div
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-[0.07] pointer-events-none"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Top accent line */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-30'
        }`}
        style={{ backgroundColor: color }}
      />

      {/* Header Row */}
      <div className="flex items-start justify-between mb-3 relative">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${isActive ? 'animate-pulse-slow' : ''}`}
            style={{ backgroundColor: color }}
          />
          <div>
            <div className="text-sm font-display font-semibold text-osrs-text tracking-wide">
              {skillName}
            </div>
            {isActive && (
              <div className="text-[10px] font-mono text-osrs-text-dim/60 mt-0.5">
                {formatRelativeTime(skill.lastGain)}
              </div>
            )}
          </div>
        </div>

        <div className="text-right">
          <span
            className={`text-xl font-display font-black tabular-nums ${
              isMaxed ? 'text-osrs-gold' : 'text-osrs-text'
            }`}
          >
            {skill.level}
          </span>
          {isBoosted && (
            <div
              className={`text-[10px] font-mono mt-[-2px] ${
                skill.boostedLevel > skill.level ? 'text-osrs-green' : 'text-osrs-red'
              }`}
            >
              {skill.boostedLevel > skill.level ? '+' : ''}{skill.boostedLevel - skill.level}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {!isMaxed ? (
        <div className="mb-3">
          <div className="w-full h-2 bg-[#0B1120] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.min(skill.progressPercent, 100)}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-osrs-text-dim/70">
              {formatPercent(skill.progressPercent)}
            </span>
            <span className="text-[10px] font-mono text-osrs-text-dim/70">
              {formatTimeToLevel(skill.timeToLevel) !== '∞'
                ? `TTL ${formatTimeToLevel(skill.timeToLevel)}`
                : ''
              }
            </span>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="w-full h-2 bg-[#0B1120] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '100%', background: `linear-gradient(90deg, ${color}66, ${color}33)` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-osrs-gold/60">MAX</span>
            <span className="text-[10px] font-mono text-osrs-text-dim/50">
              {showFull ? formatFull(skill.xp) : formatCompact(skill.xp)} XP
            </span>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <StatCell label="XP" value={showFull ? formatFull(skill.xp) : formatCompact(skill.xp)} color="text-osrs-text/80" />
        <StatCell label="Rate" value={skill.xpHr > 0 ? formatXpRate(skill.xpHr) : '—'} color={skill.xpHr > 0 ? 'text-osrs-green' : 'text-osrs-text-dim/40'} />
        <StatCell label="Gained" value={skill.xpGained > 0 ? `+${formatCompact(skill.xpGained)}` : '—'} color={skill.xpGained > 0 ? 'text-osrs-cyan' : 'text-osrs-text-dim/40'} />
      </div>

      {isActive && skill.actionsHr > 0 && (
        <div className="mt-2 pt-2 border-t border-[#1E293B]/50">
          <div className="flex justify-between text-[10px]">
            <span className="font-mono text-osrs-text-dim/60">Actions/hr</span>
            <span className="font-mono text-osrs-text/70">{formatCompact(skill.actionsHr)}</span>
          </div>
        </div>
      )}
    </div>
  )
})

const StatCell: React.FC<{ label: string; value: string; color: string }> = memo(({ label, value, color }) => (
  <div className="min-w-0">
    <div className="text-[8px] uppercase tracking-[0.1em] font-display text-osrs-text-dim/50 mb-0.5 truncate">{label}</div>
    <div className={`text-xs font-mono font-medium truncate ${color}`}>{value}</div>
  </div>
))

SkillCard.displayName = 'SkillCard'
StatCell.displayName = 'StatCell'
