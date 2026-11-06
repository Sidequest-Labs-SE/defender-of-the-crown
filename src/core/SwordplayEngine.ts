import {
  ActionResult,
  CampaignState,
  Lord,
  PendingSwordplayContext,
  SaxonDamsel,
  SaxonDamselId,
  SwordplayAction,
  SwordplayMissionStatus,
  SwordplayMissionType,
  SwordplayZone,
} from './types';
import { SAXON_DAMSELS } from '../data/damsels';
import { GameState } from './GameState';

export type SwordplayStageNumber = 1 | 2 | 3;

export type FencerPose =
  | 'EN_GARDE'
  | 'WINDUP_HIGH'
  | 'WINDUP_MID'
  | 'WINDUP_LOW'
  | 'ATTACK_HIGH'
  | 'ATTACK_MID'
  | 'ATTACK_LOW'
  | 'PARRY'
  | 'STAGGER'
  | 'DEFEAT';

export interface SwordplayActionProfile {
  id: SwordplayAction;
  label: string;
  shortLabel: string;
  hotkey: string;
  zone: SwordplayZone | null;
  baseDamage: number;
  basePushback: number;
  baseStaminaCost: number;
  speedRating: number;
  description: string;
}

export const SWORDPLAY_ACTION_PROFILES: Record<
  SwordplayAction,
  SwordplayActionProfile
> = {
  ATTACK_HIGH: {
    id: 'ATTACK_HIGH',
    label: 'HIGH SLASH',
    shortLabel: 'HIGH',
    hotkey: '1 / Q',
    zone: 'HIGH',
    baseDamage: 21,
    basePushback: 15,
    baseStaminaCost: 16,
    speedRating: 1.0,
    description: 'Overhead cleave: heavy blade damage, crushes low crouch.',
  },
  ATTACK_MID: {
    id: 'ATTACK_MID',
    label: 'MID THRUST',
    shortLabel: 'MID',
    hotkey: '2 / W',
    zone: 'MID',
    baseDamage: 16,
    basePushback: 16,
    baseStaminaCost: 12,
    speedRating: 1.3,
    description: 'Swift lunge thrust: beats slower swings on speed, balanced push.',
  },
  ATTACK_LOW: {
    id: 'ATTACK_LOW',
    label: 'LOW SWEEP',
    shortLabel: 'LOW',
    hotkey: '3 / E',
    zone: 'LOW',
    baseDamage: 14,
    basePushback: 23,
    baseStaminaCost: 15,
    speedRating: 1.14,
    description: 'Sweeping low cut: ducks under HIGH guard with heavy pushback!',
  },
  PARRY: {
    id: 'PARRY',
    label: 'PARRY & RIPOSTE',
    shortLabel: 'PARRY',
    hotkey: 'SPACE / S',
    zone: null,
    baseDamage: 0,
    basePushback: 9,
    baseStaminaCost: 5,
    speedRating: 1.5,
    description:
      'Deflects incoming strike, restores Stamina & arms a 1.6x RIPOSTE!',
  },
  STEP_BACK: {
    id: 'STEP_BACK',
    label: 'STEP BACK',
    shortLabel: 'RECOVER',
    hotkey: 'A',
    zone: null,
    baseDamage: 0,
    basePushback: -12,
    baseStaminaCost: 0,
    speedRating: 1.4,
    description:
      'Yields slight ground to rapidly regenerate +34 Stamina & poise.',
  },
};

export interface DuelistState {
  id: string;
  name: string;
  title: string;
  portraitKey: string;
  faction: 'saxon' | 'norman';
  role: 'PLAYER' | 'GUARD' | 'CAPTAIN' | 'LORD';
  swordplay: number; // 1..10
  health: number; // 0..100
  maxHealth: number;
  stamina: number; // 0..100
  maxStamina: number;
  stance: SwordplayZone;
  riposteReady: boolean;
}

export interface CastleStageEncounter {
  stageNumber: SwordplayStageNumber;
  roomCode: 'COURTYARD' | 'GREAT_HALL' | 'VAULT';
  stageHeader: string;
  roomTitle: string;
  defender: DuelistState;
  telegraphBaseMs: number;
}

export type ExchangeOutcomeType =
  | 'PLAYER_HIT'
  | 'PLAYER_RIPOSTE_HIT'
  | 'PLAYER_GUARD_BREAK'
  | 'PLAYER_PARRY_SUCCESS'
  | 'ENEMY_PARRY'
  | 'BLADE_BIND'
  | 'ENEMY_HIT'
  | 'PLAYER_RECOVERED'
  | 'STAGE_CLEARED'
  | 'PLAYER_DEFEATED';

export interface SwordplayExchangeReport {
  playerAction: SwordplayAction;
  enemyAction: SwordplayAction;
  outcome: ExchangeOutcomeType;
  playerDamageDealt: number;
  enemyDamageDealt: number;
  positionDelta: number;
  newPosition: number;
  riposteTriggered: boolean;
  riposteArmed: boolean;
  guardBroken: boolean;
  stageCleared: boolean;
  stageClearReason: 'NONE' | 'HEALTH_DEPLETED' | 'FORCED_YIELD';
  missionStatus: SwordplayMissionStatus;
  calloutText: string;
  calloutColor: 'GOLD' | 'CRIMSON' | 'AZURE' | 'EMERALD' | 'SILVER';
  summary: string;
}

export interface SwordplayOutcomeSummary {
  missionType: SwordplayMissionType;
  status: SwordplayMissionStatus;
  attackerId: string;
  targetLordId: string;
  targetLordName: string;
  targetTerritoryId: string;
  targetTerritoryName: string;
  stagesCleared: number;
  goldStolenTotal: number;
  goldTakenFromLord: number;
  vaultBonusGold: number;
  ransomPaid: number;
  robinHoodBailoutUsed: boolean;
  robinHoodUsesRemaining: number;
  rescuedDamsel?: SaxonDamsel;
  marriedDamsel?: boolean;
  leadershipGained: number;
  secondaryStatName?: 'jousting' | 'swordplay';
  secondaryStatGained: number;
  headline: string;
  chronicleMessage: string;
}

export interface SwordplaySession {
  missionType: SwordplayMissionType;
  status: SwordplayMissionStatus;
  attackerId: string;
  targetLordId: string;
  targetLordName: string;
  targetLordGold: number;
  targetTerritoryId: string;
  targetTerritoryName: string;
  damselId?: SaxonDamselId;
  damsel?: SaxonDamsel;

  stageNumber: SwordplayStageNumber;
  stages: CastleStageEncounter[];
  stagesCleared: number;

  player: DuelistState;
  enemy: DuelistState;

  /**
   * Footing / Push-back line across the castle room:
   * -100 = Player cornered against doorway (Defeat!)
   *    0 = Center of hall
   * +100 = Defender driven to wall/stairs & forced to yield at sword-point!
   */
  position: number;

  /**
   * Active incoming enemy wind-up telegraph (350ms - 550ms window in real-time UI)
   */
  telegraphedEnemyAction:
    | 'ATTACK_HIGH'
    | 'ATTACK_MID'
    | 'ATTACK_LOW'
    | null;
  telegraphZone: SwordplayZone | null;
  telegraphDurationMs: number;

  exchangeCount: number;
  deterministic: boolean;
  rngState: number;
  committed: boolean;
  committedSummary?: SwordplayOutcomeSummary;
  tickerLog: string[];
}

/**
 * SwordplayEngine — Sprint 5 Swashbuckling Fencing, Night Castle Raids & Damsel Rescues
 * Pure TypeScript core module with ZERO Phaser dependencies.
 */
export class SwordplayEngine {
  public static readonly RIPOSTE_DAMAGE_MULT = 1.6;
  public static readonly RIPOSTE_PUSH_MULT = 1.6;
  public static readonly MIN_VAULT_LOOT_GOLD = 8;
  public static readonly RAID_THEFT_FRACTION = 0.6;
  public static readonly DEFEAT_RANSOM_FRACTION = 0.5;

  // ==========================================================================
  // 1. STAT SCALING FORMULAS (swordplay: 1..10)
  // ==========================================================================

  /**
   * Boosts strike damage and pushback: (1 + swordplay * 0.07)
   * Stat 1 -> 1.07x | Stat 6 -> 1.42x | Stat 9 -> 1.63x | Stat 10 -> 1.70x
   */
  public static getDamageMultiplier(swordplay: number): number {
    const clamped = Math.max(1, Math.min(10, swordplay));
    return Number((1 + clamped * 0.07).toFixed(2));
  }

  /**
   * Higher swordplay reduces stamina expended per swing (up to ~35% reduction at 10).
   */
  public static getStaminaCost(baseCost: number, swordplay: number): number {
    if (baseCost <= 0) return 0;
    const clamped = Math.max(1, Math.min(10, swordplay));
    return Math.max(4, Math.round(baseCost * (1 - clamped * 0.035)));
  }

  /**
   * Base blade accuracy against an unparried opponent (0.746 at stat 1 -> 0.98 at stat 10).
   */
  public static getStrikeAccuracy(swordplay: number): number {
    const clamped = Math.max(1, Math.min(10, swordplay));
    return Math.min(0.98, Number((0.72 + clamped * 0.026).toFixed(3)));
  }

  /**
   * Effective attack speed combining maneuver speedRating and swordplay finesse.
   */
  public static getEffectiveSpeed(
    action: SwordplayAction,
    swordplay: number
  ): number {
    const clamped = Math.max(1, Math.min(10, swordplay));
    const base = SWORDPLAY_ACTION_PROFILES[action].speedRating;
    return Number((base + clamped * 0.04).toFixed(3));
  }

  /**
   * Computes PARRY deflection effectiveness (0..1):
   * - Parrying inside an active telegraph window OR matching the incoming zone grants near-certain deflection,
   *   scaling to 100% with swordplay.
   * - Even an off-zone reactive parry scales strongly with swordplay (36% at stat 1 -> 86% at stat 10).
   */
  public static getParryEffectiveness(
    swordplay: number,
    stanceMatchesIncoming: boolean,
    inTelegraphWindow: boolean
  ): number {
    const clamped = Math.max(1, Math.min(10, swordplay));
    if (stanceMatchesIncoming) {
      return 1.0;
    }
    if (inTelegraphWindow) {
      return Math.min(1.0, Number((0.76 + clamped * 0.028).toFixed(3)));
    }
    return Math.min(0.9, Number((0.31 + clamped * 0.055).toFixed(3)));
  }

  /**
   * Computes Raid Victory treasury theft: 60% of target Lord's gold, minimum 8 Gold total loot.
   */
  public static calculateRaidLoot(targetLordGold: number): {
    totalGoldStolen: number;
    takenFromLord: number;
    vaultBonusGold: number;
  } {
    const cleanGold = Math.max(0, Math.floor(targetLordGold));
    const rawSixty = Math.round(cleanGold * this.RAID_THEFT_FRACTION);
    const takenFromLord = Math.min(cleanGold, rawSixty);
    const totalGoldStolen = Math.max(this.MIN_VAULT_LOOT_GOLD, takenFromLord);
    const vaultBonusGold = Math.max(0, totalGoldStolen - takenFromLord);

    return {
      totalGoldStolen,
      takenFromLord,
      vaultBonusGold,
    };
  }

  /**
   * Computes Defeat Ransom: 50% of Player's current Gold.
   */
  public static calculateDefeatRansom(playerGold: number): number {
    const cleanGold = Math.max(0, Math.floor(playerGold));
    return Math.floor(cleanGold * this.DEFEAT_RANSOM_FRACTION);
  }

  /**
   * Validates whether a rival Lord can be targeted for a Night Castle Raid.
   * Eligible if active, undefeated, not the player, and either has gold >= 5 or owns >= 1 castle.
   */
  public static canRaidLord(
    state: CampaignState,
    targetLordId: string
  ): ActionResult {
    if (state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    if (state.hasRaidedThisTurn) {
      return {
        success: false,
        message:
          'Thou hast already conducted a Night Raid this month! Advance the turn first.',
      };
    }

    const target = state.activeLords[targetLordId];
    if (!target || !target.isActive || target.isDefeated) {
      return { success: false, message: 'Target Lord is inactive or defeated.' };
    }
    if (target.isPlayer || target.id === state.selectedLordId) {
      return { success: false, message: 'Cannot raid thine own stronghold!' };
    }

    const ownsCastle = Object.values(state.territories).some(
      (t) => t.ownerId === target.id && t.hasCastle && !t.isSherwood
    );

    if (target.gold < 5 && !ownsCastle) {
      return {
        success: false,
        message: `${target.name} has neither 5 Gold nor a fortified Castle worth raiding.`,
      };
    }

    return {
      success: true,
      message: `Ready to infiltrate ${target.name}'s stronghold under cover of night!`,
    };
  }

  // ==========================================================================
  // 2. SESSION CREATION & 3-STAGE CASTLE PROGRESSION
  // ==========================================================================

  public static createSession(
    state: CampaignState,
    context: PendingSwordplayContext,
    options?: { deterministic?: boolean; seed?: number }
  ): SwordplaySession {
    const attacker = state.activeLords[context.attackerId];
    const targetLord = state.activeLords[context.targetLordId];

    if (!attacker) {
      throw new Error(`Invalid swordplay attacker: ${context.attackerId}`);
    }
    if (!targetLord) {
      throw new Error(`Invalid swordplay target lord: ${context.targetLordId}`);
    }

    const territory =
      state.territories[context.targetTerritoryId] ??
      state.territories[targetLord.homeTerritoryId];
    const territoryName = territory ? territory.name : 'Enemy Stronghold';

    const damselId =
      context.missionType === 'RESCUE'
        ? context.damselId ?? state.captiveDamsel?.damselId ?? 'rowena'
        : undefined;
    const damsel = damselId ? SAXON_DAMSELS[damselId] : undefined;

    const playerDuelist: DuelistState = {
      id: attacker.id,
      name: attacker.name,
      title: attacker.title,
      portraitKey: `portrait_${attacker.id}`,
      faction: attacker.faction,
      role: 'PLAYER',
      swordplay: Math.max(1, Math.min(10, attacker.swordplay)),
      health: 100,
      maxHealth: 100,
      stamina: 100,
      maxStamina: 100,
      stance: 'MID',
      riposteReady: false,
    };

    const stages = this.buildThreeCastleStages(
      targetLord,
      territoryName,
      context.missionType
    );

    const stage1 = stages[0];
    const initialDefender: DuelistState = { ...stage1.defender };

    const introMsg =
      context.missionType === 'RESCUE' && damsel
        ? `${attacker.name} slips into ${territoryName} by moonlight to rescue ${damsel.name}!`
        : `${attacker.name} scales the walls of ${territoryName} to raid ${targetLord.name}'s treasury!`;

    return {
      missionType: context.missionType,
      status: 'ACTIVE',
      attackerId: attacker.id,
      targetLordId: targetLord.id,
      targetLordName: targetLord.name,
      targetLordGold: targetLord.gold,
      targetTerritoryId: territory ? territory.id : context.targetTerritoryId,
      targetTerritoryName: territoryName,
      damselId,
      damsel,
      stageNumber: 1,
      stages,
      stagesCleared: 0,
      player: playerDuelist,
      enemy: initialDefender,
      position: 0,
      telegraphedEnemyAction: null,
      telegraphZone: null,
      telegraphDurationMs: stage1.telegraphBaseMs,
      exchangeCount: 0,
      deterministic: Boolean(options?.deterministic),
      rngState: (options?.seed ?? 0x51a7beef) >>> 0,
      committed: false,
      tickerLog: [
        introMsg,
        `${stage1.stageHeader} — ${initialDefender.name} bars the gate! En Garde!`,
      ],
    };
  }

  private static buildThreeCastleStages(
    targetLord: Lord,
    territoryName: string,
    missionType: SwordplayMissionType
  ): CastleStageEncounter[] {
    const lordSkill = Math.max(1, Math.min(10, targetLord.swordplay));
    const guard1Skill = Math.max(2, Math.min(6, Math.round(lordSkill * 0.55)));
    const guard2Skill = Math.max(3, Math.min(8, Math.round(lordSkill * 0.8)));

    const factionAdj = targetLord.faction === 'norman' ? 'Norman' : 'Castle';

    const stage1: CastleStageEncounter = {
      stageNumber: 1,
      roomCode: 'COURTYARD',
      stageHeader: 'STAGE 1/3: COURTYARD',
      roomTitle: `${territoryName} — Outer Bailey Gate`,
      telegraphBaseMs: 530,
      defender: {
        id: `${targetLord.id}_guard_1`,
        name: `${factionAdj} Courtyard Sentry`,
        title: 'Outer Bailey Watchman',
        portraitKey: 'portrait_garrison',
        faction: targetLord.faction,
        role: 'GUARD',
        swordplay: guard1Skill,
        health: 85,
        maxHealth: 85,
        stamina: 100,
        maxStamina: 100,
        stance: 'MID',
        riposteReady: false,
      },
    };

    const stage2: CastleStageEncounter = {
      stageNumber: 2,
      roomCode: 'GREAT_HALL',
      stageHeader: 'STAGE 2/3: GREAT HALL',
      roomTitle: `${territoryName} — Torchlit Great Staircase`,
      telegraphBaseMs: 455,
      defender: {
        id: `${targetLord.id}_guard_2`,
        name: `Captain of ${territoryName}`,
        title: 'Veteran Hall Master-at-Arms',
        portraitKey: 'portrait_garrison',
        faction: targetLord.faction,
        role: 'CAPTAIN',
        swordplay: guard2Skill,
        health: 95,
        maxHealth: 95,
        stamina: 100,
        maxStamina: 100,
        stance: 'HIGH',
        riposteReady: false,
      },
    };

    const stage3Header =
      missionType === 'RESCUE'
        ? 'STAGE 3/3: TOWER CHAMBER'
        : 'STAGE 3/3: TOWER VAULT';
    const stage3Title =
      missionType === 'RESCUE'
        ? `${territoryName} — Moonlit Captive Tower`
        : `${territoryName} — Royal Treasure Vault`;

    const stage3: CastleStageEncounter = {
      stageNumber: 3,
      roomCode: 'VAULT',
      stageHeader: stage3Header,
      roomTitle: stage3Title,
      telegraphBaseMs: Math.max(350, Math.min(500, 505 - lordSkill * 14)),
      defender: {
        id: targetLord.id,
        name: targetLord.name,
        title: targetLord.title,
        portraitKey: `portrait_${targetLord.id}`,
        faction: targetLord.faction,
        role: 'LORD',
        swordplay: lordSkill,
        health: 100,
        maxHealth: 100,
        stamina: 100,
        maxStamina: 100,
        stance: 'MID',
        riposteReady: false,
      },
    };

    return [stage1, stage2, stage3];
  }

  // ==========================================================================
  // 3. ENEMY TELEGRAPHING & TACTICAL EXCHANGE RESOLUTION
  // ==========================================================================

  /**
   * Initiates an enemy wind-up telegraph ('HIGH', 'MID', or 'LOW') lasting 350ms–550ms
   * so skilled players can read the stance and time PARRY or a counter-zone strike.
   */
  public static beginEnemyTelegraph(
    session: SwordplaySession,
    forcedZone?: SwordplayZone
  ): {
    action: 'ATTACK_HIGH' | 'ATTACK_MID' | 'ATTACK_LOW';
    zone: SwordplayZone;
    durationMs: number;
  } {
    const zones: SwordplayZone[] = ['HIGH', 'MID', 'LOW'];
    let chosenZone: SwordplayZone;

    if (forcedZone) {
      chosenZone = forcedZone;
    } else {
      // Tactical AI favors targeting a zone different from player's current stance
      const roll = this.nextRandom(session);
      const offStanceZones = zones.filter((z) => z !== session.player.stance);
      if (roll < 0.68 && offStanceZones.length > 0) {
        const idx = Math.floor(this.nextRandom(session) * offStanceZones.length);
        chosenZone = offStanceZones[idx];
      } else {
        const idx = Math.floor(this.nextRandom(session) * zones.length);
        chosenZone = zones[idx];
      }
    }

    const actionMap: Record<
      SwordplayZone,
      'ATTACK_HIGH' | 'ATTACK_MID' | 'ATTACK_LOW'
    > = {
      HIGH: 'ATTACK_HIGH',
      MID: 'ATTACK_MID',
      LOW: 'ATTACK_LOW',
    };

    const action = actionMap[chosenZone];
    const stageCfg = session.stages[session.stageNumber - 1];
    // Higher player swordplay sharpens perception slightly (+5ms per stat, clamped 350..550ms)
    const durationMs = Math.max(
      350,
      Math.min(
        550,
        (stageCfg?.telegraphBaseMs ?? 450) + (session.player.swordplay - 5) * 6
      )
    );

    session.telegraphedEnemyAction = action;
    session.telegraphZone = chosenZone;
    session.telegraphDurationMs = durationMs;
    session.enemy.stance = chosenZone;

    return { action, zone: chosenZone, durationMs };
  }

  /**
   * Resolves an unanswered telegraphed enemy strike when the player fails to react in time.
   */
  public static resolveUnansweredEnemyStrike(
    session: SwordplaySession
  ): SwordplayExchangeReport {
    if (session.status !== 'ACTIVE') {
      return this.buildIdleReport(session);
    }

    const enemyAction = session.telegraphedEnemyAction ?? 'ATTACK_MID';
    session.telegraphedEnemyAction = null;
    session.telegraphZone = null;
    session.exchangeCount += 1;

    const prof = SWORDPLAY_ACTION_PROFILES[enemyAction];
    const enemyMult = this.getDamageMultiplier(session.enemy.swordplay);
    const enemyStamCost = this.getStaminaCost(
      prof.baseStaminaCost,
      session.enemy.swordplay
    );
    session.enemy.stamina = Math.max(0, session.enemy.stamina - enemyStamCost);

    // Passive guard check: if player happens to be in the exact matching stance with good stamina, partial block
    const passiveMatch =
      prof.zone === session.player.stance && session.player.stamina >= 25;
    const damageFactor = passiveMatch ? 0.52 : 1.0;
    const pushFactor = passiveMatch ? 0.55 : 1.0;

    const rawDmg = Math.max(4, Math.round(prof.baseDamage * enemyMult * damageFactor));
    const rawPush = Math.max(5, Math.round(prof.basePushback * enemyMult * pushFactor));

    session.player.health = Math.max(0, session.player.health - rawDmg);
    session.player.stamina = Math.min(100, session.player.stamina + 5);
    session.player.riposteReady = false;
    session.position = this.clampPosition(session.position - rawPush);

    if (session.player.health <= 0 || session.position <= -100) {
      session.status = 'DEFEATED';
      const defeatReason =
        session.position <= -100
          ? `${session.player.name} is driven against the iron door and surrounded!`
          : `${session.player.name} is overwhelmed by ${session.enemy.name}!`;
      this.pushTicker(session, defeatReason);
      return {
        playerAction: 'PARRY',
        enemyAction,
        outcome: 'PLAYER_DEFEATED',
        playerDamageDealt: 0,
        enemyDamageDealt: rawDmg,
        positionDelta: -rawPush,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken: !passiveMatch,
        stageCleared: false,
        stageClearReason: 'NONE',
        missionStatus: session.status,
        calloutText:
          session.position <= -100 ? 'CORNERED!' : `HIT! -${rawDmg}`,
        calloutColor: 'CRIMSON',
        summary: defeatReason,
      };
    }

    const msg = passiveMatch
      ? `${session.enemy.name}'s ${prof.label} grazes thy passive guard (-${rawDmg} HP).`
      : `${session.enemy.name} lands an unanswered ${prof.label} (-${rawDmg} HP, pushed back)!`;
    this.pushTicker(session, msg);

    return {
      playerAction: 'PARRY',
      enemyAction,
      outcome: 'ENEMY_HIT',
      playerDamageDealt: 0,
      enemyDamageDealt: rawDmg,
      positionDelta: -rawPush,
      newPosition: session.position,
      riposteTriggered: false,
      riposteArmed: false,
      guardBroken: !passiveMatch,
      stageCleared: false,
      stageClearReason: 'NONE',
      missionStatus: session.status,
      calloutText: passiveMatch ? `GRAZED -${rawDmg}` : `STRUCK! -${rawDmg}`,
      calloutColor: 'CRIMSON',
      summary: msg,
    };
  }

  /**
   * Core swashbuckling exchange resolver.
   * Handles offensive strikes (HIGH, MID, LOW), timed PARRY & RIPOSTE (1.6x counter-damage),
   * and STEP_BACK recovery against either a telegraphed strike or reactive AI defender.
   */
  public static executeExchange(
    session: SwordplaySession,
    playerAction: SwordplayAction,
    options?: {
      forcedEnemyAction?: SwordplayAction;
      inTelegraphWindow?: boolean;
    }
  ): SwordplayExchangeReport {
    if (session.status !== 'ACTIVE') {
      return this.buildIdleReport(session);
    }

    session.exchangeCount += 1;

    const wasTelegraphed =
      Boolean(options?.inTelegraphWindow) ||
      session.telegraphedEnemyAction !== null;
    const enemyAction: SwordplayAction =
      options?.forcedEnemyAction ??
      session.telegraphedEnemyAction ??
      this.chooseEnemyReactiveAction(session, playerAction);

    // Clear active telegraph once resolved
    session.telegraphedEnemyAction = null;
    session.telegraphZone = null;

    const pProf = SWORDPLAY_ACTION_PROFILES[playerAction];
    const eProf = SWORDPLAY_ACTION_PROFILES[enemyAction];

    if (pProf.zone) {
      session.player.stance = pProf.zone;
    }
    if (eProf.zone) {
      session.enemy.stance = eProf.zone;
    }

    // ------------------------------------------------------------------------
    // CASE 1: PLAYER STEPS BACK (RECOVER STAMINA & POISE)
    // ------------------------------------------------------------------------
    if (playerAction === 'STEP_BACK') {
      session.player.riposteReady = false;
      const stamGain = 34 + Math.round(session.player.swordplay * 1.2);
      session.player.stamina = Math.min(100, session.player.stamina + stamGain);
      session.enemy.stamina = Math.min(100, session.enemy.stamina + 10);

      // Stepping back yields slight floor space (-10..-12), avoiding full enemy cleave
      const stepDelta = session.position > -84 ? -10 : -4;
      session.position = this.clampPosition(session.position + stepDelta);

      let chipDmg = 0;
      if (eProf.zone && enemyAction === 'ATTACK_MID' && this.nextRandom(session) < 0.25) {
        // Long lunge thrust can occasionally graze a retreating fencer slightly
        chipDmg = 4;
        session.player.health = Math.max(1, session.player.health - chipDmg);
      }

      const msg =
        chipDmg > 0
          ? `${session.player.name} steps back to recover poise (+${stamGain} Stamina, -${chipDmg} graze).`
          : `${session.player.name} steps back nimble-footed, evading steel (+${stamGain} Stamina)!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome: 'PLAYER_RECOVERED',
        playerDamageDealt: 0,
        enemyDamageDealt: chipDmg,
        positionDelta: stepDelta,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken: false,
        stageCleared: false,
        stageClearReason: 'NONE',
        missionStatus: session.status,
        calloutText: `RECOVER +${stamGain} STAM`,
        calloutColor: 'AZURE',
        summary: msg,
      };
    }

    // ------------------------------------------------------------------------
    // CASE 2: PLAYER PARRIES (DEFLECTS & OPENS 1.6x RIPOSTE WINDOW!)
    // ------------------------------------------------------------------------
    if (playerAction === 'PARRY') {
      const enemyIsAttacking = eProf.zone !== null;
      if (!enemyIsAttacking) {
        // Both held guard / cautious circle -> recover stamina
        session.player.stamina = Math.min(100, session.player.stamina + 18);
        session.enemy.stamina = Math.min(100, session.enemy.stamina + 14);
        const msg = `Blades circle warily in the torchlight (+18 Stamina).`;
        this.pushTicker(session, msg);
        return {
          playerAction,
          enemyAction,
          outcome: 'BLADE_BIND',
          playerDamageDealt: 0,
          enemyDamageDealt: 0,
          positionDelta: 0,
          newPosition: session.position,
          riposteTriggered: false,
          riposteArmed: session.player.riposteReady,
          guardBroken: false,
          stageCleared: false,
          stageClearReason: 'NONE',
          missionStatus: session.status,
          calloutText: 'EN GARDE!',
          calloutColor: 'SILVER',
          summary: msg,
        };
      }

      const stanceMatches = session.player.stance === eProf.zone;
      const parryChance = this.getParryEffectiveness(
        session.player.swordplay,
        stanceMatches,
        wasTelegraphed
      );
      const roll = this.nextRandom(session);

      if (roll <= parryChance) {
        // SUCCESSFUL PARRY! Restore stamina, drain enemy stamina, push enemy back, arm RIPOSTE!
        const stamRestore = 22 + Math.round(session.player.swordplay * 1.4);
        session.player.stamina = Math.min(
          100,
          session.player.stamina + stamRestore
        );
        session.enemy.stamina = Math.max(0, session.enemy.stamina - 20);
        session.player.riposteReady = true;

        const parryPush = Math.round(
          SWORDPLAY_ACTION_PROFILES.PARRY.basePushback *
            this.getDamageMultiplier(session.player.swordplay)
        );
        session.position = this.clampPosition(session.position + parryPush);

        const stageCheck = this.checkAndHandleStageClear(session);
        const msg = stageCheck.cleared
          ? `PARRY! ${session.player.name} binds ${session.enemy.name}'s blade and forces surrender!`
          : `PARRY! ${session.player.name} deflects ${eProf.label} — RIPOSTE READY (1.6x)!`;
        this.pushTicker(session, msg);

        return {
          playerAction,
          enemyAction,
          outcome: stageCheck.cleared ? 'STAGE_CLEARED' : 'PLAYER_PARRY_SUCCESS',
          playerDamageDealt: 0,
          enemyDamageDealt: 0,
          positionDelta: parryPush,
          newPosition: session.position,
          riposteTriggered: false,
          riposteArmed: true,
          guardBroken: false,
          stageCleared: stageCheck.cleared,
          stageClearReason: stageCheck.reason,
          missionStatus: session.status,
          calloutText: stageCheck.cleared
            ? 'YIELDED!'
            : 'PARRY! RIPOSTE READY!',
          calloutColor: 'GOLD',
          summary: msg,
        };
      } else {
        // Off-line mistimed parry pierced by enemy strike
        const eMult = this.getDamageMultiplier(session.enemy.swordplay);
        const dmg = Math.max(5, Math.round(eProf.baseDamage * eMult * 0.72));
        const push = Math.max(5, Math.round(eProf.basePushback * eMult * 0.7));
        session.player.health = Math.max(0, session.player.health - dmg);
        session.player.stamina = Math.max(0, session.player.stamina - 10);
        session.player.riposteReady = false;
        session.position = this.clampPosition(session.position - push);

        if (session.player.health <= 0 || session.position <= -100) {
          session.status = 'DEFEATED';
        }
        const msg = `${session.enemy.name}'s ${eProf.label} slips past thy parry (-${dmg} HP)!`;
        this.pushTicker(session, msg);

        return {
          playerAction,
          enemyAction,
          outcome:
            session.status === 'DEFEATED' ? 'PLAYER_DEFEATED' : 'ENEMY_HIT',
          playerDamageDealt: 0,
          enemyDamageDealt: dmg,
          positionDelta: -push,
          newPosition: session.position,
          riposteTriggered: false,
          riposteArmed: false,
          guardBroken: true,
          stageCleared: false,
          stageClearReason: 'NONE',
          missionStatus: session.status,
          calloutText:
            session.status === 'DEFEATED' ? 'DEFEATED!' : `GUARD PIERCED -${dmg}`,
          calloutColor: 'CRIMSON',
          summary: msg,
        };
      }
    }

    // ------------------------------------------------------------------------
    // CASE 3: PLAYER LAUNCHES AN OFFENSIVE STRIKE (HIGH, MID, LOW)
    // ------------------------------------------------------------------------
    const baseStamCost = this.getStaminaCost(
      pProf.baseStaminaCost,
      session.player.swordplay
    );
    const isFatigued = session.player.stamina < baseStamCost;
    session.player.stamina = Math.max(0, session.player.stamina - baseStamCost);
    session.enemy.stamina = Math.min(100, session.enemy.stamina + 6);

    const riposteActive = session.player.riposteReady;
    session.player.riposteReady = false; // Consumed on this swing

    const fatiguePenalty = isFatigued ? 0.65 : 1.0;
    const pMult = this.getDamageMultiplier(session.player.swordplay) * fatiguePenalty;
    const eMult = this.getDamageMultiplier(session.enemy.swordplay);

    // 3A. Riposte Strike ALWAYS pierces defense for 1.6x counter-damage & heavy pushback!
    if (riposteActive) {
      const riposteDmg = Math.max(
        10,
        Math.round(pProf.baseDamage * pMult * this.RIPOSTE_DAMAGE_MULT)
      );
      const ripostePush = Math.max(
        14,
        Math.round(pProf.basePushback * pMult * this.RIPOSTE_PUSH_MULT)
      );

      session.enemy.health = Math.max(0, session.enemy.health - riposteDmg);
      session.enemy.stamina = Math.max(0, session.enemy.stamina - 14);
      session.position = this.clampPosition(session.position + ripostePush);

      const stageCheck = this.checkAndHandleStageClear(session);
      const msg = `RIPOSTE! ${session.player.name}'s ${pProf.label} strikes true (-${riposteDmg} HP, +${ripostePush} push)!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome: stageCheck.cleared ? 'STAGE_CLEARED' : 'PLAYER_RIPOSTE_HIT',
        playerDamageDealt: riposteDmg,
        enemyDamageDealt: 0,
        positionDelta: ripostePush,
        newPosition: session.position,
        riposteTriggered: true,
        riposteArmed: false,
        guardBroken: true,
        stageCleared: stageCheck.cleared,
        stageClearReason: stageCheck.reason,
        missionStatus: session.status,
        calloutText: stageCheck.cleared
          ? `RIPOSTE VICTORY! -${riposteDmg}`
          : `RIPOSTE! -${riposteDmg}`,
        calloutColor: 'GOLD',
        summary: msg,
      };
    }

    // 3B. Enemy Parries Player's Non-Riposte Strike
    if (enemyAction === 'PARRY') {
      // ATTACK_LOW sweeps under high guard or breaks fatigued enemy guard!
      const breaksHighGuard =
        playerAction === 'ATTACK_LOW' &&
        (session.enemy.stamina < 35 || this.nextRandom(session) < 0.38 + session.player.swordplay * 0.03);

      if (breaksHighGuard) {
        const dmg = Math.max(8, Math.round(pProf.baseDamage * pMult * 1.15));
        const push = Math.max(12, Math.round(pProf.basePushback * pMult * 1.25));
        session.enemy.health = Math.max(0, session.enemy.health - dmg);
        session.position = this.clampPosition(session.position + push);
        const stageCheck = this.checkAndHandleStageClear(session);
        const msg = `${session.player.name}'s LOW SWEEP breaks ${session.enemy.name}'s guard (-${dmg} HP)!`;
        this.pushTicker(session, msg);

        return {
          playerAction,
          enemyAction,
          outcome: stageCheck.cleared ? 'STAGE_CLEARED' : 'PLAYER_GUARD_BREAK',
          playerDamageDealt: dmg,
          enemyDamageDealt: 0,
          positionDelta: push,
          newPosition: session.position,
          riposteTriggered: false,
          riposteArmed: false,
          guardBroken: true,
          stageCleared: stageCheck.cleared,
          stageClearReason: stageCheck.reason,
          missionStatus: session.status,
          calloutText: `GUARD BROKEN! -${dmg}`,
          calloutColor: 'EMERALD',
          summary: msg,
        };
      }

      // Enemy turns the blade aside
      const pushLoss = Math.max(3, Math.round(5 * eMult));
      session.position = this.clampPosition(session.position - pushLoss);
      const msg = `${session.enemy.name} parries thy ${pProf.label} with a shower of sparks!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome: 'ENEMY_PARRY',
        playerDamageDealt: 0,
        enemyDamageDealt: 0,
        positionDelta: -pushLoss,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken: false,
        stageCleared: false,
        stageClearReason: 'NONE',
        missionStatus: session.status,
        calloutText: 'ENEMY PARRIED!',
        calloutColor: 'SILVER',
        summary: msg,
      };
    }

    // 3C. Enemy Steps Back
    if (enemyAction === 'STEP_BACK') {
      const pushGain = Math.round(pProf.basePushback * pMult * 0.75);
      const grazeDmg =
        playerAction === 'ATTACK_MID'
          ? Math.max(5, Math.round(pProf.baseDamage * pMult * 0.55))
          : 0;
      session.enemy.health = Math.max(0, session.enemy.health - grazeDmg);
      session.enemy.stamina = Math.min(100, session.enemy.stamina + 22);
      session.position = this.clampPosition(session.position + pushGain);

      const stageCheck = this.checkAndHandleStageClear(session);
      const msg =
        grazeDmg > 0
          ? `${session.player.name}'s MID THRUST catches retreating ${session.enemy.name} (-${grazeDmg} HP, +${pushGain} ground)!`
          : `${session.enemy.name} gives ground before thy ${pProf.label} (+${pushGain} ground)!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome: stageCheck.cleared ? 'STAGE_CLEARED' : 'PLAYER_HIT',
        playerDamageDealt: grazeDmg,
        enemyDamageDealt: 0,
        positionDelta: pushGain,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken: false,
        stageCleared: stageCheck.cleared,
        stageClearReason: stageCheck.reason,
        missionStatus: session.status,
        calloutText: stageCheck.cleared
          ? 'CORNERED! YIELD!'
          : grazeDmg > 0
          ? `LUNGE HIT! -${grazeDmg}`
          : `PRESSED BACK +${pushGain}`,
        calloutColor: 'EMERALD',
        summary: msg,
      };
    }

    // 3D. Simultaneous Blade Clash / Counter-Strike Matchup Matrix!
    // Tactical RPS + Speed + Swordplay Scaling:
    // - ATTACK_LOW ducks under ATTACK_HIGH (breaks high cleave!)
    // - ATTACK_MID outspeeds ATTACK_HIGH (lunge lands first!)
    // - ATTACK_HIGH crushes ATTACK_LOW? Wait: Let's keep a clean, fair tactical triangle:
    //   * ATTACK_LOW beats ATTACK_HIGH (ducks under high swing & sweeps legs!)
    //   * ATTACK_MID beats ATTACK_LOW (quick thrust stops crouching sweep!)
    //   * ATTACK_HIGH overpowers ATTACK_MID? Wait: Spec says:
    //     - ATTACK_HIGH: Overhead cleave: high damage, medium speed
    //     - ATTACK_MID: Quick lunge thrust: fast speed, balanced damage & pushback
    //     - ATTACK_LOW: Sweeping low cut: breaks high guard, strong footing pushback
    //   Let's check:
    //     * LOW vs HIGH -> LOW ducks under HIGH (+30% tactical edge & +25% pushback!)
    //     * MID vs HIGH -> MID's fast speed (1.30 vs 1.00) beats slow overhead cleave!
    //     * HIGH vs LOW (when HIGH anticipates crouch? No, LOW ducks HIGH; let HIGH crush MID guard binds or deal heaviest raw damage on open hits, while MID beats LOW on speed!).
    let playerTacticalEdge = 0;
    let guardBroken = false;

    if (playerAction === 'ATTACK_LOW' && enemyAction === 'ATTACK_HIGH') {
      playerTacticalEdge += 0.42;
      guardBroken = true;
    } else if (enemyAction === 'ATTACK_LOW' && playerAction === 'ATTACK_HIGH') {
      playerTacticalEdge -= 0.38;
    } else if (playerAction === 'ATTACK_MID' && enemyAction === 'ATTACK_HIGH') {
      playerTacticalEdge += 0.28;
    } else if (enemyAction === 'ATTACK_MID' && playerAction === 'ATTACK_HIGH') {
      playerTacticalEdge -= 0.24;
    } else if (playerAction === 'ATTACK_HIGH' && enemyAction === 'ATTACK_MID' && !wasTelegraphed) {
      // Heavy overhead cleave launched proactively has momentum
      playerTacticalEdge += 0.08;
    }

    const pSpeed = this.getEffectiveSpeed(playerAction, session.player.swordplay);
    const eSpeed = this.getEffectiveSpeed(enemyAction, session.enemy.swordplay);
    const speedDiff = pSpeed - eSpeed;

    // Same-zone simultaneous strike results in a ringing STEEL BIND (stronger swordplay wins footing!)
    if (pProf.zone === eProf.zone) {
      const bindScore =
        (session.player.swordplay - session.enemy.swordplay) * 2.4 +
        (this.nextRandom(session) - 0.5) * 6;
      const bindPush = Math.round(
        Math.max(-14, Math.min(16, bindScore >= 0 ? 8 + bindScore : -7 + bindScore))
      );
      session.position = this.clampPosition(session.position + bindPush);

      if (session.position <= -100) {
        session.status = 'DEFEATED';
      }
      const stageCheck = this.checkAndHandleStageClear(session);
      const wonBind = bindPush >= 0;
      const msg = wonBind
        ? `CLANG! Blades lock at ${pProf.zone} — ${session.player.name} forces ${session.enemy.name} back (+${bindPush})!`
        : `CLANG! Blades lock at ${pProf.zone} — ${session.enemy.name} shoves thee back (${bindPush})!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome: stageCheck.cleared
          ? 'STAGE_CLEARED'
          : session.status === 'DEFEATED'
          ? 'PLAYER_DEFEATED'
          : 'BLADE_BIND',
        playerDamageDealt: 0,
        enemyDamageDealt: 0,
        positionDelta: bindPush,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken: false,
        stageCleared: stageCheck.cleared,
        stageClearReason: stageCheck.reason,
        missionStatus: session.status,
        calloutText: stageCheck.cleared
          ? 'FORCED TO YIELD!'
          : wonBind
          ? `BLADE BIND! +${bindPush}`
          : `SHOVED BACK ${bindPush}`,
        calloutColor: wonBind ? 'SILVER' : 'CRIMSON',
        summary: msg,
      };
    }

    const winScore =
      playerTacticalEdge +
      speedDiff * 0.85 +
      (this.getStrikeAccuracy(session.player.swordplay) -
        this.getStrikeAccuracy(session.enemy.swordplay)) +
      (this.nextRandom(session) - 0.46) * 0.45;

    if (winScore >= 0) {
      // PLAYER LANDS THE STRIKE!
      const bonusMult = guardBroken ? 1.22 : 1.0;
      const dmg = Math.max(
        6,
        Math.round(pProf.baseDamage * pMult * bonusMult)
      );
      const push = Math.max(
        8,
        Math.round(pProf.basePushback * pMult * (guardBroken ? 1.25 : 1.0))
      );

      session.enemy.health = Math.max(0, session.enemy.health - dmg);
      session.enemy.stamina = Math.max(0, session.enemy.stamina - 10);
      session.position = this.clampPosition(session.position + push);

      const stageCheck = this.checkAndHandleStageClear(session);
      const msg = guardBroken
        ? `${session.player.name} ducks under & sweeps ${session.enemy.name} (-${dmg} HP, +${push} push)!`
        : `${session.player.name}'s ${pProf.label} strikes ${session.enemy.name} (-${dmg} HP, +${push} push)!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome: stageCheck.cleared
          ? 'STAGE_CLEARED'
          : guardBroken
          ? 'PLAYER_GUARD_BREAK'
          : 'PLAYER_HIT',
        playerDamageDealt: dmg,
        enemyDamageDealt: 0,
        positionDelta: push,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken,
        stageCleared: stageCheck.cleared,
        stageClearReason: stageCheck.reason,
        missionStatus: session.status,
        calloutText: stageCheck.cleared
          ? session.enemy.health <= 0
            ? `VANQUISHED! -${dmg}`
            : 'YIELD AT SWORD-POINT!'
          : guardBroken
          ? `LOW COUNTER! -${dmg}`
          : `HIT! -${dmg}`,
        calloutColor: guardBroken ? 'GOLD' : 'EMERALD',
        summary: msg,
      };
    } else {
      // ENEMY BEATS PLAYER TO THE TOUCH!
      const eStamCost = this.getStaminaCost(
        eProf.baseStaminaCost,
        session.enemy.swordplay
      );
      session.enemy.stamina = Math.max(0, session.enemy.stamina - eStamCost);

      const dmg = Math.max(5, Math.round(eProf.baseDamage * eMult));
      const push = Math.max(6, Math.round(eProf.basePushback * eMult));

      session.player.health = Math.max(0, session.player.health - dmg);
      session.position = this.clampPosition(session.position - push);

      if (session.player.health <= 0 || session.position <= -100) {
        session.status = 'DEFEATED';
      }

      const msg =
        session.status === 'DEFEATED'
          ? `${session.enemy.name}'s ${eProf.label} corners ${session.player.name} — Guards seize thee!`
          : `${session.enemy.name} counters with ${eProf.label} (-${dmg} HP, -${push} footing)!`;
      this.pushTicker(session, msg);

      return {
        playerAction,
        enemyAction,
        outcome:
          session.status === 'DEFEATED' ? 'PLAYER_DEFEATED' : 'ENEMY_HIT',
        playerDamageDealt: 0,
        enemyDamageDealt: dmg,
        positionDelta: -push,
        newPosition: session.position,
        riposteTriggered: false,
        riposteArmed: false,
        guardBroken: false,
        stageCleared: false,
        stageClearReason: 'NONE',
        missionStatus: session.status,
        calloutText:
          session.status === 'DEFEATED' ? 'CAPTURED!' : `COUNTERED! -${dmg}`,
        calloutColor: 'CRIMSON',
        summary: msg,
      };
    }
  }

  /**
   * Advances from Stage 1 -> Stage 2 -> Stage 3 after defeating or forcing the current opponent to yield.
   * Restores partial vigor & stamina as the hero charges up the torchlit stairs.
   */
  public static advanceToNextStage(session: SwordplaySession): boolean {
    if (session.status !== 'ACTIVE') {
      return false;
    }
    if (session.stageNumber >= 3) {
      session.status = 'VICTORY';
      return false;
    }

    session.stageNumber = (session.stageNumber + 1) as SwordplayStageNumber;
    const nextStage = session.stages[session.stageNumber - 1];

    session.enemy = { ...nextStage.defender };
    session.position = 0;
    session.telegraphedEnemyAction = null;
    session.telegraphZone = null;
    session.telegraphDurationMs = nextStage.telegraphBaseMs;

    // Breather recovery between castle rooms
    session.player.health = Math.min(
      session.player.maxHealth,
      session.player.health + 32
    );
    session.player.stamina = Math.min(
      session.player.maxStamina,
      session.player.stamina + 60
    );
    session.player.riposteReady = false;

    this.pushTicker(
      session,
      `${nextStage.stageHeader} — ${session.enemy.name} draws steel!`
    );
    return true;
  }

  /**
   * Safely aborts the raid before being defeated, escaping into the night with 0 Gold stolen & 0 Ransom paid.
   */
  public static fleeCastle(session: SwordplaySession): void {
    if (session.status !== 'ACTIVE') return;
    session.status = 'FLED';
    session.telegraphedEnemyAction = null;
    session.telegraphZone = null;
    this.pushTicker(
      session,
      `${session.player.name} leaps through a castle casement and vanishes into the night!`
    );
  }

  // ==========================================================================
  // 4. AUTO-DUEL AI (Uses Player's swordplay stat)
  // ==========================================================================

  /**
   * Executes one intelligent fencing exchange on behalf of the Player Lord,
   * scaled by the Player's `swordplay` stat.
   */
  public static stepAutoDuelExchange(
    session: SwordplaySession
  ): SwordplayExchangeReport {
    if (session.status !== 'ACTIVE') {
      return this.buildIdleReport(session);
    }

    // 50% of exchanges begin with an enemy wind-up telegraph to create authentic parry/riposte rhythm
    if (!session.telegraphedEnemyAction && this.nextRandom(session) < 0.55) {
      this.beginEnemyTelegraph(session);
    }

    const pSkill = session.player.swordplay;
    let chosenAction: SwordplayAction;

    if (session.player.riposteReady) {
      // Unleash devastating 1.6x Riposte!
      chosenAction =
        session.enemy.stance === 'HIGH' ? 'ATTACK_LOW' : 'ATTACK_HIGH';
    } else if (session.player.stamina < 18 && session.position > -65) {
      chosenAction = 'STEP_BACK';
    } else if (session.telegraphedEnemyAction) {
      // Read the enemy telegraph based on swordplay skill (stat 9 reads ~88%, stat 3 reads ~46%)
      const readChance = 0.25 + pSkill * 0.07;
      if (this.nextRandom(session) < readChance) {
        if (
          session.telegraphedEnemyAction === 'ATTACK_HIGH' &&
          this.nextRandom(session) < 0.35
        ) {
          chosenAction = 'ATTACK_LOW'; // Duck & sweep!
        } else {
          // Match stance for guaranteed crisp parry -> riposte!
          if (session.telegraphZone) {
            session.player.stance = session.telegraphZone;
          }
          chosenAction = 'PARRY';
        }
      } else {
        chosenAction = 'ATTACK_MID';
      }
    } else {
      const r = this.nextRandom(session);
      if (r < 0.4) chosenAction = 'ATTACK_MID';
      else if (r < 0.72) chosenAction = 'ATTACK_LOW';
      else chosenAction = 'ATTACK_HIGH';
    }

    const report = this.executeExchange(session, chosenAction, {
      inTelegraphWindow: Boolean(session.telegraphedEnemyAction),
    });

    if (report.stageCleared && session.status === 'ACTIVE') {
      this.advanceToNextStage(session);
    }

    return report;
  }

  /**
   * Resolves an entire 3-stage Castle Raid or Damsel Rescue to completion using Auto-Duel.
   */
  public static resolveMissionToCompletion(
    session: SwordplaySession,
    maxExchanges = 200
  ): SwordplayMissionStatus {
    let safety = 0;
    while (session.status === 'ACTIVE' && safety < maxExchanges) {
      safety += 1;
      this.stepAutoDuelExchange(session);
    }
    return session.status;
  }

  // ==========================================================================
  // 5. CAMPAIGN OUTCOME COMMITMENT (RAID GOLD / RANSOM / ROBIN HOOD / MARRIAGE)
  // ==========================================================================

  /**
   * Commits a finished SwordplaySession to GameState singleton.
   */
  public static commitMissionOutcome(
    session: SwordplaySession,
    gameState: GameState = GameState.getInstance(),
    options?: { useRobinHoodBailout?: boolean }
  ): SwordplayOutcomeSummary {
    return gameState.mutateState((state) =>
      this.commitOutcomeOnState(state, session, options)
    );
  }

  /**
   * Pure CampaignState mutator for committing Raid / Rescue outcomes.
   */
  public static commitOutcomeOnState(
    state: CampaignState,
    session: SwordplaySession,
    options?: { useRobinHoodBailout?: boolean }
  ): SwordplayOutcomeSummary {
    if (session.committed && session.committedSummary) {
      return session.committedSummary;
    }

    const attacker = state.activeLords[session.attackerId];
    const targetLord = state.activeLords[session.targetLordId];

    state.phase = 'CAMPAIGN_MAP';
    if (session.missionType === 'RAID') {
      state.hasRaidedThisTurn = true;
    }

    let goldStolenTotal = 0;
    let goldTakenFromLord = 0;
    let vaultBonusGold = 0;
    let ransomPaid = 0;
    let robinHoodBailoutUsed = false;
    let leadershipGained = 0;
    let secondaryStatName: 'jousting' | 'swordplay' | undefined;
    let secondaryStatGained = 0;
    let rescuedDamsel: SaxonDamsel | undefined;
    let marriedDamsel = false;
    let headline = '';
    let chronicleMessage = '';

    // ------------------------------------------------------------------------
    // OUTCOME A: VICTORY!
    // ------------------------------------------------------------------------
    if (session.status === 'VICTORY') {
      if (session.missionType === 'RAID') {
        const loot = this.calculateRaidLoot(targetLord ? targetLord.gold : 0);
        goldStolenTotal = loot.totalGoldStolen;
        goldTakenFromLord = loot.takenFromLord;
        vaultBonusGold = loot.vaultBonusGold;

        if (targetLord) {
          targetLord.gold = Math.max(0, targetLord.gold - goldTakenFromLord);
        }
        if (attacker) {
          attacker.gold += goldStolenTotal;
        }

        headline = 'TREASURY VAULT PLUNDERED!';
        chronicleMessage = `${attacker?.name ?? 'Saxon Hero'} raided ${
          session.targetTerritoryName
        } and plundered +${goldStolenTotal} Gold from ${
          targetLord?.name ?? 'the vault'
        }!`;
      } else {
        // RESCUE VICTORY: Dowry (+15G) + Permanent Leadership (+1) + Secondary Stat (+1)!
        const damsel =
          session.damsel ??
          (session.damselId ? SAXON_DAMSELS[session.damselId] : SAXON_DAMSELS.rowena);
        rescuedDamsel = damsel;

        goldStolenTotal = damsel.dowryGold;
        if (attacker) {
          attacker.gold += damsel.dowryGold;

          const prevLead = attacker.leadership;
          attacker.leadership = Math.min(10, attacker.leadership + damsel.leadershipBonus);
          leadershipGained = attacker.leadership - prevLead;

          secondaryStatName = damsel.secondaryStat;
          const prevSec = attacker[damsel.secondaryStat];
          attacker[damsel.secondaryStat] = Math.min(
            10,
            attacker[damsel.secondaryStat] + damsel.secondaryBonus
          );
          secondaryStatGained = attacker[damsel.secondaryStat] - prevSec;
        }

        if (!state.rescuedDamselIds.includes(damsel.id)) {
          state.rescuedDamselIds.push(damsel.id);
        }
        if (!state.marriedDamselId) {
          state.marriedDamselId = damsel.id;
          marriedDamsel = true;
        }
        state.captiveDamsel = null;

        headline = marriedDamsel
          ? `ESPOUSED TO ${damsel.name.toUpperCase()}!`
          : `${damsel.name.toUpperCase()} RESCUED!`;
        chronicleMessage = `${attacker?.name ?? 'Saxon Hero'} rescued ${
          damsel.name
        } from ${session.targetTerritoryName}! (+${damsel.dowryGold}G dowry, +${leadershipGained} Leadership, +${secondaryStatGained} ${
          damsel.secondaryStat === 'jousting' ? 'Jousting' : 'Swordplay'
        })`;
      }
    }
    // ------------------------------------------------------------------------
    // OUTCOME B: DEFEATED & CORNERED BY GUARDS!
    // ------------------------------------------------------------------------
    else if (session.status === 'DEFEATED') {
      if (session.missionType === 'RESCUE') {
        state.captiveDamsel = null;
      }

      if (options?.useRobinHoodBailout && state.robinHoodUsesLeft > 0) {
        state.robinHoodUsesLeft -= 1;
        robinHoodBailoutUsed = true;
        ransomPaid = 0;

        headline = 'ROBIN HOOD DUNGEON BREAKOUT!';
        chronicleMessage = `Robin Hood's Merry Men stormed ${
          session.targetTerritoryName
        }'s dungeon and rescued ${attacker?.name ?? 'thee'} for 0 Gold lost! (${
          state.robinHoodUsesLeft
        }/3 favors left)`;
      } else {
        ransomPaid = this.calculateDefeatRansom(attacker ? attacker.gold : 0);
        if (attacker) {
          attacker.gold = Math.max(0, attacker.gold - ransomPaid);
        }
        if (targetLord) {
          targetLord.gold += ransomPaid;
        }

        headline = 'CAPTURED IN THE KEEP!';
        chronicleMessage = `${attacker?.name ?? 'Saxon Hero'} was captured in ${
          session.targetTerritoryName
        } and paid ${ransomPaid} Gold ransom to ${
          targetLord?.name ?? 'the castle lord'
        }!`;
      }
    }
    // ------------------------------------------------------------------------
    // OUTCOME C: FLED CASTLE SAFELY
    // ------------------------------------------------------------------------
    else {
      headline = 'ESCAPED INTO THE NIGHT';
      chronicleMessage = `${
        attacker?.name ?? 'Saxon Hero'
      } slipped over the battlements of ${
        session.targetTerritoryName
      } unharmed.`;
    }

    state.log.push(chronicleMessage);
    if (state.log.length > 50) {
      state.log = state.log.slice(-50);
    }

    const summary: SwordplayOutcomeSummary = {
      missionType: session.missionType,
      status: session.status,
      attackerId: session.attackerId,
      targetLordId: session.targetLordId,
      targetLordName: session.targetLordName,
      targetTerritoryId: session.targetTerritoryId,
      targetTerritoryName: session.targetTerritoryName,
      stagesCleared: session.stagesCleared,
      goldStolenTotal,
      goldTakenFromLord,
      vaultBonusGold,
      ransomPaid,
      robinHoodBailoutUsed,
      robinHoodUsesRemaining: state.robinHoodUsesLeft,
      rescuedDamsel,
      marriedDamsel,
      leadershipGained,
      secondaryStatName,
      secondaryStatGained,
      headline,
      chronicleMessage,
    };

    session.committed = true;
    session.committedSummary = summary;
    return summary;
  }

  // ==========================================================================
  // INTERNAL HELPERS
  // ==========================================================================

  private static checkAndHandleStageClear(session: SwordplaySession): {
    cleared: boolean;
    reason: 'NONE' | 'HEALTH_DEPLETED' | 'FORCED_YIELD';
  } {
    if (session.enemy.health <= 0 || session.position >= 100) {
      const reason =
        session.enemy.health <= 0 ? 'HEALTH_DEPLETED' : 'FORCED_YIELD';
      session.stagesCleared = Math.max(
        session.stagesCleared,
        session.stageNumber
      );

      if (session.stageNumber >= 3) {
        session.status = 'VICTORY';
        const winLine =
          reason === 'FORCED_YIELD'
            ? `${session.enemy.name} is driven to the wall and yields at sword-point! VICTORY!`
            : `${session.enemy.name} falls defeated! The castle chamber is thine!`;
        this.pushTicker(session, winLine);
      } else {
        const yieldLine =
          reason === 'FORCED_YIELD'
            ? `${session.enemy.name} yields at sword-point! Onward up the stairs!`
            : `${session.enemy.name} is vanquished! Advancing to the next chamber!`;
        this.pushTicker(session, yieldLine);
      }

      return { cleared: true, reason };
    }

    return { cleared: false, reason: 'NONE' };
  }

  private static chooseEnemyReactiveAction(
    session: SwordplaySession,
    playerAction: SwordplayAction
  ): SwordplayAction {
    const eSkill = session.enemy.swordplay;
    const roll = this.nextRandom(session);

    if (session.enemy.stamina < 16 && session.position < 75 && roll < 0.45) {
      return 'STEP_BACK';
    }

    // Skilled castle defenders parry predictable swings more often
    const parryProb = 0.14 + eSkill * 0.032;
    if (
      playerAction !== 'PARRY' &&
      playerAction !== 'STEP_BACK' &&
      roll < parryProb
    ) {
      return 'PARRY';
    }

    const r2 = this.nextRandom(session);
    if (r2 < 0.36) return 'ATTACK_HIGH';
    if (r2 < 0.72) return 'ATTACK_MID';
    return 'ATTACK_LOW';
  }

  private static clampPosition(pos: number): number {
    return Math.max(-100, Math.min(100, Math.round(pos)));
  }

  private static pushTicker(session: SwordplaySession, line: string): void {
    session.tickerLog.push(line);
    if (session.tickerLog.length > 20) {
      session.tickerLog = session.tickerLog.slice(-20);
    }
  }

  private static buildIdleReport(
    session: SwordplaySession
  ): SwordplayExchangeReport {
    return {
      playerAction: 'PARRY',
      enemyAction: 'PARRY',
      outcome: 'BLADE_BIND',
      playerDamageDealt: 0,
      enemyDamageDealt: 0,
      positionDelta: 0,
      newPosition: session.position,
      riposteTriggered: false,
      riposteArmed: session.player.riposteReady,
      guardBroken: false,
      stageCleared: false,
      stageClearReason: 'NONE',
      missionStatus: session.status,
      calloutText: '',
      calloutColor: 'SILVER',
      summary: 'Encounter concluded.',
    };
  }

  private static nextRandom(session: SwordplaySession): number {
    if (!session.deterministic) {
      return Math.random();
    }
    // Mulberry32 deterministic PRNG
    let t = (session.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
