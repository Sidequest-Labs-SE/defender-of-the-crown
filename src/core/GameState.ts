import {
  ActionResult,
  BattleResult,
  CampaignState,
  CaptiveDamselEvent,
  GameEdition,
  GamePhase,
  getSeasonBadgeLabel,
  getSeasonForMonth,
  JoustOutcomeSummary,
  JoustStakesType,
  Lord,
  MONTH_NAMES,
  MoveResult,
  PendingJoustContext,
  PendingSwordplayContext,
  ROBIN_HOOD_MERRY_MEN_COUNT,
  SaxonDamselId,
  Season,
  Territory,
  UNIT_COSTS,
  UnitType,
} from './types';
import { ALL_LORDS, SAXON_LORDS, NORMAN_LORDS } from '../data/lords';
import { SAXON_DAMSELS, SAXON_DAMSEL_IDS } from '../data/damsels';
import {
  INITIAL_TERRITORIES,
  isCoastalPort,
  getConnectedSeaPorts,
  NAVAL_CHARTER_COST,
} from '../data/territories';
import { ALL_RELICS, RELIC_IDS, Relic, RelicId } from '../data/relics';
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

export interface SavedCampaignMeta {
  edition: GameEdition;
  slotKey: string;
  lordId: string;
  lordName: string;
  month: number;
  monthLabel: string;
  year: number;
  turn: number;
}

/**
 * GameState Singleton
 * Central state authority strictly decoupled from the Phaser presentation layer.
 */
export class GameState {
  private static instance: GameState;

  private currentEdition: GameEdition = 'CLASSIC';

  private state: CampaignState = {
    edition: 'CLASSIC',
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

    this.currentEdition = 'CLASSIC';

    this.state = {
      edition: 'CLASSIC',
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
      royalRansomPaid: 0,
      spiedTurnsRemaining: 0,
      saboteurSentThisTurn: false,
      mercenariesHiredThisTurn: false,
      nemesisLordId: null,
      archeryContestHeldThisTurn: false,
      lastSeasonalEvent: null,
      lastSeasonalEventMonth: 0,
      pendingAssassinMission: false,
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
  public startNewCampaign(
    selectedLordId: string,
    edition?: GameEdition
  ): CampaignState {
    const activeEdition: GameEdition =
      edition ?? this.currentEdition ?? 'CLASSIC';
    this.currentEdition = activeEdition;

    const isNorman = Boolean(NORMAN_LORDS[selectedLordId]);
    const isSaxon = Boolean(SAXON_LORDS[selectedLordId]);

    if (activeEdition === 'CLASSIC' && !isSaxon) {
      throw new Error(
        `Invalid player lord selection: ${selectedLordId}. Must be a valid Saxon Lord.`
      );
    }

    if (!isSaxon && !isNorman) {
      throw new Error(
        `Invalid player lord selection: ${selectedLordId}. Lord does not exist.`
      );
    }

    const territories: Record<string, Territory> = JSON.parse(
      JSON.stringify(INITIAL_TERRITORIES)
    );

    const allLordsCloned: Record<string, Lord> = JSON.parse(
      JSON.stringify(ALL_LORDS)
    );

    let activeLordIds: string[] = [];
    let inactiveLordId: string | null = null;

    if (isNorman) {
      // Sidequest Labs Norman Campaign: Player is Norman, 2 Norman AIs + 3 Saxon AIs (6 active lords)
      const otherNormanIds = Object.keys(NORMAN_LORDS).filter(
        (id) => id !== selectedLordId
      );
      const chosenSaxonAiIds = Object.keys(SAXON_LORDS).slice(0, 3);
      inactiveLordId = Object.keys(SAXON_LORDS)[3];
      activeLordIds = [selectedLordId, ...otherNormanIds, ...chosenSaxonAiIds];
    } else {
      // Standard Saxon Campaign: Player is Saxon, 2 Saxon AIs + 3 Norman AIs (6 active lords)
      const otherSaxonIds = Object.keys(SAXON_LORDS).filter(
        (id) => id !== selectedLordId
      );
      const chosenSaxonAiIds = otherSaxonIds.slice(0, 2);
      inactiveLordId = otherSaxonIds[2];
      activeLordIds = [
        selectedLordId,
        ...chosenSaxonAiIds,
        ...Object.keys(NORMAN_LORDS),
      ];
    }

    const activeLords: Record<string, Lord> = {};

    for (const lordId of activeLordIds) {
      const lord = allLordsCloned[lordId];
      lord.isActive = true;
      lord.isDefeated = false;
      lord.isPlayer = lordId === selectedLordId;
      lord.currentTerritoryId = lord.homeTerritoryId;
      lord.gold = 10;
      lord.pactWithPlayerTurns = 0;
      lord.relicIds = [];
      lord.hasVendettaAgainstPlayer = false;
      lord.campaignArmy = {
        soldiers: 10,
        knights: 1,
        catapults: 0,
        archers: 0,
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
          archers: 0,
        };
      }
    }

    if (inactiveLordId && allLordsCloned[inactiveLordId]) {
      allLordsCloned[inactiveLordId].isActive = false;
      allLordsCloned[inactiveLordId].isPlayer = false;
    }

    if (territories['notts']) {
      territories['notts'].isSherwood = true;
      territories['notts'].ownerId = null;
    }

    const factionBannerName = isNorman ? 'Norman' : 'Saxon';

    this.state = {
      edition: activeEdition,
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
      playerFaction: isNorman ? 'norman' : 'saxon',
      activeLords,
      territories,
      phase: 'CAMPAIGN_MAP',
      victoryStatus: 'ONGOING',
      winnerLordId: null,
      royalRansomPaid: 0,
      spiedTurnsRemaining: 0,
      saboteurSentThisTurn: false,
      mercenariesHiredThisTurn: false,
      nemesisLordId: null,
      archeryContestHeldThisTurn: false,
      lastSeasonalEvent: null,
      lastSeasonalEventMonth: 0,
      pendingAssassinMission: false,
      log: [
        `[JAN 1149] Campaign commences in the Year of our Lord 1149.`,
        `${activeLords[selectedLordId].name} raises the ${factionBannerName} banner in ${territories[activeLords[selectedLordId].homeTerritoryId].name}!`,
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

  public setEdition(edition: GameEdition): void {
    const validEdition: GameEdition =
      edition === 'SIDEQUEST_LABS' ? 'SIDEQUEST_LABS' : 'CLASSIC';
    this.currentEdition = validEdition;
    this.state.edition = validEdition;
    this.notify();
  }

  public getEdition(): GameEdition {
    return this.state.edition ?? this.currentEdition ?? 'CLASSIC';
  }

  public isSidequestEdition(): boolean {
    return this.getEdition() === 'SIDEQUEST_LABS';
  }

  public getSeason(monthOverride?: number): Season {
    return getSeasonForMonth(monthOverride ?? this.state.month);
  }

  public getSeasonBadge(monthOverride?: number): string {
    return getSeasonBadgeLabel(this.getSeason(monthOverride));
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
    const isSidequest = this.isSidequestEdition();
    const isAutumnHarvest = isSidequest && this.state.month === 9;
    const marketBonus = isAutumnHarvest ? 4 : 2;

    const territoryTax = this.getLordTerritories(lordId).reduce(
      (sum, t) =>
        sum + t.taxIncome + (isSidequest && t.hasMarket ? marketBonus : 0),
      0
    );

    const lord = this.state.activeLords[lordId];
    const relicTaxBonus =
      isSidequest && lord?.relicIds?.includes('st_edward_crown_ring') ? 3 : 0;

    return territoryTax + relicTaxBonus;
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
   * Purchases Soldiers (1G), Knights (8G), Catapults (15G), or Longbowmen (4G) for a Lord's campaignArmy or owned garrison.
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

    if (unitType === 'archers' && !this.isSidequestEdition()) {
      return {
        success: false,
        message: 'Longbowmen (Archers) are only available in Sidequest Labs Edition.',
      };
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
      territory.garrison[unitType] = (territory.garrison[unitType] ?? 0) + count;
      this.notify();
      return {
        success: true,
        message: `Recruited ${count} ${unitType} into ${territory.name} garrison (-${totalCost}G).`,
      };
    }

    lord.gold -= totalCost;
    lord.campaignArmy[unitType] = (lord.campaignArmy[unitType] ?? 0) + count;
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
   * Constructs a Golden Market / Mill (12G) in a territory owned by lordId.
   * Permanently boosts tax income by +2G/mo (Sidequest Labs Edition only).
   */
  public buildMarket(lordId: string, territoryId: string): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'Markets / Mills are only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    const territory = this.state.territories[territoryId];
    if (!territory || territory.isSherwood) {
      return { success: false, message: 'Cannot build a Market here.' };
    }
    if (territory.ownerId !== lordId) {
      return {
        success: false,
        message: `You must own ${territory.name} to build a Market!`,
      };
    }
    if (territory.hasMarket) {
      return {
        success: false,
        message: `${territory.name} already possesses a Market / Mill!`,
      };
    }
    const MARKET_COST = 12;
    if (lord.gold < MARKET_COST) {
      return {
        success: false,
        message: `Need ${MARKET_COST} Gold to build a Market (have ${lord.gold}G).`,
      };
    }
    lord.gold -= MARKET_COST;
    territory.hasMarket = true;
    const msg = `${lord.name} built a Golden Market / Mill in ${territory.name} (+2 Gold/mo, -${MARKET_COST}G)!`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * Upgrades a fortified Castle to a Royal Keep Citadel (30G).
   * Boosts defense multiplier to 1.40x and max wall integrity to 150 (Sidequest Labs Edition only).
   */
  public upgradeRoyalKeep(lordId: string, territoryId: string): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'Royal Keep upgrades are only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    const territory = this.state.territories[territoryId];
    if (!territory || territory.isSherwood) {
      return { success: false, message: 'Cannot upgrade a Royal Keep here.' };
    }
    if (territory.ownerId !== lordId) {
      return {
        success: false,
        message: `You must own ${territory.name} to upgrade to a Royal Keep!`,
      };
    }
    if (!territory.hasCastle) {
      return {
        success: false,
        message: `${territory.name} must have a fortified Castle before upgrading to a Royal Keep!`,
      };
    }
    if (territory.isRoyalKeep) {
      return {
        success: false,
        message: `${territory.name} is already a Royal Keep Citadel!`,
      };
    }
    const ROYAL_KEEP_COST = 30;
    if (lord.gold < ROYAL_KEEP_COST) {
      return {
        success: false,
        message: `Need ${ROYAL_KEEP_COST} Gold to upgrade to a Royal Keep (have ${lord.gold}G).`,
      };
    }
    lord.gold -= ROYAL_KEEP_COST;
    territory.isRoyalKeep = true;
    const msg = `${lord.name} upgraded ${territory.name} to a Royal Keep Citadel (+40% Defense, 150 Wall Integrity, -${ROYAL_KEEP_COST}G)!`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * Transfers soldiers, knights, catapults, or longbowmen between a lord's mobile campaignArmy
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

    if (unitType === 'archers' && !this.isSidequestEdition()) {
      return {
        success: false,
        message: 'Longbowmen (Archers) are only available in Sidequest Labs Edition.',
      };
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

    const campCount = lord.campaignArmy[unitType] ?? 0;
    const garCount = territory.garrison[unitType] ?? 0;

    if (direction === 'toGarrison') {
      if (campCount < count) {
        return {
          success: false,
          message: `Not enough ${unitType} in Campaign Army to transfer.`,
        };
      }
      lord.campaignArmy[unitType] = campCount - count;
      territory.garrison[unitType] = garCount + count;
      this.notify();
      return {
        success: true,
        message: `Moved ${count} ${unitType} to ${territory.name} garrison.`,
      };
    } else {
      if (garCount < count) {
        return {
          success: false,
          message: `Not enough ${unitType} in ${territory.name} garrison to transfer.`,
        };
      }
      territory.garrison[unitType] = garCount - count;
      lord.campaignArmy[unitType] = campCount + count;
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

    // Coastal Sea Lanes (Sidequest Labs Edition only)
    if (this.isSidequestEdition() && isCoastalPort(lord.currentTerritoryId)) {
      const seaPorts = getConnectedSeaPorts(
        lord.currentTerritoryId,
        this.state.territories
      );
      for (const portId of seaPorts) {
        const portTerr = this.state.territories[portId];
        if (!portTerr || portTerr.isSherwood) continue;

        if (portTerr.ownerId === lordId) {
          // Free relocation between owned ports along the sea lane
          if (portId !== lord.currentTerritoryId && !friendlyIds.includes(portId)) {
            friendlyIds.push(portId);
          }
        } else if (portTerr.ownerId === null) {
          // Neutral naval invasion requires 5G charter fee
          if (lord.gold >= NAVAL_CHARTER_COST && !neutralIds.includes(portId)) {
            neutralIds.push(portId);
          }
        } else {
          // Enemy naval invasion requires 5G charter fee
          if (lord.gold >= NAVAL_CHARTER_COST && !enemyIds.includes(portId)) {
            enemyIds.push(portId);
          }
        }
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

    // Check if this is an amphibious movement across the Coastal Sea Lane
    const currentTerr = this.state.territories[lord.currentTerritoryId];
    const isAdjacentByLand = Boolean(currentTerr?.neighbors.includes(targetTerritoryId));
    const isSeaMove =
      this.isSidequestEdition() &&
      isCoastalPort(lord.currentTerritoryId) &&
      isCoastalPort(targetTerritoryId) &&
      !isAdjacentByLand;

    // 1. Friendly Territory Relocation
    if (isFriendlyMove && targetTerritory.ownerId === lordId) {
      lord.currentTerritoryId = targetTerritoryId;
      this.notify();
      const moveVerb = isSeaMove
        ? 'sailed the Coastal Sea Lane to'
        : 'relocated Campaign Army to';
      return {
        success: true,
        outcome: 'RELOCATED',
        message: `${lord.name} ${moveVerb} ${targetTerritory.name}.`,
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

    // Naval invasion charter fee (5 Gold)
    if (isSeaMove && targetTerritory.ownerId !== lordId) {
      if (lord.gold < NAVAL_CHARTER_COST) {
        return {
          success: false,
          outcome: 'BLOCKED',
          message: `Need at least ${NAVAL_CHARTER_COST} Gold for Naval Charter to launch a sea invasion!`,
        };
      }
      lord.gold -= NAVAL_CHARTER_COST;
      this.state.log.push(
        `${lord.name} chartered a naval transport fleet (-${NAVAL_CHARTER_COST}G) and launched an amphibious landing on ${targetTerritory.name}!`
      );
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
    const prevDefenderId = targetTerritory.ownerId;
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

    if (battle.attackerWon && prevDefenderId && prevDefenderId !== lordId && lord.isPlayer) {
      this.triggerNemesisVendetta(prevDefenderId);
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
   * Consults Robin Hood (for Saxon) or invokes Prince John's Charter (for Norman):
   * - Saxon: grants +12 Merry Men Soldiers directly to Campaign Army
   * - Norman: grants +10 Norman Mercenary Soldiers & +2 Longbowmen directly to Campaign Army
   */
  public consultRobinHood(): ActionResult {
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }

    const player = this.getPlayerLord();
    if (!player || !player.isActive || player.isDefeated) {
      return { success: false, message: 'Player lord is unavailable.' };
    }

    const isNorman = player.faction === 'norman';
    const benefactor = isNorman ? "Prince John's Royal Charter" : 'Robin Hood';

    if (this.state.robinHoodUsesLeft <= 0) {
      return {
        success: false,
        message: `${benefactor} has already aided your banner 3 times this campaign!`,
      };
    }

    if (this.state.robinHoodUsedThisTurn) {
      return {
        success: false,
        message: `${benefactor} has already granted aid this month! Wait until next turn.`,
      };
    }

    this.state.robinHoodUsesLeft -= 1;
    this.state.robinHoodUsedThisTurn = true;
    let msg: string;

    if (isNorman) {
      player.campaignArmy.soldiers += 10;
      player.campaignArmy.archers = (player.campaignArmy.archers ?? 0) + 2;
      msg = `Prince John's Royal Charter grants 10 Mercenary Soldiers and 2 Longbowmen to ${player.name}! (${this.state.robinHoodUsesLeft}/3 uses left)`;
    } else {
      player.campaignArmy.soldiers += ROBIN_HOOD_MERRY_MEN_COUNT;
      msg = `Robin Hood sends ${ROBIN_HOOD_MERRY_MEN_COUNT} Merry Men from Sherwood to ${player.name}! (${this.state.robinHoodUsesLeft}/3 uses left)`;
    }

    this.state.log.push(msg);
    this.notify();

    return { success: true, message: msg };
  }

  public invokePrinceJohnCharter(): ActionResult {
    return this.consultRobinHood();
  }

  /**
   * The Tavern: Hire Spy (5G).
   * Reveals exact intelligence (garrisons, treasuries, sabotage status) on all rival territories for 3 turns.
   */
  public hireSpy(lordId: string = this.state.selectedLordId): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'The Tavern is only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    const SPY_COST = 5;
    if (lord.gold < SPY_COST) {
      return {
        success: false,
        message: `Need ${SPY_COST} Gold to hire a Tavern Spy (have ${lord.gold}G).`,
      };
    }
    lord.gold -= SPY_COST;
    this.state.spiedTurnsRemaining = 3;
    const msg = `${lord.name} hired a Tavern Spy (-${SPY_COST}G)! Exact intelligence on all rival shires revealed for 3 turns.`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * The Tavern: Send Saboteur (12G, up to 1 per turn).
   * Inflicts 30 damage to castle wall integrity and poisons 15% of garrison soldiers immediately.
   */
  public sendSaboteur(
    targetTerritoryId: string,
    lordId: string = this.state.selectedLordId
  ): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'The Tavern is only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    if (this.state.saboteurSentThisTurn) {
      return {
        success: false,
        message:
          'Thou hast already dispatched a Saboteur this month! Wait until next turn.',
      };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    const target = this.state.territories[targetTerritoryId];
    if (!target || target.isSherwood) {
      return { success: false, message: 'Invalid target for sabotage.' };
    }
    if (target.ownerId === lordId) {
      return { success: false, message: 'Cannot sabotage thine own stronghold!' };
    }
    if (!target.hasCastle) {
      return {
        success: false,
        message: `${target.name} has no fortified Castle to sabotage!`,
      };
    }
    const SABOTEUR_COST = 12;
    if (lord.gold < SABOTEUR_COST) {
      return {
        success: false,
        message: `Need ${SABOTEUR_COST} Gold to hire a Saboteur (have ${lord.gold}G).`,
      };
    }
    lord.gold -= SABOTEUR_COST;
    this.state.saboteurSentThisTurn = true;
    target.sabotagedWallDamage = (target.sabotagedWallDamage ?? 0) + 30;
    const poisonCount = Math.max(
      1,
      Math.round(target.garrison.soldiers * 0.15)
    );
    target.garrison.soldiers = Math.max(
      0,
      target.garrison.soldiers - poisonCount
    );
    const msg = `Saboteur infiltrated ${target.name} (-${SABOTEUR_COST}G)! Weakened curtain wall (-30 integrity) and poisoned ${poisonCount} garrison soldiers.`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * The Tavern: Hire Welsh/Scottish Mercenaries (15G, up to 1 per turn).
   * Immediately adds +8 Soldiers and +2 Longbowmen to Campaign Army.
   */
  public hireMercenaries(
    lordId: string = this.state.selectedLordId
  ): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'The Tavern is only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    if (this.state.mercenariesHiredThisTurn) {
      return {
        success: false,
        message:
          'Thou hast already recruited mercenaries this month! Wait until next turn.',
      };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    const MERC_COST = 15;
    if (lord.gold < MERC_COST) {
      return {
        success: false,
        message: `Need ${MERC_COST} Gold to hire Mercenaries (have ${lord.gold}G).`,
      };
    }
    lord.gold -= MERC_COST;
    this.state.mercenariesHiredThisTurn = true;
    lord.campaignArmy.soldiers += 8;
    lord.campaignArmy.archers = (lord.campaignArmy.archers ?? 0) + 2;
    const msg = `${lord.name} hired Welsh/Scottish Mercenaries (-${MERC_COST}G)! +8 Soldiers and +2 Longbowmen joined Campaign Army.`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * Propose Non-Aggression Pact / Tribute (10G).
   * Signs a 3-Turn Non-Aggression Pact with a same-faction AI Lord.
   */
  public proposeNonAggressionPact(
    targetLordId: string,
    lordId: string = this.state.selectedLordId
  ): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'Diplomacy Pacts are only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    const target = this.state.activeLords[targetLordId];
    if (
      !target ||
      !target.isActive ||
      target.isDefeated ||
      target.isPlayer ||
      target.id === lordId
    ) {
      return { success: false, message: 'Invalid Lord for Non-Aggression Pact.' };
    }
    if (target.faction !== lord.faction) {
      return {
        success: false,
        message: `Cannot sign a Non-Aggression Pact with an enemy ${target.faction.toUpperCase()} lord!`,
      };
    }
    const PACT_COST = 10;
    if (lord.gold < PACT_COST) {
      return {
        success: false,
        message: `Need ${PACT_COST} Gold tribute to sign a Non-Aggression Pact (have ${lord.gold}G).`,
      };
    }
    lord.gold -= PACT_COST;
    target.gold += PACT_COST;
    target.pactWithPlayerTurns = 3;
    const msg = `Signed a 3-Turn Non-Aggression Pact with ${target.name} (-${PACT_COST}G)! ${target.name} will not attack player lands.`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * Contributes Gold toward King Richard's Ransom / Prince John's Royal Coronation Fund (200G).
   * Reaching 200 Gold immediately triggers Campaign Victory!
   */
  public contributeRoyalRansom(
    amount: number,
    lordId: string = this.state.selectedLordId
  ): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message:
          'Royal Ransom / Crown Fund is only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return { success: false, message: 'Lord is inactive or defeated.' };
    }
    if (amount <= 0 || !Number.isInteger(amount)) {
      return {
        success: false,
        message: 'Contribution amount must be a positive integer.',
      };
    }
    if (lord.gold < amount) {
      return {
        success: false,
        message: `Insufficient Gold! Cannot contribute ${amount}G (have ${lord.gold}G).`,
      };
    }
    lord.gold -= amount;
    this.state.royalRansomPaid = (this.state.royalRansomPaid ?? 0) + amount;
    const isSaxon = lord.faction === 'saxon';
    const fundName = isSaxon
      ? "King Richard's Ransom"
      : "Prince John's Royal Coronation Fund";

    if (this.state.royalRansomPaid >= 200) {
      this.state.victoryStatus = 'VICTORY';
      this.state.winnerLordId = lord.id;
      const victoryMsg = isSaxon
        ? `👑 KING RICHARD THE LIONHEART IS RANSOMED! With 200 Gold paid, King Richard returns to England and crowns ${lord.name} Protector of the Realm!`
        : `👑 PRINCE JOHN CROWNED KING! With your 200 Gold treasury backing, Prince John ascends the English throne and proclaims ${lord.name} Lord High Chancellor!`;
      this.state.log.push(victoryMsg);
      this.notify();
      return { success: true, message: victoryMsg };
    }

    const msg = `Contributed ${amount}G toward ${fundName} (${this.state.royalRansomPaid}/200 Gold collected).`;
    this.state.log.push(msg);
    this.notify();
    return { success: true, message: msg };
  }

  /**
   * Awards an unowned Legendary Relic to a Lord (Sidequest Labs Edition only).
   */
  public awardRelic(
    lordId: string = this.state.selectedLordId,
    preferredRelicId?: RelicId
  ): Relic | null {
    if (!this.isSidequestEdition()) {
      return null;
    }
    const lord = this.state.activeLords[lordId];
    if (!lord || !lord.isActive || lord.isDefeated) {
      return null;
    }
    lord.relicIds = lord.relicIds ?? [];

    let targetId: RelicId | undefined = preferredRelicId;
    if (targetId && lord.relicIds.includes(targetId)) {
      return ALL_RELICS[targetId]; // Already owned
    }

    if (!targetId) {
      targetId = RELIC_IDS.find((id) => !lord.relicIds!.includes(id));
    }

    if (!targetId || !ALL_RELICS[targetId]) {
      return null; // All relics acquired
    }

    lord.relicIds.push(targetId);
    const relic = ALL_RELICS[targetId];

    if (relic.statBonus) {
      if (relic.statBonus.swordplay) {
        lord.swordplay = Math.min(10, lord.swordplay + relic.statBonus.swordplay);
      }
      if (relic.statBonus.jousting) {
        lord.jousting = Math.min(10, lord.jousting + relic.statBonus.jousting);
      }
      if (relic.statBonus.leadership) {
        lord.leadership = Math.min(10, lord.leadership + relic.statBonus.leadership);
      }
    }

    const msg = `RELIC UNEARTHED! ${lord.name} acquired ${relic.name} (${relic.title})! ${relic.effectDescription}`;
    this.state.log.push(msg);
    this.notify();
    return relic;
  }

  public hasRelic(lordId: string, relicId: RelicId): boolean {
    const lord = this.state.activeLords[lordId];
    return Boolean(lord?.relicIds?.includes(relicId));
  }

  /**
   * Triggers a Blood Vendetta on an AI Lord against the player (Sidequest Labs Edition only).
   */
  public triggerNemesisVendetta(victimLordId: string): void {
    if (!this.isSidequestEdition()) return;
    const victim = this.state.activeLords[victimLordId];
    if (!victim || victim.isPlayer || !victim.isActive || victim.isDefeated) return;

    victim.hasVendettaAgainstPlayer = true;
    this.state.nemesisLordId = victim.id;
    const player = this.getPlayerLord();
    const msg = `BLOOD VENDETTA! ${victim.name} swears eternal vengeance against ${player.name}! [NEMESIS]`;
    this.state.log.push(msg);
    this.notify();
  }

  public clearNemesisVendetta(): void {
    if (
      this.state.nemesisLordId &&
      this.state.activeLords[this.state.nemesisLordId]
    ) {
      this.state.activeLords[this.state.nemesisLordId].hasVendettaAgainstPlayer =
        false;
    }
    this.state.nemesisLordId = null;
    this.state.pendingAssassinMission = false;
    this.notify();
  }

  /**
   * Initiates the 5th Mini-Game: The Sherwood Archery Contest (Sidequest Labs Edition only).
   */
  public initiateArcheryContest(): ActionResult {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'The Archery Tournament is only available in Sidequest Labs Edition.',
      };
    }
    if (this.state.victoryStatus !== 'ONGOING') {
      return { success: false, message: 'The campaign has already concluded.' };
    }
    if (this.state.archeryContestHeldThisTurn) {
      return {
        success: false,
        message:
          'Thou hast already competed in the Archery Contest this month! Click END TURN to advance.',
      };
    }

    this.state.phase = 'ARCHERY';
    this.state.archeryContestHeldThisTurn = true;
    this.notify();
    return {
      success: true,
      message: 'Royal Heralds announce the Grand Sherwood Archery Tournament!',
    };
  }

  /**
   * Initiates a Night Assassin Duel defending against a Nemesis assassin.
   */
  public initiateAssassinDuel(): {
    success: boolean;
    message: string;
    context?: PendingSwordplayContext;
  } {
    if (!this.isSidequestEdition()) {
      return {
        success: false,
        message: 'Assassin duels are only available in Sidequest Labs Edition.',
      };
    }
    if (!this.state.nemesisLordId) {
      return {
        success: false,
        message: 'No active Nemesis vendetta threatens thee with assassination!',
      };
    }
    const nemesis = this.state.activeLords[this.state.nemesisLordId];
    const player = this.getPlayerLord();
    const context: PendingSwordplayContext = {
      missionType: 'ASSASSIN',
      attackerId: player.id,
      targetLordId: nemesis ? nemesis.id : 'malvoisin',
      targetTerritoryId: player.homeTerritoryId,
    };

    this.state.phase = 'ASSASSIN';
    this.state.pendingAssassinMission = false;
    this.notify();

    return {
      success: true,
      message: `A deadly Night Assassin dispatched by ${
        nemesis?.name ?? 'thy Nemesis'
      } strikes in the shadows!`,
      context,
    };
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
  public static readonly SAVE_SIDEQUEST_STORAGE_KEY = 'dotc_save_sidequest_v1';
  public static readonly LAST_SAVE_EDITION_KEY = 'dotc_last_save_edition';

  /**
   * Serializes current CampaignState to a JSON string with metadata.
   */
  public serializeCampaign(): string {
    const edition: GameEdition =
      this.state.edition === 'SIDEQUEST_LABS' ? 'SIDEQUEST_LABS' : 'CLASSIC';
    return JSON.stringify({
      version: 1,
      edition,
      savedAt: Date.now(),
      state: {
        ...this.state,
        edition,
      },
    });
  }

  /**
   * Deserializes a JSON string into active CampaignState, validating its integrity.
   */
  public deserializeCampaign(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr) as {
        version?: number;
        edition?: GameEdition;
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

      const resolvedEdition: GameEdition =
        stateToLoad.edition === 'SIDEQUEST_LABS' ||
        parsed.edition === 'SIDEQUEST_LABS'
          ? 'SIDEQUEST_LABS'
          : 'CLASSIC';

      this.currentEdition = resolvedEdition;

      // Ensure all fields are preserved
      this.state = {
        ...stateToLoad,
        edition: resolvedEdition,
        hasConqueredThisTurn: stateToLoad.hasConqueredThisTurn ?? {},
        hasRaidedThisTurn: Boolean(stateToLoad.hasRaidedThisTurn),
        hasJoustedThisTurn: Boolean(stateToLoad.hasJoustedThisTurn),
        captiveDamsel: stateToLoad.captiveDamsel ?? null,
        rescuedDamselIds: stateToLoad.rescuedDamselIds ?? [],
        marriedDamselId: stateToLoad.marriedDamselId ?? null,
        royalRansomPaid: stateToLoad.royalRansomPaid ?? 0,
        spiedTurnsRemaining: stateToLoad.spiedTurnsRemaining ?? 0,
        saboteurSentThisTurn: Boolean(stateToLoad.saboteurSentThisTurn),
        mercenariesHiredThisTurn: Boolean(stateToLoad.mercenariesHiredThisTurn),
        nemesisLordId: stateToLoad.nemesisLordId ?? null,
        archeryContestHeldThisTurn: Boolean(
          stateToLoad.archeryContestHeldThisTurn
        ),
        lastSeasonalEvent: stateToLoad.lastSeasonalEvent ?? null,
        lastSeasonalEventMonth: stateToLoad.lastSeasonalEventMonth ?? 0,
        pendingAssassinMission: Boolean(stateToLoad.pendingAssassinMission),
      };

      for (const lord of Object.values(this.state.activeLords)) {
        lord.relicIds = lord.relicIds ?? [];
        lord.hasVendettaAgainstPlayer = Boolean(lord.hasVendettaAgainstPlayer);
      }

      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolves the default localStorage slot key for a given edition.
   */
  public static getStorageKeyForEdition(edition: GameEdition): string {
    return edition === 'SIDEQUEST_LABS'
      ? GameState.SAVE_SIDEQUEST_STORAGE_KEY
      : GameState.SAVE_STORAGE_KEY;
  }

  /**
   * Saves active campaign to localStorage (routing automatically by edition unless an explicit slotKey is passed).
   */
  public saveToStorage(slotKey?: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const edition = this.getEdition();
      const targetKey =
        slotKey ?? GameState.getStorageKeyForEdition(edition);
      const data = this.serializeCampaign();
      window.localStorage.setItem(targetKey, data);
      if (!slotKey) {
        window.localStorage.setItem(GameState.LAST_SAVE_EDITION_KEY, edition);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Loads campaign from localStorage.
   */
  public loadFromStorage(slotKey?: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      if (slotKey) {
        const data = window.localStorage.getItem(slotKey);
        if (!data) return false;
        return this.deserializeCampaign(data);
      }

      const info = this.getSavedCampaignInfo();
      if (!info) return false;
      const data = window.localStorage.getItem(info.slotKey);
      if (!data) return false;
      return this.deserializeCampaign(data);
    } catch {
      return false;
    }
  }

  /**
   * Inspects localStorage and returns metadata about the saved campaign (including its Edition),
   * optionally preferring a specific edition's save slot if present.
   */
  public getSavedCampaignInfo(
    preferredEdition?: GameEdition
  ): SavedCampaignMeta | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }

      const lastSavedEdition = window.localStorage.getItem(
        GameState.LAST_SAVE_EDITION_KEY
      ) as GameEdition | null;

      const candidateKeys: string[] = [];
      if (preferredEdition) {
        candidateKeys.push(GameState.getStorageKeyForEdition(preferredEdition));
      }
      if (
        lastSavedEdition === 'SIDEQUEST_LABS' ||
        lastSavedEdition === 'CLASSIC'
      ) {
        candidateKeys.push(GameState.getStorageKeyForEdition(lastSavedEdition));
      }
      candidateKeys.push(
        GameState.SAVE_SIDEQUEST_STORAGE_KEY,
        GameState.SAVE_STORAGE_KEY
      );

      const seen = new Set<string>();
      for (const key of candidateKeys) {
        if (seen.has(key)) continue;
        seen.add(key);
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          const st = parsed.state ?? parsed;
          if (st && st.selectedLordId && st.activeLords) {
            const edition: GameEdition =
              st.edition === 'SIDEQUEST_LABS' ||
              parsed.edition === 'SIDEQUEST_LABS' ||
              key === GameState.SAVE_SIDEQUEST_STORAGE_KEY
                ? 'SIDEQUEST_LABS'
                : 'CLASSIC';
            const lord = st.activeLords[st.selectedLordId];
            const month = typeof st.month === 'number' ? st.month : 1;
            return {
              edition,
              slotKey: key,
              lordId: st.selectedLordId,
              lordName: lord?.name ?? st.selectedLordId,
              month,
              monthLabel: MONTH_NAMES[(month - 1) % 12] || 'JAN',
              year: typeof st.year === 'number' ? st.year : 1149,
              turn: typeof st.turn === 'number' ? st.turn : 1,
            };
          }
        } catch {
          // Ignore malformed entry and try next candidate slot
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a saved campaign exists in localStorage.
   */
  public hasSavedCampaign(slotKey?: string): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      if (slotKey) {
        const data = window.localStorage.getItem(slotKey);
        if (!data) return false;
        const parsed = JSON.parse(data);
        const st = parsed.state ?? parsed;
        return Boolean(st && st.selectedLordId && st.activeLords);
      }
      return this.getSavedCampaignInfo() !== null;
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
    this.state.saboteurSentThisTurn = false;
    this.state.mercenariesHiredThisTurn = false;
    this.state.archeryContestHeldThisTurn = false;

    if (this.state.spiedTurnsRemaining && this.state.spiedTurnsRemaining > 0) {
      this.state.spiedTurnsRemaining -= 1;
    }

    for (const lord of Object.values(this.state.activeLords)) {
      if (lord.pactWithPlayerTurns && lord.pactWithPlayerTurns > 0) {
        lord.pactWithPlayerTurns -= 1;
      }
    }

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
    this.state.saboteurSentThisTurn = false;
    this.state.mercenariesHiredThisTurn = false;
    this.state.archeryContestHeldThisTurn = false;
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
