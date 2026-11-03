import Phaser from 'phaser';
import { PALETTE } from '../data/palette';

/**
 * CrtOverlay
 * Toggleable 1986 CRT Scanlines & Subtle Vignette Filter.
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

    // 1. Scanlines Graphics
    const scanlines = this.scene.add.graphics();
    scanlines.fillStyle(PALETTE.BLACK, 0.22);
    for (let y = 0; y < 200; y += 2) {
      scanlines.fillRect(0, y, 320, 1);
    }
    this.container.add(scanlines);

    // 2. Subtle Vignette / CRT Bezel Shadow on edges
    const vignette = this.scene.add.graphics();
    // Top & Bottom gradient shadows
    vignette.fillStyle(PALETTE.BLACK, 0.35);
    vignette.fillRect(0, 0, 320, 2);
    vignette.fillRect(0, 198, 320, 2);
    vignette.fillRect(0, 0, 2, 200);
    vignette.fillRect(318, 0, 2, 200);

    // Corner softening
    vignette.fillStyle(PALETTE.BLACK, 0.6);
    vignette.fillRect(0, 0, 4, 4);
    vignette.fillRect(316, 0, 4, 4);
    vignette.fillRect(0, 196, 4, 4);
    vignette.fillRect(316, 196, 4, 4);
    this.container.add(vignette);

    // 3. Compact CRT Toggle Badge in top right corner (optimized for touch & mouse)
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(PALETTE.BLACK, 0.85);
    badgeBg.fillRect(260, 3, 57, 12);
    badgeBg.lineStyle(1, PALETTE.GOLD_DARK, 0.9);
    badgeBg.strokeRect(260, 3, 57, 12);
    this.container.add(badgeBg);

    this.toggleButtonText = this.scene.add.text(
      288,
      9,
      CrtOverlay.isEnabled ? 'CRT [ON]' : 'CRT [OFF]',
      {
        fontSize: '7.5px',
        color: CrtOverlay.isEnabled ? '#F2D06B' : '#787882',
        fontFamily: 'monospace',
      }
    );
    this.toggleButtonText.setOrigin(0.5);
    this.container.add(this.toggleButtonText);

    // Make badge clickable with generous touch target
    const hitZone = this.scene.add.zone(288, 9, 62, 18);
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

    // Scanlines & vignette are children 0 and 1
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
