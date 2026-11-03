/**
 * Core Data Models & Types for Defender of the Crown
 * Pure TypeScript definitions with zero framework dependencies.
 */

export type Faction = 'saxon' | 'norman';

export type GamePhase =
  | 'BOOT'
  | 'TITLE'
  | 'SELECT_CHARACTER'
  | 'CAMPAIGN_MAP'
  | 'JOUST'
  | 'RAID'
  | 'SIEGE';

export type VictoryStatus = 'ONGOING' | 'VICTORY' | 'DEFEAT';

export type UnitType = 'soldiers' | 'knights' | 'catapults';

/**
 * Strict 1986 Cinemaware Unit & Fortification Prices
 */
export const UNIT_COSTS = {
  soldiers: 1,
  knights: 8,
  catapults: 15,
  castle: 20,
} as const;

export const ROBIN_HOOD_MERRY_MEN_COUNT = 12;

export const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

export interface Army {
  soldiers: number;
  knights: number;
  catapults: number;
}

export interface LordStats {
  leadership: number; // 1-10
  jousting: number;   // 1-10
  swordplay: number;  // 1-10
}

export interface LordHeraldry {
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  symbol: 'lion' | 'cross' | 'sword' | 'wolf' | 'falcon' | 'boar' | 'axe';
}

export interface Lord {
  id: string;
  name: string;
  title: string;
  faction: Faction;
  isPlayer: boolean;
  isActive: boolean;
  isDefeated?: boolean;
  leadership: number;
  jousting: number;
  swordplay: number;
  homeTerritoryId: string;
  currentTerritoryId: string;
  gold: number;
  campaignArmy: Army;
  bio: string;
  historicalQuote: string;
  heraldry: LordHeraldry;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface Territory {
  id: string;
  name: string;
  taxIncome: number;
  hasCastle: boolean;
  isSherwood?: boolean;
  homeLordId?: string; // Original home territory of a lord
  ownerId: string | null; // Null if neutral
  garrison: Army;
  neighbors: string[];
  mapCoords: MapPoint;
  polygon?: MapPoint[];
}

export interface CampaignState {
  year: number;             // 1149
  month: number;            // 1 (January)
  turn: number;             // 1
  robinHoodUsesLeft: number; // 3
  robinHoodUsedThisTurn: boolean;
  hasConqueredThisTurn: Record<string, boolean>;
  selectedLordId: string;
  activeLords: Record<string, Lord>;
  territories: Record<string, Territory>;
  phase: GamePhase;
  victoryStatus: VictoryStatus;
  winnerLordId: string | null;
  log: string[];
}

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface BattleResult {
  allowed: boolean;
  attackerWon: boolean;
  attackerId: string;
  defenderId: string | null;
  territoryId: string;
  attackerStrength: number;
  defenderStrength: number;
  attackerCasualties: Army;
  defenderCasualties: Army;
  homeCastleCaptured: boolean;
  eliminatedLordId: string | null;
  campaignVictoryTriggered: boolean;
  campaignDefeatTriggered: boolean;
  message: string;
}

export interface MoveResult {
  success: boolean;
  outcome: 'RELOCATED' | 'ANNEXED' | 'BATTLE_WON' | 'BATTLE_LOST' | 'SHERWOOD' | 'BLOCKED';
  message: string;
  battle?: BattleResult;
}

export interface TurnSummary {
  year: number;
  month: number;
  turn: number;
  events: string[];
  taxesCollected: Record<string, number>;
  victoryStatus: VictoryStatus;
}

/**
 * Translates a 1-10 numeric stat into the classic Cinemaware text rating.
 */
export function getCinemawareStatRating(stat: number): string {
  if (stat <= 3) return 'Poor';
  if (stat <= 5) return 'Average';
  if (stat <= 7) return 'Good';
  if (stat <= 9) return 'Best';
  return 'Legendary';
}
