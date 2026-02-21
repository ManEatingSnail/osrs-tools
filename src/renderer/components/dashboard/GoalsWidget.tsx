import React, { memo, useEffect, useState, useCallback } from 'react'
import { useAppStore, selectSkill } from '../../stores/appStore'
import { GoalRecord, TaskRecord, SkillName } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { getXpForLevel } from '@shared/constants'
import { formatCompact, formatPercent } from '../../utils/format'
import { shallow } from 'zustand/shallow'

/**
 * Compact widget for the dashboard showing pinned goals + tasks.
 * Auto-checks XP goals against live data.
 */
export const GoalsWidget: React.FC = memo(() => {
  const activePlayer = useAppStore((s) => s.activePlayer)
  const [goals, setGoals] = useState<GoalRecord[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])

  const loadData = useCallback(async () => {
    if (!activePlayer) return
    const [goalResult, taskResult] = await Promise.all([
      window.electronAPI.invoke(IPC_CHANNELS.GOAL_LIST, { playerName: activePlayer }),
      window.electronAPI.invoke(IPC_CHANNELS.TASK_LIST, { playerName: activePlayer }),
    ])
    setGoals((goalResult as GoalRecord[]).filter(g => g.pinned))
    setTasks((taskResult as TaskRecord[]).filter(t => t.pinned))
  }, [activePlayer])

  useEffect(() => { loadData() }, [loadData])

  // Refresh every 30s for task resets
  useEffect(() => {
    const timer = setInterval(loadData, 30000)
    return () => clearInterval(timer)
  }, [loadData])

  const handleToggleTask = async (taskId: string) => {
    if (!activePlayer) return
    await window.electronAPI.invoke(IPC_CHANNELS.TASK_TOGGLE_COMPLETE, {
      playerName: activePlayer, taskId,
    })
    loadData()
  }

  const pinnedCount = goals.length + tasks.length

  return (
    <div className="bg-[#111827]/60 border border-[#1E293B]/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-widest font-display text-osrs-text-dim/60">
          Goals & Tasks
        </h3>
        <button
          onClick={() => {
            // Navigate to goals page — accessed via store
            const store = useAppStore.getState()
            store.setActivePage('goals')
          }}
          className="text-[10px] font-display text-osrs-text-dim/40 hover:text-osrs-gold transition-colors uppercase tracking-wider"
        >
          Manage →
        </button>
      </div>

      {pinnedCount === 0 ? (
        <div className="text-center py-6">
          <div className="text-osrs-text-dim/30 text-xs font-body">
            No pinned goals or tasks
          </div>
          <div className="text-osrs-text-dim/20 text-[10px] font-body mt-1">
            Pin goals and tasks to see them here
          </div>
        </div>
      ) : (
        <div className="space-y-2">
        {goals.filter(g => !g.completed).map((goal) => (
          <GoalWidgetItem key={goal.id} goal={goal} />
        ))}
        {tasks.map((task) => (
          <TaskWidgetItem key={task.id} task={task} onToggle={handleToggleTask} />
        ))}
      </div>
      )}
    </div>
  )
})

const GoalWidgetItem: React.FC<{ goal: GoalRecord }> = memo(({ goal }) => {
  // Subscribe to live skill data for auto-progress
  const skill = useAppStore(
    goal.skill ? selectSkill(goal.skill) : () => null,
    shallow
  )

  let progress = 0
  let progressLabel = ''

  if (goal.skill && skill) {
    if (goal.targetLevel && goal.targetLevel > skill.level) {
      const currentXp = skill.xp
      const startXp = getXpForLevel(skill.level)
      const targetXp = getXpForLevel(goal.targetLevel)
      const range = targetXp - startXp
      progress = range > 0 ? Math.min(((currentXp - startXp) / range) * 100, 100) : 100
      progressLabel = `${skill.level} → ${goal.targetLevel}`
    } else if (goal.targetXp && goal.targetXp > skill.xp) {
      progress = Math.min((skill.xp / goal.targetXp) * 100, 100)
      progressLabel = `${formatCompact(skill.xp)} / ${formatCompact(goal.targetXp)}`
    } else {
      progress = 100
      progressLabel = 'Complete!'
    }
  }

  const isComplete = progress >= 100

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${isComplete ? 'bg-osrs-green/5' : 'bg-[#0B1120]/40'}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isComplete ? 'bg-osrs-green' : 'bg-osrs-gold/60'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-body truncate ${isComplete ? 'text-osrs-green line-through' : 'text-osrs-text/80'}`}>
          {goal.description}
        </div>
        {!isComplete && goal.skill && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 bg-[#0B1120] rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-osrs-gold/60 transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[9px] font-mono text-osrs-text-dim/50 flex-shrink-0">{progressLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
})

const TaskWidgetItem: React.FC<{ task: TaskRecord; onToggle: (id: string) => void }> = memo(({ task, onToggle }) => {
  const freqLabel = task.frequency === 'daily' ? 'D' : task.frequency === 'weekly' ? 'W' : 'C'

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        task.completedThisPeriod ? 'bg-osrs-green/5' : 'bg-[#0B1120]/40 hover:bg-[#0B1120]/60'
      }`}
      onClick={() => onToggle(task.id)}
    >
      {/* Checkbox */}
      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
        task.completedThisPeriod
          ? 'bg-osrs-green/20 border-osrs-green/40'
          : 'border-[#1E293B] hover:border-osrs-text-dim/30'
      }`}>
        {task.completedThisPeriod && (
          <svg className="w-3 h-3 text-osrs-green" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <div className={`text-xs font-body flex-1 truncate ${task.completedThisPeriod ? 'text-osrs-green/70 line-through' : 'text-osrs-text/80'}`}>
        {task.description}
      </div>
      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
        task.completedThisPeriod ? 'bg-osrs-green/10 text-osrs-green/50' : 'bg-[#1E293B]/40 text-osrs-text-dim/40'
      }`}>
        {freqLabel}
      </span>
    </div>
  )
})

GoalsWidget.displayName = 'GoalsWidget'
GoalWidgetItem.displayName = 'GoalWidgetItem'
TaskWidgetItem.displayName = 'TaskWidgetItem'
