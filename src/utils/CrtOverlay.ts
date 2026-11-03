import Phaser from 'phaser';
import { PALETTE } from '../data/palette';

/**
 * CrtOverlay
 * Toggleable 1986 CRT Scanlines & Subtle Vignette Filter for 640x400 Hi-Res.
 * Controlled via hotkey 'C' or clicking the top-right CRT badge.
 */
export class CrtOverlay {
  private static isEnabled = true;
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private toggleButtonText: Phaser.GameObjects.Text | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.initOverlay();
    this.setupInputs();
  }

  private initOverlay(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(9999);

    // 1. Subtle Scanlines Graphics across 400 lines (every 2px, height 1px)
    const scanlines = this.scene.add.graphics();
    scanlines.fillStyle(PALETTE.BLACK, 0.14);
    for (let y = 0; y < 400; y += 2) {
      scanlines.fillRect(0, y, 640, 1);
    }
    this.container.add(scanlines);

    // 2. Subtle Vignette / CRT Bezel Shadow on edges
    const vignette = this.scene.add.graphics();
    vignette.fillStyle(PALETTE.BLACK, 0.4);
    vignette.fillRect(0, 0, 640, 3);
    vignette.fillRect(0, 397, 640, 3);
    vignette.fillRect(0, 0, 3, 400);
    vignette.fillRect(637, 0, 3, 400);

    // Corner softening
    vignette.fillStyle(PALETTE.BLACK, 0.65);
    vignette.fillRect(0, 0, 8, 8);
    vignette.fillRect(632, 0, 8, 8);
    vignette.fillRect(0, 392, 8, 8);
    vignette.fillRect(632, 392, 8, 8);
    this.container.add(vignette);

    // 3. Compact CRT Toggle Badge in top right corner (640x400)
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(PALETTE.BLACK, 0.85);
    badgeBg.fillRect(550, 6, 82, 18);
    badgeBg.lineStyle(1, PALETTE.GOLD_DARK, 0.9);
    badgeBg.strokeRect(550, 6, 82, 18);
    this.container.add(badgeBg);

    this.toggleButtonText = this.scene.add.text(
      591,
      15,
      CrtOverlay.isEnabled ? 'CRT [ON]' : 'CRT [OFF]',
      {
        fontSize: '10px',
        color: CrtOverlay.isEnabled ? '#F2D06B' : '#787882',
        fontFamily: 'Courier New, monospace',
        fontStyle: 'bold',
      }
    );
    this.toggleButtonText.setOrigin(0.5);
    this.container.add(this.toggleButtonText);

    // Make badge clickable with generous touch target
    const hitZone = this.scene.add.zone(591, 15, 88, 26);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => this.toggle());
    this.container.add(hitZone);

    this.applyVisibility();
  }

  private setupInputs(): void {
    if (this.scene.input.keyboard) {
      this.scene.input.keyboard.on('keydown-C', () => {
        this.toggle();
      });
    }
  }

  public toggle(): void {
    CrtOverlay.isEnabled = !CrtOverlay.isEnabled;
    this.applyVisibility();
  }

  private applyVisibility(): void {
    if (!this.container) return;

    const scanlines = this.container.getAt(0) as Phaser.GameObjects.Graphics;
    const vignette = this.container.getAt(1) as Phaser.GameObjects.Graphics;

    scanlines.setVisible(CrtOverlay.isEnabled);
    vignette.setVisible(CrtOverlay.isEnabled);

    if (this.toggleButtonText) {
      this.toggleButtonText.setText(CrtOverlay.isEnabled ? 'CRT [ON]' : 'CRT [OFF]');
      this.toggleButtonText.setColor(CrtOverlay.isEnabled ? '#F2D06B' : '#787882');
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.destroy();
    }
  }
}
