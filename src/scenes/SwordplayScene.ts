import Phaser from 'phaser';
import {
  FencerPose,
  SWORDPLAY_ACTION_PROFILES,
  SwordplayEngine,
  SwordplayExchangeReport,
  SwordplayOutcomeSummary,
  SwordplaySession,
} from '../core/SwordplayEngine';
import { GameState } from '../core/GameState';
import {
  getCinemawareStatRating,
  PendingSwordplayContext,
  SwordplayAction,
} from '../core/types';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';

export interface SwordplaySceneData {
  swordplayContext?: PendingSwordplayContext;
}

const FONT_HEADING = 'Cinzel, Georgia, serif';
const FONT_BODY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
const TEXT_RES = 2;

export class SwordplayScene extends Phaser.Scene {
  private session!: SwordplaySession;

  // Real-time Fencing & Animation State
  private isAnimatingExchange = false;
  private isTransitioningStage = false;
  private isOutcomeModalOpen = false;
  private isLeavingScene = false;
  private autoDuelEnabled = false;

  private envTimer = 0;
  private emberTimerMs = 0;
  private idleUntilTelegraphMs = 850;
  private activeTelegraphRemainingMs = 0;
  private autoDuelCooldownMs = 0;
  private playerActionCooldownMs = 0;

  private currentPlayerPose: FencerPose = 'EN_GARDE';
  private currentEnemyPose: FencerPose = 'EN_GARDE';
  private playerLungeOffsetPx = 0;
  private enemyLungeOffsetPx = 0;
  private hoveredHint: string | null = null;

  // Top Castle Arena Layers (0..1280 x 0..500)
  private torchGlowGraphics!: Phaser.GameObjects.Graphics;
  private roomPropsContainer!: Phaser.GameObjects.Container;
  private wallShadowsContainer!: Phaser.GameObjects.Container;
  private floorShadowGraphics!: Phaser.GameObjects.Graphics;
  private ambientParticlesContainer!: Phaser.GameObjects.Container;
  private clashFxContainer!: Phaser.GameObjects.Container;

  private playerShadowSprite!: Phaser.GameObjects.Image;
  private enemyShadowSprite!: Phaser.GameObjects.Image;
  private playerSprite!: Phaser.GameObjects.Image;
  private enemySprite!: Phaser.GameObjects.Image;
  private vaultChestLeft?: Phaser.GameObjects.Image;
  private vaultChestRight?: Phaser.GameObjects.Image;
  private captiveLadySprite?: Phaser.GameObjects.Image;

  // Top Corridor Progress & Footing Bar + Telegraph HUD
  private topCorridorGraphics!: Phaser.GameObjects.Graphics;
  private topStageTitleText!: Phaser.GameObjects.Text;
  private topRoomSubText!: Phaser.GameObjects.Text;
  private footingReadoutText!: Phaser.GameObjects.Text;
  private telegraphIndicatorContainer!: Phaser.GameObjects.Container;
  private telegraphBarGraphics!: Phaser.GameObjects.Graphics;
  private telegraphLabelText!: Phaser.GameObjects.Text;
  private riposteBadgeContainer!: Phaser.GameObjects.Container;

  // Bottom Fencing Command Deck (0..1280 x 500..720)
  private leftCardContainer!: Phaser.GameObjects.Container;
  private centerControlsContainer!: Phaser.GameObjects.Container;
  private rightCardContainer!: Phaser.GameObjects.Container;
  private tickerText!: Phaser.GameObjects.Text;

  // Cinematic Outcome Modal (Centered Scroll)
  private outcomeModalContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'SwordplayScene' });
  }

  create(data?: SwordplaySceneData): void {
    PixelArtGenerator.generateAll(this);

    const gameState = GameState.getInstance();
    let state = gameState.getState();

    const playerCheck = state.activeLords[state.selectedLordId];
    if (!playerCheck || !playerCheck.isActive) {
      state = gameState.startNewCampaign(state.selectedLordId || 'ivanhoe');
    }

    const fallbackRival =
      Object.values(state.activeLords).find(
        (l) => l.isActive && !l.isDefeated && !l.isPlayer
      ) ?? Object.values(state.activeLords)[0];

    const ctx: PendingSwordplayContext = data?.swordplayContext ?? {
      missionType: state.captiveDamsel ? 'RESCUE' : 'RAID',
      attackerId: state.selectedLordId,
      targetLordId: state.captiveDamsel?.captorLordId ?? fallbackRival.id,
      targetTerritoryId:
        state.captiveDamsel?.castleTerritoryId ?? fallbackRival.homeTerritoryId,
      damselId: state.captiveDamsel?.damselId,
    };

    this.session = SwordplayEngine.createSession(state, ctx);

    this.isAnimatingExchange = false;
    this.isTransitioningStage = false;
    this.isOutcomeModalOpen = false;
    this.isLeavingScene = false;
    this.autoDuelEnabled = false;
    this.envTimer = 0;
    this.emberTimerMs = 0;
    this.idleUntilTelegraphMs = 900;
    this.activeTelegraphRemainingMs = 0;
    this.autoDuelCooldownMs = 0;
    this.playerActionCooldownMs = 0;
    this.currentPlayerPose = 'EN_GARDE';
    this.currentEnemyPose = 'EN_GARDE';
    this.playerLungeOffsetPx = 0;
    this.enemyLungeOffsetPx = 0;
    this.hoveredHint = null;

    // 1. Top 1280x500 Torchlit Castle Hall & Dynamic Wall Shadows
    this.createTopCastleArena();

    // 2. Bottom 1280x220 Swashbuckling Command Deck
    this.createBottomCommandDeck();

    // 3. Keyboard Shortcuts
    this.setupKeyboardControls();

    // 4. Initial Render
    this.rebuildStageRoomProps();
    this.syncDuelistSpritesAndShadows();
    this.refreshTopCorridorBar();
    this.refreshDuelistCards();
    this.refreshCenterButtons();
    this.refreshTicker();

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    this.envTimer += delta * 0.005;
    this.emberTimerMs += delta;

    if (this.playerActionCooldownMs > 0) {
      this.playerActionCooldownMs = Math.max(0, this.playerActionCooldownMs - delta);
    }

    // 1. Live Flickering Wall Sconces, Warm Light Halos & Drifting Embers
    this.drawFlickeringTorches();
    if (this.emberTimerMs >= 210) {
      this.emberTimerMs = 0;
      this.spawnTorchEmber();
    }

    // 2. Keep Dynamic Wall Shadows & Idle Breathing Alive
    this.syncDuelistSpritesAndShadows();

    // Stop combat timers if animating, transitioning rooms, or showing outcome scroll
    if (
      this.isOutcomeModalOpen ||
      this.isTransitioningStage ||
      this.isLeavingScene ||
      this.session.status !== 'ACTIVE'
    ) {
      this.updateTelegraphHud();
      return;
    }

    // Passive stamina trickle while circling in guard
    if (!this.isAnimatingExchange) {
      const regen = delta * 0.0038;
      this.session.player.stamina = Math.min(100, this.session.player.stamina + regen);
      this.session.enemy.stamina = Math.min(100, this.session.enemy.stamina + regen * 0.85);
    }

    // 3. Auto-Duel AI Driver (when toggled ON by player)
    if (this.autoDuelEnabled && !this.isAnimatingExchange) {
      this.autoDuelCooldownMs += delta;
      const threshold = this.session.telegraphedEnemyAction ? 240 : 480;
      if (this.autoDuelCooldownMs >= threshold) {
        this.autoDuelCooldownMs = 0;
        this.executeAutoDuelStep();
        return;
      }
    }

    // 4. Real-Time Enemy Wind-Up Telegraph (350ms - 550ms reaction window)
    if (!this.isAnimatingExchange) {
      if (this.session.telegraphedEnemyAction) {
        this.activeTelegraphRemainingMs -= delta;
        this.updateTelegraphHud();

        if (this.activeTelegraphRemainingMs <= 0) {
          this.activeTelegraphRemainingMs = 0;
          const report = SwordplayEngine.resolveUnansweredEnemyStrike(this.session);
          this.playExchangeAnimation(report, true);
        }
      } else {
        this.idleUntilTelegraphMs -= delta;
        this.updateTelegraphHud();

        if (this.idleUntilTelegraphMs <= 0) {
          const tel = SwordplayEngine.beginEnemyTelegraph(this.session);
          this.activeTelegraphRemainingMs = tel.durationMs;
          this.currentEnemyPose =
            tel.zone === 'HIGH'
              ? 'WINDUP_HIGH'
              : tel.zone === 'MID'
              ? 'WINDUP_MID'
              : 'WINDUP_LOW';
          this.refreshCenterButtons();
          this.refreshDuelistCards();
          this.updateTelegraphHud();
        }
      }
    }
  }

  // ==========================================================================
  // TOP CASTLE INTERIOR ARENA (x: 0..1280, y: 0..500)
  // ==========================================================================

  private createTopCastleArena(): void {
    this.add.image(0, 0, 'swordplay_hall_backdrop').setOrigin(0, 0).setDepth(1);

    // Dramatic Wall Shadows Layer (Cast onto stone masonry behind props & duelists!)
    this.wallShadowsContainer = this.add.container(0, 0).setDepth(8);
    this.playerShadowSprite = this.add
      .image(480, 292, 'fencer_saxon_en_garde')
      .setTint(0x07060c)
      .setAlpha(0.42)
      .setScale(2.75, 2.85);
    this.enemyShadowSprite = this.add
      .image(760, 292, 'fencer_guard_en_garde')
      .setFlipX(true)
      .setTint(0x07060c)
      .setAlpha(0.42)
      .setScale(2.75, 2.85);
    this.wallShadowsContainer.add([this.playerShadowSprite, this.enemyShadowSprite]);

    // Torch Light Halos & Sconce Flames
    this.torchGlowGraphics = this.add.graphics().setDepth(12);

    // Stage-Specific Castle Props (Tapestries, Portcullis, Treasure Chests, Captive Damsel)
    this.roomPropsContainer = this.add.container(0, 0).setDepth(15);

    // Flagstone Ground Contact Shadows
    this.floorShadowGraphics = this.add.graphics().setDepth(20);

    // Ambient Embers
    this.ambientParticlesContainer = this.add.container(0, 0).setDepth(22);

    // Crisp Pixel-Art Duelist Sprites (96x84 @ 2x = 192x168 NEAREST)
    this.playerSprite = this.add
      .image(520, 366, 'fencer_saxon_en_garde')
      .setScale(2.0)
      .setDepth(30);

    this.enemySprite = this.add
      .image(720, 366, 'fencer_guard_en_garde')
      .setFlipX(true)
      .setScale(2.0)
      .setDepth(31);

    // Steel Sparks & Callouts Layer
    this.clashFxContainer = this.add.container(0, 0).setDepth(45);

    // Top-Center Corridor Progress & Footing Meter (x: 330..950, y: 10..78)
    this.topCorridorGraphics = this.add.graphics().setDepth(55);
    this.topStageTitleText = this.add
      .text(640, 24, '', {
        fontFamily: FONT_HEADING,
        fontSize: '15.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 1.5,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setDepth(57);

    this.topRoomSubText = this.add
      .text(640, 42, '', {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: '600',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setDepth(57);

    this.footingReadoutText = this.add
      .text(640, 65, '', {
        fontFamily: FONT_BODY,
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setDepth(58);

    // Enemy Telegraph Indicator Badge (Floats above Defender during 350ms-550ms wind-up)
    this.telegraphIndicatorContainer = this.add
      .container(0, 0)
      .setDepth(65)
      .setVisible(false);
    this.telegraphBarGraphics = this.add.graphics();
    this.telegraphLabelText = this.add
      .text(0, -14, '', {
        fontFamily: FONT_BODY,
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: '#FFF4C2',
        stroke: '#160808',
        strokeThickness: 3,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.telegraphIndicatorContainer.add([
      this.telegraphBarGraphics,
      this.telegraphLabelText,
    ]);

    // Player Riposte Ready Floating Badge
    this.riposteBadgeContainer = this.add
      .container(0, 0)
      .setDepth(65)
      .setVisible(false);
    const ripBg = this.add.graphics();
    ripBg.fillStyle(0x3a2605, 0.94);
    ripBg.fillRoundedRect(-96, -15, 192, 26, 5);
    ripBg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
    ripBg.strokeRoundedRect(-96, -15, 192, 26, 5);
    const ripTxt = this.add
      .text(0, -2, '⚡ RIPOSTE READY (1.6x)!', {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.riposteBadgeContainer.add([ripBg, ripTxt]);

    // Ornate Top Arena Border Trim
    const arenaFrame = this.add.graphics().setDepth(60);
    arenaFrame.lineStyle(4, PALETTE.WOOD_DARK, 1);
    arenaFrame.strokeRect(2, 2, 1276, 496);
    arenaFrame.lineStyle(1.5, PALETTE.GOLD_DARK, 0.85);
    arenaFrame.strokeRect(5, 5, 1270, 490);
  }

  private rebuildStageRoomProps(): void {
    this.roomPropsContainer.removeAll(true);
    this.vaultChestLeft = undefined;
    this.vaultChestRight = undefined;
    this.captiveLadySprite = undefined;

    const state = GameState.getInstance().getState();
    const targetLord = state.activeLords[this.session.targetLordId];
    const bannerPrimary =
      targetLord?.heraldry.primaryColor ??
      (this.session.enemy.faction === 'norman' ? PALETTE.BLOOD_RED : PALETTE.FOLIAGE_MID);
    const bannerTrim = targetLord?.heraldry.secondaryColor ?? PALETTE.GOLD_BRIGHT;
    const shieldKey =
      targetLord && this.textures.exists(`shield_${targetLord.id}`)
        ? `shield_${targetLord.id}`
        : 'shield_garrison';

    // Heraldic Tapestries on Castle Columns
    const tapestryXs =
      this.session.stageNumber === 1 ? [490, 790] : [190, 490, 790, 1040];

    for (const tx of tapestryXs) {
      const tap = this.add.graphics();
      tap.fillStyle(PALETTE.WOOD_DARK, 1);
      tap.fillRect(tx - 28, 76, 56, 5);
      tap.fillStyle(bannerPrimary, 0.94);
      tap.beginPath();
      tap.moveTo(tx - 24, 81);
      tap.lineTo(tx + 24, 81);
      tap.lineTo(tx + 24, 198);
      tap.lineTo(tx, 222);
      tap.lineTo(tx - 24, 198);
      tap.closePath();
      tap.fillPath();

      tap.lineStyle(2, bannerTrim, 0.9);
      tap.strokePath();
      this.roomPropsContainer.add(tap);

      const shield = this.add
        .image(tx, 144, shieldKey)
        .setDisplaySize(32, 40);
      this.roomPropsContainer.add(shield);
    }

    // Stage 1: Outer Bailey Portcullis Grate Over Left Archway
    if (this.session.stageNumber === 1) {
      const grate = this.add.graphics();
      grate.lineStyle(3, PALETTE.STONE_MID, 0.8);
      for (let gx = 44; gx <= 126; gx += 16) {
        grate.lineBetween(gx, 178, gx, 252);
      }
      grate.lineBetween(36, 206, 134, 206);
      grate.lineBetween(36, 236, 134, 236);
      this.roomPropsContainer.add(grate);
    }

    // Stage 3 Props: Overflowing Treasure Chests (RAID) or Captive Saxon Damsel (RESCUE)
    if (this.session.stageNumber === 3) {
      if (this.session.missionType === 'RAID') {
        this.vaultChestLeft = this.add
          .image(1062, 362, 'prop_treasure_chest_closed')
          .setScale(1.65);
        this.vaultChestRight = this.add
          .image(1148, 344, 'prop_treasure_chest_closed')
          .setScale(1.65);
        this.roomPropsContainer.add([this.vaultChestLeft, this.vaultChestRight]);
      } else {
        this.captiveLadySprite = this.add
          .image(1134, 294, 'sprite_damsel_captive')
          .setScale(1.85);
        const damselLbl = this.add
          .text(
            1134,
            218,
            this.session.damsel?.name.toUpperCase() ?? 'CAPTIVE LADY',
            {
              fontFamily: FONT_BODY,
              fontSize: '11px',
              fontStyle: 'bold',
              color: PALETTE_HEX.GOLD_BRIGHT,
              backgroundColor: '#120E1ACC',
              padding: { x: 6, y: 2 },
              resolution: TEXT_RES,
            }
          )
          .setOrigin(0.5);
        this.roomPropsContainer.add([this.captiveLadySprite, damselLbl]);
      }
    }
  }

  private drawFlickeringTorches(): void {
    this.torchGlowGraphics.clear();
    const sconceXs = [235, 535, 745, 995];

    sconceXs.forEach((tx, idx) => {
      const ty = 196;
      const flicker =
        Math.sin(this.envTimer * 3.1 + idx * 1.7) * 0.5 +
        Math.cos(this.envTimer * 5.4 + idx * 2.3) * 0.5;
      const haloR = 68 + flicker * 7;

      // Soft warm multi-layered torchlight halo
      this.torchGlowGraphics.fillStyle(0xff7b1c, 0.07 + flicker * 0.015);
      this.torchGlowGraphics.fillCircle(tx, ty - 10, haloR);
      this.torchGlowGraphics.fillStyle(PALETTE.GOLD_BRIGHT, 0.13 + flicker * 0.02);
      this.torchGlowGraphics.fillCircle(tx, ty - 10, haloR * 0.52);

      // Iron wall bracket
      this.torchGlowGraphics.fillStyle(0x1b1c24, 1);
      this.torchGlowGraphics.fillRect(tx - 3, ty, 6, 24);
      this.torchGlowGraphics.fillRect(tx - 7, ty - 2, 14, 4);

      // Dancing Torch Flame
      this.torchGlowGraphics.fillStyle(PALETTE.BLOOD_RED, 0.95);
      this.torchGlowGraphics.fillCircle(tx, ty - 8, 7);
      this.torchGlowGraphics.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      this.torchGlowGraphics.fillTriangle(
        tx + flicker * 2.5,
        ty - 24 - flicker * 2,
        tx - 6,
        ty - 6,
        tx + 6,
        ty - 6
      );
      this.torchGlowGraphics.fillStyle(0xffffff, 0.9);
      this.torchGlowGraphics.fillCircle(tx, ty - 9, 3);
    });
  }

  private spawnTorchEmber(): void {
    const sconceXs = [235, 535, 745, 995];
    const tx = sconceXs[Math.floor(Math.random() * sconceXs.length)];
    const ember = this.add.circle(
      tx + Phaser.Math.Between(-4, 4),
      182,
      1.8,
      Math.random() < 0.5 ? PALETTE.GOLD_BRIGHT : 0xff7b29,
      0.85
    );
    this.ambientParticlesContainer.add(ember);
    this.tweens.add({
      targets: ember,
      x: ember.x + Phaser.Math.Between(-16, 16),
      y: ember.y - Phaser.Math.Between(28, 56),
      alpha: 0,
      duration: 950,
      onComplete: () => ember.destroy(),
    });
  }

  private getEnemySpritePrefix(): string {
    return this.session.enemy.role === 'LORD' ? 'fencer_norman' : 'fencer_guard';
  }

  private poseToKeySuffix(pose: FencerPose): string {
    return pose.toLowerCase();
  }

  /**
   * Synchronizes both pixel-art duelists AND their dramatic 1986 Cinemaware cast wall silhouettes
   * with the live `session.position` (-100..+100), poses, and torchlight flicker.
   */
  private syncDuelistSpritesAndShadows(): void {
    // Map position (-100..+100) smoothly across the castle hall floor (x: 250..940)
    const norm = (this.session.position + 100) / 200;
    const engagementCenterX = Phaser.Math.Linear(255, 935, norm);
    const baseFloorY = 368;
    const breathBob = this.isAnimatingExchange
      ? 0
      : Math.sin(this.envTimer * 0.9) * 1.5;

    const px = engagementCenterX - 66 + this.playerLungeOffsetPx;
    const ex = engagementCenterX + 66 + this.enemyLungeOffsetPx;

    const playerTex = `fencer_saxon_${this.poseToKeySuffix(this.currentPlayerPose)}`;
    const enemyTex = `${this.getEnemySpritePrefix()}_${this.poseToKeySuffix(
      this.currentEnemyPose
    )}`;

    if (this.textures.exists(playerTex)) {
      this.playerSprite.setTexture(playerTex);
      this.playerShadowSprite.setTexture(playerTex);
    }
    if (this.textures.exists(enemyTex)) {
      this.enemySprite.setTexture(enemyTex);
      this.enemyShadowSprite.setTexture(enemyTex);
    }

    this.playerSprite.setPosition(px, baseFloorY + breathBob);
    this.enemySprite.setPosition(ex, baseFloorY - breathBob);

    // Captive lady gentle cheer bob in Stage 3 Rescue
    if (this.captiveLadySprite) {
      this.captiveLadySprite.y = 294 + Math.sin(this.envTimer * 1.4) * 2;
    }

    // Dynamic Torch-Projected Wall Silhouettes (1986 Amiga Cinemaware Homage!)
    const torchJitter = Math.sin(this.envTimer * 4.2) * 2.2;
    const shadowAlpha = 0.39 + Math.cos(this.envTimer * 3.6) * 0.04;

    this.playerShadowSprite
      .setPosition(px - 22 + torchJitter, 294)
      .setAlpha(shadowAlpha);
    this.enemyShadowSprite
      .setPosition(ex + 22 - torchJitter, 294)
      .setAlpha(shadowAlpha);

    // Flagstone Ground Contact Shadows
    this.floorShadowGraphics.clear();
    this.floorShadowGraphics.fillStyle(0x06050a, 0.55);
    this.floorShadowGraphics.fillEllipse(px - 4, 444, 108, 18);
    this.floorShadowGraphics.fillEllipse(ex + 4, 444, 108, 18);

    // Floating Riposte Badge above Player
    if (this.session.player.riposteReady && this.session.status === 'ACTIVE') {
      this.riposteBadgeContainer.setVisible(true);
      this.riposteBadgeContainer.setPosition(px - 8, 252);
    } else {
      this.riposteBadgeContainer.setVisible(false);
    }
  }

  private updateTelegraphHud(): void {
    if (
      this.session.status !== 'ACTIVE' ||
      !this.session.telegraphedEnemyAction ||
      !this.session.telegraphZone ||
      this.activeTelegraphRemainingMs <= 0
    ) {
      this.telegraphIndicatorContainer.setVisible(false);
      return;
    }

    this.telegraphIndicatorContainer.setVisible(true);
    this.telegraphIndicatorContainer.setPosition(this.enemySprite.x + 6, 248);

    const ratio = Phaser.Math.Clamp(
      this.activeTelegraphRemainingMs /
        Math.max(1, this.session.telegraphDurationMs),
      0,
      1
    );

    const zone = this.session.telegraphZone;
    const zoneHint =
      zone === 'HIGH'
        ? '⚠ HIGH CLEAVE! [PARRY / 3-LOW]'
        : zone === 'MID'
        ? '⚠ MID LUNGE! [SPACE PARRY]'
        : '⚠ LOW SWEEP! [SPACE PARRY]';

    this.telegraphLabelText.setText(zoneHint);

    this.telegraphBarGraphics.clear();
    this.telegraphBarGraphics.fillStyle(0x280909, 0.92);
    this.telegraphBarGraphics.fillRoundedRect(-108, -28, 216, 36, 5);
    this.telegraphBarGraphics.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
    this.telegraphBarGraphics.strokeRoundedRect(-108, -28, 216, 36, 5);

    // Shrinking reaction window bar
    this.telegraphBarGraphics.fillStyle(0x160606, 1);
    this.telegraphBarGraphics.fillRect(-98, 0, 196, 5);
    this.telegraphBarGraphics.fillStyle(
      ratio > 0.35 ? PALETTE.GOLD_BRIGHT : PALETTE.BLOOD_RED,
      1
    );
    this.telegraphBarGraphics.fillRect(-98, 0, Math.round(196 * ratio), 5);
  }

  private refreshTopCorridorBar(): void {
    this.topCorridorGraphics.clear();

    // Ornate Header Panel (x: 330..950, y: 10..78, w: 620, h: 68)
    this.topCorridorGraphics.fillStyle(0x16141e, 0.92);
    this.topCorridorGraphics.fillRoundedRect(330, 10, 620, 68, 6);
    this.topCorridorGraphics.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    this.topCorridorGraphics.strokeRoundedRect(330, 10, 620, 68, 6);

    // 3 Room Progression Pips on Left & Right of Header
    for (let s = 1; s <= 3; s++) {
      const pipX = 354 + (s - 1) * 20;
      const cleared = s <= this.session.stagesCleared;
      const current = s === this.session.stageNumber && this.session.status === 'ACTIVE';
      this.topCorridorGraphics.fillStyle(
        cleared
          ? PALETTE.FOLIAGE_LIGHT
          : current
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.STONE_DARK,
        1
      );
      this.topCorridorGraphics.fillCircle(pipX, 25, 6);
      this.topCorridorGraphics.lineStyle(1, PALETTE.BLACK, 1);
      this.topCorridorGraphics.strokeCircle(pipX, 25, 6);
    }

    const currStage = this.session.stages[this.session.stageNumber - 1];
    this.topStageTitleText.setText(currStage.stageHeader);
    this.topRoomSubText.setText(currStage.roomTitle);

    // Live Footing / Push-Back Meter (-100 .. +100) at y: 54..72
    const barX = 396;
    const barY = 56;
    const barW = 488;
    const barH = 13;

    this.topCorridorGraphics.fillStyle(0x0c0b10, 1);
    this.topCorridorGraphics.fillRoundedRect(barX, barY, barW, barH, 3);

    // Player advantage fill vs Enemy push fill
    const centerBarX = barX + barW / 2;
    const posOffsetPx = (this.session.position / 100) * (barW / 2);
    if (posOffsetPx >= 0) {
      this.topCorridorGraphics.fillStyle(PALETTE.ROYAL_BLUE, 0.9);
      this.topCorridorGraphics.fillRect(centerBarX, barY + 1, posOffsetPx, barH - 2);
    } else {
      this.topCorridorGraphics.fillStyle(PALETTE.BLOOD_RED, 0.9);
      this.topCorridorGraphics.fillRect(
        centerBarX + posOffsetPx,
        barY + 1,
        -posOffsetPx,
        barH - 2
      );
    }

    this.topCorridorGraphics.lineStyle(1, PALETTE.GOLD_DARK, 0.8);
    this.topCorridorGraphics.strokeRoundedRect(barX, barY, barW, barH, 3);
    this.topCorridorGraphics.lineBetween(centerBarX, barY - 2, centerBarX, barY + barH + 2);

    // Marker pip
    this.topCorridorGraphics.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    this.topCorridorGraphics.fillCircle(centerBarX + posOffsetPx, barY + barH / 2, 5.5);

    const posSign =
      this.session.position > 0
        ? `+${this.session.position}`
        : `${this.session.position}`;
    this.footingReadoutText.setText(
      `◄ CORNERED (-100)          FOOTING: ${posSign}          SWORD-POINT YIELD (+100) ►`
    );
  }

  // ==========================================================================
  // BOTTOM FENCING COMMAND DECK (x: 0..1280, y: 500..720)
  // ==========================================================================

  private createBottomCommandDeck(): void {
    const deckBg = this.add.graphics().setDepth(100);
    deckBg.fillStyle(0x1e2029, 1);
    deckBg.fillRect(0, 500, 1280, 220);

    deckBg.fillStyle(0x13151c, 0.55);
    for (let y = 528; y < 720; y += 28) {
      deckBg.fillRect(0, y, 1280, 1.5);
    }

    deckBg.lineStyle(5, PALETTE.WOOD_DARK, 1);
    deckBg.strokeRect(2.5, 502.5, 1275, 215);
    deckBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    deckBg.strokeRect(6, 506, 1268, 208);

    this.leftCardContainer = this.add.container(0, 0).setDepth(105);
    this.centerControlsContainer = this.add.container(0, 0).setDepth(105);
    this.rightCardContainer = this.add.container(0, 0).setDepth(105);

    // Live Duel Ticker Box (x: 346..934, y: 668..708)
    const tickerBg = this.add.graphics().setDepth(104);
    tickerBg.fillStyle(0x100d0b, 0.94);
    tickerBg.fillRoundedRect(346, 668, 588, 40, 5);
    tickerBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    tickerBg.strokeRoundedRect(346, 668, 588, 40, 5);

    this.tickerText = this.add
      .text(358, 675, '', {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: '600',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        lineSpacing: 3,
        resolution: TEXT_RES,
      })
      .setDepth(106);

    // Centered Outcome Scroll Modal Container
    this.outcomeModalContainer = this.add
      .container(0, 0)
      .setDepth(500)
      .setVisible(false);
  }

  private refreshDuelistCards(): void {
    this.leftCardContainer.removeAll(true);
    this.rightCardContainer.removeAll(true);

    this.renderSingleDuelistCard(
      this.leftCardContainer,
      14,
      512,
      320,
      196,
      this.session.player,
      true
    );

    this.renderSingleDuelistCard(
      this.rightCardContainer,
      946,
      512,
      320,
      196,
      this.session.enemy,
      false
    );
  }

  private renderSingleDuelistCard(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    duelist: SwordplaySession['player'],
    isPlayer: boolean
  ): void {
    const g = this.add.graphics();
    g.fillStyle(PALETTE.WOOD_DARK, 0.96);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(
      2,
      isPlayer && duelist.riposteReady ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK,
      1
    );
    g.strokeRoundedRect(x, y, w, h, 6);

    g.fillStyle(0x141110, 0.88);
    g.fillRoundedRect(x + 8, y + 8, w - 16, h - 16, 4);
    container.add(g);

    const portraitKey = this.textures.exists(duelist.portraitKey)
      ? duelist.portraitKey
      : 'portrait_garrison';
    const portrait = this.add
      .image(x + 48, y + 48, portraitKey)
      .setDisplaySize(60, 60);
    container.add(portrait);

    const roleTag = isPlayer
      ? this.session.missionType === 'RESCUE'
        ? 'SAXON CHAMPION'
        : 'NIGHT INFILTRATOR'
      : `STAGE ${this.session.stageNumber}/3 DEFENDER`;

    const roleTxt = this.add.text(x + 88, y + 16, roleTag, {
      fontFamily: FONT_BODY,
      fontSize: '10.5px',
      fontStyle: 'bold',
      color: isPlayer ? '#82B1FF' : '#FF8A80',
      resolution: TEXT_RES,
    });

    const displayName =
      duelist.name.length > 22 ? duelist.name.slice(0, 21) + '…' : duelist.name;
    const nameTxt = this.add.text(x + 88, y + 32, displayName, {
      fontFamily: FONT_HEADING,
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      resolution: TEXT_RES,
    });

    const ratingStr = getCinemawareStatRating(duelist.swordplay);
    const dmgBonusPct = Math.round(
      (SwordplayEngine.getDamageMultiplier(duelist.swordplay) - 1) * 100
    );
    const skillTxt = this.add.text(
      x + 88,
      y + 55,
      `Swordplay: ${duelist.swordplay}/10 (${ratingStr} • +${dmgBonusPct}%)`,
      {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      }
    );
    container.add([roleTag ? roleTxt : roleTxt, nameTxt, skillTxt]);

    // Health / Vigor Bar
    const hpRatio = Phaser.Math.Clamp(duelist.health / duelist.maxHealth, 0, 1);
    const barX = x + 18;
    const barW = w - 36;

    const hpLbl = this.add.text(
      barX,
      y + 88,
      `VIGOR / HEALTH:  ${Math.ceil(duelist.health)} / ${duelist.maxHealth}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );
    container.add(hpLbl);

    g.fillStyle(0x0b0a0e, 1);
    g.fillRoundedRect(barX, y + 106, barW, 14, 3);
    g.fillStyle(
      hpRatio > 0.45
        ? isPlayer
          ? PALETTE.FOLIAGE_LIGHT
          : PALETTE.BLOOD_RED
        : 0xe65100,
      1
    );
    if (hpRatio > 0) {
      g.fillRoundedRect(barX + 1, y + 107, Math.max(4, (barW - 2) * hpRatio), 12, 2);
    }
    g.lineStyle(1, PALETTE.STONE_MID, 0.8);
    g.strokeRoundedRect(barX, y + 106, barW, 14, 3);

    // Stamina / Guard Bar
    const stamRatio = Phaser.Math.Clamp(duelist.stamina / duelist.maxStamina, 0, 1);
    const stamLbl = this.add.text(
      barX,
      y + 128,
      `STAMINA / POISE:  ${Math.round(duelist.stamina)} / ${duelist.maxStamina}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.SKY_LIGHT,
        resolution: TEXT_RES,
      }
    );
    container.add(stamLbl);

    g.fillStyle(0x0b0a0e, 1);
    g.fillRoundedRect(barX, y + 146, barW, 12, 3);
    g.fillStyle(
      duelist.riposteReady ? PALETTE.GOLD_BRIGHT : PALETTE.ROYAL_BLUE,
      1
    );
    if (stamRatio > 0) {
      g.fillRoundedRect(
        barX + 1,
        y + 147,
        Math.max(4, (barW - 2) * stamRatio),
        10,
        2
      );
    }
    g.lineStyle(1, PALETTE.STONE_MID, 0.8);
    g.strokeRoundedRect(barX, y + 146, barW, 12, 3);

    // Bottom Stance / Telegraph Status Line
    const statusText = isPlayer
      ? duelist.riposteReady
        ? '⚡ RIPOSTE ARMED: Next strike deals 1.6x damage!'
        : `Guard Stance: ${duelist.stance}`
      : this.session.telegraphZone
      ? `⚠ WINDING UP: ${this.session.telegraphZone} ATTACK!`
      : `Guard Stance: ${duelist.stance}`;

    const statusCol = isPlayer
      ? duelist.riposteReady
        ? PALETTE_HEX.GOLD_BRIGHT
        : PALETTE_HEX.PARCHMENT_DARK
      : this.session.telegraphZone
      ? '#FF8A65'
      : PALETTE_HEX.PARCHMENT_DARK;

    const footTxt = this.add.text(barX, y + 166, statusText, {
      fontFamily: FONT_BODY,
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: statusCol,
      resolution: TEXT_RES,
    });
    container.add(footTxt);
  }

  private refreshCenterButtons(): void {
    this.centerControlsContainer.removeAll(true);

    const canAct =
      this.session.status === 'ACTIVE' &&
      !this.isOutcomeModalOpen &&
      !this.isTransitioningStage &&
      !this.isLeavingScene;

    const riposteGlow = this.session.player.riposteReady;
    const telegraphActive = Boolean(this.session.telegraphedEnemyAction);

    // Row 1: 3 Fencing Strike Buttons (y: 514, h: 48)
    const strikes: Array<{
      action: SwordplayAction;
      x: number;
      w: number;
      title: string;
      sub: string;
    }> = [
      {
        action: 'ATTACK_HIGH',
        x: 346,
        w: 188,
        title: '[1 / Q] HIGH SLASH',
        sub: riposteGlow ? '⚡ 1.6x RIPOSTE CLEAVE' : 'Heavy Overhead Damage',
      },
      {
        action: 'ATTACK_MID',
        x: 546,
        w: 188,
        title: '[2 / W] MID THRUST',
        sub: riposteGlow ? '⚡ 1.6x RIPOSTE LUNGE' : 'Fastest Lunge Speed',
      },
      {
        action: 'ATTACK_LOW',
        x: 746,
        w: 188,
        title: '[3 / E] LOW SWEEP',
        sub: riposteGlow ? '⚡ 1.6x RIPOSTE SWEEP' : 'Ducks HIGH • Big Push',
      },
    ];

    for (const s of strikes) {
      this.addDeckButton(
        s.x,
        514,
        s.w,
        48,
        s.title,
        s.sub,
        canAct,
        riposteGlow ? 'GOLD' : 'CRIMSON',
        SWORDPLAY_ACTION_PROFILES[s.action].description,
        () => this.handlePlayerAction(s.action)
      );
    }

    // Row 2: Defense & Footwork (y: 570, h: 46)
    this.addDeckButton(
      346,
      570,
      334,
      46,
      '[SPACE / S]  PARRY & RIPOSTE',
      telegraphActive
        ? '★ PARRY NOW TO DEFLECT & ARM 1.6x RIPOSTE! ★'
        : 'Deflects strike • Restores Stamina • Arms 1.6x Riposte',
      canAct,
      telegraphActive ? 'GOLD' : 'AZURE',
      SWORDPLAY_ACTION_PROFILES.PARRY.description,
      () => this.handlePlayerAction('PARRY')
    );

    this.addDeckButton(
      692,
      570,
      242,
      46,
      '[A]  STEP BACK',
      'Recover +34 Stamina & Poise',
      canAct,
      'WOOD',
      SWORDPLAY_ACTION_PROFILES.STEP_BACK.description,
      () => this.handlePlayerAction('STEP_BACK')
    );

    // Row 3: Auto-Duel Toggle & Flee Castle (y: 624, h: 36)
    this.addDeckButton(
      346,
      624,
      288,
      36,
      this.autoDuelEnabled
        ? '⚔  [R] AUTO-DUEL: ON (FENCING...)'
        : '⚔  [R] AUTO-DUEL / RESOLVE',
      undefined,
      canAct,
      this.autoDuelEnabled ? 'GOLD' : 'WOOD',
      'Let thy Lord fence automatically using their Swordplay rating.',
      () => {
        this.autoDuelEnabled = !this.autoDuelEnabled;
        this.autoDuelCooldownMs = 0;
        this.refreshCenterButtons();
      }
    );

    this.addDeckButton(
      646,
      624,
      288,
      36,
      '🏃  [ESC] FLEE CASTLE',
      undefined,
      canAct,
      'STONE',
      'Abort night infiltration safely before being cornered (0 Gold lost).',
      () => this.handleFleeCastle()
    );
  }

  private addDeckButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    subLabel: string | undefined,
    enabled: boolean,
    theme: 'CRIMSON' | 'GOLD' | 'AZURE' | 'WOOD' | 'STONE',
    tooltip: string,
    onClick: () => void
  ): void {
    const g = this.add.graphics();

    const fillMap = {
      CRIMSON: 0x6e1818,
      GOLD: 0x6b4b0e,
      AZURE: 0x1c3f7a,
      WOOD: PALETTE.WOOD_DARK,
      STONE: 0x333642,
    };
    const borderMap = {
      CRIMSON: PALETTE.GOLD_DARK,
      GOLD: PALETTE.GOLD_BRIGHT,
      AZURE: PALETTE.SKY_LIGHT,
      WOOD: PALETTE.GOLD_DARK,
      STONE: PALETTE.STONE_LIGHT,
    };

    const draw = (hover: boolean) => {
      g.clear();
      const fill = !enabled
        ? 0x2a2c36
        : hover
        ? PALETTE.BLOOD_RED
        : fillMap[theme];
      const border = !enabled
        ? PALETTE.STONE_DARK
        : hover
        ? PALETTE.GOLD_BRIGHT
        : borderMap[theme];

      g.fillStyle(fill, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      g.lineStyle(hover || theme === 'GOLD' ? 2 : 1.5, border, 1);
      g.strokeRoundedRect(x, y, w, h, 5);
    };

    draw(false);
    this.centerControlsContainer.add(g);

    const titleY = subLabel ? y + h * 0.36 : y + h * 0.5;
    const titleTxt = this.add
      .text(x + w / 2, titleY, label, {
        fontFamily: FONT_BODY,
        fontSize: subLabel ? '12.5px' : '12px',
        fontStyle: 'bold',
        color: !enabled
          ? PALETTE_HEX.STONE_MID
          : theme === 'GOLD'
          ? PALETTE_HEX.GOLD_BRIGHT
          : '#FFFFFF',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.centerControlsContainer.add(titleTxt);

    if (subLabel) {
      const subTxt = this.add
        .text(x + w / 2, y + h * 0.73, subLabel, {
          fontFamily: FONT_BODY,
          fontSize: '10px',
          fontStyle: '600',
          color: !enabled ? PALETTE_HEX.STONE_MID : PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);
      this.centerControlsContainer.add(subTxt);
    }

    if (enabled) {
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        draw(true);
        this.hoveredHint = tooltip;
        this.refreshTicker();
      });
      zone.on('pointerout', () => {
        draw(false);
        this.hoveredHint = null;
        this.refreshTicker();
      });
      zone.on('pointerdown', onClick);
      this.centerControlsContainer.add(zone);
    }
  }

  private refreshTicker(): void {
    if (this.hoveredHint) {
      this.tickerText.setText(`💡 ${this.hoveredHint}`);
      this.tickerText.setColor(PALETTE_HEX.GOLD_BRIGHT);
      return;
    }

    const recent = this.session.tickerLog.slice(-2);
    this.tickerText.setText(recent.map((l) => `• ${l}`).join('\n'));
    this.tickerText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
  }

  // ==========================================================================
  // INPUTS, ANIMATIONS & STAGE TRANSITIONS
  // ==========================================================================

  private setupKeyboardControls(): void {
    const kb = this.input.keyboard;
    if (!kb) return;

    const trigger = (action: SwordplayAction) => {
      if (this.autoDuelEnabled) {
        this.autoDuelEnabled = false;
        this.refreshCenterButtons();
      }
      this.handlePlayerAction(action);
    };

    kb.on('keydown-ONE', () => trigger('ATTACK_HIGH'));
    kb.on('keydown-Q', () => trigger('ATTACK_HIGH'));

    kb.on('keydown-TWO', () => trigger('ATTACK_MID'));
    kb.on('keydown-W', () => trigger('ATTACK_MID'));

    kb.on('keydown-THREE', () => trigger('ATTACK_LOW'));
    kb.on('keydown-E', () => trigger('ATTACK_LOW'));

    kb.on('keydown-SPACE', () => {
      if (this.isOutcomeModalOpen) return;
      trigger('PARRY');
    });
    kb.on('keydown-S', () => trigger('PARRY'));

    kb.on('keydown-A', () => trigger('STEP_BACK'));

    kb.on('keydown-R', () => {
      if (
        this.session.status === 'ACTIVE' &&
        !this.isOutcomeModalOpen &&
        !this.isTransitioningStage
      ) {
        this.autoDuelEnabled = !this.autoDuelEnabled;
        this.autoDuelCooldownMs = 0;
        this.refreshCenterButtons();
      }
    });

    kb.on('keydown-ESC', () => {
      if (
        this.session.status === 'ACTIVE' &&
        !this.isOutcomeModalOpen &&
        !this.isTransitioningStage
      ) {
        this.handleFleeCastle();
      }
    });
  }

  private handlePlayerAction(action: SwordplayAction): void {
    if (
      this.session.status !== 'ACTIVE' ||
      this.isAnimatingExchange ||
      this.isTransitioningStage ||
      this.isOutcomeModalOpen ||
      this.isLeavingScene ||
      this.playerActionCooldownMs > 0
    ) {
      return;
    }

    this.playerActionCooldownMs = 150;
    const inTelegraph = Boolean(this.session.telegraphedEnemyAction);

    // If player presses PARRY right as they match stance, lock in incoming zone if reacting during telegraph
    if (
      action === 'PARRY' &&
      inTelegraph &&
      this.session.telegraphZone &&
      this.activeTelegraphRemainingMs > 60
    ) {
      this.session.player.stance = this.session.telegraphZone;
    }

    this.activeTelegraphRemainingMs = 0;
    const report = SwordplayEngine.executeExchange(this.session, action, {
      inTelegraphWindow: inTelegraph,
    });

    this.playExchangeAnimation(report, false);
  }

  private executeAutoDuelStep(): void {
    if (
      this.session.status !== 'ACTIVE' ||
      this.isAnimatingExchange ||
      this.isTransitioningStage ||
      this.isOutcomeModalOpen
    ) {
      return;
    }

    // Read pre-exchange stageNumber because stepAutoDuelExchange auto-advances stages;
    // in interactive UI we use executeExchange directly so we can play the cinematic room transition!
    if (!this.session.telegraphedEnemyAction && Math.random() < 0.45) {
      const tel = SwordplayEngine.beginEnemyTelegraph(this.session);
      this.activeTelegraphRemainingMs = tel.durationMs;
      this.currentEnemyPose =
        tel.zone === 'HIGH'
          ? 'WINDUP_HIGH'
          : tel.zone === 'MID'
          ? 'WINDUP_MID'
          : 'WINDUP_LOW';
      this.refreshCenterButtons();
      this.refreshDuelistCards();
      this.updateTelegraphHud();
      return;
    }

    let chosen: SwordplayAction = 'ATTACK_MID';
    if (this.session.player.riposteReady) {
      chosen =
        this.session.enemy.stance === 'HIGH' ? 'ATTACK_LOW' : 'ATTACK_HIGH';
    } else if (this.session.player.stamina < 20 && this.session.position > -65) {
      chosen = 'STEP_BACK';
    } else if (this.session.telegraphedEnemyAction) {
      const readProb = 0.28 + this.session.player.swordplay * 0.068;
      if (Math.random() < readProb) {
        if (this.session.telegraphZone) {
          this.session.player.stance = this.session.telegraphZone;
        }
        chosen = 'PARRY';
      } else {
        chosen = 'ATTACK_MID';
      }
    } else {
      const r = Math.random();
      chosen =
        r < 0.38 ? 'ATTACK_MID' : r < 0.7 ? 'ATTACK_LOW' : 'ATTACK_HIGH';
    }

    const inTel = Boolean(this.session.telegraphedEnemyAction);
    this.activeTelegraphRemainingMs = 0;
    const report = SwordplayEngine.executeExchange(this.session, chosen, {
      inTelegraphWindow: inTel,
    });
    this.playExchangeAnimation(report, false);
  }

  private playExchangeAnimation(
    report: SwordplayExchangeReport,
    wasUnansweredStrike: boolean
  ): void {
    this.isAnimatingExchange = true;
    this.idleUntilTelegraphMs = Phaser.Math.Between(760, 1140);
    this.updateTelegraphHud();

    // Determine expressive pixel-art poses for both duelists
    this.currentPlayerPose = wasUnansweredStrike
      ? 'STAGGER'
      : this.actionToPose(report.playerAction, report.outcome, true);
    this.currentEnemyPose = this.actionToPose(
      report.enemyAction,
      report.outcome,
      false
    );

    if (report.stageCleared) {
      this.currentEnemyPose = 'DEFEAT';
    } else if (report.outcome === 'PLAYER_DEFEATED') {
      this.currentPlayerPose = 'DEFEAT';
    }

    // Lunge / Recoil horizontal snap
    const lungeTarget = {
      pOff:
        report.playerAction.startsWith('ATTACK') &&
        report.outcome !== 'ENEMY_HIT'
          ? 24
          : report.outcome === 'ENEMY_HIT'
          ? -16
          : 0,
      eOff:
        report.outcome === 'ENEMY_HIT' || report.outcome === 'PLAYER_DEFEATED'
          ? -24
          : report.playerDamageDealt > 0
          ? 16
          : 0,
    };

    this.playerLungeOffsetPx = lungeTarget.pOff;
    this.enemyLungeOffsetPx = lungeTarget.eOff;
    this.syncDuelistSpritesAndShadows();

    // Steel Clash Sparks & Camera Micro-Shake
    const clashX = (this.playerSprite.x + this.enemySprite.x) * 0.5;
    const clashY =
      report.playerAction === 'ATTACK_HIGH' ||
      report.enemyAction === 'ATTACK_HIGH'
        ? 334
        : report.playerAction === 'ATTACK_LOW' ||
          report.enemyAction === 'ATTACK_LOW'
        ? 392
        : 362;

    if (report.outcome !== 'PLAYER_RECOVERED') {
      this.spawnSteelSparks(
        clashX,
        clashY,
        report.riposteTriggered || report.outcome === 'PLAYER_PARRY_SUCCESS'
          ? 10
          : 6
      );
      if (
        report.riposteTriggered ||
        report.playerDamageDealt >= 18 ||
        report.enemyDamageDealt >= 16
      ) {
        this.cameras.main.shake(110, 0.0035);
      }
    }

    // Floating Callout
    const colorMap: Record<SwordplayExchangeReport['calloutColor'], string> = {
      GOLD: PALETTE_HEX.GOLD_BRIGHT,
      CRIMSON: '#FF6B6B',
      AZURE: PALETTE_HEX.SKY_LIGHT,
      EMERALD: '#7CFFB2',
      SILVER: PALETTE_HEX.PARCHMENT_LIGHT,
    };
    if (report.calloutText) {
      this.spawnFloatingCallout(
        clashX,
        292,
        report.calloutText,
        colorMap[report.calloutColor]
      );
    }

    this.refreshTopCorridorBar();
    this.refreshDuelistCards();
    this.refreshCenterButtons();
    this.refreshTicker();

    // Settle back to EN_GARDE or advance stage / open outcome modal
    this.time.delayedCall(290, () => {
      if (!this.scene || !this.scene.isActive()) return;

      this.playerLungeOffsetPx = 0;
      this.enemyLungeOffsetPx = 0;

      if (report.stageCleared && this.session.stageNumber < 3) {
        this.isAnimatingExchange = false;
        this.transitionToNextCastleRoom();
        return;
      }

      if (
        this.session.status === 'VICTORY' ||
        this.session.status === 'DEFEATED'
      ) {
        this.isAnimatingExchange = false;
        if (this.session.status === 'VICTORY') {
          this.celebrateVaultOrDamselAndShowModal();
        } else {
          this.openOutcomeScrollModal();
        }
        return;
      }

      this.currentPlayerPose = 'EN_GARDE';
      this.currentEnemyPose = 'EN_GARDE';
      this.isAnimatingExchange = false;
      this.syncDuelistSpritesAndShadows();
      this.refreshCenterButtons();
      this.refreshDuelistCards();
    });
  }

  private actionToPose(
    action: SwordplayAction,
    outcome: SwordplayExchangeReport['outcome'],
    isPlayer: boolean
  ): FencerPose {
    if (isPlayer && outcome === 'ENEMY_HIT') return 'STAGGER';
    if (
      !isPlayer &&
      (outcome === 'PLAYER_HIT' ||
        outcome === 'PLAYER_RIPOSTE_HIT' ||
        outcome === 'PLAYER_GUARD_BREAK')
    ) {
      return 'STAGGER';
    }
    if (action === 'PARRY') return 'PARRY';
    if (action === 'ATTACK_HIGH') return 'ATTACK_HIGH';
    if (action === 'ATTACK_MID') return 'ATTACK_MID';
    if (action === 'ATTACK_LOW') return 'ATTACK_LOW';
    return 'EN_GARDE';
  }

  private spawnSteelSparks(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const spark = this.add
        .image(x, y, 'fx_steel_spark')
        .setScale(Phaser.Math.FloatBetween(0.75, 1.35));
      this.clashFxContainer.add(spark);

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(28, 78);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed + 14,
        angle: Phaser.Math.Between(-140, 140),
        scale: 0.2,
        alpha: 0,
        duration: Phaser.Math.Between(260, 440),
        onComplete: () => spark.destroy(),
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
        fontSize: '15.5px',
        fontStyle: 'bold',
        color,
        stroke: '#0B0D14',
        strokeThickness: 4,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.clashFxContainer.add(lbl);

    this.tweens.add({
      targets: lbl,
      y: y - 36,
      alpha: 0,
      duration: 880,
      ease: 'Cubic.easeOut',
      onComplete: () => lbl.destroy(),
    });
  }

  private transitionToNextCastleRoom(): void {
    this.isTransitioningStage = true;
    this.refreshCenterButtons();

    this.spawnFloatingCallout(
      640,
      215,
      '⚔ CHAMBER CLEARED! ASCENDING STAIRS... ⚔',
      PALETTE_HEX.GOLD_BRIGHT
    );

    this.tweens.add({
      targets: this.playerSprite,
      x: 1090,
      y: 325,
      duration: 460,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.scene || !this.scene.isActive()) return;
        this.cameras.main.flash(180, 18, 14, 24);

        SwordplayEngine.advanceToNextStage(this.session);
        this.currentPlayerPose = 'EN_GARDE';
        this.currentEnemyPose = 'EN_GARDE';
        this.idleUntilTelegraphMs = 920;
        this.activeTelegraphRemainingMs = 0;

        this.rebuildStageRoomProps();
        this.syncDuelistSpritesAndShadows();
        this.refreshTopCorridorBar();
        this.refreshDuelistCards();
        this.refreshTicker();

        this.isTransitioningStage = false;
        this.refreshCenterButtons();
      },
    });
  }

  private celebrateVaultOrDamselAndShowModal(): void {
    if (this.vaultChestLeft) {
      this.vaultChestLeft.setTexture('prop_treasure_chest_open');
      this.spawnSteelSparks(this.vaultChestLeft.x, this.vaultChestLeft.y - 16, 10);
    }
    if (this.vaultChestRight) {
      this.vaultChestRight.setTexture('prop_treasure_chest_open');
      this.spawnSteelSparks(this.vaultChestRight.x, this.vaultChestRight.y - 16, 10);
    }

    this.time.delayedCall(480, () => {
      if (!this.scene || !this.scene.isActive()) return;
      this.openOutcomeScrollModal();
    });
  }

  private handleFleeCastle(): void {
    if (this.session.status !== 'ACTIVE' || this.isOutcomeModalOpen) return;
    this.autoDuelEnabled = false;
    SwordplayEngine.fleeCastle(this.session);
    const summary = SwordplayEngine.commitMissionOutcome(
      this.session,
      GameState.getInstance()
    );
    this.returnToCampaignMap(summary.chronicleMessage, false);
  }

  // ==========================================================================
  // CINEMATIC OUTCOME MODALS (RAID LOOT / MARRIAGE SCROLL / ROBIN HOOD BAILOUT)
  // ==========================================================================

  private openOutcomeScrollModal(): void {
    this.isOutcomeModalOpen = true;
    this.autoDuelEnabled = false;
    this.refreshCenterButtons();

    const gameState = GameState.getInstance();
    const liveState = gameState.getState();

    // If DEFEATED and Robin Hood still has favors (> 0), let the player CHOOSE Robin Hood bailout vs 50% Ransom!
    if (
      this.session.status === 'DEFEATED' &&
      !this.session.committed &&
      liveState.robinHoodUsesLeft > 0
    ) {
      this.renderDefeatChoiceModal(liveState.robinHoodUsesLeft);
      return;
    }

    const summary = SwordplayEngine.commitMissionOutcome(this.session, gameState, {
      useRobinHoodBailout: false,
    });
    this.renderFinalSummaryModal(summary);
  }

  private renderDefeatChoiceModal(robinUsesLeft: number): void {
    this.outcomeModalContainer.removeAll(true);
    this.outcomeModalContainer.setVisible(true);

    const gameState = GameState.getInstance();
    const player = gameState.getPlayerLord();
    const ransom = SwordplayEngine.calculateDefeatRansom(player.gold);

    this.drawModalBackdropAndScroll(760, 420);

    const header = this.add
      .text(640, 198, '⛓  CORNERED BY CASTLE GUARDS!  ⛓', {
        fontFamily: FONT_HEADING,
        fontSize: '26px',
        fontStyle: 'bold',
        color: PALETTE_HEX.BLOOD_RED,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const portrait = this.add
      .image(400, 298, `portrait_${player.id}`)
      .setDisplaySize(76, 76);
    const robinIcon = this.add
      .image(880, 298, 'icon_sherwood')
      .setDisplaySize(72, 72);

    const bodyTxt = this.add
      .text(
        640,
        298,
        `${this.session.targetLordName}'s men-at-arms surround thee in\n${this.session.targetTerritoryName} and demand a 50% Ransom (${ransom} Gold)!\n\nYet word reaches Sherwood Forest — Robin of Locksley\ncan storm the dungeon and break thee free for 0 Gold lost!`,
        {
          fontFamily: FONT_BODY,
          fontSize: '15px',
          fontStyle: '600',
          color: '#1F1A14',
          align: 'center',
          lineSpacing: 6,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);

    this.outcomeModalContainer.add([header, portrait, robinIcon, bodyTxt]);

    // Choice 1: Summon Robin Hood (-1 use, 0 Gold lost!)
    this.addModalButton(
      305,
      405,
      330,
      50,
      `🏹 ROBIN HOOD RESCUE (0G LOST • ${robinUsesLeft}/3)`,
      true,
      () => {
        const summary = SwordplayEngine.commitMissionOutcome(
          this.session,
          gameState,
          { useRobinHoodBailout: true }
        );
        this.renderFinalSummaryModal(summary);
      }
    );

    // Choice 2: Pay 50% Ransom
    this.addModalButton(
      655,
      405,
      320,
      50,
      `💰 PAY RANSOM (-${ransom} GOLD)`,
      false,
      () => {
        const summary = SwordplayEngine.commitMissionOutcome(
          this.session,
          gameState,
          { useRobinHoodBailout: false }
        );
        this.renderFinalSummaryModal(summary);
      }
    );
  }

  private renderFinalSummaryModal(summary: SwordplayOutcomeSummary): void {
    this.outcomeModalContainer.removeAll(true);
    this.outcomeModalContainer.setVisible(true);

    this.drawModalBackdropAndScroll(760, 430);

    const isWin = summary.status === 'VICTORY';
    const isRobinBreakout = summary.robinHoodBailoutUsed;
    const player = GameState.getInstance().getPlayerLord();

    const headerColor = isWin
      ? PALETTE_HEX.ROYAL_BLUE
      : isRobinBreakout
      ? PALETTE_HEX.FOLIAGE_DARK
      : PALETTE_HEX.BLOOD_RED;

    const header = this.add
      .text(640, 194, `★  ${summary.headline}  ★`, {
        fontFamily: FONT_HEADING,
        fontSize: '26px',
        fontStyle: 'bold',
        color: headerColor,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.outcomeModalContainer.add(header);

    if (isWin && summary.missionType === 'RESCUE' && summary.rescuedDamsel) {
      // Celebratory Romantic / Marriage Scroll!
      const lady = summary.rescuedDamsel;
      const pImg = this.add
        .image(490, 276, `portrait_${player.id}`)
        .setDisplaySize(76, 76);
      const lImg = this.add
        .image(790, 276, `portrait_${lady.id}`)
        .setDisplaySize(76, 76);
      const heartShield = this.add
        .image(640, 276, `shield_${player.id}`)
        .setDisplaySize(44, 56);

      const quoteTxt = this.add
        .text(640, 336, `${lady.name} — ${lady.title}\n${lady.quote}`, {
          fontFamily: 'Georgia, serif',
          fontSize: '15px',
          fontStyle: 'italic',
          color: PALETTE_HEX.WOOD_DARK,
          align: 'center',
          lineSpacing: 4,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      const secLabel =
        summary.secondaryStatName === 'jousting' ? 'Jousting' : 'Swordplay';
      const bonusBanner = this.add
        .text(
          640,
          388,
          `DOWRY: +${lady.dowryGold} Gold   •   +${summary.leadershipGained} Permanent Leadership   •   +${summary.secondaryStatGained} ${secLabel}`,
          {
            fontFamily: FONT_BODY,
            fontSize: '14.5px',
            fontStyle: 'bold',
            color: PALETTE_HEX.BLOOD_RED,
            resolution: TEXT_RES,
          }
        )
        .setOrigin(0.5);

      this.outcomeModalContainer.add([
        pImg,
        lImg,
        heartShield,
        quoteTxt,
        bonusBanner,
      ]);
    } else if (isWin && summary.missionType === 'RAID') {
      // Plundered Treasury Vault Scroll!
      const chest = this.add
        .image(430, 304, 'prop_treasure_chest_open')
        .setScale(2.1);

      const vaultNote =
        summary.vaultBonusGold > 0
          ? `(Includes +${summary.vaultBonusGold}G hidden vault bullion!)`
          : `(60% of ${summary.targetLordName}'s liquid treasury!)`;

      const lootTxt = this.add
        .text(
          690,
          304,
          `Stronghold Plundered: ${summary.targetTerritoryName}\nGold Seized: +${summary.goldStolenTotal} Gold\n${vaultNote}\n\nThy Royal Treasury: ${player.gold} Gold`,
          {
            fontFamily: FONT_BODY,
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#1E1A14',
            align: 'center',
            lineSpacing: 6,
            resolution: TEXT_RES,
          }
        )
        .setOrigin(0.5);

      this.outcomeModalContainer.add([chest, lootTxt]);
    } else {
      // Defeat / Robin Hood Escape Summary
      const iconKey = isRobinBreakout
        ? 'icon_sherwood'
        : `portrait_${summary.targetLordId}`;
      const safeKey = this.textures.exists(iconKey)
        ? iconKey
        : 'portrait_garrison';
      const icon = this.add.image(420, 304, safeKey).setDisplaySize(76, 76);

      const bodyStr = isRobinBreakout
        ? `Robin of Locksley and his Merry Men Loosed a volley of\nclothyard shafts and broke thee free from ${summary.targetTerritoryName}!\n\nGold Lost: 0 Gold  •  Sherwood Favors Remaining: ${summary.robinHoodUsesRemaining}/3`
        : `Captured inside ${summary.targetTerritoryName}!\nPaid 50% Ransom (-${summary.ransomPaid} Gold) to ${summary.targetLordName}.\n\nRemaining Treasury: ${player.gold} Gold`;

      const defTxt = this.add
        .text(685, 304, bodyStr, {
          fontFamily: FONT_BODY,
          fontSize: '15.5px',
          fontStyle: '600',
          color: '#1E1A14',
          align: 'center',
          lineSpacing: 6,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      this.outcomeModalContainer.add([icon, defTxt]);
    }

    this.addModalButton(
      440,
      422,
      400,
      48,
      '⚔   RETURN TO CAMPAIGN MAP   ⚔',
      true,
      () => this.returnToCampaignMap(summary.chronicleMessage, !isWin && !isRobinBreakout)
    );
  }

  private drawModalBackdropAndScroll(w: number, h: number): void {
    const x = (1280 - w) / 2;
    const y = (660 - h) / 2;

    const g = this.add.graphics();
    g.fillStyle(PALETTE.BLACK, 0.76);
    g.fillRect(0, 0, 1280, 720);

    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(4, PALETTE.GOLD_BRIGHT, 1);
    g.strokeRoundedRect(x, y, w, h, 10);

    g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    g.fillRoundedRect(x + 16, y + 16, w - 32, h - 32, 6);
    g.lineStyle(1.5, PALETTE.WOOD_MID, 0.85);
    g.strokeRoundedRect(x + 22, y + 22, w - 44, h - 44, 4);

    // Interactive blocker behind modal
    const blocker = this.add
      .zone(640, 360, 1280, 720)
      .setInteractive();
    this.outcomeModalContainer.add([blocker, g]);
  }

  private addModalButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    primary: boolean,
    onClick: () => void
  ): void {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(
        hover
          ? PALETTE.BLOOD_RED
          : primary
          ? 0x6e1818
          : PALETTE.WOOD_DARK,
        1
      );
      g.fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(
        2,
        hover || primary ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK,
        1
      );
      g.strokeRoundedRect(x, y, w, h, 6);
    };
    draw(false);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: FONT_BODY,
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerdown', onClick);

    this.outcomeModalContainer.add([g, txt, zone]);
  }

  private returnToCampaignMap(message: string, isAlert: boolean): void {
    if (this.isLeavingScene) return;
    this.isLeavingScene = true;

    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene', {
        lastBattleMessage: message,
        lastBattleAlert: isAlert,
        focusTerritoryId: this.session.targetTerritoryId,
      });
    });
  }
}
