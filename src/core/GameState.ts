import {
  ActionResult,
  BattleResult,
  CampaignState,
  CaptiveDamselEvent,
  GamePhase,
  JoustOutcomeSummary,
  JoustStakesType,
  Lord,
  MONTH_NAMES,
  MoveResult,
  PendingJoustContext,
  PendingSwordplayContext,
  ROBIN_HOOD_MERRY_MEN_COUNT,
  SaxonDamselId,
  Territory,
  UNIT_COSTS,
  UnitType,
} from './types';
import { ALL_LORDS, SAXON_LORDS, NORMAN_LORDS } from '../data/lords';
import { SAXON_DAMSELS, SAXON_DAMSEL_IDS } from '../data/damsels';
import { INITIAL_TERRITORIES } from '../data/territories';
import { CombatResolver } from './CombatResolver';
import { SwordplayEngine } from './SwordplayEngine';
import { JoustEngine } from './JoustEngine';

export interface RaidableCastleTarget {
  lord: Lord;
  territoryId: string;
  territoryName: string;
  estimatedLoot: number;
}

export interface JoustableLordTarget {
  lord: Lord;
  canWagerLand: boolean;
  playerLandCandidates: Territory[];
  rivalLandCandidates: Territory[];
  wagerTerritoryId?: string;
  territoryName?: string;
}

export interface ReachableTerritories {
  friendlyIds: string[];
  neutralIds: string[];
  enemyIds: string[];
  sherwoodId: string | null;
}

/**
 * GameState Singleton
 * Central state authority strictly decoupled from the Phaser presentation layer.
 */
export class GameState {
  private static instance: GameState;

  private state: CampaignState = {
    year: 1149,
    month: 1,
    turn: 1,
    robinHoodUsesLeft: 3,
    robinHoodUsedThisTurn: false,
    hasConqueredThisTurn: {},
    hasRaidedThisTurn: false,
    hasJoustedThisTurn: false,
    captiveDamsel: null,
    rescuedDamselIds: [],
    marriedDamselId: null,
    selectedLordId: 'ivanhoe',
    activeLords: {},
    territories: {},
    phase: 'BOOT',
    victoryStatus: 'ONGOING',
    winnerLordId: null,
    log: [],
  };

  private listeners: Array<(state: CampaignState) => void> = [];

  private constructor() {
    this.resetToDefaults();
  }

  public static getInstance(): GameState {
    if (!GameState.instance) {
      GameState.instance = new GameState();
    }
    return GameState.instance;
  }

  /**
   * Resets all internal structures to defaults without starting a campaign.
   */
  public resetToDefaults(): void {
    const clonedTerritories: Record<string, Territory> = JSON.parse(
      JSON.stringify(INITIAL_TERRITORIES)
    );

    const clonedLords: Record<string, Lord> = JSON.parse(
      JSON.stringify(ALL_LORDS)
    );

    this.state = {
      year: 1149,
      month: 1,
      turn: 1,
      robinHoodUsesLeft: 3,
      robinHoodUsedThisTurn: false,
      hasConqueredThisTurn: {},
      hasRaidedThisTurn: false,
      hasJoustedThisTurn: false,
      captiveDamsel: null,
      rescuedDamselIds: [],
      marriedDamselId: null,
      selectedLordId: 'ivanhoe',
      activeLords: clonedLords,
      territories: clonedTerritories,
      phase: 'BOOT',
      victoryStatus: 'ONGOING',
      winnerLordId: null,
      log: ['Game engine initialized.'],
    };

    this.notify();
  }

  /**
   * Starts a new campaign initialized according to historical Cinemaware rules:
   * - 6 active lords: 1 Saxon player, 2 Saxon AIs, 3 Norman AIs
   * - Each active lord assigned their home castle with 10 garrison soldiers, 10 campaign soldiers, 1 knight, 10 gold
   * - All other territories neutral
   * - Nottingham flagged as Sherwood Forest
   */
  public startNewCampaign(selectedLordId: string): CampaignState {
    if (!SAXON_LORDS[selectedLordId]) {
      throw new Error(
        `Invalid player lord selection: ${selectedLordId}. Must be a valid Saxon Lord.`
      );
    }

    const territories: Record<string, Territory> = JSON.parse(
      JSON.stringify(INITIAL_TERRITORIES)
    );

    const allLordsCloned: Record<string, Lord> = JSON.parse(
      JSON.stringify(ALL_LORDS)
    );

    const otherSaxonIds = Object.keys(SAXON_LORDS).filter(
      (id) => id !== selectedLordId
    );
    const chosenSaxonAiIds = otherSaxonIds.slice(0, 2);

    const activeLordIds: string[] = [
      selectedLordId,
      ...chosenSaxonAiIds,
      ...Object.keys(NORMAN_LORDS),
    ];

    const activeLords: Record<string, Lord> = {};

    for (const lordId of activeLordIds) {
      const lord = allLordsCloned[lordId];
      lord.isActive = true;
      lord.isDefeated = false;
      lord.isPlayer = lordId === selectedLordId;
      lord.currentTerritoryId = lord.homeTerritoryId;
      lord.gold = 10;
      lord.campaignArmy = {
        soldiers: 10,
        knights: 1,
        catapults: 0,
      };

      activeLords[lordId] = lord;

      const homeTerritory = territories[lord.homeTerritoryId];
      if (homeTerritory) {
        homeTerritory.ownerId = lord.id;
        homeTerritory.hasCastle = true;
        homeTerritory.garrison = {
          soldiers: 10,
          knights: 0,
          catapults: 0,
        };
      }
    }

    const inactiveSaxonId = otherSaxonIds[2];
    if (inactiveSaxonId && allLordsCloned[inactiveSaxonId]) {
      allLordsCloned[inactiveSaxonId].isActive = false;
      allLordsCloned[inactiveSaxonId].isPlayer = false;
    }

    if (territories['notts']) {
      territories['notts'].isSherwood = true;
      territories['notts'].ownerId = null;
    }

    this.state = {
      year: 1149,
      month: 1,
      turn: 1,
      robinHoodUsesLeft: 3,
      robinHoodUsedThisTurn: false,
      hasConqueredThisTurn: {},
      hasRaidedThisTurn: false,
      hasJoustedThisTurn: false,
      captiveDamsel: null,
      rescuedDamselIds: [],
      marriedDamselId: null,
      selectedLordId,
      activeLords,
      territories,
      phase: 'CAMPAIGN_MAP',
      victoryStatus: 'ONGOING',
      winnerLordId: null,
      log: [
        `[JAN 1149] Campaign commences in the Year of our Lord 1149.`,
        `${activeLords[selectedLordId].name} raises the Saxon banner in ${territories[activeLords[selectedLordId].homeTerritoryId].name}!`,
        `England stands divided between 3 Saxon and 3 Norman lords.`,
      ],
    };

    this.notify();
    return this.getState();
  }

  public getPlayerLord(): Lord {
    return this.state.activeLords[this.state.selectedLordId];
  }

  public getState(): CampaignState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public setPhase(phase: GamePhase): void {
    this.state.phase = phase;
    this.notify();
  }

  public getTerritory(id: string): Territory | undefined {
    return this.state.territories[id];
  }

  public getLord(id: string): Lord | undefined {
    return this.state.activeLords[id];
  }

  public getPlayerTerritories(): Territory[] {
    return this.getLordTerritories(this.state.selectedLordId);
  }

  public getLordTerritories(lordId: string): Territory[] {
    return Object.values(this.state.territories).filter(
      (t) => t.ownerId === lordId && !t.isSherwood
    );
  }

  public getLordCastleCount(lordId: string): number {
    return this.getLordTerritories(lordId).filter((t) => t.hasCastle).length;
  }

  public getLordTaxIncome(lordId: string): number {
    return this.getLordTerritories(lordId).reduce(
      (sum, t) => sum + t.taxIncome,
      0
    );
  }

  public getMonthLabel(): string {
    return MONTH_NAMES[(this.state.month - 1) % 12] || 'JAN';
  }

  public getRecentLog(limit = 8): string[] {
    return this.state.log.slice(-limit);
  }

  public addLog(entry: string): void {
    this.state.log.push(entry);
    if (this.state.log.length > 50) {
      this.state.log = this.state.log.slice(-50);
    }
    this.notify();
  }

  /**
   * Collects monthly taxes for every active, undefeated Lord based on owned territory taxIncome.
   */
  public collectTaxes(): Record<string, number> {
    const collected: Record<string, number> = {};

    for (const lord of Object.values(this.state.activeLords)) {
      if (lord.isActive && !lord.isDefeated) {
        const income = this.getLordTaxIncome(lord.id);
        lord.gold += income;
        collected[lord.id] = income;
      }
    }

    this.notify();
    return collected;
  }

  /**
   * Purchases Soldiers (1G), Knights (8G), or Catapults (15G) for a Lord's campaignArmy or owned garrison.
   */
  public purchaseUnit(
    lordId: string,
    unitType: UnitType,
    count = 1,
    target: 'campaign' | 'garrison' = 'campaign',
    territoryId?: string
  ): ActionResult {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }

    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }

    if (count <= 0 || !Number.isInteger(count)) {
      return { success: false, message: 'Invalid unit purchase count.' };
    }

    const unitCost = UNIT_COSTS[unitType];
    const totalCost = unitCost * count;

    if (lord.gold < totalCost) {
      return {
        success: false,
        message: `Insufficient Gold! Need ${totalCost}G (have ${lord.gold}G).`,
      };
    }

    if (target === 'garrison') {
      const targetId = territoryId ?? lord.currentTerritoryId;
      const territory = this.state.territories[targetId];
      if (!territory || territory.ownerId !== lordId || territory.isSherwood) {
        return {
          success: false,
          message: 'Can only recruit garrison units into a territory you own.',
        };
      }
      lord.gold -= totalCost;
      territory.garrison[unitType] += count;
      this.notify();
      return {
        success: true,
        message: `Recruited ${count} ${unitType} into ${territory.name} garrison (-${totalCost}G).`,
      };
    }

    lord.gold -= totalCost;
    lord.campaignArmy[unitType] += count;
    this.notify();
    return {
      success: true,
      message: `Recruited ${count} ${unitType} into Campaign Army (-${totalCost}G).`,
    };
  }

  /**
   * Constructs a fortified Castle (20G) in a territory owned by lordId where hasCastle === false.
   */
  public buildCastle(lordId: string, territoryId: string): ActionResult {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }

    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }

    const territory = this.state.territories[territoryId];
    if (!territory || territory.isSherwood) {
      return { success: false, message: 'Cannot build a Castle here.' };
    }

    if (territory.ownerId !== lordId) {
      return {
        success: false,
        message: `You must own ${territory.name} to build a Castle!`,
      };
    }

    if (territory.hasCastle) {
      return {
        success: false,
        message: `${territory.name} already possesses a fortified Castle!`,
      };
    }

    if (lord.gold < UNIT_COSTS.castle) {
      return {
        success: false,
        message: `Need ${UNIT_COSTS.castle} Gold to build a Castle (have ${lord.gold}G).`,
      };
    }

    lord.gold -= UNIT_COSTS.castle;
    territory.hasCastle = true;
    const msg = `${lord.name} built a fortified Castle in ${territory.name} (-${UNIT_COSTS.castle}G)!`;
    this.state.log.push(msg);
    this.notify();

    return { success: true, message: msg };
  }

  /**
   * Transfers soldiers, knights, or catapults between a lord's mobile campaignArmy
   * and the garrison of the territory where the campaignArmy is currently stationed.
   */
  public transferTroops(
    lordId: string,
    direction: 'toGarrison' | 'toCampaign',
    unitType: UnitType,
    count = 1
  ): ActionResult {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }

    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }

    if (count <= 0 || !Number.isInteger(count)) {
      return { success: false, message: 'Transfer count must be a positive integer.' };
    }

    const territory = this.state.territories[lord.currentTerritoryId];
    if (!territory || territory.ownerId !== lordId || territory.isSherwood) {
      return {
        success: false,
        message: 'You must own the territory where your Campaign Army stands to transfer troops.',
      };
    }

    if (direction === 'toGarrison') {
      if (lord.campaignArmy[unitType] < count) {
        return {
          success: false,
          message: `Not enough ${unitType} in Campaign Army to transfer.`,
        };
      }
      lord.campaignArmy[unitType] -= count;
      territory.garrison[unitType] += count;
      this.notify();
      return {
        success: true,
        message: `Moved ${count} ${unitType} to ${territory.name} garrison.`,
      };
    } else {
      if (territory.garrison[unitType] < count) {
        return {
          success: false,
          message: `Not enough ${unitType} in ${territory.name} garrison to transfer.`,
        };
      }
      territory.garrison[unitType] -= count;
      lord.campaignArmy[unitType] += count;
      this.notify();
      return {
        success: true,
        message: `Moved ${count} ${unitType} into Campaign Army.`,
      };
    }
  }

  /**
   * Finds all territories owned by lordId connected to lord.currentTerritoryId (including start if owned).
   */
  public getConnectedFriendlyComponent(lordId: string): Set<string> {
    const lord = this.state.activeLords[lordId];
    const visited = new Set<string>();
    if (!lord) return visited;

    const startId = lord.currentTerritoryId;
    if (!this.state.territories[startId]) return visited;

    visited.add(startId);
    const queue: string[] = [startId];

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currTerr = this.state.territories[currId];
      if (!currTerr) continue;

      for (const neighborId of currTerr.neighbors) {
        const neighbor = this.state.territories[neighborId];
        if (
          neighbor &&
          neighbor.ownerId === lordId &&
          !neighbor.isSherwood &&
          !visited.has(neighborId)
        ) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    return visited;
  }

  /**
   * Computes all territories reachable by lordId's campaignArmy:
   * - Connected friendly territories (relocation)
   * - Adjacent Neutral, Enemy, or Sherwood territories bordering the connected friendly component
   */
  public getReachableTerritories(lordId: string): ReachableTerritories {
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { friendlyIds: [], neutralIds: [], enemyIds: [], sherwoodId: null };
    }

    const connectedComponent = this.getConnectedFriendlyComponent(lordId);
    const friendlyIds: string[] = [];
    const frontierSet = new Set<string>();

    for (const fid of connectedComponent) {
      if (fid !== lord.currentTerritoryId && this.state.territories[fid]?.ownerId === lordId) {
        friendlyIds.push(fid);
      }
      const terr = this.state.territories[fid];
      if (!terr) continue;
      for (const nId of terr.neighbors) {
        if (!connectedComponent.has(nId)) {
          frontierSet.add(nId);
        }
      }
    }

    const neutralIds: string[] = [];
    const enemyIds: string[] = [];
    let sherwoodId: string | null = null;

    for (const targetId of frontierSet) {
      const target = this.state.territories[targetId];
      if (!target) continue;
      if (target.isSherwood) {
        sherwoodId = targetId;
      } else if (target.ownerId === null) {
        neutralIds.push(targetId);
      } else if (target.ownerId !== lordId) {
        enemyIds.push(targetId);
      }
    }

    return { friendlyIds, neutralIds, enemyIds, sherwoodId };
  }

  /**
   * Moves a Lord's Campaign Army to an adjacent or connected friendly territory,
   * annexing Neutral territories or triggering CombatResolver / BattleScene for Enemy territories.
   */
  public moveCampaignArmy(
    lordId: string,
    targetTerritoryId: string,
    options?: { ignoreTurnLimit?: boolean; interactiveBattle?: boolean }
  ): MoveResult {
    if (this.state.victoryStatus !== 'ONGOING') {
      return {
        success: false,
        outcome: 'BLOCKED',
        message: 'The campaign has already concluded.',
      };
    }

    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return {
        success: false,
        outcome: 'BLOCKED',
        message: 'Lord is inactive or defeated.',
      };
    }

    const targetTerritory = this.state.territories[targetTerritoryId];
    if (!targetTerritory) {
      return {
        success: false,
        outcome: 'BLOCKED',
        message: `Unknown territory: ${targetTerritoryId}.`,
      };
    }

    if (targetTerritoryId === lord.currentTerritoryId) {
      return {
        success: false,
        outcome: 'BLOCKED',
        message: `Campaign Army is already stationed in ${targetTerritory.name}.`,
      };
    }

    // Sherwood Forest special rule: cannot be annexed as a tax territory
    if (targetTerritory.isSherwood) {
      return {
        success: false,
        outcome: 'SHERWOOD',
        message:
          'Sherwood Forest cannot be annexed! Consult Robin Hood for Merry Men aid.',
      };
    }

    // Must have at least 1 combat unit (Soldier or Knight) to move
    if (lord.campaignArmy.soldiers <= 0 && lord.campaignArmy.knights <= 0) {
      return {
        success: false,
        outcome: 'BLOCKED',
        message:
          'Moving requires at least 1 combat unit (Soldier or Knight) in the Campaign Army!',
      };
    }

    // Validate adjacency / connected friendly path
    const reachable = this.getReachableTerritories(lordId);
    const isFriendlyMove = reachable.friendlyIds.includes(targetTerritoryId);
    const isNeutralMove = reachable.neutralIds.includes(targetTerritoryId);
    const isEnemyMove = reachable.enemyIds.includes(targetTerritoryId);

    if (!isFriendlyMove && !isNeutralMove && !isEnemyMove) {
      return {
        success: false,
        outcome: 'BLOCKED',
        message: `${targetTerritory.name} is not adjacent to your Campaign Army or connected friendly lands!`,
      };
    }

    // 1. Friendly Territory Relocation
    if (isFriendlyMove && targetTerritory.ownerId === lordId) {
      lord.currentTerritoryId = targetTerritoryId;
      this.notify();
      return {
        success: true,
        outcome: 'RELOCATED',
        message: `${lord.name} relocated Campaign Army to ${targetTerritory.name}.`,
      };
    }

    // Check 1-conquest-per-turn rule unless explicitly bypassed
    if (!options?.ignoreTurnLimit && this.state.hasConqueredThisTurn[lordId]) {
      return {
        success: false,
        outcome: 'BLOCKED',
        message:
          'Campaign Army has already conquered or attacked this month! Click END TURN to advance.',
      };
    }

    // 2. Unclaimed Neutral Territory Annexation
    if (isNeutralMove && targetTerritory.ownerId === null) {
      targetTerritory.ownerId = lordId;
      lord.currentTerritoryId = targetTerritoryId;
      this.state.hasConqueredThisTurn[lordId] = true;

      const msg = `${lord.name} annexed ${targetTerritory.name} (+${targetTerritory.taxIncome} Gold/mo)`;
      this.state.log.push(msg);
      this.notify();

      return {
        success: true,
        outcome: 'ANNEXED',
        message: msg,
      };
    }

    // 3A. Interactive Tactical Battle Interception (Sprint 3 BattleScene)
    if (options?.interactiveBattle) {
      const preview = CombatResolver.calculateBattlePreview(
        this.state,
        lordId,
        targetTerritoryId
      );

      if (!preview.allowed) {
        return {
          success: false,
          outcome: 'BLOCKED',
          message: preview.blockReason ?? CombatResolver.CASTLE_SIEGE_BLOCK_MSG,
        };
      }

      const isPlayerAttacking = lord.isPlayer;
      const isPlayerDefending = targetTerritory.ownerId === this.state.selectedLordId;
      const hasDefendingTroops = preview.defenderSoldiers + preview.defenderKnights > 0;

      // Launch interactive SiegeScene (if Castle) or BattleScene whenever Player attacks, or when AI attacks a defended Player shire
      if (isPlayerAttacking || (isPlayerDefending && hasDefendingTroops)) {
        this.state.phase = targetTerritory.hasCastle ? 'SIEGE' : 'BATTLE';
        this.notify();
        return {
          success: true,
          outcome: 'BATTLE_PENDING',
          message: targetTerritory.hasCastle
            ? `${lord.name} lays siege to ${targetTerritory.name}!`
            : `${lord.name} marches to battle in ${targetTerritory.name}!`,
          pendingBattle: {
            attackerId: lordId,
            defenderId: targetTerritory.ownerId,
            territoryId: targetTerritoryId,
            originTerritoryId: lord.currentTerritoryId,
            hasCastle: targetTerritory.hasCastle,
            mode: isPlayerAttacking ? 'PLAYER_ATTACK' : 'PLAYER_DEFENSE',
          },
        };
      }
    }

    // 3B. Background Auto-Resolve via CombatResolver (AI-vs-AI or undefended shire)
    const battle = CombatResolver.resolveInvasionOnState(
      this.state,
      lordId,
      targetTerritoryId
    );

    if (!battle.allowed) {
      // Blocked (e.g. Castle Siege without Catapult) — does NOT consume monthly march
      return {
        success: false,
        outcome: 'BLOCKED',
        message: battle.message,
        battle,
      };
    }

    this.state.hasConqueredThisTurn[lordId] = true;
    this.notify();

    return {
      success: battle.attackerWon,
      outcome: battle.attackerWon ? 'BATTLE_WON' : 'BATTLE_LOST',
      message: battle.message,
      battle,
    };
  }

  /**
   * Executes a controlled state mutation from a core subsystem (e.g. BattleEngine) and notifies subscribers.
   */
  public mutateState<T>(mutator: (state: CampaignState) => T): T {
    const result = mutator(this.state);
    if (this.state.log.length > 50) {
      this.state.log = this.state.log.slice(-50);
    }
    this.notify();
    return result;
  }

  /**
   * Direct invasion entry point used by CombatResolver.autoResolveInvasion.
   */
  public resolveInvasion(
    attackerLordId: string,
    targetTerritoryId: string
  ): BattleResult {
    const result = CombatResolver.resolveInvasionOnState(
      this.state,
      attackerLordId,
      targetTerritoryId
    );
    this.notify();
    return result;
  }

  /**
   * Consults Robin Hood in Sherwood Forest: grants free Merry Men Soldiers to the Player's
   * Campaign Army (once per turn, up to 3 times per campaign).
   */
  public consultRobinHood(): ActionResult {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }

    const player = this.getPlayerLord();
    if (!player || !player.isActive || player.isDefeated) {
      return { success: false, message: 'Player lord is unavailable.' };
    }

    if (this.state.robinHoodUsesLeft <= 0) {
      return {
        success: false,
        message: 'Robin Hood has already aided your banner 3 times this campaign!',
      };
    }

    if (this.state.robinHoodUsedThisTurn) {
      return {
        success: false,
        message: 'Robin Hood has already sent Merry Men this month! Wait until next turn.',
      };
    }

    this.state.robinHoodUsesLeft -= 1;
    this.state.robinHoodUsedThisTurn = true;
    player.campaignArmy.soldiers += ROBIN_HOOD_MERRY_MEN_COUNT;

    const msg = `Robin Hood sends ${ROBIN_HOOD_MERRY_MEN_COUNT} Merry Men from Sherwood to ${player.name}! (${this.state.robinHoodUsesLeft}/3 uses left)`;
    this.state.log.push(msg);
    this.notify();

    return { success: true, message: msg };
  }

  /**
   * Lists all active, undefeated rival Lords eligible for a Night Castle Raid
   * (owns at least 1 Castle or holds gold >= 5), sorted by estimated vault loot descending.
   */
  public getRaidableTargets(): RaidableCastleTarget[] {
    const targets: RaidableCastleTarget[] = [];

    for (const lord of Object.values(this.state.activeLords)) {
      if (!lord.isActive || lord.isDefeated || lord.isPlayer) {
        continue;
      }

      const lordCastles = this.getLordTerritories(lord.id).filter(
        (t) => t.hasCastle
      );
      const anyOwned = this.getLordTerritories(lord.id);

      if (lord.gold < 5 && lordCastles.length === 0) {
        continue;
      }

      const stronghold =
        lordCastles.find((t) => t.id === lord.homeTerritoryId) ??
        lordCastles[0] ??
        anyOwned[0] ??
        this.state.territories[lord.homeTerritoryId];

      if (!stronghold) continue;

      const loot = SwordplayEngine.calculateRaidLoot(lord.gold);
      targets.push({
        lord: JSON.parse(JSON.stringify(lord)),
        territoryId: stronghold.id,
        territoryName: stronghold.name,
        estimatedLoot: loot.totalGoldStolen,
      });
    }

    targets.sort((a, b) => b.estimatedLoot - a.estimatedLoot);
    return targets;
  }

  /**
   * Initiates an interactive Night Castle Raid against a rival Lord's stronghold.
   */
  public initiateCastleRaid(targetLordId: string): {
    success: boolean;
    message: string;
    context?: PendingSwordplayContext;
  } {
    const check = SwordplayEngine.canRaidLord(this.state, targetLordId);
    if (!check.success) {
      return check;
    }

    const targetLord = this.state.activeLords[targetLordId]!;
    const lordCastles = this.getLordTerritories(targetLord.id).filter(
      (t) => t.hasCastle
    );
    const anyOwned = this.getLordTerritories(targetLord.id);
    const stronghold =
      lordCastles.find((t) => t.id === targetLord.homeTerritoryId) ??
      lordCastles[0] ??
      anyOwned[0] ??
      this.state.territories[targetLord.homeTerritoryId];

    const territoryId = stronghold ? stronghold.id : targetLord.homeTerritoryId;
    const context: PendingSwordplayContext = {
      missionType: 'RAID',
      attackerId: this.state.selectedLordId,
      targetLordId: targetLord.id,
      targetTerritoryId: territoryId,
    };

    this.state.phase = 'RAID';
    this.notify();

    return {
      success: true,
      message: `${this.getPlayerLord().name} infiltrates ${
        stronghold?.name ?? 'the enemy castle'
      } under cover of darkness!`,
      context,
    };
  }

  /**
   * Spawns a Captured Saxon Damsel campaign event (triggered periodically on Turns 3, 6, 9, 12...
   * or explicitly on demand). Prefers an active Norman Lord holding a Castle.
   */
  public triggerDamselCaptureEvent(
    preferredDamselId?: SaxonDamselId,
    preferredCaptorId?: string
  ): CaptiveDamselEvent | null {
    if (this.state.victoryStatus !== 'ONGOING') {
      return null;
    }

    const unrescuedIds = SAXON_DAMSEL_IDS.filter(
      (id) => !this.state.rescuedDamselIds.includes(id)
    );
    const chosenDamselId =
      preferredDamselId ??
      (unrescuedIds.length > 0 ? unrescuedIds[0] : null);

    if (!chosenDamselId) {
      return null;
    }

    // Select an active Norman castle lord (or fallback active rival lord with a castle)
    const activeRivals = Object.values(this.state.activeLords).filter(
      (l) => l.isActive && !l.isDefeated && !l.isPlayer
    );
    const normanCaptors = activeRivals.filter(
      (l) => l.faction === 'norman' && this.getLordCastleCount(l.id) > 0
    );
    const fallbackCaptors = activeRivals.filter(
      (l) => this.getLordCastleCount(l.id) > 0
    );

    let captor: Lord | undefined;
    if (preferredCaptorId && this.state.activeLords[preferredCaptorId]) {
      const cand = this.state.activeLords[preferredCaptorId];
      if (cand.isActive && !cand.isDefeated && !cand.isPlayer) {
        captor = cand;
      }
    }
    if (!captor) {
      const pool = normanCaptors.length > 0 ? normanCaptors : fallbackCaptors;
      if (pool.length === 0) return null;
      const idx = (this.state.turn + this.state.rescuedDamselIds.length) % pool.length;
      captor = pool[idx];
    }

    const castles = this.getLordTerritories(captor.id).filter((t) => t.hasCastle);
    const castleTerr =
      castles.find((t) => t.id === captor!.homeTerritoryId) ??
      castles[0] ??
      this.state.territories[captor.homeTerritoryId];

    if (!castleTerr) return null;

    const damsel = SAXON_DAMSELS[chosenDamselId];
    const event: CaptiveDamselEvent = {
      damselId: chosenDamselId,
      captorLordId: captor.id,
      castleTerritoryId: castleTerr.id,
      turnCaptured: this.state.turn,
    };

    this.state.captiveDamsel = event;
    const alertMsg = `[DAMSEL IN DISTRESS] ${damsel.name} is held captive by ${captor.name} in ${castleTerr.name}!`;
    this.state.log.push(alertMsg);
    if (this.state.log.length > 50) {
      this.state.log = this.state.log.slice(-50);
    }
    this.notify();

    return JSON.parse(JSON.stringify(event));
  }

  /**
   * Initiates an interactive Damsel Rescue mission into SwordplayScene when a Saxon Lady is captive.
   */
  public initiateDamselRescue(): {
    success: boolean;
    message: string;
    context?: PendingSwordplayContext;
  } {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    if (!this.state.captiveDamsel) {
      return {
        success: false,
        message: 'No Saxon Lady is currently held captive!',
      };
    }

    const ev = this.state.captiveDamsel;
    const captor = this.state.activeLords[ev.captorLordId];
    if (!captor || !captor.isActive || captor.isDefeated) {
      this.state.captiveDamsel = null;
      this.notify();
      return {
        success: false,
        message: 'Her captor has already been overthrown!',
      };
    }

    const damsel = SAXON_DAMSELS[ev.damselId];
    const terr = this.state.territories[ev.castleTerritoryId];
    const context: PendingSwordplayContext = {
      missionType: 'RESCUE',
      attackerId: this.state.selectedLordId,
      targetLordId: ev.captorLordId,
      targetTerritoryId: ev.castleTerritoryId,
      damselId: ev.damselId,
    };

    this.state.phase = 'RESCUE';
    this.notify();

    return {
      success: true,
      message: `${this.getPlayerLord().name} rides to ${
        terr?.name ?? 'the keep'
      } to rescue ${damsel.name}!`,
      context,
    };
  }

  /**
   * Lists all active, undefeated rival Lords eligible for a Tournament Joust.
   */
  public getJoustableTargets(
    _callerId?: string,
    stakesFilter?: JoustStakesType
  ): JoustableLordTarget[] {
    const targets: JoustableLordTarget[] = [];
    const player = this.getPlayerLord();
    if (!player) return targets;

    for (const lord of Object.values(this.state.activeLords)) {
      if (!lord.isActive || lord.isDefeated || lord.isPlayer) {
        continue;
      }

      const landCheck = JoustEngine.canWagerLand(this.state, player.id, lord.id);
      if (stakesFilter === 'LAND' && !landCheck.allowed) {
        continue;
      }

      const wagerTerr = landCheck.rivalTerritories[0];
      targets.push({
        lord: JSON.parse(JSON.stringify(lord)),
        canWagerLand: landCheck.allowed,
        playerLandCandidates: landCheck.playerTerritories,
        rivalLandCandidates: landCheck.rivalTerritories,
        wagerTerritoryId: wagerTerr?.id,
        territoryName: wagerTerr?.name,
      });
    }

    // Sort by jousting skill descending
    targets.sort((a, b) => b.lord.jousting - a.lord.jousting);
    return targets;
  }

  /**
   * Initiates an interactive Tournament Joust against a rival Lord.
   */
  public initiateJoust(
    targetLordId: string,
    stakesType: JoustStakesType = 'FAME',
    playerWagerTerritoryId?: string,
    rivalWagerTerritoryId?: string
  ): {
    success: boolean;
    message: string;
    context?: PendingJoustContext;
  } {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }

    if (this.state.hasJoustedThisTurn) {
      return {
        success: false,
        message: 'Thou hast already entered the Tournament lists this month! Advance the turn first.',
      };
    }

    const player = this.getPlayerLord();
    const targetLord = this.state.activeLords[targetLordId];
    if (!targetLord || !targetLord.isActive || targetLord.isDefeated) {
      return { success: false, message: 'Target Lord is inactive or defeated.' };
    }
    if (targetLord.isPlayer || targetLord.id === player.id) {
      return { success: false, message: 'Cannot tilt against thyself!' };
    }

    if (stakesType === 'LAND') {
      const landCheck = JoustEngine.canWagerLand(this.state, player.id, targetLord.id);
      if (!landCheck.allowed) {
        return { success: false, message: landCheck.reason ?? 'Cannot wager Land stakes.' };
      }

      let pWager = playerWagerTerritoryId;
      let rWager = rivalWagerTerritoryId;

      // If 3rd parameter was rival's territory, assign it to rWager
      if (pWager && landCheck.rivalTerritories.some((t) => t.id === pWager) && !rWager) {
        rWager = pWager;
        pWager = undefined;
      }

      if (!pWager) {
        pWager = landCheck.playerTerritories[0]?.id;
      }
      if (!rWager) {
        rWager = landCheck.rivalTerritories[0]?.id;
      }

      if (!pWager || !rWager) {
        return { success: false, message: 'Both lords must have a valid non-Home shire to wager.' };
      }

      const context: PendingJoustContext = {
        challengerId: player.id,
        opponentId: targetLord.id,
        stakesType: 'LAND',
        challengerLordId: player.id,
        rivalLordId: targetLord.id,
        stakes: 'LAND',
        playerWagerTerritoryId: pWager,
        rivalWagerTerritoryId: rWager,
        wagerTerritoryId: rWager,
        passesCompleted: 0,
        maxPasses: 3,
        playerScore: 0,
        challengerScore: 0,
        rivalScore: 0,
        challengerBrokenLances: 0,
        rivalBrokenLances: 0,
        matchStatus: 'IN_PROGRESS',
        history: [],
      };

      this.state.phase = 'JOUST';
      this.notify();

      return {
        success: true,
        message: `Royal heralds proclaim a Joust for Land! ${player.name} tilts against ${targetLord.name}!`,
        context,
      };
    }

    // FAME STAKES
    const context: PendingJoustContext = {
      challengerId: player.id,
      opponentId: targetLord.id,
      stakesType: 'FAME',
      challengerLordId: player.id,
      rivalLordId: targetLord.id,
      stakes: 'FAME',
      passesCompleted: 0,
      maxPasses: 3,
      playerScore: 0,
      challengerScore: 0,
      rivalScore: 0,
      challengerBrokenLances: 0,
      rivalBrokenLances: 0,
      matchStatus: 'IN_PROGRESS',
      history: [],
    };

    this.state.phase = 'JOUST';
    this.notify();

    return {
      success: true,
      message: `Royal heralds proclaim a Joust for Fame and Glory! ${player.name} tilts against ${targetLord.name}!`,
      context,
    };
  }

  /**
   * Commits the completed Joust outcome into CampaignState.
   */
  public commitJoustOutcome(summary: JoustOutcomeSummary): void {
    this.state.phase = 'CAMPAIGN_MAP';
    this.state.hasJoustedThisTurn = true;

    const winnerId = summary.winnerLordId;
    const isPlayerVictory = winnerId === this.state.selectedLordId;
    const player = this.getPlayerLord();

    if (summary.goldAwarded && summary.goldAwarded > 0) {
      if (winnerId && this.state.activeLords[winnerId]) {
        this.state.activeLords[winnerId].gold += summary.goldAwarded;
      }
    }

    if (isPlayerVictory) {
      player.leadership = Math.min(10, player.leadership + 1);
      player.jousting = Math.min(10, player.jousting + 1);
    }

    const terrId = summary.territoryTransferredId;
    if (terrId) {
      const terr = this.state.territories[terrId];
      if (terr && winnerId) {
        terr.ownerId = winnerId;
      }
    }

    const chronicle =
      summary.narrativeChronicle ||
      summary.chronicleMessage ||
      'The Royal Tournament has ended.';
    this.state.log.push(chronicle);
    if (this.state.log.length > 50) {
      this.state.log = this.state.log.slice(-50);
    }
    this.notify();
  }

  // ==========================================================================
  // CAMPAIGN SAVE / LOAD PERSISTENCE
  // ==========================================================================

  public static readonly SAVE_STORAGE_KEY = 'dotc_save_v1';

  /**
   * Serializes current CampaignState to a JSON string with metadata.
   */
  public serializeCampaign(): string {
    return JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      state: this.state,
    });
  }

  /**
   * Deserializes a JSON string into active CampaignState, validating its integrity.
   */
  public deserializeCampaign(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr) as {
        version?: number;
        state?: CampaignState;
      } & CampaignState;

      const stateToLoad =
        parsed.state && typeof parsed.version === 'number'
          ? parsed.state
          : (parsed as CampaignState);

      if (
        typeof stateToLoad.year !== 'number' ||
        typeof stateToLoad.month !== 'number' ||
        typeof stateToLoad.turn !== 'number' ||
        !stateToLoad.activeLords ||
        !stateToLoad.territories ||
        !stateToLoad.selectedLordId
      ) {
        return false;
      }

      // Ensure all fields are preserved
      this.state = {
        ...stateToLoad,
        hasConqueredThisTurn: stateToLoad.hasConqueredThisTurn ?? {},
        hasRaidedThisTurn: Boolean(stateToLoad.hasRaidedThisTurn),
        hasJoustedThisTurn: Boolean(stateToLoad.hasJoustedThisTurn),
        captiveDamsel: stateToLoad.captiveDamsel ?? null,
        rescuedDamselIds: stateToLoad.rescuedDamselIds ?? [],
        marriedDamselId: stateToLoad.marriedDamselId ?? null,
      };

      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Saves active campaign to localStorage.
   */
  public saveToStorage(slotKey = GameState.SAVE_STORAGE_KEY): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const data = this.serializeCampaign();
      window.localStorage.setItem(slotKey, data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads campaign from localStorage.
   */
  public loadFromStorage(slotKey = GameState.SAVE_STORAGE_KEY): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const data = window.localStorage.getItem(slotKey);
      if (!data) return false;
      return this.deserializeCampaign(data);
    } catch {
      return false;
    }
  }

  /**
   * Checks whether a saved campaign exists in localStorage.
   */
  public hasSavedCampaign(slotKey = GameState.SAVE_STORAGE_KEY): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const data = window.localStorage.getItem(slotKey);
      if (!data) return false;
      const parsed = JSON.parse(data);
      const st = parsed.state ?? parsed;
      return Boolean(st && st.selectedLordId && st.activeLords);
    } catch {
      return false;
    }
  }

  /**
   * Advances the campaign calendar by 1 month (rolling 12 -> 1 and incrementing year)
   * and resets per-turn action flags.
   */
  public advanceCalendar(): { year: number; month: number; turn: number } {
    if (this.state.month >= 12) {
      this.state.month = 1;
      this.state.year += 1;
    } else {
      this.state.month += 1;
    }
    this.state.turn += 1;
    this.state.robinHoodUsedThisTurn = false;
    this.state.hasConqueredThisTurn = {};
    this.state.hasRaidedThisTurn = false;
    this.state.hasJoustedThisTurn = false;

    this.notify();
    return {
      year: this.state.year,
      month: this.state.month,
      turn: this.state.turn,
    };
  }

  /**
   * Resets monthly action locks (useful for multi-step tactical test scenarios).
   */
  public resetTurnLocks(): void {
    this.state.robinHoodUsedThisTurn = false;
    this.state.hasConqueredThisTurn = {};
    this.state.hasRaidedThisTurn = false;
    this.state.hasJoustedThisTurn = false;
    this.notify();
  }

  public subscribe(listener: (state: CampaignState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }
}
