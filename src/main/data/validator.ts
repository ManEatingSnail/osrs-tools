import { RawPluginPayload, RawSkillData, SKILL_NAMES, SkillName } from '@shared/types'

const SKILL_NAME_SET = new Set<string>(SKILL_NAMES)

/**
 * Validates and normalizes a raw JSON payload from the RuneLite plugin.
 * Returns null if the payload is malformed beyond recovery.
 * Tolerant of missing skills (plugin may have some ignored).
 */
export function validatePayload(raw: unknown): RawPluginPayload | null {
  if (raw === null || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>

  // Required fields
  if (typeof obj.player !== 'string' || obj.player.length === 0) return null
  if (typeof obj.logged_in !== 'boolean') return null
  if (typeof obj.timestamp !== 'number') return null

  const activeSkill = typeof obj.active_skill === 'string' ? obj.active_skill : null

  // Validate skills map
  if (typeof obj.skills !== 'object' || obj.skills === null) return null

  const rawSkills = obj.skills as Record<string, unknown>
  const validatedSkills: Record<string, RawSkillData> = {}

  for (const [name, data] of Object.entries(rawSkills)) {
    if (!SKILL_NAME_SET.has(name)) continue // Unknown skill — skip, don't reject
    const validated = validateSkillData(data)
    if (validated) {
      validatedSkills[name] = validated
    }
  }

  return {
    player: obj.player as string,
    logged_in: obj.logged_in as boolean,
    active_skill: activeSkill && SKILL_NAME_SET.has(activeSkill) ? activeSkill : null,
    timestamp: obj.timestamp as number,
    skills: validatedSkills,
  }
}

function validateSkillData(raw: unknown): RawSkillData | null {
  if (raw === null || typeof raw !== 'object') return null

  const obj = raw as Record<string, unknown>

  // All numeric fields must be present and numeric
  const xp = asNumber(obj.xp)
  const level = asNumber(obj.level)
  const boostedLevel = asNumber(obj.boosted_level)
  const xpHr = asNumber(obj.xp_hr)
  const actionsHr = asNumber(obj.actions_hr)
  const xpGained = asNumber(obj.xp_gained)
  const progressPercent = asNumber(obj.progress_percent)
  const lastGain = asNumber(obj.last_gain)

  if (xp === null || level === null || boostedLevel === null) return null

  return {
    xp,
    level,
    boosted_level: boostedLevel,
    xp_hr: xpHr ?? 0,
    actions_hr: actionsHr ?? 0,
    time_to_level: typeof obj.time_to_level === 'string' ? obj.time_to_level : '',
    xp_gained: xpGained ?? 0,
    progress_percent: progressPercent ?? 0,
    last_gain: lastGain ?? 0,
  }
}

function asNumber(val: unknown): number | null {
  if (typeof val === 'number' && !isNaN(val)) return val
  return null
}
