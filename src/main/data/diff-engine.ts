import { SkillState, SkillName, PlayerUpdateDiff, SessionState } from '@shared/types'
import { NormalizedPayload } from './normalizer'

interface PreviousState {
  loggedIn: boolean
  activeSkill: SkillName | null
  skills: Partial<Record<SkillName, SkillState>>
}

/**
 * Computes the diff between the previous tick state and the current tick.
 * Returns only skills whose data actually changed, plus always-included metadata.
 * Returns null if nothing changed at all (player idle, no state change).
 */
export function computeDiff(
  connectionId: string,
  previous: PreviousState | null,
  current: NormalizedPayload,
  session: SessionState
): PlayerUpdateDiff | null {
  // First tick for this player — send everything, no diffing
  if (previous === null) {
    return {
      playerName: current.playerName,
      connectionId,
      loggedIn: current.loggedIn,
      activeSkill: current.activeSkill,
      timestamp: current.timestamp,
      skills: { ...current.skills },
      session,
    }
  }

  const changedSkills: Partial<Record<SkillName, SkillState>> = {}
  let hasChanges = false

  // Check for metadata changes
  if (
    previous.loggedIn !== current.loggedIn ||
    previous.activeSkill !== current.activeSkill
  ) {
    hasChanges = true
  }

  // Check each skill for changes
  for (const [name, skillData] of Object.entries(current.skills)) {
    const skillName = name as SkillName
    const prev = previous.skills[skillName]

    if (!prev || hasSkillChanged(prev, skillData)) {
      changedSkills[skillName] = skillData
      hasChanges = true
    }
  }

  if (!hasChanges) return null

  return {
    playerName: current.playerName,
    connectionId,
    loggedIn: current.loggedIn,
    activeSkill: current.activeSkill,
    timestamp: current.timestamp,
    skills: changedSkills,
    session,
  }
}

function hasSkillChanged(prev: SkillState, curr: SkillState): boolean {
  return (
    prev.xp !== curr.xp ||
    prev.level !== curr.level ||
    prev.boostedLevel !== curr.boostedLevel ||
    prev.xpHr !== curr.xpHr ||
    prev.actionsHr !== curr.actionsHr ||
    prev.xpGained !== curr.xpGained ||
    prev.progressPercent !== curr.progressPercent ||
    prev.timeToLevel !== curr.timeToLevel
    // Intentionally not diffing lastGain — it's a timestamp, changes are
    // always paired with xp changes
  )
}
