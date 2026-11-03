import { GameState } from './GameState';
import { CombatResolver } from './CombatResolver';
import { Lord, MONTH_NAMES, TurnSummary, UNIT_COSTS } from './types';

/**
 * TurnManager
 * Orchestrates AI Lord decision-making, calendar progression (1149 -> 1150+),
 * monthly tax collection, and Chronicle logging.
 */
export class TurnManager {
  private gameState: GameState;

  constructor(gameState: GameState = GameState.getInstance()) {
    this.gameState = gameState;
  }

  /**
   * Executes a complete monthly turn cycle:
   * 1. Sequential AI turns (recruitment + movement/combat) for all active AI lords
   * 2. Calendar advancement (month 1..12, year rollover)
   * 3. Tax collection for all active undefeated lords
   * 4. Monthly Chronicle Log update
   */
  public endTurn(): TurnSummary {
    const preState = this.gameState.getState();

    if (preState.victoryStatus !== 'ONGOING') {
      return {
        year: preState.year,
        month: preState.month,
        turn: preState.turn,
        events: ['Campaign has already concluded.'],
        taxesCollected: {},
        victoryStatus: preState.victoryStatus,
      };
    }

    const turnEvents: string[] = [];
    const aiLordIds = Object.keys(preState.activeLords).filter(
      (id) => !preState.activeLords[id].isPlayer
    );

    // 1. Execute each active AI Lord's turn sequentially
    for (const aiId of aiLordIds) {
      const currentState = this.gameState.getState();
      if (currentState.victoryStatus !== 'ONGOING') {
        break;
      }

      const aiLord = currentState.activeLords[aiId];
      if (!aiLord || !aiLord.isActive || aiLord.isDefeated) {
        continue;
      }

      const aiEvent = this.executeAiLordTurn(aiId);
      if (aiEvent) {
        turnEvents.push(aiEvent);
      }
    }

    // Check if campaign ended during AI turns (e.g. Player Home Castle fell)
    const postAiState = this.gameState.getState();
    if (postAiState.victoryStatus !== 'ONGOING') {
      return {
        year: postAiState.year,
        month: postAiState.month,
        turn: postAiState.turn,
        events: turnEvents,
        taxesCollected: {},
        victoryStatus: postAiState.victoryStatus,
      };
    }

    // 2. Advance Calendar (month 1..12, year 1149 -> 1150+, turn++)
    const calendar = this.gameState.advanceCalendar();
    const monthName = MONTH_NAMES[(calendar.month - 1) % 12];

    // 3. Collect Taxes for all active, undefeated Lords
    const taxesCollected = this.gameState.collectTaxes();
    const playerLord = this.gameState.getPlayerLord();
    const playerTax = taxesCollected[playerLord.id] ?? 0;

    // 4. Record Monthly Chronicle Summary
    const taxMsg = `[${monthName} ${calendar.year}] Taxes collected: +${playerTax}G for ${playerLord.name}.`;
    this.gameState.addLog(taxMsg);
    turnEvents.push(taxMsg);

    return {
      year: calendar.year,
      month: calendar.month,
      turn: calendar.turn,
      events: turnEvents,
      taxesCollected,
      victoryStatus: this.gameState.getState().victoryStatus,
    };
  }

  /**
   * Executes recruitment and tactical movement for a single AI Lord.
   */
  public executeAiLordTurn(lordId: string): string | null {
    const stateBefore = this.gameState.getState();
    const lord = stateBefore.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return null;
    }

    // Step A: Tactical Recruitment
    this.executeAiRecruitment(lord);

    // Refresh lord state after recruitment
    const stateMid = this.gameState.getState();
    const updatedLord = stateMid.activeLords[lordId];
    if (!updatedLord || !updatedLord.isActive || updatedLord.isDefeated) {
      return null;
    }

    if (
      updatedLord.campaignArmy.soldiers <= 0 &&
      updatedLord.campaignArmy.knights <= 0
    ) {
      return null;
    }

    // Step B: Tactical Movement / Expansion / Invasion
    const reachable = this.gameState.getReachableTerritories(lordId);

    // 1. Check for vulnerable enemy Home Castles we can storm right now
    const attackableEnemies = reachable.enemyIds
      .map((tid) => {
        const preview = CombatResolver.calculateBattlePreview(stateMid, lordId, tid);
        const terr = stateMid.territories[tid];
        const owner = terr.ownerId ? stateMid.activeLords[terr.ownerId] : undefined;
        const isEnemyHome = Boolean(owner && owner.homeTerritoryId === tid);
        const isOppositeFaction = Boolean(owner && owner.faction !== updatedLord.faction);
        const requiredMargin = isOppositeFaction ? 1.15 : isEnemyHome ? 1.75 : 1.35;
        return { tid, terr, preview, isEnemyHome, isOppositeFaction, requiredMargin };
      })
      .filter(
        (cand) =>
          cand.preview.allowed &&
          cand.preview.attackerStrength >
            cand.preview.defenderStrength * cand.requiredMargin
      );

    const vulnerableHomeCastle = attackableEnemies.find(
      (c) =>
        c.isEnemyHome &&
        c.isOppositeFaction &&
        c.preview.attackerStrength > c.preview.defenderStrength * 1.25
    );

    if (vulnerableHomeCastle) {
      const moveRes = this.gameState.moveCampaignArmy(lordId, vulnerableHomeCastle.tid);
      return moveRes.message;
    }

    // 2. Claim highest-value adjacent Neutral territory
    if (reachable.neutralIds.length > 0) {
      const sortedNeutrals = [...reachable.neutralIds].sort((a, b) => {
        const ta = stateMid.territories[a];
        const tb = stateMid.territories[b];
        if (tb.taxIncome !== ta.taxIncome) {
          return tb.taxIncome - ta.taxIncome;
        }
        return tb.neighbors.length - ta.neighbors.length;
      });

      const moveRes = this.gameState.moveCampaignArmy(lordId, sortedNeutrals[0]);
      return moveRes.message;
    }

    // 3. Attack weakest / highest-value enemy territory
    if (attackableEnemies.length > 0) {
      attackableEnemies.sort((a, b) => {
        if (a.isOppositeFaction !== b.isOppositeFaction) {
          return a.isOppositeFaction ? -1 : 1;
        }
        const ratioA =
          a.preview.attackerStrength / Math.max(1, a.preview.defenderStrength);
        const ratioB =
          b.preview.attackerStrength / Math.max(1, b.preview.defenderStrength);
        return ratioB - ratioA;
      });

      const moveRes = this.gameState.moveCampaignArmy(lordId, attackableEnemies[0].tid);
      return moveRes.message;
    }

    // 4. Reposition back to Home Castle if idle in interior
    if (
      updatedLord.currentTerritoryId !== updatedLord.homeTerritoryId &&
      reachable.friendlyIds.includes(updatedLord.homeTerritoryId)
    ) {
      this.gameState.moveCampaignArmy(lordId, updatedLord.homeTerritoryId);
    }

    return null;
  }

  /**
   * AI Recruitment heuristics adhering strictly to 1986 unit costs:
   * - Buys a Catapult (15G) when gold >= 25 and lacking one in campaignArmy
   * - Reinforces Home Castle garrison if under-defended
   * - Recruits Knights (8G) and Soldiers (1G) while saving for a Catapult when needed
   */
  private executeAiRecruitment(lord: Lord): void {
    const state = this.gameState.getState();
    const reachable = this.gameState.getReachableTerritories(lord.id);

    // 1. Catapult Priority Rule: if gold >= 25 and lacking one, buy Catapult (15G)
    if (lord.gold >= 25 && lord.campaignArmy.catapults === 0) {
      this.gameState.purchaseUnit(lord.id, 'catapults', 1, 'campaign');
    }

    // Refresh gold check
    let currentLord = this.gameState.getLord(lord.id)!;

    // 2. Steadily fortify Home Stronghold garrison (up to 26 soldiers) so Home Castles require a true siege
    const homeTerr = this.gameState.getTerritory(currentLord.homeTerritoryId);
    if (
      homeTerr &&
      homeTerr.ownerId === currentLord.id &&
      homeTerr.garrison.soldiers < 26 &&
      currentLord.gold >= 4
    ) {
      const needed = Math.min(
        3,
        26 - homeTerr.garrison.soldiers,
        currentLord.gold - 2
      );
      if (needed > 0) {
        this.gameState.purchaseUnit(
          currentLord.id,
          'soldiers',
          needed,
          'garrison',
          homeTerr.id
        );
      }
    }

    currentLord = this.gameState.getLord(lord.id)!;

    // 3. Determine reserve gold (save toward 25G Catapult threshold if boxed in by Castles)
    const needsCatapultSoon =
      currentLord.campaignArmy.catapults === 0 &&
      reachable.neutralIds.length === 0 &&
      reachable.enemyIds.some((eid) => state.territories[eid]?.hasCastle);

    const goldReserve = needsCatapultSoon
      ? Math.min(currentLord.gold, 25)
      : currentLord.campaignArmy.catapults === 0 && currentLord.gold >= 12
      ? 6
      : 2;

    let spendableGold = Math.max(0, currentLord.gold - goldReserve);

    // Ensure on Turn 1 or low army counts AI always recruits at least a few troops if affordable
    if (
      spendableGold === 0 &&
      currentLord.gold >= 4 &&
      currentLord.campaignArmy.soldiers < 14 &&
      !needsCatapultSoon
    ) {
      spendableGold = Math.min(currentLord.gold - 2, 6);
    }

    // Buy Knights (8G) if rich enough
    while (spendableGold >= UNIT_COSTS.knights + 3) {
      const res = this.gameState.purchaseUnit(
        currentLord.id,
        'knights',
        1,
        'campaign'
      );
      if (!res.success) break;
      spendableGold -= UNIT_COSTS.knights;
    }

    // Spend remaining budget on Soldiers (1G)
    if (spendableGold >= UNIT_COSTS.soldiers) {
      this.gameState.purchaseUnit(
        currentLord.id,
        'soldiers',
        spendableGold,
        'campaign'
      );
    }
  }
}
