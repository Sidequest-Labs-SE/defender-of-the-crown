import { Army, BattleResult, CampaignState } from './types';
import { GameState } from './GameState';

export interface BattlePreview {
  allowed: boolean;
  blockReason?: string;
  attackerStrength: number;
  defenderStrength: number;
  defenderSoldiers: number;
  defenderKnights: number;
  hasCastleBonus: boolean;
}

/**
 * CombatResolver (Sprint 2 Deterministic Tactical Auto-Resolver)
 * Resolves field battles and castle sieges on the campaign map.
 * Will hook into interactive Field Battle & Catapult Siege mini-games in Sprints 3-6.
 */
export class CombatResolver {
  public static readonly CASTLE_SIEGE_BLOCK_MSG =
    'You need at least 1 Catapult in your Campaign Army to besiege a fortified Castle!';

  /**
   * Computes combat power: ((Soldiers * 1) + (Knights * 6) + (Archers * 2.5)) * (1 + leadership * 0.05) * (hasCastle ? (isRoyalKeep ? 1.40 : 1.25) : 1.0)
   */
  public static calculateCombatStrength(
    army: Pick<Army, 'soldiers' | 'knights'> & { archers?: number },
    leadership: number,
    hasCastleBonus = false,
    isRoyalKeep = false
  ): number {
    const archers = army.archers ?? 0;
    const base = army.soldiers * 1 + army.knights * 6 + archers * 2.5;
    const leadershipMod = 1 + leadership * 0.05;
    const castleMod = hasCastleBonus ? (isRoyalKeep ? 1.40 : 1.25) : 1.0;
    return Number((base * leadershipMod * castleMod).toFixed(2));
  }

  /**
   * Computes a non-mutating tactical preview of an invasion.
   */
  public static calculateBattlePreview(
    state: CampaignState,
    attackerLordId: string,
    targetTerritoryId: string
  ): BattlePreview {
    const attacker = state.activeLords[attackerLordId];
    const territory = state.territories[targetTerritoryId];

    if (!attacker || !territory) {
      return {
        allowed: false,
        blockReason: 'Invalid attacker or target territory.',
        attackerStrength: 0,
        defenderStrength: 0,
        defenderSoldiers: 0,
        defenderKnights: 0,
        hasCastleBonus: false,
      };
    }

    if (territory.hasCastle && attacker.campaignArmy.catapults === 0) {
      return {
        allowed: false,
        blockReason: this.CASTLE_SIEGE_BLOCK_MSG,
        attackerStrength: this.calculateCombatStrength(
          attacker.campaignArmy,
          attacker.leadership,
          false
        ),
        defenderStrength: 0,
        defenderSoldiers: territory.garrison.soldiers,
        defenderKnights: territory.garrison.knights,
        hasCastleBonus: territory.hasCastle,
      };
    }

    const defender = territory.ownerId ? state.activeLords[territory.ownerId] : undefined;
    const isDefenderArmyPresent = Boolean(
      defender &&
        defender.isActive &&
        !defender.isDefeated &&
        defender.currentTerritoryId === territory.id
    );

    const totalDefSoldiers =
      territory.garrison.soldiers + (isDefenderArmyPresent && defender ? defender.campaignArmy.soldiers : 0);
    const totalDefKnights =
      territory.garrison.knights + (isDefenderArmyPresent && defender ? defender.campaignArmy.knights : 0);
    const totalDefArchers =
      (territory.garrison.archers ?? 0) +
      (isDefenderArmyPresent && defender ? (defender.campaignArmy.archers ?? 0) : 0);

    const attackerStrength = this.calculateCombatStrength(
      attacker.campaignArmy,
      attacker.leadership,
      false
    );
    const defenderStrength = this.calculateCombatStrength(
      { soldiers: totalDefSoldiers, knights: totalDefKnights, archers: totalDefArchers },
      defender ? defender.leadership : 0,
      territory.hasCastle,
      Boolean(territory.isRoyalKeep)
    );

    return {
      allowed: true,
      attackerStrength,
      defenderStrength,
      defenderSoldiers: totalDefSoldiers,
      defenderKnights: totalDefKnights,
      hasCastleBonus: territory.hasCastle,
    };
  }

  /**
   * Public convenience entry point invoking auto-resolve directly against GameState singleton.
   */
  public static autoResolveInvasion(
    attackerLordId: string,
    targetTerritoryId: string
  ): BattleResult {
    return GameState.getInstance().resolveInvasion(attackerLordId, targetTerritoryId);
  }

  /**
   * Mutates the provided CampaignState deterministically to resolve an invasion of an enemy territory.
   */
  public static resolveInvasionOnState(
    state: CampaignState,
    attackerLordId: string,
    targetTerritoryId: string
  ): BattleResult {
    const attacker = state.activeLords[attackerLordId];
    const territory = state.territories[targetTerritoryId];

    if (!attacker || !territory) {
      return {
        allowed: false,
        attackerWon: false,
        attackerId: attackerLordId,
        defenderId: null,
        territoryId: targetTerritoryId,
        attackerStrength: 0,
        defenderStrength: 0,
        attackerCasualties: { soldiers: 0, knights: 0, catapults: 0 },
        defenderCasualties: { soldiers: 0, knights: 0, catapults: 0 },
        homeCastleCaptured: false,
        eliminatedLordId: null,
        campaignVictoryTriggered: false,
        campaignDefeatTriggered: false,
        message: 'Invalid invasion parameters.',
      };
    }

    const defenderId = territory.ownerId;
    const defender = defenderId ? state.activeLords[defenderId] : undefined;

    // 1. Castle Siege Catapult Requirement
    if (territory.hasCastle && attacker.campaignArmy.catapults === 0) {
      return {
        allowed: false,
        attackerWon: false,
        attackerId: attackerLordId,
        defenderId,
        territoryId: targetTerritoryId,
        attackerStrength: this.calculateCombatStrength(attacker.campaignArmy, attacker.leadership, false),
        defenderStrength: 0,
        attackerCasualties: { soldiers: 0, knights: 0, catapults: 0 },
        defenderCasualties: { soldiers: 0, knights: 0, catapults: 0 },
        homeCastleCaptured: false,
        eliminatedLordId: null,
        campaignVictoryTriggered: false,
        campaignDefeatTriggered: false,
        message: this.CASTLE_SIEGE_BLOCK_MSG,
      };
    }

    // 2. Strength Calculation
    const isDefenderArmyPresent = Boolean(
      defender &&
        defender.isActive &&
        !defender.isDefeated &&
        defender.currentTerritoryId === territory.id
    );

    const initAttSoldiers = attacker.campaignArmy.soldiers;
    const initAttKnights = attacker.campaignArmy.knights;
    const initAttCatapults = attacker.campaignArmy.catapults;
    const initAttArchers = attacker.campaignArmy.archers ?? 0;

    const initGarSoldiers = territory.garrison.soldiers;
    const initGarKnights = territory.garrison.knights;
    const initGarCatapults = territory.garrison.catapults;
    const initGarArchers = territory.garrison.archers ?? 0;

    const initDefFieldSoldiers = isDefenderArmyPresent && defender ? defender.campaignArmy.soldiers : 0;
    const initDefFieldKnights = isDefenderArmyPresent && defender ? defender.campaignArmy.knights : 0;
    const initDefFieldCatapults = isDefenderArmyPresent && defender ? defender.campaignArmy.catapults : 0;
    const initDefFieldArchers = isDefenderArmyPresent && defender ? (defender.campaignArmy.archers ?? 0) : 0;

    const totalDefSoldiers = initGarSoldiers + initDefFieldSoldiers;
    const totalDefKnights = initGarKnights + initDefFieldKnights;
    const totalDefArchers = initGarArchers + initDefFieldArchers;

    const attackerStrength = this.calculateCombatStrength(
      attacker.campaignArmy,
      attacker.leadership,
      false
    );
    const defenderStrength = this.calculateCombatStrength(
      { soldiers: totalDefSoldiers, knights: totalDefKnights, archers: totalDefArchers },
      defender ? defender.leadership : 0,
      territory.hasCastle,
      Boolean(territory.isRoyalKeep)
    );

    // 3. Resolution
    if (attackerStrength > defenderStrength) {
      // ATTACKER WINS
      const ratio = attackerStrength > 0 ? defenderStrength / attackerStrength : 0;
      const lossFraction = Math.min(0.85, ratio * 0.75);

      let survSoldiers = Math.max(0, Math.round(initAttSoldiers * (1 - lossFraction)));
      let survKnights = Math.max(0, Math.round(initAttKnights * (1 - lossFraction)));
      let survArchers = Math.max(0, Math.round(initAttArchers * (1 - lossFraction)));
      const survCatapults = initAttCatapults;

      if (survSoldiers === 0 && survKnights === 0 && survArchers === 0) {
        if (initAttKnights > 0) {
          survKnights = 1;
        } else if (initAttArchers > 0) {
          survArchers = 1;
        } else {
          survSoldiers = 1;
        }
      }

      const attackerCasualties: Army = {
        soldiers: initAttSoldiers - survSoldiers,
        knights: initAttKnights - survKnights,
        catapults: 0,
        archers: initAttArchers - survArchers,
      };

      // Defender garrison in captured territory is wiped out
      territory.garrison = { soldiers: 0, knights: 0, catapults: 0, archers: 0 };

      let defFieldCasSoldiers = initDefFieldSoldiers;
      let defFieldCasKnights = initDefFieldKnights;
      let defFieldCasCatapults = initDefFieldCatapults;
      let defFieldCasArchers = initDefFieldArchers;

      const isHomeCastleCapture = Boolean(defender && territory.id === defender.homeTerritoryId);

      // If defender's field army was here on a non-home territory, retreat surviving 25% to home castle
      if (isDefenderArmyPresent && defender && !isHomeCastleCapture) {
        const retreatSoldiers = Math.floor(initDefFieldSoldiers * 0.25);
        const retreatKnights = Math.floor(initDefFieldKnights * 0.25);
        const retreatArchers = Math.floor(initDefFieldArchers * 0.25);
        defender.campaignArmy = {
          soldiers: retreatSoldiers,
          knights: retreatKnights,
          catapults: 0,
          archers: retreatArchers,
        };
        defFieldCasSoldiers = initDefFieldSoldiers - retreatSoldiers;
        defFieldCasKnights = initDefFieldKnights - retreatKnights;
        defFieldCasArchers = initDefFieldArchers - retreatArchers;

        // Relocate retreating army to defender's home territory or another owned territory
        const fallbackTerritory =
          state.territories[defender.homeTerritoryId]?.ownerId === defender.id
            ? defender.homeTerritoryId
            : Object.values(state.territories).find(
                (t) => t.ownerId === defender.id && t.id !== territory.id
              )?.id;

        if (fallbackTerritory) {
          defender.currentTerritoryId = fallbackTerritory;
        }
      }

      const defenderCasualties: Army = {
        soldiers: initGarSoldiers + defFieldCasSoldiers,
        knights: initGarKnights + defFieldCasKnights,
        catapults: initGarCatapults + defFieldCasCatapults,
        archers: initGarArchers + defFieldCasArchers,
      };

      // Transfer territory ownership & occupy with attacker's campaign army
      territory.ownerId = attacker.id;
      attacker.currentTerritoryId = territory.id;
      attacker.campaignArmy = {
        soldiers: survSoldiers,
        knights: survKnights,
        catapults: survCatapults,
        archers: survArchers,
      };

      let eliminatedLordId: string | null = null;
      let campaignVictoryTriggered = false;
      let campaignDefeatTriggered = false;
      let message = `${attacker.name} conquered ${territory.name} from ${
        defender ? defender.name : 'the garrison'
      }!`;

      // CRITICAL RULE: Home Castle Elimination
      if (isHomeCastleCapture && defender) {
        defender.isActive = false;
        defender.isDefeated = true;
        defender.campaignArmy = { soldiers: 0, knights: 0, catapults: 0 };
        eliminatedLordId = defender.id;
        if (state.captiveDamsel?.captorLordId === defender.id) {
          state.captiveDamsel = null;
        }

        // Revert all other territories owned by the defeated lord to Neutral
        for (const otherTerr of Object.values(state.territories)) {
          if (otherTerr.ownerId === defender.id && otherTerr.id !== territory.id) {
            otherTerr.ownerId = null;
            otherTerr.garrison = { soldiers: 0, knights: 0, catapults: 0 };
          }
        }

        message = `${attacker.name} stormed ${territory.name} and defeated ${defender.name}! Outlying lands turn neutral!`;
      }

      // Check Campaign Defeat (if Player lost Home Castle) or Campaign Victory (all enemy lords defeated)
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

      state.log.push(message);

      return {
        allowed: true,
        attackerWon: true,
        attackerId: attacker.id,
        defenderId,
        territoryId: territory.id,
        attackerStrength,
        defenderStrength,
        attackerCasualties,
        defenderCasualties,
        homeCastleCaptured: isHomeCastleCapture,
        eliminatedLordId,
        campaignVictoryTriggered,
        campaignDefeatTriggered,
        message,
      };
    } else {
      // DEFENDER HOLDS / ATTACKER REPULSED
      const defLossFraction =
        defenderStrength > 0 ? Math.min(0.75, (attackerStrength / defenderStrength) * 0.65) : 0;
      const attLossFraction = 0.65;

      // Apply attacker losses (retreats back to origin territory)
      const survAttSoldiers = Math.max(0, Math.floor(initAttSoldiers * (1 - attLossFraction)));
      const survAttKnights = Math.max(0, Math.floor(initAttKnights * (1 - attLossFraction)));
      const survAttArchers = Math.max(0, Math.floor(initAttArchers * (1 - attLossFraction)));
      const survAttCatapults =
        attackerStrength < defenderStrength * 0.6 && initAttCatapults > 0
          ? initAttCatapults - 1
          : initAttCatapults;

      attacker.campaignArmy = {
        soldiers: survAttSoldiers,
        knights: survAttKnights,
        catapults: survAttCatapults,
        archers: survAttArchers,
      };

      // Apply defender proportional losses across garrison and field army (if present)
      let survGarSoldiers = Math.max(0, Math.round(initGarSoldiers * (1 - defLossFraction)));
      let survGarKnights = Math.max(0, Math.round(initGarKnights * (1 - defLossFraction)));
      let survGarArchers = Math.max(0, Math.round(initGarArchers * (1 - defLossFraction)));

      let survDefFieldSoldiers = initDefFieldSoldiers;
      let survDefFieldKnights = initDefFieldKnights;
      let survDefFieldArchers = initDefFieldArchers;

      if (isDefenderArmyPresent && defender) {
        survDefFieldSoldiers = Math.max(0, Math.round(initDefFieldSoldiers * (1 - defLossFraction)));
        survDefFieldKnights = Math.max(0, Math.round(initDefFieldKnights * (1 - defLossFraction)));
        survDefFieldArchers = Math.max(0, Math.round(initDefFieldArchers * (1 - defLossFraction)));
      }

      // Ensure at least 1 defending unit survives if there were combat units
      if (
        totalDefSoldiers + totalDefKnights + totalDefArchers > 0 &&
        survGarSoldiers + survGarKnights + survGarArchers + survDefFieldSoldiers + survDefFieldKnights + survDefFieldArchers === 0
      ) {
        if (initGarKnights > 0) survGarKnights = 1;
        else if (initGarArchers > 0) survGarArchers = 1;
        else if (initGarSoldiers > 0) survGarSoldiers = 1;
        else if (initDefFieldKnights > 0) survDefFieldKnights = 1;
        else if (initDefFieldArchers > 0) survDefFieldArchers = 1;
        else survDefFieldSoldiers = 1;
      }

      territory.garrison = {
        soldiers: survGarSoldiers,
        knights: survGarKnights,
        catapults: initGarCatapults,
        archers: survGarArchers,
      };

      if (isDefenderArmyPresent && defender) {
        defender.campaignArmy = {
          soldiers: survDefFieldSoldiers,
          knights: survDefFieldKnights,
          catapults: initDefFieldCatapults,
          archers: survDefFieldArchers,
        };
      }

      const attackerCasualties: Army = {
        soldiers: initAttSoldiers - survAttSoldiers,
        knights: initAttKnights - survAttKnights,
        catapults: initAttCatapults - survAttCatapults,
        archers: initAttArchers - survAttArchers,
      };

      const defenderCasualties: Army = {
        soldiers:
          initGarSoldiers - survGarSoldiers + (initDefFieldSoldiers - survDefFieldSoldiers),
        knights:
          initGarKnights - survGarKnights + (initDefFieldKnights - survDefFieldKnights),
        catapults: 0,
        archers:
          initGarArchers - survGarArchers + (initDefFieldArchers - survDefFieldArchers),
      };

      const message = `${attacker.name}'s assault on ${territory.name} was repulsed by ${
        defender ? defender.name : 'the defenders'
      }!`;
      state.log.push(message);

      return {
        allowed: true,
        attackerWon: false,
        attackerId: attacker.id,
        defenderId,
        territoryId: territory.id,
        attackerStrength,
        defenderStrength,
        attackerCasualties,
        defenderCasualties,
        homeCastleCaptured: false,
        eliminatedLordId: null,
        campaignVictoryTriggered: false,
        campaignDefeatTriggered: false,
        message,
      };
    }
  }
}
