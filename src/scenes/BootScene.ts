import Phaser from 'phaser';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { PALETTE_HEX } from '../data/palette';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate all procedural Amiga OCS pixel-art textures
    PixelArtGenerator.generateAll(this);
  }

  create(): void {
    // Brief Amiga OCS loading pulse
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.cameras.main.setBackgroundColor(PALETTE_HEX.BLACK);

    const title = this.add.text(width / 2, height / 2 - 10, 'CINEMAWARE 1986', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      color: PALETTE_HEX.GOLD_BRIGHT,
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height / 2 + 10, 'INITIALIZING AMIGA OCS DISPLAY...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
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
