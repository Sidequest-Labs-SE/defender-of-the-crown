/**
 * ArcheryEngine
 * Pure TypeScript Longbow Ballistics & Sherwood Tournament Engine for Defender of the Crown.
 * Simulates arrow flight, wind drift, gravity drop, bow sway, and target scoring.
 * Zero Phaser / framework dependencies.
 */

import {
  ArcheryHitZone,
  ArcherySession,
  ArcheryShotResult,
  ArcheryTournamentResult,
} from './types';
import { GameState } from './GameState';
import { ALL_RELICS } from '../data/relics';

export interface CreateArcheryOptions {
  deterministic?: boolean;
  seed?: number;
  rivalLordId?: string;
  rivalName?: string;
  hasYewBowRelic?: boolean;
}

export class ArcheryEngine {
  public static readonly ROUND_1_DISTANCE = 50; // paces
  public static readonly ROUND_2_DISTANCE = 80; // paces

  public static readonly SPLIT_RADIUS = 5;
  public static readonly GOLD_RADIUS = 14;
  public static readonly RED_RADIUS = 28;
  public static readonly BLUE_RADIUS = 45;
  public static readonly WHITE_RADIUS = 62;

  public static readonly SCORE_SPLIT = 15;
  public static readonly SCORE_GOLD = 10;
  public static readonly SCORE_RED = 7;
  public static readonly SCORE_BLUE = 4;
  public static readonly SCORE_WHITE = 2;
  public static readonly SCORE_MISS = 0;

  public static readonly SILVER_ARROW_GOLD = 15;
  public static readonly VICTORY_ARCHERS_AWARD = 4;

  /**
   * Initializes a new 2-round Sherwood Archery Tournament session.
   */
  public static createSession(
    playerOrState: string | any,
    playerNameOrOptions?: string | CreateArcheryOptions,
    options?: CreateArcheryOptions
  ): ArcherySession {
    let playerLordId = 'ivanhoe';
    let playerName = 'Wilfred of Ivanhoe';
    let opt = options;

    if (typeof playerOrState === 'object' && playerOrState !== null) {
      playerLordId = playerOrState.selectedLordId ?? 'ivanhoe';
      playerName =
        playerOrState.activeLords?.[playerLordId]?.name ?? 'Saxon Hero';
      opt = (playerNameOrOptions as CreateArcheryOptions) ?? options;
    } else {
      playerLordId = playerOrState;
      playerName =
        typeof playerNameOrOptions === 'string'
          ? playerNameOrOptions
          : 'Saxon Hero';
      opt = options;
    }

    const deterministic = Boolean(opt?.deterministic);
    const rngState = (opt?.seed ?? 4241) >>> 0;

    const rivalLordId = opt?.rivalLordId ?? 'locksley';
    const rivalName = opt?.rivalName ?? 'Robin of Locksley';

    const session: ArcherySession = {
      playerLordId,
      playerName,
      rivalLordId,
      rivalName,
      currentRound: 1,
      currentRoundIndex: 0,
      shotsPerRound: 3,
      currentShotInRound: 1,
      playerScore: 0,
      playerTotalScore: 0,
      rivalScore: 0,
      rivalTotalScore: 0,
      rounds: [
        {
          roundNumber: 1,
          distancePaces: ArcheryEngine.ROUND_1_DISTANCE,
          wind: 0,
          playerShots: [],
          rivalShots: [],
        },
        {
          roundNumber: 2,
          distancePaces: ArcheryEngine.ROUND_2_DISTANCE,
          wind: 0,
          playerShots: [],
          rivalShots: [],
        },
      ],
      status: 'ACTIVE',
      hasSplitTarget: false,
      deterministic,
      rngState,
    };

    // Roll initial wind for both rounds
    session.rounds[0].wind = this.rollWind(session, 1);
    session.rounds[1].wind = this.rollWind(session, 2);

    return session;
  }

  /**
   * Computes gravity drop in pixels given target distance in paces.
   */
  public static calculateGravityDrop(distancePaces: number): number {
    return distancePaces === ArcheryEngine.ROUND_1_DISTANCE ? 12 : 26;
  }

  /**
   * Computes wind drift multiplier given target distance.
   */
  public static calculateWindFactor(distancePaces: number): number {
    return distancePaces === ArcheryEngine.ROUND_1_DISTANCE ? 1.4 : 2.2;
  }

  /**
   * Classifies a target offset into one of the 6 archery hit zones.
   */
  public static classifyHitZone(
    radius: number,
    hasExistingGold = false
  ): { zone: ArcheryHitZone; points: number; isSplit: boolean } {
    if (radius <= ArcheryEngine.SPLIT_RADIUS && hasExistingGold) {
      return {
        zone: 'ROBIN_HOOD_SPLIT',
        points: ArcheryEngine.SCORE_SPLIT,
        isSplit: true,
      };
    }
    if (radius <= ArcheryEngine.GOLD_RADIUS) {
      return {
        zone: 'GOLD_BULLSEYE',
        points: ArcheryEngine.SCORE_GOLD,
        isSplit: false,
      };
    }
    if (radius <= ArcheryEngine.RED_RADIUS) {
      return {
        zone: 'RED_INNER',
        points: ArcheryEngine.SCORE_RED,
        isSplit: false,
      };
    }
    if (radius <= ArcheryEngine.BLUE_RADIUS) {
      return {
        zone: 'BLUE_OUTER',
        points: ArcheryEngine.SCORE_BLUE,
        isSplit: false,
      };
    }
    if (radius <= ArcheryEngine.WHITE_RADIUS) {
      return {
        zone: 'WHITE_EDGE',
        points: ArcheryEngine.SCORE_WHITE,
        isSplit: false,
      };
    }
    return {
      zone: 'MISS',
      points: ArcheryEngine.SCORE_MISS,
      isSplit: false,
    };
  }

  /**
   * Executes a player shot toward (aimX, aimY) relative to target center (0, 0).
   * Incorporates wind, gravity drop, and bow sway.
   */
  public static shootPlayerArrow(
    session: ArcherySession,
    aimX: number,
    aimY: number,
    hasYewBowRelic = false
  ): ArcheryShotResult {
    if (session.status !== 'ACTIVE') {
      throw new Error('Archery match has already finished.');
    }

    const currentRoundIdx = session.currentRoundIndex ?? (session.currentRound - 1);
    const currentRound = session.rounds[currentRoundIdx];
    const wind = currentRound.wind;
    const distance = currentRound.distancePaces;
    const gravityDrop = this.calculateGravityDrop(distance);
    const windFactor = this.calculateWindFactor(distance);

    // Bow sway jitter (-3..+3, dampened 50% if owning sherwood_yew_bow relic)
    let swayX = 0;
    let swayY = 0;
    if (!session.deterministic) {
      const swayScale = hasYewBowRelic ? 0.5 : 1.0;
      swayX = (this.nextRandom(session) * 6 - 3) * swayScale;
      swayY = (this.nextRandom(session) * 6 - 3) * swayScale;
    }

    const finalX = Number((aimX + wind * windFactor + swayX).toFixed(1));
    const finalY = Number((aimY + gravityDrop + swayY).toFixed(1));
    const radius = Number(Math.sqrt(finalX * finalX + finalY * finalY).toFixed(1));

    // Check if an arrow is already in the gold ring to enable Robin Hood split
    const existingGolds = currentRound.playerShots.some(
      (s) => s.hitZone === 'GOLD_BULLSEYE' || s.hitZone === 'ROBIN_HOOD_SPLIT'
    );

    const hit = this.classifyHitZone(radius, existingGolds);
    if (hit.isSplit) {
      session.hasSplitTarget = true;
    }

    const commentary = this.formatShotCommentary(hit.zone, hit.points);
    const shotIndex = currentRound.playerShots.length + 1;

    const result: ArcheryShotResult = {
      shotIndex,
      roundNumber: currentRound.roundNumber,
      aimX,
      aimY,
      wind,
      finalX,
      finalY,
      radius,
      hitZone: hit.zone,
      points: hit.points,
      isSplit: hit.isSplit,
      commentary,
    };

    currentRound.playerShots.push(result);
    session.playerScore += result.points;
    session.playerTotalScore = session.playerScore;
    session.currentShotInRound = Math.min(session.shotsPerRound, currentRound.playerShots.length + 1);

    this.checkRoundProgression(session);

    return result;
  }

  /**
   * Simulates an intelligent AI shot by the Master Archer rival.
   */
  public static shootRivalArrow(session: ArcherySession): ArcheryShotResult {
    const currentRoundIdx = session.currentRoundIndex ?? (session.currentRound - 1);
    const currentRound = session.rounds[currentRoundIdx];
    const wind = currentRound.wind;
    const distance = currentRound.distancePaces;
    const gravityDrop = this.calculateGravityDrop(distance);
    const windFactor = this.calculateWindFactor(distance);

    // Master archer AI compensates well for gravity drop & wind drift
    const aiCompensatedAimX = -wind * windFactor * 0.95;
    const aiCompensatedAimY = -gravityDrop * 0.95;

    // Tiny jitter
    const jitter = session.deterministic
      ? (currentRound.rivalShots.length % 2 === 0 ? 3 : -2)
      : (this.nextRandom(session) * 16 - 8);

    const finalX = Number((aiCompensatedAimX + wind * windFactor + jitter).toFixed(1));
    const finalY = Number((aiCompensatedAimY + gravityDrop + jitter * 0.8).toFixed(1));
    const radius = Number(Math.sqrt(finalX * finalX + finalY * finalY).toFixed(1));

    const existingGolds = currentRound.rivalShots.some(
      (s) => s.hitZone === 'GOLD_BULLSEYE'
    );
    const hit = this.classifyHitZone(radius, existingGolds);

    const shotIndex = currentRound.rivalShots.length + 1;
    const commentary = `${session.rivalName} scores ${hit.points} pts (${hit.zone})!`;

    const result: ArcheryShotResult = {
      shotIndex,
      roundNumber: currentRound.roundNumber,
      aimX: aiCompensatedAimX,
      aimY: aiCompensatedAimY,
      wind,
      finalX,
      finalY,
      radius,
      hitZone: hit.zone,
      points: hit.points,
      isSplit: hit.isSplit,
      commentary,
    };

    currentRound.rivalShots.push(result);
    session.rivalScore += result.points;
    session.rivalTotalScore = session.rivalScore;

    this.checkRoundProgression(session);

    return result;
  }

  /**
   * Checks if both player and rival have completed their shots for the current round,
   * advancing to the next round or concluding the tournament.
   */
  private static checkRoundProgression(session: ArcherySession): void {
    const currentRoundIdx = session.currentRoundIndex ?? (session.currentRound - 1);
    const round = session.rounds[currentRoundIdx];
    if (!round) return;

    if (
      round.playerShots.length >= session.shotsPerRound &&
      round.rivalShots.length >= session.shotsPerRound
    ) {
      if (currentRoundIdx === 0) {
        // Advance from Round 1 to Round 2
        session.currentRoundIndex = 1;
        session.currentRound = 2;
        session.currentShotInRound = 1;
      } else {
        // Tournament completed
        if (session.playerScore > session.rivalScore) {
          session.status = 'PLAYER_WON';
        } else if (session.playerScore < session.rivalScore) {
          session.status = 'RIVAL_WON';
        } else {
          session.status = 'DRAW';
        }
      }
    }
  }

  /**
   * Convenience alias for shooting a player arrow.
   */
  public static shootArrow(
    session: ArcherySession,
    aimX: number,
    aimY: number,
    hasYewBowRelic = false
  ): ArcheryShotResult {
    return this.shootPlayerArrow(session, aimX, aimY, hasYewBowRelic);
  }

  /**
   * Automated player shot aiming accurately with wind & gravity compensation.
   */
  public static autoShootArrow(
    session: ArcherySession,
    hasYewBowRelic = false
  ): ArcheryShotResult {
    const currentRoundIdx = session.currentRoundIndex ?? (session.currentRound - 1);
    const currentRound = session.rounds[currentRoundIdx];
    const wind = currentRound.wind;
    const distance = currentRound.distancePaces;
    const gravityDrop = this.calculateGravityDrop(distance);
    const windFactor = this.calculateWindFactor(distance);
    const aimX = -wind * windFactor;
    const aimY = -gravityDrop;
    return this.shootPlayerArrow(session, aimX, aimY, hasYewBowRelic);
  }

  /**
   * Simulates / steps the rival's shot for the current round.
   */
  public static stepAiShot(session: ArcherySession): ArcheryShotResult {
    return this.shootRivalArrow(session);
  }

  /**
   * Commits tournament results and awards (+15G, +4 Archers, and Golden Yew Bow relic) to GameState.
   */
  public static commitArcheryOutcome(
    session: ArcherySession,
    gameState: GameState = GameState.getInstance()
  ): ArcheryTournamentResult {
    return gameState.mutateState((state) => {
      state.phase = 'CAMPAIGN_MAP';
      state.archeryContestHeldThisTurn = true;

      const player = state.activeLords[session.playerLordId];
      const playerWon = session.status === 'PLAYER_WON';
      const finalPlayerScore = session.playerTotalScore ?? session.playerScore;
      const finalRivalScore = session.rivalTotalScore ?? session.rivalScore;

      let goldAwarded = 0;
      let archersAwarded = 0;
      let relicAwarded: string | undefined;
      let headline = '';
      let chronicleMessage = '';

      if (playerWon) {
        goldAwarded = ArcheryEngine.SILVER_ARROW_GOLD;
        archersAwarded = ArcheryEngine.VICTORY_ARCHERS_AWARD;

        if (player) {
          player.gold += goldAwarded;
          player.campaignArmy.archers =
            (player.campaignArmy.archers ?? 0) + archersAwarded;

          // Award the Sherwood Yew Bow Relic on first victory!
          if (!player.relicIds || !player.relicIds.includes('sherwood_yew_bow')) {
            player.relicIds = player.relicIds ?? [];
            player.relicIds.push('sherwood_yew_bow');
            relicAwarded = 'sherwood_yew_bow';
          }
        }

        headline = 'VICTORY IN SHERWOOD GLADE!';
        const relicNotice = relicAwarded
          ? ` and was bestowed the legendary ${ALL_RELICS.sherwood_yew_bow.name}!`
          : '!';
        chronicleMessage = `${
          player?.name ?? 'The Saxon Hero'
        } defeated ${session.rivalName} (${finalPlayerScore} to ${
          finalRivalScore
        } pts) to win the Silver Arrow Purse (+${goldAwarded}G, +${archersAwarded} Longbowmen)${relicNotice}`;
      } else if (session.status === 'RIVAL_WON') {
        headline = 'DEFEAT AT THE ARCHERY MARK';
        chronicleMessage = `${session.rivalName} outshot ${
          player?.name ?? 'thee'
        } (${finalRivalScore} to ${finalPlayerScore} pts) at the Sherwood butts.`;
      } else {
        headline = 'DRAW IN SHERWOOD';
        chronicleMessage = `The archery contest between ${
          player?.name ?? 'thee'
        } and ${session.rivalName} ended in an honorable draw (${
          finalPlayerScore
        } pts apiece).`;
      }

      state.log.push(chronicleMessage);

      return {
        playerWon,
        playerScore: finalPlayerScore,
        rivalScore: finalRivalScore,
        goldAwarded,
        archersAwarded,
        relicAwarded,
        headline,
        chronicleMessage,
      };
    });
  }

  private static formatShotCommentary(zone: ArcheryHitZone, _points?: number): string {
    switch (zone) {
      case 'ROBIN_HOOD_SPLIT':
        return 'SPLITS THE ARROW IN TWAIN! An impossible bullseye! (15 pts)';
      case 'GOLD_BULLSEYE':
        return 'GOLD! Dead center in the heart of the target! (10 pts)';
      case 'RED_INNER':
        return 'RED! Inner ring strike! (7 pts)';
      case 'BLUE_OUTER':
        return 'BLUE! Firmly in the outer circle! (4 pts)';
      case 'WHITE_EDGE':
        return 'WHITE! Nicks the outer skirt of the butt! (2 pts)';
      case 'MISS':
      default:
        return 'MISS! The arrow thuds harmlessly into the turf! (0 pts)';
    }
  }

  private static rollWind(session: ArcherySession, roundNumber: number): number {
    if (session.deterministic) {
      return roundNumber === 1 ? 3 : -5;
    }
    // Wind between -8 and +8 knots
    return Math.floor(this.nextRandom(session) * 17) - 8;
  }

  private static nextRandom(session: ArcherySession): number {
    session.rngState = (session.rngState * 1664525 + 1013904223) >>> 0;
    return session.rngState / 0xffffffff;
  }
}
