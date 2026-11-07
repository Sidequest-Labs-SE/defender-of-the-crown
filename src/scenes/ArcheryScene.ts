import Phaser from 'phaser';
import { ArcheryEngine } from '../core/ArcheryEngine';
import { GameState } from '../core/GameState';
import {
  ArcheryHitZone,
  ArcherySession,
  ArcheryShotResult,
  ArcheryTournamentResult,
} from '../core/types';
import { PALETTE_HEX } from '../data/palette';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { AudioManager } from '../utils/AudioManager';

const FONT_TITLE = 'Cinzel, Georgia, serif';
const FONT_BODY = 'Inter, "Segoe UI", system-ui, sans-serif';

export class ArcheryScene extends Phaser.Scene {
  private session!: ArcherySession;
  private gameState!: GameState;

  // Aiming and Ballistics
  private aimX = 0;
  private aimY = 0;
  private isAiming = true;
  private isArrowInFlight = false;
  private swayElapsed = 0;

  // Visual Entities
  private bowContainer!: Phaser.GameObjects.Container;
  private bowSprite!: Phaser.GameObjects.Sprite;
  private arrowSprite!: Phaser.GameObjects.Sprite;
  private crosshairGraphics!: Phaser.GameObjects.Graphics;
  private windRibbonGraphics!: Phaser.GameObjects.Graphics;
  private targetCamGraphics!: Phaser.GameObjects.Graphics;

  // UI Texts
  private roundText!: Phaser.GameObjects.Text;
  private windText!: Phaser.GameObjects.Text;
  private arrowsLeftText!: Phaser.GameObjects.Text;
  private playerScoreText!: Phaser.GameObjects.Text;
  private rivalScoreText!: Phaser.GameObjects.Text;
  private commentaryText!: Phaser.GameObjects.Text;
  private autoShootButton!: Phaser.GameObjects.Container;

  // Input Keys
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;

  // Target impact history for Zoom Cam
  private playerZoomHits: Array<{ x: number; y: number; zone: ArcheryHitZone }> = [];
  private rivalZoomHits: Array<{ x: number; y: number; zone: ArcheryHitZone }> = [];

  constructor() {
    super({ key: 'ArcheryScene' });
  }

  create(): void {
    this.gameState = GameState.getInstance();
    PixelArtGenerator.generateAll(this);
    SidequestArtGenerator.generateAll(this);

    // Initialize Archery Engine Session
    this.session = ArcheryEngine.createSession(this.gameState.getState());
    this.playerZoomHits = [];
    this.rivalZoomHits = [];

    // Background Scene Graphics: Sherwood Forest Clearing
    this.createSherwoodBackdrop();

    // Target Butt
    this.add
      .sprite(640, 310, 'sq_archery_target')
      .setScale(0.72)
      .setOrigin(0.5);

    // Target Stand Legs
    const tripod = this.add.graphics();
    tripod.lineStyle(4, 0x3d2410, 1);
    tripod.beginPath();
    tripod.moveTo(615, 335);
    tripod.lineTo(595, 410);
    tripod.moveTo(665, 335);
    tripod.lineTo(685, 410);
    tripod.moveTo(640, 335);
    tripod.lineTo(640, 420);
    tripod.stroke();

    // Zoomed Target Cam Inset (Top Right)
    this.createZoomedTargetCam();

    // HUD and Scoreboard
    this.createHUD();

    // Player Longbow & Reticle
    this.createBowAndArrow();

    // Wind Ribbon
    this.windRibbonGraphics = this.add.graphics();

    // Crosshair Graphics
    this.crosshairGraphics = this.add.graphics();

    // Setup Keyboard & Mouse Listeners
    this.setupControls();

    // Audio
    AudioManager.playTheme('title');
  }

  private createSherwoodBackdrop(): void {
    const bg = this.add.graphics();

    // Lush forest sky gradient
    bg.fillGradientStyle(0x7da46d, 0x7da46d, 0x22491a, 0x22491a, 1);
    bg.fillRect(0, 0, 1280, 450);

    // Ancient Sherwood Oaks & Foliage
    bg.fillStyle(0x133010, 1);
    bg.fillCircle(160, 200, 180);
    bg.fillCircle(380, 180, 140);
    bg.fillCircle(900, 170, 150);
    bg.fillCircle(1140, 210, 190);

    // Sunlight god-rays filtering through foliage
    bg.fillStyle(0xfff7c2, 0.08);
    bg.beginPath();
    bg.moveTo(400, 0);
    bg.lineTo(520, 0);
    bg.lineTo(720, 720);
    bg.lineTo(560, 720);
    bg.closePath();
    bg.fill();

    bg.beginPath();
    bg.moveTo(780, 0);
    bg.lineTo(890, 0);
    bg.lineTo(1020, 720);
    bg.lineTo(880, 720);
    bg.closePath();
    bg.fill();

    // Grassy Range & Shooting Meadow
    bg.fillGradientStyle(0x2d5a27, 0x2d5a27, 0x1b3c17, 0x1b3c17, 1);
    bg.fillRect(0, 350, 1280, 370);

    // Tournament Roping & Distance Stakes
    bg.lineStyle(2, 0xa16207, 0.8);
    bg.beginPath();
    bg.moveTo(0, 430);
    bg.lineTo(1280, 430);
    bg.stroke();

    // Royal Robin Hood Pennants
    bg.fillStyle(0xd97706, 1);
    bg.fillTriangle(240, 410, 265, 410, 252, 435);
    bg.fillTriangle(1015, 410, 1040, 410, 1027, 435);
  }

  private createZoomedTargetCam(): void {
    const camX = 1040;
    const camY = 135;

    // Bevelled Frame
    const frame = this.add.graphics();
    frame.fillStyle(0x0f172a, 0.85);
    frame.fillRoundedRect(camX - 110, camY - 110, 220, 220, 10);
    frame.lineStyle(2, 0xd97706, 1);
    frame.strokeRoundedRect(camX - 110, camY - 110, 220, 220, 10);

    this.add
      .text(camX, camY - 96, 'TARGET INSET CAM', {
        fontFamily: FONT_TITLE,
        fontSize: '11px',
        color: PALETTE_HEX.GOLD_BRIGHT,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Target Cam Straw Butt
    this.add.sprite(camX, camY + 12, 'sq_archery_target').setScale(1.25);

    this.targetCamGraphics = this.add.graphics();
    this.redrawTargetCam();
  }

  private redrawTargetCam(): void {
    this.targetCamGraphics.clear();
    const camX = 1040;
    const camY = 135 + 12;
    const scale = 1.25;

    // Draw Rival hits in grey/silver
    for (const h of this.rivalZoomHits) {
      this.targetCamGraphics.fillStyle(0x94a3b8, 1);
      this.targetCamGraphics.fillCircle(camX + h.x * scale, camY + h.y * scale, 3);
      this.targetCamGraphics.lineStyle(1, 0x000000, 1);
      this.targetCamGraphics.strokeCircle(camX + h.x * scale, camY + h.y * scale, 3);
    }

    // Draw Player hits with gold rings
    for (const h of this.playerZoomHits) {
      this.targetCamGraphics.fillStyle(
        h.zone === 'ROBIN_HOOD_SPLIT' ? 0x10b981 : 0xd97706,
        1
      );
      this.targetCamGraphics.fillCircle(camX + h.x * scale, camY + h.y * scale, 4);
      this.targetCamGraphics.lineStyle(1, 0xffffff, 1);
      this.targetCamGraphics.strokeCircle(camX + h.x * scale, camY + h.y * scale, 4);
    }
  }

  private createHUD(): void {
    // 1. Top Header Banner
    const banner = this.add.graphics();
    banner.fillStyle(0x0f172a, 0.9);
    banner.fillRect(0, 0, 1280, 56);
    banner.lineStyle(2, 0xd97706, 0.8);
    banner.lineBetween(0, 56, 1280, 56);

    this.add
      .text(640, 16, 'SHERWOOD LONGBOW TOURNAMENT', {
        fontFamily: FONT_TITLE,
        fontSize: '20px',
        color: PALETTE_HEX.GOLD_BRIGHT,
        fontStyle: 'bold',
        letterSpacing: 2,
      })
      .setOrigin(0.5);

    const round = this.session.rounds[this.session.currentRound - 1];
    this.roundText = this.add
      .text(640, 38, `ROUND 1/2 — ${round.distancePaces} PACES`, {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#E2E8F0',
      })
      .setOrigin(0.5);

    // 2. Scoreboard (Top Left)
    const scoreBox = this.add.graphics();
    scoreBox.fillStyle(0x0f172a, 0.85);
    scoreBox.fillRoundedRect(20, 68, 280, 96, 8);
    scoreBox.lineStyle(2, 0xd97706, 0.8);
    scoreBox.strokeRoundedRect(20, 68, 280, 96, 8);

    const pName = this.session.playerName;
    const rName = this.session.rivalName;

    this.add
      .text(32, 78, pName.toUpperCase(), {
        fontFamily: FONT_TITLE,
        fontSize: '13px',
        color: PALETTE_HEX.GOLD_BRIGHT,
        fontStyle: 'bold',
      });

    this.playerScoreText = this.add.text(280, 78, '0 PTS', {
      fontFamily: FONT_BODY,
      fontSize: '14px',
      color: '#10B981',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    this.add
      .text(32, 102, `${rName.toUpperCase()} (RIVAL)`, {
        fontFamily: FONT_TITLE,
        fontSize: '12px',
        color: '#CBD5E1',
      });

    this.rivalScoreText = this.add.text(280, 102, '0 PTS', {
      fontFamily: FONT_BODY,
      fontSize: '14px',
      color: '#CBD5E1',
      fontStyle: 'bold',
    }).setOrigin(1, 0);

    this.arrowsLeftText = this.add.text(
      32,
      134,
      'ARROWS: [↑] [↑] [↑] (Shot 1 of 3)',
      {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        color: '#F59E0B',
      }
    );

    // 3. Wind Gauge (Left Center)
    const windBox = this.add.graphics();
    windBox.fillStyle(0x0f172a, 0.85);
    windBox.fillRoundedRect(20, 174, 180, 72, 8);
    windBox.lineStyle(1, 0x38bdf8, 0.8);
    windBox.strokeRoundedRect(20, 174, 180, 72, 8);

    this.add.text(32, 182, 'CROSSWIND GAUGE', {
      fontFamily: FONT_TITLE,
      fontSize: '10px',
      color: '#38BDF8',
      fontStyle: 'bold',
    });

    this.windText = this.add.text(32, 204, 'WIND: CALM', {
      fontFamily: FONT_BODY,
      fontSize: '13px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    this.updateWindDisplay();

    // 4. Commentary Ticker (Bottom Bar)
    const ticker = this.add.graphics();
    ticker.fillStyle(0x0f172a, 0.9);
    ticker.fillRect(0, 672, 1280, 48);
    ticker.lineStyle(2, 0xd97706, 0.8);
    ticker.lineBetween(0, 672, 1280, 672);

    this.commentaryText = this.add
      .text(
        640,
        696,
        'Aim with MOUSE or WASD/ARROWS. Press SPACE or LEFT CLICK to release!',
        {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          color: '#FEF08A',
        }
      )
      .setOrigin(0.5);

    // 5. AUTO-SHOOT Button (for speed / accessibility)
    this.autoShootButton = this.add.container(1150, 638);
    const btnBg = this.add
      .graphics()
      .fillStyle(0xd97706, 1)
      .fillRoundedRect(-85, -20, 170, 40, 8);
    const btnText = this.add
      .text(0, 0, '🎯 AUTO-SHOOT', {
        fontFamily: FONT_TITLE,
        fontSize: '13px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.autoShootButton.add([btnBg, btnText]);
    this.autoShootButton.setSize(170, 40);
    this.autoShootButton.setInteractive({ useHandCursor: true });
    this.autoShootButton.on('pointerdown', () => this.handleAutoShoot());
  }

  private createBowAndArrow(): void {
    this.bowContainer = this.add.container(640, 620);

    this.bowSprite = this.add
      .sprite(0, 0, 'sq_archery_bow')
      .setScale(1.3)
      .setOrigin(0.5);

    this.arrowSprite = this.add
      .sprite(0, -10, 'sq_archery_arrow')
      .setScale(1.2)
      .setOrigin(0.5);

    this.bowContainer.add([this.bowSprite, this.arrowSprite]);
  }

  private setupControls(): void {
    if (!this.input.keyboard) return;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isAiming && !this.isArrowInFlight) {
        // Map pointer position to target coordinates (-50..+50)
        this.aimX = Phaser.Math.Clamp((pointer.x - 640) / 6, -55, 55);
        this.aimY = Phaser.Math.Clamp((pointer.y - 310) / 4, -45, 45);
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 600 && pointer.x > 1050) return; // Inside auto-shoot button
      if (this.isAiming && !this.isArrowInFlight) {
        this.releaseArrow();
      }
    });
  }

  update(time: number, delta: number): void {
    if (!this.isAiming || this.isArrowInFlight) return;

    // Keyboard aiming adjustments
    const speed = 0.8;
    if (this.cursors.left.isDown || this.keyA.isDown) this.aimX -= speed;
    if (this.cursors.right.isDown || this.keyD.isDown) this.aimX += speed;
    if (this.cursors.up.isDown || this.keyW.isDown) this.aimY -= speed;
    if (this.cursors.down.isDown || this.keyS.isDown) this.aimY += speed;

    this.aimX = Phaser.Math.Clamp(this.aimX, -55, 55);
    this.aimY = Phaser.Math.Clamp(this.aimY, -45, 45);

    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.releaseArrow();
      return;
    }

    // Natural archer breathing sway (reduced if Golden Yew Bow is owned)
    this.swayElapsed += delta;
    const hasYewBow = this.gameState.hasRelic(this.session.playerLordId, 'sherwood_yew_bow');
    const swayMult = hasYewBow ? 0.35 : 0.85;
    const swayX = Math.sin(this.swayElapsed / 380) * 4.5 * swayMult;
    const swayY = Math.cos(this.swayElapsed / 520) * 3.5 * swayMult;

    // Update Bow Visual Position
    this.bowContainer.x = 640 + (this.aimX + swayX) * 2.2;
    this.bowContainer.y = 620 + (this.aimY + swayY) * 1.4;

    // Draw Crosshair
    this.crosshairGraphics.clear();
    const retX = 640 + (this.aimX + swayX);
    const retY = 310 + (this.aimY + swayY);

    this.crosshairGraphics.lineStyle(1.5, 0xd97706, 0.85);
    this.crosshairGraphics.strokeCircle(retX, retY, 9);
    this.crosshairGraphics.lineBetween(retX - 14, retY, retX + 14, retY);
    this.crosshairGraphics.lineBetween(retX, retY - 14, retX, retY + 14);

    // Draw Wind Ribbon Flutter
    this.windRibbonGraphics.clear();
    const ribbonX = 140;
    const ribbonY = 224;
    const wind =
      this.session.rounds[this.session.currentRound - 1]?.wind ?? 0;
    const flutter = Math.sin(time / 100) * 3;
    this.windRibbonGraphics.fillStyle(0x38bdf8, 0.85);
    this.windRibbonGraphics.beginPath();
    this.windRibbonGraphics.moveTo(ribbonX, ribbonY);
    this.windRibbonGraphics.lineTo(ribbonX + wind * 4, ribbonY + flutter);
    this.windRibbonGraphics.lineTo(ribbonX + wind * 3.5, ribbonY + 8 + flutter);
    this.windRibbonGraphics.lineTo(ribbonX, ribbonY + 6);
    this.windRibbonGraphics.closePath();
    this.windRibbonGraphics.fill();
  }

  private releaseArrow(): void {
    if (this.isArrowInFlight) return;
    this.isArrowInFlight = true;
    this.isAiming = false;
    this.crosshairGraphics.clear();

    AudioManager.play('whoosh');

    // Resolve Shot via ArcheryEngine
    const hasYewBow = this.gameState.hasRelic(
      this.session.playerLordId,
      'sherwood_yew_bow'
    );
    const shot = ArcheryEngine.shootArrow(
      this.session,
      this.aimX,
      this.aimY,
      hasYewBow
    );

    // Animate arrow flight
    const startX = this.bowContainer.x;
    const startY = this.bowContainer.y;
    const endX = 640 + shot.finalX * 0.72;
    const endY = 310 + shot.finalY * 0.72;

    const flyingArrow = this.add
      .sprite(startX, startY, 'sq_archery_arrow')
      .setScale(1.2)
      .setRotation(-Math.PI / 4);

    this.tweens.add({
      targets: flyingArrow,
      x: endX,
      y: endY,
      scaleX: 0.35,
      scaleY: 0.35,
      duration: 480,
      ease: 'Quad.easeOut',
      onComplete: () => {
        AudioManager.play('impact');
        flyingArrow.destroy();
        this.handlePlayerShotImpact(shot);
      },
    });
  }

  private handleAutoShoot(): void {
    if (this.isArrowInFlight) return;
    this.isArrowInFlight = true;
    this.isAiming = false;
    this.crosshairGraphics.clear();

    AudioManager.play('whoosh');

    const hasYewBow = this.gameState.hasRelic(
      this.session.playerLordId,
      'sherwood_yew_bow'
    );
    const shot = ArcheryEngine.autoShootArrow(this.session, hasYewBow);
    const endX = 640 + shot.finalX * 0.72;
    const endY = 310 + shot.finalY * 0.72;

    const flyingArrow = this.add
      .sprite(640, 600, 'sq_archery_arrow')
      .setScale(1.2)
      .setRotation(-Math.PI / 4);

    this.tweens.add({
      targets: flyingArrow,
      x: endX,
      y: endY,
      scaleX: 0.35,
      scaleY: 0.35,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => {
        AudioManager.play('impact');
        flyingArrow.destroy();
        this.handlePlayerShotImpact(shot);
      },
    });
  }

  private handlePlayerShotImpact(shot: ArcheryShotResult): void {
    // Record hit on target cam
    this.playerZoomHits.push({
      x: shot.finalX,
      y: shot.finalY,
      zone: shot.hitZone,
    });
    this.redrawTargetCam();

    // Update live scores & commentary
    this.playerScoreText.setText(`${this.session.playerScore} PTS`);
    this.commentaryText.setText(`THOU: ${shot.commentary}`);
    AudioManager.play(shot.points >= 10 ? 'victory' : 'joust_hit');

    // Step AI Rival Shot after 800ms
    this.time.delayedCall(900, () => {
      this.executeRivalShot();
    });
  }

  private executeRivalShot(): void {
    const aiShot = ArcheryEngine.stepAiShot(this.session);
    this.rivalZoomHits.push({
      x: aiShot.finalX,
      y: aiShot.finalY,
      zone: aiShot.hitZone,
    });
    this.redrawTargetCam();

    this.rivalScoreText.setText(`${this.session.rivalScore} PTS`);
    this.commentaryText.setText(
      `RIVAL: ${this.session.rivalName} scores ${aiShot.points} pts (${aiShot.hitZone})!`
    );

    // Update Quiver Display
    const shotIdx = this.session.currentShotInRound - 1;
    const dots = ['[↑]', '[↑]', '[↑]'];
    for (let i = 0; i < shotIdx; i++) dots[i] = '[•]';
    this.arrowsLeftText.setText(
      `ARROWS: ${dots.join(' ')} (Shot ${Math.min(3, shotIdx + 1)} of 3)`
    );

    // Check if tournament is complete
    if (this.session.status !== 'ACTIVE') {
      this.time.delayedCall(1200, () => {
        this.concludeTournament();
      });
      return;
    }

    // Check if advanced to round 2
    const currentRound = this.session.rounds[this.session.currentRound - 1];
    this.roundText.setText(
      `ROUND ${this.session.currentRound}/2 — ${currentRound.distancePaces} PACES`
    );
    this.updateWindDisplay();

    // Ready for next shot
    this.time.delayedCall(700, () => {
      this.isArrowInFlight = false;
      this.isAiming = true;
    });
  }

  private updateWindDisplay(): void {
    const currentRound = this.session.rounds[this.session.currentRound - 1];
    const wind = currentRound?.wind ?? 0;
    const dir = wind > 0 ? 'EAST »»' : wind < 0 ? 'WEST ««' : 'CALM';
    this.windText.setText(`WIND: ${Math.abs(wind).toFixed(1)} KT ${dir}`);
  }

  private concludeTournament(): void {
    const outcome: ArcheryTournamentResult = ArcheryEngine.commitArcheryOutcome(
      this.session,
      this.gameState
    );

    // Display Tournament Victory / Conclusion Modal
    const modal = this.add.container(640, 360);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(-640, -360, 1280, 720);

    const box = this.add.graphics();
    box.fillStyle(0x0f172a, 0.95);
    box.fillRoundedRect(-280, -200, 560, 400, 12);
    box.lineStyle(3, outcome.playerWon ? 0xd97706 : 0x94a3b8, 1);
    box.strokeRoundedRect(-280, -200, 560, 400, 12);

    const title = this.add
      .text(0, -160, outcome.headline, {
        fontFamily: FONT_TITLE,
        fontSize: '22px',
        color: outcome.playerWon ? PALETTE_HEX.GOLD_BRIGHT : '#CBD5E1',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const scores = this.add
      .text(
        0,
        -100,
        `FINAL SCORE: ${outcome.playerScore} PTS  vs  ${outcome.rivalScore} PTS`,
        {
          fontFamily: FONT_BODY,
          fontSize: '18px',
          color: '#FFFFFF',
          fontStyle: 'bold',
        }
      )
      .setOrigin(0.5);

    let rewardText = '';
    if (outcome.playerWon) {
      rewardText = `REWARDS SEIZED:\n• +${outcome.goldAwarded} Gold Tournament Purse\n• +${outcome.archersAwarded} Veteran Longbowmen Recruited\n• The Golden Yew Bow Relic Claimed!`;
    } else {
      rewardText =
        'Thou didst shoot bravely under the greenwood,\nbut the rival champion claimed the gold purse.';
    }

    const desc = this.add
      .text(0, -10, rewardText, {
        fontFamily: FONT_BODY,
        fontSize: '15px',
        color: outcome.playerWon ? '#FDE68A' : '#94A3B8',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    // Return to Map Button
    const returnBtn = this.add.container(0, 130);
    const btnBg = this.add
      .graphics()
      .fillStyle(0xd97706, 1)
      .fillRoundedRect(-140, -24, 280, 48, 8);
    const btnTxt = this.add
      .text(0, 0, 'RETURN TO CAMPAIGN MAP', {
        fontFamily: FONT_TITLE,
        fontSize: '14px',
        color: '#FFFFFF',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    returnBtn.add([btnBg, btnTxt]);
    returnBtn.setSize(280, 48);
    returnBtn.setInteractive({ useHandCursor: true });
    returnBtn.on('pointerdown', () => {
      AudioManager.play('button');
      this.scene.start('MapScene');
    });

    modal.add([overlay, box, title, scores, desc, returnBtn]);
  }
}
