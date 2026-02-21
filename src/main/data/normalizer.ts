import { RawPluginPayload, SkillState, SkillName, SKILL_NAMES } from '@shared/types'

const SKILL_NAME_SET = new Set<string>(SKILL_NAMES)

export interface NormalizedPayload {
  playerName: string
  loggedIn: boolean
  activeSkill: SkillName | null
  timestamp: number
  skills: Partial<Record<SkillName, SkillState>>
}

/**
 * Normalizes a validated raw payload into app-internal camelCase types.
 */
export function normalizePayload(raw: RawPluginPayload): NormalizedPayload {
  const skills: Partial<Record<SkillName, SkillState>> = {}

  for (const [name, data] of Object.entries(raw.skills)) {
    if (!SKILL_NAME_SET.has(name)) continue

    skills[name as SkillName] = {
      xp: data.xp,
      level: data.level,
      boostedLevel: data.boosted_level,
      xpHr: data.xp_hr,
      actionsHr: data.actions_hr,
      timeToLevel: data.time_to_level,
      xpGained: data.xp_gained,
      progressPercent: data.progress_percent,
      lastGain: data.last_gain,
    }
  }

  return {
    playerName: raw.player,
    loggedIn: raw.logged_in,
    activeSkill: raw.active_skill as SkillName | null,
    timestamp: raw.timestamp,
    skills,
  }
}
