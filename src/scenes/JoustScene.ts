import Phaser from 'phaser';
import {
  JoustEngine,
  JoustPassResult,
  PendingJoustContext,
  JoustOutcomeSummary,
  Point2D,
} from '../core/JoustEngine';
import { GameState } from '../core/GameState';
import { Lord, getCinemawareStatRating } from '../core/types';
import { PALETTE, PALETTE_HEX, SIDEQUEST_PALETTE } from '../data/palette';
import { AudioManager } from '../utils/AudioManager';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';

export interface JoustSceneData {
  joustContext?: PendingJoustContext;
}

const FONT_HEADING = 'Cinzel, Georgia, serif';
const FONT_BODY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
const TEXT_RES = 2;

export class JoustScene extends Phaser.Scene {
  private context!: PendingJoustContext;
  private challenger!: Lord;
  private rival!: Lord;

  // Charge and Motion State
  private isCharging = false;
  private isImpactResolved = false;
  private isModalOpen = false;
  private isLeaving = false;

  private chargeDurationMs = 3000;
  private chargeElapsedMs = 0;
  private hoofbeatTimerMs = 0;
  private hoofbeatIntervalMs = 340;

  // Lance Aiming and Steering
  // In target coordinates: center boss sweetspot is (100, 100), foul zone is y > 190
  private aimTargetX = 100;
  private aimTargetY = 100;
  private reticleX = 100;
  private reticleY = 100;

  // Keys
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Arena GameObjects
  private arenaContainer!: Phaser.GameObjects.Container;
  private rivalChargerSprite!: Phaser.GameObjects.Image;
  private playerHorseNeckSprite!: Phaser.GameObjects.Image;
  private playerLanceSprite!: Phaser.GameObjects.Image;
  private targetShieldOverlay!: Phaser.GameObjects.Image;
  private reticleSprite!: Phaser.GameObjects.Image;
  private foulWarningBanner!: Phaser.GameObjects.Container;
  private foulWarningText!: Phaser.GameObjects.Text;
  private passOutcomeBannerContainer!: Phaser.GameObjects.Container;
  private passOutcomeTitleText!: Phaser.GameObjects.Text;
  private passOutcomeSubText!: Phaser.GameObjects.Text;
  private splinterParticlesContainer!: Phaser.GameObjects.Container;
  private unhorseTumbleSprite?: Phaser.GameObjects.Image;

  // Sidequest Labs Edition Atmospheric & Tournament Visual State
  private isSidequest = false;
  private sidequestPennantsGraphics?: Phaser.GameObjects.Graphics;
  private sidequestTurfContainer?: Phaser.GameObjects.Container;
  private turfClodTimerMs = 0;

  // Bottom Command Deck HUD Elements
  private deckContainer!: Phaser.GameObjects.Container;
  private challengerScoreText!: Phaser.GameObjects.Text;
  private rivalScoreText!: Phaser.GameObjects.Text;
  private passTrackerText!: Phaser.GameObjects.Text;
  private stakesReadoutText!: Phaser.GameObjects.Text;
  private audioStatusText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'JoustScene' });
  }

  create(data?: JoustSceneData): void {
    PixelArtGenerator.generateAll(this);
    const gameState = GameState.getInstance();
    this.isSidequest = gameState.isSidequestEdition();
    if (this.isSidequest) {
      SidequestArtGenerator.generateAll(this);
    }

    if (data?.joustContext) {
      this.context = data.joustContext;
    } else {
      // Fallback context: Player vs Brian de Bois-Guilbert for Fame
      const state = gameState.getState();
      const player = gameState.getPlayerLord();
      const rivalId = state.activeLords['boisguilbert']?.isActive
        ? 'boisguilbert'
        : Object.keys(state.activeLords).find((id) => id !== player.id && state.activeLords[id].isActive) || 'boisguilbert';

      this.context = {
        challengerId: player.id,
        opponentId: rivalId,
        stakesType: 'FAME',
        challengerLordId: player.id,
        rivalLordId: rivalId,
        stakes: 'FAME',
        passesCompleted: 0,
        maxPasses: 3,
        challengerScore: 0,
        rivalScore: 0,
        challengerBrokenLances: 0,
        rivalBrokenLances: 0,
        matchStatus: 'IN_PROGRESS',
        history: [],
      };
    }

    const state = gameState.getState();
    const chalId = this.context.challengerLordId || this.context.challengerId || 'ivanhoe';
    const rivId = this.context.rivalLordId || this.context.opponentId || 'boisguilbert';
    this.challenger = state.activeLords[chalId] ?? gameState.getPlayerLord();
    this.rival = state.activeLords[rivId] ?? Object.values(state.activeLords).find(l => !l.isPlayer) ?? state.activeLords['boisguilbert'];

    this.isCharging = false;
    this.isImpactResolved = false;
    this.isModalOpen = false;
    this.isLeaving = false;
    this.chargeElapsedMs = 0;
    this.hoofbeatTimerMs = 0;
    this.hoofbeatIntervalMs = 340;

    // Center aim initially
    this.aimTargetX = 100;
    this.aimTargetY = 100;
    this.reticleX = 100;
    this.reticleY = 100;

    // Keyboard Setup
    if (this.input.keyboard) {
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.cursors = this.input.keyboard.createCursorKeys();

      this.input.keyboard.on('keydown-SPACE', () => {
        if (!this.isModalOpen && this.isCharging && !this.isImpactResolved) {
          this.triggerAutoJoustPass();
        }
      });

      this.input.keyboard.on('keydown-M', () => {
        this.toggleAudio();
      });
    }

    // Pointer Input for Mouse Aiming inside Arena (x: 0..1280, y: 0..510)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y <= 510 && this.isCharging && !this.isImpactResolved) {
        // Map pointer from screen arena area (around x: 500..800, y: 180..440) to target plane (0..200, 0..240)
        const normalizedX = ((pointer.x - 500) / 300) * 200;
        const normalizedY = ((pointer.y - 180) / 260) * 240;
        this.aimTargetX = Phaser.Math.Clamp(normalizedX, 10, 190);
        this.aimTargetY = Phaser.Math.Clamp(normalizedY, 10, 230);
      }
    });

    // 1. Build Visual Layers
    this.createArenaView();
    this.createCommandDeck();
    this.createOutcomeBanners();

    // 2. Play opening heraldic fanfare and start Pass 1
    AudioManager.getInstance().playFanfare();
    this.time.delayedCall(700, () => {
      this.startCharge();
    });
  }

  /**
   * Builds the top 1280x510 Widescreen Tournament Arena View.
   */
  private createArenaView(): void {
    this.arenaContainer = this.add.container(0, 0);

    // 1. Full Arena Backdrop
    const backdropKey = this.isSidequest ? 'sq_joust_arena_backdrop' : 'joust_arena_backdrop';
    const backdrop = this.add.image(0, 0, backdropKey).setOrigin(0, 0);
    this.arenaContainer.add(backdrop);

    if (this.isSidequest) {
      this.sidequestPennantsGraphics = this.add.graphics();
      this.arenaContainer.add(this.sidequestPennantsGraphics);
      this.sidequestTurfContainer = this.add.container(0, 0);
      this.arenaContainer.add(this.sidequestTurfContainer);
      this.turfClodTimerMs = 0;
    }

    // 2. Splinter particle container (depth 12)
    this.splinterParticlesContainer = this.add.container(0, 0);
    this.arenaContainer.add(this.splinterParticlesContainer);

    // 3. Oncoming Rival Charger Sprite (starts distant, approaches along tilt rail)
    // Starting perspective: (x: 652, y: 216, scale: 0.22)
    const rivalChargerKey = this.isSidequest ? 'sq_joust_rival_charger' : 'joust_rival_charger';
    this.rivalChargerSprite = this.add
      .image(652, 216, rivalChargerKey)
      .setOrigin(0.5, 0.75)
      .setScale(0.22);
    this.arenaContainer.add(this.rivalChargerSprite);

    // 4. Target Shield Overlay (Close-range precision impact target)
    // Positioned over rival's chest during the final approach (progress >= 0.70)
    this.targetShieldOverlay = this.add
      .image(640, 260, 'joust_shield_overlay')
      .setOrigin(0.5, 0.45)
      .setScale(0.5)
      .setAlpha(0);
    this.arenaContainer.add(this.targetShieldOverlay);

    // 5. Player's Warhorse Neck & Bridle (Foreground lower-left)
    const horseNeckKey = this.isSidequest ? 'sq_joust_horse_neck' : 'joust_horse_neck';
    this.playerHorseNeckSprite = this.add
      .image(175, 435, horseNeckKey)
      .setOrigin(0.5, 0.8)
      .setScale(1.6);
    this.arenaContainer.add(this.playerHorseNeckSprite);

    // 6. Player's Couched Tournament Lance (Foreground lower-right pointing inward)
    const lanceKey = this.isSidequest ? 'sq_joust_player_lance' : 'joust_player_lance';
    this.playerLanceSprite = this.add
      .image(740, 480, lanceKey)
      .setOrigin(0.85, 0.85)
      .setScale(1.5);
    this.arenaContainer.add(this.playerLanceSprite);

    // 7. Reticle Crosshair
    this.reticleSprite = this.add
      .image(640, 260, 'joust_target_reticle')
      .setOrigin(0.5, 0.5)
      .setScale(1.1)
      .setAlpha(0);
    this.arenaContainer.add(this.reticleSprite);
  }

  /**
   * Builds the 1280x210 Bottom Command Deck (y: 510..720).
   */
  private createCommandDeck(): void {
    this.deckContainer = this.add.container(0, 510);

    // Dark gothic slate border background
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.BLACK, 0.95);
    bg.fillRect(0, 0, 1280, 210);

    // Stone ledge divider bar at y=0
    bg.fillStyle(PALETTE.STONE_DARK, 1);
    bg.fillRect(0, 0, 1280, 6);
    bg.fillStyle(PALETTE.GOLD_DARK, 1);
    bg.fillRect(0, 6, 1280, 3);

    // Parchment Inlay Cards
    // Left: Challenger (x: 20..360, y: 16..196)
    // Center: Match Board (x: 375..905, y: 16..196)
    // Right: Rival (x: 920..1260, y: 16..196)
    this.drawDeckCard(bg, 20, 16, 340, 180);
    this.drawDeckCard(bg, 375, 16, 530, 180);
    this.drawDeckCard(bg, 920, 16, 340, 180);
    this.deckContainer.add(bg);

    // A. Challenger Card (Left)
    const chalPortraitKey = SidequestArtGenerator.getPortraitKey(
      this,
      this.challenger.id,
      this.isSidequest
    );
    if (this.textures.exists(chalPortraitKey)) {
      const chalPortrait = this.add
        .image(68, 80, chalPortraitKey)
        .setDisplaySize(68, 68)
        .setOrigin(0.5);
      this.deckContainer.add(chalPortrait);
      if (this.isSidequest) {
        SidequestArtGenerator.addGleamingFrame(
          this,
          this.deckContainer,
          68,
          80,
          68,
          68,
          SIDEQUEST_PALETTE.GOLD_GLEAM
        );
      }
    }

    const chalShieldKey = SidequestArtGenerator.getShieldKey(
      this,
      this.challenger.id,
      this.isSidequest
    );
    if (this.textures.exists(chalShieldKey)) {
      const chalShield = this.add
        .image(124, 96, chalShieldKey)
        .setDisplaySize(38, 48)
        .setOrigin(0.5);
      this.deckContainer.add(chalShield);
    }

    const chalName = this.add.text(160, 40, this.challenger.name.toUpperCase(), {
      fontFamily: FONT_HEADING,
      fontSize: '18px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      resolution: TEXT_RES,
    });
    const chalFaction = this.add.text(160, 66, 'SAXON CHAMPION', {
      fontFamily: FONT_BODY,
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.STONE_LIGHT,
      resolution: TEXT_RES,
    });
    const chalSkill = this.add.text(
      160,
      86,
      `Jousting: ${getCinemawareStatRating(this.challenger.jousting)} (${this.challenger.jousting}/10)`,
      {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );
    this.challengerScoreText = this.add.text(38, 148, 'BROKEN LANCES: 0   •   UNHORSED: NO', {
      fontFamily: FONT_BODY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      resolution: TEXT_RES,
    });
    this.deckContainer.add([chalName, chalFaction, chalSkill, this.challengerScoreText]);

    // B. Match Board (Center)
    const matchHeader = this.add
      .text(640, 36, 'ROYAL JOUSTING TOURNAMENT', {
        fontFamily: FONT_HEADING,
        fontSize: '18px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 2,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const stakesLabel =
      this.context.stakes === 'FAME'
        ? '🏆   STAKES: FAME & PURSE (+15 GOLD, +1 LEADERSHIP, +1 JOUSTING)'
        : `🏰   STAKES: TERRITORIAL MARCH OF ${
            GameState.getInstance().getTerritory(this.context.wagerTerritoryId || '')?.name.toUpperCase() || 'SHIRE'
          }`;

    this.stakesReadoutText = this.add
      .text(640, 62, stakesLabel, {
        fontFamily: FONT_BODY,
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: this.context.stakes === 'FAME' ? PALETTE_HEX.GOLD_DARK : PALETTE_HEX.BLOOD_RED,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    this.passTrackerText = this.add
      .text(640, 88, 'PASS 1 OF 3  (TILTS)', {
        fontFamily: FONT_BODY,
        fontSize: '14px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const controlsHint = this.add
      .text(
        640,
        114,
        'Aim with Mouse / WASD / Arrows. Keep coronel on the Golden Boss!',
        {
          fontFamily: FONT_BODY,
          fontSize: '12px',
          color: PALETTE_HEX.STONE_LIGHT,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);

    // Action Mini-Buttons inside Center Deck
    this.createDeckButton(
      420,
      142,
      200,
      34,
      '⚡  AUTO-JOUST [SPACE]',
      PALETTE.GOLD_DARK,
      () => {
        if (!this.isModalOpen && this.isCharging && !this.isImpactResolved) {
          this.triggerAutoJoustPass();
        }
      }
    );

    const isMuted = AudioManager.getInstance().isMuted();
    this.audioStatusText = this.createDeckButton(
      660,
      142,
      200,
      34,
      `🔊  AUDIO: ${isMuted ? 'MUTED' : 'ON'} [M]`,
      PALETTE.STONE_DARK,
      () => {
        this.toggleAudio();
      }
    );

    this.deckContainer.add([
      matchHeader,
      this.stakesReadoutText,
      this.passTrackerText,
      controlsHint,
    ]);

    // C. Rival Card (Right)
    const rivalPortraitKey = SidequestArtGenerator.getPortraitKey(
      this,
      this.rival.id,
      this.isSidequest
    );
    if (this.textures.exists(rivalPortraitKey)) {
      const rivalPortrait = this.add
        .image(968, 80, rivalPortraitKey)
        .setDisplaySize(68, 68)
        .setOrigin(0.5);
      this.deckContainer.add(rivalPortrait);
      if (this.isSidequest) {
        SidequestArtGenerator.addGleamingFrame(
          this,
          this.deckContainer,
          968,
          80,
          68,
          68,
          SIDEQUEST_PALETTE.CRIMSON_BRIGHT
        );
      }
    }

    const rivalShieldKey = SidequestArtGenerator.getShieldKey(
      this,
      this.rival.id,
      this.isSidequest
    );
    if (this.textures.exists(rivalShieldKey)) {
      const rivalShield = this.add
        .image(1024, 96, rivalShieldKey)
        .setDisplaySize(38, 48)
        .setOrigin(0.5);
      this.deckContainer.add(rivalShield);
    }

    const rivalName = this.add.text(1060, 40, this.rival.name.toUpperCase(), {
      fontFamily: FONT_HEADING,
      fontSize: '18px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      resolution: TEXT_RES,
    });
    const rivalFaction = this.add.text(1060, 66, 'NORMAN RIVAL', {
      fontFamily: FONT_BODY,
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.STONE_LIGHT,
      resolution: TEXT_RES,
    });
    const rivalSkill = this.add.text(
      1060,
      86,
      `Jousting: ${getCinemawareStatRating(this.rival.jousting)} (${this.rival.jousting}/10)`,
      {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );
    this.rivalScoreText = this.add.text(938, 148, 'BROKEN LANCES: 0   •   UNHORSED: NO', {
      fontFamily: FONT_BODY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      resolution: TEXT_RES,
    });
    this.deckContainer.add([rivalName, rivalFaction, rivalSkill, this.rivalScoreText]);
  }

  private drawDeckCard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
    g.fillStyle(PALETTE.WOOD_DARK, 0.85);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(2, PALETTE.GOLD_DARK, 0.8);
    g.strokeRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, PALETTE.STONE_LIGHT, 0.3);
    g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 4);
  }

  private createDeckButton(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    bgColor: number,
    onClick: () => void
  ): Phaser.GameObjects.Text {
    const btnBg = this.add.graphics();
    btnBg.fillStyle(bgColor, 0.9);
    btnBg.fillRoundedRect(x, y, w, h, 4);
    btnBg.lineStyle(1, PALETTE.GOLD_BRIGHT, 0.8);
    btnBg.strokeRoundedRect(x, y, w, h, 4);
    this.deckContainer.add(btnBg);

    const btnText = this.add
      .text(x + w / 2, y + h / 2, text, {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.deckContainer.add(btnText);

    const hit = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    this.deckContainer.add(hit);

    hit.on('pointerdown', () => {
      AudioManager.getInstance().playUiClick();
      onClick();
    });

    hit.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(PALETTE.GOLD_DARK, 1);
      btnBg.fillRoundedRect(x, y, w, h, 4);
      btnBg.lineStyle(1, PALETTE.GOLD_BRIGHT, 1);
      btnBg.strokeRoundedRect(x, y, w, h, 4);
      btnText.setColor(PALETTE_HEX.BLACK);
    });

    hit.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(bgColor, 0.9);
      btnBg.fillRoundedRect(x, y, w, h, 4);
      btnBg.lineStyle(1, PALETTE.GOLD_BRIGHT, 0.8);
      btnBg.strokeRoundedRect(x, y, w, h, 4);
      btnText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    });

    return btnText;
  }

  /**
   * Outcome and Warning Banners (Foul Alert & Pass Outcome Banner).
   */
  private createOutcomeBanners(): void {
    // 1. Foul Warning Hazard Banner (pulsing when reticle aims too low)
    this.foulWarningBanner = this.add.container(640, 460).setAlpha(0);
    const fbg = this.add.graphics();
    fbg.fillStyle(PALETTE.BLOOD_RED, 0.85);
    fbg.fillRoundedRect(-240, -18, 480, 36, 4);
    fbg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
    fbg.strokeRoundedRect(-240, -18, 480, 36, 4);
    this.foulWarningBanner.add(fbg);

    this.foulWarningText = this.add
      .text(0, 0, '⚠️  WARNING: LANCE TOO LOW! HORSE FOUL RISK!  ⚠️', {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.foulWarningBanner.add(this.foulWarningText);

    // 2. Pass Outcome Banner (center arena display after impact)
    this.passOutcomeBannerContainer = this.add.container(640, 200).setAlpha(0);
    const obg = this.add.graphics();
    obg.fillStyle(PALETTE.BLACK, 0.88);
    obg.fillRoundedRect(-320, -45, 640, 90, 8);
    obg.fillStyle(PALETTE.WOOD_DARK, 0.95);
    obg.fillRoundedRect(-315, -40, 630, 80, 6);
    obg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
    obg.strokeRoundedRect(-315, -40, 630, 80, 6);
    this.passOutcomeBannerContainer.add(obg);

    this.passOutcomeTitleText = this.add
      .text(0, -14, 'BROKEN LANCE! (+1 POINT)', {
        fontFamily: FONT_HEADING,
        fontSize: '22px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.passOutcomeSubText = this.add
      .text(0, 16, 'Solid strike upon the opponent shield!', {
        fontFamily: FONT_BODY,
        fontSize: '14px',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.passOutcomeBannerContainer.add([this.passOutcomeTitleText, this.passOutcomeSubText]);
  }

  /**
   * Starts a new Joust charge pass.
   */
  private startCharge(): void {
    if (this.context.matchStatus !== 'IN_PROGRESS') return;

    this.isCharging = true;
    this.isImpactResolved = false;
    this.chargeElapsedMs = 0;
    this.hoofbeatTimerMs = 0;
    this.hoofbeatIntervalMs = 340;

    // Reset Sprites
    this.rivalChargerSprite
      .setPosition(652, 216)
      .setScale(0.22)
      .setAlpha(1);

    this.targetShieldOverlay
      .setPosition(652, 216)
      .setScale(0.25)
      .setAlpha(0);

    this.reticleSprite
      .setPosition(652, 216)
      .setAlpha(0);

    this.foulWarningBanner.setAlpha(0);
    this.passOutcomeBannerContainer.setAlpha(0);

    if (this.unhorseTumbleSprite) {
      this.unhorseTumbleSprite.destroy();
      this.unhorseTumbleSprite = undefined;
    }

    this.passTrackerText.setText(
      `PASS ${(this.context.passesCompleted ?? 0) + 1} OF ${this.context.maxPasses ?? 3}  (TILTS)`
    );

    // Initial aim starts roughly centered on shield
    this.aimTargetX = 100;
    this.aimTargetY = 100;
    this.reticleX = 100;
    this.reticleY = 100;
  }

  override update(_time: number, delta: number): void {
    if (this.isSidequest) {
      this.updateSidequestGrandstandPennants(_time);
    }

    if (!this.isCharging || this.isImpactResolved || this.isModalOpen) {
      return;
    }

    this.chargeElapsedMs += delta;
    const progress = Phaser.Math.Clamp(this.chargeElapsedMs / this.chargeDurationMs, 0, 1);

    // 1. Rhythmic Accelerating Hoofbeats Audio
    this.hoofbeatTimerMs += delta;
    if (this.hoofbeatTimerMs >= this.hoofbeatIntervalMs) {
      this.hoofbeatTimerMs = 0;
      AudioManager.getInstance().playHoofbeats(1);
      // Accelerate cadence as knights close in
      this.hoofbeatIntervalMs = Phaser.Math.Linear(340, 160, progress);
    }

    // 2. Keyboard Input Nudge
    const nudgeSpeed = 0.14 * delta;
    if (this.keyA?.isDown || this.cursors?.left?.isDown) {
      this.aimTargetX -= nudgeSpeed;
    }
    if (this.keyD?.isDown || this.cursors?.right?.isDown) {
      this.aimTargetX += nudgeSpeed;
    }
    if (this.keyW?.isDown || this.cursors?.up?.isDown) {
      this.aimTargetY -= nudgeSpeed;
    }
    if (this.keyS?.isDown || this.cursors?.down?.isDown) {
      this.aimTargetY += nudgeSpeed;
    }

    this.aimTargetX = Phaser.Math.Clamp(this.aimTargetX, 10, 190);
    this.aimTargetY = Phaser.Math.Clamp(this.aimTargetY, 10, 230);

    // 3. Lance Sway & Inertia based on Challenger Jousting Stat
    const swayMult = JoustEngine.getSwayMultiplier(this.challenger.jousting);
    const timeSec = this.chargeElapsedMs / 1000;
    const swayX = Math.sin(timeSec * 6.5) * 14 * swayMult;
    const swayY = Math.cos(timeSec * 4.8) * 10 * swayMult;

    // Reticle lerps toward target + sway
    this.reticleX = Phaser.Math.Linear(this.reticleX, this.aimTargetX + swayX, 0.14);
    this.reticleY = Phaser.Math.Linear(this.reticleY, this.aimTargetY + swayY, 0.14);

    // 4. Kinematics of Oncoming Charger down the Tilt Barrier
    // Perspective travel:
    // Distance 0.0 -> Start at (x: 652, y: 216), Scale: 0.22
    // Distance 1.0 -> Impact at (x: 580, y: 350), Scale: 1.55
    const rivalX = Phaser.Math.Linear(652, 580, progress);
    const rivalY = Phaser.Math.Linear(216, 350, progress);
    const rivalScale = Phaser.Math.Linear(0.22, 1.55, progress);

    this.rivalChargerSprite.setPosition(rivalX, rivalY).setScale(rivalScale);

    // Warhorse Head & Neck Gallop Bobbing
    const bobOffset = Math.sin(timeSec * 16) * 8;
    this.playerHorseNeckSprite.setPosition(175, 435 + bobOffset);

    // Sidequest Labs Edition: Dramatic turf-clod & arena-dust particles kicked up by charging warhorses
    if (this.isSidequest) {
      this.turfClodTimerMs += delta;
      const clodInterval = Phaser.Math.Linear(135, 70, progress);
      if (this.turfClodTimerMs >= clodInterval) {
        this.turfClodTimerMs = 0;
        this.spawnSidequestTurfClods(rivalX, rivalY, rivalScale, progress);
      }
    }

    // 5. Final Precision Reticle & Target Shield Overlay Phase (progress >= 0.70)
    // Shield center on rival is roughly:
    const shieldCenterScreenX = rivalX + 35 * rivalScale;
    const shieldCenterScreenY = rivalY - 10 * rivalScale;

    if (progress >= 0.7) {
      const overlayProgress = (progress - 0.7) / 0.3;
      const targetScale = Phaser.Math.Linear(0.45, 1.15, overlayProgress);

      this.targetShieldOverlay
        .setPosition(shieldCenterScreenX, shieldCenterScreenY)
        .setScale(targetScale)
        .setAlpha(Phaser.Math.Linear(0.4, 0.95, overlayProgress));

      // Map reticle from target plane coordinates (0..200, 0..240) into screen overlay space
      // In overlay, (100, 100) is the center boss!
      const reticleScreenX = shieldCenterScreenX + (this.reticleX - 100) * targetScale;
      const reticleScreenY = shieldCenterScreenY + (this.reticleY - 100) * targetScale;

      this.reticleSprite
        .setPosition(reticleScreenX, reticleScreenY)
        .setAlpha(1);

      // Couched Lance shaft angles from bottom-right towards reticle
      this.playerLanceSprite.setPosition(
        Phaser.Math.Linear(740, reticleScreenX + 160, 0.2),
        Phaser.Math.Linear(480, reticleScreenY + 120, 0.2)
      );

      // Foul warning if aiming into the horse/saddle zone (y > 190)
      if (this.reticleY > 190) {
        this.foulWarningBanner.setAlpha(1);
      } else {
        this.foulWarningBanner.setAlpha(0);
      }
    } else {
      this.targetShieldOverlay.setAlpha(0);
      this.reticleSprite.setAlpha(0);
      this.foulWarningBanner.setAlpha(0);

      // Lance rests couched
      this.playerLanceSprite.setPosition(740, 480 + bobOffset * 0.4);
    }

    // 6. Impact Trigger
    if (progress >= 1.0) {
      this.resolveImpact();
    }
  }

  /**
   * Instantly resolves the current pass with AI aim using challenger's jousting stat.
   */
  private triggerAutoJoustPass(): void {
    if (this.isImpactResolved || !this.isCharging) return;
    const autoAim = JoustEngine.resolveAiAim(this.challenger.jousting);
    this.aimTargetX = autoAim.x;
    this.aimTargetY = autoAim.y;
    this.reticleX = autoAim.x;
    this.reticleY = autoAim.y;
    this.resolveImpact();
  }

  /**
   * Resolves the pass impact, computes hit-zones, applies audio and visual effects.
   */
  private resolveImpact(): void {
    this.isImpactResolved = true;
    this.isCharging = false;
    this.foulWarningBanner.setAlpha(0);

    const playerAim: Point2D = { x: this.reticleX, y: this.reticleY };
    const rivalAim: Point2D = JoustEngine.resolveAiAim(this.rival.jousting);

    const passResult: JoustPassResult = JoustEngine.resolveJoustPass(
      this.context,
      playerAim,
      rivalAim
    );

    // 1. Camera Shake on Impact
    this.cameras.main.shake(300, 0.018);

    // 2. Audio & Visuals based on Result
    const playerHit = passResult.challengerHitZone;
    const rivalHit = passResult.rivalHitZone;

    let bannerTitle = 'PASS COMPLETE';
    let bannerSub = passResult.commentary;

    if (playerHit === 'FOUL_HIT_HORSE') {
      AudioManager.getInstance().playFoulHorn();
      bannerTitle = '⚠️  FOUL! HORSE STRUCK! DISQUALIFIED!';
      bannerSub = 'Thy lance struck the opponent steed! Thou art disqualified from the lists!';
    } else if (rivalHit === 'FOUL_HIT_HORSE') {
      AudioManager.getInstance().playFoulHorn();
      bannerTitle = '⚠️  RIVAL COMMITTED FOUL!';
      bannerSub = 'The rival struck thy steed and is disqualified! Victory unto thee!';
    } else if (playerHit === 'UNHORSED') {
      AudioManager.getInstance().playLanceImpact(true);
      AudioManager.getInstance().playFanfare();
      bannerTitle = '🏆  DIRECT HIT! RIVAL UNHORSED!';
      bannerSub = 'A thunderous strike upon the golden boss unhorses the rival!';
      this.spawnUnhorsedAnimation();
      this.spawnSplinterExplosion(this.rivalChargerSprite.x, this.rivalChargerSprite.y);
    } else if (rivalHit === 'UNHORSED') {
      AudioManager.getInstance().playLanceImpact(true);
      bannerTitle = '💥  THOU ART UNHORSED!';
      bannerSub = 'The rival shattered thy guard and knocked thee from the saddle!';
      this.spawnSplinterExplosion(640, 360);
    } else if (playerHit === 'LANCE_SHATTERED') {
      AudioManager.getInstance().playLanceImpact(false);
      bannerTitle = '💥  BROKEN LANCE! (+1 POINT)';
      bannerSub = 'A solid blow upon the shield face! Thy lance shatters in glory!';
      this.spawnSplinterExplosion(this.rivalChargerSprite.x + 40, this.rivalChargerSprite.y - 20);
    } else if (playerHit === 'GLANCING_BLOW') {
      AudioManager.getInstance().playSwordClash(true);
      bannerTitle = '🛡️  GLANCING BLOW';
      bannerSub = 'Thy coronel strikes the helm rim with a ringing clang!';
    } else {
      bannerTitle = '💨  CLEAN MISS';
      bannerSub = 'Both lances whip harmlessly through the arena dust!';
    }

    // 3. Update Deck Scoreboards
    this.challengerScoreText.setText(
      `BROKEN LANCES: ${this.context.challengerBrokenLances}   •   UNHORSED: ${
        playerHit === 'UNHORSED' ? 'VICTORIOUS!' : rivalHit === 'UNHORSED' ? 'YES' : 'NO'
      }`
    );
    this.rivalScoreText.setText(
      `BROKEN LANCES: ${this.context.rivalBrokenLances}   •   UNHORSED: ${
        rivalHit === 'UNHORSED' ? 'VICTORIOUS!' : playerHit === 'UNHORSED' ? 'YES' : 'NO'
      }`
    );

    // 4. Show Outcome Banner
    this.passOutcomeTitleText.setText(bannerTitle);
    this.passOutcomeSubText.setText(bannerSub);
    this.passOutcomeBannerContainer.setAlpha(1);

    // 5. Next Pass or End of Tournament Match
    this.time.delayedCall(2400, () => {
      if (this.context.matchStatus !== 'IN_PROGRESS') {
        this.showFinalOutcomeModal();
      } else {
        this.startCharge();
      }
    });
  }

  /**
   * Spawns a dramatic flying unhorsed rider sprite.
   */
  private spawnUnhorsedAnimation(): void {
    this.rivalChargerSprite.setAlpha(0);
    this.targetShieldOverlay.setAlpha(0);
    this.reticleSprite.setAlpha(0);

    this.unhorseTumbleSprite = this.add
      .image(this.rivalChargerSprite.x, this.rivalChargerSprite.y, 'joust_unhorsed')
      .setScale(1.4);
    this.arenaContainer.add(this.unhorseTumbleSprite);

    this.tweens.add({
      targets: this.unhorseTumbleSprite,
      x: this.unhorseTumbleSprite.x + 140,
      y: this.unhorseTumbleSprite.y + 120,
      angle: 180,
      duration: 900,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * Spawns scattering wood splinter particles.
   */
  private spawnSplinterExplosion(x: number, y: number): void {
    for (let i = 0; i < 20; i++) {
      const splinter = this.add.image(x, y, 'joust_splinter').setScale(1.5);
      this.splinterParticlesContainer.add(splinter);

      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 240;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 60;

      this.tweens.add({
        targets: splinter,
        x: splinter.x + vx,
        y: splinter.y + vy,
        angle: Math.random() * 360,
        alpha: { from: 1, to: 0 },
        duration: 800 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => {
          splinter.destroy();
        },
      });
    }
  }

  /**
   * Displays the final Royal Tournament Parchment Scroll Modal.
   */
  private showFinalOutcomeModal(): void {
    this.isModalOpen = true;

    const modalContainer = this.add.container(640, 360).setDepth(100);

    // Fullscreen scrim
    const scrim = this.add.graphics();
    scrim.fillStyle(PALETTE.BLACK, 0.78);
    scrim.fillRect(-640, -360, 1280, 720);
    modalContainer.add(scrim);

    // Parchment Scroll (740x480)
    const scroll = this.add.graphics();
    scroll.fillStyle(PALETTE.WOOD_DARK, 0.96);
    scroll.fillRoundedRect(-370, -240, 740, 480, 8);
    scroll.fillStyle(PALETTE.PARCHMENT_LIGHT, 0.95);
    scroll.fillRoundedRect(-362, -232, 724, 464, 6);
    scroll.lineStyle(3, PALETTE.GOLD_DARK, 1);
    scroll.strokeRoundedRect(-362, -232, 724, 464, 6);
    scroll.lineStyle(1, PALETTE.WOOD_MID, 0.6);
    scroll.strokeRoundedRect(-354, -224, 708, 448, 4);

    // Corner Filigree
    scroll.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    scroll.fillRect(-354, -224, 12, 12);
    scroll.fillRect(342, -224, 12, 12);
    scroll.fillRect(-354, 212, 12, 12);
    scroll.fillRect(342, 212, 12, 12);
    modalContainer.add(scroll);

    const isWinner = this.context.matchStatus === 'CHALLENGER_WON';
    const isFoul =
      (this.context.history ?? []).some((h: JoustPassResult) => h.challengerHitZone === 'FOUL_HIT_HORSE') ||
      (this.context.history ?? []).some((h: JoustPassResult) => h.rivalHitZone === 'FOUL_HIT_HORSE');

    const titleColor = isWinner ? PALETTE_HEX.BLOOD_RED : PALETTE_HEX.STONE_DARK;
    const headerTitle = isWinner
      ? 'HAIL THE TOURNAMENT CHAMPION!'
      : 'DEFEAT IN THE ROYAL LISTS';

    const header = this.add
      .text(0, -188, headerTitle, {
        fontFamily: FONT_HEADING,
        fontSize: '24px',
        fontStyle: 'bold',
        color: titleColor,
        letterSpacing: 2,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    modalContainer.add(header);

    // Heraldic Shields in modal
    const chalKey = SidequestArtGenerator.getShieldKey(this, this.challenger.id, this.isSidequest);
    if (this.textures.exists(chalKey)) {
      const cs = this.add.image(-220, -110, chalKey).setDisplaySize(48, 60);
      modalContainer.add(cs);
    }
    const rivalKey = SidequestArtGenerator.getShieldKey(this, this.rival.id, this.isSidequest);
    if (this.textures.exists(rivalKey)) {
      const rs = this.add.image(220, -110, rivalKey).setDisplaySize(48, 60);
      modalContainer.add(rs);
    }

    const matchScoreLine = `FINAL SCORE: ${this.challenger.name.toUpperCase()} (${this.context.challengerScore} PTS)  VS  ${this.rival.name.toUpperCase()} (${this.context.rivalScore} PTS)`;
    const scoreText = this.add
      .text(0, -110, matchScoreLine, {
        fontFamily: FONT_BODY,
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#2A1F14',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    modalContainer.add(scoreText);

    // Stakes & Rewards Section
    let proclamation = '';
    let rewardsText = '';

    if (isWinner) {
      if (this.context.stakes === 'FAME') {
        proclamation =
          `By order of the King and heralds of the realm,\n` +
          `Lord ${this.challenger.name} hath proved his valor before all England!`;
        rewardsText =
          `🎁  ROYAL TOURNAMENT PURSE: +15 GOLD\n` +
          `👑  PERMANENT LEADERSHIP: +1 LEADERSHIP\n` +
          `🏇  TILT-YARD RENOWN: +1 JOUSTING MASTERY`;
      } else {
        const terrName =
          GameState.getInstance().getTerritory(this.context.wagerTerritoryId || '')?.name || 'Border Shire';
        proclamation =
          `By ancient chivalric code, the rival hath ceded territorial sovereignty!\n` +
          `The Shire of ${terrName.toUpperCase()} hath sworn fealty unto thy banner!`;
        rewardsText =
          `🏰  TERRITORIAL CONQUEST: ${terrName.toUpperCase()} TRANSFERRED!\n` +
          `⚔  NOBLOODSHED ANNEXATION: Garrison sworn to thy crown!`;
      }
    } else {
      if (isFoul) {
        proclamation = `Disqualification! Thy lance struck the noble destrier of thy rival!`;
      } else {
        proclamation =
          `Lord ${this.rival.name} hath carried the day in the royal tilt-yard.\n` +
          `Thy pride is bruised, but thy resolve remains unbroken.`;
      }
      if (this.context.stakes === 'LAND') {
        const terrName =
          GameState.getInstance().getTerritory(this.context.wagerTerritoryId || '')?.name || 'Border Shire';
        rewardsText = `🏰  TERRITORY LOST: ${terrName.toUpperCase()} hath been ceded to the victor!`;
      } else {
        rewardsText = `Bruised pride. No gold or territory was lost in the joust for fame.`;
      }
    }

    const procTextObj = this.add
      .text(0, -40, proclamation, {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        fontStyle: 'italic',
        color: '#1A140E',
        align: 'center',
        lineSpacing: 6,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    modalContainer.add(procTextObj);

    // Reward Inlay Box
    const rbox = this.add.graphics();
    rbox.fillStyle(PALETTE.WOOD_DARK, 0.15);
    rbox.fillRoundedRect(-280, 15, 560, 95, 6);
    rbox.lineStyle(1, PALETTE.GOLD_DARK, 0.8);
    rbox.strokeRoundedRect(-280, 15, 560, 95, 6);
    modalContainer.add(rbox);

    const rewTextObj = this.add
      .text(0, 62, rewardsText, {
        fontFamily: FONT_BODY,
        fontSize: '14.5px',
        fontStyle: 'bold',
        color: isWinner ? PALETTE_HEX.BLOOD_RED : PALETTE_HEX.STONE_DARK,
        align: 'center',
        lineSpacing: 6,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    modalContainer.add(rewTextObj);

    // Return to Realm Map Button
    const btnW = 380;
    const btnH = 46;
    const btnX = -btnW / 2;
    const btnY = 150;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(PALETTE.BLOOD_RED, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
    btnBg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
    modalContainer.add(btnBg);

    const btnLabel = this.add
      .text(0, btnY + btnH / 2, '⚔   RETURN TO STRATEGY MAP [ENTER]   ⚔', {
        fontFamily: FONT_HEADING,
        fontSize: '15px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    modalContainer.add(btnLabel);

    const btnZone = this.add
      .zone(0, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    modalContainer.add(btnZone);

    const commitAndReturn = () => {
      if (this.isLeaving) return;
      this.isLeaving = true;
      AudioManager.getInstance().playUiClick();

      // Commit to GameState
      const summary: JoustOutcomeSummary = {
        context: this.context,
        winnerLordId:
          this.context.matchStatus === 'CHALLENGER_WON'
            ? this.challenger.id
            : this.context.matchStatus === 'RIVAL_WON'
            ? this.rival.id
            : null,
        goldAwarded: isWinner && this.context.stakes === 'FAME' ? 15 : 0,
        territoryTransferredId: this.context.stakes === 'LAND' ? this.context.wagerTerritoryId : undefined,
        narrativeChronicle: proclamation.replace(/\n/g, ' '),
      };

      GameState.getInstance().commitJoustOutcome(summary);

      this.cameras.main.fadeOut(350, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('MapScene', {
          lastBattleMessage: `The Royal Tournament hath concluded. ${summary.narrativeChronicle}`,
          lastBattleAlert: !isWinner,
        });
      });
    };

    btnZone.on('pointerdown', commitAndReturn);
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-ENTER', commitAndReturn);
      this.input.keyboard.once('keydown-SPACE', commitAndReturn);
    }
  }

  /**
   * Sidequest Labs Edition: Animates fluttering heraldic pennants atop the tournament grandstands & Royal Box.
   */
  private updateSidequestGrandstandPennants(timeMs: number): void {
    if (!this.sidequestPennantsGraphics) return;
    const g = this.sidequestPennantsGraphics;
    g.clear();

    const pennantColors = [
      SIDEQUEST_PALETTE.CRIMSON_BRIGHT,
      SIDEQUEST_PALETTE.GOLD_GLEAM,
      SIDEQUEST_PALETTE.AZURE_BRIGHT,
      SIDEQUEST_PALETTE.EMERALD_HIGHLIGHT,
      SIDEQUEST_PALETTE.PURPLE_REGAL_LIGHT,
    ];

    const poles = [
      { x: 110, y: 122, len: 30, royal: false },
      { x: 245, y: 122, len: 28, royal: false },
      { x: 380, y: 122, len: 30, royal: false },
      { x: 515, y: 122, len: 28, royal: false },
      { x: 582, y: 106, len: 36, royal: true },
      { x: 698, y: 106, len: 36, royal: true },
      { x: 790, y: 122, len: 30, royal: false },
      { x: 925, y: 122, len: 28, royal: false },
      { x: 1060, y: 122, len: 30, royal: false },
      { x: 1175, y: 122, len: 28, royal: false },
    ];

    const t = timeMs * 0.0065;
    poles.forEach((pole, idx) => {
      // Mast & golden finial
      g.fillStyle(SIDEQUEST_PALETTE.OAK_SHADOW, 1);
      g.fillRect(pole.x - 1, pole.y - 26, 3, 28);
      g.fillStyle(SIDEQUEST_PALETTE.GOLD_SPECULAR, 1);
      g.fillCircle(pole.x, pole.y - 27, 2.5);

      // Multi-segment fluttering swallowtail pennant
      const color = pole.royal
        ? SIDEQUEST_PALETTE.GOLD_GLEAM
        : pennantColors[idx % pennantColors.length];
      const wave1 = Math.sin(t + idx * 0.9) * 3.2;
      const wave2 = Math.cos(t * 1.35 + idx * 1.1) * 5.2;
      const topY = pole.y - 25;
      const midX = pole.x + pole.len * 0.55;
      const tipX = pole.x + pole.len;

      g.fillStyle(color, 0.96);
      g.beginPath();
      g.moveTo(pole.x + 2, topY);
      g.lineTo(midX, topY + 2 + wave1);
      g.lineTo(tipX, topY + 3 + wave2);
      g.lineTo(tipX - 6, topY + 7 + wave2 * 0.9);
      g.lineTo(tipX, topY + 11 + wave2);
      g.lineTo(midX, topY + 11 + wave1);
      g.lineTo(pole.x + 2, topY + 12);
      g.closePath();
      g.fillPath();

      // Trim stripe on Royal Box pennants
      if (pole.royal) {
        g.lineStyle(1.2, SIDEQUEST_PALETTE.CRIMSON_BRIGHT, 0.9);
        g.beginPath();
        g.moveTo(pole.x + 3, topY + 6);
        g.lineTo(midX, topY + 6.5 + wave1);
        g.lineTo(tipX - 6, topY + 7 + wave2 * 0.9);
        g.strokePath();
      }
    });
  }

  /**
   * Sidequest Labs Edition: Spawns flying turf clods & sand dust kicked up by both charging warhorses.
   */
  private spawnSidequestTurfClods(
    rivalX: number,
    rivalY: number,
    rivalScale: number,
    progress: number
  ): void {
    if (!this.sidequestTurfContainer) return;

    // 1. Rival warhorse hooves kicking up turf clods & sand puffs
    const hoofBaseX = rivalX + (Math.random() - 0.5) * 28 * rivalScale;
    const hoofBaseY = rivalY + 42 * rivalScale;
    const rivalClodCount = progress > 0.45 ? 3 : 2;

    for (let i = 0; i < rivalClodCount; i++) {
      const clod = this.add.graphics();
      const isGrass = i % 2 === 0;
      const sz = Math.max(2, (2.5 + Math.random() * 3.5) * Math.min(1.25, rivalScale + 0.35));
      clod.fillStyle(
        isGrass ? SIDEQUEST_PALETTE.SPRING_MEADOW_DARK : SIDEQUEST_PALETTE.OAK_SHADOW,
        0.92
      );
      clod.fillRect(-sz / 2, -sz / 2, sz, sz * 0.78);
      if (isGrass) {
        clod.fillStyle(SIDEQUEST_PALETTE.SPRING_MEADOW_BRIGHT, 0.85);
        clod.fillRect(-sz / 2, -sz / 2, sz, Math.max(1, sz * 0.32));
      }
      clod.setPosition(hoofBaseX, hoofBaseY);
      this.sidequestTurfContainer.add(clod);

      const vx = (Math.random() - 0.35) * 65 * rivalScale;
      const vy = -(18 + Math.random() * 34) * Math.max(0.5, rivalScale);
      this.tweens.add({
        targets: clod,
        x: hoofBaseX + vx,
        y: hoofBaseY + vy + 22,
        angle: (Math.random() - 0.5) * 220,
        alpha: { from: 0.95, to: 0 },
        duration: 420 + Math.random() * 220,
        ease: 'Quad.easeOut',
        onComplete: () => clod.destroy(),
      });
    }

    // 2. Player foreground destrier kicking dramatic turf clods & sand plume along lower arena edge
    const fgX = 240 + Math.random() * 140;
    const fgY = 496 + Math.random() * 10;
    const fgClod = this.add.graphics();
    fgClod.fillStyle(SIDEQUEST_PALETTE.OAK_SHADOW, 0.9);
    fgClod.fillRect(-4, -3, 8, 6);
    fgClod.fillStyle(SIDEQUEST_PALETTE.SPRING_MEADOW_BRIGHT, 0.85);
    fgClod.fillRect(-4, -3, 8, 2);
    fgClod.setPosition(fgX, fgY);
    this.sidequestTurfContainer.add(fgClod);

    this.tweens.add({
      targets: fgClod,
      x: fgX - 55 - Math.random() * 55,
      y: fgY - 26 - Math.random() * 28,
      angle: -140 - Math.random() * 120,
      alpha: { from: 0.95, to: 0 },
      duration: 460 + Math.random() * 180,
      ease: 'Cubic.easeOut',
      onComplete: () => fgClod.destroy(),
    });
  }

  private toggleAudio(): void {
    const muted = AudioManager.getInstance().toggleMute();
    if (this.audioStatusText) {
      this.audioStatusText.setText(`🔊  AUDIO: ${muted ? 'MUTED' : 'ON'} [M]`);
    }
  }
}
