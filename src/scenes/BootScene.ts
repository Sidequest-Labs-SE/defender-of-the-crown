import Phaser from 'phaser';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { PALETTE_HEX } from '../data/palette';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate all procedural Amiga OCS pixel-art textures (640x400)
    PixelArtGenerator.generateAll(this);
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(PALETTE_HEX.BLACK);

    const title = this.add.text(width / 2, height / 2 - 16, 'CINEMAWARE 1986', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 2,
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height / 2 + 16, 'INITIALIZING AMIGA HI-RES DISPLAY (640x400)...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);

    // Fast 300ms transition to TitleScene
    this.time.delayedCall(300, () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        title.destroy();
        subtitle.destroy();
        this.scene.start('TitleScene');
      });
    });
  }
}
