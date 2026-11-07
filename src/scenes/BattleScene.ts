import Phaser from 'phaser';
import {
  ALL_BATTLE_TACTICS,
  BattleEngine,
  BattleSession,
  BattleTickReport,
  TACTIC_PROFILES,
} from '../core/BattleEngine';
import { GameState } from '../core/GameState';
import {
  AiTurnQueueState,
  BattleResult,
  BattleSide,
  BattleTactic,
  getCinemawareStatRating,
  PendingBattleContext,
  Season,
} from '../core/types';
import { PALETTE, PALETTE_HEX, SIDEQUEST_PALETTE } from '../data/palette';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';

export interface BattleSceneData {
  battleContext?: PendingBattleContext;
  resumeAiQueue?: AiTurnQueueState;
}

type UnitTheme = 'saxon' | 'norman' | 'rival_saxon';

const FONT_HEADING = 'Cinzel, Georgia, serif';
const FONT_BODY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
const TEXT_RES = 2;

const NORMAL_TICK_MS = 740;
const FAST_TICK_MS = 370;

export class BattleScene extends Phaser.Scene {
  private session!: BattleSession;
  private resumeAiQueue?: AiTurnQueueState;

  private attackerTheme: UnitTheme = 'saxon';
  private defenderTheme: UnitTheme = 'norman';

  private isPaused = false;
  private isFastSpeed = false;
  private hoveredControlTip: string | null = null;
  private tickAccumulatorMs = 0;
  private displayedFrontlineX = 640;
  private bobTimer = 0;

  // Arena Visual Containers (y: 0..490)
  private frontlineGraphics!: Phaser.GameObjects.Graphics;
  private regimentsContainer!: Phaser.GameObjects.Container;
  private sidequestBannerGraphics?: Phaser.GameObjects.Graphics;
  private sidequestAtmosphereGraphics?: Phaser.GameObjects.Graphics;
  private battleMistClouds: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    speed: number;
    alpha: number;
  }> = [];
  private battleWeatherParticles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
  }> = [];
  private fxContainer!: Phaser.GameObjects.Container;
  private topMomentumGraphics!: Phaser.GameObjects.Graphics;
  private topMatchupText!: Phaser.GameObjects.Text;
  private topSubBannerText!: Phaser.GameObjects.Text;

  // Visual Sprite Pools
  private attackerSoldierSprites: Phaser.GameObjects.Image[] = [];
  private defenderSoldierSprites: Phaser.GameObjects.Image[] = [];
  private attackerKnightSprites: Phaser.GameObjects.Image[] = [];
  private defenderKnightSprites: Phaser.GameObjects.Image[] = [];
  private attackerCatapultSprites: Phaser.GameObjects.Image[] = [];
  private defenderCatapultSprites: Phaser.GameObjects.Image[] = [];
  private attackerArcherSprites: Phaser.GameObjects.Image[] = [];
  private defenderArcherSprites: Phaser.GameObjects.Image[] = [];
  private attackerBannerSprite?: Phaser.GameObjects.Image;
  private defenderBannerSprite?: Phaser.GameObjects.Image;

  private soldierUnitsPerSpriteAtt = 1;
  private soldierUnitsPerSpriteDef = 1;
  private knightUnitsPerSpriteAtt = 1;
  private knightUnitsPerSpriteDef = 1;
  private archerUnitsPerSpriteAtt = 1;
  private archerUnitsPerSpriteDef = 1;

  // Bottom Tactical Command Deck Containers (y: 490..720)
  private leftCardContainer!: Phaser.GameObjects.Container;
  private rightCardContainer!: Phaser.GameObjects.Container;
  private centerControlsContainer!: Phaser.GameObjects.Container;
  private tickerText!: Phaser.GameObjects.Text;
  private summaryModalContainer!: Phaser.GameObjects.Container;

  // Live Counter Text References for Tweening / Flash Feedback
  private attCountTexts?: {
    soldiers: Phaser.GameObjects.Text;
    knights: Phaser.GameObjects.Text;
    catapults: Phaser.GameObjects.Text;
    archers?: Phaser.GameObjects.Text;
    tacticBadge: Phaser.GameObjects.Text;
  };
  private defCountTexts?: {
    soldiers: Phaser.GameObjects.Text;
    knights: Phaser.GameObjects.Text;
    catapults: Phaser.GameObjects.Text;
    archers?: Phaser.GameObjects.Text;
    tacticBadge: Phaser.GameObjects.Text;
  };

  constructor() {
    super({ key: 'BattleScene' });
  }

  create(data?: BattleSceneData): void {
    PixelArtGenerator.generateAll(this);
    SidequestArtGenerator.generateAll(this);

    const gameState = GameState.getInstance();
    const state = gameState.getState();
    this.resumeAiQueue = data?.resumeAiQueue;

    // Resolve battleContext (with safe dev fallback if launched standalone)
    const fallbackEnemyId =
      Object.values(state.territories).find(
        (t) => t.ownerId && t.ownerId !== state.selectedLordId && !t.isSherwood
      )?.id ?? 'derbyshire';

    const ctx: PendingBattleContext = data?.battleContext ?? {
      attackerId: state.selectedLordId,
      defenderId: state.territories[fallbackEnemyId]?.ownerId ?? null,
      territoryId: fallbackEnemyId,
      originTerritoryId: gameState.getPlayerLord().currentTerritoryId,
      hasCastle: Boolean(state.territories[fallbackEnemyId]?.hasCastle),
      mode: 'PLAYER_ATTACK',
    };

    this.session = BattleEngine.createBattleSession(state, ctx);
    this.attackerTheme = this.resolveArmyTheme(
      this.session.attackerId,
      this.session.attackerFaction,
      this.session.playerSide === 'attacker'
    );
    this.defenderTheme = this.resolveArmyTheme(
      this.session.defenderId,
      this.session.defenderFaction,
      this.session.playerSide === 'defender'
    );

    this.isPaused = false;
    this.isFastSpeed = false;
    this.hoveredControlTip = null;
    this.tickAccumulatorMs = -350; // Brief dramatic pause on scene fade-in before Round 1 clash
    this.displayedFrontlineX = this.computeTargetFrontlineX();
    this.bobTimer = 0;

    // 1. Top Battlefield Arena (x: 0..1280, y: 0..490)
    this.createTopBattlefieldArena();
    this.spawnInitialRegiments();

    // 2. Bottom Tactical Command Deck (x: 0..1280, y: 490..720)
    this.createBottomCommandDeck();

    // 3. Keyboard Shortcuts (1-5 Tactics, Space Pause/Continue)
    this.setupKeyboardShortcuts();

    // 4. Initial Render & Immediate Unopposed Check
    this.refreshTopMomentumHud();
    this.refreshCommanderCards();
    this.refreshCenterControls();
    this.refreshBattleTicker();

    if (this.session.status !== 'ONGOING') {
      this.finalizeAndShowSummaryModal();
    }

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    this.bobTimer += delta * 0.005;

    // Smoothly interpolate frontline position
    const targetX = this.computeTargetFrontlineX();
    this.displayedFrontlineX = Phaser.Math.Linear(
      this.displayedFrontlineX,
      targetX,
      Math.min(1, delta * 0.008)
    );
    this.drawFrontlineMarker();
    this.updateIdleFormationPositions();
    if (GameState.getInstance().isSidequestEdition()) {
      this.updateSidequestBattleAtmosphere(delta);
    }

    if (this.session.status !== 'ONGOING' || this.isPaused) {
      return;
    }

    const intervalMs = this.isFastSpeed ? FAST_TICK_MS : NORMAL_TICK_MS;
    this.tickAccumulatorMs += delta;

    if (this.tickAccumulatorMs >= intervalMs) {
      this.tickAccumulatorMs -= intervalMs;
      this.executeRealtimeBattleTick();
    }
  }

  private resolveArmyTheme(
    lordId: string | null,
    faction: 'saxon' | 'norman',
    isPlayerSide: boolean
  ): UnitTheme {
    if (isPlayerSide) return 'saxon';
    if (!lordId || faction === 'norman') return 'norman';
    return 'rival_saxon';
  }

  private getThemeHex(theme: UnitTheme): string {
    if (theme === 'saxon') return '#4A89FF';
    if (theme === 'rival_saxon') return PALETTE_HEX.FOLIAGE_LIGHT;
    return '#FF5C5C';
  }

  private getThemeColor(theme: UnitTheme): number {
    if (theme === 'saxon') return PALETTE.ROYAL_BLUE;
    if (theme === 'rival_saxon') return PALETTE.FOLIAGE_MID;
    return PALETTE.BLOOD_RED;
  }

  private computeTargetFrontlineX(): number {
    return Phaser.Math.Clamp(640 + (this.session.momentum / 100) * 230, 380, 900);
  }

  private createTopBattlefieldArena(): void {
    const gs = GameState.getInstance();
    const isSidequest = gs.isSidequestEdition();
    const season: Season = gs.getSeason();
    const bgKey = SidequestArtGenerator.getBattleBackdropKey(
      this,
      this.session.isCastleAssault,
      season,
      isSidequest
    );
    this.add.image(0, 0, bgKey).setOrigin(0, 0);

    // Render post-siege Wall Breach / Fire / Plague state on the distant right-hand Castle!
    if (this.session.isCastleAssault) {
      const siegeOverlay = this.add.graphics();
      if (this.session.wallBreached) {
        siegeOverlay.fillStyle(0x16110e, 0.95);
        siegeOverlay.fillRect(1088, 134, 52, 68);
        siegeOverlay.fillStyle(PALETTE.STONE_DARK, 1);
        siegeOverlay.fillEllipse(1114, 202, 68, 20);
        siegeOverlay.fillStyle(PALETTE.STONE_LIGHT, 0.85);
        siegeOverlay.fillRect(1094, 194, 12, 7);
        siegeOverlay.fillRect(1112, 192, 14, 8);
        siegeOverlay.fillRect(1128, 196, 10, 6);
      }
      if (this.session.isOnFire) {
        siegeOverlay.fillStyle(PALETTE.GOLD_DARK, 0.32);
        siegeOverlay.fillCircle(1140, 118, 42);
        siegeOverlay.fillStyle(PALETTE.BLOOD_RED, 0.78);
        siegeOverlay.fillTriangle(1118, 136, 1152, 136, 1134, 96);
        siegeOverlay.fillStyle(PALETTE.GOLD_BRIGHT, 0.85);
        siegeOverlay.fillTriangle(1124, 136, 1146, 136, 1135, 108);
      }
      if (this.session.isPlagueInfected) {
        siegeOverlay.fillStyle(0x7ccf35, 0.28);
        siegeOverlay.fillCircle(1152, 114, 48);
      }
    }

    this.frontlineGraphics = this.add.graphics();
    this.regimentsContainer = this.add.container(0, 0);
    if (isSidequest) {
      this.sidequestBannerGraphics = this.add.graphics();
      this.sidequestAtmosphereGraphics = this.add.graphics();
      const maskShape = this.make.graphics({ x: 0, y: 0 });
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillRect(6, 6, 1268, 478);
      this.sidequestAtmosphereGraphics.setMask(maskShape.createGeometryMask());
      this.initSidequestBattleAtmosphere(season);
    }
    this.fxContainer = this.add.container(0, 0);

    // Ornate Arena Frame Bezel (0..1280 x 0..490)
    const arenaFrame = this.add.graphics();
    arenaFrame.lineStyle(5, PALETTE.WOOD_DARK, 1);
    arenaFrame.strokeRect(2.5, 2.5, 1275, 485);
    arenaFrame.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    arenaFrame.strokeRect(6, 6, 1268, 478);

    // Top Center Momentum & Matchup Banner (x: 150..1130, y: 10..80)
    const bannerBg = this.add.graphics();
    bannerBg.fillStyle(0x16110e, 0.9);
    bannerBg.fillRoundedRect(150, 10, 980, 70, 6);
    bannerBg.lineStyle(2, PALETTE.GOLD_DARK, 0.95);
    bannerBg.strokeRoundedRect(150, 10, 980, 70, 6);

    this.topMatchupText = this.add
      .text(640, 25, '', {
        fontFamily: FONT_HEADING,
        fontSize: '15.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 1,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    this.topSubBannerText = this.add
      .text(640, 44, '', {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    this.topMomentumGraphics = this.add.graphics();
  }

  private spawnInitialRegiments(): void {
    this.regimentsContainer.removeAll(true);
    this.attackerSoldierSprites = [];
    this.defenderSoldierSprites = [];
    this.attackerKnightSprites = [];
    this.defenderKnightSprites = [];
    this.attackerCatapultSprites = [];
    this.defenderCatapultSprites = [];
    this.attackerArcherSprites = [];
    this.defenderArcherSprites = [];

    // 1. Rear-Guard Catapults (up to 3 visual engines per side)
    const attCatVis = Math.min(3, this.session.initialAttackerArmy.catapults);
    for (let i = 0; i < attCatVis; i++) {
      const cy = 268 + i * 54;
      const spr = this.add
        .image(88, cy, `unit_catapult_${this.attackerTheme}_0`)
        .setScale(1.6);
      this.regimentsContainer.add(spr);
      this.attackerCatapultSprites.push(spr);
    }

    const defCatVis = Math.min(3, this.session.initialDefenderTotal.catapults);
    for (let i = 0; i < defCatVis; i++) {
      const cy = 268 + i * 54;
      const spr = this.add
        .image(1192, cy, `unit_catapult_${this.defenderTheme}_0`)
        .setScale(1.6)
        .setFlipX(true);
      this.regimentsContainer.add(spr);
      this.defenderCatapultSprites.push(spr);
    }

    // 2. Faction War-Standards
    this.attackerBannerSprite = this.add
      .image(440, 315, `unit_banner_${this.attackerTheme}`)
      .setScale(1.65);
    this.defenderBannerSprite = this.add
      .image(840, 315, `unit_banner_${this.defenderTheme}`)
      .setScale(1.65)
      .setFlipX(true);
    this.regimentsContainer.add([this.attackerBannerSprite, this.defenderBannerSprite]);

    // 3. Men-at-Arms Infantry Regiments (up to 16 crisp sprites per side in 4x4 phalanx)
    const maxSoldierSprites = 16;
    this.soldierUnitsPerSpriteAtt = Math.max(
      1,
      Math.ceil(Math.max(1, this.session.initialAttackerArmy.soldiers) / maxSoldierSprites)
    );
    this.soldierUnitsPerSpriteDef = Math.max(
      1,
      Math.ceil(Math.max(1, this.session.initialDefenderTotal.soldiers) / maxSoldierSprites)
    );

    const attSoldierVis = Math.min(
      maxSoldierSprites,
      Math.ceil(this.session.initialAttackerArmy.soldiers / this.soldierUnitsPerSpriteAtt)
    );
    for (let i = 0; i < attSoldierVis; i++) {
      const spr = this.add
        .image(500, 300, `unit_soldier_${this.attackerTheme}_0`)
        .setScale(1.55);
      spr.setData('slotIndex', i);
      spr.setData('alive', true);
      spr.setData('lungeOffset', 0);
      this.regimentsContainer.add(spr);
      this.attackerSoldierSprites.push(spr);
    }

    const defSoldierVis = Math.min(
      maxSoldierSprites,
      Math.ceil(this.session.initialDefenderTotal.soldiers / this.soldierUnitsPerSpriteDef)
    );
    for (let i = 0; i < defSoldierVis; i++) {
      const spr = this.add
        .image(780, 300, `unit_soldier_${this.defenderTheme}_0`)
        .setScale(1.55)
        .setFlipX(true);
      spr.setData('slotIndex', i);
      spr.setData('alive', true);
      spr.setData('lungeOffset', 0);
      this.regimentsContainer.add(spr);
      this.defenderSoldierSprites.push(spr);
    }

    // 4. Mounted Knights on Upper & Lower Flanks (up to 8 sprites per side)
    const maxKnightSprites = 8;
    this.knightUnitsPerSpriteAtt = Math.max(
      1,
      Math.ceil(Math.max(1, this.session.initialAttackerArmy.knights) / maxKnightSprites)
    );
    this.knightUnitsPerSpriteDef = Math.max(
      1,
      Math.ceil(Math.max(1, this.session.initialDefenderTotal.knights) / maxKnightSprites)
    );

    const attKnightVis = Math.min(
      maxKnightSprites,
      Math.ceil(this.session.initialAttackerArmy.knights / this.knightUnitsPerSpriteAtt)
    );
    for (let i = 0; i < attKnightVis; i++) {
      const spr = this.add
        .image(420, 240, `unit_knight_${this.attackerTheme}_0`)
        .setScale(1.5);
      spr.setData('slotIndex', i);
      spr.setData('alive', true);
      spr.setData('flankAnimating', false);
      this.regimentsContainer.add(spr);
      this.attackerKnightSprites.push(spr);
    }

    const defKnightVis = Math.min(
      maxKnightSprites,
      Math.ceil(this.session.initialDefenderTotal.knights / this.knightUnitsPerSpriteDef)
    );
    for (let i = 0; i < defKnightVis; i++) {
      const spr = this.add
        .image(860, 240, `unit_knight_${this.defenderTheme}_0`)
        .setScale(1.5)
        .setFlipX(true);
      spr.setData('slotIndex', i);
      spr.setData('alive', true);
      spr.setData('flankAnimating', false);
      this.regimentsContainer.add(spr);
      this.defenderKnightSprites.push(spr);
    }

    // 5. Longbowmen (Archers) Support Formation behind Infantry (Sidequest Labs)
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const maxArcherSprites = 6;
    const attArchers = isSidequest ? (this.session.initialAttackerArmy.archers ?? 0) : 0;
    const defArchers = isSidequest ? (this.session.initialDefenderTotal.archers ?? 0) : 0;

    this.archerUnitsPerSpriteAtt = Math.max(
      1,
      Math.ceil(Math.max(1, attArchers) / maxArcherSprites)
    );
    this.archerUnitsPerSpriteDef = Math.max(
      1,
      Math.ceil(Math.max(1, defArchers) / maxArcherSprites)
    );

    const attArcherVis = Math.min(
      maxArcherSprites,
      Math.ceil(attArchers / this.archerUnitsPerSpriteAtt)
    );
    for (let i = 0; i < attArcherVis; i++) {
      const spr = this.add
        .image(360, 310, 'sq_unit_archer_0')
        .setScale(1.55);
      spr.setData('slotIndex', i);
      spr.setData('alive', true);
      this.regimentsContainer.add(spr);
      this.attackerArcherSprites.push(spr);
    }

    const defArcherVis = Math.min(
      maxArcherSprites,
      Math.ceil(defArchers / this.archerUnitsPerSpriteDef)
    );
    for (let i = 0; i < defArcherVis; i++) {
      const spr = this.add
        .image(920, 310, 'sq_unit_archer_0')
        .setScale(1.55)
        .setFlipX(true);
      spr.setData('slotIndex', i);
      spr.setData('alive', true);
      this.regimentsContainer.add(spr);
      this.defenderArcherSprites.push(spr);
    }

    this.updateIdleFormationPositions();
  }

  private updateIdleFormationPositions(): void {
    const flX = this.displayedFrontlineX;
    const marchBob = Math.sin(this.bobTimer) * 1.8;

    // Position Attacker Longbowmen (Behind Infantry)
    for (const spr of this.attackerArcherSprites) {
      if (!spr.getData('alive')) continue;
      const idx = spr.getData('slotIndex') as number;
      const rank = Math.floor(idx / 3);
      const row = idx % 3;
      const baseX = flX - 165 - rank * 32;
      const baseY = 296 + row * 34 + Math.sin(this.bobTimer + idx * 0.9) * 1.4;
      spr.setPosition(baseX, baseY);
      spr.setDepth(96 + Math.round(baseY));
    }

    // Position Defender Longbowmen (Behind Infantry)
    for (const spr of this.defenderArcherSprites) {
      if (!spr.getData('alive')) continue;
      const idx = spr.getData('slotIndex') as number;
      const rank = Math.floor(idx / 3);
      const row = idx % 3;
      const baseX = flX + 165 + rank * 32;
      const baseY = 296 + row * 34 + Math.sin(this.bobTimer + idx * 0.9 + 1.2) * 1.4;
      spr.setPosition(baseX, baseY);
      spr.setDepth(96 + Math.round(baseY));
    }

    // Position Attacker Infantry Block (Left of Frontline)
    for (const spr of this.attackerSoldierSprites) {
      if (!spr.getData('alive')) continue;
      const idx = spr.getData('slotIndex') as number;
      const rank = Math.floor(idx / 4); // 0 = front rank .. 3 = rear rank
      const row = idx % 4;
      const lunge = (spr.getData('lungeOffset') as number) || 0;
      const baseX = flX - 32 - rank * 36 + (row % 2) * 6 + lunge;
      const baseY = 294 + row * 28 + Math.sin(this.bobTimer + idx * 0.7) * 1.4;
      spr.setPosition(baseX, baseY);
      spr.setDepth(100 + Math.round(baseY));
    }

    // Position Defender Infantry Block (Right of Frontline)
    for (const spr of this.defenderSoldierSprites) {
      if (!spr.getData('alive')) continue;
      const idx = spr.getData('slotIndex') as number;
      const rank = Math.floor(idx / 4);
      const row = idx % 4;
      const lunge = (spr.getData('lungeOffset') as number) || 0;
      const baseX = flX + 32 + rank * 36 - (row % 2) * 6 - lunge;
      const baseY = 294 + row * 28 + Math.sin(this.bobTimer + idx * 0.7 + 1.2) * 1.4;
      spr.setPosition(baseX, baseY);
      spr.setDepth(100 + Math.round(baseY));
    }

    // Banners behind infantry blocks
    const isSidequest = GameState.getInstance().isSidequestEdition();
    if (this.attackerBannerSprite) {
      const aliveAtt = this.session.attackerArmy.soldiers + this.session.attackerArmy.knights > 0;
      this.attackerBannerSprite.setVisible(aliveAtt);
      this.attackerBannerSprite.setPosition(flX - 182, 326 + marchBob);
      if (isSidequest) {
        this.attackerBannerSprite.setRotation(Math.sin(this.bobTimer * 1.8) * 0.08);
      }
      this.attackerBannerSprite.setDepth(95);
    }
    if (this.defenderBannerSprite) {
      const aliveDef = this.session.defenderArmy.soldiers + this.session.defenderArmy.knights > 0;
      this.defenderBannerSprite.setVisible(aliveDef);
      this.defenderBannerSprite.setPosition(flX + 182, 326 - marchBob);
      if (isSidequest) {
        this.defenderBannerSprite.setRotation(-Math.sin(this.bobTimer * 1.8 + 0.9) * 0.08);
      }
      this.defenderBannerSprite.setDepth(95);
    }

    // Richer fluttering banner streamers in Sidequest Labs Edition
    if (isSidequest && this.sidequestBannerGraphics) {
      this.sidequestBannerGraphics.clear();
      const drawStreamer = (
        bx: number,
        by: number,
        dir: number,
        color: number,
        phase: number
      ) => {
        const wave1 = Math.sin(this.bobTimer * 3.2 + phase) * 5;
        const wave2 = Math.cos(this.bobTimer * 3.8 + phase) * 7;
        this.sidequestBannerGraphics!.fillStyle(color, 0.92);
        this.sidequestBannerGraphics!.beginPath();
        this.sidequestBannerGraphics!.moveTo(bx, by - 24);
        this.sidequestBannerGraphics!.lineTo(bx + dir * 22, by - 22 + wave1);
        this.sidequestBannerGraphics!.lineTo(bx + dir * 36, by - 17 + wave2);
        this.sidequestBannerGraphics!.lineTo(bx + dir * 20, by - 13 + wave1);
        this.sidequestBannerGraphics!.lineTo(bx, by - 14);
        this.sidequestBannerGraphics!.closePath();
        this.sidequestBannerGraphics!.fillPath();
      };

      if (this.attackerBannerSprite?.visible) {
        drawStreamer(
          this.attackerBannerSprite.x,
          this.attackerBannerSprite.y,
          -1,
          SIDEQUEST_PALETTE.AZURE_HIGHLIGHT,
          0
        );
      }
      if (this.defenderBannerSprite?.visible) {
        drawStreamer(
          this.defenderBannerSprite.x,
          this.defenderBannerSprite.y,
          1,
          this.defenderTheme === 'rival_saxon'
            ? SIDEQUEST_PALETTE.EMERALD_HIGHLIGHT
            : SIDEQUEST_PALETTE.CRIMSON_HIGHLIGHT,
          1.4
        );
      }
    }

    // Position Attacker Mounted Knights on Upper & Lower Flanks (unless mid-charge tween)
    for (const spr of this.attackerKnightSprites) {
      if (!spr.getData('alive') || spr.getData('flankAnimating')) continue;
      const idx = spr.getData('slotIndex') as number;
      const isUpper = idx % 2 === 0;
      const col = Math.floor(idx / 2);
      const kx = flX - 74 - col * 46;
      const ky = (isUpper ? 244 : 430) + (col % 2) * 10 + Math.sin(this.bobTimer * 1.4 + idx) * 2;
      spr.setPosition(kx, ky);
      spr.setDepth(100 + Math.round(ky));
    }

    // Position Defender Mounted Knights on Upper & Lower Flanks
    for (const spr of this.defenderKnightSprites) {
      if (!spr.getData('alive') || spr.getData('flankAnimating')) continue;
      const idx = spr.getData('slotIndex') as number;
      const isUpper = idx % 2 === 0;
      const col = Math.floor(idx / 2);
      const kx = flX + 74 + col * 46;
      const ky = (isUpper ? 244 : 430) + (col % 2) * 10 + Math.cos(this.bobTimer * 1.4 + idx) * 2;
      spr.setPosition(kx, ky);
      spr.setDepth(100 + Math.round(ky));
    }
  }

  private drawFrontlineMarker(): void {
    this.frontlineGraphics.clear();
    const x = this.displayedFrontlineX;

    // Subtle golden battle-line marker across the melee turf
    this.frontlineGraphics.lineStyle(3, PALETTE.GOLD_BRIGHT, 0.25);
    this.frontlineGraphics.lineBetween(x, 222, x, 468);
    this.frontlineGraphics.lineStyle(1.5, PALETTE.PARCHMENT_LIGHT, 0.45);
    this.frontlineGraphics.lineBetween(x, 232, x, 458);
  }

  private refreshTopMomentumHud(): void {
    const attShort = this.session.attackerName.split(' ')[0].toUpperCase();
    const defShort = this.session.defenderName.split(' ')[0].toUpperCase();
    const attTac = TACTIC_PROFILES[this.session.attackerTactic].shortLabel;
    const defTac = TACTIC_PROFILES[this.session.defenderTactic].shortLabel;

    this.topMatchupText.setText(
      `${attShort} (${attTac})   ⚔   ${defShort} (${defTac})`
    );

    let siegeNotice = '  •  OPEN FIELD BATTLE';
    if (this.session.isCastleAssault) {
      if (this.session.wallBreached) {
        siegeNotice = '  •  💥 CASTLE BREACHED (0% ARMOR • +20 ATT MOMENTUM)';
      } else {
        const armorPct = Math.round((this.session.castleDefenseMult - 1) * 100);
        siegeNotice = `  •  🏰 CASTLE ASSAULT (+${armorPct}% DEFENDER ARMOR • WALL ${this.session.wallIntegrity}%)`;
      }
    }
    if (this.session.isPlagueInfected) {
      siegeNotice += '  •  ☠ PLAGUE (-2 LDR)';
    }
    this.topSubBannerText.setText(
      `${this.session.territoryName.toUpperCase()}${siegeNotice}  •  ROUND ${this.session.tick}`
    );
    this.topSubBannerText.setColor(
      this.session.isCastleAssault ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.PARCHMENT_LIGHT
    );

    // Draw Tug-of-War Momentum Bar (x: 240..1040, y: 56..68, w: 800, h: 12)
    const g = this.topMomentumGraphics;
    g.clear();

    const barX = 250;
    const barY = 56;
    const barW = 780;
    const barH = 12;
    const splitRatio = Phaser.Math.Clamp((this.session.momentum + 100) / 200, 0.04, 0.96);
    const splitW = Math.round(barW * splitRatio);

    g.fillStyle(PALETTE.BLACK, 0.9);
    g.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);

    // Attacker Left Fill
    g.fillStyle(this.getThemeColor(this.attackerTheme), 1);
    g.fillRect(barX, barY, splitW, barH);

    // Defender Right Fill
    g.fillStyle(this.getThemeColor(this.defenderTheme), 1);
    g.fillRect(barX + splitW, barY, barW - splitW, barH);

    // Center 0-Momentum Reference Tick
    g.lineStyle(1.5, PALETTE.PARCHMENT_LIGHT, 0.55);
    g.lineBetween(barX + barW / 2, barY - 2, barX + barW / 2, barY + barH + 2);

    // Sliding Gold Clash Marker
    const markerX = barX + splitW;
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillTriangle(
      markerX,
      barY - 4,
      markerX - 6,
      barY + barH + 4,
      markerX + 6,
      barY + barH + 4
    );

    g.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    g.strokeRoundedRect(barX - 1, barY - 1, barW + 2, barH + 2, 3);
  }

  private executeRealtimeBattleTick(): void {
    const report = BattleEngine.stepTick(this.session);

    // 1. Animate Melee Lunge & Sparks
    this.playTickClashVisuals(report);

    // 2. Sync Regiments to Surviving Counts
    this.syncSpriteLosses();

    // 3. Refresh Live Tactical HUD & Battle Ticker
    this.refreshTopMomentumHud();
    this.updateLiveCommanderCounters(report);
    this.refreshCenterControls();
    this.refreshBattleTicker();

    // 4. Conclude Battle if Victory / Defeat Reached
    if (this.session.status !== 'ONGOING') {
      this.time.delayedCall(520, () => {
        if (this.scene && this.scene.isActive()) {
          this.finalizeAndShowSummaryModal();
        }
      });
    }
  }

  private playTickClashVisuals(report: BattleTickReport): void {
    const flX = this.displayedFrontlineX;

    // Front-rank Men-at-Arms sword thrust animation
    const lungeSide = (sprites: Phaser.GameObjects.Image[], theme: UnitTheme) => {
      for (const spr of sprites) {
        if (!spr.getData('alive')) continue;
        const idx = spr.getData('slotIndex') as number;
        if (idx < 8) {
          spr.setTexture(`unit_soldier_${theme}_1`);
          this.tweens.add({
            targets: { val: 0 },
            val: 11,
            duration: 130,
            yoyo: true,
            onUpdate: (_tw, target: { val: number }) => {
              if (spr.active) spr.setData('lungeOffset', target.val);
            },
            onComplete: () => {
              if (spr.active) {
                spr.setData('lungeOffset', 0);
                spr.setTexture(`unit_soldier_${theme}_0`);
              }
            },
          });
        }
      }
    };

    lungeSide(this.attackerSoldierSprites, this.attackerTheme);
    lungeSide(this.defenderSoldierSprites, this.defenderTheme);

    // Steel-on-steel Clash Sparks along Frontline
    for (let i = 0; i < 4; i++) {
      const sy = 290 + i * 32 + Phaser.Math.Between(-8, 8);
      const sx = flX + Phaser.Math.Between(-12, 12);
      this.spawnSparkBurst(sx, sy, 0xffffff);
    }

    // Dynamic Cavalry OUTFLANK Charge across Upper & Lower Flanks!
    if (this.session.attackerTactic === 'OUTFLANK' && this.session.attackerArmy.knights > 0) {
      this.animateCavalryFlankCharge(
        this.attackerKnightSprites,
        this.attackerTheme,
        'attacker',
        report.attackerFlankCountered
      );
    }
    if (this.session.defenderTactic === 'OUTFLANK' && this.session.defenderArmy.knights > 0) {
      this.animateCavalryFlankCharge(
        this.defenderKnightSprites,
        this.defenderTheme,
        'defender',
        report.defenderFlankCountered
      );
    }

    // Arcing Stone Projectiles for Catapult Bombardments
    if (report.attackerCatapultFired) {
      this.animateCatapultVolley(
        this.attackerCatapultSprites,
        this.attackerTheme,
        96,
        flX + 68
      );
    }
    if (report.defenderCatapultFired) {
      this.animateCatapultVolley(
        this.defenderCatapultSprites,
        this.defenderTheme,
        1184,
        flX - 68
      );
    }

    // Longbowmen Ranged Arrow Volleys (Sidequest Labs)
    if (report.attackerArcherVolleyFired) {
      this.animateArcherVolley(
        this.attackerArcherSprites,
        'attacker',
        flX - 165,
        flX + 68
      );
    }
    if (report.defenderArcherVolleyFired) {
      this.animateArcherVolley(
        this.defenderArcherSprites,
        'defender',
        flX + 165,
        flX - 68
      );
    }

    // Floating Casualty Badges over Hit Formations
    this.spawnCasualtyPopups(report.attackerLosses, flX - 75, '#FF6B6B');
    this.spawnCasualtyPopups(report.defenderLosses, flX + 75, PALETTE_HEX.GOLD_BRIGHT);
  }

  private animateArcherVolley(
    archerSprites: Phaser.GameObjects.Image[],
    side: BattleSide,
    originX: number,
    targetX: number
  ): void {
    for (const spr of archerSprites) {
      if (!spr.active || !spr.getData('alive')) continue;
      spr.setTexture('sq_unit_archer_1');
      this.time.delayedCall(this.isFastSpeed ? 160 : 300, () => {
        if (spr.active) {
          spr.setTexture('sq_unit_archer_0');
        }
      });
    }

    const count = Math.min(5, Math.max(2, archerSprites.length));
    for (let i = 0; i < count; i++) {
      const startX = originX + Phaser.Math.Between(-12, 12);
      const startY = 294 + i * 22 + Phaser.Math.Between(-6, 6);
      const endX = targetX + Phaser.Math.Between(-28, 28);
      const endY = 300 + i * 22 + Phaser.Math.Between(-10, 10);
      const arrow = this.add.image(startX, startY, 'sq_arrow').setScale(1.4);
      if (side === 'defender') {
        arrow.setFlipX(true);
      }
      this.fxContainer.add(arrow);

      const flightDuration = (this.isFastSpeed ? 200 : 380) + i * 30;
      const arcHeight = 70 + i * 12;

      this.tweens.add({
        targets: { t: 0 },
        t: 1,
        duration: flightDuration,
        ease: 'Linear',
        onUpdate: (_tw, obj: { t: number }) => {
          if (!arrow.active) return;
          const p = obj.t;
          const ax = Phaser.Math.Linear(startX, endX, p);
          const ay = Phaser.Math.Linear(startY, endY, p) - Math.sin(p * Math.PI) * arcHeight;
          arrow.setPosition(ax, ay);
          const dy = endY - startY - Math.cos(p * Math.PI) * Math.PI * arcHeight;
          const dx = endX - startX;
          arrow.setRotation(Math.atan2(dy, dx));
        },
        onComplete: () => {
          arrow.destroy();
          this.spawnSparkBurst(endX, endY, 0xffffff);
        },
      });
    }
  }

  private animateCavalryFlankCharge(
    knightSprites: Phaser.GameObjects.Image[],
    theme: UnitTheme,
    side: BattleSide,
    countered: boolean
  ): void {
    const dir = side === 'attacker' ? 1 : -1;
    const reachDist = countered ? 95 : 225;

    for (const spr of knightSprites) {
      if (!spr.getData('alive') || spr.getData('flankAnimating')) continue;
      spr.setData('flankAnimating', true);
      spr.setTexture(`unit_knight_${theme}_1`);

      const startX = spr.x;
      const startY = spr.y;
      const apexX = Phaser.Math.Clamp(startX + dir * reachDist, 110, 1170);

      this.tweens.add({
        targets: spr,
        x: apexX,
        y: startY + (startY < 320 ? -12 : 12),
        duration: this.isFastSpeed ? 160 : 280,
        ease: 'Quad.easeOut',
        yoyo: true,
        onYoyo: () => {
          this.spawnSparkBurst(
            apexX,
            spr.y,
            countered ? PALETTE.BLOOD_RED : PALETTE.GOLD_BRIGHT
          );
        },
        onComplete: () => {
          if (spr.active) {
            spr.setData('flankAnimating', false);
            spr.setTexture(`unit_knight_${theme}_0`);
          }
        },
      });
    }
  }

  private animateCatapultVolley(
    catapultSprites: Phaser.GameObjects.Image[],
    theme: UnitTheme,
    originX: number,
    targetX: number
  ): void {
    for (const spr of catapultSprites) {
      if (!spr.active) continue;
      spr.setTexture(`unit_catapult_${theme}_1`);
      this.time.delayedCall(this.isFastSpeed ? 180 : 340, () => {
        if (spr.active) {
          spr.setTexture(`unit_catapult_${theme}_0`);
        }
      });
    }

    const startY = 290;
    const endY = 332;
    const boulder = this.add.image(originX, startY, 'proj_boulder').setScale(1.6);
    this.fxContainer.add(boulder);

    this.tweens.add({
      targets: { t: 0 },
      t: 1,
      duration: this.isFastSpeed ? 240 : 440,
      ease: 'Linear',
      onUpdate: (_tw, obj: { t: number }) => {
        if (!boulder.active) return;
        const p = obj.t;
        const bx = Phaser.Math.Linear(originX, targetX, p);
        const by = Phaser.Math.Linear(startY, endY, p) - Math.sin(p * Math.PI) * 145;
        boulder.setPosition(bx, by);
        boulder.setRotation(p * Math.PI * 3);
      },
      onComplete: () => {
        boulder.destroy();
        this.spawnSparkBurst(targetX, endY, PALETTE.GOLD_DARK);
      },
    });
  }

  private spawnSparkBurst(x: number, y: number, tint: number): void {
    const spark = this.add
      .image(x, y, 'fx_clash_spark')
      .setScale(1.4)
      .setTint(tint);
    this.fxContainer.add(spark);

    this.tweens.add({
      targets: spark,
      scale: 2.3,
      alpha: 0,
      angle: 45,
      duration: 240,
      onComplete: () => spark.destroy(),
    });

    // Enhanced multi-spark metallic burst & dust puff in Sidequest Labs Edition
    if (GameState.getInstance().isSidequestEdition()) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 16 + Math.random() * 18;
        const mote = this.add.rectangle(
          x,
          y,
          3,
          3,
          i % 2 === 0 ? SIDEQUEST_PALETTE.GOLD_SPECULAR : tint
        );
        this.fxContainer.add(mote);
        this.tweens.add({
          targets: mote,
          x: x + Math.cos(ang) * dist,
          y: y + Math.sin(ang) * dist,
          alpha: 0,
          duration: 260,
          ease: 'Quad.easeOut',
          onComplete: () => mote.destroy(),
        });
      }
    }
  }

  private spawnCasualtyPopups(
    losses: { soldiers: number; knights: number; catapults: number; archers?: number },
    x: number,
    color: string
  ): void {
    const tags: Array<{ text: string; y: number }> = [];
    if (losses.soldiers > 0) {
      tags.push({ text: `-${losses.soldiers}`, y: 274 });
    }
    if (losses.archers && losses.archers > 0) {
      tags.push({ text: `-${losses.archers} ARCHER${losses.archers > 1 ? 'S' : ''}!`, y: 310 });
    }
    if (losses.knights > 0) {
      tags.push({ text: `-${losses.knights} KNIGHT${losses.knights > 1 ? 'S' : ''}!`, y: 236 });
    }
    if (losses.catapults > 0) {
      tags.push({ text: `-${losses.catapults} CATAPULT!`, y: 396 });
    }

    for (const item of tags) {
      const popup = this.add
        .text(x + Phaser.Math.Between(-14, 14), item.y, item.text, {
          fontFamily: FONT_BODY,
          fontSize: '15px',
          fontStyle: 'bold',
          color,
          stroke: '#0B0D14',
          strokeThickness: 3.5,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);
      this.fxContainer.add(popup);

      this.tweens.add({
        targets: popup,
        y: item.y - 34,
        alpha: 0,
        duration: 680,
        ease: 'Cubic.easeOut',
        onComplete: () => popup.destroy(),
      });
    }
  }

  private syncSpriteLosses(): void {
    const trimPool = (
      sprites: Phaser.GameObjects.Image[],
      survivingUnits: number,
      unitsPerSprite: number
    ) => {
      const desiredAlive =
        survivingUnits <= 0 ? 0 : Math.ceil(survivingUnits / unitsPerSprite);
      let aliveSeen = 0;
      for (const spr of sprites) {
        if (!spr.getData('alive')) continue;
        aliveSeen++;
        if (aliveSeen > desiredAlive) {
          spr.setData('alive', false);
          spr.setTint(PALETTE.BLOOD_RED);
          this.tweens.add({
            targets: spr,
            alpha: 0,
            angle: spr.flipX ? 65 : -65,
            y: spr.y + 10,
            duration: 300,
            onComplete: () => spr.setVisible(false),
          });
        }
      }
    };

    trimPool(
      this.attackerSoldierSprites,
      this.session.attackerArmy.soldiers,
      this.soldierUnitsPerSpriteAtt
    );
    trimPool(
      this.defenderSoldierSprites,
      this.session.defenderArmy.soldiers,
      this.soldierUnitsPerSpriteDef
    );
    trimPool(
      this.attackerKnightSprites,
      this.session.attackerArmy.knights,
      this.knightUnitsPerSpriteAtt
    );
    trimPool(
      this.defenderKnightSprites,
      this.session.defenderArmy.knights,
      this.knightUnitsPerSpriteDef
    );
    trimPool(this.attackerCatapultSprites, this.session.attackerArmy.catapults, 1);
    trimPool(this.defenderCatapultSprites, this.session.defenderArmy.catapults, 1);
    trimPool(
      this.attackerArcherSprites,
      this.session.attackerArmy.archers ?? 0,
      this.archerUnitsPerSpriteAtt
    );
    trimPool(
      this.defenderArcherSprites,
      this.session.defenderArmy.archers ?? 0,
      this.archerUnitsPerSpriteDef
    );
  }

  // ============================================================================
  // BOTTOM TACTICAL COMMAND DECK (x: 0..1280, y: 490..720)
  // ============================================================================

  private createBottomCommandDeck(): void {
    const deckBg = this.add.graphics();
    deckBg.fillStyle(0x1f212a, 1);
    deckBg.fillRect(0, 490, 1280, 230);

    // Subtle stone masonry lines
    deckBg.fillStyle(0x13151c, 0.55);
    for (let y = 516; y < 720; y += 28) {
      deckBg.fillRect(0, y, 1280, 1.5);
    }

    // Ornate Wood & Gold Bezel
    deckBg.lineStyle(5, PALETTE.WOOD_DARK, 1);
    deckBg.strokeRect(2.5, 492.5, 1275, 225);
    deckBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    deckBg.strokeRect(6, 496, 1268, 218);

    this.leftCardContainer = this.add.container(0, 0);
    this.rightCardContainer = this.add.container(0, 0);
    this.centerControlsContainer = this.add.container(0, 0);

    // Live Scrolling Battle Ticker Frame (x: 356..924, y: 646..708, w: 568, h: 62)
    const tickerBg = this.add.graphics();
    tickerBg.fillStyle(0x110e0c, 0.94);
    tickerBg.fillRoundedRect(356, 646, 568, 62, 5);
    tickerBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    tickerBg.strokeRoundedRect(356, 646, 568, 62, 5);

    this.tickerText = this.add.text(368, 653, '', {
      fontFamily: FONT_BODY,
      fontSize: '12px',
      fontStyle: '600',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      lineSpacing: 4,
      resolution: TEXT_RES,
    });

    this.summaryModalContainer = this.add.container(0, 0);
    this.summaryModalContainer.setDepth(5000);
    this.summaryModalContainer.setVisible(false);
  }

  private refreshCommanderCards(): void {
    this.attCountTexts = this.renderSingleCommanderCard(
      this.leftCardContainer,
      14,
      502,
      330,
      206,
      'attacker'
    );
    this.defCountTexts = this.renderSingleCommanderCard(
      this.rightCardContainer,
      936,
      502,
      330,
      206,
      'defender'
    );
  }

  private renderSingleCommanderCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    side: BattleSide
  ): {
    soldiers: Phaser.GameObjects.Text;
    knights: Phaser.GameObjects.Text;
    catapults: Phaser.GameObjects.Text;
    archers?: Phaser.GameObjects.Text;
    tacticBadge: Phaser.GameObjects.Text;
  } {
    container.removeAll(true);

    const isAttacker = side === 'attacker';
    const isPlayer = this.session.playerSide === side;
    const lordId = isAttacker ? this.session.attackerId : this.session.defenderId;
    const name = isAttacker ? this.session.attackerName : this.session.defenderName;
    const leadership = isAttacker
      ? this.session.attackerLeadership
      : this.session.defenderLeadership;
    const army = isAttacker ? this.session.attackerArmy : this.session.defenderArmy;
    const tactic = isAttacker ? this.session.attackerTactic : this.session.defenderTactic;
    const theme = isAttacker ? this.attackerTheme : this.defenderTheme;

    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.WOOD_DARK, 0.98);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(2, isPlayer ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK, 1);
    bg.strokeRoundedRect(x, y, w, h, 6);

    // Role Header Bar
    bg.fillStyle(this.getThemeColor(theme), 0.9);
    bg.fillRoundedRect(x + 6, y + 6, w - 12, 24, 4);

    // Live Unit Counter Inset
    bg.fillStyle(0x130e0b, 0.9);
    bg.fillRoundedRect(x + 8, y + 132, w - 16, 66, 4);
    bg.lineStyle(1, PALETTE.WOOD_MID, 0.85);
    bg.strokeRoundedRect(x + 8, y + 132, w - 16, 66, 4);
    container.add(bg);

    const roleLabel = isAttacker
      ? `⚔ ATTACKER${isPlayer ? '  •  YOUR HOST' : ''}`
      : `🛡 DEFENDER${isPlayer ? '  •  YOUR HOST' : ''}`;
    const roleTxt = this.add.text(x + 14, y + 10, roleLabel, {
      fontFamily: FONT_HEADING,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      resolution: TEXT_RES,
    });
    container.add(roleTxt);

    if (!isAttacker && this.session.isCastleAssault) {
      const armorPct = Math.round((this.session.castleDefenseMult - 1) * 100);
      const pillLabel = this.session.wallBreached
        ? 'BREACHED (0%)'
        : `+${armorPct}% CASTLE`;
      const castlePill = this.add
        .text(x + w - 12, y + 11, pillLabel, {
          fontFamily: FONT_BODY,
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: this.session.wallBreached ? '#FFD56B' : PALETTE_HEX.GOLD_BRIGHT,
          resolution: TEXT_RES,
        })
        .setOrigin(1, 0);
      container.add(castlePill);
    }

    // Crisp NEAREST Portrait & Heraldic Shield
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const portraitKey = SidequestArtGenerator.getPortraitKey(
      this,
      lordId ?? 'garrison',
      isSidequest
    );
    const shieldKey = SidequestArtGenerator.getShieldKey(
      this,
      lordId ?? 'garrison',
      isSidequest
    );

    const portrait = this.add
      .image(x + 42, y + 78, portraitKey)
      .setDisplaySize(60, 60);
    const shield = this.add
      .image(x + 94, y + 78, shieldKey)
      .setDisplaySize(34, 44);
    container.add([portrait, shield]);

    if (isSidequest) {
      SidequestArtGenerator.addGleamingFrame(
        this,
        container,
        x + 42,
        y + 78,
        60,
        60,
        SIDEQUEST_PALETTE.GOLD_GLEAM
      );
    }

    const shortName = name.length > 21 ? name.slice(0, 20) + '…' : name;
    const nameTxt = this.add.text(x + 118, y + 40, shortName.toUpperCase(), {
      fontFamily: FONT_HEADING,
      fontSize: '14px',
      fontStyle: 'bold',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      resolution: TEXT_RES,
    });

    const leadPct = Math.round(leadership * 5);
    const plagueNote =
      !isAttacker && this.session.isPlagueInfected ? ' [☠ Plague -2]' : '';
    const leadTxt = this.add.text(
      x + 118,
      y + 62,
      `Leadership: ${leadership}${plagueNote} (${getCinemawareStatRating(leadership)}, +${leadPct}%)`,
      {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: '600',
        color:
          !isAttacker && this.session.isPlagueInfected
            ? '#A6FF4D'
            : PALETTE_HEX.PARCHMENT_DARK,
        resolution: TEXT_RES,
      }
    );

    const tacticBadge = this.add.text(
      x + 118,
      y + 88,
      `▸ ${TACTIC_PROFILES[tactic].label}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        backgroundColor: '#261A12',
        padding: { x: 6, y: 3 },
        resolution: TEXT_RES,
      }
    );
    container.add([nameTxt, leadTxt, tacticBadge]);

    // Live Unit Columns (Soldiers, [Archers], Knights, Catapults)
    const hasArchers =
      isSidequest || (army.archers !== undefined && army.archers > 0);
    const cols: Array<{
      label: string;
      spriteKey: string;
      val: number;
      cx: number;
    }> = hasArchers
      ? [
          {
            label: 'SOLDIERS',
            spriteKey: `unit_soldier_${theme}_0`,
            val: army.soldiers,
            cx: x + 44,
          },
          {
            label: 'ARCHERS',
            spriteKey: 'sq_unit_archer_0',
            val: army.archers ?? 0,
            cx: x + 124,
          },
          {
            label: 'KNIGHTS',
            spriteKey: `unit_knight_${theme}_0`,
            val: army.knights,
            cx: x + 204,
          },
          {
            label: 'CATAPULTS',
            spriteKey: `unit_catapult_${theme}_0`,
            val: army.catapults,
            cx: x + 284,
          },
        ]
      : [
          {
            label: 'SOLDIERS',
            spriteKey: `unit_soldier_${theme}_0`,
            val: army.soldiers,
            cx: x + 60,
          },
          {
            label: 'KNIGHTS',
            spriteKey: `unit_knight_${theme}_0`,
            val: army.knights,
            cx: x + 165,
          },
          {
            label: 'CATAPULTS',
            spriteKey: `unit_catapult_${theme}_0`,
            val: army.catapults,
            cx: x + 270,
          },
        ];

    const refs: Record<string, Phaser.GameObjects.Text> = {};
    for (const c of cols) {
      const miniSpr = this.add
        .image(c.cx - 26, y + 158, c.spriteKey)
        .setScale(0.85);
      const countTxt = this.add
        .text(c.cx + 8, y + 142, `${c.val}`, {
          fontFamily: FONT_HEADING,
          fontSize: '20px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5, 0);
      const subLbl = this.add
        .text(c.cx, y + 174, c.label, {
          fontFamily: FONT_BODY,
          fontSize: '10px',
          fontStyle: 'bold',
          color: this.getThemeHex(theme),
          resolution: TEXT_RES,
        })
        .setOrigin(0.5, 0);

      container.add([miniSpr, countTxt, subLbl]);
      refs[c.label] = countTxt;
    }

    return {
      soldiers: refs['SOLDIERS'],
      knights: refs['KNIGHTS'],
      catapults: refs['CATAPULTS'],
      archers: refs['ARCHERS'],
      tacticBadge,
    };
  }

  private updateLiveCommanderCounters(report: BattleTickReport): void {
    const pulseText = (txt: Phaser.GameObjects.Text, newVal: number, lost: number) => {
      txt.setText(`${newVal}`);
      if (lost > 0) {
        txt.setColor('#FF6B6B');
        this.tweens.add({
          targets: txt,
          scale: 1.24,
          duration: 120,
          yoyo: true,
          onComplete: () => {
            if (txt.active) txt.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
          },
        });
      }
    };

    if (this.attCountTexts) {
      pulseText(
        this.attCountTexts.soldiers,
        this.session.attackerArmy.soldiers,
        report.attackerLosses.soldiers
      );
      if (this.attCountTexts.archers) {
        pulseText(
          this.attCountTexts.archers,
          this.session.attackerArmy.archers ?? 0,
          report.attackerLosses.archers ?? 0
        );
      }
      pulseText(
        this.attCountTexts.knights,
        this.session.attackerArmy.knights,
        report.attackerLosses.knights
      );
      pulseText(
        this.attCountTexts.catapults,
        this.session.attackerArmy.catapults,
        report.attackerLosses.catapults
      );
      this.attCountTexts.tacticBadge.setText(
        `▸ ${TACTIC_PROFILES[this.session.attackerTactic].label}`
      );
    }

    if (this.defCountTexts) {
      pulseText(
        this.defCountTexts.soldiers,
        this.session.defenderArmy.soldiers,
        report.defenderLosses.soldiers
      );
      if (this.defCountTexts.archers) {
        pulseText(
          this.defCountTexts.archers,
          this.session.defenderArmy.archers ?? 0,
          report.defenderLosses.archers ?? 0
        );
      }
      pulseText(
        this.defCountTexts.knights,
        this.session.defenderArmy.knights,
        report.defenderLosses.knights
      );
      pulseText(
        this.defCountTexts.catapults,
        this.session.defenderArmy.catapults,
        report.defenderLosses.catapults
      );
      this.defCountTexts.tacticBadge.setText(
        `▸ ${TACTIC_PROFILES[this.session.defenderTactic].label}`
      );
    }
  }

  private refreshCenterControls(): void {
    this.centerControlsContainer.removeAll(true);

    const playerSide: BattleSide = this.session.playerSide ?? 'attacker';
    const playerArmy =
      playerSide === 'attacker' ? this.session.attackerArmy : this.session.defenderArmy;
    const activePlayerTactic =
      playerSide === 'attacker' ? this.session.attackerTactic : this.session.defenderTactic;
    const isOngoing = this.session.status === 'ONGOING';

    const header = this.add
      .text(
        640,
        511,
        this.isPaused
          ? '⏸  BATTLE PAUSED — SELECT TACTICAL MANEUVER [KEYS 1–5]'
          : '⚔  TACTICAL MANEUVERS — COMMAND THY HOST [KEYS 1–5]',
        {
          fontFamily: FONT_HEADING,
          fontSize: '13px',
          fontStyle: 'bold',
          color: this.isPaused ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.PARCHMENT_LIGHT,
          letterSpacing: 1,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.centerControlsContainer.add(header);

    // 1. Row of 5 Classic Cinemaware Tactic Buttons (x: 356..924, y: 526..594)
    const btnW = 108;
    const btnH = 66;
    const gap = 7;
    const startX = 356;

    const subHints: Record<BattleTactic, string> = {
      FEROCIOUS_ATTACK: '+35% ATK\n+30% VULN',
      NORMAL_ATTACK: '1.0x ATK\n1.0x DEF',
      CAUTIOUS_ATTACK: '-25% ATK\n-25% LOSS',
      STAND_AND_FIGHT: '+35% DEF\nANTI-CHARGE',
      OUTFLANK:
        playerArmy.knights > 0 ? 'CAVALRY\nFLANK SHOCK' : 'NEEDS\nKNIGHTS > 0',
    };

    ALL_BATTLE_TACTICS.forEach((tactic, idx) => {
      const profile = TACTIC_PROFILES[tactic];
      const bx = startX + idx * (btnW + gap);
      const by = 526;
      const canUse = isOngoing && BattleEngine.canUseTactic(playerArmy, tactic);
      const isSelected = activePlayerTactic === tactic;

      const g = this.add.graphics();
      const drawBtn = (hover: boolean) => {
        g.clear();
        const fill = !canUse
          ? 0x262830
          : isSelected
          ? 0x6e4a12
          : hover
          ? PALETTE.BLOOD_RED
          : PALETTE.WOOD_DARK;
        const stroke = !canUse
          ? PALETTE.STONE_DARK
          : isSelected
          ? PALETTE.GOLD_BRIGHT
          : hover
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.GOLD_DARK;

        g.fillStyle(fill, 1);
        g.fillRoundedRect(bx, by, btnW, btnH, 5);
        g.lineStyle(isSelected ? 2.8 : 1.5, stroke, 1);
        g.strokeRoundedRect(bx, by, btnW, btnH, 5);

        if (isSelected) {
          g.fillStyle(PALETTE.GOLD_BRIGHT, 0.18);
          g.fillRoundedRect(bx + 2, by + 2, btnW - 4, 20, 3);
        }
      };

      drawBtn(false);
      this.centerControlsContainer.add(g);

      const titleTxt = this.add
        .text(
          bx + btnW / 2,
          by + 15,
          `[${profile.hotkey}] ${profile.shortLabel}`,
          {
            fontFamily: FONT_BODY,
            fontSize: profile.shortLabel.length > 10 ? '10px' : '11px',
            fontStyle: 'bold',
            color: !canUse
              ? PALETTE_HEX.STONE_MID
              : isSelected
              ? PALETTE_HEX.GOLD_BRIGHT
              : PALETTE_HEX.PARCHMENT_LIGHT,
            resolution: TEXT_RES,
          }
        )
        .setOrigin(0.5);

      const hintTxt = this.add
        .text(bx + btnW / 2, by + 44, subHints[tactic], {
          fontFamily: FONT_BODY,
          fontSize: '10px',
          fontStyle: '600',
          align: 'center',
          lineSpacing: 2,
          color: !canUse
            ? PALETTE_HEX.STONE_MID
            : isSelected
            ? '#FFF5D6'
            : PALETTE_HEX.PARCHMENT_DARK,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      this.centerControlsContainer.add([titleTxt, hintTxt]);

      const zone = this.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH);
      zone.setInteractive({ useHandCursor: canUse });
      zone.on('pointerover', () => {
        if (canUse) drawBtn(true);
        this.hoveredControlTip =
          tactic === 'OUTFLANK' && playerArmy.knights <= 0
            ? '⚠ OUTFLANK DISABLED: Requires at least 1 Mounted Knight in your army!'
            : `${profile.label}: ${profile.description}`;
        this.refreshBattleTicker();
      });
      zone.on('pointerout', () => {
        drawBtn(false);
        this.hoveredControlTip = null;
        this.refreshBattleTicker();
      });
      zone.on('pointerdown', () => {
        if (!isOngoing) return;
        const res = BattleEngine.setTactic(this.session, playerSide, tactic);
        if (!res.success) {
          this.hoveredControlTip = `⚠ ${res.message}`;
        }
        this.refreshTopMomentumHud();
        this.refreshCommanderCards();
        this.refreshCenterControls();
        this.refreshBattleTicker();
      });
      this.centerControlsContainer.add(zone);
    });

    // 2. Utility Controls Row (x: 356..924, y: 600..638)
    const retreatCheck = BattleEngine.canSideRetreat(this.session, playerSide);
    const utils: Array<{
      x: number;
      w: number;
      label: string;
      enabled: boolean;
      active: boolean;
      tip: string;
      onClick: () => void;
    }> = [
      {
        x: 356,
        w: 140,
        label: '🏳 RETREAT (-15%)',
        enabled: isOngoing && retreatCheck.success,
        active: false,
        tip: retreatCheck.message,
        onClick: () => {
          BattleEngine.retreatFromBattle(this.session, playerSide);
          this.syncSpriteLosses();
          this.refreshCommanderCards();
          this.refreshCenterControls();
          this.finalizeAndShowSummaryModal();
        },
      },
      {
        x: 504,
        w: 112,
        label: this.isPaused ? '▶ RESUME' : '⏸ PAUSE',
        enabled: isOngoing,
        active: this.isPaused,
        tip: 'Pause or resume real-time battlefield rounds [SPACE].',
        onClick: () => {
          this.isPaused = !this.isPaused;
          this.refreshCenterControls();
        },
      },
      {
        x: 624,
        w: 120,
        label: this.isFastSpeed ? '⏩ SPEED: 2X' : '▶ SPEED: 1X',
        enabled: isOngoing,
        active: this.isFastSpeed,
        tip: 'Toggle battle simulation speed between 1X and 2X.',
        onClick: () => {
          this.isFastSpeed = !this.isFastSpeed;
          this.refreshCenterControls();
        },
      },
      {
        x: 752,
        w: 172,
        label: '⚡ AUTO-RESOLVE',
        enabled: isOngoing,
        active: false,
        tip: 'Instantly simulate remaining tactical rounds to conclusion.',
        onClick: () => {
          BattleEngine.resolveToCompletion(this.session);
          this.syncSpriteLosses();
          this.refreshTopMomentumHud();
          this.refreshCommanderCards();
          this.refreshCenterControls();
          this.refreshBattleTicker();
          this.finalizeAndShowSummaryModal();
        },
      },
    ];

    for (const u of utils) {
      const ug = this.add.graphics();
      const drawUtil = (hover: boolean) => {
        ug.clear();
        const fill = !u.enabled
          ? 0x262830
          : u.active
          ? PALETTE.BLOOD_RED
          : hover
          ? PALETTE.WOOD_MID
          : 0x2d1d12;
        ug.fillStyle(fill, 1);
        ug.fillRoundedRect(u.x, 600, u.w, 36, 4);
        ug.lineStyle(
          1.5,
          !u.enabled
            ? PALETTE.STONE_DARK
            : u.active || hover
            ? PALETTE.GOLD_BRIGHT
            : PALETTE.GOLD_DARK,
          1
        );
        ug.strokeRoundedRect(u.x, 600, u.w, 36, 4);
      };
      drawUtil(false);
      this.centerControlsContainer.add(ug);

      const utxt = this.add
        .text(u.x + u.w / 2, 618, u.label, {
          fontFamily: FONT_BODY,
          fontSize: '11.5px',
          fontStyle: 'bold',
          color: u.enabled ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.STONE_MID,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);
      this.centerControlsContainer.add(utxt);

      const uzone = this.add.zone(u.x + u.w / 2, 618, u.w, 36);
      uzone.setInteractive({ useHandCursor: u.enabled });
      uzone.on('pointerover', () => {
        if (u.enabled) drawUtil(true);
        this.hoveredControlTip = u.tip;
        this.refreshBattleTicker();
      });
      uzone.on('pointerout', () => {
        drawUtil(false);
        this.hoveredControlTip = null;
        this.refreshBattleTicker();
      });
      uzone.on('pointerdown', () => {
        if (u.enabled) u.onClick();
      });
      this.centerControlsContainer.add(uzone);
    }
  }

  private refreshBattleTicker(): void {
    if (this.hoveredControlTip) {
      const recent = this.session.tickerLog.slice(-2).map((l) => `• ${l}`);
      this.tickerText.setText([`▸ ${this.hoveredControlTip}`, ...recent].join('\n'));
      return;
    }

    const lines = this.session.tickerLog.slice(-3).map((entry) => {
      const clipped = entry.length > 74 ? entry.slice(0, 73) + '…' : entry;
      return `• ${clipped}`;
    });
    this.tickerText.setText(lines.join('\n'));
  }

  private setupKeyboardShortcuts(): void {
    if (!this.input.keyboard) return;

    const selectIdx = (idx: number) => {
      if (this.session.status !== 'ONGOING') return;
      const playerSide: BattleSide = this.session.playerSide ?? 'attacker';
      const tactic = ALL_BATTLE_TACTICS[idx];
      if (!tactic) return;
      BattleEngine.setTactic(this.session, playerSide, tactic);
      this.refreshTopMomentumHud();
      this.refreshCommanderCards();
      this.refreshCenterControls();
      this.refreshBattleTicker();
    };

    this.input.keyboard.on('keydown-ONE', () => selectIdx(0));
    this.input.keyboard.on('keydown-TWO', () => selectIdx(1));
    this.input.keyboard.on('keydown-THREE', () => selectIdx(2));
    this.input.keyboard.on('keydown-FOUR', () => selectIdx(3));
    this.input.keyboard.on('keydown-FIVE', () => selectIdx(4));

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.session.status === 'ONGOING') {
        this.isPaused = !this.isPaused;
        this.refreshCenterControls();
      } else if (this.summaryModalContainer.visible) {
        this.returnToCampaignMap();
      }
    });
  }

  // ============================================================================
  // VICTORY / DEFEAT / RETREAT ROYAL PARCHMENT SUMMARY MODAL
  // ============================================================================

  private finalizeAndShowSummaryModal(): void {
    const result: BattleResult = BattleEngine.commitBattleOutcome(this.session);

    this.summaryModalContainer.removeAll(true);
    this.summaryModalContainer.setVisible(true);

    const playerSide: BattleSide = this.session.playerSide ?? 'attacker';
    const isRetreat = Boolean(result.retreated);
    const didPlayerWin =
      !isRetreat &&
      ((playerSide === 'attacker' && result.attackerWon) ||
        (playerSide === 'defender' && !result.attackerWon));

    const shade = this.add.graphics();
    shade.fillStyle(PALETTE.BLACK, 0.78);
    shade.fillRect(0, 0, 1280, 720);

    // Ornate Royal Modal Frame (x: 230..1050, y: 100..620, w: 820, h: 520)
    const mx = 230;
    const my = 100;
    const mw = 820;
    const mh = 520;

    shade.fillStyle(PALETTE.WOOD_DARK, 1);
    shade.fillRoundedRect(mx, my, mw, mh, 10);
    shade.lineStyle(4, PALETTE.GOLD_BRIGHT, 1);
    shade.strokeRoundedRect(mx, my, mw, mh, 10);

    shade.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    shade.fillRoundedRect(mx + 16, my + 16, mw - 32, mh - 32, 6);
    shade.lineStyle(1.5, PALETTE.WOOD_MID, 0.85);
    shade.strokeRoundedRect(mx + 22, my + 22, mw - 44, mh - 44, 4);

    // Dividers
    shade.lineBetween(mx + 44, my + 94, mx + mw - 44, my + 94);
    shade.lineBetween(mx + 44, my + 324, mx + mw - 44, my + 324);
    shade.lineBetween(640, my + 108, 640, my + 312);
    this.summaryModalContainer.add(shade);

    const headerTitle = isRetreat
      ? '🏳   TACTICAL RETREAT   🏳'
      : didPlayerWin
      ? '★   VICTORY ON THE FIELD!   ★'
      : '☠   DEFEAT ON THE FIELD   ☠';

    const headerColor = isRetreat
      ? PALETTE_HEX.WOOD_DARK
      : didPlayerWin
      ? PALETTE_HEX.ROYAL_BLUE
      : PALETTE_HEX.BLOOD_RED;

    const titleTxt = this.add
      .text(640, my + 56, headerTitle, {
        fontFamily: FONT_HEADING,
        fontSize: '28px',
        fontStyle: 'bold',
        color: headerColor,
        letterSpacing: 1.5,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.summaryModalContainer.add(titleTxt);

    // Side-by-Side Attacker vs Defender Casualty Ledger
    const renderArmyColumn = (
      cx: number,
      heading: string,
      lordName: string,
      init: { soldiers: number; knights: number; catapults: number },
      cas: { soldiers: number; knights: number; catapults: number },
      surv: { soldiers: number; knights: number; catapults: number }
    ) => {
      const colHead = this.add
        .text(cx, my + 118, heading, {
          fontFamily: FONT_HEADING,
          fontSize: '14px',
          fontStyle: 'bold',
          color: PALETTE_HEX.WOOD_DARK,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      const nameLbl = this.add
        .text(cx, my + 142, lordName, {
          fontFamily: FONT_BODY,
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#1E1A16',
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      const rowsText = [
        `Initial Host:   ${init.soldiers} Soldiers  •  ${init.knights} Knights  •  ${init.catapults} Catapults`,
        `Casualties:    -${cas.soldiers} Soldiers  •  -${cas.knights} Knights  •  -${cas.catapults} Catapults`,
        `Surviving:      ${surv.soldiers} Soldiers  •  ${surv.knights} Knights  •  ${surv.catapults} Catapults`,
      ].join('\n');

      const ledger = this.add
        .text(cx, my + 228, rowsText, {
          fontFamily: FONT_BODY,
          fontSize: '13.5px',
          fontStyle: '600',
          color: '#2A2018',
          align: 'center',
          lineSpacing: 12,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      this.summaryModalContainer.add([colHead, nameLbl, ledger]);
    };

    renderArmyColumn(
      436,
      '⚔  ATTACKING HOST',
      this.session.attackerName,
      this.session.campaignInitialAttackerArmy,
      result.attackerCasualties,
      this.session.attackerArmy
    );

    renderArmyColumn(
      844,
      '🛡  DEFENDING HOST',
      this.session.defenderName,
      this.session.campaignInitialDefenderTotal,
      result.defenderCasualties,
      this.session.defenderArmy
    );

    // Territory Fate & Home Castle Elimination Callout
    let fateLines = result.message;
    if (result.homeCastleCaptured && result.eliminatedLordId) {
      fateLines += `\n🏰 ANCESTRAL STRONGHOLD CAPTURED — Enemy Lord permanently vanquished!`;
    } else if (isRetreat) {
      fateLines += `\nParting Retreat Losses: -${this.session.retreatPenaltyLosses.soldiers} Soldiers, -${this.session.retreatPenaltyLosses.knights} Knights.`;
    }

    const fateTxt = this.add
      .text(640, my + 378, fateLines, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        fontStyle: 'bold',
        color: result.homeCastleCaptured ? PALETTE_HEX.BLOOD_RED : '#1E1A16',
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: 730 },
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.summaryModalContainer.add(fateTxt);

    // Return to Campaign Map Button
    const btnX = 430;
    const btnY = my + 436;
    const btnW = 420;
    const btnH = 50;

    const btnG = this.add.graphics();
    const drawReturnBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? PALETTE.BLOOD_RED : PALETTE.WOOD_DARK, 1);
      btnG.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnG.lineStyle(2.5, PALETTE.GOLD_BRIGHT, 1);
      btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    };
    drawReturnBtn(false);
    this.summaryModalContainer.add(btnG);

    const btnTxt = this.add
      .text(640, btnY + btnH / 2, '⚔   RETURN TO CAMPAIGN MAP   ⚔', {
        fontFamily: FONT_HEADING,
        fontSize: '16px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 1,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.summaryModalContainer.add(btnTxt);

    const btnZone = this.add.zone(640, btnY + btnH / 2, btnW, btnH);
    btnZone.setInteractive({ useHandCursor: true });
    btnZone.on('pointerover', () => drawReturnBtn(true));
    btnZone.on('pointerout', () => drawReturnBtn(false));
    btnZone.on('pointerdown', () => this.returnToCampaignMap());
    this.summaryModalContainer.add(btnZone);
  }

  private returnToCampaignMap(): void {
    const committed = this.session.committedResult;
    const focusTerritoryId = committed?.attackerWon
      ? this.session.territoryId
      : this.session.originTerritoryId;

    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene', {
        resumeAiQueue: this.resumeAiQueue,
        lastBattleMessage: committed?.message,
        lastBattleAlert: Boolean(
          committed &&
            ((this.session.playerSide === 'attacker' && !committed.attackerWon) ||
              (this.session.playerSide === 'defender' && committed.attackerWon))
        ),
        focusTerritoryId,
      });
    });
  }

  // ============================================================================
  // SIDEQUEST LABS SEASONAL BATTLEFIELD MIST, DUST & WEATHER FX
  // ============================================================================

  private initSidequestBattleAtmosphere(season: Season): void {
    this.battleMistClouds = [
      { x: 240, y: 215, w: 340, h: 46, speed: 16, alpha: 0.14 },
      { x: 760, y: 425, w: 410, h: 52, speed: 22, alpha: 0.12 },
      { x: 1080, y: 255, w: 300, h: 40, speed: 13, alpha: 0.11 },
    ];

    this.battleWeatherParticles = [];
    const count = season === 'WINTER' || season === 'AUTUMN' ? 32 : 18;
    for (let i = 0; i < count; i++) {
      this.battleWeatherParticles.push({
        x: (i * 83) % 1260,
        y: 20 + ((i * 61) % 450),
        vx: season === 'AUTUMN' ? 28 + (i % 4) * 8 : 14 + (i % 5) * 4,
        vy:
          season === 'WINTER'
            ? 24 + (i % 4) * 6
            : season === 'AUTUMN'
            ? 18 + (i % 3) * 6
            : -6 + (i % 3) * 4,
        size: i % 3 === 0 ? 4 : 3,
      });
    }
  }

  private updateSidequestBattleAtmosphere(delta: number): void {
    if (!this.sidequestAtmosphereGraphics) return;
    const dt = delta / 1000;
    const g = this.sidequestAtmosphereGraphics;
    const season = GameState.getInstance().getSeason();
    g.clear();

    // 1. Drifting Battlefield Mist / Dust Clouds
    const mistColor =
      season === 'WINTER'
        ? SIDEQUEST_PALETTE.WINTER_SNOW
        : season === 'AUTUMN'
        ? 0xe5cfa6
        : 0xd8e4f0;

    for (const m of this.battleMistClouds) {
      m.x += m.speed * dt;
      if (m.x - m.w / 2 > 1300) {
        m.x = -m.w / 2 - 20;
      }
      g.fillStyle(mistColor, m.alpha);
      g.fillEllipse(m.x, m.y, m.w, m.h);
    }

    // 2. Seasonal Falling Snowflakes (Winter), Russet Leaves (Autumn), or Meadow Motes (Spring/Summer)
    for (const p of this.battleWeatherParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt + Math.sin(this.bobTimer + p.x * 0.02) * 0.35;
      if (p.x > 1274) p.x = 8;
      if (p.y > 480) p.y = 12;
      if (p.y < 10) p.y = 476;

      if (season === 'WINTER') {
        g.fillStyle(SIDEQUEST_PALETTE.WINTER_SNOW, 0.82);
        g.fillRect(p.x, p.y, p.size, p.size);
      } else if (season === 'AUTUMN') {
        g.fillStyle(
          p.size > 3
            ? SIDEQUEST_PALETTE.AUTUMN_AMBER
            : SIDEQUEST_PALETTE.AUTUMN_RUSSET_MID,
          0.8
        );
        g.fillRect(p.x, p.y, p.size + 1, p.size - 1);
      } else {
        g.fillStyle(SIDEQUEST_PALETTE.GOLD_SPECULAR, 0.35);
        g.fillRect(p.x, p.y, 2, 2);
      }
    }
  }
}
