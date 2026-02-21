import React, { memo } from 'react'
import { useAppStore, selectActiveSkill, selectSkill } from '../../stores/appStore'
import { SKILL_COLORS } from '@shared/constants'
import {
  formatCompact,
  formatFull,
  formatXpRate,
  formatPercent,
  formatTimeToLevel,
} from '../../utils/format'
import { shallow } from 'zustand/shallow'

export const ActiveSkillHero: React.FC = memo(() => {
  const activeSkillName = useAppStore(selectActiveSkill)

  if (!activeSkillName) {
    return (
      <div className="bg-[#111827]/40 border border-[#1E293B]/40 rounded-xl p-8 flex items-center justify-center h-full min-h-[180px]">
        <div className="text-center">
          <div className="text-osrs-text-dim/30 font-body text-sm">No active skill</div>
          <div className="text-osrs-text-dim/20 font-body text-xs mt-1">
            Start training in-game to see live stats
          </div>
        </div>
      </div>
    )
  }

  return <ActiveSkillContent skillName={activeSkillName} />
})

const ActiveSkillContent: React.FC<{ skillName: string }> = memo(({ skillName }) => {
  const skill = useAppStore(selectSkill(skillName as any), shallow)
  if (!skill) return null

  const color = SKILL_COLORS[skillName as keyof typeof SKILL_COLORS] ?? '#FFD700'
  const isMaxed = skill.level >= 99

  return (
    <div className="relative bg-[#111827] border border-[#1E293B] rounded-xl p-5 overflow-hidden h-full">
      {/* Atmospheric glow */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ backgroundColor: color }} />
      <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-[100px] opacity-[0.06] pointer-events-none" style={{ backgroundColor: color }} />
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-[80px] opacity-[0.03] pointer-events-none" style={{ backgroundColor: color }} />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-5">
        <div>
          <div className="text-[9px] uppercase tracking-[0.2em] font-display text-osrs-text-dim/40 mb-1">
            Currently Training
          </div>
          <h2 className="font-display text-xl font-black text-osrs-text tracking-wide">
            {skillName}
          </h2>
        </div>
        <div className="text-right">
          <div className={`font-display text-4xl font-black tabular-nums leading-none ${isMaxed ? 'text-osrs-gold' : 'text-osrs-text'}`}>
            {skill.level}
          </div>
          {skill.boostedLevel !== skill.level && (
            <div className={`text-xs font-mono mt-0.5 ${skill.boostedLevel > skill.level ? 'text-osrs-green/70' : 'text-osrs-red/70'}`}>
              ({skill.boostedLevel})
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar (large) */}
      {!isMaxed && (
        <div className="mb-5">
          <div className="w-full h-3 bg-[#0B1120] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{
                width: `${Math.min(skill.progressPercent, 100)}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] font-mono text-osrs-text-dim/50">
              {formatPercent(skill.progressPercent)} to {skill.level + 1}
            </span>
            <span className="text-[10px] font-mono text-osrs-text-dim/50">
              TTL: {formatTimeToLevel(skill.timeToLevel)}
            </span>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <HeroStat label="XP / Hour" value={formatXpRate(skill.xpHr)} color="text-osrs-green" />
        <HeroStat label="XP Gained" value={skill.xpGained > 0 ? `+${formatCompact(skill.xpGained)}` : '—'} color="text-osrs-cyan" />
        <HeroStat label="Total XP" value={formatFull(skill.xp)} color="text-osrs-text/70" />
      </div>

      {skill.actionsHr > 0 && (
        <div className="mt-3 pt-3 border-t border-[#1E293B]/40 flex justify-between text-[10px]">
          <span className="font-mono text-osrs-text-dim/40">Actions/hr</span>
          <span className="font-mono text-osrs-text/60">{formatCompact(skill.actionsHr)}</span>
        </div>
      )}
    </div>
  )
})

const HeroStat: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div className="bg-[#0B1120]/60 rounded-lg px-3 py-2.5">
    <div className="text-[8px] uppercase tracking-[0.15em] font-display text-osrs-text-dim/40 mb-1">{label}</div>
    <div className={`text-sm font-mono font-semibold ${color}`}>{value}</div>
  </div>
)

ActiveSkillHero.displayName = 'ActiveSkillHero'
ActiveSkillContent.displayName = 'ActiveSkillContent'
