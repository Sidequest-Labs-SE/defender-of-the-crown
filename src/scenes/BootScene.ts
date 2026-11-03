import Phaser from 'phaser';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { PALETTE_HEX } from '../data/palette';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    PixelArtGenerator.generateAll(this);
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.cameras.main.setBackgroundColor('#0B0D14');

    const title = this.add
      .text(width / 2, height / 2 - 24, 'CINEMAWARE 1986 • HD EDITION', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    const subtitle = this.add
      .text(width / 2, height / 2 + 22, 'Preparing the Realm of England (1280x720 Widescreen)…', {
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: '16px',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: 2,
      })
      .setOrigin(0.5);

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
