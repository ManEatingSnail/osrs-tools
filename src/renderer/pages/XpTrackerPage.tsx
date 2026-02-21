import React from 'react'
import { SessionSummary } from '../components/dashboard/SessionSummary'
import { ActiveSkillHero } from '../components/dashboard/ActiveSkillHero'
import { SkillGrid } from '../components/dashboard/SkillGrid'

export const XpTrackerPage: React.FC = () => {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Session bar */}
      <SessionSummary />

      {/* Active skill detail */}
      <ActiveSkillHero />

      {/* Full skill grid with sort toggle */}
      <SkillGrid />
    </div>
  )
}
