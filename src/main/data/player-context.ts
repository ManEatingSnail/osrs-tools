import { SkillState, SkillName, SessionState, PlayerState } from '@shared/types'
import { NormalizedPayload } from './normalizer'
import { v4 as uuidv4 } from 'uuid'

/**
 * Per-player in-memory context that tracks session-scoped data.
 * One instance per unique player name detected during this app session.
 */
export class PlayerContext {
  readonly playerName: string
  readonly sessionId: string
  readonly sessionStartTime: number

  private currentSkills: Partial<Record<SkillName, SkillState>> = {}
  private firstSeenXp: Partial<Record<SkillName, number>> = {}
  private loggedIn: boolean = false
  private activeSkill: SkillName | null = null
  private timestamp: number = 0
  private lastSnapshotTime: number = 0

  constructor(playerName: string, sessionId: string) {
    this.playerName = playerName
    this.sessionId = sessionId
    this.sessionStartTime = Date.now()
  }

  /**
   * Ingest a normalized tick payload. Updates internal state and returns
   * the previous state for diffing.
   */
  ingest(payload: NormalizedPayload): {
    previousSkills: Partial<Record<SkillName, SkillState>>
    previousLoggedIn: boolean
    previousActiveSkill: SkillName | null
  } {
    const previousSkills = { ...this.currentSkills }
    const previousLoggedIn = this.loggedIn
    const previousActiveSkill = this.activeSkill

    this.loggedIn = payload.loggedIn
    this.activeSkill = payload.activeSkill
    this.timestamp = payload.timestamp

    // Update skills and track first-seen XP
    for (const [name, data] of Object.entries(payload.skills)) {
      const skillName = name as SkillName
      this.currentSkills[skillName] = data

      if (!(skillName in this.firstSeenXp)) {
        this.firstSeenXp[skillName] = data.xp
      }
    }

    return { previousSkills, previousLoggedIn, previousActiveSkill }
  }

  /** Get the current session state with derived metrics */
  getSessionState(): SessionState {
    const skillXpGained: Partial<Record<SkillName, number>> = {}
    let totalXpGained = 0

    for (const [name, data] of Object.entries(this.currentSkills)) {
      const skillName = name as SkillName
      const firstXp = this.firstSeenXp[skillName]
      if (firstXp !== undefined && data) {
        const gained = data.xp - firstXp
        if (gained > 0) {
          skillXpGained[skillName] = gained
          totalXpGained += gained
        }
      }
    }

    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      duration: Date.now() - this.sessionStartTime,
      totalXpGained,
      skillXpGained,
    }
  }

  /** Get the full player state snapshot */
  getPlayerState(): PlayerState {
    return {
      playerName: this.playerName,
      loggedIn: this.loggedIn,
      activeSkill: this.activeSkill,
      timestamp: this.timestamp,
      skills: { ...this.currentSkills },
      session: this.getSessionState(),
    }
  }

  /** Check if enough time has elapsed for a 1-minute snapshot */
  shouldSnapshot(): boolean {
    const now = Date.now()
    if (now - this.lastSnapshotTime >= 60_000) {
      this.lastSnapshotTime = now
      return true
    }
    return false
  }

  getCurrentSkills(): Partial<Record<SkillName, SkillState>> {
    return this.currentSkills
  }

  isLoggedIn(): boolean {
    return this.loggedIn
  }
}
