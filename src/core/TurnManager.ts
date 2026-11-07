import { GameState } from './GameState';
import { CombatResolver } from './CombatResolver';
import { SAXON_DAMSELS } from '../data/damsels';
import {
  AiTurnQueueState,
  InteractiveTurnResult,
  Lord,
  MONTH_NAMES,
  MoveResult,
  TurnSummary,
  UNIT_COSTS,
} from './types';

/**
 * TurnManager
 * Orchestrates AI Lord decision-making, calendar progression (1149 -> 1150+),
 * monthly tax collection, and Chronicle logging.
 * Supports both synchronous headless execution (endTurn) and interactive pause/resume
 * when an AI Lord attacks a defended Player territory (beginInteractiveTurn / continueInteractiveTurn).
 */
export class TurnManager {
  private gameState: GameState;

  constructor(gameState: GameState = GameState.getInstance()) {
    this.gameState = gameState;
  }

  /**
   * Starts an interactive monthly turn from MapScene.
   * Pauses and returns PAUSED_FOR_PLAYER_DEFENSE if an AI Lord invades a defended Player territory;
   * otherwise completes all AI turns, advances the calendar, and collects monthly taxes.
   */
  public beginInteractiveTurn(): InteractiveTurnResult {
    const preState = this.gameState.getState();

    if (preState.victoryStatus !== 'ONGOING') {
      return {
        status: 'TURN_COMPLETE',
        summary: {
          year: preState.year,
          month: preState.month,
          turn: preState.turn,
          events: ['Campaign has already concluded.'],
          taxesCollected: {},
          victoryStatus: preState.victoryStatus,
        },
      };
    }

    const aiLordIds = Object.keys(preState.activeLords).filter(
      (id) => !preState.activeLords[id].isPlayer
    );

    const queueState: AiTurnQueueState = {
      remainingAiLordIds: [...aiLordIds],
      events: [],
    };

    return this.continueInteractiveTurn(queueState);
  }

  /**
   * Continues processing a paused AI turn queue after an interactive Player defense BattleScene concludes.
   */
  public continueInteractiveTurn(queueState: AiTurnQueueState): InteractiveTurnResult {
    while (queueState.remainingAiLordIds.length > 0) {
      const currentState = this.gameState.getState();
      if (currentState.victoryStatus !== 'ONGOING') {
        break;
      }

      const aiId = queueState.remainingAiLordIds.shift()!;
      const aiLord = currentState.activeLords[aiId];
      if (!aiLord || !aiLord.isActive || aiLord.isDefeated) {
        continue;
      }

      const moveRes = this.stepSingleAiLord(aiId, true);
      if (!moveRes) {
        continue;
      }

      if (moveRes.outcome === 'BATTLE_PENDING' && moveRes.pendingBattle) {
        queueState.events.push(moveRes.message);
        return {
          status: 'PAUSED_FOR_PLAYER_DEFENSE',
          pendingBattle: moveRes.pendingBattle,
          queueState: {
            remainingAiLordIds: [...queueState.remainingAiLordIds],
            events: [...queueState.events],
          },
        };
      }

      if (moveRes.message) {
        queueState.events.push(moveRes.message);
      }
    }

    // Check if campaign ended during AI turns (e.g. Player Home Castle fell)
    const postAiState = this.gameState.getState();
    if (postAiState.victoryStatus !== 'ONGOING') {
      return {
        status: 'TURN_COMPLETE',
        summary: {
          year: postAiState.year,
          month: postAiState.month,
          turn: postAiState.turn,
          events: queueState.events,
          taxesCollected: {},
          victoryStatus: postAiState.victoryStatus,
        },
      };
    }

    // Advance Calendar & Collect Monthly Taxes
    const summary = this.finalizeCalendarAndTaxes(queueState.events);
    return {
      status: 'TURN_COMPLETE',
      summary,
    };
  }

  /**
   * Executes a complete monthly turn cycle synchronously (headless / AI-vs-AI auto-resolve):
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

    return this.finalizeCalendarAndTaxes(turnEvents);
  }

  private finalizeCalendarAndTaxes(turnEvents: string[]): TurnSummary {
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

    // 5. Periodic Captured Saxon Damsel Campaign Event (Turns 3, 6, 9, 12...)
    const latestState = this.gameState.getState();
    if (
      latestState.victoryStatus === 'ONGOING' &&
      calendar.turn % 3 === 0 &&
      !latestState.captiveDamsel
    ) {
      const ev = this.gameState.triggerDamselCaptureEvent();
      if (ev) {
        const lady = SAXON_DAMSELS[ev.damselId];
        const captor = latestState.activeLords[ev.captorLordId];
        const terr = latestState.territories[ev.castleTerritoryId];
        turnEvents.push(
          `[DAMSEL IN DISTRESS] ${lady.name} is held captive by ${
            captor?.name ?? 'a Norman Baron'
          } in ${terr?.name ?? 'the keep'}!`
        );
      }
    }

    // 6. Periodic Royal Tournament Announcement (Turns 4, 8, 12...)
    if (latestState.victoryStatus === 'ONGOING' && calendar.turn % 4 === 0) {
      const tournMsg = `[ROYAL TOURNAMENT] The King's Marshal proclaims a Grand Tournament! Champions may tilt for Fame & Land!`;
      this.gameState.addLog(tournMsg);
      turnEvents.push(tournMsg);
    }

    // 7. Sidequest Labs Seasonal Chronicle Events & Nemesis Night Assassins
    if (this.gameState.isSidequestEdition()) {
      this.gameState.mutateState((s) => {
        if (s.victoryStatus !== 'ONGOING') return;
        const m = calendar.month;
        const pLord = s.activeLords[s.selectedLordId];

        if (
          (m === 3 || m === 6 || m === 9 || m === 12) &&
          s.lastSeasonalEventMonth !== m
        ) {
          s.lastSeasonalEventMonth = m;
          if (m === 3) {
            pLord.gold += 5;
            const homeT = s.territories[pLord.homeTerritoryId];
            if (homeT) {
              homeT.garrison.soldiers += 3;
            }
            s.lastSeasonalEvent = 'Vernal Equinox & Wool Trade Tariffs';
            const msg = `[SEASONAL PROCLAMATION] Vernal Equinox & Wool Trade Tariffs: +5 Gold trade duty & +3 Home Garrison recruits!`;
            s.log.push(msg);
            turnEvents.push(msg);
          } else if (m === 6) {
            pLord.campaignArmy.knights += 1;
            s.lastSeasonalEvent = 'Midsummer Fair & Grand Lists';
            const msg = `[SEASONAL PROCLAMATION] Midsummer Fair & Grand Lists: +1 Knight rallied to the banner & lists proclaimed!`;
            s.log.push(msg);
            turnEvents.push(msg);
          } else if (m === 9) {
            s.lastSeasonalEvent = 'Autumn Harvest & Golden Bounties';
            const msg = `[SEASONAL PROCLAMATION] Autumn Harvest & Golden Bounties: Markets yield double prosperity (+4G each)!`;
            s.log.push(msg);
            turnEvents.push(msg);
          } else if (m === 12) {
            const northIds = ['northumberland', 'cumberland', 'lancashire', 'yorkshire'];
            for (const l of Object.values(s.activeLords)) {
              if (
                !l.isDefeated &&
                northIds.includes(l.currentTerritoryId) &&
                l.campaignArmy.soldiers > 1
              ) {
                l.campaignArmy.soldiers -= 1;
              }
            }
            s.lastSeasonalEvent = 'The Great Frost & Ice Storms';
            const msg = `[SEASONAL PROCLAMATION] The Great Frost & Ice Storms: Winter frostbite grips northern campaign armies (-1 Soldier)!`;
            s.log.push(msg);
            turnEvents.push(msg);
          }
        }

        if (s.nemesisLordId && !s.pendingAssassinMission) {
          const nemesis = s.activeLords[s.nemesisLordId];
          if (nemesis && !nemesis.isDefeated && nemesis.gold >= 10) {
            nemesis.gold -= 10;
            s.pendingAssassinMission = true;
            const assassinMsg = `[SHADOW OF VENGEANCE] ${nemesis.name} has dispatched a Night Assassin to strike thee down in thy keep!`;
            s.log.push(assassinMsg);
            turnEvents.push(assassinMsg);
          }
        }
      });
    }

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
   * Executes recruitment and tactical movement for a single AI Lord (auto-resolving battles).
   */
  public executeAiLordTurn(lordId: string): string | null {
    const res = this.stepSingleAiLord(lordId, false);
    if (!res || res.outcome === 'RELOCATED') {
      return null;
    }
    return res.message;
  }

  /**
   * Shared AI recruitment + movement decision step.
   */
  private stepSingleAiLord(lordId: string, interactiveBattle: boolean): MoveResult | null {
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
    const hasPactWithPlayer = Boolean(
      updatedLord.pactWithPlayerTurns && updatedLord.pactWithPlayerTurns > 0
    );

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
      .filter((cand) => {
        if (hasPactWithPlayer && cand.terr.ownerId === stateMid.selectedLordId) {
          return false;
        }
        return (
          cand.preview.allowed &&
          cand.preview.attackerStrength >
            cand.preview.defenderStrength * cand.requiredMargin
        );
      });

    const vulnerableHomeCastle = attackableEnemies.find(
      (c) =>
        c.isEnemyHome &&
        c.isOppositeFaction &&
        (!hasPactWithPlayer || c.terr.ownerId !== stateMid.selectedLordId) &&
        c.preview.attackerStrength > c.preview.defenderStrength * 1.25
    );

    if (vulnerableHomeCastle) {
      return this.gameState.moveCampaignArmy(lordId, vulnerableHomeCastle.tid, {
        interactiveBattle,
      });
    }

    // In SIDEQUEST_LABS mode, Nemesis AI prioritizes striking player borderlands
    if (this.gameState.isSidequestEdition() && updatedLord.hasVendettaAgainstPlayer) {
      const playerTargets = attackableEnemies.filter(
        (c) => c.terr.ownerId === stateMid.selectedLordId
      );
      if (playerTargets.length > 0) {
        playerTargets.sort((a, b) => {
          const ratioA =
            a.preview.attackerStrength / Math.max(1, a.preview.defenderStrength);
          const ratioB =
            b.preview.attackerStrength / Math.max(1, b.preview.defenderStrength);
          return ratioB - ratioA;
        });
        return this.gameState.moveCampaignArmy(lordId, playerTargets[0].tid, {
          interactiveBattle,
        });
      }
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

      return this.gameState.moveCampaignArmy(lordId, sortedNeutrals[0], {
        interactiveBattle,
      });
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

      return this.gameState.moveCampaignArmy(lordId, attackableEnemies[0].tid, {
        interactiveBattle,
      });
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

    // In SIDEQUEST_LABS mode, recruit Longbowmen (archers) if affordable
    if (this.gameState.isSidequestEdition() && spendableGold >= UNIT_COSTS.archers) {
      const currentArchers = currentLord.campaignArmy.archers ?? 0;
      if (currentArchers < Math.floor(currentLord.campaignArmy.soldiers / 3) + 2) {
        const archersToBuy = Math.min(2, Math.floor(spendableGold / UNIT_COSTS.archers));
        if (archersToBuy > 0) {
          const res = this.gameState.purchaseUnit(
            currentLord.id,
            'archers',
            archersToBuy,
            'campaign'
          );
          if (res.success) {
            spendableGold -= archersToBuy * UNIT_COSTS.archers;
          }
        }
      }
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
