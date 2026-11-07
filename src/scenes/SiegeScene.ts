import Phaser from 'phaser';
import {
  ALL_SIEGE_AMMO,
  SIEGE_AMMO_PROFILES,
  SiegeEngine,
  SiegeSession,
  SiegeVolleyReport,
} from '../core/SiegeEngine';
import { GameState } from '../core/GameState';
import {
  AiTurnQueueState,
  PendingBattleContext,
  SiegeAmmoType,
} from '../core/types';
import { PALETTE, PALETTE_HEX, SIDEQUEST_PALETTE } from '../data/palette';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';

export interface SiegeSceneData {
  battleContext?: PendingBattleContext;
  resumeAiQueue?: AiTurnQueueState;
}

const FONT_HEADING = 'Cinzel, Georgia, serif';
const FONT_BODY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
const TEXT_RES = 2;

export class SiegeScene extends Phaser.Scene {
  private session!: SiegeSession;
  private resumeAiQueue?: AiTurnQueueState;

  // Interactive Aiming & Animation State
  private aimPower = 55;
  private isChargingWinch = false;
  private chargeDirection: 1 | -1 = 1;
  private isFiringAnimation = false;
  private isTransitioning = false;
  private armRecoilOverrideDeg: number | null = null;
  private hoveredTip: string | null = null;

  private envTimer = 0;
  private smokeTimer = 0;
  private aiShotTimerMs = 0;

  // Sky Clouds
  private cloudSprites: Array<{
    g: Phaser.GameObjects.Ellipse;
    speedMult: number;
  }> = [];

  // Top Viewport Visual Layers (0..1280 x 0..510)
  private castleRearGraphics!: Phaser.GameObjects.Graphics;
  private castleFrontGraphics!: Phaser.GameObjects.Graphics;
  private castleFlagsGraphics!: Phaser.GameObjects.Graphics;
  private foregroundFxGraphics!: Phaser.GameObjects.Graphics;
  private sidequestWeatherGraphics?: Phaser.GameObjects.Graphics;
  private siegeWindParticles: Array<{
    x: number;
    y: number;
    speedMult: number;
    isGrass: boolean;
  }> = [];
  private catapultRopeGraphics!: Phaser.GameObjects.Graphics;
  private ambientParticlesContainer!: Phaser.GameObjects.Container;
  private projectileBehindWallContainer!: Phaser.GameObjects.Container;
  private projectileFrontContainer!: Phaser.GameObjects.Container;

  // Multi-part Foreground Catapult & Sentries
  private leftGuardSprite!: Phaser.GameObjects.Image;
  private rightGuardSprite!: Phaser.GameObjects.Image;
  private catapultArmSprite!: Phaser.GameObjects.Image;
  private loadedAmmoSprite!: Phaser.GameObjects.Image;
  private catapultBaseSprite!: Phaser.GameObjects.Image;
  private winchWheelSprite!: Phaser.GameObjects.Image;

  private topTitleText!: Phaser.GameObjects.Text;
  private topSubText!: Phaser.GameObjects.Text;

  // Bottom Siege Command Deck Containers (0..1280 x 510..720)
  private leftStatusContainer!: Phaser.GameObjects.Container;
  private centerControlsContainer!: Phaser.GameObjects.Container;
  private powerGaugeGraphics!: Phaser.GameObjects.Graphics;
  private powerReadoutText!: Phaser.GameObjects.Text;
  private fireBtnLabelText?: Phaser.GameObjects.Text;
  private rightGarrisonContainer!: Phaser.GameObjects.Container;
  private tickerText!: Phaser.GameObjects.Text;

  private defSoldiersText?: Phaser.GameObjects.Text;
  private defKnightsText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'SiegeScene' });
  }

  create(data?: SiegeSceneData): void {
    PixelArtGenerator.generateAll(this);
    SidequestArtGenerator.generateAll(this);

    const gameState = GameState.getInstance();
    const state = gameState.getState();
    this.resumeAiQueue = data?.resumeAiQueue;

    // Safe fallback context if SiegeScene is launched directly in dev/testing
    const fallbackCastleId =
      Object.values(state.territories).find(
        (t) =>
          t.hasCastle &&
          t.ownerId !== state.selectedLordId &&
          !t.isSherwood
      )?.id ?? 'shropshire';

    const ctx: PendingBattleContext = data?.battleContext ?? {
      attackerId: state.selectedLordId,
      defenderId: state.territories[fallbackCastleId]?.ownerId ?? null,
      territoryId: fallbackCastleId,
      originTerritoryId: gameState.getPlayerLord().currentTerritoryId,
      hasCastle: true,
      mode: 'PLAYER_ATTACK',
    };

    // Ensure fallback dev launch has at least 1 catapult if state had 0
    if ((state.activeLords[ctx.attackerId]?.campaignArmy.catapults ?? 0) <= 0) {
      gameState.mutateState((st) => {
        if (st.activeLords[ctx.attackerId]) {
          st.activeLords[ctx.attackerId].campaignArmy.catapults = 1;
        }
      });
    }

    this.session = SiegeEngine.createSiegeSession(gameState.getState(), ctx);

    const initWindow = SiegeEngine.getPowerWindowForZone('WALL_HIT', this.session.wind);
    this.aimPower = initWindow.idealPower;
    this.isChargingWinch = false;
    this.chargeDirection = 1;
    this.isFiringAnimation = false;
    this.isTransitioning = false;
    this.armRecoilOverrideDeg = null;
    this.hoveredTip = null;
    this.envTimer = 0;
    this.smokeTimer = 0;
    this.aiShotTimerMs = -600;

    // 1. Top 1986-Homage Siege Viewport (0..1280 x 0..510)
    this.createTopSiegeViewport();

    // 2. Bottom Siege Command Deck (0..1280 x 510..720)
    this.createBottomCommandDeck();

    // 3. Keyboard & Pointer Release Bindings
    this.setupInputs();

    // 4. Initial Render
    this.drawCastleStructure();
    this.updateCatapultRigVisuals();
    this.refreshTopBanner();
    this.refreshLeftStatusPanel();
    this.refreshCenterControls();
    this.refreshPowerGaugeGraphics();
    this.refreshRightGarrisonPanel();
    this.refreshTicker();

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    this.envTimer += delta * 0.004;
    this.smokeTimer += delta;

    // 1. Drift atmospheric clouds with wind
    const windDriftPx = (this.session.wind === 0 ? 0.35 : this.session.wind) * 0.014 * delta;
    for (const c of this.cloudSprites) {
      c.g.x += windDriftPx * c.speedMult;
      if (c.g.x > 1380) c.g.x = -100;
      if (c.g.x < -100) c.g.x = 1380;
    }

    // 2. Animate castle wind pennants & foreground fire pots
    this.drawAnimatedCastlePennants();
    this.drawForegroundFireAndPropsFx();
    if (GameState.getInstance().isSidequestEdition()) {
      this.updateSidequestSiegeWeather(delta);
    }

    // 3. Spawn ongoing Castle Fire / Plague Miasma plumes behind ramparts
    if (this.smokeTimer >= 165) {
      this.smokeTimer = 0;
      if (this.session.isOnFire) {
        this.spawnCourtyardFireSmokePlume();
      }
      if (this.session.isPlagueInfected) {
        this.spawnCourtyardPlagueMiasma();
      }
    }

    // 4. Subtle guard idle breathing
    const guardBob = Math.sin(this.envTimer * 0.7) * 1.2;
    this.leftGuardSprite.y = 434 + guardBob;
    this.rightGuardSprite.y = 434 - guardBob;

    // 5. Interactive Winch Charging Oscillation (Player Attack Mode)
    if (
      this.isChargingWinch &&
      !this.isFiringAnimation &&
      !this.isTransitioning &&
      this.session.mode === 'PLAYER_ATTACK' &&
      this.session.shotsRemaining > 0
    ) {
      const chargeSpeed = 0.082 * delta; // ~1.2s from 0 to 100
      this.aimPower += this.chargeDirection * chargeSpeed;
      if (this.aimPower >= 100) {
        this.aimPower = 100;
        this.chargeDirection = -1;
      } else if (this.aimPower <= 5) {
        this.aimPower = 5;
        this.chargeDirection = 1;
      }
      this.updateCatapultRigVisuals();
      this.refreshPowerGaugeGraphics();
    } else if (!this.isFiringAnimation) {
      this.updateCatapultRigVisuals();
    }

    // 6. AI Besieger Watch Mode (when AI Lord besieges Player's Castle during END TURN)
    if (
      this.session.mode === 'PLAYER_DEFENSE' &&
      !this.isFiringAnimation &&
      !this.isTransitioning
    ) {
      this.aiShotTimerMs += delta;
      if (this.session.shotsRemaining > 0 && this.aiShotTimerMs >= 1350) {
        this.aiShotTimerMs = 0;
        const aiShot = SiegeEngine.chooseAiSiegeShot(this.session);
        SiegeEngine.selectAmmo(this.session, aiShot.ammo);
        this.aimPower = aiShot.power;
        this.refreshCenterControls();
        this.executeCatapultLaunch(aiShot.power);
      } else if (this.session.shotsRemaining <= 0 && this.aiShotTimerMs >= 1200) {
        this.transitionToFieldBattle();
      }
    }
  }

  // ============================================================================
  // TOP 1986-HOMAGE SIEGE VIEWPORT (x: 0..1280, y: 0..510)
  // ============================================================================

  private createTopSiegeViewport(): void {
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const bgKey =
      isSidequest && this.textures.exists('sq_siege_bg_landscape')
        ? 'sq_siege_bg_landscape'
        : 'siege_bg_landscape';
    this.add.image(0, 0, bgKey).setOrigin(0, 0).setDepth(1);

    // Drifting horizon clouds
    this.cloudSprites = [];
    const cloudDefs: Array<[number, number, number, number, number]> = [
      [180, 74, 150, 32, 1.0],
      [510, 56, 185, 36, 0.8],
      [880, 82, 165, 30, 1.15],
      [1150, 64, 140, 28, 0.9],
    ];
    for (const [cx, cy, cw, ch, spd] of cloudDefs) {
      const g = this.add
        .ellipse(cx, cy, cw, ch, PALETTE.PARCHMENT_LIGHT, 0.24)
        .setDepth(3);
      this.cloudSprites.push({ g, speedMult: spd });
    }

    // Layered Castle & Depth Containers so OVER_WALL projectiles literally drop behind the front wall!
    this.castleRearGraphics = this.add.graphics().setDepth(12);
    this.ambientParticlesContainer = this.add.container(0, 0).setDepth(15);
    this.projectileBehindWallContainer = this.add.container(0, 0).setDepth(18);
    this.castleFrontGraphics = this.add.graphics().setDepth(24);
    this.castleFlagsGraphics = this.add.graphics().setDepth(28);
    this.projectileFrontContainer = this.add.container(0, 0).setDepth(42);
    this.foregroundFxGraphics = this.add.graphics().setDepth(58);

    if (isSidequest) {
      this.sidequestWeatherGraphics = this.add.graphics().setDepth(60);
      const maskShape = this.make.graphics({ x: 0, y: 0 });
      maskShape.fillStyle(0xffffff, 1);
      maskShape.fillRect(6, 6, 1268, 498);
      this.sidequestWeatherGraphics.setMask(maskShape.createGeometryMask());
      this.siegeWindParticles = [];
      for (let i = 0; i < 42; i++) {
        const isGrass = i < 16;
        this.siegeWindParticles.push({
          x: (i * 79) % 1268,
          y: isGrass ? 315 + ((i * 37) % 180) : 14 + ((i * 53) % 480),
          speedMult: 0.75 + (i % 5) * 0.18,
          isGrass,
        });
      }
    }

    // Clickable Foreground Ammo Stockpiles on the Grass (1986 Homage!)
    this.createForegroundAmmoProps();

    // Flanking Men-at-Arms Guards
    const guardKey =
      this.session.attackerFaction === 'saxon'
        ? 'siege_guard_saxon'
        : 'siege_guard_norman';
    this.leftGuardSprite = this.add
      .image(112, 434, guardKey)
      .setScale(1.85)
      .setDepth(68);
    this.rightGuardSprite = this.add
      .image(1168, 434, guardKey)
      .setScale(1.85)
      .setFlipX(true)
      .setDepth(68);

    // Multi-Part Wooden Catapult in Bottom-Center Foreground
    this.catapultRopeGraphics = this.add.graphics().setDepth(69);

    this.catapultArmSprite = this.add
      .image(650, 422, 'siege_catapult_arm')
      .setOrigin(0.88, 0.5)
      .setScale(1.75)
      .setDepth(70);

    this.loadedAmmoSprite = this.add
      .image(560, 400, this.getProjectileTextureKey(this.session.selectedAmmo))
      .setScale(1.25)
      .setDepth(71);

    this.catapultBaseSprite = this.add
      .image(636, 454, 'siege_catapult_base')
      .setScale(1.75)
      .setDepth(72);

    this.winchWheelSprite = this.add
      .image(588, 462, 'siege_winch_wheel')
      .setScale(1.45)
      .setDepth(73);

    // Ornate Viewport Frame Bezel (0..1280 x 0..510)
    const frame = this.add.graphics().setDepth(90);
    frame.lineStyle(5, PALETTE.WOOD_DARK, 1);
    frame.strokeRect(2.5, 2.5, 1275, 505);
    frame.lineStyle(1.5, PALETTE.GOLD_DARK, 0.92);
    frame.strokeRect(6, 6, 1268, 498);

    // Top Center Siege Header Banner (x: 250..1030, y: 10..60)
    const headerBg = this.add.graphics().setDepth(92);
    headerBg.fillStyle(0x16110e, 0.88);
    headerBg.fillRoundedRect(250, 10, 780, 50, 6);
    headerBg.lineStyle(2, PALETTE.GOLD_DARK, 0.95);
    headerBg.strokeRoundedRect(250, 10, 780, 50, 6);

    this.topTitleText = this.add
      .text(640, 24, '', {
        fontFamily: FONT_HEADING,
        fontSize: '16px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 1.2,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setDepth(93);

    this.topSubText = this.add
      .text(640, 44, '', {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: '600',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setDepth(93);
  }

  private createForegroundAmmoProps(): void {
    // 1. Three Iconic Flaming Greek Fire Pots on the Left Grass
    const potPositions: Array<[number, number]> = [
      [252, 464],
      [304, 474],
      [354, 460],
    ];
    for (const [px, py] of potPositions) {
      const pot = this.add
        .image(px, py, 'siege_fire_pot')
        .setScale(1.6)
        .setDepth(62);
      if (this.session.mode === 'PLAYER_ATTACK') {
        pot.setInteractive({ useHandCursor: true });
        pot.on('pointerdown', () => this.handleSelectAmmo('GREEK_FIRE'));
      }
    }

    // 2. Hewn Granite Boulder Pile beside Catapult
    const stones = this.add
      .image(464, 472, 'siege_boulder_pile')
      .setScale(1.65)
      .setDepth(62);
    if (this.session.mode === 'PLAYER_ATTACK') {
      stones.setInteractive({ useHandCursor: true });
      stones.on('pointerdown', () => this.handleSelectAmmo('BOULDER'));
    }

    // 3. Biological Plague Barrels on the Right Grass
    const barrelPositions: Array<[number, number]> = [
      [884, 466],
      [934, 474],
    ];
    for (const [bx, by] of barrelPositions) {
      const barrel = this.add
        .image(bx, by, 'siege_plague_barrel')
        .setScale(1.6)
        .setDepth(62);
      if (this.session.mode === 'PLAYER_ATTACK') {
        barrel.setInteractive({ useHandCursor: true });
        barrel.on('pointerdown', () => this.handleSelectAmmo('DISEASE'));
      }
    }
  }

  /**
   * Renders the medieval stone fortress across 4 progressive destruction stages:
   * - Stage 0 (75..100%): Intact stone walls, battlements & iron portcullis
   * - Stage 1 (45..74%): Cracked masonry & chipped crenelations
   * - Stage 2 (1..44%): Deep structural fractures, collapsed upper parapet & warped gate
   * - Stage 3 (0% BREACHED!): Massive gaping rubble breach exposing the inner courtyard!
   */
  private drawCastleStructure(): void {
    const rear = this.castleRearGraphics;
    const front = this.castleFrontGraphics;
    rear.clear();
    front.clear();

    const integrity = this.session.wallIntegrity;
    const breached = this.session.wallBreached || integrity <= 0;

    // --- REAR INNER KEEP & COURTYARD BACKDROP (depth 12) ---
    // Dark inner courtyard shadow visible behind wall / through breach
    rear.fillStyle(this.session.isOnFire ? 0x3b180e : 0x1c1d24, 1);
    rear.fillRect(510, 155, 260, 88);

    // Tall Inner Great Keep rising behind the curtain wall
    rear.fillStyle(PALETTE.STONE_DARK, 1);
    rear.fillRect(592, 102, 96, 98);
    rear.fillStyle(PALETTE.STONE_MID, 1);
    rear.fillRect(596, 104, 78, 92);
    rear.fillStyle(PALETTE.STONE_LIGHT, 0.85);
    rear.fillRect(596, 104, 10, 90);
    for (let kx = 592; kx <= 676; kx += 20) {
      rear.fillRect(kx, 92, 12, 11);
    }
    // Inner Keep lancet windows (glowing orange if on fire!)
    rear.fillStyle(
      this.session.isOnFire ? PALETTE.BLOOD_RED : PALETTE.GOLD_BRIGHT,
      1
    );
    rear.fillRect(616, 122, 8, 18);
    rear.fillRect(656, 122, 8, 18);

    if (this.session.isOnFire) {
      rear.fillStyle(PALETTE.GOLD_DARK, 0.32);
      rear.fillCircle(640, 174, 58);
    }
    if (this.session.isPlagueInfected) {
      rear.fillStyle(0x7ccf35, 0.22);
      rear.fillCircle(640, 170, 64);
    }

    // --- FRONT TOWERS, CURTAIN WALL & GATEHOUSE (depth 24) ---
    // Outer Left & Right Flanking Bastion Walls & Towers
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const drawTower = (tx: number, ty: number, tw: number, th: number) => {
      front.fillStyle(PALETTE.BLACK, 0.9);
      front.fillRect(tx - 2, ty - 2, tw + 4, th + 4);
      front.fillStyle(
        isSidequest ? SIDEQUEST_PALETTE.MASONRY_DARK : PALETTE.STONE_DARK,
        1
      );
      front.fillRect(tx, ty, tw, th);
      front.fillStyle(
        isSidequest ? SIDEQUEST_PALETTE.MASONRY_MID : PALETTE.STONE_MID,
        1
      );
      front.fillRect(tx + 2, ty + 2, tw - 10, th - 2);
      front.fillStyle(
        isSidequest ? SIDEQUEST_PALETTE.MASONRY_HIGHLIGHT : PALETTE.STONE_LIGHT,
        0.85
      );
      front.fillRect(tx + 2, ty + 2, 7, th - 2);

      // Richer staggered ashlar stone masonry courses in Sidequest Labs Edition
      if (isSidequest) {
        front.lineStyle(1, SIDEQUEST_PALETTE.MASONRY_SHADOW, 0.65);
        for (let rowY = ty + 12; rowY < ty + th - 4; rowY += 12) {
          front.lineBetween(tx + 2, rowY, tx + tw - 2, rowY);
          const shift = ((rowY - ty) / 12) % 2 === 0 ? 10 : 20;
          for (let colX = tx + shift; colX < tx + tw - 4; colX += 18) {
            front.lineBetween(colX, rowY - 12, colX, rowY);
          }
        }
      }

      // Battlements
      const step = 14;
      for (let bx = tx; bx < tx + tw - 4; bx += step) {
        front.fillStyle(PALETTE.STONE_LIGHT, 1);
        front.fillRect(bx, ty - 9, 9, 10);
      }

      // Arrow slit
      front.fillStyle(PALETTE.BLACK, 1);
      front.fillRect(tx + Math.floor(tw / 2) - 3, ty + 24, 6, 18);
      front.fillStyle(PALETTE.GOLD_BRIGHT, 0.85);
      front.fillRect(tx + Math.floor(tw / 2) - 1, ty + 26, 2, 14);
    };

    // Flanking outer curtain segments
    front.fillStyle(PALETTE.STONE_DARK, 1);
    front.fillRect(496, 174, 42, 68);
    front.fillRect(742, 174, 42, 68);
    front.fillStyle(PALETTE.STONE_MID, 1);
    front.fillRect(498, 176, 38, 64);
    front.fillRect(744, 176, 38, 64);

    // Outer Bastions
    drawTower(452, 154, 46, 88);
    drawTower(782, 154, 46, 88);

    // Twin Central Gatehouse Towers
    drawTower(534, 134, 48, 110);
    drawTower(698, 134, 48, 110);

    // Central Curtain Wall & Portcullis Gatehouse (x: 582..698, y: 162..244)
    if (!breached) {
      front.fillStyle(PALETTE.STONE_DARK, 1);
      front.fillRect(582, 162, 116, 82);
      front.fillStyle(PALETTE.STONE_MID, 1);
      front.fillRect(584, 164, 108, 78);

      // Subtle stone block courses
      front.lineStyle(
        1,
        isSidequest ? SIDEQUEST_PALETTE.MASONRY_SHADOW : PALETTE.STONE_DARK,
        isSidequest ? 0.72 : 0.55
      );
      for (let my = 178; my < 240; my += 14) {
        front.lineBetween(584, my, 696, my);
        if (isSidequest) {
          const shift = ((my - 178) / 14) % 2 === 0 ? 12 : 24;
          for (let mx = 584 + shift; mx < 692; mx += 22) {
            front.lineBetween(mx, my - 14, mx, my);
          }
        }
      }

      // Upper Curtain Battlements (missing crenels as wall degrades)
      const crenels = [586, 604, 622, 640, 658, 676];
      crenels.forEach((cx, idx) => {
        if (integrity < 75 && idx === 2) return;
        if (integrity < 45 && (idx === 1 || idx === 3 || idx === 4)) return;
        front.fillStyle(PALETTE.STONE_LIGHT, 1);
        front.fillRect(cx, 153, 11, 10);
      });

      // Top parapet collapse notch in heavily battered stage (< 45%)
      if (integrity < 45) {
        front.fillStyle(this.session.isOnFire ? 0x3b180e : 0x1c1d24, 1);
        front.beginPath();
        front.moveTo(604, 162);
        front.lineTo(626, 184);
        front.lineTo(652, 178);
        front.lineTo(672, 162);
        front.closePath();
        front.fillPath();
      }

      // Arched Gatehouse & Iron Portcullis
      front.fillStyle(PALETTE.BLACK, 1);
      front.fillRect(614, 194, 52, 50);
      front.fillCircle(640, 194, 26);

      // Stone arch voussoirs
      front.lineStyle(4, PALETTE.STONE_LIGHT, 0.75);
      front.beginPath();
      front.arc(640, 194, 27, Math.PI, 0, false);
      front.strokePath();

      // Wooden / Iron Portcullis Grid
      front.fillStyle(PALETTE.WOOD_DARK, 0.9);
      front.fillRect(616, 194, 48, 48);
      front.fillStyle(PALETTE.STONE_LIGHT, 0.8);
      for (let gx = 622; gx <= 658; gx += 9) {
        const tilt = integrity < 45 && gx === 640 ? 3 : 0;
        front.fillRect(gx + tilt, 188, 2.5, 54);
      }
      front.fillRect(616, 206, 48, 2.5);
      front.fillRect(616, 224, 48, 2.5);

      // Scorch marks from Greek Fire wall hits
      if (this.session.wallScorched || this.session.isOnFire) {
        front.fillStyle(0x161210, 0.55);
        front.fillEllipse(604, 196, 28, 36);
        front.fillEllipse(674, 188, 24, 30);
      }

      // Structural Cracks (Stage 1 & Stage 2)
      if (integrity < 75) {
        front.lineStyle(2.5, PALETTE.BLACK, 0.85);
        front.beginPath();
        front.moveTo(602, 164);
        front.lineTo(610, 182);
        front.lineTo(598, 204);
        front.lineTo(608, 224);
        front.strokePath();

        front.beginPath();
        front.moveTo(676, 168);
        front.lineTo(668, 192);
        front.lineTo(680, 214);
        front.strokePath();
      }

      if (integrity < 45) {
        front.lineStyle(3.5, PALETTE.BLACK, 0.95);
        front.beginPath();
        front.moveTo(628, 178);
        front.lineTo(620, 198);
        front.lineTo(632, 218);
        front.lineTo(622, 242);
        front.strokePath();

        // Fallen masonry rubble at base of battered wall
        this.drawRubbleMound(front, 640, 244, 0.55);
      }
    } else {
      // --- STAGE 3: MASSIVE GAPING WALL BREACH (wallIntegrity === 0) ---
      // Left & Right jagged shattered wall stubs
      front.fillStyle(PALETTE.STONE_MID, 1);
      front.beginPath();
      front.moveTo(582, 164);
      front.lineTo(604, 164);
      front.lineTo(594, 190);
      front.lineTo(608, 214);
      front.lineTo(598, 244);
      front.lineTo(582, 244);
      front.closePath();
      front.fillPath();

      front.beginPath();
      front.moveTo(698, 164);
      front.lineTo(678, 164);
      front.lineTo(686, 188);
      front.lineTo(672, 212);
      front.lineTo(684, 244);
      front.lineTo(698, 244);
      front.closePath();
      front.fillPath();

      // Massive collapsed stone rubble mound spilling out of the breach!
      this.drawRubbleMound(front, 640, 246, 1.0);
    }
  }

  private drawRubbleMound(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    scale: number
  ): void {
    const rw = Math.round(112 * scale);
    const rh = Math.round(28 * scale);
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillEllipse(cx, cy, rw, rh);
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillEllipse(cx - 4, cy - 3, rw * 0.82, rh * 0.72);

    const blocks: Array<[number, number, number, number]> = [
      [-34, -4, 12, 8],
      [-18, -9, 14, 9],
      [-2, -11, 15, 9],
      [16, -8, 13, 8],
      [30, -3, 12, 7],
      [-10, 2, 13, 7],
      [10, 3, 14, 7],
    ];
    for (const [ox, oy, bw, bh] of blocks) {
      g.fillStyle(PALETTE.STONE_LIGHT, 0.9);
      g.fillRect(
        cx + Math.round(ox * scale),
        cy + Math.round(oy * scale),
        Math.max(5, Math.round(bw * scale)),
        Math.max(4, Math.round(bh * scale))
      );
      g.lineStyle(1, PALETTE.BLACK, 0.7);
      g.strokeRect(
        cx + Math.round(ox * scale),
        cy + Math.round(oy * scale),
        Math.max(5, Math.round(bw * scale)),
        Math.max(4, Math.round(bh * scale))
      );
    }
  }

  /**
   * Draws 3 animated tower flags/pennants whose angle, length, and wave ripple reflect session.wind!
   */
  private drawAnimatedCastlePennants(): void {
    const g = this.castleFlagsGraphics;
    g.clear();

    const flagColor =
      this.session.defenderFaction === 'norman'
        ? PALETTE.BLOOD_RED
        : PALETTE.FOLIAGE_MID;
    const trimColor = PALETTE.GOLD_BRIGHT;

    const wind = this.session.wind;
    const absWind = Math.abs(wind);
    const dir = wind >= 0 ? 1 : -1;
    const len = 18 + absWind * 2.8;
    const waveSpeed = 1.4 + absWind * 0.35;

    const poles: Array<[number, number, number]> = [
      [558, 125, 28],
      [640, 92, 32],
      [722, 125, 28],
    ];

    poles.forEach(([px, baseTopY, poleH], idx) => {
      const topY = baseTopY - poleH;
      // Flagpole + Gold finial
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(px - 1.5, topY, 3, poleH);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillCircle(px, topY, 3);

      if (wind === 0) {
        // Calm gentle droop
        const sway = Math.sin(this.envTimer * 1.2 + idx) * 4;
        g.fillStyle(flagColor, 1);
        g.fillTriangle(px, topY + 2, px + 14 + sway, topY + 14, px, topY + 18);
        return;
      }

      // Wind-driven rippling pennant
      const tipX = px + dir * len;
      const tipWave =
        Math.sin(this.envTimer * waveSpeed + idx * 1.1) * (2.5 + absWind * 0.45);
      const midX = px + dir * (len * 0.55);
      const midWave =
        Math.cos(this.envTimer * waveSpeed + idx * 1.1) * (2 + absWind * 0.3);
      // Slight vertical lift on tailwind (+), downward press on headwind (-)
      const verticalBias = wind > 0 ? -absWind * 0.45 : absWind * 0.45;

      g.fillStyle(flagColor, 1);
      g.beginPath();
      g.moveTo(px, topY + 2);
      g.lineTo(midX, topY + 3 + midWave + verticalBias * 0.5);
      g.lineTo(tipX, topY + 7 + tipWave + verticalBias);
      g.lineTo(midX, topY + 12 + midWave + verticalBias * 0.5);
      g.lineTo(px, topY + 14);
      g.closePath();
      g.fillPath();

      g.lineStyle(1.5, trimColor, 0.9);
      g.lineBetween(
        px,
        topY + 8,
        px + dir * (len * 0.65),
        topY + 7.5 + midWave + verticalBias * 0.6
      );
    });
  }

  private drawForegroundFireAndPropsFx(): void {
    const g = this.foregroundFxGraphics;
    g.clear();

    // Animated flickering flames atop the 3 foreground Greek Fire pots on the left grass
    const pots: Array<[number, number]> = [
      [252, 444],
      [304, 454],
      [354, 440],
    ];
    pots.forEach(([px, py], i) => {
      const flickerH = 12 + Math.sin(this.envTimer * 4.2 + i * 1.7) * 4;
      const sway =
        Math.cos(this.envTimer * 3.5 + i) * 2.5 + this.session.wind * 0.4;

      g.fillStyle(PALETTE.GOLD_DARK, 0.22);
      g.fillCircle(px, py - 2, 20);
      g.fillStyle(PALETTE.BLOOD_RED, 0.9);
      g.fillTriangle(px - 8, py + 4, px + 8, py + 4, px + sway, py - flickerH - 4);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 0.95);
      g.fillTriangle(px - 5, py + 4, px + 5, py + 4, px + sway * 0.7, py - flickerH);
    });

    // Subtle toxic vapor wisps above the right-side Plague Barrels
    const barrels: Array<[number, number]> = [
      [884, 446],
      [934, 454],
    ];
    barrels.forEach(([bx, by], i) => {
      const rise = ((this.envTimer * 12 + i * 9) % 18);
      const alpha = Math.max(0, 0.45 - rise / 40);
      g.fillStyle(0x88e038, alpha);
      g.fillCircle(
        bx + Math.sin(this.envTimer * 2 + i) * 4,
        by - rise,
        5 + rise * 0.15
      );
    });
  }

  /**
   * Updates the foreground wooden catapult throwing arm angle, winch wheel rotation,
   * taut winch rope tension lines, and spoon-loaded projectile position!
   */
  private updateCatapultRigVisuals(): void {
    const p = Phaser.Math.Clamp(this.aimPower / 100, 0, 1);

    // Arm angle: relaxed at +28 deg (leaning slightly up-left), pulled down-left to -26 deg at 100% tension;
    // when fired, snaps sharply upright to +76 deg!
    const angleDeg =
      this.armRecoilOverrideDeg !== null
        ? this.armRecoilOverrideDeg
        : Phaser.Math.Linear(32, -24, p);

    this.catapultArmSprite.setAngle(angleDeg);
    this.winchWheelSprite.setAngle(-p * 320);

    // Compute world coordinates of the catapult spoon tip from pivot (650, 422)
    const rad = Phaser.Math.DegToRad(angleDeg);
    const armLenPx = 74 * 1.75; // distance from origin (0.88) to spoon center (~0.11)
    const spoonX = this.catapultArmSprite.x - Math.cos(rad) * armLenPx;
    const spoonY = this.catapultArmSprite.y - Math.sin(rad) * armLenPx;

    // Position loaded ammo inside the spoon when ready to fire
    const showLoaded = !this.isFiringAnimation && this.session.shotsRemaining > 0;
    this.loadedAmmoSprite.setVisible(showLoaded);
    if (showLoaded) {
      this.loadedAmmoSprite.setTexture(
        this.getProjectileTextureKey(this.session.selectedAmmo)
      );
      this.loadedAmmoSprite.setPosition(spoonX, spoonY - 8);
    }

    // Draw taut twisted winch rope from spoon back to winch capstan (588, 462)
    const rg = this.catapultRopeGraphics;
    rg.clear();
    if (this.armRecoilOverrideDeg === null) {
      rg.lineStyle(2.5, PALETTE.PARCHMENT_DARK, 0.9);
      rg.lineBetween(spoonX + 6, spoonY + 2, 588, 462);
      rg.lineStyle(1, PALETTE.WOOD_DARK, 0.7);
      rg.lineBetween(spoonX + 7, spoonY + 3, 589, 463);
    }
  }

  private getProjectileTextureKey(ammo: SiegeAmmoType): string {
    if (ammo === 'GREEK_FIRE') return 'proj_siege_greek_fire';
    if (ammo === 'DISEASE') return 'proj_siege_disease';
    return 'proj_siege_boulder';
  }

  // ============================================================================
  // 3D-PERSPECTIVE PROJECTILE FLIGHT & IMPACT CHOREOGRAPHY
  // ============================================================================

  private executeCatapultLaunch(powerToFire: number): void {
    if (
      this.isFiringAnimation ||
      this.isTransitioning ||
      this.session.shotsRemaining <= 0
    ) {
      return;
    }

    this.isChargingWinch = false;
    this.isFiringAnimation = true;

    // Resolve pure ballistic volley in SiegeEngine
    const report = SiegeEngine.fireVolley(this.session, powerToFire);

    // 1. Snap catapult arm upright against timber stop block!
    const launchOriginX = this.loadedAmmoSprite.x;
    const launchOriginY = this.loadedAmmoSprite.y;
    this.loadedAmmoSprite.setVisible(false);

    this.tweens.add({
      targets: { deg: this.catapultArmSprite.angle },
      deg: 76,
      duration: 95,
      ease: 'Back.easeOut',
      onUpdate: (_tw, obj: { deg: number }) => {
        this.armRecoilOverrideDeg = obj.deg;
        this.updateCatapultRigVisuals();
      },
    });
    this.tweens.add({
      targets: this.catapultBaseSprite,
      y: this.catapultBaseSprite.y - 4,
      duration: 65,
      yoyo: true,
      ease: 'Quad.easeOut',
    });

    // 2. Compute 3D-perspective target coordinates & scale from report.impactZone & effectiveDistance
    const dist = report.effectiveDistance;
    let targetX = 640 + Phaser.Math.Clamp(report.windBefore * 2.8, -36, 36);
    let targetY = 212;
    let endScale = 0.4;
    let arcApexLift = 165;
    let dropsBehindWall = false;

    if (report.impactZone === 'SHORT_MISS') {
      const t = Phaser.Math.Clamp(dist / 41, 0.08, 1);
      targetY = Phaser.Math.Linear(376, 268, t);
      endScale = Phaser.Math.Linear(0.95, 0.52, t);
      arcApexLift = 115;
    } else if (report.impactZone === 'WALL_HIT') {
      const t = Phaser.Math.Clamp((dist - 42) / 26, 0, 1);
      targetX = 640 + Phaser.Math.Clamp(report.windBefore * 2.2, -38, 38);
      targetY = Phaser.Math.Linear(234, 188, t);
      endScale = 0.41;
      arcApexLift = 175;
    } else if (report.impactZone === 'OVER_WALL_COURTYARD') {
      const t = Phaser.Math.Clamp((dist - 69) / 17, 0, 1);
      targetX = 640 + Phaser.Math.Clamp(report.windBefore * 2.6, -40, 40);
      targetY = Phaser.Math.Linear(186, 168, t);
      endScale = 0.34;
      arcApexLift = 218;
      dropsBehindWall = true;
    } else {
      // LONG_MISS: Sails high over castle keep into distant hills
      targetX = 640 + Phaser.Math.Clamp(report.windBefore * 3.5, -55, 55);
      targetY = 142;
      endScale = 0.22;
      arcApexLift = 248;
      dropsBehindWall = true;
    }

    const projKey = this.getProjectileTextureKey(report.ammo);
    const proj = this.add
      .image(launchOriginX, launchOriginY, projKey)
      .setScale(1.35);
    this.projectileFrontContainer.add(proj);

    let movedBehindWall = false;
    let trailStep = 0;

    this.tweens.add({
      targets: { p: 0 },
      p: 1,
      duration: 880,
      ease: 'Linear',
      onUpdate: (_tw, obj: { p: number }) => {
        if (!proj.active) return;
        const p = obj.p;
        const curX = Phaser.Math.Linear(launchOriginX, targetX, p);
        const baseLineY = Phaser.Math.Linear(launchOriginY, targetY, p);
        const curY = baseLineY - Math.sin(p * Math.PI) * arcApexLift;
        const curScale = Phaser.Math.Linear(1.35, endScale, Math.pow(p, 0.82));

        proj.setPosition(curX, curY);
        proj.setScale(curScale);
        proj.setRotation(p * Math.PI * 3.5);

        // Move projectile behind front curtain wall on descent if arcing over battlements!
        if (dropsBehindWall && !movedBehindWall && p > 0.68) {
          movedBehindWall = true;
          this.projectileFrontContainer.remove(proj);
          this.projectileBehindWallContainer.add(proj);
        }

        // Spawn perspective trail particles (flames for Greek Fire, spores for Disease, dust for Boulder)
        trailStep++;
        if (trailStep % 3 === 0 && p < 0.96) {
          this.spawnProjectileTrailDot(curX, curY, curScale, report.ammo, movedBehindWall);
        }
      },
      onComplete: () => {
        proj.destroy();
        this.playImpactVisuals(report, targetX, targetY);
      },
    });
  }

  private spawnProjectileTrailDot(
    x: number,
    y: number,
    scale: number,
    ammo: SiegeAmmoType,
    behindWall: boolean
  ): void {
    const color =
      ammo === 'GREEK_FIRE'
        ? PALETTE.GOLD_BRIGHT
        : ammo === 'DISEASE'
        ? 0x8ce83a
        : PALETTE.STONE_LIGHT;
    const dot = this.add
      .circle(x, y, Math.max(2, 5 * scale), color, ammo === 'BOULDER' ? 0.45 : 0.85);
    const parent = behindWall
      ? this.projectileBehindWallContainer
      : this.projectileFrontContainer;
    parent.add(dot);

    this.tweens.add({
      targets: dot,
      alpha: 0,
      scale: 0.3,
      y: y - (ammo === 'BOULDER' ? -4 : 10),
      duration: 280,
      onComplete: () => dot.destroy(),
    });
  }

  private playImpactVisuals(
    report: SiegeVolleyReport,
    x: number,
    y: number
  ): void {
    // Update castle masonry immediately upon impact!
    this.drawCastleStructure();

    if (report.impactZone === 'SHORT_MISS') {
      // Turf clods & dust thud on grassy hill
      for (let i = 0; i < 6; i++) {
        const clod = this.add.circle(
          x + Phaser.Math.Between(-12, 12),
          y,
          Phaser.Math.Between(3, 5),
          i % 2 === 0 ? PALETTE.WOOD_DARK : PALETTE.FOLIAGE_DARK,
          0.9
        );
        this.projectileFrontContainer.add(clod);
        this.tweens.add({
          targets: clod,
          x: clod.x + Phaser.Math.Between(-24, 24),
          y: y - Phaser.Math.Between(10, 26),
          alpha: 0,
          duration: 380,
          onComplete: () => clod.destroy(),
        });
      }
      this.spawnFloatingCallout(x, y - 14, 'SHORT MISS!', PALETTE_HEX.STONE_LIGHT);
    } else if (report.impactZone === 'LONG_MISS') {
      this.spawnFloatingCallout(x, y - 8, 'OVERSHOT CASTLE!', PALETTE_HEX.STONE_LIGHT);
    } else if (report.impactZone === 'WALL_HIT') {
      // Heavy camera shake & flying NEAREST stone masonry debris!
      this.cameras.main.shake(
        report.wallBreachedOnShot ? 420 : 210,
        report.wallBreachedOnShot ? 0.012 : 0.0055
      );

      const debrisCount = report.wallBreachedOnShot ? 22 : 10;
      for (let i = 0; i < debrisCount; i++) {
        const chunk = this.add
          .image(x + Phaser.Math.Between(-18, 18), y, 'fx_stone_debris')
          .setScale(report.wallBreachedOnShot ? 1.35 : 1.0);
        this.projectileFrontContainer.add(chunk);
        this.tweens.add({
          targets: chunk,
          x: chunk.x + Phaser.Math.Between(-75, 75),
          y: y + Phaser.Math.Between(-48, 52),
          angle: Phaser.Math.Between(-180, 180),
          alpha: 0,
          duration: report.wallBreachedOnShot ? 760 : 480,
          ease: 'Quad.easeOut',
          onComplete: () => chunk.destroy(),
        });
      }

      // Dust cloud puff (glorious dust cloud on Wall Breach!)
      const dustPuffs = report.wallBreachedOnShot ? 9 : 3;
      for (let d = 0; d < dustPuffs; d++) {
        const puff = this.add.circle(
          x + Phaser.Math.Between(-36, 36),
          y + Phaser.Math.Between(-14, 18),
          report.wallBreachedOnShot ? 24 : 14,
          PALETTE.PARCHMENT_DARK,
          0.75
        );
        this.projectileFrontContainer.add(puff);
        this.tweens.add({
          targets: puff,
          scale: report.wallBreachedOnShot ? 2.4 : 1.7,
          y: puff.y - 26,
          alpha: 0,
          duration: report.wallBreachedOnShot ? 880 : 460,
          onComplete: () => puff.destroy(),
        });
      }

      if (report.wallBreachedOnShot) {
        this.spawnFloatingCallout(
          640,
          145,
          '💥 CURTAIN WALL BREACHED! (0% ARMOR)',
          PALETTE_HEX.GOLD_BRIGHT
        );
      } else {
        this.spawnFloatingCallout(
          x,
          y - 18,
          `-${report.wallDamage}% WALL!`,
          PALETTE_HEX.GOLD_BRIGHT
        );
      }
    } else if (report.impactZone === 'OVER_WALL_COURTYARD') {
      // Courtyard hit behind the ramparts!
      this.cameras.main.shake(180, 0.0045);

      if (report.ammo === 'GREEK_FIRE') {
        for (let i = 0; i < 8; i++) {
          const flame = this.add.circle(
            x + Phaser.Math.Between(-28, 28),
            176 + Phaser.Math.Between(-8, 8),
            Phaser.Math.Between(12, 22),
            i % 2 === 0 ? PALETTE.BLOOD_RED : PALETTE.GOLD_BRIGHT,
            0.88
          );
          this.projectileBehindWallContainer.add(flame);
          this.tweens.add({
            targets: flame,
            y: flame.y - Phaser.Math.Between(36, 68),
            scale: 1.8,
            alpha: 0,
            duration: 640,
            onComplete: () => flame.destroy(),
          });
        }
        const killed =
          report.immediateDefenderLosses.soldiers +
          report.immediateDefenderLosses.knights;
        this.spawnFloatingCallout(
          x,
          136,
          `🔥 GREEK FIRE! -${killed} GARRISON!`,
          '#FF8A3D'
        );
      } else if (report.ammo === 'DISEASE') {
        for (let i = 0; i < 8; i++) {
          const gas = this.add.circle(
            x + Phaser.Math.Between(-28, 28),
            176 + Phaser.Math.Between(-8, 8),
            Phaser.Math.Between(14, 24),
            i % 2 === 0 ? 0x7ccf35 : 0xc8ff68,
            0.78
          );
          this.projectileBehindWallContainer.add(gas);
          this.tweens.add({
            targets: gas,
            y: gas.y - Phaser.Math.Between(34, 62),
            scale: 2.0,
            alpha: 0,
            duration: 720,
            onComplete: () => gas.destroy(),
          });
        }
        const killed =
          report.immediateDefenderLosses.soldiers +
          report.immediateDefenderLosses.knights;
        this.spawnFloatingCallout(
          x,
          136,
          `☠ PLAGUE INFECTED! -${killed} TROOPS!`,
          '#A6FF4D'
        );
      } else {
        const killed = report.immediateDefenderLosses.soldiers;
        this.spawnFloatingCallout(
          x,
          144,
          `COURTYARD HIT! -${report.wallDamage}% WALL / -${killed}S`,
          PALETTE_HEX.PARCHMENT_LIGHT
        );
      }
    }

    // Ongoing plague attrition callout
    if (report.plagueAttritionLosses.soldiers > 0) {
      this.time.delayedCall(220, () => {
        if (!this.scene || !this.scene.isActive()) return;
        this.spawnFloatingCallout(
          690,
          162,
          `☠ -${report.plagueAttritionLosses.soldiers} PLAGUE ATTRITION`,
          '#A6FF4D'
        );
      });
    }

    // Defender Counter-Battery Fire visual & popup
    if (report.counterFireTriggered) {
      this.animateDefenderCounterVolley(report);
    }

    // Smoothly crank catapult arm back down to aiming position & unlock controls
    this.time.delayedCall(420, () => {
      if (!this.scene || !this.scene.isActive()) return;
      const targetRestDeg = Phaser.Math.Linear(32, -24, this.aimPower / 100);
      this.tweens.add({
        targets: { deg: 76 },
        deg: targetRestDeg,
        duration: 280,
        ease: 'Sine.easeInOut',
        onUpdate: (_tw, obj: { deg: number }) => {
          this.armRecoilOverrideDeg = obj.deg;
          this.updateCatapultRigVisuals();
        },
        onComplete: () => {
          this.armRecoilOverrideDeg = null;
          this.isFiringAnimation = false;
          this.updateCatapultRigVisuals();
          this.refreshTopBanner();
          this.refreshLeftStatusPanel();
          this.refreshCenterControls();
          this.refreshPowerGaugeGraphics();
          this.refreshRightGarrisonPanel(report);
          this.refreshTicker();
        },
      });
    });
  }

  private animateDefenderCounterVolley(report: SiegeVolleyReport): void {
    const startX = 558;
    const startY = 148;
    const endX = 610;
    const endY = 445;

    for (let i = 0; i < 3; i++) {
      const bolt = this.add
        .rectangle(startX + i * 16, startY, 3, 12, PALETTE.PARCHMENT_LIGHT)
        .setDepth(55);
      this.tweens.add({
        targets: bolt,
        x: endX + (i - 1) * 32,
        y: endY,
        scale: 1.5,
        duration: 340,
        delay: i * 45,
        onComplete: () => bolt.destroy(),
      });
    }

    this.time.delayedCall(340, () => {
      if (!this.scene || !this.scene.isActive()) return;
      this.cameras.main.shake(120, 0.003);
      const lossMsg =
        report.attackerCounterLosses.catapults > 0
          ? '🏹 COUNTER-FIRE: -1 CATAPULT!'
          : `🏹 COUNTER-FIRE: -${report.attackerCounterLosses.soldiers} SOLDIER${
              report.attackerCounterLosses.soldiers > 1 ? 'S' : ''
            }!`;
      this.spawnFloatingCallout(632, 392, lossMsg, '#FF6B6B');
    });
  }

  private spawnCourtyardFireSmokePlume(): void {
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const sx = 640 + Phaser.Math.Between(-42, 42);
    const sy = 172;
    const isFlame = Math.random() < 0.38;
    const puff = this.add.circle(
      sx,
      sy,
      isFlame ? Phaser.Math.Between(6, 11) : Phaser.Math.Between(10, 16),
      isFlame
        ? isSidequest
          ? SIDEQUEST_PALETTE.TORCH_AMBER
          : PALETTE.GOLD_BRIGHT
        : 0x262428,
      isFlame ? 0.76 : 0.52
    );
    this.ambientParticlesContainer.add(puff);

    this.tweens.add({
      targets: puff,
      x: sx + this.session.wind * 3.5 + Phaser.Math.Between(-8, 8),
      y: sy - (isFlame ? 32 : 84),
      scale: isFlame ? 0.5 : 2.2,
      alpha: 0,
      duration: isFlame ? 480 : 1550,
      onComplete: () => puff.destroy(),
    });

    // Persistent glowing rising embers in Sidequest Labs Edition
    if (isSidequest) {
      const ember = this.add.rectangle(
        sx + Phaser.Math.Between(-14, 14),
        sy,
        3,
        3,
        Math.random() < 0.5
          ? SIDEQUEST_PALETTE.TORCH_GLOW
          : SIDEQUEST_PALETTE.TORCH_ORANGE
      );
      this.ambientParticlesContainer.add(ember);
      this.tweens.add({
        targets: ember,
        x: ember.x + this.session.wind * 5 + Phaser.Math.Between(-18, 18),
        y: sy - Phaser.Math.Between(55, 110),
        alpha: 0,
        duration: 1200,
        onComplete: () => ember.destroy(),
      });
    }
  }

  private spawnCourtyardPlagueMiasma(): void {
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const sx = 640 + Phaser.Math.Between(-46, 46);
    const sy = 174;
    const cloud = this.add.circle(
      sx,
      sy,
      Phaser.Math.Between(9, 15),
      Math.random() < 0.5 ? 0x7ccf35 : 0xb8f252,
      isSidequest ? 0.46 : 0.38
    );
    this.ambientParticlesContainer.add(cloud);

    this.tweens.add({
      targets: cloud,
      x: sx + this.session.wind * 2.8 + Phaser.Math.Between(-12, 12),
      y: sy - 68,
      scale: 2.0,
      alpha: 0,
      duration: 1400,
      onComplete: () => cloud.destroy(),
    });

    if (isSidequest) {
      const spore = this.add.rectangle(
        sx + Phaser.Math.Between(-16, 16),
        sy,
        3,
        3,
        0xd4ff70
      );
      this.ambientParticlesContainer.add(spore);
      this.tweens.add({
        targets: spore,
        x: spore.x + this.session.wind * 4 + Phaser.Math.Between(-14, 14),
        y: sy - Phaser.Math.Between(48, 92),
        alpha: 0,
        duration: 1150,
        onComplete: () => spore.destroy(),
      });
    }
  }

  private spawnFloatingCallout(
    x: number,
    y: number,
    text: string,
    color: string
  ): void {
    const lbl = this.add
      .text(x, y, text, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#0B0D14',
        strokeThickness: 3.5,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setDepth(86);

    this.tweens.add({
      targets: lbl,
      y: y - 34,
      alpha: 0,
      duration: 920,
      ease: 'Cubic.easeOut',
      onComplete: () => lbl.destroy(),
    });
  }

  // ============================================================================
  // BOTTOM SIEGE COMMAND DECK (x: 0..1280, y: 510..720)
  // ============================================================================

  private createBottomCommandDeck(): void {
    const deckBg = this.add.graphics().setDepth(100);
    deckBg.fillStyle(0x1f212a, 1);
    deckBg.fillRect(0, 510, 1280, 210);

    // Subtle stone masonry courses
    deckBg.fillStyle(0x13151c, 0.55);
    for (let y = 536; y < 720; y += 28) {
      deckBg.fillRect(0, y, 1280, 1.5);
    }

    // Ornate Wood & Gold Bezel
    deckBg.lineStyle(5, PALETTE.WOOD_DARK, 1);
    deckBg.strokeRect(2.5, 512.5, 1275, 205);
    deckBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    deckBg.strokeRect(6, 516, 1268, 198);

    this.leftStatusContainer = this.add.container(0, 0).setDepth(105);
    this.centerControlsContainer = this.add.container(0, 0).setDepth(105);
    this.powerGaugeGraphics = this.add.graphics().setDepth(110);
    this.powerReadoutText = this.add
      .text(640, 583, '', {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 0)
      .setDepth(112);

    this.rightGarrisonContainer = this.add.container(0, 0).setDepth(105);

    // Interactive Click/Drag Zone over the Power Gauge Bar (x: 438..842, y: 598..620)
    const gaugeZone = this.add
      .zone(640, 609, 404, 24)
      .setDepth(115)
      .setInteractive({ useHandCursor: true });

    const setPowerFromPointer = (ptr: Phaser.Input.Pointer) => {
      if (
        this.session.mode !== 'PLAYER_ATTACK' ||
        this.isFiringAnimation ||
        this.session.shotsRemaining <= 0
      ) {
        return;
      }
      const ratio = Phaser.Math.Clamp((ptr.x - 438) / 404, 0, 1);
      this.aimPower = Math.round(ratio * 100);
      this.updateCatapultRigVisuals();
      this.refreshPowerGaugeGraphics();
    };

    gaugeZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => setPowerFromPointer(ptr));
    gaugeZone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (ptr.isDown) setPowerFromPointer(ptr);
    });

    // Live Siege Log Ticker Box (x: 362..918, y: 672..708)
    const tickerBg = this.add.graphics().setDepth(104);
    tickerBg.fillStyle(0x110e0c, 0.94);
    tickerBg.fillRoundedRect(362, 672, 556, 36, 5);
    tickerBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    tickerBg.strokeRoundedRect(362, 672, 556, 36, 5);

    this.tickerText = this.add
      .text(372, 678, '', {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: '600',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        lineSpacing: 2,
        resolution: TEXT_RES,
      })
      .setDepth(106);
  }

  private refreshTopBanner(): void {
    const isDefense = this.session.mode === 'PLAYER_DEFENSE';
    this.topTitleText.setText(
      isDefense
        ? `🛡 DEFENDING ${this.session.territoryName.toUpperCase()}  •  ${this.session.attackerName.toUpperCase()} BESIEGES THY CASTLE!`
        : `🏰 CATAPULT SIEGE OF ${this.session.territoryName.toUpperCase()}  •  ${this.session.attackerName.toUpperCase()} vs ${this.session.defenderName.toUpperCase()}`
    );

    if (isDefense) {
      this.topSubText.setText(
        `Enemy catapults bombard thy ramparts (${this.session.shotsRemaining} volleys left) — click DEFEND WALLS NOW to sally forth!`
      );
      this.topSubText.setColor(PALETTE_HEX.GOLD_BRIGHT);
      return;
    }

    if (this.session.wallBreached && this.session.shotsRemaining > 0) {
      this.topSubText.setText(
        `💥 WALLS BREACHED! Click STORM THE BREACH! for +20 Momentum & 0% Castle Armor — or fire ${this.session.shotsRemaining} remaining volley(s)!`
      );
      this.topSubText.setColor(PALETTE_HEX.GOLD_BRIGHT);
    } else if (this.session.shotsRemaining <= 0) {
      this.topSubText.setText(
        `All catapult volleys expended! Click LAUNCH ASSAULT to storm ${this.session.territoryName}!`
      );
      this.topSubText.setColor(PALETTE_HEX.GOLD_BRIGHT);
    } else {
      const prof = SIEGE_AMMO_PROFILES[this.session.selectedAmmo];
      this.topSubText.setText(
        `Loaded: ${prof.label} (${prof.aimHint})  •  Watch Tower Pennants for Wind Drift!`
      );
      this.topSubText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    }
  }

  /**
   * Left Panel (x: 12..348, y: 520..708):
   * Attacker & Defender shields/names, Wall Integrity Bar (100% -> 0%), Wind Indicator, Shots Remaining.
   */
  private refreshLeftStatusPanel(): void {
    this.leftStatusContainer.removeAll(true);

    const x = 12;
    const y = 520;
    const w = 336;
    const h = 188;

    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.WOOD_DARK, 0.98);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(2, PALETTE.GOLD_DARK, 1);
    bg.strokeRoundedRect(x, y, w, h, 6);

    // Header bar
    bg.fillStyle(0x16110d, 0.9);
    bg.fillRoundedRect(x + 8, y + 8, w - 16, 44, 4);
    this.leftStatusContainer.add(bg);

    const isSidequest = GameState.getInstance().isSidequestEdition();
    const attShieldKey = SidequestArtGenerator.getShieldKey(
      this,
      this.session.attackerId || 'garrison',
      isSidequest
    );
    const defShieldKey = SidequestArtGenerator.getShieldKey(
      this,
      this.session.defenderId ?? 'garrison',
      isSidequest
    );

    const attShield = this.add
      .image(x + 26, y + 30, attShieldKey)
      .setDisplaySize(24, 30);
    const defShield = this.add
      .image(x + w - 26, y + 30, defShieldKey)
      .setDisplaySize(24, 30);

    const vsTxt = this.add
      .text(
        x + w / 2,
        y + 22,
        `${this.session.attackerName.split(' ')[0]}  ⚔  ${
          this.session.defenderName.split(' ')[0]
        }`,
        {
          fontFamily: FONT_HEADING,
          fontSize: '13px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);

    const shireSub = this.add
      .text(
        x + w / 2,
        y + 40,
        `${this.session.territoryName.toUpperCase()}${
          this.session.isHomeCastle ? ' (HOME STRONGHOLD)' : ''
        }`,
        {
          fontFamily: FONT_BODY,
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: PALETTE_HEX.GOLD_BRIGHT,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.leftStatusContainer.add([attShield, defShield, vsTxt, shireSub]);

    // Wall Integrity Bar (100% -> 0%)
    const castleMult = SiegeEngine.getDynamicCastleMultiplier(
      this.session.wallIntegrity
    );
    const armorBonusPct = Math.round((castleMult - 1) * 100);
    const wallLbl = this.add.text(
      x + 12,
      y + 58,
      this.session.wallBreached
        ? 'WALL INTEGRITY: 0%  •  BREACHED! (0% Armor)'
        : `WALL INTEGRITY: ${this.session.wallIntegrity}%  (+${armorBonusPct}% Armor)`,
      {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: this.session.wallBreached
          ? '#FF6B6B'
          : PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );
    this.leftStatusContainer.add(wallLbl);

    const barG = this.add.graphics();
    const bx = x + 12;
    const by = y + 77;
    const bw = w - 24;
    const bh = 14;
    barG.fillStyle(0x100d0b, 0.95);
    barG.fillRoundedRect(bx, by, bw, bh, 3);

    const fillW = Math.round(bw * (this.session.wallIntegrity / 100));
    if (fillW > 0) {
      const wallCol =
        this.session.wallIntegrity >= 65
          ? PALETTE.FOLIAGE_LIGHT
          : this.session.wallIntegrity >= 30
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.BLOOD_RED;
      barG.fillStyle(wallCol, 1);
      barG.fillRoundedRect(bx, by, fillW, bh, 3);
    }
    barG.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    barG.strokeRoundedRect(bx, by, bw, bh, 3);
    this.leftStatusContainer.add(barG);

    // Wind Indicator Inset
    const windInfo = SiegeEngine.getWindLabel(this.session.wind);
    const windBox = this.add.graphics();
    windBox.fillStyle(0x131722, 0.92);
    windBox.fillRoundedRect(x + 10, y + 99, w - 20, 48, 4);
    windBox.lineStyle(1, PALETTE.SKY_MID, 0.8);
    windBox.strokeRoundedRect(x + 10, y + 99, w - 20, 48, 4);
    this.leftStatusContainer.add(windBox);

    const arrowGlyph =
      this.session.wind > 0
        ? '💨 ►►►'
        : this.session.wind < 0
        ? '◄◄◄ 💨'
        : '• CALM •';
    const windColor =
      this.session.wind > 0
        ? PALETTE_HEX.FOLIAGE_LIGHT
        : this.session.wind < 0
        ? '#FF9E64'
        : PALETTE_HEX.SKY_LIGHT;

    const windTitle = this.add.text(
      x + 18,
      y + 105,
      `${arrowGlyph}   ${windInfo.title}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: windColor,
        resolution: TEXT_RES,
      }
    );
    const windHint = this.add.text(x + 18, y + 124, windInfo.hint, {
      fontFamily: FONT_BODY,
      fontSize: '11px',
      color: PALETTE_HEX.PARCHMENT_DARK,
      resolution: TEXT_RES,
    });
    this.leftStatusContainer.add([windTitle, windHint]);

    // Volleys Remaining & Attacker Siege Train
    const shotsTxt = this.add.text(
      x + 12,
      y + 158,
      `VOLLEYS: ${this.session.shotsRemaining} / ${this.session.maxVolleys}`,
      {
        fontFamily: FONT_HEADING,
        fontSize: '13.5px',
        fontStyle: 'bold',
        color:
          this.session.shotsRemaining > 0
            ? PALETTE_HEX.GOLD_BRIGHT
            : PALETTE_HEX.STONE_LIGHT,
        resolution: TEXT_RES,
      }
    );

    const attArmy = this.session.attackerArmy;
    const trainTxt = this.add
      .text(
        x + w - 12,
        y + 160,
        `Host: ${attArmy.soldiers}S • ${attArmy.knights}K • ${attArmy.catapults}C`,
        {
          fontFamily: FONT_BODY,
          fontSize: '11.5px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(1, 0);

    this.leftStatusContainer.add([shotsTxt, trainTxt]);
  }

  /**
   * Center Controls (x: 358..922, y: 520..668):
   * 3 Ammo Selection Buttons + Calibrated Winch Power Gauge + Hold-to-Winch / Fire Buttons.
   */
  private refreshCenterControls(): void {
    this.centerControlsContainer.removeAll(true);
    this.fireBtnLabelText = undefined;

    const isInteractive =
      this.session.mode === 'PLAYER_ATTACK' &&
      this.session.shotsRemaining > 0 &&
      !this.isFiringAnimation &&
      !this.isTransitioning;

    // 1. Three Ammo Selection Buttons ([1] BOULDER, [2] GREEK FIRE, [3] DISEASE)
    const ammoSubtitles: Record<SiegeAmmoType, string> = {
      BOULDER: 'Aim: WALL (30-45 Dmg)',
      GREEK_FIRE: 'Aim: KEEP (Burns 15-25%)',
      DISEASE: 'Aim: KEEP (Plague -2 LDR)',
    };

    ALL_SIEGE_AMMO.forEach((ammo, idx) => {
      const prof = SIEGE_AMMO_PROFILES[ammo];
      const bx = 362 + idx * 188;
      const by = 520;
      const bw = 180;
      const bh = 54;
      const isSelected = this.session.selectedAmmo === ammo;

      const g = this.add.graphics();
      const drawAmmoBtn = (hover: boolean) => {
        g.clear();
        g.fillStyle(
          isSelected
            ? PALETTE.BLOOD_RED
            : hover && isInteractive
            ? PALETTE.WOOD_MID
            : PALETTE.WOOD_DARK,
          1
        );
        g.fillRoundedRect(bx, by, bw, bh, 5);
        g.lineStyle(
          isSelected ? 2.5 : 1.5,
          isSelected || hover ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK,
          1
        );
        g.strokeRoundedRect(bx, by, bw, bh, 5);
      };
      drawAmmoBtn(false);
      this.centerControlsContainer.add(g);

      const icon = this.add
        .image(bx + 24, by + 27, this.getProjectileTextureKey(ammo))
        .setScale(1.15);

      const title = this.add.text(
        bx + 44,
        by + 9,
        `[${prof.hotkey}] ${prof.shortLabel}`,
        {
          fontFamily: FONT_HEADING,
          fontSize: '12.5px',
          fontStyle: 'bold',
          color: isSelected
            ? PALETTE_HEX.GOLD_BRIGHT
            : PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: TEXT_RES,
        }
      );

      const sub = this.add.text(bx + 44, by + 30, ammoSubtitles[ammo], {
        fontFamily: FONT_BODY,
        fontSize: '10.5px',
        fontStyle: '600',
        color: isSelected ? '#FFFFFF' : PALETTE_HEX.PARCHMENT_DARK,
        resolution: TEXT_RES,
      });

      this.centerControlsContainer.add([icon, title, sub]);

      const zone = this.add
        .zone(bx + bw / 2, by + bh / 2, bw, bh)
        .setInteractive({ useHandCursor: isInteractive });
      zone.on('pointerover', () => {
        drawAmmoBtn(true);
        this.hoveredTip = prof.description;
        this.refreshTicker();
      });
      zone.on('pointerout', () => {
        drawAmmoBtn(false);
        this.hoveredTip = null;
        this.refreshTicker();
      });
      zone.on('pointerdown', () => {
        if (isInteractive) this.handleSelectAmmo(ammo);
      });
      this.centerControlsContainer.add(zone);
    });

    // 2. Precision Power Adjustment Buttons flanking the Winch Gauge (-5, -1 | Gauge | +1, +5)
    const adjustDefs: Array<{ lbl: string; x: number; delta: number }> = [
      { lbl: '-5', x: 362, delta: -5 },
      { lbl: '-1', x: 398, delta: -1 },
      { lbl: '+1', x: 848, delta: 1 },
      { lbl: '+5', x: 884, delta: 5 },
    ];

    for (const adj of adjustDefs) {
      this.addSmallDeckButton(
        this.centerControlsContainer,
        adj.x,
        596,
        34,
        26,
        adj.lbl,
        isInteractive,
        () => {
          this.aimPower = Phaser.Math.Clamp(Math.round(this.aimPower + adj.delta), 0, 100);
          this.updateCatapultRigVisuals();
          this.refreshPowerGaugeGraphics();
        }
      );
    }

    // 3. Dual Firing Controls Row (y: 628..666)
    // A) Hold-to-Winch & Release Button (Left, x: 362, w: 356, h: 38)
    const winchX = 362;
    const winchY = 628;
    const winchW = 356;
    const winchH = 38;

    const winchG = this.add.graphics();
    const drawWinchBtn = (hover: boolean, activeHold: boolean) => {
      winchG.clear();
      winchG.fillStyle(
        !isInteractive
          ? PALETTE.STONE_DARK
          : activeHold
          ? PALETTE.BLOOD_RED
          : hover
          ? PALETTE.WOOD_MID
          : PALETTE.WOOD_DARK,
        1
      );
      winchG.fillRoundedRect(winchX, winchY, winchW, winchH, 5);
      winchG.lineStyle(
        activeHold || hover ? 2.5 : 1.5,
        !isInteractive
          ? PALETTE.STONE_MID
          : activeHold || hover
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.GOLD_DARK,
        1
      );
      winchG.strokeRoundedRect(winchX, winchY, winchW, winchH, 5);
    };
    drawWinchBtn(false, this.isChargingWinch);
    this.centerControlsContainer.add(winchG);

    const winchLabel =
      this.session.mode === 'PLAYER_DEFENSE'
        ? '⚔ ENEMY SIEGE ENGINES FIRING…'
        : this.session.shotsRemaining <= 0
        ? 'ALL CATAPULT VOLLEYS EXPENDED'
        : '⚙ HOLD TO PULL WINCH & RELEASE [SPACE]';

    const winchTxt = this.add
      .text(winchX + winchW / 2, winchY + winchH / 2, winchLabel, {
        fontFamily: FONT_BODY,
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: isInteractive
          ? PALETTE_HEX.GOLD_BRIGHT
          : PALETTE_HEX.STONE_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.centerControlsContainer.add(winchTxt);

    if (isInteractive) {
      const winchZone = this.add
        .zone(winchX + winchW / 2, winchY + winchH / 2, winchW, winchH)
        .setInteractive({ useHandCursor: true });
      winchZone.on('pointerover', () => {
        drawWinchBtn(true, this.isChargingWinch);
        this.hoveredTip =
          'Hold Left-Click (or SPACE) to pull back the catapult winch, then release inside the highlighted target bracket to launch!';
        this.refreshTicker();
      });
      winchZone.on('pointerout', () => {
        drawWinchBtn(false, this.isChargingWinch);
        this.hoveredTip = null;
        this.refreshTicker();
      });
      winchZone.on('pointerdown', () => {
        if (!isInteractive) return;
        this.aimPower = 8;
        this.chargeDirection = 1;
        this.isChargingWinch = true;
        drawWinchBtn(true, true);
      });
      this.centerControlsContainer.add(winchZone);
    }

    // B) Precision Instant Fire Button (Right, x: 726, w: 192, h: 38)
    const fireX = 726;
    const fireY = 628;
    const fireW = 192;
    const fireH = 38;

    const fireG = this.add.graphics();
    const drawFireBtn = (hover: boolean) => {
      fireG.clear();
      fireG.fillStyle(
        !isInteractive
          ? PALETTE.STONE_DARK
          : hover
          ? 0xc42828
          : PALETTE.BLOOD_RED,
        1
      );
      fireG.fillRoundedRect(fireX, fireY, fireW, fireH, 5);
      fireG.lineStyle(
        hover ? 2.5 : 1.8,
        isInteractive ? PALETTE.GOLD_BRIGHT : PALETTE.STONE_MID,
        1
      );
      fireG.strokeRoundedRect(fireX, fireY, fireW, fireH, 5);
    };
    drawFireBtn(false);
    this.centerControlsContainer.add(fireG);

    this.fireBtnLabelText = this.add
      .text(
        fireX + fireW / 2,
        fireY + fireH / 2,
        `🔥 FIRE (${Math.round(this.aimPower)}%)`,
        {
          fontFamily: FONT_HEADING,
          fontSize: '13px',
          fontStyle: 'bold',
          color: isInteractive
            ? PALETTE_HEX.GOLD_BRIGHT
            : PALETTE_HEX.STONE_LIGHT,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.centerControlsContainer.add(this.fireBtnLabelText);

    if (isInteractive) {
      const fireZone = this.add
        .zone(fireX + fireW / 2, fireY + fireH / 2, fireW, fireH)
        .setInteractive({ useHandCursor: true });
      fireZone.on('pointerover', () => {
        drawFireBtn(true);
        this.hoveredTip =
          'Launch catapult immediately at the dialed Winch Power % (or press ENTER). Click anywhere on the gauge bar to set exact power!';
        this.refreshTicker();
      });
      fireZone.on('pointerout', () => {
        drawFireBtn(false);
        this.hoveredTip = null;
        this.refreshTicker();
      });
      fireZone.on('pointerdown', () => {
        if (isInteractive) {
          this.executeCatapultLaunch(this.aimPower);
        }
      });
      this.centerControlsContainer.add(fireZone);
    }
  }

  /**
   * Renders the calibrated Winch Power Gauge (0%..100%) with wind-shifted WALL & COURTYARD
   * target brackets and the previous shot's calibration marker!
   */
  private refreshPowerGaugeGraphics(): void {
    const g = this.powerGaugeGraphics;
    g.clear();

    const gx = 438;
    const gy = 600;
    const gw = 404;
    const gh = 18;

    // Track background
    g.fillStyle(0x0f1118, 0.96);
    g.fillRoundedRect(gx, gy, gw, gh, 4);

    // Wind-compensated target brackets for WALL_HIT and OVER_WALL_COURTYARD
    const wallWin = SiegeEngine.getPowerWindowForZone('WALL_HIT', this.session.wind);
    const keepWin = SiegeEngine.getPowerWindowForZone(
      'OVER_WALL_COURTYARD',
      this.session.wind
    );
    const sweetspot = SIEGE_AMMO_PROFILES[this.session.selectedAmmo].sweetspot;

    // Draw WALL_HIT bracket
    const wallStartX = gx + (wallWin.minPower / 100) * gw;
    const wallW = Math.max(4, ((wallWin.maxPower - wallWin.minPower) / 100) * gw);
    g.fillStyle(
      PALETTE.GOLD_DARK,
      sweetspot === 'WALL_HIT' ? 0.48 : 0.2
    );
    g.fillRect(wallStartX, gy + 1, wallW, gh - 2);
    if (sweetspot === 'WALL_HIT') {
      g.lineStyle(1.5, PALETTE.GOLD_BRIGHT, 0.95);
      g.strokeRect(wallStartX, gy, wallW, gh);
    }

    // Draw OVER_WALL_COURTYARD bracket
    const keepStartX = gx + (keepWin.minPower / 100) * gw;
    const keepW = Math.max(4, ((keepWin.maxPower - keepWin.minPower) / 100) * gw);
    const keepTint =
      this.session.selectedAmmo === 'DISEASE' ? 0x6ac42f : 0xe06d24;
    g.fillStyle(
      keepTint,
      sweetspot === 'OVER_WALL_COURTYARD' ? 0.52 : 0.22
    );
    g.fillRect(keepStartX, gy + 1, keepW, gh - 2);
    if (sweetspot === 'OVER_WALL_COURTYARD') {
      g.lineStyle(1.5, 0xffb347, 0.95);
      g.strokeRect(keepStartX, gy, keepW, gh);
    }

    // Current Power Bar Fill & Needle
    const clampedP = Phaser.Math.Clamp(this.aimPower, 0, 100);
    const needleX = gx + (clampedP / 100) * gw;

    g.fillStyle(
      this.isChargingWinch ? PALETTE.BLOOD_RED : PALETTE.ROYAL_BLUE,
      0.68
    );
    g.fillRoundedRect(gx, gy + 3, Math.max(3, needleX - gx), gh - 6, 2);

    // Outer frame
    g.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    g.strokeRoundedRect(gx, gy, gw, gh, 4);

    // Previous Volley Calibration Marker (▼ LAST)
    if (this.session.lastPower !== null) {
      const lastX = gx + (this.session.lastPower / 100) * gw;
      g.lineStyle(2, PALETTE.SKY_LIGHT, 0.95);
      g.lineBetween(lastX, gy - 3, lastX, gy + gh + 3);
      g.fillStyle(PALETTE.SKY_LIGHT, 1);
      g.fillTriangle(lastX, gy, lastX - 4, gy - 5, lastX + 4, gy - 5);
    }

    // Bright Gold Current Aim Needle
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillRect(needleX - 2, gy - 3, 4, gh + 6);

    const roundedPower = Math.round(clampedP);
    const targetWin = sweetspot === 'WALL_HIT' ? wallWin : keepWin;
    const zoneTag = sweetspot === 'WALL_HIT' ? 'WALL TARGET' : 'COURTYARD TARGET';
    const lastStr =
      this.session.lastPower !== null ? `  •  ▼ Last: ${this.session.lastPower}%` : '';

    this.powerReadoutText.setText(
      `WINCH POWER: ${roundedPower}%   •   ${zoneTag}: ${targetWin.minPower}%–${targetWin.maxPower}%${lastStr}`
    );

    if (this.fireBtnLabelText && this.fireBtnLabelText.active) {
      this.fireBtnLabelText.setText(`🔥 FIRE (${roundedPower}%)`);
    }
  }

  /**
   * Right Panel (x: 932..1268, y: 520..708):
   * Live Defender Garrison counts, Active Status Pills ([ON FIRE], [PLAGUE], [WALL BREACHED]),
   * plus STORM CASTLE NOW / STORM THE BREACH and ABANDON SIEGE buttons!
   */
  private refreshRightGarrisonPanel(lastReport?: SiegeVolleyReport): void {
    this.rightGarrisonContainer.removeAll(true);

    const x = 932;
    const y = 520;
    const w = 336;
    const h = 188;

    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.WOOD_DARK, 0.98);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(2, PALETTE.GOLD_DARK, 1);
    bg.strokeRoundedRect(x, y, w, h, 6);

    bg.fillStyle(0x16110d, 0.92);
    bg.fillRoundedRect(x + 8, y + 32, w - 16, 48, 4);
    this.rightGarrisonContainer.add(bg);

    const hdr = this.add
      .text(x + w / 2, y + 17, '🛡  DEFENDER GARRISON & ASSAULT', {
        fontFamily: FONT_HEADING,
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.rightGarrisonContainer.add(hdr);

    const defTotal = SiegeEngine.getDefenderTotalArmy(this.session);
    const defSpriteTheme =
      this.session.defenderFaction === 'norman' ? 'norman' : 'saxon';

    const sIcon = this.add
      .image(x + 36, y + 56, `unit_soldier_${defSpriteTheme}_0`)
      .setScale(0.95);
    this.defSoldiersText = this.add.text(
      x + 56,
      y + 44,
      `${defTotal.soldiers} Soldiers`,
      {
        fontFamily: FONT_HEADING,
        fontSize: '14.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );

    const kIcon = this.add
      .image(x + 190, y + 56, `unit_knight_${defSpriteTheme}_0`)
      .setScale(0.9);
    this.defKnightsText = this.add.text(
      x + 214,
      y + 44,
      `${defTotal.knights} Knights`,
      {
        fontFamily: FONT_HEADING,
        fontSize: '14.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );

    this.rightGarrisonContainer.add([
      sIcon,
      this.defSoldiersText,
      kIcon,
      this.defKnightsText,
    ]);

    if (lastReport) {
      if (
        lastReport.totalDefenderLosses.soldiers > 0 &&
        this.defSoldiersText.active
      ) {
        this.defSoldiersText.setColor('#FF6B6B');
        this.tweens.add({
          targets: this.defSoldiersText,
          scale: 1.16,
          duration: 130,
          yoyo: true,
          onComplete: () => {
            if (this.defSoldiersText?.active) {
              this.defSoldiersText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
            }
          },
        });
      }
      if (
        lastReport.totalDefenderLosses.knights > 0 &&
        this.defKnightsText.active
      ) {
        this.defKnightsText.setColor('#FF6B6B');
        this.tweens.add({
          targets: this.defKnightsText,
          scale: 1.16,
          duration: 130,
          yoyo: true,
          onComplete: () => {
            if (this.defKnightsText?.active) {
              this.defKnightsText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
            }
          },
        });
      }
    }

    // Active Status Effect Badges ([ON FIRE], [PLAGUE], [WALL BREACHED])
    const badges: Array<{ text: string; bg: string; fg: string }> = [];
    if (this.session.wallBreached) {
      badges.push({ text: '💥 WALL BREACHED', bg: '#7A1616', fg: '#FFD56B' });
    }
    if (this.session.isOnFire) {
      badges.push({ text: '🔥 ON FIRE', bg: '#6E2A0E', fg: '#FFA64D' });
    }
    if (this.session.isPlagueInfected) {
      badges.push({ text: '☠ PLAGUE (-2 LDR)', bg: '#224214', fg: '#A6FF4D' });
    }
    if (badges.length === 0) {
      badges.push({
        text: '🏰 WALLS STANDING',
        bg: '#1A1D26',
        fg: PALETTE_HEX.STONE_LIGHT,
      });
    }

    let badgeX = x + 10;
    for (const b of badges) {
      const pill = this.add.text(badgeX, y + 86, b.text, {
        fontFamily: FONT_BODY,
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: b.fg,
        backgroundColor: b.bg,
        padding: { x: 6, y: 3 },
        resolution: TEXT_RES,
      });
      this.rightGarrisonContainer.add(pill);
      badgeX += pill.width + 6;
    }

    // Action Buttons
    const canAct = !this.isFiringAnimation && !this.isTransitioning;

    if (this.session.mode === 'PLAYER_DEFENSE') {
      this.addActionButton(
        this.rightGarrisonContainer,
        x + 12,
        y + 118,
        w - 24,
        56,
        '⚔  DEFEND THE RAMPARTS NOW  →',
        canAct,
        true,
        () => {
          SiegeEngine.resolveRemainingAiVolleys(this.session);
          this.transitionToFieldBattle();
        }
      );
      return;
    }

    const stormHighlight =
      this.session.wallBreached || this.session.shotsRemaining <= 0;
    const stormLabel = this.session.wallBreached
      ? '💥  STORM THE BREACH!  →'
      : this.session.shotsRemaining <= 0
      ? '⚔  LAUNCH ASSAULT!  →'
      : '⚔  STORM CASTLE NOW  →';

    this.addActionButton(
      this.rightGarrisonContainer,
      x + 12,
      y + 114,
      w - 24,
      38,
      stormLabel,
      canAct,
      stormHighlight,
      () => this.transitionToFieldBattle()
    );

    this.addActionButton(
      this.rightGarrisonContainer,
      x + 12,
      y + 156,
      w - 24,
      26,
      '🏳  ABANDON SIEGE (RETREAT -15%)',
      canAct,
      false,
      () => this.handleAbandonSiege()
    );
  }

  private addSmallDeckButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void
  ): void {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(
        !enabled
          ? PALETTE.STONE_DARK
          : hover
          ? PALETTE.BLOOD_RED
          : PALETTE.WOOD_DARK,
        1
      );
      g.fillRoundedRect(x, y, w, h, 4);
      g.lineStyle(
        1.5,
        !enabled
          ? PALETTE.STONE_MID
          : hover
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.GOLD_DARK,
        1
      );
      g.strokeRoundedRect(x, y, w, h, 4);
    };
    draw(false);
    container.add(g);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: enabled ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.STONE_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    container.add(txt);

    if (enabled) {
      const zone = this.add
        .zone(x + w / 2, y + h / 2, w, h)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', onClick);
      container.add(zone);
    }
  }

  private addActionButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    isAccent: boolean,
    onClick: () => void
  ): void {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(
        !enabled
          ? PALETTE.STONE_DARK
          : isAccent
          ? hover
            ? 0xc82828
            : PALETTE.BLOOD_RED
          : hover
          ? PALETTE.WOOD_MID
          : 0x2a1b12,
        1
      );
      g.fillRoundedRect(x, y, w, h, 5);
      g.lineStyle(
        isAccent || hover ? 2.2 : 1.4,
        !enabled
          ? PALETTE.STONE_MID
          : isAccent || hover
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.GOLD_DARK,
        1
      );
      g.strokeRoundedRect(x, y, w, h, 5);
    };
    draw(false);
    container.add(g);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: isAccent ? FONT_HEADING : FONT_BODY,
        fontSize: isAccent ? '13px' : '11px',
        fontStyle: 'bold',
        color: !enabled
          ? PALETTE_HEX.STONE_LIGHT
          : isAccent
          ? PALETTE_HEX.GOLD_BRIGHT
          : PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    container.add(txt);

    if (enabled) {
      const zone = this.add
        .zone(x + w / 2, y + h / 2, w, h)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        draw(true);
        txt.setColor(PALETTE_HEX.GOLD_BRIGHT);
      });
      zone.on('pointerout', () => {
        draw(false);
        txt.setColor(
          isAccent ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.PARCHMENT_LIGHT
        );
      });
      zone.on('pointerdown', onClick);
      container.add(zone);
    }
  }

  private refreshTicker(): void {
    if (this.hoveredTip) {
      const clipped =
        this.hoveredTip.length > 94
          ? this.hoveredTip.slice(0, 93) + '…'
          : this.hoveredTip;
      this.tickerText.setText(`▸ ${clipped}`);
      this.tickerText.setColor(PALETTE_HEX.GOLD_BRIGHT);
      return;
    }

    const recent = this.session.siegeLog.slice(-2).map((line) => {
      const clean = line.length > 88 ? line.slice(0, 87) + '…' : line;
      return `• ${clean}`;
    });
    this.tickerText.setText(recent.join('\n'));
    this.tickerText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
  }

  // ============================================================================
  // INPUTS & SCENE TRANSITIONS (SIEGE -> BATTLE / RETREAT -> MAP)
  // ============================================================================

  private handleSelectAmmo(ammo: SiegeAmmoType): void {
    if (
      this.session.mode !== 'PLAYER_ATTACK' ||
      this.isFiringAnimation ||
      this.session.shotsRemaining <= 0
    ) {
      return;
    }
    SiegeEngine.selectAmmo(this.session, ammo);
    this.updateCatapultRigVisuals();
    this.refreshTopBanner();
    this.refreshCenterControls();
    this.refreshPowerGaugeGraphics();
    this.refreshTicker();
  }

  private setupInputs(): void {
    // Release pointer anywhere on screen fires if currently holding the winch button!
    this.input.on('pointerup', () => {
      if (this.isChargingWinch) {
        this.isChargingWinch = false;
        this.executeCatapultLaunch(this.aimPower);
      }
    });

    if (!this.input.keyboard) return;

    this.input.keyboard.on('keydown-ONE', () => this.handleSelectAmmo('BOULDER'));
    this.input.keyboard.on('keydown-TWO', () => this.handleSelectAmmo('GREEK_FIRE'));
    this.input.keyboard.on('keydown-THREE', () => this.handleSelectAmmo('DISEASE'));

    this.input.keyboard.on('keydown-LEFT', () => {
      if (
        this.session.mode === 'PLAYER_ATTACK' &&
        !this.isFiringAnimation &&
        this.session.shotsRemaining > 0
      ) {
        this.aimPower = Phaser.Math.Clamp(this.aimPower - 2, 0, 100);
        this.updateCatapultRigVisuals();
        this.refreshPowerGaugeGraphics();
      }
    });

    this.input.keyboard.on('keydown-RIGHT', () => {
      if (
        this.session.mode === 'PLAYER_ATTACK' &&
        !this.isFiringAnimation &&
        this.session.shotsRemaining > 0
      ) {
        this.aimPower = Phaser.Math.Clamp(this.aimPower + 2, 0, 100);
        this.updateCatapultRigVisuals();
        this.refreshPowerGaugeGraphics();
      }
    });

    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.isFiringAnimation || this.isTransitioning) return;

      if (this.session.mode === 'PLAYER_DEFENSE') {
        SiegeEngine.resolveRemainingAiVolleys(this.session);
        this.transitionToFieldBattle();
        return;
      }

      if (this.session.shotsRemaining <= 0) {
        this.transitionToFieldBattle();
        return;
      }

      if (!this.isChargingWinch) {
        this.aimPower = 8;
        this.chargeDirection = 1;
        this.isChargingWinch = true;
      }
    });

    this.input.keyboard.on('keyup-SPACE', () => {
      if (this.isChargingWinch) {
        this.isChargingWinch = false;
        this.executeCatapultLaunch(this.aimPower);
      }
    });

    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.isFiringAnimation || this.isTransitioning) return;
      if (this.session.mode === 'PLAYER_ATTACK' && this.session.shotsRemaining > 0) {
        this.executeCatapultLaunch(this.aimPower);
      } else {
        this.transitionToFieldBattle();
      }
    });
  }

  private transitionToFieldBattle(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.isChargingWinch = false;

    const postSiegeContext = SiegeEngine.buildPostSiegeBattleContext(this.session);
    GameState.getInstance().setPhase('BATTLE');

    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('BattleScene', {
        battleContext: postSiegeContext,
        resumeAiQueue: this.resumeAiQueue,
      });
    });
  }

  private handleAbandonSiege(): void {
    if (this.isTransitioning || this.isFiringAnimation) return;
    this.isTransitioning = true;
    this.isChargingWinch = false;

    const result = SiegeEngine.abandonSiege(this.session);

    this.cameras.main.fadeOut(220, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene', {
        resumeAiQueue: this.resumeAiQueue,
        lastBattleMessage: `${result.message} (-${this.session.retreatPenaltyLosses.soldiers}S, -${this.session.retreatPenaltyLosses.knights}K retreat losses)`,
        lastBattleAlert: true,
        focusTerritoryId: this.session.originTerritoryId,
      });
    });
  }

  /**
   * Sidequest Labs Dynamic Siege Weather Atmosphere:
   * Wind-slanted rain streaks & wind-blown grass/dust particles synchronized with `session.wind`!
   */
  private updateSidequestSiegeWeather(delta: number): void {
    if (!this.sidequestWeatherGraphics) return;
    const dt = delta / 1000;
    const g = this.sidequestWeatherGraphics;
    g.clear();

    const wind = this.session.wind;
    const vxBase = (wind === 0 ? 12 : wind * 26);

    for (const p of this.siegeWindParticles) {
      if (p.isGrass) {
        // Wind-blown grass blades & meadow dust across the siege valley
        p.x += vxBase * 1.15 * p.speedMult * dt;
        p.y += Math.sin(this.envTimer * 2.2 + p.x * 0.03) * 14 * dt;
        if (p.x > 1272) p.x = 10;
        if (p.x < 8) p.x = 1270;
        if (p.y < 305) p.y = 485;
        if (p.y > 495) p.y = 315;

        g.fillStyle(SIDEQUEST_PALETTE.SPRING_MEADOW_BRIGHT, 0.72);
        g.fillRect(p.x, p.y, 4, 2);
      } else {
        // Slanted atmospheric rain / wind streaks matching catapult wind drift
        const vx = vxBase * 1.4 * p.speedMult;
        const vy = 220 * p.speedMult;
        p.x += vx * dt;
        p.y += vy * dt;
        if (p.y > 502) {
          p.y = 8;
          p.x = Math.random() * 1268;
        }
        if (p.x > 1274) p.x = 8;
        if (p.x < 8) p.x = 1272;

        g.lineStyle(1, 0xcbe4f5, 0.28);
        g.lineBetween(p.x, p.y, p.x + vx * 0.035, p.y + 11);
      }
    }
  }
}
