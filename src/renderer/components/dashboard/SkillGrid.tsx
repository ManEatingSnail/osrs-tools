import React, { memo, useMemo } from 'react'
import { SKILL_NAMES, SkillName } from '@shared/types'
import { SKILL_CATEGORIES, SkillCategory } from '@shared/constants'
import { useAppStore } from '../../stores/appStore'
import { SkillCard } from './SkillCard'

type SortMode = 'category' | 'active' | 'level' | 'name'

const SORT_LABELS: Record<SortMode, string> = {
  category: 'Category',
  active: 'Activity',
  level: 'Level',
  name: 'A–Z',
}

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  combat: 'Combat',
  gathering: 'Gathering',
  artisan: 'Artisan',
  support: 'Support',
}

const CATEGORY_ORDER: SkillCategory[] = ['combat', 'gathering', 'artisan', 'support']

export const SkillGrid: React.FC = memo(() => {
  const sortMode = useAppStore((s) => s.settings.skillSortMode) as SortMode
  const updateSettings = useAppStore((s) => s.updateSettings)
  const activePlayer = useAppStore((s) => s.activePlayer)

  // 1. Grab the direct reference to the skills object. No new objects created!
  const playerSkills = useAppStore((s) => {
    const player = s.activePlayer ? s.players[s.activePlayer] : null
    return player ? player.skills : null
  })

  // 2. Sort using the direct reference
  const sortedSkills = useMemo(() => {
    const skills = [...SKILL_NAMES]

    if (sortMode === 'category') return null // handled differently with headers
    if (!playerSkills) return skills

    switch (sortMode) {
      case 'active':
        return skills.sort((a, b) => {
          const aActive = playerSkills[a]?.xpHr ?? 0
          const bActive = playerSkills[b]?.xpHr ?? 0
          if (bActive !== aActive) return bActive - aActive
          return (playerSkills[b]?.xpGained ?? 0) - (playerSkills[a]?.xpGained ?? 0)
        })
      case 'level':
        return skills.sort((a, b) => {
          const aLevel = playerSkills[a]?.level ?? 0
          const bLevel = playerSkills[b]?.level ?? 0
          return bLevel - aLevel
        })
      case 'name':
        return skills.sort((a, b) => a.localeCompare(b))
      default:
        return skills
    }
  }, [sortMode, playerSkills])

  const cycleSortMode = () => {
    const modes: SortMode[] = ['category', 'active', 'level', 'name']
    const currentIdx = modes.indexOf(sortMode)
    const nextIdx = (currentIdx + 1) % modes.length
    updateSettings({ skillSortMode: modes[nextIdx] })
  }

  return (
    <div>
      {/* Sort Mode Toggle */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs uppercase tracking-widest font-display text-osrs-text-dim/60">
          All Skills
        </h3>
        <button
          onClick={cycleSortMode}
          className="flex items-center gap-1.5 text-[10px] font-display text-osrs-text-dim/60 hover:text-osrs-text-dim transition-colors uppercase tracking-wider"
        >
          <svg className="w-3 h-3 opacity-50" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 2a1 1 0 011 1v8.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L2 11.586V3a1 1 0 011-1zm10.707.293a1 1 0 010 1.414L12.414 5H14a1 1 0 110 2H10a1 1 0 01-1-1V2a1 1 0 112 0v1.586l1.293-1.293a1 1 0 011.414 0z" />
          </svg>
          Sort: {SORT_LABELS[sortMode]}
        </button>
      </div>

      {/* Category Layout */}
      {sortMode === 'category' ? (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((category) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="text-[10px] uppercase tracking-[0.15em] font-display font-medium text-osrs-text-dim/40">
                  {CATEGORY_LABELS[category]}
                </div>
                <div className="flex-1 h-px bg-[#1E293B]/40" />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {SKILL_CATEGORIES[category].map((skillName) => (
                  <SkillCard key={skillName} skillName={skillName} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat sorted layout */
        <div className="grid grid-cols-3 gap-2.5">
          {(sortedSkills ?? SKILL_NAMES).map((skillName) => (
            <SkillCard key={skillName} skillName={skillName} />
          ))}
        </div>
      )}
    </div>
  )
})

SkillGrid.displayName = 'SkillGrid'