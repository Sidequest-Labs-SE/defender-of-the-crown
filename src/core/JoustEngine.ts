import {
  CampaignState,
  JoustHitZone,
  JoustMatchStatus,
  JoustOutcomeSummary,
  JoustPassResult,
  JoustStakesType,
  PendingJoustContext,
  Territory,
} from './types';
import { GameState } from './GameState';

export type {
  JoustHitZone,
  JoustMatchStatus,
  JoustOutcomeSummary,
  JoustPassResult,
  JoustStakesType,
  PendingJoustContext,
};

export interface Point2D {
  x: number;
  y: number;
}

export interface JoustDuelist {
  id: string;
  name: string;
  title: string;
  faction: 'saxon' | 'norman';
  jousting: number; // 1..10
  portraitKey: string;
  shieldKey: string;
}

export interface JoustSession {
  stakesType: JoustStakesType;
  challengerId: string;
  opponentId: string;
  challenger: JoustDuelist;
  opponent: JoustDuelist;
  playerWagerTerritoryId?: string;
  playerWagerTerritoryName?: string;
  rivalWagerTerritoryId?: string;
  rivalWagerTerritoryName?: string;

  passNumber: number; // 1..3 (or 4+ in sudden death)
  maxPasses: number; // 3 base
  playerScore: number; // Broken lances
  rivalScore: number;
  passes: JoustPassResult[];
  status: JoustMatchStatus;
  winnerLordId: string | null;
  loserLordId: string | null;
  endReason: 'UNHORSED' | 'POINTS' | 'DISQUALIFIED_FOUL' | 'DRAW';

  deterministic: boolean;
  rngState: number;
  committed: boolean;
  committedSummary?: JoustOutcomeSummary;
  tickerLog: string[];
}

/**
 * JoustEngine — Sprint 6 Royal Jousting Tournament Engine
 * Pure TypeScript core module with ZERO Phaser dependencies.
 */
export class JoustEngine {
  public static readonly FAME_PURSE_GOLD = 15;
  public static readonly BASE_SWEETSPOT_RADIUS = 20;
  public static readonly MAX_BASE_PASSES = 3;

  // ==========================================================================
  // 1. STAT SCALING & AIM CALCULATIONS
  // ==========================================================================

  /**
   * Increases sweetspot bullseye radius by +5% per jousting stat point relative to baseline 5.
   */
  public static getSweetspotRadius(jousting: number): number {
    const clamped = Math.max(1, Math.min(10, jousting));
    return Number((this.BASE_SWEETSPOT_RADIUS * (1 + (clamped - 5) * 0.05)).toFixed(2));
  }

  /**
   * Reduces lance sway/jitter during the charge by -7% per jousting stat point relative to baseline 5.
   * Stat 4 -> 1.07 | Stat 5 -> 1.00 | Stat 9 -> 0.72
   */
  public static getSwayMultiplier(jousting: number): number {
    const clamped = Math.max(1, Math.min(10, jousting));
    return Number(Math.max(0.2, 1 - (clamped - 5) * 0.07).toFixed(2));
  }

  /**
   * Classifies where a lance tip strikes on the opponent's normalized target plane.
   * Supports both:
   *  - Absolute (100, 100) center on 200x240 screen overlay
   *  - Relative (0, 0) center boss coordinates
   */
  public static classifyHitZone(
    aim: number | { x: number; y: number },
    yOrJousting?: number,
    optJousting?: number
  ): JoustHitZone {
    let x = 0;
    let y = 0;
    let jousting = 5;

    if (typeof aim === 'object' && aim !== null) {
      x = aim.x;
      y = aim.y;
      jousting = typeof yOrJousting === 'number' ? yOrJousting : 5;
    } else {
      x = aim;
      y = typeof yOrJousting === 'number' ? yOrJousting : 0;
      jousting = typeof optJousting === 'number' ? optJousting : 5;
    }

    // Convert from absolute (100, 100) plane to relative (0, 0) if values are positive non-zero
    let relX = x;
    let relY = y;
    if (x >= 0 && y >= 0 && (x > 0 || y > 0)) {
      relX = x - 100;
      relY = y - 100;
    }

    const distFromCenter = Math.hypot(relX, relY);
    const sweetspotR = this.getSweetspotRadius(jousting);

    // 1. FOUL: Low strike into horse body/saddle (y > 190 in absolute or relY > 88)
    if (relY > 88) {
      return 'FOUL_HIT_HORSE';
    }

    // 2. UNHORSED: Bullseye strike on golden shield boss
    if (distFromCenter <= sweetspotR && relY <= 30) {
      return 'UNHORSED';
    }

    // 3. LANCE_SHATTERED: Solid strike on outer shield face (scores +1 broken lance)
    if (
      (Math.abs(relX) <= 52 && relY >= -50 && relY <= 85) ||
      (distFromCenter <= 65 && relY <= 85)
    ) {
      return 'LANCE_SHATTERED';
    }

    // 4. GLANCING_BLOW: Helm or rim of shield / armor edge
    if (
      (distFromCenter <= 78 && relY <= 38) ||
      (relY >= -88 && relY < -42 && Math.abs(relX) <= 48)
    ) {
      return 'GLANCING_BLOW';
    }

    // 5. MISS: Whiffed past the rider
    return 'MISS';
  }

  /**
   * Resolves AI aiming point on the (100, 100) plane.
   */
  public static resolveAiAim(jousting: number): Point2D {
    const clamped = Math.max(1, Math.min(10, jousting));
    const spread = Math.max(6, 42 - clamped * 3.6);
    const u1 = Math.max(0.0001, Math.random());
    const u2 = Math.max(0.0001, Math.random());
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
    return {
      x: 100 + z0 * (spread * 0.45),
      y: 100 + z1 * (spread * 0.45),
    };
  }

  /**
   * Resolves a Joust pass directly from a PendingJoustContext.
   */
  public static resolveJoustPass(
    context: PendingJoustContext,
    playerAim: Point2D,
    rivalAim: Point2D
  ): JoustPassResult {
    const pZone = this.classifyHitZone(playerAim, 7);
    const rZone = this.classifyHitZone(rivalAim, 7);

    const passNumber = (context.passesCompleted ?? 0) + 1;
    context.passesCompleted = passNumber;

    const playerUnhorsed = rZone === 'UNHORSED';
    const rivalUnhorsed = pZone === 'UNHORSED';
    const playerFoul = pZone === 'FOUL_HIT_HORSE';
    const rivalFoul = rZone === 'FOUL_HIT_HORSE';
    const playerPoint = pZone === 'LANCE_SHATTERED' || pZone === 'UNHORSED';
    const rivalPoint = rZone === 'LANCE_SHATTERED' || rZone === 'UNHORSED';

    if (playerPoint && !playerUnhorsed && !playerFoul) {
      context.playerScore = (context.playerScore ?? 0) + 1;
      context.challengerScore = context.playerScore;
      context.challengerBrokenLances = (context.challengerBrokenLances ?? 0) + 1;
    }
    if (rivalPoint && !rivalUnhorsed && !rivalFoul) {
      context.rivalScore = (context.rivalScore ?? 0) + 1;
      context.rivalBrokenLances = (context.rivalBrokenLances ?? 0) + 1;
    }

    let summary = '';
    if (playerFoul && rivalFoul) {
      context.matchStatus = 'DRAW';
      summary = 'Both knights struck the horse! Double foul disqualification!';
    } else if (playerFoul) {
      context.matchStatus = 'RIVAL_WON';
      summary = 'Foul! Thy lance struck the opponent horse! Disqualified!';
    } else if (rivalFoul) {
      context.matchStatus = 'CHALLENGER_WON';
      summary = 'Foul! Opponent struck thy horse! Disqualified!';
    } else if (rivalUnhorsed) {
      context.matchStatus = 'CHALLENGER_WON';
      summary = 'Direct hit on the center boss! Opponent unhorsed!';
    } else if (playerUnhorsed) {
      context.matchStatus = 'RIVAL_WON';
      summary = 'Direct hit on center boss! Thou art unhorsed!';
    } else if (passNumber >= (context.maxPasses ?? 3)) {
      const pScore = context.challengerScore ?? context.playerScore ?? 0;
      const rScore = context.rivalScore ?? 0;
      if (pScore > rScore) {
        context.matchStatus = 'CHALLENGER_WON';
        summary = `Tournament concludes! Victory on broken lances (${pScore} to ${rScore})!`;
      } else if (rScore > pScore) {
        context.matchStatus = 'RIVAL_WON';
        summary = `Tournament concludes! Defeat on broken lances (${rScore} to ${pScore})!`;
      } else {
        context.matchStatus = 'DRAW';
        summary = `Tournament concludes in a tie (${pScore} to ${rScore})!`;
      }
    } else {
      summary =
        pZone === 'LANCE_SHATTERED'
          ? 'Solid strike! Lance shattered (+1 Point)!'
          : 'Pass complete.';
    }

    const passResult: JoustPassResult = {
      passNumber,
      aimX: playerAim.x,
      aimY: playerAim.y,
      playerHitZone: pZone,
      rivalHitZone: rZone,
      challengerHitZone: pZone,
      playerPoint,
      rivalPoint,
      playerUnhorsed,
      rivalUnhorsed,
      playerFoul,
      rivalFoul,
      summary,
      commentary: summary,
    };

    if (!context.history) context.history = [];
    context.history.push(passResult);

    return passResult;
  }

  /**
   * Simulates AI rival aiming based on their jousting skill.
   */
  public static generateAiAim(
    rivalJousting: number,
    rng: () => number
  ): { x: number; y: number } {
    const clamped = Math.max(1, Math.min(10, rivalJousting));
    // Standard deviation decreases as jousting increases
    const spread = Math.max(8, 48 - clamped * 3.8);

    // Box-Muller transform for natural Gaussian aim clustering
    const u1 = Math.max(0.0001, rng());
    const u2 = Math.max(0.0001, rng());
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    // Aim centered on shield boss (100, 100)
    const x = Math.round(100 + z0 * (spread * 0.5));
    const y = Math.round(100 + z1 * (spread * 0.45));

    return { x, y };
  }

  // ==========================================================================
  // 2. STAKES VALIDATION & SESSION INITIALIZATION
  // ==========================================================================

  /**
   * Evaluates whether two lords can wager Land stakes (requires non-home shires).
   */
  public static canWagerLand(
    state: CampaignState,
    playerLordId: string,
    rivalLordId: string
  ): {
    allowed: boolean;
    playerTerritories: Territory[];
    rivalTerritories: Territory[];
    reason?: string;
  } {
    const player = state.activeLords[playerLordId];
    const rival = state.activeLords[rivalLordId];

    if (!player || !rival) {
      return {
        allowed: false,
        playerTerritories: [],
        rivalTerritories: [],
        reason: 'Invalid lords selected.',
      };
    }

    const playerTerritories = Object.values(state.territories).filter(
      (t) =>
        t.ownerId === player.id &&
        t.id !== player.homeTerritoryId &&
        !t.isSherwood
    );

    const rivalTerritories = Object.values(state.territories).filter(
      (t) =>
        t.ownerId === rival.id &&
        t.id !== rival.homeTerritoryId &&
        !t.isSherwood
    );

    if (playerTerritories.length === 0) {
      return {
        allowed: false,
        playerTerritories: [],
        rivalTerritories,
        reason: 'Thou must own at least 1 non-Home territory to wager Land stakes!',
      };
    }

    if (rivalTerritories.length === 0) {
      return {
        allowed: false,
        playerTerritories,
        rivalTerritories: [],
        reason: `${rival.name} possesses only their ancestral Home Castle — cannot wager Land!`,
      };
    }

    return {
      allowed: true,
      playerTerritories,
      rivalTerritories,
    };
  }

  /**
   * Creates a new JoustSession.
   */
  public static createSession(
    state: CampaignState,
    context: PendingJoustContext,
    options?: { deterministic?: boolean; seed?: number }
  ): JoustSession {
    const challenger = state.activeLords[context.challengerId];
    const opponent = state.activeLords[context.opponentId];

    if (!challenger || !opponent) {
      throw new Error(`Invalid joust participants: ${context.challengerId} vs ${context.opponentId}`);
    }

    const playerTerr = context.playerWagerTerritoryId
      ? state.territories[context.playerWagerTerritoryId]
      : undefined;
    const rivalTerr = context.rivalWagerTerritoryId
      ? state.territories[context.rivalWagerTerritoryId]
      : undefined;

    const challengerDuelist: JoustDuelist = {
      id: challenger.id,
      name: challenger.name,
      title: challenger.title,
      faction: challenger.faction,
      jousting: Math.max(1, Math.min(10, challenger.jousting)),
      portraitKey: `portrait_${challenger.id}`,
      shieldKey: `shield_${challenger.id}`,
    };

    const opponentDuelist: JoustDuelist = {
      id: opponent.id,
      name: opponent.name,
      title: opponent.title,
      faction: opponent.faction,
      jousting: Math.max(1, Math.min(10, opponent.jousting)),
      portraitKey: `portrait_${opponent.id}`,
      shieldKey: `shield_${opponent.id}`,
    };

    const introMsg =
      context.stakesType === 'LAND'
        ? `Tournament lists prepared! ${challenger.name} wagers ${playerTerr?.name ?? 'land'} against ${opponent.name}'s ${rivalTerr?.name ?? 'land'}!`
        : `Royal Tournament at the lists! ${challenger.name} tilts against ${opponent.name} for Fame and Glory!`;

    return {
      stakesType: context.stakesType,
      challengerId: challenger.id,
      opponentId: opponent.id,
      challenger: challengerDuelist,
      opponent: opponentDuelist,
      playerWagerTerritoryId: playerTerr?.id,
      playerWagerTerritoryName: playerTerr?.name,
      rivalWagerTerritoryId: rivalTerr?.id,
      rivalWagerTerritoryName: rivalTerr?.name,
      passNumber: 1,
      maxPasses: this.MAX_BASE_PASSES,
      playerScore: 0,
      rivalScore: 0,
      passes: [],
      status: 'IN_PROGRESS',
      winnerLordId: null,
      loserLordId: null,
      endReason: 'POINTS',
      deterministic: Boolean(options?.deterministic),
      rngState: (options?.seed ?? 0x1986c0de) >>> 0,
      committed: false,
      tickerLog: [introMsg, `PASS 1 OF 3 — Couch thy lance and sound the charge!`],
    };
  }

  // ==========================================================================
  // 3. PASS EXECUTION & RESOLUTION
  // ==========================================================================

  /**
   * Resolves a single joust pass (tilt) given the player's aim (aimX, aimY).
   */
  public static resolvePass(
    session: JoustSession,
    aimX: number,
    aimY: number,
    options?: { forcedRivalAim?: { x: number; y: number } }
  ): JoustPassResult {
    if (session.status !== 'IN_PROGRESS') {
      throw new Error('Joust session has already concluded.');
    }

    const rng = () => this.nextRandom(session);
    const rivalAim = options?.forcedRivalAim ?? this.generateAiAim(session.opponent.jousting, rng);

    const playerZone = this.classifyHitZone(aimX, aimY, session.challenger.jousting);
    const rivalZone = this.classifyHitZone(rivalAim.x, rivalAim.y, session.opponent.jousting);

    let playerUnhorsed = rivalZone === 'UNHORSED';
    let rivalUnhorsed = playerZone === 'UNHORSED';

    const playerFoul = playerZone === 'FOUL_HIT_HORSE';
    const rivalFoul = rivalZone === 'FOUL_HIT_HORSE';

    const playerPoint = playerZone === 'LANCE_SHATTERED' || playerZone === 'UNHORSED';
    const rivalPoint = rivalZone === 'LANCE_SHATTERED' || rivalZone === 'UNHORSED';

    // Tie-breaker when both hit center boss sweetspot simultaneously:
    // Knight with higher jousting skill resists unhorsing!
    if (playerUnhorsed && rivalUnhorsed) {
      if (session.challenger.jousting > session.opponent.jousting) {
        playerUnhorsed = false; // Player held saddle!
      } else if (session.opponent.jousting > session.challenger.jousting) {
        rivalUnhorsed = false; // Rival held saddle!
      } else {
        // Equal jousting tie: coin flip weighted by slight RNG or both shatter
        if (rng() < 0.5) {
          playerUnhorsed = false;
        } else {
          rivalUnhorsed = false;
        }
      }
    }

    if (playerPoint && !playerUnhorsed && !playerFoul) {
      session.playerScore += 1;
    }
    if (rivalPoint && !rivalUnhorsed && !rivalFoul) {
      session.rivalScore += 1;
    }

    let summary = '';

    // Check immediate endings
    if (playerFoul && rivalFoul) {
      session.status = 'DRAW';
      session.endReason = 'DISQUALIFIED_FOUL';
      summary = 'Both knights struck the horse! Double foul disqualification!';
    } else if (playerFoul) {
      session.status = 'RIVAL_WON';
      session.winnerLordId = session.opponentId;
      session.loserLordId = session.challengerId;
      session.endReason = 'DISQUALIFIED_FOUL';
      summary = `FOUL! ${session.challenger.name}'s lance struck the destrier! Disqualified!`;
    } else if (rivalFoul) {
      session.status = 'PLAYER_WON';
      session.winnerLordId = session.challengerId;
      session.loserLordId = session.opponentId;
      session.endReason = 'DISQUALIFIED_FOUL';
      summary = `FOUL! ${session.opponent.name} struck thy steed! Automatic victory for ${session.challenger.name}!`;
    } else if (rivalUnhorsed) {
      session.status = 'PLAYER_WON';
      session.winnerLordId = session.challengerId;
      session.loserLordId = session.opponentId;
      session.endReason = 'UNHORSED';
      summary = `UNHORSED! ${session.challenger.name} knocks ${session.opponent.name} clean out of the saddle! VICTORY!`;
    } else if (playerUnhorsed) {
      session.status = 'RIVAL_WON';
      session.winnerLordId = session.opponentId;
      session.loserLordId = session.challengerId;
      session.endReason = 'UNHORSED';
      summary = `UNHORSED! ${session.opponent.name} strikes center shield and sends thee flying to the turf!`;
    } else {
      // Normal pass result
      const pText =
        playerZone === 'LANCE_SHATTERED'
          ? 'shattered lance (+1 Pt)'
          : playerZone === 'GLANCING_BLOW'
          ? 'glancing blow'
          : 'missed';
      const rText =
        rivalZone === 'LANCE_SHATTERED'
          ? 'shattered lance (+1 Pt)'
          : rivalZone === 'GLANCING_BLOW'
          ? 'glancing blow'
          : 'missed';
      summary = `Pass ${session.passNumber}: ${session.challenger.name} ${pText}; ${session.opponent.name} ${rText}. (Score: ${session.playerScore} - ${session.rivalScore})`;
    }

    const passResult: JoustPassResult = {
      passNumber: session.passNumber,
      aimX,
      aimY,
      playerHitZone: playerZone,
      rivalHitZone: rivalZone,
      playerPoint,
      rivalPoint,
      playerUnhorsed,
      rivalUnhorsed,
      playerFoul,
      rivalFoul,
      summary,
    };

    session.passes.push(passResult);
    session.tickerLog.push(summary);

    // If still in progress, check if passes reached max
    if (session.status === 'IN_PROGRESS') {
      if (session.passNumber >= session.maxPasses) {
        if (session.playerScore > session.rivalScore) {
          session.status = 'PLAYER_WON';
          session.winnerLordId = session.challengerId;
          session.loserLordId = session.opponentId;
          session.endReason = 'POINTS';
          session.tickerLog.push(
            `TOURNAMENT VICTORY! ${session.challenger.name} wins by Broken Lances (${session.playerScore} vs ${session.rivalScore})!`
          );
        } else if (session.rivalScore > session.playerScore) {
          session.status = 'RIVAL_WON';
          session.winnerLordId = session.opponentId;
          session.loserLordId = session.challengerId;
          session.endReason = 'POINTS';
          session.tickerLog.push(
            `${session.opponent.name} wins by Broken Lances (${session.rivalScore} vs ${session.playerScore})!`
          );
        } else {
          // Tied: sudden death pass!
          session.passNumber += 1;
          session.tickerLog.push(
            `TIED SCORE (${session.playerScore} - ${session.rivalScore})! SUDDEN DEATH PASS ${session.passNumber}!`
          );
        }
      } else {
        session.passNumber += 1;
        session.tickerLog.push(
          `PASS ${session.passNumber} OF ${session.maxPasses} — Couch thy lance!`
        );
      }
    }

    return passResult;
  }

  /**
   * Auto-resolves a pass using the Challenger's jousting stat.
   */
  public static autoResolvePass(session: JoustSession): JoustPassResult {
    const rng = () => this.nextRandom(session);
    const playerAim = this.generateAiAim(session.challenger.jousting, rng);
    return this.resolvePass(session, playerAim.x, playerAim.y);
  }

  /**
   * Resolves the entire jousting match to completion.
   */
  public static resolveMatchToCompletion(
    session: JoustSession,
    maxRounds = 8
  ): JoustMatchStatus {
    let safety = 0;
    while (session.status === 'IN_PROGRESS' && safety < maxRounds) {
      safety += 1;
      this.autoResolvePass(session);
    }
    return session.status;
  }

  // ==========================================================================
  // 4. CAMPAIGN OUTCOME COMMITMENT (FAME vs LAND)
  // ==========================================================================

  /**
   * Commits the completed Joust outcome into GameState.
   */
  public static commitMatchOutcome(
    session: JoustSession,
    gameState: GameState = GameState.getInstance()
  ): JoustOutcomeSummary {
    return gameState.mutateState((state) =>
      this.commitOutcomeOnState(state, session)
    );
  }

  /**
   * Pure state mutator committing Joust outcome into CampaignState.
   */
  public static commitOutcomeOnState(
    state: CampaignState,
    session: JoustSession
  ): JoustOutcomeSummary {
    if (session.committed && session.committedSummary) {
      return session.committedSummary;
    }

    state.phase = 'CAMPAIGN_MAP';
    state.hasJoustedThisTurn = true;

    const challenger = state.activeLords[session.challengerId];
    const opponent = state.activeLords[session.opponentId];

    let goldAwarded = 0;
    let leadershipGained = 0;
    let joustingGained = 0;
    let territoryTransferredId: string | undefined;
    let territoryTransferredName: string | undefined;
    let headline = '';
    let chronicleMessage = '';

    const isPlayerVictory = session.status === 'PLAYER_WON';

    if (session.stakesType === 'FAME') {
      if (isPlayerVictory) {
        goldAwarded = this.FAME_PURSE_GOLD;
        if (challenger) {
          challenger.gold += goldAwarded;
          const prevLead = challenger.leadership;
          challenger.leadership = Math.min(10, challenger.leadership + 1);
          leadershipGained = challenger.leadership - prevLead;

          const prevJoust = challenger.jousting;
          challenger.jousting = Math.min(10, challenger.jousting + 1);
          joustingGained = challenger.jousting - prevJoust;
        }

        headline = 'CHAMPION OF THE ROYAL TOURNAMENT!';
        chronicleMessage = `${challenger?.name ?? 'Player'} triumphed in the lists against ${
          opponent?.name ?? 'Rival'
        } for Fame! (+${goldAwarded}G purse, +${leadershipGained} Leadership, +${joustingGained} Jousting)`;
      } else if (session.status === 'RIVAL_WON') {
        headline = 'DEFEATED IN THE LISTS';
        chronicleMessage = `${challenger?.name ?? 'Player'} was bested by ${
          opponent?.name ?? 'Rival'
        } in the tournament tilts.`;
      } else {
        headline = 'TOURNAMENT ENDS IN A DRAW';
        chronicleMessage = `The tournament tilt between ${challenger?.name ?? 'Player'} and ${
          opponent?.name ?? 'Rival'
        } ended in a noble draw.`;
      }
    } else {
      // LAND STAKES
      if (isPlayerVictory) {
        const targetTerr = session.rivalWagerTerritoryId
          ? state.territories[session.rivalWagerTerritoryId]
          : undefined;

        if (targetTerr) {
          targetTerr.ownerId = session.challengerId;
          territoryTransferredId = targetTerr.id;
          territoryTransferredName = targetTerr.name;
        }

        headline = 'TERRITORY WON AT THE TILT-YARD!';
        chronicleMessage = `${challenger?.name ?? 'Player'} won the joust against ${
          opponent?.name ?? 'Rival'
        } and claimed ${territoryTransferredName ?? 'the shire'} without bloodshed!`;
      } else if (session.status === 'RIVAL_WON') {
        const lostTerr = session.playerWagerTerritoryId
          ? state.territories[session.playerWagerTerritoryId]
          : undefined;

        if (lostTerr) {
          lostTerr.ownerId = session.opponentId;
          territoryTransferredId = lostTerr.id;
          territoryTransferredName = lostTerr.name;
        }

        headline = 'TERRITORY FORFEITED IN JOUST';
        chronicleMessage = `${challenger?.name ?? 'Player'} was defeated in the Land joust; ${
          territoryTransferredName ?? 'thy shire'
        } yielded to ${opponent?.name ?? 'the victor'}.`;
      } else {
        headline = 'LAND JOUST ENDS IN DRAW';
        chronicleMessage = `Neither lord yielded ground in the tournament; land stakes remain with their masters.`;
      }
    }

    state.log.push(chronicleMessage);
    if (state.log.length > 50) {
      state.log = state.log.slice(-50);
    }

    const summary: JoustOutcomeSummary = {
      status: session.status,
      winnerLordId: session.winnerLordId,
      loserLordId: session.loserLordId,
      passesCompleted: session.passes.length,
      playerScore: session.playerScore,
      rivalScore: session.rivalScore,
      endReason: session.endReason,
      stakesType: session.stakesType,
      goldAwarded,
      leadershipGained,
      joustingGained,
      territoryTransferredId,
      territoryTransferredName,
      headline,
      chronicleMessage,
    };

    session.committed = true;
    session.committedSummary = summary;
    return summary;
  }

  // ==========================================================================
  // 5. INTERNAL PRNG
  // ==========================================================================

  private static nextRandom(session: JoustSession): number {
    if (!session.deterministic) {
      return Math.random();
    }
    // Mulberry32 deterministic PRNG
    let t = (session.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
