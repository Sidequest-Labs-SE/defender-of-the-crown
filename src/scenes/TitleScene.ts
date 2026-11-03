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

    // 1. Full 640x400 Castle Siege Backdrop
    this.add.image(0, 0, 'title_backdrop').setOrigin(0, 0);

    // 2. Title Header Banner Box (640x400 layout)
    const bannerBox = this.add.graphics();
    // Drop shadow
    bannerBox.fillStyle(PALETTE.BLACK, 0.75);
    bannerBox.fillRect(34, 24, 576, 76);
    // Dark Wood Frame
    bannerBox.fillStyle(PALETTE.WOOD_DARK, 0.95);
    bannerBox.fillRect(30, 20, 580, 76);
    // Gold Inner Border
    bannerBox.lineStyle(2, PALETTE.GOLD_DARK, 1);
    bannerBox.strokeRect(34, 24, 572, 68);
    // Inner Filigree Corners
    bannerBox.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    bannerBox.fillRect(36, 26, 6, 6);
    bannerBox.fillRect(598, 26, 6, 6);
    bannerBox.fillRect(36, 84, 6, 6);
    bannerBox.fillRect(598, 84, 6, 6);

    // 3. Iconic "DEFENDER OF THE CROWN" Title Text (Crisp 28px)
    // Black Shadow
    this.add.text(320, 47, 'DEFENDER OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLACK,
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Deep Blood Red Offset
    this.add.text(319, 45, 'DEFENDER OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Golden Main Text
    this.add.text(320, 44, 'DEFENDER OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 2,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(320, 74, 'AN AMIGA 1986 CINEMAWARE TRIBUTE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      letterSpacing: 3,
    }).setOrigin(0.5);

    // 4. Prologue Parchment Box (center-bottom)
    const prologueBox = this.add.graphics();
    prologueBox.fillStyle(PALETTE.BLACK, 0.75);
    prologueBox.fillRect(44, 244, 552, 96);
    prologueBox.fillStyle(PALETTE.WOOD_DARK, 0.92);
    prologueBox.fillRect(40, 240, 560, 96);
    prologueBox.lineStyle(2, PALETTE.GOLD_DARK, 0.85);
    prologueBox.strokeRect(44, 244, 552, 88);

    const prologue =
      'ENGLAND, 1149 A.D. The King is slain, the Crown\n' +
      'stolen, and civil war threatens the realm!\n' +
      'Lead the noble Saxons against the Norman usurpers\n' +
      'to reclaim the throne and unite the kingdom!';

    this.add.text(320, 288, prologue, {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5);

    // 5. Blinking "CLICK TO START" Prompt
    this.promptText = this.add.text(320, 368, '⚔  CLICK OR TAP TO SWEAR OATH & BEGIN  ⚔', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);

    // Pulsing tween
    this.tweens.add({
      targets: this.promptText,
      alpha: { from: 1, to: 0.25 },
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
