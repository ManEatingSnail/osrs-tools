import React, { memo, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { SKILL_NAMES, SkillName, SkillState } from '@shared/types'
import { SKILL_COLORS } from '@shared/constants'
import {
  formatCompact,
  formatXpRate,
  formatPercent,
  formatTimeToLevel,
} from '../../utils/format'
import { useShallow } from 'zustand/react/shallow'

/**
 * Compact summary of skills actively being trained (xpHr > 0).
 * Shows on the dashboard home page. Click-through to XP Tracker for full view.
 */
export const ActiveSkillsSummary: React.FC = memo(() => {
  const setActivePage = useAppStore((s) => s.setActivePage)

  // Select the raw skills object — stable reference when data hasn't changed
  const skills = useAppStore(useShallow((s) => {
    const player = s.activePlayer ? s.players[s.activePlayer] : null
    return player?.skills ?? {}
  }))

  // Derive active skills list in useMemo (not inside the selector)
  const activeSkills = useMemo(() => {
    const result: Array<{ name: SkillName; data: SkillState }> = []
    for (const skillName of SKILL_NAMES) {
      const skill = skills[skillName]
      if (skill && (skill.xpHr > 0 || skill.xpGained > 0)) {
        result.push({ name: skillName, data: skill })
      }
    }
    result.sort((a, b) => b.data.xpHr - a.data.xpHr)
    return result
  }, [skills])

  return (
    <div className="bg-[#111827]/60 border border-[#1E293B]/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest font-display text-osrs-text-dim/60">
          Active Skills
        </h3>
        <button
          onClick={() => setActivePage('xptracker')}
          className="text-[10px] font-display text-osrs-text-dim/40 hover:text-osrs-gold transition-colors uppercase tracking-wider"
        >
          View All →
        </button>
      </div>

      {activeSkills.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-osrs-text-dim/30 text-xs font-body">
            No skills being trained right now
          </div>
          <div className="text-osrs-text-dim/20 text-[10px] font-body mt-1">
            Start training in-game to see live stats
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeSkills.map(({ name, data }) => (
            <ActiveSkillRow key={name} skillName={name} skill={data} />
          ))}
        </div>
      )}
    </div>
  )
})

const ActiveSkillRow: React.FC<{ skillName: SkillName; skill: SkillState }> = memo(({ skillName, skill }) => {
  const color = SKILL_COLORS[skillName]
  const isMaxed = skill.level >= 99

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#0B1120]/40 group hover:bg-[#0B1120]/60 transition-colors">
      {/* Color dot */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Skill name + level */}
      <div className="w-24 flex-shrink-0">
        <div className="text-xs font-display font-medium text-osrs-text/90">{skillName}</div>
      </div>

      {/* Progress bar (compact) */}
      {!isMaxed && (
        <div className="flex-1 min-w-0">
          <div className="w-full h-1.5 bg-[#0B1120] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.min(skill.progressPercent, 100)}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }}
            />
          </div>
        </div>
      )}
      {isMaxed && (
        <div className="flex-1 text-[9px] font-mono text-osrs-gold/60">MAX</div>
      )}

      {/* Level */}
      <span className={`text-sm font-display font-bold tabular-nums w-8 text-right ${isMaxed ? 'text-osrs-gold' : 'text-osrs-text/80'}`}>
        {skill.level}
      </span>

      {/* XP/hr */}
      <span className="text-[10px] font-mono text-osrs-green w-16 text-right">
        {skill.xpHr > 0 ? formatXpRate(skill.xpHr) : '—'}
      </span>

      {/* Gained */}
      <span className="text-[10px] font-mono text-osrs-cyan w-14 text-right">
        {skill.xpGained > 0 ? `+${formatCompact(skill.xpGained)}` : '—'}
      </span>
    </div>
  )
})

ActiveSkillsSummary.displayName = 'ActiveSkillsSummary'
ActiveSkillRow.displayName = 'ActiveSkillRow'
