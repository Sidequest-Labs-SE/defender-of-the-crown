import { CampaignState, Lord, Territory, GamePhase } from './types';
import { ALL_LORDS, SAXON_LORDS, NORMAN_LORDS } from '../data/lords';
import { INITIAL_TERRITORIES } from '../data/territories';

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
    selectedLordId: 'ivanhoe',
    activeLords: {},
    territories: {},
    phase: 'BOOT',
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
    // Clone all territories
    const clonedTerritories: Record<string, Territory> = JSON.parse(
      JSON.stringify(INITIAL_TERRITORIES)
    );

    // Deep clone all lords
    const clonedLords: Record<string, Lord> = JSON.parse(
      JSON.stringify(ALL_LORDS)
    );

    this.state = {
      year: 1149,
      month: 1,
      turn: 1,
      robinHoodUsesLeft: 3,
      selectedLordId: 'ivanhoe',
      activeLords: clonedLords,
      territories: clonedTerritories,
      phase: 'BOOT',
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
      throw new Error(`Invalid player lord selection: ${selectedLordId}. Must be a valid Saxon Lord.`);
    }

    // Fresh clone of territories
    const territories: Record<string, Territory> = JSON.parse(
      JSON.stringify(INITIAL_TERRITORIES)
    );

    // Deep clone of all lords
    const allLordsCloned: Record<string, Lord> = JSON.parse(
      JSON.stringify(ALL_LORDS)
    );

    // Pick 2 Saxon AI lords from the remaining 3
    const otherSaxonIds = Object.keys(SAXON_LORDS).filter(id => id !== selectedLordId);
    // Sort or pick deterministically (first 2) to ensure clean testability
    const chosenSaxonAiIds = otherSaxonIds.slice(0, 2);

    const activeLordIds: string[] = [
      selectedLordId,
      ...chosenSaxonAiIds,
      ...Object.keys(NORMAN_LORDS), // 3 Normans
    ];

    const activeLords: Record<string, Lord> = {};

    // Initialize Active Lords
    for (const lordId of activeLordIds) {
      const lord = allLordsCloned[lordId];
      lord.isActive = true;
      lord.isPlayer = lordId === selectedLordId;
      lord.gold = 10;
      lord.campaignArmy = {
        soldiers: 10,
        knights: 1,
        catapults: 0,
      };

      activeLords[lordId] = lord;

      // Assign home territory
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

    // Mark the 4th Saxon lord as inactive
    const inactiveSaxonId = otherSaxonIds[2];
    if (inactiveSaxonId && allLordsCloned[inactiveSaxonId]) {
      allLordsCloned[inactiveSaxonId].isActive = false;
      allLordsCloned[inactiveSaxonId].isPlayer = false;
    }

    // Nottingham Sherwood sanity check
    if (territories['notts']) {
      territories['notts'].isSherwood = true;
    }

    this.state = {
      year: 1149,
      month: 1, // January
      turn: 1,
      robinHoodUsesLeft: 3,
      selectedLordId,
      activeLords,
      territories,
      phase: 'CAMPAIGN_MAP',
      log: [
        `Campaign commences in the Year of our Lord 1149.`,
        `Lord ${activeLords[selectedLordId].name} takes up the sword for Saxon freedom!`,
        `England lies divided between 3 Saxon and 3 Norman factions.`,
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
    const playerLordId = this.state.selectedLordId;
    return Object.values(this.state.territories).filter(
      (t) => t.ownerId === playerLordId
    );
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
