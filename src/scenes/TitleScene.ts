import Phaser from 'phaser';
import { CrtOverlay } from '../utils/CrtOverlay';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { GameState } from '../core/GameState';

export class TitleScene extends Phaser.Scene {
  private crtOverlay!: CrtOverlay;
  private promptText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    GameState.getInstance().setPhase('TITLE');

    // 1. Full 320x200 Castle Siege Backdrop
    this.add.image(0, 0, 'title_backdrop').setOrigin(0, 0);

    // 2. Title Header Banner Box
    const bannerBox = this.add.graphics();
    // Drop shadow
    bannerBox.fillStyle(PALETTE.BLACK, 0.7);
    bannerBox.fillRect(16, 12, 288, 38);
    // Dark Wood Frame
    bannerBox.fillStyle(PALETTE.WOOD_DARK, 0.95);
    bannerBox.fillRect(14, 10, 288, 38);
    // Gold Inner Border
    bannerBox.lineStyle(1, PALETTE.GOLD_DARK, 1);
    bannerBox.strokeRect(16, 12, 284, 34);
    // Inner Filigree Corners
    bannerBox.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    bannerBox.fillRect(17, 13, 3, 3);
    bannerBox.fillRect(296, 13, 3, 3);
    bannerBox.fillRect(17, 42, 3, 3);
    bannerBox.fillRect(296, 42, 3, 3);

    // 3. Iconic "DEFENDER OF THE CROWN" Title Text
    // Black Shadow
    this.add.text(160, 22, 'DEFENDER OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLACK,
    }).setOrigin(0.5);

    // Deep Blood Red Offset
    this.add.text(159, 21, 'DEFENDER OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
    }).setOrigin(0.5);

    // Golden Main Text
    this.add.text(160, 20, 'DEFENDER OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(160, 36, 'AN AMIGA 1986 CINEMAWARE TRIBUTE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);

    // 4. Prologue Parchment Box (center-bottom)
    const prologueBox = this.add.graphics();
    prologueBox.fillStyle(PALETTE.BLACK, 0.75);
    prologueBox.fillRect(22, 122, 276, 52);
    prologueBox.fillStyle(PALETTE.WOOD_DARK, 0.9);
    prologueBox.fillRect(20, 120, 276, 52);
    prologueBox.lineStyle(1, PALETTE.GOLD_DARK, 0.8);
    prologueBox.strokeRect(22, 122, 272, 48);

    const prologue =
      'ENGLAND, 1149 A.D. The King is slain, the Crown\n' +
      'stolen, and civil war threatens the realm!\n' +
      'Lead the noble Saxons against the Norman usurpers\n' +
      'to reclaim the throne and unite the kingdom!';

    this.add.text(160, 145, prologue, {
      fontFamily: 'Courier New, monospace',
      fontSize: '7.5px',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);

    // 5. Blinking "CLICK TO START" Prompt
    this.promptText = this.add.text(160, 185, '⚔  CLICK OR PRESS SPACE TO START  ⚔', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    }).setOrigin(0.5);

    // Pulsing tween
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0.2 },
      duration: 550,
      yoyo: true,
      repeat: -1,
    });

    // 6. Interaction to start game
    const proceed = () => {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('CharacterSelectScene');
      });
    };

    this.input.on('pointerdown', proceed);
    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-SPACE', proceed);
      this.input.keyboard.once('keydown-ENTER', proceed);
    }

    // 7. Toggleable CRT Scanlines
    this.crtOverlay = new CrtOverlay(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.crtOverlay.destroy();
    });
  }
}
