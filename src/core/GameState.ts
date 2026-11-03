import {
  ActionResult,
  BattleResult,
  CampaignState,
  GamePhase,
  Lord,
  MONTH_NAMES,
  MoveResult,
  ROBIN_HOOD_MERRY_MEN_COUNT,
  Territory,
  UNIT_COSTS,
  UnitType,
} from './types';
import { ALL_LORDS, SAXON_LORDS, NORMAN_LORDS } from '../data/lords';
import { INITIAL_TERRITORIES } from '../data/territories';
import { CombatResolver } from './CombatResolver';

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
   * annexing Neutral territories or triggering CombatResolver for Enemy territories.
   */
  public moveCampaignArmy(
    lordId: string,
    targetTerritoryId: string,
    options?: { ignoreTurnLimit?: boolean }
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

    // 3. Enemy Territory Invasion via CombatResolver
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
