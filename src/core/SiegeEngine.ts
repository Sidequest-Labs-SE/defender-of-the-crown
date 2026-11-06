import {
  ActionResult,
  Army,
  BattleResult,
  CampaignState,
  PendingBattleContext,
  SiegeAmmoType,
  SiegeImpactZone,
  SiegeOutcomeModifiers,
} from './types';
import { CombatResolver } from './CombatResolver';
import { GameState } from './GameState';

export interface SiegeAmmoProfile {
  id: SiegeAmmoType;
  label: string;
  shortLabel: string;
  hotkey: string;
  sweetspot: 'WALL_HIT' | 'OVER_WALL_COURTYARD';
  aimHint: string;
  description: string;
}

export const SIEGE_AMMO_PROFILES: Record<SiegeAmmoType, SiegeAmmoProfile> = {
  BOULDER: {
    id: 'BOULDER',
    label: 'HEAVY BOULDER',
    shortLabel: 'BOULDER',
    hotkey: '1',
    sweetspot: 'WALL_HIT',
    aimHint: 'Aim: WALL HIT (Crushes Masonry)',
    description:
      'Heavy granite stone. Direct WALL HIT deals 30–45 structural wall damage + 1–2 garrison casualties.',
  },
  GREEK_FIRE: {
    id: 'GREEK_FIRE',
    label: 'GREEK FIRE',
    shortLabel: 'GREEK FIRE',
    hotkey: '2',
    sweetspot: 'OVER_WALL_COURTYARD',
    aimHint: 'Aim: OVER WALL (Burns 15–25% Garrison)',
    description:
      'Incendiary oil pot. Arc OVER WALL into courtyard to burn 15%–25% of defending Soldiers & Knights!',
  },
  DISEASE: {
    id: 'DISEASE',
    label: 'PLAGUE BARREL',
    shortLabel: 'DISEASE',
    hotkey: '3',
    sweetspot: 'OVER_WALL_COURTYARD',
    aimHint: 'Aim: OVER WALL (Plague & -2 Leadership)',
    description:
      'Biological plague cask. Arc OVER WALL to kill 10%–15% immediately, deal 1–3 attrition/turn & -2 Leadership!',
  },
};

export const ALL_SIEGE_AMMO: SiegeAmmoType[] = ['BOULDER', 'GREEK_FIRE', 'DISEASE'];

export type SiegeStatus =
  | 'ACTIVE'
  | 'VOLLEYS_EXHAUSTED'
  | 'ASSAULT_READY'
  | 'ABANDONED';

export interface SiegeVolleyReport {
  shotNumber: number;
  ammo: SiegeAmmoType;
  power: number;
  windBefore: number;
  windEffect: number;
  jitter: number;
  effectiveDistance: number;
  impactZone: SiegeImpactZone;
  wallIntegrityBefore: number;
  wallIntegrityAfter: number;
  wallDamage: number;
  wallBreachedOnShot: boolean;
  ignitedOnShot: boolean;
  infectedOnShot: boolean;
  immediateDefenderLosses: Army;
  plagueAttritionLosses: Army;
  totalDefenderLosses: Army;
  counterFireTriggered: boolean;
  attackerCounterLosses: Army;
  windAfter: number;
  shotsRemaining: number;
  events: string[];
}

export interface SiegeSession {
  attackerId: string;
  attackerName: string;
  attackerFaction: 'saxon' | 'norman';
  attackerLeadership: number;
  defenderId: string | null;
  defenderName: string;
  defenderFaction: 'saxon' | 'norman';
  defenderLeadership: number;
  territoryId: string;
  territoryName: string;
  originTerritoryId: string;
  originTerritoryName: string;
  mode: 'PLAYER_ATTACK' | 'PLAYER_DEFENSE';
  isHomeCastle: boolean;
  isDefenderFieldArmyPresent: boolean;

  initialAttackerArmy: Army;
  initialDefenderGarrison: Army;
  initialDefenderFieldArmy: Army;

  attackerArmy: Army;
  defenderGarrison: Army;
  defenderFieldArmy: Army;

  /** Castle structural integrity: 100 (intact) .. 0 (breached) */
  wallIntegrity: number;
  wallBreached: boolean;
  wallScorched: boolean;
  isOnFire: boolean;
  isPlagueInfected: boolean;

  /** Wind speed & direction: -10 (Strong Headwind) .. +10 (Strong Tailwind) */
  wind: number;

  maxVolleys: number;
  volleysFired: number;
  shotsRemaining: number;

  selectedAmmo: SiegeAmmoType;
  lastPower: number | null;
  lastEffectiveDistance: number | null;
  lastImpactZone: SiegeImpactZone | null;

  status: SiegeStatus;
  deterministic: boolean;
  enableCounterFire: boolean;
  rngState: number;

  retreatPenaltyLosses: Army;
  siegeLog: string[];
  volleyHistory: SiegeVolleyReport[];
  lastVolleyReport: SiegeVolleyReport | null;
  abandonedResult: BattleResult | null;
}

export interface CreateSiegeSessionOptions {
  deterministic?: boolean;
  seed?: number;
  initialWind?: number;
  enableCounterFire?: boolean;
}

/**
 * SiegeEngine (Sprint 4 Pure Catapult Siege & Ballistics Simulator)
 * Zero Phaser dependencies — handles catapult volley calculation, dynamic wind drift,
 * ballistic impact zones, Boulder wall destruction, Greek Fire garrison conflagration,
 * Disease plague infection + per-volley attrition, counter-battery fire, retreat, and
 * seamless PendingBattleContext handoff into BattleEngine.
 */
export class SiegeEngine {
  public static readonly WALL_HIT_MIN = 42;
  public static readonly WALL_HIT_MAX = 68;
  public static readonly COURTYARD_MIN = 69;
  public static readonly COURTYARD_MAX = 86;

  public static readonly WIND_MIN = -10;
  public static readonly WIND_MAX = 10;
  public static readonly WIND_DISTANCE_FACTOR = 1.5;

  public static readonly COUNTER_FIRE_CHANCE = 0.15;
  public static readonly RETREAT_PENALTY_RATE = 0.15;

  public static readonly PLAGUE_LEADERSHIP_PENALTY = 2;
  public static readonly PLAGUE_DEFENDER_MOMENTUM_PENALTY = 15;
  public static readonly BREACH_ATTACKER_MOMENTUM_BONUS = 20;

  /**
   * Base 5 volleys for 1 Catapult, +2 extra volleys per additional Catapult (max 9 volleys).
   */
  public static calculateMaxVolleys(catapults: number): number {
    if (catapults <= 0) return 0;
    return Math.min(9, 5 + (catapults - 1) * 2);
  }

  /**
   * Computes ballistic wind drift contribution from wind (-10..+10).
   */
  public static getWindEffect(wind: number): number {
    const clampedWind = Math.max(this.WIND_MIN, Math.min(this.WIND_MAX, wind));
    return Number((clampedWind * this.WIND_DISTANCE_FACTOR).toFixed(2));
  }

  /**
   * Computes Effective Projectile Distance from Catapult Power (0..100), Wind (-10..+10), and optional jitter.
   */
  public static computeEffectiveDistance(
    power: number,
    wind: number,
    jitter = 0
  ): number {
    const clampedPower = Math.max(0, Math.min(100, power));
    const windEffect = this.getWindEffect(wind);
    return Math.round(clampedPower + windEffect + jitter);
  }

  /**
   * Maps Effective Distance to one of the 4 ballistic impact zones:
   * - < 42: SHORT_MISS
   * - 42..68: WALL_HIT
   * - 69..86: OVER_WALL_COURTYARD
   * - > 86: LONG_MISS
   */
  public static classifyImpactZone(effectiveDistance: number): SiegeImpactZone {
    const dist = Math.round(effectiveDistance);
    if (dist < this.WALL_HIT_MIN) {
      return 'SHORT_MISS';
    }
    if (dist <= this.WALL_HIT_MAX) {
      return 'WALL_HIT';
    }
    if (dist <= this.COURTYARD_MAX) {
      return 'OVER_WALL_COURTYARD';
    }
    return 'LONG_MISS';
  }

  /**
   * Computes the wind-compensated Power (0..100) window required to land in a given target zone.
   */
  public static getPowerWindowForZone(
    zone: 'WALL_HIT' | 'OVER_WALL_COURTYARD',
    wind: number
  ): { minPower: number; maxPower: number; idealPower: number } {
    const windEffect = this.getWindEffect(wind);
    const rawMin =
      (zone === 'WALL_HIT' ? this.WALL_HIT_MIN : this.COURTYARD_MIN) - windEffect;
    const rawMax =
      (zone === 'WALL_HIT' ? this.WALL_HIT_MAX : this.COURTYARD_MAX) - windEffect;
    const minPower = Math.max(0, Math.min(100, Math.ceil(rawMin)));
    const maxPower = Math.max(0, Math.min(100, Math.floor(rawMax)));
    const idealPower = Math.max(
      0,
      Math.min(100, Math.round((rawMin + rawMax) / 2))
    );
    return { minPower, maxPower, idealPower };
  }

  /**
   * Computes dynamic Castle Fortification Multiplier scaled by remaining wallIntegrity (0..100):
   * 1.0 + 0.25 * (wallIntegrity / 100).
   * At 100% -> 1.25x (+25%); at 0% (Breached) -> 1.00x (0% bonus).
   */
  public static getDynamicCastleMultiplier(wallIntegrity: number): number {
    const clamped = Math.max(0, Math.min(100, wallIntegrity));
    return Number((1.0 + 0.25 * (clamped / 100)).toFixed(4));
  }

  /**
   * Human-readable tactical wind label for HUD display.
   */
  public static getWindLabel(wind: number): {
    title: string;
    hint: string;
    direction: 'HEADWIND' | 'TAILWIND' | 'CALM';
  } {
    if (wind === 0) {
      return {
        title: 'CALM AIR (0 kt)',
        hint: 'True trajectory — zero wind drift',
        direction: 'CALM',
      };
    }

    const abs = Math.abs(wind);
    const strength = abs <= 3 ? 'LIGHT' : abs <= 6 ? 'MODERATE' : 'STRONG';
    if (wind > 0) {
      return {
        title: `${strength} TAILWIND (+${wind} kt)`,
        hint: 'Carries shots FARTHER — ease back winch power',
        direction: 'TAILWIND',
      };
    }
    return {
      title: `${strength} HEADWIND (${wind} kt)`,
      hint: 'Pushes shots SHORT — pull winch power higher',
      direction: 'HEADWIND',
    };
  }

  /**
   * Total defending troops (Garrison + stationed Field Army) currently inside the besieged castle.
   */
  public static getDefenderTotalArmy(session: SiegeSession): Army {
    return {
      soldiers: session.defenderGarrison.soldiers + session.defenderFieldArmy.soldiers,
      knights: session.defenderGarrison.knights + session.defenderFieldArmy.knights,
      catapults: session.defenderGarrison.catapults + session.defenderFieldArmy.catapults,
    };
  }

  /**
   * Initializes a new pure Catapult SiegeSession from CampaignState and PendingBattleContext.
   */
  public static createSiegeSession(
    state: CampaignState,
    context: Pick<PendingBattleContext, 'attackerId' | 'territoryId'> & {
      originTerritoryId?: string;
      mode?: 'PLAYER_ATTACK' | 'PLAYER_DEFENSE';
    },
    options?: CreateSiegeSessionOptions
  ): SiegeSession {
    const attacker = state.activeLords[context.attackerId];
    const territory = state.territories[context.territoryId];

    if (!attacker || !territory) {
      throw new Error(
        `Invalid SiegeSession parameters: attacker=${context.attackerId}, territory=${context.territoryId}`
      );
    }

    if (!territory.hasCastle) {
      throw new Error(`${territory.name} does not possess a fortified Castle to besiege.`);
    }

    if (attacker.campaignArmy.catapults <= 0) {
      throw new Error(CombatResolver.CASTLE_SIEGE_BLOCK_MSG);
    }

    const originId = context.originTerritoryId ?? attacker.currentTerritoryId;
    const originTerr = state.territories[originId];

    const defender = territory.ownerId ? state.activeLords[territory.ownerId] : undefined;
    const isDefenderFieldArmyPresent = Boolean(
      defender &&
        defender.isActive &&
        !defender.isDefeated &&
        defender.currentTerritoryId === territory.id
    );

    const initAttacker: Army = { ...attacker.campaignArmy };
    const initGarrison: Army = { ...territory.garrison };
    const initDefField: Army =
      isDefenderFieldArmyPresent && defender
        ? { ...defender.campaignArmy }
        : { soldiers: 0, knights: 0, catapults: 0 };

    const deterministic = Boolean(options?.deterministic);
    const seed =
      options?.seed ??
      (state.turn * 6151 +
        context.attackerId.charCodeAt(0) * 193 +
        context.territoryId.charCodeAt(0) * 53);

    const session: SiegeSession = {
      attackerId: attacker.id,
      attackerName: attacker.name,
      attackerFaction: attacker.faction,
      attackerLeadership: attacker.leadership,
      defenderId: defender ? defender.id : null,
      defenderName: defender ? defender.name : `${territory.name} Garrison`,
      defenderFaction: defender ? defender.faction : 'norman',
      defenderLeadership: defender ? defender.leadership : 3,
      territoryId: territory.id,
      territoryName: territory.name,
      originTerritoryId: originId,
      originTerritoryName: originTerr ? originTerr.name : originId,
      mode: context.mode ?? (attacker.isPlayer ? 'PLAYER_ATTACK' : 'PLAYER_DEFENSE'),
      isHomeCastle: Boolean(defender && defender.homeTerritoryId === territory.id),
      isDefenderFieldArmyPresent,

      initialAttackerArmy: { ...initAttacker },
      initialDefenderGarrison: { ...initGarrison },
      initialDefenderFieldArmy: { ...initDefField },

      attackerArmy: { ...initAttacker },
      defenderGarrison: { ...initGarrison },
      defenderFieldArmy: { ...initDefField },

      wallIntegrity: 100,
      wallBreached: false,
      wallScorched: false,
      isOnFire: false,
      isPlagueInfected: false,

      wind: 0,
      maxVolleys: this.calculateMaxVolleys(initAttacker.catapults),
      volleysFired: 0,
      shotsRemaining: this.calculateMaxVolleys(initAttacker.catapults),

      selectedAmmo: 'BOULDER',
      lastPower: null,
      lastEffectiveDistance: null,
      lastImpactZone: null,

      status: 'ACTIVE',
      deterministic,
      enableCounterFire:
        options?.enableCounterFire !== undefined
          ? options.enableCounterFire
          : !deterministic,
      rngState: seed >>> 0,

      retreatPenaltyLosses: { soldiers: 0, knights: 0, catapults: 0 },
      siegeLog: [],
      volleyHistory: [],
      lastVolleyReport: null,
      abandonedResult: null,
    };

    if (options?.initialWind !== undefined) {
      session.wind = Math.max(
        this.WIND_MIN,
        Math.min(this.WIND_MAX, Math.round(options.initialWind))
      );
    } else if (deterministic) {
      session.wind = 0;
    } else {
      session.wind = Math.round((this.nextRandom(session) - 0.5) * 14); // -7..+7
    }

    session.siegeLog.push(
      `${attacker.name}'s siege engines unlimber before ${territory.name} (${session.maxVolleys} volleys ready)!`
    );
    const windInfo = this.getWindLabel(session.wind);
    session.siegeLog.push(`Tower pennants snap in ${windInfo.title}.`);

    return session;
  }

  /**
   * Selects the active catapult ammunition type (BOULDER, GREEK_FIRE, or DISEASE).
   */
  public static selectAmmo(
    session: SiegeSession,
    ammo: SiegeAmmoType
  ): ActionResult {
    if (session.status === 'ABANDONED') {
      return { success: false, message: 'Siege has been abandoned.' };
    }
    if (session.shotsRemaining <= 0) {
      return { success: false, message: 'All catapult volleys have been expended!' };
    }

    session.selectedAmmo = ammo;
    return {
      success: true,
      message: `Loaded ${SIEGE_AMMO_PROFILES[ammo].label} (${SIEGE_AMMO_PROFILES[ammo].aimHint}).`,
    };
  }

  /**
   * Fires a single Catapult Volley with the chosen winch Power (0..100),
   * resolving wind drift, impact zone, structural/troop damage, ongoing plague attrition,
   * defender counter-battery fire, and wind shift for the next volley.
   */
  public static fireVolley(
    session: SiegeSession,
    power: number,
    ammoOverride?: SiegeAmmoType
  ): SiegeVolleyReport {
    if (session.status === 'ABANDONED') {
      throw new Error('Cannot fire volley after abandoning the siege.');
    }
    if (session.shotsRemaining <= 0) {
      throw new Error('No catapult volleys remaining.');
    }

    if (ammoOverride) {
      session.selectedAmmo = ammoOverride;
    }

    const ammo = session.selectedAmmo;
    const clampedPower = Math.max(0, Math.min(100, Math.round(power)));
    const windBefore = session.wind;
    const windEffect = this.getWindEffect(windBefore);

    // Subtle trajectory jitter tightened by commander Leadership (0 in deterministic mode)
    const maxJitter = session.deterministic
      ? 0
      : Math.max(0.4, 2.1 - session.attackerLeadership * 0.14);
    const jitter = session.deterministic
      ? 0
      : Number(((this.nextRandom(session) * 2 - 1) * maxJitter).toFixed(2));

    const effectiveDistance = this.computeEffectiveDistance(
      clampedPower,
      windBefore,
      jitter
    );
    const impactZone = this.classifyImpactZone(effectiveDistance);

    const wallIntegrityBefore = session.wallIntegrity;
    const wasPlagueInfectedBeforeShot = session.isPlagueInfected;

    session.volleysFired += 1;
    session.shotsRemaining = Math.max(0, session.shotsRemaining - 1);
    session.lastPower = clampedPower;
    session.lastEffectiveDistance = effectiveDistance;
    session.lastImpactZone = impactZone;

    let wallDamage = 0;
    let wallBreachedOnShot = false;
    let ignitedOnShot = false;
    let infectedOnShot = false;
    let immediateDefenderLosses: Army = { soldiers: 0, knights: 0, catapults: 0 };
    let plagueAttritionLosses: Army = { soldiers: 0, knights: 0, catapults: 0 };
    const events: string[] = [];

    // 1. Resolve Primary Projectile Impact by Ammo & Zone
    if (impactZone === 'SHORT_MISS') {
      events.push(
        `[Volley ${session.volleysFired}] ${SIEGE_AMMO_PROFILES[ammo].shortLabel} falls SHORT into the grassy slope!`
      );
    } else if (impactZone === 'LONG_MISS') {
      events.push(
        `[Volley ${session.volleysFired}] ${SIEGE_AMMO_PROFILES[ammo].shortLabel} sails HIGH OVER ${session.territoryName}!`
      );
    } else if (ammo === 'BOULDER') {
      if (impactZone === 'WALL_HIT') {
        wallDamage = session.deterministic
          ? 38
          : 30 + Math.floor(this.nextRandom(session) * 16); // 30..45
        const colSoldiers = session.deterministic
          ? 2
          : 1 + Math.floor(this.nextRandom(session) * 2); // 1..2
        immediateDefenderLosses = this.inflictDefenderCasualties(
          session,
          colSoldiers,
          0
        );
        events.push(
          `[Volley ${session.volleysFired}] DIRECT WALL HIT! Boulder shatters masonry (-${wallDamage}% Wall${
            immediateDefenderLosses.soldiers > 0
              ? `, -${immediateDefenderLosses.soldiers} garrison`
              : ''
          })!`
        );
      } else {
        // OVER_WALL_COURTYARD
        wallDamage = session.deterministic
          ? 8
          : 5 + Math.floor(this.nextRandom(session) * 6); // 5..10
        const crushedSoldiers = session.deterministic
          ? 2
          : 1 + Math.floor(this.nextRandom(session) * 3); // 1..3
        immediateDefenderLosses = this.inflictDefenderCasualties(
          session,
          crushedSoldiers,
          0
        );
        events.push(
          `[Volley ${session.volleysFired}] Boulder clears the parapet into the courtyard (-${wallDamage}% Wall, -${immediateDefenderLosses.soldiers} Soldiers)!`
        );
      }
    } else if (ammo === 'GREEK_FIRE') {
      if (impactZone === 'OVER_WALL_COURTYARD') {
        ignitedOnShot = !session.isOnFire;
        session.isOnFire = true;

        const defTotal = this.getDefenderTotalArmy(session);
        const totalCombat = defTotal.soldiers + defTotal.knights;
        if (totalCombat > 0) {
          const burnFrac = session.deterministic
            ? 0.2
            : 0.15 + this.nextRandom(session) * 0.1; // 15%..25%
          const minBurn = session.deterministic
            ? 3
            : 2 + Math.floor(this.nextRandom(session) * 4); // 2..5
          const targetKilled = Math.min(
            totalCombat,
            Math.max(minBurn, Math.round(totalCombat * burnFrac))
          );
          immediateDefenderLosses = this.inflictProportionalDefenderCasualties(
            session,
            targetKilled
          );
        }

        const burnedTotal =
          immediateDefenderLosses.soldiers + immediateDefenderLosses.knights;
        events.push(
          `[Volley ${session.volleysFired}] GREEK FIRE INFERNO! Barracks ablaze inside ${session.territoryName} (-${burnedTotal} troops: -${immediateDefenderLosses.soldiers}S, -${immediateDefenderLosses.knights}K)!`
        );
      } else {
        // WALL_HIT
        wallDamage = 5;
        session.wallScorched = true;
        immediateDefenderLosses = this.inflictDefenderCasualties(session, 1, 0);
        events.push(
          `[Volley ${session.volleysFired}] Greek Fire pot shatters on outer stone (-5% scorched wall${
            immediateDefenderLosses.soldiers > 0
              ? `, -${immediateDefenderLosses.soldiers} Soldier`
              : ''
          }). Aim OVER WALL!`
        );
      }
    } else if (ammo === 'DISEASE') {
      if (impactZone === 'OVER_WALL_COURTYARD') {
        infectedOnShot = !session.isPlagueInfected;
        session.isPlagueInfected = true;

        const defTotal = this.getDefenderTotalArmy(session);
        const totalCombat = defTotal.soldiers + defTotal.knights;
        if (totalCombat > 0) {
          const plagueFrac = session.deterministic
            ? 0.125
            : 0.1 + this.nextRandom(session) * 0.05; // 10%..15%
          const targetKilled = Math.min(
            totalCombat,
            Math.max(1, Math.round(totalCombat * plagueFrac))
          );
          immediateDefenderLosses = this.inflictProportionalDefenderCasualties(
            session,
            targetKilled
          );
        }

        const killedNow =
          immediateDefenderLosses.soldiers + immediateDefenderLosses.knights;
        events.push(
          `[Volley ${session.volleysFired}] PLAGUE UNLEASHED! Pestilence grips ${session.territoryName} (-${killedNow} troops, -2 Defender Leadership)!`
        );
      } else {
        // WALL_HIT
        wallDamage = 2;
        events.push(
          `[Volley ${session.volleysFired}] Plague cask splinters harmlessly against outer stone (-2% Wall). Aim OVER WALL!`
        );
      }
    }

    // 2. Apply Wall Structural Degradation & Check Breach
    session.wallIntegrity = Math.max(0, session.wallIntegrity - wallDamage);
    const wallIntegrityAfter = session.wallIntegrity;
    if (wallIntegrityBefore > 0 && wallIntegrityAfter <= 0) {
      session.wallBreached = true;
      wallBreachedOnShot = true;
      events.push(
        `💥 THE CURTAIN WALL COLLAPSES! ${session.territoryName}'s ramparts are BREACHED (0% Castle Armor)!`
      );
    }

    // 3. Ongoing Plague Attrition (1..3 soldiers after every subsequent shot once infected)
    if (wasPlagueInfectedBeforeShot) {
      const attrCount = session.deterministic
        ? 2
        : 1 + Math.floor(this.nextRandom(session) * 3); // 1..3
      plagueAttritionLosses = this.inflictDefenderCasualties(session, attrCount, 0);
      if (plagueAttritionLosses.soldiers > 0) {
        events.push(
          `☠ Plague festers inside the keep: -${plagueAttritionLosses.soldiers} defending Soldier${
            plagueAttritionLosses.soldiers > 1 ? 's' : ''
          } perish!`
        );
      }
    }

    const totalDefenderLosses: Army = {
      soldiers: immediateDefenderLosses.soldiers + plagueAttritionLosses.soldiers,
      knights: immediateDefenderLosses.knights + plagueAttritionLosses.knights,
      catapults: immediateDefenderLosses.catapults + plagueAttritionLosses.catapults,
    };

    // 4. Defender Counter-Battery Fire (if wall intact, defenders survive, and volleys continue)
    let counterFireTriggered = false;
    let attackerCounterLosses: Army = { soldiers: 0, knights: 0, catapults: 0 };
    const remDef = this.getDefenderTotalArmy(session);
    const defendersAlive = remDef.soldiers + remDef.knights > 0;

    if (
      session.enableCounterFire &&
      !session.wallBreached &&
      defendersAlive &&
      session.shotsRemaining > 0
    ) {
      const counterRoll = this.nextRandom(session);
      if (counterRoll < this.COUNTER_FIRE_CHANCE) {
        counterFireTriggered = true;
        attackerCounterLosses = this.applyCounterFireToAttacker(session);
        if (attackerCounterLosses.catapults > 0) {
          events.push(
            `🏹 Castle mangonel counter-fire smashes 1 of ${session.attackerName}'s Catapults!`
          );
        } else if (attackerCounterLosses.soldiers > 0) {
          events.push(
            `🏹 Defender longbowmen loose from the battlements: -${attackerCounterLosses.soldiers} ${session.attackerName} Soldier${
              attackerCounterLosses.soldiers > 1 ? 's' : ''
            }!`
          );
        } else {
          counterFireTriggered = false;
        }
      }
    }

    // 5. Shift Wind Slightly Between Volleys
    if (session.shotsRemaining > 0) {
      const shift = session.deterministic
        ? session.volleysFired % 2 === 1
          ? 2
          : -2
        : Math.round((this.nextRandom(session) - 0.5) * 6); // -3..+3
      session.wind = Math.max(
        this.WIND_MIN,
        Math.min(this.WIND_MAX, session.wind + shift)
      );
    } else {
      session.status = 'VOLLEYS_EXHAUSTED';
      events.push(
        `All catapult volleys expended — prepare to storm ${session.territoryName}!`
      );
    }

    for (const ev of events) {
      this.pushLog(session, ev);
    }

    const report: SiegeVolleyReport = {
      shotNumber: session.volleysFired,
      ammo,
      power: clampedPower,
      windBefore,
      windEffect,
      jitter,
      effectiveDistance,
      impactZone,
      wallIntegrityBefore,
      wallIntegrityAfter,
      wallDamage,
      wallBreachedOnShot,
      ignitedOnShot,
      infectedOnShot,
      immediateDefenderLosses,
      plagueAttritionLosses,
      totalDefenderLosses,
      counterFireTriggered,
      attackerCounterLosses,
      windAfter: session.wind,
      shotsRemaining: session.shotsRemaining,
      events,
    };

    session.volleyHistory.push(report);
    session.lastVolleyReport = report;
    return report;
  }

  /**
   * AI Siege Commander shot selection (used when an AI Lord besieges a Player-owned Castle).
   * Compensates intelligently for Wind based on Leadership!
   */
  public static chooseAiSiegeShot(session: SiegeSession): {
    ammo: SiegeAmmoType;
    power: number;
  } {
    const defTotal = this.getDefenderTotalArmy(session);
    const totalDefTroops = defTotal.soldiers + defTotal.knights;

    let ammo: SiegeAmmoType = 'BOULDER';
    if (!session.isPlagueInfected && session.volleysFired === 0 && totalDefTroops >= 16) {
      ammo = 'DISEASE';
    } else if (session.wallBreached || (session.wallIntegrity <= 25 && totalDefTroops >= 14)) {
      ammo = !session.isPlagueInfected && session.shotsRemaining >= 3 ? 'DISEASE' : 'GREEK_FIRE';
    } else {
      ammo = 'BOULDER';
    }

    const targetZone = SIEGE_AMMO_PROFILES[ammo].sweetspot;
    const window = this.getPowerWindowForZone(targetZone, session.wind);
    const skillErrorRange = Math.max(2, 12 - session.attackerLeadership);
    const aimOffset = session.deterministic
      ? 0
      : Math.round((this.nextRandom(session) * 2 - 1) * skillErrorRange);

    const power = Math.max(0, Math.min(100, window.idealPower + aimOffset));
    return { ammo, power };
  }

  /**
   * Auto-fires all remaining AI catapult volleys (e.g. if Player fast-forwards defensive watch mode).
   */
  public static resolveRemainingAiVolleys(session: SiegeSession): SiegeVolleyReport[] {
    const reports: SiegeVolleyReport[] = [];
    while (session.shotsRemaining > 0 && session.status === 'ACTIVE') {
      const choice = this.chooseAiSiegeShot(session);
      reports.push(this.fireVolley(session, choice.power, choice.ammo));
    }
    return reports;
  }

  /**
   * Builds the PendingBattleContext payload carrying all post-siege casualties,
   * remaining wallIntegrity, fire/plague status, and breach flags into BattleEngine.
   */
  public static buildPostSiegeBattleContext(
    session: SiegeSession
  ): PendingBattleContext {
    if (session.status !== 'ABANDONED') {
      session.status = 'ASSAULT_READY';
    }

    const initDefTotal: Army = {
      soldiers:
        session.initialDefenderGarrison.soldiers +
        session.initialDefenderFieldArmy.soldiers,
      knights:
        session.initialDefenderGarrison.knights +
        session.initialDefenderFieldArmy.knights,
      catapults:
        session.initialDefenderGarrison.catapults +
        session.initialDefenderFieldArmy.catapults,
    };

    const currDefTotal = this.getDefenderTotalArmy(session);

    const siegeModifiers: SiegeOutcomeModifiers = {
      wallIntegrity: session.wallIntegrity,
      wallBreached: session.wallBreached || session.wallIntegrity <= 0,
      isPlagueInfected: session.isPlagueInfected,
      isOnFire: session.isOnFire,
      volleysFired: session.volleysFired,
      postSiegeAttackerArmy: { ...session.attackerArmy },
      postSiegeDefenderGarrison: { ...session.defenderGarrison },
      postSiegeDefenderFieldArmy: { ...session.defenderFieldArmy },
      siegeAttackerCasualties: {
        soldiers: Math.max(
          0,
          session.initialAttackerArmy.soldiers - session.attackerArmy.soldiers
        ),
        knights: Math.max(
          0,
          session.initialAttackerArmy.knights - session.attackerArmy.knights
        ),
        catapults: Math.max(
          0,
          session.initialAttackerArmy.catapults - session.attackerArmy.catapults
        ),
      },
      siegeDefenderCasualties: {
        soldiers: Math.max(0, initDefTotal.soldiers - currDefTotal.soldiers),
        knights: Math.max(0, initDefTotal.knights - currDefTotal.knights),
        catapults: Math.max(0, initDefTotal.catapults - currDefTotal.catapults),
      },
    };

    return {
      attackerId: session.attackerId,
      defenderId: session.defenderId,
      territoryId: session.territoryId,
      originTerritoryId: session.originTerritoryId,
      hasCastle: true,
      mode: session.mode,
      siege: siegeModifiers,
    };
  }

  /**
   * Abandons the siege (Retreat), applying the standard 15% parting casualty penalty to the
   * besieging army, returning them to originTerritoryId, and committing siege results to GameState.
   */
  public static abandonSiege(
    session: SiegeSession,
    gameState: GameState = GameState.getInstance()
  ): BattleResult {
    return gameState.mutateState((state) => this.abandonSiegeOnState(state, session));
  }

  /**
   * Pure state mutator for Abandoning a Siege (Retreat).
   */
  public static abandonSiegeOnState(
    state: CampaignState,
    session: SiegeSession
  ): BattleResult {
    if (session.status === 'ABANDONED' && session.abandonedResult) {
      return session.abandonedResult;
    }

    const attacker = state.activeLords[session.attackerId];
    const territory = state.territories[session.territoryId];
    const defender = session.defenderId ? state.activeLords[session.defenderId] : undefined;

    if (!attacker || !territory) {
      throw new Error('Cannot abandon siege: invalid attacker or territory in state.');
    }

    const remSoldiers = session.attackerArmy.soldiers;
    const remKnights = session.attackerArmy.knights;
    let lossSoldiers =
      remSoldiers > 0
        ? Math.max(
            remSoldiers >= 4 ? 1 : 0,
            Math.round(remSoldiers * this.RETREAT_PENALTY_RATE)
          )
        : 0;
    let lossKnights =
      remKnights > 0 ? Math.round(remKnights * this.RETREAT_PENALTY_RATE) : 0;

    // Preserve at least 1 combat unit on orderly siege withdrawal if >= 1 existed
    if (
      remSoldiers + remKnights >= 1 &&
      remSoldiers - lossSoldiers + (remKnights - lossKnights) <= 0
    ) {
      if (remKnights > 0) {
        lossKnights = remKnights - 1;
        lossSoldiers = remSoldiers;
      } else {
        lossSoldiers = remSoldiers - 1;
      }
    }

    session.attackerArmy.soldiers = Math.max(0, remSoldiers - lossSoldiers);
    session.attackerArmy.knights = Math.max(0, remKnights - lossKnights);
    session.retreatPenaltyLosses = {
      soldiers: lossSoldiers,
      knights: lossKnights,
      catapults: 0,
    };
    session.status = 'ABANDONED';

    // Commit attacker back to originTerritoryId and persist any defender siege casualties
    attacker.campaignArmy = { ...session.attackerArmy };
    attacker.currentTerritoryId = session.originTerritoryId;
    territory.garrison = { ...session.defenderGarrison };
    if (session.isDefenderFieldArmyPresent && defender) {
      defender.campaignArmy = { ...session.defenderFieldArmy };
    }

    state.hasConqueredThisTurn[attacker.id] = true;
    state.phase = 'CAMPAIGN_MAP';

    const attackerCasualties: Army = {
      soldiers: Math.max(
        0,
        session.initialAttackerArmy.soldiers - session.attackerArmy.soldiers
      ),
      knights: Math.max(
        0,
        session.initialAttackerArmy.knights - session.attackerArmy.knights
      ),
      catapults: Math.max(
        0,
        session.initialAttackerArmy.catapults - session.attackerArmy.catapults
      ),
    };

    const initDefTotal: Army = {
      soldiers:
        session.initialDefenderGarrison.soldiers +
        session.initialDefenderFieldArmy.soldiers,
      knights:
        session.initialDefenderGarrison.knights +
        session.initialDefenderFieldArmy.knights,
      catapults:
        session.initialDefenderGarrison.catapults +
        session.initialDefenderFieldArmy.catapults,
    };
    const survDefTotal = this.getDefenderTotalArmy(session);

    const defenderCasualties: Army = {
      soldiers: Math.max(0, initDefTotal.soldiers - survDefTotal.soldiers),
      knights: Math.max(0, initDefTotal.knights - survDefTotal.knights),
      catapults: Math.max(0, initDefTotal.catapults - survDefTotal.catapults),
    };

    const message = `${attacker.name} abandoned the siege of ${territory.name} and withdrew to ${session.originTerritoryName}.`;
    state.log.push(message);

    const result: BattleResult = {
      allowed: true,
      attackerWon: false,
      retreated: true,
      retreatingSide: 'attacker',
      attackerId: attacker.id,
      defenderId: session.defenderId,
      territoryId: territory.id,
      attackerStrength: CombatResolver.calculateCombatStrength(
        session.initialAttackerArmy,
        session.attackerLeadership,
        false
      ),
      defenderStrength: CombatResolver.calculateCombatStrength(
        initDefTotal,
        session.defenderLeadership,
        true
      ),
      attackerCasualties,
      defenderCasualties,
      homeCastleCaptured: false,
      eliminatedLordId: null,
      campaignVictoryTriggered: false,
      campaignDefeatTriggered: false,
      message,
    };

    session.abandonedResult = result;
    return result;
  }

  private static inflictProportionalDefenderCasualties(
    session: SiegeSession,
    totalToKill: number
  ): Army {
    const defTotal = this.getDefenderTotalArmy(session);
    const totalCombat = defTotal.soldiers + defTotal.knights;
    if (totalCombat <= 0 || totalToKill <= 0) {
      return { soldiers: 0, knights: 0, catapults: 0 };
    }

    const capped = Math.min(totalCombat, totalToKill);
    let knightsToLose =
      defTotal.knights > 0
        ? Math.min(
            defTotal.knights,
            Math.round(capped * (defTotal.knights / totalCombat))
          )
        : 0;
    let soldiersToLose = Math.min(defTotal.soldiers, capped - knightsToLose);

    if (soldiersToLose + knightsToLose < capped) {
      knightsToLose = Math.min(
        defTotal.knights,
        knightsToLose + (capped - soldiersToLose - knightsToLose)
      );
    }

    return this.inflictDefenderCasualties(session, soldiersToLose, knightsToLose);
  }

  private static inflictDefenderCasualties(
    session: SiegeSession,
    soldiersWanted: number,
    knightsWanted: number
  ): Army {
    const deductSplit = (
      wanted: number,
      garVal: number,
      fieldVal: number
    ): { nextGar: number; nextField: number; actualLost: number } => {
      const avail = garVal + fieldVal;
      const actual = Math.max(0, Math.min(avail, wanted));
      if (actual <= 0) {
        return { nextGar: garVal, nextField: fieldVal, actualLost: 0 };
      }
      // Deduct from castle garrison first, then stationed field army
      const fromGar = Math.min(garVal, actual);
      const fromField = Math.min(fieldVal, actual - fromGar);
      return {
        nextGar: garVal - fromGar,
        nextField: fieldVal - fromField,
        actualLost: fromGar + fromField,
      };
    };

    const s = deductSplit(
      soldiersWanted,
      session.defenderGarrison.soldiers,
      session.defenderFieldArmy.soldiers
    );
    const k = deductSplit(
      knightsWanted,
      session.defenderGarrison.knights,
      session.defenderFieldArmy.knights
    );

    session.defenderGarrison.soldiers = s.nextGar;
    session.defenderFieldArmy.soldiers = s.nextField;
    session.defenderGarrison.knights = k.nextGar;
    session.defenderFieldArmy.knights = k.nextField;

    return {
      soldiers: s.actualLost,
      knights: k.actualLost,
      catapults: 0,
    };
  }

  /**
   * Resolves a single defender counter-battery strike against the besieging army.
   */
  public static applyCounterFireToAttacker(session: SiegeSession): Army {
    // Small chance to damage/destroy an extra catapult if siege drags on (>= 4 volleys) and > 1 catapult
    if (
      session.volleysFired >= 4 &&
      session.attackerArmy.catapults > 1 &&
      (session.deterministic || this.nextRandom(session) < 0.28)
    ) {
      session.attackerArmy.catapults -= 1;
      session.shotsRemaining = Math.min(
        session.shotsRemaining,
        Math.max(0, session.shotsRemaining - 1)
      );
      return { soldiers: 0, knights: 0, catapults: 1 };
    }

    const rawLoss = session.deterministic
      ? 1
      : 1 + Math.floor(this.nextRandom(session) * 2); // 1..2
    // Preserve at least 1 combat unit in attackerArmy so counter-arrows don't zero out the army mid-siege
    const minKeepSoldiers = session.attackerArmy.knights > 0 ? 0 : 1;
    const maxSoldierLoss = Math.max(
      0,
      session.attackerArmy.soldiers - minKeepSoldiers
    );
    const actualLost = Math.min(rawLoss, maxSoldierLoss);
    session.attackerArmy.soldiers -= actualLost;

    return {
      soldiers: actualLost,
      knights: 0,
      catapults: 0,
    };
  }

  private static pushLog(session: SiegeSession, entry: string): void {
    session.siegeLog.push(entry);
    if (session.siegeLog.length > 24) {
      session.siegeLog = session.siegeLog.slice(-24);
    }
  }

  private static nextRandom(session: SiegeSession): number {
    // Mulberry32 deterministic PRNG
    let t = (session.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
