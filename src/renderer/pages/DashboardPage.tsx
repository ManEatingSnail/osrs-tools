import React from 'react'
import { SessionSummary } from '../components/dashboard/SessionSummary'
import { ActiveSkillsSummary } from '../components/dashboard/ActiveSkillsSummary'
import { GoalsWidget } from '../components/dashboard/GoalsWidget'
import { RecentEvents } from '../components/dashboard/RecentEvents'

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Session bar */}
      <SessionSummary />

      {/* Two-column layout: Active skills + Goals/Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActiveSkillsSummary />
        <GoalsWidget />
      </div>

      {/* Recent events feed */}
      <RecentEvents />
    </div>
  )
}
