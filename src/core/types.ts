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
  leadership: number;
  jousting: number;
  swordplay: number;
  homeTerritoryId: string;
  gold: number;
  campaignArmy: Army;
  bio: string;
  historicalQuote: string;
  heraldry: LordHeraldry;
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
  mapCoords: { x: number; y: number };
}

export interface CampaignState {
  year: number;             // 1149
  month: number;            // 1 (January)
  turn: number;             // 1
  robinHoodUsesLeft: number; // 3
  selectedLordId: string;
  activeLords: Record<string, Lord>;
  territories: Record<string, Territory>;
  phase: GamePhase;
  log: string[];
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
