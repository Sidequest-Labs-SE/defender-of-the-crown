import {
  ActionResult,
  Army,
  BattleOutcomeStatus,
  BattleResult,
  BattleSide,
  BattleTactic,
  CampaignState,
  PendingBattleContext,
  SiegeOutcomeModifiers,
} from './types';
import { CombatResolver } from './CombatResolver';
import { GameState } from './GameState';

export interface TacticProfile {
  id: BattleTactic;
  label: string;
  shortLabel: string;
  hotkey: string;
  offenseMult: number;
  vulnerabilityMult: number;
  basePush: number;
  requiresKnights: boolean;
  description: string;
}

export const TACTIC_PROFILES: Record<BattleTactic, TacticProfile> = {
  FEROCIOUS_ATTACK: {
    id: 'FEROCIOUS_ATTACK',
    label: 'FEROCIOUS ATTACK',
    shortLabel: 'FEROCIOUS',
    hotkey: '1',
    offenseMult: 1.35,
    vulnerabilityMult: 1.3,
    basePush: 9,
    requiresKnights: false,
    description: '+35% Attack, +30% Vulnerability. Pushes frontline aggressively.',
  },
  NORMAL_ATTACK: {
    id: 'NORMAL_ATTACK',
    label: 'NORMAL ATTACK',
    shortLabel: 'NORMAL',
    hotkey: '2',
    offenseMult: 1.0,
    vulnerabilityMult: 1.0,
    basePush: 4,
    requiresKnights: false,
    description: 'Balanced melee engagement (1.0x Offense, 1.0x Defense).',
  },
  CAUTIOUS_ATTACK: {
    id: 'CAUTIOUS_ATTACK',
    label: 'CAUTIOUS ATTACK',
    shortLabel: 'CAUTIOUS',
    hotkey: '3',
    offenseMult: 0.75,
    vulnerabilityMult: 0.75,
    basePush: 2,
    requiresKnights: false,
    description: '-25% Offense, -25% Casualties Taken. Wears down braced lines.',
  },
  STAND_AND_FIGHT: {
    id: 'STAND_AND_FIGHT',
    label: 'STAND & FIGHT',
    shortLabel: 'STAND & FIGHT',
    hotkey: '4',
    offenseMult: 0.85,
    vulnerabilityMult: 0.65,
    basePush: 0,
    requiresKnights: false,
    description: '+35% Defense, 0 Push. Repels Ferocious & Outflank charges!',
  },
  OUTFLANK: {
    id: 'OUTFLANK',
    label: 'OUTFLANK',
    shortLabel: 'OUTFLANK',
    hotkey: '5',
    offenseMult: 1.25,
    vulnerabilityMult: 1.05,
    basePush: 11,
    requiresKnights: true,
    description: 'Requires Knights > 0! Strikes enemy Knights/Catapults & shocks morale.',
  },
};

export const ALL_BATTLE_TACTICS: BattleTactic[] = [
  'FEROCIOUS_ATTACK',
  'NORMAL_ATTACK',
  'CAUTIOUS_ATTACK',
  'STAND_AND_FIGHT',
  'OUTFLANK',
];

export interface ManeuverMatchupEvaluation {
  offenseMult: number;
  vulnerabilityMult: number;
  momentumBonus: number;
  flankBypassSuccess: boolean;
  flankCountered: boolean;
  matchupNote: string | null;
}

export interface BattleTickReport {
  tick: number;
  attackerTactic: BattleTactic;
  defenderTactic: BattleTactic;
  attackerLosses: Army;
  defenderLosses: Army;
  attackerDamageDealt: number;
  defenderDamageDealt: number;
  attackerCatapultFired: boolean;
  defenderCatapultFired: boolean;
  attackerArcherVolleyFired?: boolean;
  defenderArcherVolleyFired?: boolean;
  attackerFlankSuccess: boolean;
  defenderFlankSuccess: boolean;
  attackerFlankCountered: boolean;
  defenderFlankCountered: boolean;
  momentumBefore: number;
  momentumAfter: number;
  momentumDelta: number;
  aiChangedTacticTo: BattleTactic | null;
  events: string[];
  status: BattleOutcomeStatus;
}

export interface BattleSession {
  attackerId: string;
  attackerName: string;
  attackerFaction: 'saxon' | 'norman';
  attackerLeadership: number;
  defenderId: string | null;
  defenderName: string;
  defenderFaction: 'saxon' | 'norman';
  baseDefenderLeadership: number;
  defenderLeadership: number;
  territoryId: string;
  territoryName: string;
  originTerritoryId: string;
  originTerritoryName: string;
  isCastleAssault: boolean;
  hasCastleDefense: boolean;
  wallIntegrity: number;
  castleDefenseMult: number;
  wallBreached: boolean;
  isPlagueInfected: boolean;
  isOnFire: boolean;
  isHomeCastle: boolean;
  isDefenderFieldArmyPresent: boolean;
  playerSide: BattleSide | null;
  aiSide: BattleSide | null;

  campaignInitialAttackerArmy: Army;
  campaignInitialDefenderTotal: Army;

  initialAttackerArmy: Army;
  initialDefenderGarrison: Army;
  initialDefenderFieldArmy: Army;
  initialDefenderTotal: Army;

  attackerArmy: Army;
  defenderArmy: Army;

  attackerTactic: BattleTactic;
  defenderTactic: BattleTactic;

  /** -100 (Defender dominant) .. 0 (Center) .. +100 (Attacker dominant) */
  momentum: number;
  tick: number;
  ticksWithoutCasualty: number;
  status: BattleOutcomeStatus;
  committed: boolean;
  deterministic: boolean;
  rngState: number;

  // Fractional casualty accumulators (Soldier=1, Knight=6, Catapult=9, Archer=3)
  attackerDamagePools: { soldiers: number; knights: number; catapults: number; archers?: number };
  defenderDamagePools: { soldiers: number; knights: number; catapults: number; archers?: number };

  retreatPenaltyLosses: Army;
  tickerLog: string[];
  lastTickReport: BattleTickReport | null;
  committedResult: BattleResult | null;
  attackerHasHastingsHorn?: boolean;
  attackerHasYewBow?: boolean;
}

export interface CreateBattleSessionOptions {
  deterministic?: boolean;
  seed?: number;
}

/**
 * BattleEngine (Sprint 3 Pure Tactical Field Battle Simulator)
 * Zero Phaser dependencies — handles maneuver RPS counters, Leadership & Castle modifiers,
 * Knight Outflanking, Catapult bombardment, Momentum, AI Commander adaptation, Retreat, and State Commit.
 */
export class BattleEngine {
  public static readonly BASE_TICK_LETHALITY = 0.175;
  public static readonly RETREAT_PENALTY_RATE = 0.15;
  public static readonly CASTLE_DEFENSE_MULT = 1.25;

  /**
   * Computes Leadership combat multiplier: 1 + leadership * 0.05
   */
  public static getLeadershipMultiplier(leadership: number): number {
    return Number((1 + Math.max(0, leadership) * 0.05).toFixed(4));
  }

  /**
   * Computes dynamic Castle Fortification Multiplier scaled by remaining wallIntegrity:
   * Standard Castle: 1.0 + 0.25 * (wallIntegrity / 100) -> 1.25x (+25%)
   * Royal Keep: 1.0 + 0.40 * (wallIntegrity / 150) -> 1.40x (+40%)
   */
  public static getCastleDefenseMultiplier(
    wallIntegrity: number,
    hasCastle = true,
    isRoyalKeep = false
  ): number {
    if (!hasCastle) return 1.0;
    const maxIntegrity = isRoyalKeep ? 150 : 100;
    const clamped = Math.max(0, Math.min(maxIntegrity, wallIntegrity));
    const bonus = isRoyalKeep ? 0.4 : 0.25;
    return Number((1.0 + bonus * (clamped / maxIntegrity)).toFixed(4));
  }

  /**
   * Checks whether an Army is allowed to select a specific BattleTactic.
   */
  public static canUseTactic(army: Pick<Army, 'knights'>, tactic: BattleTactic): boolean {
    if (tactic === 'OUTFLANK') {
      return army.knights > 0;
    }
    return true;
  }

  /**
   * Validates whether an invasion can proceed to BattleScene (including Catapult Castle check).
   */
  public static canInitiateBattle(
    state: CampaignState,
    attackerLordId: string,
    targetTerritoryId: string
  ): ActionResult {
    const attacker = state.activeLords[attackerLordId];
    const territory = state.territories[targetTerritoryId];

    if (!attacker || !territory) {
      return { success: false, message: 'Invalid attacker or target territory.' };
    }

    if (attacker.campaignArmy.soldiers <= 0 && attacker.campaignArmy.knights <= 0) {
      return {
        success: false,
        message: 'Moving requires at least 1 combat unit (Soldier or Knight) in the Campaign Army!',
      };
    }

    if (territory.hasCastle && attacker.campaignArmy.catapults <= 0) {
      return {
        success: false,
        message: CombatResolver.CASTLE_SIEGE_BLOCK_MSG,
      };
    }

    return { success: true, message: 'Battle ready.' };
  }

  /**
   * Evaluates the tactical Rock-Paper-Scissors matchup for one side against the opponent's active tactic.
   */
  public static evaluateManeuverMatchup(
    myTactic: BattleTactic,
    oppTactic: BattleTactic,
    myKnights: number,
    oppKnights: number
  ): ManeuverMatchupEvaluation {
    const base = TACTIC_PROFILES[myTactic];
    let offenseMult = base.offenseMult;
    let vulnerabilityMult = base.vulnerabilityMult;
    let momentumBonus = base.basePush;
    let flankBypassSuccess = false;
    let flankCountered = false;
    let matchupNote: string | null = null;

    if (myTactic === 'OUTFLANK') {
      if (myKnights <= 0) {
        // Fallback safety if called with 0 knights
        return {
          offenseMult: 1.0,
          vulnerabilityMult: 1.0,
          momentumBonus: 3,
          flankBypassSuccess: false,
          flankCountered: false,
          matchupNote: null,
        };
      }

      if (oppTactic === 'STAND_AND_FIGHT') {
        // Countered hard by braced spears!
        flankCountered = true;
        offenseMult = 0.85;
        vulnerabilityMult = 1.4;
        momentumBonus = -4;
        matchupNote = 'Outflank charge repelled by braced Stand & Fight spear-wall!';
      } else if (oppTactic === 'OUTFLANK') {
        if (myKnights > oppKnights) {
          flankBypassSuccess = true;
          offenseMult += 0.25;
          vulnerabilityMult -= 0.15;
          momentumBonus += 10;
          matchupNote = 'Superior Knights crush enemy flankers!';
        } else if (myKnights < oppKnights) {
          flankCountered = true;
          offenseMult -= 0.3;
          vulnerabilityMult += 0.3;
          momentumBonus = -4;
          matchupNote = 'Outnumbered Knights overwhelmed on the flank!';
        } else {
          offenseMult += 0.1;
          momentumBonus += 4;
          matchupNote = 'Cavalry squadrons collide fiercely on the flanks!';
        }
      } else {
        // Successful cavalry outflank!
        flankBypassSuccess = true;
        if (oppTactic === 'FEROCIOUS_ATTACK') {
          offenseMult += 0.22;
          momentumBonus += 7;
          matchupNote = 'Knights outflank exposed Ferocious Attack formation!';
        } else {
          offenseMult += 0.12;
          momentumBonus += 5;
          matchupNote = 'Knights sweep around the flank to strike rear ranks!';
        }
      }
    } else if (myTactic === 'STAND_AND_FIGHT') {
      if (oppTactic === 'FEROCIOUS_ATTACK') {
        offenseMult += 0.3; // 1.15x counter-strike
        vulnerabilityMult -= 0.15; // 0.50x incoming damage
        momentumBonus += 9;
        matchupNote = 'Stand & Fight shield-wall shatters Ferocious charge!';
      } else if (oppTactic === 'OUTFLANK' && oppKnights > 0) {
        offenseMult += 0.3; // 1.15x anti-cavalry counter
        vulnerabilityMult -= 0.12; // 0.53x incoming damage
        momentumBonus += 10;
        matchupNote = 'Braced pikes impale enemy Outflank cavalry!';
      }
    } else if (myTactic === 'CAUTIOUS_ATTACK') {
      if (oppTactic === 'STAND_AND_FIGHT') {
        offenseMult += 0.22; // 0.97x methodical pressure while taking only 0.65x dmg
        vulnerabilityMult -= 0.1;
        momentumBonus += 5;
        matchupNote = 'Cautious advance methodically grinds down static defenders!';
      }
    } else if (myTactic === 'FEROCIOUS_ATTACK') {
      if (oppTactic === 'CAUTIOUS_ATTACK') {
        offenseMult += 0.15; // 1.50x breakthrough
        momentumBonus += 5;
        matchupNote = 'Ferocious onslaught overwhelms Cautious line!';
      }
    }

    return {
      offenseMult: Number(Math.max(0.4, offenseMult).toFixed(4)),
      vulnerabilityMult: Number(Math.max(0.4, vulnerabilityMult).toFixed(4)),
      momentumBonus,
      flankBypassSuccess,
      flankCountered,
      matchupNote,
    };
  }

  /**
   * Initializes a new pure tactical BattleSession from CampaignState and PendingBattleContext.
   */
  public static createBattleSession(
    state: CampaignState,
    context: Pick<PendingBattleContext, 'attackerId' | 'territoryId'> & {
      originTerritoryId?: string;
      siege?: SiegeOutcomeModifiers;
    },
    options?: CreateBattleSessionOptions
  ): BattleSession {
    const attacker = state.activeLords[context.attackerId];
    const territory = state.territories[context.territoryId];

    if (!attacker || !territory) {
      throw new Error(
        `Invalid BattleSession parameters: attacker=${context.attackerId}, territory=${context.territoryId}`
      );
    }

    if (territory.hasCastle && !context.siege && attacker.campaignArmy.catapults <= 0) {
      throw new Error(CombatResolver.CASTLE_SIEGE_BLOCK_MSG);
    }

    const originId = context.originTerritoryId ?? attacker.currentTerritoryId;
    const originTerritory = state.territories[originId];

    const defender = territory.ownerId ? state.activeLords[territory.ownerId] : undefined;
    const isDefenderFieldArmyPresent = Boolean(
      defender &&
        defender.isActive &&
        !defender.isDefeated &&
        defender.currentTerritoryId === territory.id
    );

    const campaignInitAttacker: Army = {
      soldiers: attacker.campaignArmy.soldiers,
      knights: attacker.campaignArmy.knights,
      catapults: attacker.campaignArmy.catapults,
      archers: attacker.campaignArmy.archers ?? 0,
    };

    const campaignInitGarrison: Army = {
      soldiers: territory.garrison.soldiers,
      knights: territory.garrison.knights,
      catapults: territory.garrison.catapults,
      archers: territory.garrison.archers ?? 0,
    };

    const campaignInitDefField: Army =
      isDefenderFieldArmyPresent && defender
        ? {
            soldiers: defender.campaignArmy.soldiers,
            knights: defender.campaignArmy.knights,
            catapults: defender.campaignArmy.catapults,
            archers: defender.campaignArmy.archers ?? 0,
          }
        : { soldiers: 0, knights: 0, catapults: 0, archers: 0 };

    const campaignInitDefTotal: Army = {
      soldiers: campaignInitGarrison.soldiers + campaignInitDefField.soldiers,
      knights: campaignInitGarrison.knights + campaignInitDefField.knights,
      catapults: campaignInitGarrison.catapults + campaignInitDefField.catapults,
      archers:
        (campaignInitGarrison.archers ?? 0) +
        (campaignInitDefField.archers ?? 0),
    };

    const siegeMod = context.siege;

    const initAttacker: Army = siegeMod
      ? { ...siegeMod.postSiegeAttackerArmy }
      : { ...campaignInitAttacker };

    const initGarrison: Army = siegeMod
      ? { ...siegeMod.postSiegeDefenderGarrison }
      : { ...campaignInitGarrison };

    const initDefField: Army = siegeMod
      ? { ...siegeMod.postSiegeDefenderFieldArmy }
      : { ...campaignInitDefField };

    const initDefTotal: Army = {
      soldiers: initGarrison.soldiers + initDefField.soldiers,
      knights: initGarrison.knights + initDefField.knights,
      catapults: initGarrison.catapults + initDefField.catapults,
      archers:
        (initGarrison.archers ?? 0) + (initDefField.archers ?? 0),
    };

    let playerSide: BattleSide | null = null;
    if (attacker.isPlayer) {
      playerSide = 'attacker';
    } else if (defender?.isPlayer) {
      playerSide = 'defender';
    }
    const aiSide: BattleSide | null =
      playerSide === 'attacker'
        ? 'defender'
        : playerSide === 'defender'
        ? 'attacker'
        : null;

    const isCastleAssault = Boolean(territory.hasCastle);
    const isRoyalKeep = Boolean(territory.isRoyalKeep);
    const maxIntegrity = isRoyalKeep ? 150 : 100;
    const wallIntegrity = isCastleAssault
      ? siegeMod
        ? Math.max(0, Math.min(maxIntegrity, siegeMod.wallIntegrity))
        : maxIntegrity
      : 0;
    const wallBreached =
      isCastleAssault && (Boolean(siegeMod?.wallBreached) || wallIntegrity <= 0);
    const castleDefenseMult = this.getCastleDefenseMultiplier(
      wallIntegrity,
      isCastleAssault,
      isRoyalKeep
    );
    const hasCastleDefense = isCastleAssault && castleDefenseMult > 1.0;

    const isPlagueInfected = Boolean(siegeMod?.isPlagueInfected);
    const isOnFire = Boolean(siegeMod?.isOnFire);
    const baseDefenderLeadership = defender ? defender.leadership : 3;
    const effectiveDefenderLeadership = isPlagueInfected
      ? Math.max(0, baseDefenderLeadership - 2)
      : baseDefenderLeadership;

    const hasHastingsHorn = Boolean(
      attacker.relicIds?.includes('hastings_horn')
    );
    const hasYewBow = Boolean(attacker.relicIds?.includes('sherwood_yew_bow'));
    const effectiveAttackerLeadership =
      attacker.leadership + (hasHastingsHorn ? 2 : 0);

    let startingMomentum = 0;
    if (wallBreached) {
      startingMomentum += 20;
    }
    if (isPlagueInfected) {
      startingMomentum += 15; // -15 Defender starting momentum
    }
    if (hasHastingsHorn) {
      startingMomentum += 10;
    }
    startingMomentum = Math.max(-100, Math.min(100, startingMomentum));

    const isHomeCastle = Boolean(defender && defender.homeTerritoryId === territory.id);
    const seed =
      options?.seed ??
      (state.turn * 7919 +
        context.attackerId.charCodeAt(0) * 131 +
        context.territoryId.charCodeAt(0) * 37);

    const initialLog: string[] = [
      `Hosts form battle lines at ${territory.name}!`,
    ];
    if (isCastleAssault) {
      if (wallBreached) {
        initialLog.push(
          `WALL BREACHED! Defender loses Castle Armor (0% bonus) & ${attacker.name} charges in (+20 Momentum)!`
        );
      } else {
        const bonusPct = Math.round((castleDefenseMult - 1) * 100);
        initialLog.push(
          `Fortified Castle Siege (${wallIntegrity}% Wall): ${
            defender ? defender.name : 'Garrison'
          } holds +${bonusPct}% rampart defense!`
        );
      }
    }
    if (isPlagueInfected) {
      initialLog.push(
        `Plague weakens the defenders: -2 Leadership & -15 starting morale!`
      );
    }
    if (hasHastingsHorn) {
      initialLog.push(
        `Warhorn of Hastings sounds across the field (+2 Leadership, +10 starting Momentum)!`
      );
    }

    const session: BattleSession = {
      attackerId: attacker.id,
      attackerName: attacker.name,
      attackerFaction: attacker.faction,
      attackerLeadership: effectiveAttackerLeadership,
      attackerHasHastingsHorn: hasHastingsHorn,
      attackerHasYewBow: hasYewBow,
      defenderId: defender ? defender.id : null,
      defenderName: defender ? defender.name : `${territory.name} Garrison`,
      defenderFaction: defender ? defender.faction : 'norman',
      baseDefenderLeadership,
      defenderLeadership: effectiveDefenderLeadership,
      territoryId: territory.id,
      territoryName: territory.name,
      originTerritoryId: originId,
      originTerritoryName: originTerritory ? originTerritory.name : originId,
      isCastleAssault,
      hasCastleDefense,
      wallIntegrity,
      castleDefenseMult,
      wallBreached,
      isPlagueInfected,
      isOnFire,
      isHomeCastle,
      isDefenderFieldArmyPresent,
      playerSide,
      aiSide,

      campaignInitialAttackerArmy: { ...campaignInitAttacker },
      campaignInitialDefenderTotal: { ...campaignInitDefTotal },

      initialAttackerArmy: { ...initAttacker },
      initialDefenderGarrison: { ...initGarrison },
      initialDefenderFieldArmy: { ...initDefField },
      initialDefenderTotal: { ...initDefTotal },

      attackerArmy: { ...initAttacker },
      defenderArmy: { ...initDefTotal },

      attackerTactic: wallBreached ? 'FEROCIOUS_ATTACK' : 'NORMAL_ATTACK',
      defenderTactic: hasCastleDefense ? 'STAND_AND_FIGHT' : 'NORMAL_ATTACK',

      momentum: startingMomentum,
      tick: 0,
      ticksWithoutCasualty: 0,
      status: 'ONGOING',
      committed: false,
      deterministic: Boolean(options?.deterministic),
      rngState: seed >>> 0,

      attackerDamagePools: { soldiers: 0, knights: 0, catapults: 0, archers: 0 },
      defenderDamagePools: { soldiers: 0, knights: 0, catapults: 0, archers: 0 },

      retreatPenaltyLosses: { soldiers: 0, knights: 0, catapults: 0, archers: 0 },
      tickerLog: initialLog,
      lastTickReport: null,
      committedResult: null,
    };

    // Keep player's default opening tactic on NORMAL_ATTACK so player chooses intentionally
    if (session.playerSide === 'attacker') {
      session.attackerTactic = 'NORMAL_ATTACK';
    }

    // Check immediate unopposed capture if defender has 0 combat units remaining after siege
    if (initDefTotal.soldiers + initDefTotal.knights + (initDefTotal.archers ?? 0) <= 0) {
      session.status = 'ATTACKER_WON';
      session.momentum = 100;
      session.tickerLog.push(
        `${territory.name} has no surviving defenders — ${attacker.name} seizes the stronghold!`
      );
    }

    // Let opposing AI pick an intelligent opening tactic
    if (session.status === 'ONGOING' && session.aiSide) {
      const openingAiTactic = this.chooseAiTactic(session, session.aiSide);
      if (session.aiSide === 'attacker') {
        session.attackerTactic = openingAiTactic;
      } else {
        session.defenderTactic = openingAiTactic;
      }
    }

    return session;
  }

  /**
   * Updates the active BattleTactic for the specified side, enforcing the Knight requirement for OUTFLANK.
   */
  public static setTactic(
    session: BattleSession,
    side: BattleSide,
    tactic: BattleTactic
  ): ActionResult {
    if (session.status !== 'ONGOING') {
      return { success: false, message: 'Battle has already concluded.' };
    }

    const army = side === 'attacker' ? session.attackerArmy : session.defenderArmy;
    if (!this.canUseTactic(army, tactic)) {
      return {
        success: false,
        message: 'OUTFLANK requires at least 1 Knight in your battle host!',
      };
    }

    if (side === 'attacker') {
      session.attackerTactic = tactic;
    } else {
      session.defenderTactic = tactic;
    }

    const commander = side === 'attacker' ? session.attackerName : session.defenderName;
    const msg = `${commander} orders ${TACTIC_PROFILES[tactic].label}!`;
    this.pushTicker(session, msg);

    return { success: true, message: msg };
  }

  /**
   * AI Battlefield Commander Logic:
   * Dynamically chooses an optimal tactic based on Leadership, Knight advantage, Castle walls, and Player tactic.
   */
  public static chooseAiTactic(session: BattleSession, side: BattleSide): BattleTactic {
    const myArmy = side === 'attacker' ? session.attackerArmy : session.defenderArmy;
    const oppArmy = side === 'attacker' ? session.defenderArmy : session.attackerArmy;
    const oppTactic = side === 'attacker' ? session.defenderTactic : session.attackerTactic;
    const myLeadership =
      side === 'attacker' ? session.attackerLeadership : session.defenderLeadership;
    const myMomentum = side === 'attacker' ? session.momentum : -session.momentum;

    const myPower = myArmy.soldiers + myArmy.knights * 6;
    const oppPower = Math.max(1, oppArmy.soldiers + oppArmy.knights * 6);
    const ratio = myPower / oppPower;

    // 1. Reactive counters to opponent's active maneuver (sharper for high-leadership commanders)
    if (oppTactic === 'OUTFLANK' && oppArmy.knights > 0) {
      if (myArmy.knights > oppArmy.knights && myLeadership >= 6) {
        return 'OUTFLANK';
      }
      return 'STAND_AND_FIGHT';
    }

    if (oppTactic === 'FEROCIOUS_ATTACK' && myLeadership >= 5) {
      if (myArmy.knights >= 2 && myArmy.knights > oppArmy.knights && ratio >= 0.9) {
        return 'OUTFLANK';
      }
      return 'STAND_AND_FIGHT';
    }

    // 2. Cavalry Outflank opportunity if we hold Knight superiority and opponent isn't braced
    if (
      myArmy.knights > 0 &&
      myArmy.knights > oppArmy.knights &&
      oppTactic !== 'STAND_AND_FIGHT'
    ) {
      return 'OUTFLANK';
    }

    // 3. Methodical Cautious Attack to break an opponent sitting in Stand & Fight
    if (oppTactic === 'STAND_AND_FIGHT' && side === 'attacker') {
      return ratio > 1.8 && myLeadership >= 7 ? 'FEROCIOUS_ATTACK' : 'CAUTIOUS_ATTACK';
    }

    // 4. Defending a Castle or fighting outnumbered -> defensive discipline
    if (ratio < 0.85) {
      if (side === 'defender' && session.hasCastleDefense) {
        return 'STAND_AND_FIGHT';
      }
      return session.tick % 4 === 0 ? 'CAUTIOUS_ATTACK' : 'STAND_AND_FIGHT';
    }

    // 5. Pressing an overwhelming advantage -> Ferocious Attack
    if (ratio > 1.35 && (myMomentum >= 10 || myLeadership >= 7)) {
      return 'FEROCIOUS_ATTACK';
    }

    return 'NORMAL_ATTACK';
  }

  /**
   * Executes one discrete tactical combat round/tick.
   */
  public static stepTick(session: BattleSession): BattleTickReport {
    const momentumBefore = session.momentum;

    if (session.status !== 'ONGOING') {
      return (
        session.lastTickReport ?? {
          tick: session.tick,
          attackerTactic: session.attackerTactic,
          defenderTactic: session.defenderTactic,
          attackerLosses: { soldiers: 0, knights: 0, catapults: 0 },
          defenderLosses: { soldiers: 0, knights: 0, catapults: 0 },
          attackerDamageDealt: 0,
          defenderDamageDealt: 0,
          attackerCatapultFired: false,
          defenderCatapultFired: false,
          attackerFlankSuccess: false,
          defenderFlankSuccess: false,
          attackerFlankCountered: false,
          defenderFlankCountered: false,
          momentumBefore,
          momentumAfter: session.momentum,
          momentumDelta: 0,
          aiChangedTacticTo: null,
          events: [],
          status: session.status,
        }
      );
    }

    session.tick += 1;
    const tickEvents: string[] = [];

    // Enforce OUTFLANK Knight requirement if Knights fell to 0
    if (session.attackerTactic === 'OUTFLANK' && session.attackerArmy.knights <= 0) {
      session.attackerTactic = 'NORMAL_ATTACK';
      tickEvents.push(`${session.attackerName} has no Knights left — switching to Normal Attack.`);
    }
    if (session.defenderTactic === 'OUTFLANK' && session.defenderArmy.knights <= 0) {
      session.defenderTactic = 'NORMAL_ATTACK';
      tickEvents.push(`${session.defenderName} has no Knights left — switching to Normal Attack.`);
    }

    // Opposing AI Commander adapts tactics every 2 ticks
    let aiChangedTacticTo: BattleTactic | null = null;
    if (session.aiSide && session.tick > 1 && session.tick % 2 === 1) {
      const currentAiTactic =
        session.aiSide === 'attacker' ? session.attackerTactic : session.defenderTactic;
      const desiredAiTactic = this.chooseAiTactic(session, session.aiSide);
      if (desiredAiTactic !== currentAiTactic) {
        if (session.aiSide === 'attacker') {
          session.attackerTactic = desiredAiTactic;
        } else {
          session.defenderTactic = desiredAiTactic;
        }
        aiChangedTacticTo = desiredAiTactic;
        const aiName =
          session.aiSide === 'attacker' ? session.attackerName : session.defenderName;
        tickEvents.push(`${aiName} shifts formation to ${TACTIC_PROFILES[desiredAiTactic].label}!`);
      }
    }

    const attEval = this.evaluateManeuverMatchup(
      session.attackerTactic,
      session.defenderTactic,
      session.attackerArmy.knights,
      session.defenderArmy.knights
    );
    const defEval = this.evaluateManeuverMatchup(
      session.defenderTactic,
      session.attackerTactic,
      session.defenderArmy.knights,
      session.attackerArmy.knights
    );

    if (attEval.matchupNote) {
      tickEvents.push(attEval.matchupNote);
    } else if (defEval.matchupNote) {
      tickEvents.push(defEval.matchupNote);
    }

    const attLeadMod = this.getLeadershipMultiplier(session.attackerLeadership);
    const defLeadMod = this.getLeadershipMultiplier(session.defenderLeadership);
    const castleDefMod = session.castleDefenseMult;

    // Subtle battlefield morale factor from current frontline momentum (-100..+100 -> ±12%)
    const attMoraleMod = 1 + (session.momentum / 100) * 0.12;
    const defMoraleMod = 1 - (session.momentum / 100) * 0.12;

    const attVariance = session.deterministic ? 1.0 : 0.94 + this.nextRandom(session) * 0.12;
    const defVariance = session.deterministic ? 1.0 : 0.94 + this.nextRandom(session) * 0.12;

    const attRawBase = session.attackerArmy.soldiers + session.attackerArmy.knights * 6;
    const defRawBase = session.defenderArmy.soldiers + session.defenderArmy.knights * 6;

    // Effective tick melee/cavalry damage output (mitigated by Castle defense if attacking a Castle)
    const meleeAttDamage =
      (attRawBase *
        this.BASE_TICK_LETHALITY *
        attLeadMod *
        attEval.offenseMult *
        defEval.vulnerabilityMult *
        attMoraleMod *
        attVariance) /
      castleDefMod;

    const meleeDefDamage =
      defRawBase *
      this.BASE_TICK_LETHALITY *
      defLeadMod *
      defEval.offenseMult *
      attEval.vulnerabilityMult *
      castleDefMod *
      defMoraleMod *
      defVariance;

    let attDamageDealt = meleeAttDamage;
    let defDamageDealt = meleeDefDamage;

    // Periodic Catapult Bombardment (fires on even ticks if catapults > 0)
    let attackerCatapultFired = false;
    let defenderCatapultFired = false;

    if (session.tick % 2 === 0 && session.attackerArmy.catapults > 0) {
      attackerCatapultFired = true;
      const stationaryTargetBonus = session.defenderTactic === 'STAND_AND_FIGHT' ? 1.35 : 1.0;
      const catDmg =
        session.attackerArmy.catapults *
        2.1 *
        attLeadMod *
        defEval.vulnerabilityMult *
        stationaryTargetBonus;
      session.defenderDamagePools.soldiers += catDmg;
      attDamageDealt += catDmg;
    }

    if (session.tick % 2 === 0 && session.defenderArmy.catapults > 0) {
      defenderCatapultFired = true;
      const stationaryTargetBonus = session.attackerTactic === 'STAND_AND_FIGHT' ? 1.35 : 1.0;
      const catDmg =
        session.defenderArmy.catapults *
        2.1 *
        defLeadMod *
        attEval.vulnerabilityMult *
        stationaryTargetBonus;
      session.attackerDamagePools.soldiers += catDmg;
      defDamageDealt += catDmg;
    }

    // Longbowmen Ranged Arrow Volleys every tick
    let attackerArcherVolleyFired = false;
    let defenderArcherVolleyFired = false;

    const attArchers = session.attackerArmy.archers ?? 0;
    if (attArchers > 0) {
      attackerArcherVolleyFired = true;
      let tacticBonus = 1.0;
      if (session.defenderTactic === 'FEROCIOUS_ATTACK') {
        tacticBonus = 1.3;
      } else if (session.defenderTactic === 'STAND_AND_FIGHT') {
        tacticBonus = 0.7;
      }
      let archerDmg =
        attArchers *
        2.5 *
        attLeadMod *
        tacticBonus *
        (session.deterministic ? 1.0 : attVariance);
      if (session.attackerHasYewBow) {
        archerDmg *= 1.25;
      }
      session.defenderDamagePools.soldiers += archerDmg;
      attDamageDealt += archerDmg;
    }

    const defArchers = session.defenderArmy.archers ?? 0;
    if (defArchers > 0) {
      defenderArcherVolleyFired = true;
      let tacticBonus = 1.0;
      if (session.attackerTactic === 'FEROCIOUS_ATTACK') {
        tacticBonus = 1.3;
      } else if (session.attackerTactic === 'STAND_AND_FIGHT') {
        tacticBonus = 0.7;
      }
      const archerDmg =
        defArchers *
        2.5 *
        defLeadMod *
        tacticBonus *
        (session.deterministic ? 1.0 : defVariance);
      session.attackerDamagePools.soldiers += archerDmg;
      defDamageDealt += archerDmg;
    }

    // Route melee/cavalry damage into Soldier, Knight, and Catapult pools
    this.routeDamageToPools(
      meleeAttDamage,
      session.defenderArmy,
      session.defenderDamagePools,
      attEval.flankBypassSuccess,
      defEval.flankCountered
    );

    this.routeDamageToPools(
      meleeDefDamage,
      session.attackerArmy,
      session.attackerDamagePools,
      defEval.flankBypassSuccess,
      attEval.flankCountered
    );

    // Resolve integer casualties from fractional pools
    const preAtt = { ...session.attackerArmy };
    const preDef = { ...session.defenderArmy };

    const defenderLosses = this.extractCasualties(
      session.defenderArmy,
      session.defenderDamagePools
    );
    const attackerLosses = this.extractCasualties(
      session.attackerArmy,
      session.attackerDamagePools
    );

    // Anti-stalemate guard for tiny 1v1 / 2v2 endgame skirmishes
    const totalTickCas =
      defenderLosses.soldiers +
      defenderLosses.knights +
      attackerLosses.soldiers +
      attackerLosses.knights;

    if (totalTickCas === 0) {
      session.ticksWithoutCasualty += 1;
      if (session.ticksWithoutCasualty >= 2) {
        session.ticksWithoutCasualty = 0;
        if (attDamageDealt >= defDamageDealt) {
          if (session.defenderArmy.soldiers > 0) {
            session.defenderArmy.soldiers -= 1;
            defenderLosses.soldiers += 1;
          } else if (session.defenderArmy.knights > 0) {
            session.defenderArmy.knights -= 1;
            defenderLosses.knights += 1;
          }
        } else {
          if (session.attackerArmy.soldiers > 0) {
            session.attackerArmy.soldiers -= 1;
            attackerLosses.soldiers += 1;
          } else if (session.attackerArmy.knights > 0) {
            session.attackerArmy.knights -= 1;
            attackerLosses.knights += 1;
          }
        }
      }
    } else {
      session.ticksWithoutCasualty = 0;
    }

    // Simultaneous double-wipeout tie-breaker: winner must retain at least 1 combat unit
    const attAlive = session.attackerArmy.soldiers + session.attackerArmy.knights;
    const defAlive = session.defenderArmy.soldiers + session.defenderArmy.knights;
    if (attAlive <= 0 && defAlive <= 0) {
      const attPreScore = (preAtt.soldiers + preAtt.knights * 6) * attLeadMod;
      const defPreScore = (preDef.soldiers + preDef.knights * 6) * defLeadMod * castleDefMod;
      if (attPreScore > defPreScore) {
        session.attackerArmy.soldiers = 1;
        attackerLosses.soldiers = Math.max(0, preAtt.soldiers - 1);
      } else {
        session.defenderArmy.soldiers = 1;
        defenderLosses.soldiers = Math.max(0, preDef.soldiers - 1);
      }
    }

    // Update Frontline Momentum (-100 .. +100)
    const dmgDiffRatio =
      (attDamageDealt - defDamageDealt) / Math.max(1, attDamageDealt + defDamageDealt);
    const rawPushDelta =
      dmgDiffRatio * 18 +
      (attEval.momentumBonus - defEval.momentumBonus) * 0.65 +
      (attackerCatapultFired ? 3 : 0) -
      (defenderCatapultFired ? 3 : 0);

    session.momentum = Math.max(
      -100,
      Math.min(100, Math.round(session.momentum + rawPushDelta))
    );

    // Format crisp Battle Ticker event summary
    if (attackerCatapultFired && defenderLosses.soldiers > 0) {
      tickEvents.push(
        `${session.attackerName}'s catapults hurl boulders into defender ranks!`
      );
    }
    if (defenderCatapultFired && attackerLosses.soldiers > 0) {
      tickEvents.push(
        `${session.defenderName}'s catapults bombard the advancing host!`
      );
    }

    const defLossStr = this.formatLossSummary(defenderLosses);
    const attLossStr = this.formatLossSummary(attackerLosses);
    if (defLossStr || attLossStr) {
      const parts: string[] = [];
      if (defLossStr) parts.push(`${session.defenderName}: ${defLossStr}`);
      if (attLossStr) parts.push(`${session.attackerName}: ${attLossStr}`);
      tickEvents.push(`[Round ${session.tick}] ${parts.join('  •  ')}`);
    } else if (tickEvents.length === 0) {
      tickEvents.push(`[Round ${session.tick}] Shield-walls clash furiously along the line!`);
    }

    // Check Victory / Defeat termination
    const finalAttCombat = session.attackerArmy.soldiers + session.attackerArmy.knights;
    const finalDefCombat = session.defenderArmy.soldiers + session.defenderArmy.knights;

    if (finalDefCombat <= 0 && finalAttCombat > 0) {
      session.status = 'ATTACKER_WON';
      session.defenderArmy.catapults = 0; // Unescorted defender siege engines captured/destroyed
      session.momentum = 100;
      tickEvents.push(`VICTORY! ${session.attackerName} carries the field at ${session.territoryName}!`);
    } else if (finalAttCombat <= 0) {
      session.status = 'DEFENDER_WON';
      session.attackerArmy.catapults = 0; // Unescorted attacker siege engines lost in rout
      session.momentum = -100;
      tickEvents.push(`${session.defenderName} holds ${session.territoryName}! The invaders are routed!`);
    } else {
      // Re-check OUTFLANK if last Knight just fell this tick
      if (session.attackerTactic === 'OUTFLANK' && session.attackerArmy.knights <= 0) {
        session.attackerTactic = 'NORMAL_ATTACK';
        tickEvents.push(`${session.attackerName}'s last Knight fell — Outflank ended!`);
      }
      if (session.defenderTactic === 'OUTFLANK' && session.defenderArmy.knights <= 0) {
        session.defenderTactic = 'NORMAL_ATTACK';
        tickEvents.push(`${session.defenderName}'s last Knight fell — Outflank ended!`);
      }
    }

    for (const ev of tickEvents) {
      this.pushTicker(session, ev);
    }

    const report: BattleTickReport = {
      tick: session.tick,
      attackerTactic: session.attackerTactic,
      defenderTactic: session.defenderTactic,
      attackerLosses,
      defenderLosses,
      attackerDamageDealt: Number(attDamageDealt.toFixed(2)),
      defenderDamageDealt: Number(defDamageDealt.toFixed(2)),
      attackerCatapultFired,
      defenderCatapultFired,
      attackerArcherVolleyFired,
      defenderArcherVolleyFired,
      attackerFlankSuccess: attEval.flankBypassSuccess,
      defenderFlankSuccess: defEval.flankBypassSuccess,
      attackerFlankCountered: attEval.flankCountered,
      defenderFlankCountered: defEval.flankCountered,
      momentumBefore,
      momentumAfter: session.momentum,
      momentumDelta: session.momentum - momentumBefore,
      aiChangedTacticTo,
      events: tickEvents,
      status: session.status,
    };

    session.lastTickReport = report;
    return report;
  }

  /**
   * Instantly resolves the remaining rounds of an active BattleSession using the tactical tick engine.
   */
  public static resolveToCompletion(session: BattleSession, maxTicks = 250): BattleTickReport | null {
    let lastReport = session.lastTickReport;
    let guard = 0;
    while (session.status === 'ONGOING' && guard < maxTicks) {
      lastReport = this.stepTick(session);
      guard++;
    }
    return lastReport;
  }

  /**
   * Checks whether a given side is permitted to order a tactical RETREAT.
   * - Attacker can always retreat while combat units remain.
   * - Defender can retreat only if defending a non-Home territory with a mobile campaignArmy present.
   */
  public static canSideRetreat(session: BattleSession, side: BattleSide): ActionResult {
    if (session.status !== 'ONGOING') {
      return { success: false, message: 'Battle has already ended.' };
    }

    if (side === 'attacker') {
      const alive = session.attackerArmy.soldiers + session.attackerArmy.knights;
      if (alive <= 0) {
        return { success: false, message: 'No surviving units remain to retreat.' };
      }
      return { success: true, message: 'Order retreat back to friendly territory (-15% parting losses).' };
    }

    if (session.isHomeCastle) {
      return {
        success: false,
        message: 'Cannot retreat from thy Ancestral Home Stronghold — hold the walls!',
      };
    }

    if (!session.isDefenderFieldArmyPresent) {
      return {
        success: false,
        message: 'Local shire garrison has no mobile field host to withdraw!',
      };
    }

    return {
      success: true,
      message: 'Withdraw mobile Campaign Army to friendly lands (-15% parting losses).',
    };
  }

  /**
   * Orders an immediate tactical RETREAT on a BattleSession and commits the resulting state to GameState.
   * Inflicts ~15% parting casualties on the retreating army and returns them to friendly territory.
   */
  public static retreatFromBattle(
    session: BattleSession,
    retreatingSide: BattleSide = session.playerSide ?? 'attacker',
    gameState: GameState = GameState.getInstance()
  ): BattleResult {
    return gameState.mutateState((state) =>
      this.retreatOnState(state, session, retreatingSide)
    );
  }

  /**
   * Pure state mutator for Retreat (useful for headless testing or custom state instances).
   */
  public static retreatOnState(
    state: CampaignState,
    session: BattleSession,
    retreatingSide: BattleSide = 'attacker'
  ): BattleResult {
    if (session.committed && session.committedResult) {
      return session.committedResult;
    }

    if (retreatingSide === 'attacker') {
      const remSoldiers = session.attackerArmy.soldiers;
      const remKnights = session.attackerArmy.knights;
      const remArchers = session.attackerArmy.archers ?? 0;
      let lossSoldiers =
        remSoldiers > 0 ? Math.max(remSoldiers >= 4 ? 1 : 0, Math.round(remSoldiers * this.RETREAT_PENALTY_RATE)) : 0;
      let lossKnights =
        remKnights > 0 ? Math.round(remKnights * this.RETREAT_PENALTY_RATE) : 0;
      let lossArchers =
        remArchers > 0 ? Math.max(remArchers >= 4 ? 1 : 0, Math.round(remArchers * this.RETREAT_PENALTY_RATE)) : 0;

      // Ensure at least 1 combat unit survives an orderly retreat if >= 2 existed
      if (
        remSoldiers + remKnights + remArchers >= 1 &&
        remSoldiers - lossSoldiers + (remKnights - lossKnights) + (remArchers - lossArchers) <= 0
      ) {
        if (remKnights > 0) {
          lossKnights = remKnights - 1;
          lossSoldiers = remSoldiers;
        } else if (remArchers > 0) {
          lossArchers = remArchers - 1;
          lossSoldiers = remSoldiers;
        } else {
          lossSoldiers = remSoldiers - 1;
        }
      }

      session.attackerArmy.soldiers = Math.max(0, remSoldiers - lossSoldiers);
      session.attackerArmy.knights = Math.max(0, remKnights - lossKnights);
      session.attackerArmy.archers = Math.max(0, remArchers - lossArchers);
      session.retreatPenaltyLosses = {
        soldiers: lossSoldiers,
        knights: lossKnights,
        catapults: 0,
        archers: lossArchers,
      };
      session.status = 'ATTACKER_RETREATED';
      this.pushTicker(
        session,
        `${session.attackerName} sounds the horn to RETREAT (-${lossSoldiers}S, -${lossKnights}K parting losses)!`
      );
    } else {
      // Defender withdraws mobile army from non-home territory; territory yields to attacker
      const remSoldiers = session.defenderArmy.soldiers;
      const remKnights = session.defenderArmy.knights;
      const remArchers = session.defenderArmy.archers ?? 0;
      const lossSoldiers = Math.round(remSoldiers * this.RETREAT_PENALTY_RATE);
      const lossKnights = Math.round(remKnights * this.RETREAT_PENALTY_RATE);
      const lossArchers = Math.round(remArchers * this.RETREAT_PENALTY_RATE);

      session.defenderArmy.soldiers = Math.max(0, remSoldiers - lossSoldiers);
      session.defenderArmy.knights = Math.max(0, remKnights - lossKnights);
      session.defenderArmy.archers = Math.max(0, remArchers - lossArchers);
      session.retreatPenaltyLosses = {
        soldiers: lossSoldiers,
        knights: lossKnights,
        catapults: 0,
        archers: lossArchers,
      };
      session.status = 'DEFENDER_RETREATED';
      this.pushTicker(
        session,
        `${session.defenderName} withdraws from ${session.territoryName} to preserve the Campaign Army!`
      );
    }

    return this.commitOutcomeOnState(state, session);
  }

  /**
   * Commits a concluded BattleSession's outcome to GameState singleton and returns BattleResult.
   */
  public static commitBattleOutcome(
    session: BattleSession,
    gameState: GameState = GameState.getInstance()
  ): BattleResult {
    return gameState.mutateState((state) => this.commitOutcomeOnState(state, session));
  }

  /**
   * Pure state mutator committing surviving troops, territory capture, Home Castle elimination,
   * Monthly Chronicle logging, and Campaign Victory/Defeat evaluation.
   */
  public static commitOutcomeOnState(
    state: CampaignState,
    session: BattleSession
  ): BattleResult {
    if (session.committed && session.committedResult) {
      return session.committedResult;
    }

    const attacker = state.activeLords[session.attackerId];
    const territory = state.territories[session.territoryId];
    const defender = session.defenderId ? state.activeLords[session.defenderId] : undefined;

    if (!attacker || !territory) {
      throw new Error('Cannot commit battle outcome: invalid attacker or territory in state.');
    }

    // Mark monthly conquest lock for attacker
    state.hasConqueredThisTurn[attacker.id] = true;
    state.phase = 'CAMPAIGN_MAP';

    const attackerStrength = CombatResolver.calculateCombatStrength(
      session.initialAttackerArmy,
      session.attackerLeadership,
      false
    );
    const defenderStrength = Number(
      (
        CombatResolver.calculateCombatStrength(
          session.initialDefenderTotal,
          session.defenderLeadership,
          false
        ) * session.castleDefenseMult
      ).toFixed(2)
    );

    const attackerCasualties: Army = {
      soldiers: Math.max(
        0,
        session.campaignInitialAttackerArmy.soldiers - session.attackerArmy.soldiers
      ),
      knights: Math.max(
        0,
        session.campaignInitialAttackerArmy.knights - session.attackerArmy.knights
      ),
      catapults: Math.max(
        0,
        session.campaignInitialAttackerArmy.catapults - session.attackerArmy.catapults
      ),
      archers: Math.max(
        0,
        (session.campaignInitialAttackerArmy.archers ?? 0) -
          (session.attackerArmy.archers ?? 0)
      ),
    };

    const defenderCasualties: Army = {
      soldiers: Math.max(
        0,
        session.campaignInitialDefenderTotal.soldiers - session.defenderArmy.soldiers
      ),
      knights: Math.max(
        0,
        session.campaignInitialDefenderTotal.knights - session.defenderArmy.knights
      ),
      catapults: Math.max(
        0,
        session.campaignInitialDefenderTotal.catapults - session.defenderArmy.catapults
      ),
      archers: Math.max(
        0,
        (session.campaignInitialDefenderTotal.archers ?? 0) -
          (session.defenderArmy.archers ?? 0)
      ),
    };

    const attackerCapturedTerritory =
      session.status === 'ATTACKER_WON' || session.status === 'DEFENDER_RETREATED';

    let eliminatedLordId: string | null = null;
    let homeCastleCaptured = false;
    let campaignVictoryTriggered = false;
    let campaignDefeatTriggered = false;
    let message = '';

    if (attackerCapturedTerritory) {
      // Ensure victorious occupying army has at least 1 combat unit
      if (
        session.attackerArmy.soldiers <= 0 &&
        session.attackerArmy.knights <= 0 &&
        (session.attackerArmy.archers ?? 0) <= 0
      ) {
        session.attackerArmy.soldiers = 1;
      }

      // If defender retreated with mobile army from non-home shire, preserve mobile portion at fallback territory
      if (
        session.status === 'DEFENDER_RETREATED' &&
        session.isDefenderFieldArmyPresent &&
        defender &&
        !session.isHomeCastle
      ) {
        const split = this.splitDefenderSurvivors(session);
        defender.campaignArmy = split.fieldArmy;
        const fallbackId = this.findDefenderFallbackTerritory(state, defender.id, territory.id);
        if (fallbackId) {
          defender.currentTerritoryId = fallbackId;
        }
      } else if (session.isDefenderFieldArmyPresent && defender && !session.isHomeCastle) {
        // Defender fought to annihilation on non-home territory
        defender.campaignArmy = { soldiers: 0, knights: 0, catapults: 0, archers: 0 };
        const fallbackId = this.findDefenderFallbackTerritory(state, defender.id, territory.id);
        if (fallbackId) {
          defender.currentTerritoryId = fallbackId;
        }
      }

      // Wipe out local shire garrison and transfer territory ownership to Attacker
      territory.garrison = { soldiers: 0, knights: 0, catapults: 0, archers: 0 };
      territory.ownerId = attacker.id;
      attacker.currentTerritoryId = territory.id;
      attacker.campaignArmy = { ...session.attackerArmy };

      homeCastleCaptured = Boolean(defender && territory.id === defender.homeTerritoryId);

      if (homeCastleCaptured && defender) {
        defender.isActive = false;
        defender.isDefeated = true;
        defender.campaignArmy = { soldiers: 0, knights: 0, catapults: 0, archers: 0 };
        eliminatedLordId = defender.id;
        if (state.captiveDamsel?.captorLordId === defender.id) {
          state.captiveDamsel = null;
        }

        // Revert all outlying shires owned by the defeated Lord to Neutral
        for (const otherTerr of Object.values(state.territories)) {
          if (otherTerr.ownerId === defender.id && otherTerr.id !== territory.id) {
            otherTerr.ownerId = null;
            otherTerr.garrison = { soldiers: 0, knights: 0, catapults: 0, archers: 0 };
          }
        }

        message = `${attacker.name} stormed ${territory.name} and defeated ${defender.name}! Outlying lands turn neutral!`;
      } else if (session.status === 'DEFENDER_RETREATED') {
        message = `${defender ? defender.name : 'Defenders'} withdrew from ${territory.name}; ${attacker.name} claims the shire!`;
      } else {
        message = `${attacker.name} conquered ${territory.name} from ${
          defender ? defender.name : 'the garrison'
        }!`;
      }

      if (
        defender &&
        attacker.isPlayer &&
        !defender.isDefeated &&
        state.edition === 'SIDEQUEST_LABS'
      ) {
        defender.hasVendettaAgainstPlayer = true;
        state.nemesisLordId = defender.id;
      }

      // Check Campaign Defeat or Campaign Victory
      const playerLord = state.activeLords[state.selectedLordId];
      if (playerLord && (playerLord.isDefeated || !playerLord.isActive)) {
        state.victoryStatus = 'DEFEAT';
        state.winnerLordId = attacker.id;
        campaignDefeatTriggered = true;
      } else {
        const remainingEnemies = Object.values(state.activeLords).filter(
          (l) => !l.isPlayer && l.isActive && !l.isDefeated
        );
        if (remainingEnemies.length === 0) {
          state.victoryStatus = 'VICTORY';
          state.winnerLordId = state.selectedLordId;
          campaignVictoryTriggered = true;
          message += ` ALL RIVALS DEFEATED — ${playerLord.name.toUpperCase()} IS DEFENDER OF THE CROWN!`;
        }
      }
    } else {
      // DEFENDER HELD THE TERRITORY (Attacker Retreated or Attacker Annihilated)
      attacker.campaignArmy = { ...session.attackerArmy };
      attacker.currentTerritoryId = session.originTerritoryId;

      const split = this.splitDefenderSurvivors(session);
      territory.garrison = split.garrison;
      if (session.isDefenderFieldArmyPresent && defender) {
        defender.campaignArmy = split.fieldArmy;
      }

      if (session.status === 'ATTACKER_RETREATED') {
        message = `${attacker.name} retreated from ${territory.name} back to ${session.originTerritoryName}.`;
      } else {
        message = `${attacker.name}'s assault on ${territory.name} was crushed by ${session.defenderName}!`;
      }
    }

    state.log.push(message);

    const result: BattleResult = {
      allowed: true,
      attackerWon: attackerCapturedTerritory,
      retreated:
        session.status === 'ATTACKER_RETREATED' || session.status === 'DEFENDER_RETREATED',
      retreatingSide:
        session.status === 'ATTACKER_RETREATED'
          ? 'attacker'
          : session.status === 'DEFENDER_RETREATED'
          ? 'defender'
          : undefined,
      attackerId: attacker.id,
      defenderId: session.defenderId,
      territoryId: territory.id,
      attackerStrength,
      defenderStrength,
      attackerCasualties,
      defenderCasualties,
      homeCastleCaptured,
      eliminatedLordId,
      campaignVictoryTriggered,
      campaignDefeatTriggered,
      message,
    };

    session.committed = true;
    session.committedResult = result;
    return result;
  }

  private static routeDamageToPools(
    damage: number,
    targetArmy: Army,
    targetPools: { soldiers: number; knights: number; catapults: number; archers?: number },
    flankBypassSuccess: boolean,
    targetFlankCountered: boolean
  ): void {
    const cleanDmg = Math.max(0, damage);
    if (cleanDmg <= 0) return;

    const hasKnights = targetArmy.knights > 0;
    const hasCatapults = targetArmy.catapults > 0;
    const hasArchers = (targetArmy.archers ?? 0) > 0;

    if (flankBypassSuccess) {
      // Cavalry Outflank bypasses front-line infantry to strike rear-line Archers, Knights & Catapults!
      if (hasArchers) {
        if (hasKnights && hasCatapults) {
          targetPools.knights += cleanDmg * 0.35;
          targetPools.catapults += cleanDmg * 0.20;
          targetPools.archers = (targetPools.archers ?? 0) + cleanDmg * 0.30;
          targetPools.soldiers += cleanDmg * 0.15;
        } else if (hasKnights) {
          targetPools.knights += cleanDmg * 0.45;
          targetPools.archers = (targetPools.archers ?? 0) + cleanDmg * 0.35;
          targetPools.soldiers += cleanDmg * 0.20;
        } else if (hasCatapults) {
          targetPools.catapults += cleanDmg * 0.40;
          targetPools.archers = (targetPools.archers ?? 0) + cleanDmg * 0.40;
          targetPools.soldiers += cleanDmg * 0.20;
        } else {
          targetPools.archers = (targetPools.archers ?? 0) + cleanDmg * 0.65;
          targetPools.soldiers += cleanDmg * 0.35;
        }
        return;
      }

      if (hasKnights && hasCatapults) {
        targetPools.knights += cleanDmg * 0.48;
        targetPools.catapults += cleanDmg * 0.24;
        targetPools.soldiers += cleanDmg * 0.28;
      } else if (hasKnights) {
        targetPools.knights += cleanDmg * 0.65;
        targetPools.soldiers += cleanDmg * 0.35;
      } else if (hasCatapults) {
        targetPools.catapults += cleanDmg * 0.55;
        targetPools.soldiers += cleanDmg * 0.45;
      } else {
        // Rear encirclement against pure infantry
        targetPools.soldiers += cleanDmg * 1.18;
      }
      return;
    }

    if (targetFlankCountered && targetArmy.knights > 0) {
      // Stand & Fight pikes punish charging enemy Knights
      targetPools.knights += cleanDmg * 0.45;
      targetPools.soldiers += cleanDmg * 0.55;
      return;
    }

    // Standard frontline engagement
    if (targetArmy.soldiers > 0 && targetArmy.knights > 0) {
      targetPools.soldiers += cleanDmg * 0.82;
      targetPools.knights += cleanDmg * 0.18;
    } else if (targetArmy.soldiers > 0) {
      targetPools.soldiers += cleanDmg;
    } else if (hasArchers) {
      targetPools.archers = (targetPools.archers ?? 0) + cleanDmg * 0.80;
      targetPools.knights += cleanDmg * 0.20;
    } else if (targetArmy.knights > 0) {
      targetPools.knights += cleanDmg;
    }
  }

  private static extractCasualties(
    army: Army,
    pools: { soldiers: number; knights: number; catapults: number; archers?: number }
  ): Army {
    const lostSoldiers = Math.min(army.soldiers, Math.floor(pools.soldiers / 1.0));
    pools.soldiers = Math.max(0, pools.soldiers - lostSoldiers * 1.0);
    army.soldiers -= lostSoldiers;

    const lostKnights = Math.min(army.knights, Math.floor(pools.knights / 6.0));
    pools.knights = Math.max(0, pools.knights - lostKnights * 6.0);
    army.knights -= lostKnights;

    const lostCatapults = Math.min(army.catapults, Math.floor(pools.catapults / 9.0));
    pools.catapults = Math.max(0, pools.catapults - lostCatapults * 9.0);
    army.catapults -= lostCatapults;

    const curArchers = army.archers ?? 0;
    const archerPool = pools.archers ?? 0;
    const lostArchers = Math.min(curArchers, Math.floor(archerPool / 3.0));
    pools.archers = Math.max(0, archerPool - lostArchers * 3.0);
    army.archers = curArchers - lostArchers;

    return {
      soldiers: lostSoldiers,
      knights: lostKnights,
      catapults: lostCatapults,
      archers: lostArchers,
    };
  }

  private static splitDefenderSurvivors(session: BattleSession): {
    garrison: Army;
    fieldArmy: Army;
  } {
    if (!session.isDefenderFieldArmyPresent) {
      return {
        garrison: { ...session.defenderArmy },
        fieldArmy: { soldiers: 0, knights: 0, catapults: 0, archers: 0 },
      };
    }

    const splitUnit = (survTotal: number, initGar: number, initField: number) => {
      const initSum = initGar + initField;
      if (initSum <= 0 || survTotal <= 0) {
        return { gar: 0, field: 0 };
      }
      const garShare = Math.min(
        initGar,
        Math.round(survTotal * (initGar / initSum))
      );
      const fieldShare = Math.max(0, survTotal - garShare);
      return { gar: garShare, field: fieldShare };
    };

    const s = splitUnit(
      session.defenderArmy.soldiers,
      session.initialDefenderGarrison.soldiers,
      session.initialDefenderFieldArmy.soldiers
    );
    const k = splitUnit(
      session.defenderArmy.knights,
      session.initialDefenderGarrison.knights,
      session.initialDefenderFieldArmy.knights
    );
    const c = splitUnit(
      session.defenderArmy.catapults,
      session.initialDefenderGarrison.catapults,
      session.initialDefenderFieldArmy.catapults
    );
    const a = splitUnit(
      session.defenderArmy.archers ?? 0,
      session.initialDefenderGarrison.archers ?? 0,
      session.initialDefenderFieldArmy.archers ?? 0
    );

    return {
      garrison: { soldiers: s.gar, knights: k.gar, catapults: c.gar, archers: a.gar },
      fieldArmy: { soldiers: s.field, knights: k.field, catapults: c.field, archers: a.field },
    };
  }

  private static findDefenderFallbackTerritory(
    state: CampaignState,
    defenderId: string,
    lostTerritoryId: string
  ): string | null {
    const defender = state.activeLords[defenderId];
    if (!defender) return null;

    if (
      defender.homeTerritoryId !== lostTerritoryId &&
      state.territories[defender.homeTerritoryId]?.ownerId === defenderId
    ) {
      return defender.homeTerritoryId;
    }

    const otherOwned = Object.values(state.territories).find(
      (t) => t.ownerId === defenderId && t.id !== lostTerritoryId && !t.isSherwood
    );
    return otherOwned ? otherOwned.id : null;
  }

  private static formatLossSummary(losses: Army): string {
    const chunks: string[] = [];
    if (losses.soldiers > 0) chunks.push(`-${losses.soldiers}S`);
    if (losses.knights > 0) chunks.push(`-${losses.knights}K`);
    if (losses.catapults > 0) chunks.push(`-${losses.catapults}C`);
    return chunks.join(' ');
  }

  private static pushTicker(session: BattleSession, entry: string): void {
    session.tickerLog.push(entry);
    if (session.tickerLog.length > 24) {
      session.tickerLog = session.tickerLog.slice(-24);
    }
  }

  private static nextRandom(session: BattleSession): number {
    // Mulberry32 deterministic PRNG
    let t = (session.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
