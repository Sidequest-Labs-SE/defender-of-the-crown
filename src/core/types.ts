/**
 * Core Data Models & Types for Defender of the Crown
 * Pure TypeScript definitions with zero framework dependencies.
 */

export type Faction = 'saxon' | 'norman';

export type GameEdition = 'CLASSIC' | 'SIDEQUEST_LABS';

export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

export type GamePhase =
  | 'BOOT'
  | 'TITLE'
  | 'SELECT_CHARACTER'
  | 'CAMPAIGN_MAP'
  | 'BATTLE'
  | 'JOUST'
  | 'RAID'
  | 'RESCUE'
  | 'SIEGE'
  | 'ARCHERY'
  | 'ASSASSIN';

export type SwordplayMissionType = 'RAID' | 'RESCUE' | 'ASSASSIN';

export type SwordplayZone = 'HIGH' | 'MID' | 'LOW';

export type SwordplayAction =
  | 'ATTACK_HIGH'
  | 'ATTACK_MID'
  | 'ATTACK_LOW'
  | 'PARRY'
  | 'STEP_BACK';

export type SwordplayMissionStatus = 'ACTIVE' | 'VICTORY' | 'DEFEATED' | 'FLED';

export type SaxonDamselId = 'rowena' | 'rebecca' | 'marian' | 'rosalind';

export interface SaxonDamsel {
  id: SaxonDamselId;
  name: string;
  title: string;
  dowryGold: number;
  leadershipBonus: number;
  secondaryStat: 'jousting' | 'swordplay';
  secondaryBonus: number;
  quote: string;
  bio: string;
}

export interface CaptiveDamselEvent {
  damselId: SaxonDamselId;
  captorLordId: string;
  castleTerritoryId: string;
  turnCaptured: number;
}

export type JoustStakesType = 'FAME' | 'LAND';

export type JoustHitZone =
  | 'UNHORSED'
  | 'LANCE_SHATTERED'
  | 'GLANCING_BLOW'
  | 'MISS'
  | 'FOUL_HIT_HORSE';

export type JoustMatchStatus =
  | 'IN_PROGRESS'
  | 'PLAYER_WON'
  | 'CHALLENGER_WON'
  | 'RIVAL_WON'
  | 'DRAW';

export interface JoustPassResult {
  passNumber: number;
  aimX: number;
  aimY: number;
  playerHitZone: JoustHitZone;
  rivalHitZone: JoustHitZone;
  challengerHitZone?: JoustHitZone;
  playerPoint: boolean;
  rivalPoint: boolean;
  playerUnhorsed: boolean;
  rivalUnhorsed: boolean;
  playerFoul: boolean;
  rivalFoul: boolean;
  summary: string;
  commentary?: string;
}

export interface PendingJoustContext {
  challengerId: string;
  opponentId: string;
  stakesType: JoustStakesType;
  challengerLordId?: string;
  rivalLordId?: string;
  stakes?: JoustStakesType;
  playerWagerTerritoryId?: string;
  rivalWagerTerritoryId?: string;
  wagerTerritoryId?: string;
  passesCompleted?: number;
  maxPasses?: number;
  playerScore?: number;
  challengerScore?: number;
  rivalScore?: number;
  playerBrokenLances?: number;
  challengerBrokenLances?: number;
  rivalBrokenLances?: number;
  matchStatus?: JoustMatchStatus;
  history?: JoustPassResult[];
}

export interface JoustOutcomeSummary {
  status?: JoustMatchStatus;
  winnerLordId: string | null;
  loserLordId?: string | null;
  passesCompleted?: number;
  playerScore?: number;
  challengerScore?: number;
  rivalScore?: number;
  endReason?: 'UNHORSED' | 'POINTS' | 'DISQUALIFIED_FOUL' | 'DRAW';
  stakesType?: JoustStakesType;
  goldAwarded: number;
  leadershipGained?: number;
  joustingGained?: number;
  territoryTransferredId?: string;
  territoryTransferredName?: string;
  headline?: string;
  chronicleMessage?: string;
  narrativeChronicle?: string;
  context?: PendingJoustContext;
}

export interface PendingSwordplayContext {
  missionType: SwordplayMissionType;
  attackerId: string;
  targetLordId: string;
  targetTerritoryId: string;
  damselId?: SaxonDamselId;
}

export type BattleTactic =
  | 'FEROCIOUS_ATTACK'
  | 'NORMAL_ATTACK'
  | 'CAUTIOUS_ATTACK'
  | 'STAND_AND_FIGHT'
  | 'OUTFLANK';

export type BattleSide = 'attacker' | 'defender';

export type SiegeAmmoType = 'BOULDER' | 'GREEK_FIRE' | 'DISEASE';

export type SiegeImpactZone =
  | 'SHORT_MISS'
  | 'WALL_HIT'
  | 'OVER_WALL_COURTYARD'
  | 'LONG_MISS';

export type BattleOutcomeStatus =
  | 'ONGOING'
  | 'ATTACKER_WON'
  | 'DEFENDER_WON'
  | 'ATTACKER_RETREATED'
  | 'DEFENDER_RETREATED';

export type VictoryStatus = 'ONGOING' | 'VICTORY' | 'DEFEAT';

export type UnitType = 'soldiers' | 'knights' | 'catapults' | 'archers';

/**
 * Strict 1986 Cinemaware Unit & Fortification Prices + Sprint 8 Sidequest Expansion
 */
export const UNIT_COSTS = {
  soldiers: 1,
  knights: 8,
  catapults: 15,
  castle: 20,
  archers: 4,
  market: 12,
  royalKeep: 30,
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
  archers?: number;
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
  pactWithPlayerTurns?: number;
  relicIds?: string[];
  hasVendettaAgainstPlayer?: boolean;
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
  hasMarket?: boolean;
  isRoyalKeep?: boolean;
  sabotagedWallDamage?: number;
}

export interface CampaignState {
  edition: GameEdition;     // 'CLASSIC' | 'SIDEQUEST_LABS'
  year: number;             // 1149
  month: number;            // 1 (January)
  turn: number;             // 1
  robinHoodUsesLeft: number; // 3
  robinHoodUsedThisTurn: boolean;
  hasConqueredThisTurn: Record<string, boolean>;
  hasRaidedThisTurn: boolean;
  hasJoustedThisTurn: boolean;
  captiveDamsel: CaptiveDamselEvent | null;
  rescuedDamselIds: SaxonDamselId[];
  marriedDamselId: SaxonDamselId | null;
  selectedLordId: string;
  activeLords: Record<string, Lord>;
  territories: Record<string, Territory>;
  phase: GamePhase;
  victoryStatus: VictoryStatus;
  winnerLordId: string | null;
  log: string[];
  royalRansomPaid?: number;
  playerFaction?: Faction;
  spiedTurnsRemaining?: number;
  saboteurSentThisTurn?: boolean;
  mercenariesHiredThisTurn?: boolean;
  nemesisLordId?: string | null;
  archeryContestHeldThisTurn?: boolean;
  lastSeasonalEvent?: string | null;
  lastSeasonalEventMonth?: number;
  pendingAssassinMission?: boolean;
}

export type ArcheryHitZone =
  | 'ROBIN_HOOD_SPLIT'
  | 'GOLD_BULLSEYE'
  | 'RED_INNER'
  | 'BLUE_OUTER'
  | 'WHITE_EDGE'
  | 'MISS';

export interface ArcheryShotResult {
  shotIndex: number;
  roundNumber: number;
  aimX: number;
  aimY: number;
  wind: number;
  finalX: number;
  finalY: number;
  radius: number;
  hitZone: ArcheryHitZone;
  points: number;
  isSplit: boolean;
  commentary: string;
}

export interface ArcheryRound {
  roundNumber: number;
  distancePaces: 50 | 80;
  wind: number;
  playerShots: ArcheryShotResult[];
  rivalShots: ArcheryShotResult[];
}

export interface ArcherySession {
  playerLordId: string;
  playerName: string;
  rivalLordId: string;
  rivalName: string;
  currentRound: number; // 1 or 2
  currentRoundIndex?: number; // 0 or 1
  shotsPerRound: number; // 3
  currentShotInRound: number; // 1..3
  playerScore: number;
  playerTotalScore?: number;
  rivalScore: number;
  rivalTotalScore?: number;
  rounds: ArcheryRound[];
  status: 'ACTIVE' | 'PLAYER_WON' | 'RIVAL_WON' | 'DRAW';
  hasSplitTarget: boolean;
  deterministic: boolean;
  rngState: number;
}

export interface ArcheryTournamentResult {
  playerWon: boolean;
  playerScore: number;
  rivalScore: number;
  goldAwarded: number;
  archersAwarded: number;
  relicAwarded?: string;
  headline: string;
  chronicleMessage: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
}

export interface SiegeOutcomeModifiers {
  wallIntegrity: number; // 0..100
  wallBreached: boolean;
  isPlagueInfected: boolean;
  isOnFire: boolean;
  volleysFired: number;
  postSiegeAttackerArmy: Army;
  postSiegeDefenderGarrison: Army;
  postSiegeDefenderFieldArmy: Army;
  siegeAttackerCasualties: Army;
  siegeDefenderCasualties: Army;
}

export interface PendingBattleContext {
  attackerId: string;
  defenderId: string | null;
  territoryId: string;
  originTerritoryId: string;
  hasCastle: boolean;
  mode: 'PLAYER_ATTACK' | 'PLAYER_DEFENSE';
  siege?: SiegeOutcomeModifiers;
}

export interface BattleResult {
  allowed: boolean;
  attackerWon: boolean;
  retreated?: boolean;
  retreatingSide?: BattleSide;
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
  outcome:
    | 'RELOCATED'
    | 'ANNEXED'
    | 'BATTLE_WON'
    | 'BATTLE_LOST'
    | 'BATTLE_PENDING'
    | 'SHERWOOD'
    | 'BLOCKED';
  message: string;
  battle?: BattleResult;
  pendingBattle?: PendingBattleContext;
}

export interface AiTurnQueueState {
  remainingAiLordIds: string[];
  events: string[];
}

export interface InteractiveTurnResult {
  status: 'TURN_COMPLETE' | 'PAUSED_FOR_PLAYER_DEFENSE';
  summary?: TurnSummary;
  pendingBattle?: PendingBattleContext;
  queueState?: AiTurnQueueState;
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

/**
 * Computes the meteorological medieval season for a 1-based calendar month (1 = JAN .. 12 = DEC).
 * - WINTER: Dec (12), Jan (1), Feb (2)
 * - SPRING: Mar (3), Apr (4), May (5)
 * - SUMMER: Jun (6), Jul (7), Aug (8)
 * - AUTUMN: Sep (9), Oct (10), Nov (11)
 */
export function getSeasonForMonth(month: number): Season {
  const m = (((month - 1) % 12) + 12) % 12 + 1;
  if (m === 12 || m === 1 || m === 2) return 'WINTER';
  if (m >= 3 && m <= 5) return 'SPRING';
  if (m >= 6 && m <= 8) return 'SUMMER';
  return 'AUTUMN';
}

/**
 * Returns the formatted Season HUD badge label for Sidequest Labs Edition.
 */
export function getSeasonBadgeLabel(season: Season): string {
  switch (season) {
    case 'WINTER':
      return '❄ WINTER';
    case 'SPRING':
      return '🌱 SPRING';
    case 'SUMMER':
      return '☀ SUMMER';
    case 'AUTUMN':
      return '🍂 AUTUMN';
  }
}
