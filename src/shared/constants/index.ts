import { SkillName } from '../types'

// ============================================================================
// OSRS XP Table — Level 1-99 XP thresholds
// Matches RuneLite Experience.getXpForLevel()
// ============================================================================

const XP_TABLE: number[] = [0]

function buildXpTable(): void {
  let points = 0
  for (let level = 1; level < 100; level++) {
    const diff = Math.floor(level + 300 * Math.pow(2, level / 7))
    points += diff
    XP_TABLE[level] = Math.floor(points / 4)
  }
}
buildXpTable()

/** Get the total XP required to reach a given level (1-99) */
export function getXpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level >= 99) return XP_TABLE[98] // 13,034,431
  return XP_TABLE[level - 1]
}

/** Get the level for a given XP amount */
export function getLevelForXp(xp: number): number {
  for (let level = 98; level >= 0; level--) {
    if (xp >= XP_TABLE[level]) return level + 1
  }
  return 1
}

/** Max XP in OSRS */
export const MAX_XP = 200_000_000

/** Max level */
export const MAX_LEVEL = 99

// ============================================================================
// Skill Categories (for UI grouping)
// ============================================================================

export type SkillCategory = 'combat' | 'gathering' | 'artisan' | 'support'

export const SKILL_CATEGORIES: Record<SkillCategory, SkillName[]> = {
  combat: ['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Hitpoints'],
  gathering: ['Mining', 'Fishing', 'Woodcutting', 'Farming', 'Hunter'],
  artisan: ['Cooking', 'Smithing', 'Fletching', 'Crafting', 'Herblore', 'Runecraft', 'Construction', 'Firemaking'],
  support: ['Agility', 'Thieving', 'Slayer', 'Sailing'],
}

/** Skill → category lookup */
export const SKILL_TO_CATEGORY: Record<SkillName, SkillCategory> = {} as Record<SkillName, SkillCategory>
for (const [category, skills] of Object.entries(SKILL_CATEGORIES)) {
  for (const skill of skills) {
    SKILL_TO_CATEGORY[skill] = category as SkillCategory
  }
}

// ============================================================================
// Skill Colors (for charts and UI accents)
// ============================================================================

export const SKILL_COLORS: Record<SkillName, string> = {
  Attack: '#9B1C1C',
  Strength: '#047857',
  Defence: '#1E40AF',
  Ranged: '#065F46',
  Prayer: '#FBBF24',
  Magic: '#6D28D9',
  Runecraft: '#B45309',
  Construction: '#92400E',
  Hitpoints: '#DC2626',
  Agility: '#1D4ED8',
  Herblore: '#059669',
  Thieving: '#7C3AED',
  Crafting: '#B91C1C',
  Fletching: '#065F46',
  Slayer: '#1F2937',
  Hunter: '#92400E',
  Mining: '#6B7280',
  Smithing: '#6B7280',
  Fishing: '#2563EB',
  Cooking: '#B91C1C',
  Firemaking: '#F59E0B',
  Woodcutting: '#065F46',
  Farming: '#15803D',
  Sailing: '#0EA5E9',
}

// ============================================================================
// Default Connection
// ============================================================================

export const DEFAULT_CONNECTION = {
  host: 'localhost',
  port: 8080,
  endpoint: '/update',
  pollInterval: 600,
  enabled: true,
} as const
