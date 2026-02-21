import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore, selectSkill } from '../stores/appStore'
import { GoalRecord, TaskRecord, TaskFrequency, SkillName, SKILL_NAMES } from '@shared/types'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { getXpForLevel } from '@shared/constants'
import { formatCompact } from '../utils/format'
import { shallow } from 'zustand/shallow'

type Tab = 'goals' | 'tasks'

export const GoalsPage: React.FC = () => {
  const activePlayer = useAppStore((s) => s.activePlayer)
  const [tab, setTab] = useState<Tab>('goals')
  const [goals, setGoals] = useState<GoalRecord[]>([])
  const [tasks, setTasks] = useState<TaskRecord[]>([])

  const loadGoals = useCallback(async () => {
    if (!activePlayer) return
    const result = await window.electronAPI.invoke(IPC_CHANNELS.GOAL_LIST, { playerName: activePlayer })
    setGoals(result as GoalRecord[])
  }, [activePlayer])

  const loadTasks = useCallback(async () => {
    if (!activePlayer) return
    const result = await window.electronAPI.invoke(IPC_CHANNELS.TASK_LIST, { playerName: activePlayer })
    setTasks(result as TaskRecord[])
  }, [activePlayer])

  useEffect(() => { loadGoals(); loadTasks() }, [loadGoals, loadTasks])

  // Refresh tasks periodically for resets
  useEffect(() => {
    const timer = setInterval(loadTasks, 30000)
    return () => clearInterval(timer)
  }, [loadTasks])

  if (!activePlayer) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-osrs-text-dim font-body">Connect to a plugin to manage goals</span>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-5 animate-fade-in">
      {/* Tab Header */}
      <div className="flex items-center gap-1 bg-[#111827]/60 rounded-xl p-1 w-fit">
        {(['goals', 'tasks'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-display uppercase tracking-wider transition-all ${
              tab === t
                ? 'bg-[#1E293B] text-osrs-text shadow-sm'
                : 'text-osrs-text-dim/50 hover:text-osrs-text-dim'
            }`}
          >
            {t === 'goals' ? `Goals (${goals.length})` : `Tasks (${tasks.length})`}
          </button>
        ))}
      </div>

      {tab === 'goals' ? (
        <GoalsTab goals={goals} playerName={activePlayer} onRefresh={loadGoals} />
      ) : (
        <TasksTab tasks={tasks} playerName={activePlayer} onRefresh={loadTasks} />
      )}
    </div>
  )
}

// ============================================================================
// Goals Tab
// ============================================================================

const GoalsTab: React.FC<{ goals: GoalRecord[]; playerName: string; onRefresh: () => void }> = ({
  goals, playerName, onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-osrs-text tracking-wide">XP Goals</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg text-xs font-display bg-osrs-gold/15 text-osrs-gold hover:bg-osrs-gold/25 transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Goal'}
        </button>
      </div>

      {showForm && (
        <GoalForm playerName={playerName} onCreated={() => { setShowForm(false); onRefresh() }} />
      )}

      {goals.length === 0 ? (
        <div className="bg-[#111827]/40 border border-[#1E293B]/40 rounded-xl p-8 text-center">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-sm text-osrs-text-dim/60 font-body">
            No goals yet. Create one to track your progress.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.filter(g => !g.completed).map((goal) => (
            <GoalItem key={goal.id} goal={goal} playerName={playerName} onRefresh={onRefresh} />
          ))}
          {goals.some(g => g.completed) && (
            <>
              <div className="flex items-center gap-2 pt-2">
                <div className="text-[10px] uppercase tracking-[0.15em] font-display text-osrs-text-dim/30">Completed</div>
                <div className="flex-1 h-px bg-[#1E293B]/30" />
              </div>
              {goals.filter(g => g.completed).map((goal) => (
                <GoalItem key={goal.id} goal={goal} playerName={playerName} onRefresh={onRefresh} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Goal Form
// ============================================================================

const GoalForm: React.FC<{ playerName: string; onCreated: () => void }> = ({ playerName, onCreated }) => {
  const [skill, setSkill] = useState<SkillName>('Mining')
  const [targetType, setTargetType] = useState<'level' | 'xp'>('level')
  const [targetValue, setTargetValue] = useState('')
  const [description, setDescription] = useState('')
  const [pinned, setPinned] = useState(true)

  const handleSubmit = async () => {
    const numVal = parseInt(targetValue, 10)
    if (!numVal || !description.trim()) return

    await window.electronAPI.invoke(IPC_CHANNELS.GOAL_CREATE, {
      playerName,
      goal: {
        type: 'custom' as const,
        skill,
        targetLevel: targetType === 'level' ? numVal : null,
        targetXp: targetType === 'xp' ? numVal : null,
        description: description.trim(),
        pinned,
      },
    })
    onCreated()
  }

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">Skill</label>
          <select value={skill} onChange={(e) => setSkill(e.target.value as SkillName)}
            className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-osrs-text font-body focus:outline-none focus:border-osrs-gold/30">
            {SKILL_NAMES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">Target Type</label>
          <div className="flex gap-1">
            {(['level', 'xp'] as const).map((t) => (
              <button key={t} onClick={() => setTargetType(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-display uppercase transition-colors ${
                  targetType === t ? 'bg-[#1E293B] text-osrs-text' : 'bg-[#0B1120] text-osrs-text-dim/40 hover:text-osrs-text-dim'
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">
          Target {targetType === 'level' ? 'Level' : 'XP'}
        </label>
        <input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
          placeholder={targetType === 'level' ? '80' : '2000000'}
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-osrs-text font-mono focus:outline-none focus:border-osrs-gold/30 placeholder:text-osrs-text-dim/20" />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Get 80 Mining for Varrock Elite"
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-osrs-text font-body focus:outline-none focus:border-osrs-gold/30 placeholder:text-osrs-text-dim/20" />
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)}
            className="rounded border-[#1E293B] bg-[#0B1120] text-osrs-gold focus:ring-osrs-gold/30" />
          <span className="text-xs text-osrs-text-dim/60 font-body">Pin to dashboard</span>
        </label>
        <button onClick={handleSubmit} disabled={!targetValue || !description.trim()}
          className="px-4 py-2 rounded-lg text-xs font-display bg-osrs-gold/20 text-osrs-gold hover:bg-osrs-gold/30 transition-colors disabled:opacity-30">
          Create Goal
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Goal Item (with live progress)
// ============================================================================

const GoalItem: React.FC<{ goal: GoalRecord; playerName: string; onRefresh: () => void }> = ({
  goal, playerName, onRefresh,
}) => {
  const skill = useAppStore(
    goal.skill ? selectSkill(goal.skill) : () => null,
    shallow
  )

  // Auto-complete check
  useEffect(() => {
    if (goal.completed || !skill || !goal.skill) return

    let shouldComplete = false
    if (goal.targetLevel && skill.level >= goal.targetLevel) shouldComplete = true
    if (goal.targetXp && skill.xp >= goal.targetXp) shouldComplete = true

    if (shouldComplete) {
      window.electronAPI.invoke(IPC_CHANNELS.GOAL_UPDATE, {
        playerName,
        goal: { ...goal, completed: true, completedAt: Date.now() },
      }).then(onRefresh)
    }
  }, [skill?.level, skill?.xp])

  let progress = 0
  if (goal.skill && skill && !goal.completed) {
    if (goal.targetLevel) {
      const currentXp = skill.xp
      const startXp = getXpForLevel(skill.level)
      const targetXp = getXpForLevel(goal.targetLevel)
      progress = targetXp > startXp ? Math.min(((currentXp - startXp) / (targetXp - startXp)) * 100, 100) : 100
    } else if (goal.targetXp) {
      progress = Math.min((skill.xp / goal.targetXp) * 100, 100)
    }
  }
  if (goal.completed) progress = 100

  const handleDelete = async () => {
    await window.electronAPI.invoke(IPC_CHANNELS.GOAL_DELETE, { playerName, goalId: goal.id })
    onRefresh()
  }

  const handleTogglePin = async () => {
    await window.electronAPI.invoke(IPC_CHANNELS.GOAL_UPDATE, {
      playerName,
      goal: { ...goal, pinned: !goal.pinned },
    })
    onRefresh()
  }

  return (
    <div className={`bg-[#111827]/60 border rounded-xl p-4 transition-all ${
      goal.completed ? 'border-osrs-green/20 opacity-60' : 'border-[#1E293B]/60'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className={`text-sm font-body ${goal.completed ? 'text-osrs-green line-through' : 'text-osrs-text'}`}>
            {goal.description}
          </div>
          <div className="text-[10px] font-mono text-osrs-text-dim/40 mt-0.5">
            {goal.skill}{goal.targetLevel ? ` → Lvl ${goal.targetLevel}` : ''}{goal.targetXp ? ` → ${formatCompact(goal.targetXp)} XP` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button onClick={handleTogglePin}
            className={`p-1.5 rounded-lg text-xs transition-colors ${goal.pinned ? 'text-osrs-gold' : 'text-osrs-text-dim/30 hover:text-osrs-text-dim/50'}`}
            title={goal.pinned ? 'Unpin from dashboard' : 'Pin to dashboard'}>
            📌
          </button>
          <button onClick={handleDelete}
            className="p-1.5 rounded-lg text-xs text-osrs-text-dim/30 hover:text-red-400 transition-colors"
            title="Delete goal">
            ✕
          </button>
        </div>
      </div>

      {!goal.completed && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#0B1120] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-osrs-gold/60 transition-[width] duration-700" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] font-mono text-osrs-text-dim/50 w-10 text-right">{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Tasks Tab
// ============================================================================

const TasksTab: React.FC<{ tasks: TaskRecord[]; playerName: string; onRefresh: () => void }> = ({
  tasks, playerName, onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false)

  const handleToggle = async (taskId: string) => {
    await window.electronAPI.invoke(IPC_CHANNELS.TASK_TOGGLE_COMPLETE, { playerName, taskId })
    onRefresh()
  }

  const handleDelete = async (taskId: string) => {
    await window.electronAPI.invoke(IPC_CHANNELS.TASK_DELETE, { playerName, taskId })
    onRefresh()
  }

  const handleTogglePin = async (task: TaskRecord) => {
    await window.electronAPI.invoke(IPC_CHANNELS.TASK_UPDATE, {
      playerName,
      task: { ...task, pinned: !task.pinned },
    })
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-osrs-text tracking-wide">Recurring Tasks</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg text-xs font-display bg-osrs-gold/15 text-osrs-gold hover:bg-osrs-gold/25 transition-colors">
          {showForm ? 'Cancel' : '+ New Task'}
        </button>
      </div>

      {showForm && (
        <TaskForm playerName={playerName} onCreated={() => { setShowForm(false); onRefresh() }} />
      )}

      {tasks.length === 0 ? (
        <div className="bg-[#111827]/40 border border-[#1E293B]/40 rounded-xl p-8 text-center">
          <div className="text-2xl mb-2">📋</div>
          <div className="text-sm text-osrs-text-dim/60 font-body">
            No tasks yet. Add daily or weekly tasks like birdhouse runs, farm runs, or battlestaves.
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task.id} className={`flex items-center gap-3 bg-[#111827]/60 border rounded-xl px-4 py-3 transition-all ${
              task.completedThisPeriod ? 'border-osrs-green/20' : 'border-[#1E293B]/60'
            }`}>
              {/* Checkbox */}
              <button onClick={() => handleToggle(task.id)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                  task.completedThisPeriod
                    ? 'bg-osrs-green/20 border-osrs-green/40'
                    : 'border-[#1E293B] hover:border-osrs-text-dim/40'
                }`}>
                {task.completedThisPeriod && (
                  <svg className="w-3.5 h-3.5 text-osrs-green" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </button>

              {/* Description */}
              <div className={`flex-1 text-sm font-body ${task.completedThisPeriod ? 'text-osrs-green/60 line-through' : 'text-osrs-text/80'}`}>
                {task.description}
              </div>

              {/* Frequency badge */}
              <span className={`text-[10px] font-mono px-2 py-1 rounded-md ${
                task.completedThisPeriod
                  ? 'bg-osrs-green/10 text-osrs-green/50'
                  : 'bg-[#1E293B]/50 text-osrs-text-dim/40'
              }`}>
                {task.frequency === 'daily' ? 'Daily' : task.frequency === 'weekly' ? 'Weekly' : `${task.customIntervalHours}h`}
              </span>

              {/* Actions */}
              <button onClick={() => handleTogglePin(task)}
                className={`p-1 text-xs transition-colors ${task.pinned ? 'text-osrs-gold' : 'text-osrs-text-dim/20 hover:text-osrs-text-dim/40'}`}>
                📌
              </button>
              <button onClick={() => handleDelete(task.id)}
                className="p-1 text-xs text-osrs-text-dim/20 hover:text-red-400 transition-colors">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Task Form
// ============================================================================

const TaskForm: React.FC<{ playerName: string; onCreated: () => void }> = ({ playerName, onCreated }) => {
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<TaskFrequency>('daily')
  const [customHours, setCustomHours] = useState('24')
  const [pinned, setPinned] = useState(true)

  const handleSubmit = async () => {
    if (!description.trim()) return
    await window.electronAPI.invoke(IPC_CHANNELS.TASK_CREATE, {
      playerName,
      task: {
        description: description.trim(),
        frequency,
        customIntervalHours: frequency === 'custom' ? parseInt(customHours, 10) || 24 : null,
        pinned,
      },
    })
    onCreated()
  }

  const presets = [
    'Birdhouse run', 'Farm run', 'Collect battlestaves', 'Kingdom of Miscellania',
    'Herb boxes (NMZ)', 'Daily sand (Bert)', 'Tears of Guthix',
  ]

  return (
    <div className="bg-[#111827] border border-[#1E293B] rounded-xl p-4 space-y-3">
      <div>
        <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">Description</label>
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Birdhouse run"
          className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-osrs-text font-body focus:outline-none focus:border-osrs-gold/30 placeholder:text-osrs-text-dim/20" />
      </div>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p} onClick={() => setDescription(p)}
            className="px-2.5 py-1 rounded-md text-[10px] font-body bg-[#0B1120] text-osrs-text-dim/40 hover:text-osrs-text-dim hover:bg-[#1E293B] transition-colors">
            {p}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">Frequency</label>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'custom'] as TaskFrequency[]).map((f) => (
              <button key={f} onClick={() => setFrequency(f)}
                className={`flex-1 py-2 rounded-lg text-xs font-display uppercase transition-colors ${
                  frequency === f ? 'bg-[#1E293B] text-osrs-text' : 'bg-[#0B1120] text-osrs-text-dim/40 hover:text-osrs-text-dim'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {frequency === 'custom' && (
          <div className="w-24">
            <label className="text-[10px] uppercase tracking-widest font-display text-osrs-text-dim/50 mb-1 block">Hours</label>
            <input type="number" value={customHours} onChange={(e) => setCustomHours(e.target.value)}
              className="w-full bg-[#0B1120] border border-[#1E293B] rounded-lg px-3 py-2 text-sm text-osrs-text font-mono focus:outline-none focus:border-osrs-gold/30" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)}
            className="rounded border-[#1E293B] bg-[#0B1120] text-osrs-gold focus:ring-osrs-gold/30" />
          <span className="text-xs text-osrs-text-dim/60 font-body">Pin to dashboard</span>
        </label>
        <button onClick={handleSubmit} disabled={!description.trim()}
          className="px-4 py-2 rounded-lg text-xs font-display bg-osrs-gold/20 text-osrs-gold hover:bg-osrs-gold/30 transition-colors disabled:opacity-30">
          Create Task
        </button>
      </div>
    </div>
  )
}
