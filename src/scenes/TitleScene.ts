import Phaser from 'phaser';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { GameState } from '../core/GameState';
import { AudioManager } from '../utils/AudioManager';

export class TitleScene extends Phaser.Scene {
  private promptText!: Phaser.GameObjects.Text;
  private continueButton?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    GameState.getInstance().setPhase('TITLE');

    // 1. Full 1280x720 Widescreen Castle Siege Backdrop
    this.add.image(0, 0, 'title_backdrop').setOrigin(0, 0);

    // 2. Ornate Title Header Banner Box (1280x720 layout)
    const bannerBox = this.add.graphics();
    bannerBox.fillStyle(PALETTE.BLACK, 0.72);
    bannerBox.fillRoundedRect(166, 38, 956, 136, 6);
    bannerBox.fillStyle(PALETTE.WOOD_DARK, 0.94);
    bannerBox.fillRoundedRect(160, 32, 960, 136, 6);
    bannerBox.lineStyle(3, PALETTE.GOLD_DARK, 1);
    bannerBox.strokeRoundedRect(168, 40, 944, 120, 4);

    // Corner Gold Filigree
    bannerBox.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    bannerBox.fillRect(174, 46, 10, 10);
    bannerBox.fillRect(1096, 46, 10, 10);
    bannerBox.fillRect(174, 144, 10, 10);
    bannerBox.fillRect(1096, 144, 10, 10);

    // 3. "DEFENDER OF THE CROWN" HD Title Typography
    this.add
      .text(643, 84, 'DEFENDER OF THE CROWN', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: PALETTE_HEX.BLACK,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(640, 80, 'DEFENDER OF THE CROWN', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(640, 132, 'A CINEMAWARE 1986 TRIBUTE • WIDESCREEN HD EDITION', {
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    // 4. Prologue Parchment Box (center-bottom)
    const prologueBox = this.add.graphics();
    prologueBox.fillStyle(PALETTE.BLACK, 0.72);
    prologueBox.fillRoundedRect(226, 456, 836, 152, 6);
    prologueBox.fillStyle(PALETTE.WOOD_DARK, 0.93);
    prologueBox.fillRoundedRect(220, 450, 840, 152, 6);
    prologueBox.lineStyle(2, PALETTE.GOLD_DARK, 0.9);
    prologueBox.strokeRoundedRect(228, 458, 824, 136, 4);

    const prologue =
      'ENGLAND, 1149 A.D. — The King is slain, the Crown stolen,\n' +
      'and civil war threatens to tear the realm asunder!\n' +
      'Lead the noble Saxons against the Norman usurpers\n' +
      'to reclaim the throne and unite the kingdom!';

    this.add
      .text(640, 526, prologue, {
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: '18px',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        align: 'center',
        lineSpacing: 8,
        resolution: 2,
      })
      .setOrigin(0.5);

    // 5. Check Saved Campaign
    const hasSave = GameState.getInstance().hasSavedCampaign();

    const startNewGame = () => {
      AudioManager.getInstance().playUiClick();
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('CharacterSelectScene');
      });
    };

    const continueSavedGame = () => {
      const loaded = GameState.getInstance().loadFromStorage();
      if (loaded) {
        AudioManager.getInstance().playFanfare();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start('MapScene', {
            lastBattleMessage: 'Campaign restored from parchment archives. Welcome back, Sire!',
            lastBattleAlert: false,
          });
        });
      } else {
        startNewGame();
      }
    };

    if (hasSave) {
      // Dual Buttons: Continue Saved Campaign | Start New Campaign
      this.continueButton = this.add.container(640, 634);
      const cbg = this.add.graphics();
      cbg.fillStyle(PALETTE.BLOOD_RED, 1);
      cbg.fillRoundedRect(-240, -18, 480, 36, 6);
      cbg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      cbg.strokeRoundedRect(-240, -18, 480, 36, 6);
      this.continueButton.add(cbg);

      const cText = this.add
        .text(0, 0, '💾   CONTINUE SAVED CAMPAIGN [C]   💾', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '16px',
          fontStyle: 'bold',
          color: PALETTE_HEX.GOLD_BRIGHT,
          resolution: 2,
        })
        .setOrigin(0.5);
      this.continueButton.add(cText);

      const cZone = this.add.zone(0, 0, 480, 36).setInteractive({ useHandCursor: true });
      this.continueButton.add(cZone);
      cZone.on('pointerdown', continueSavedGame);

      this.promptText = this.add
        .text(640, 680, '⚔   CLICK HERE OR PRESS ENTER FOR NEW CAMPAIGN   ⚔', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      this.promptText.on('pointerdown', startNewGame);

      if (this.input.keyboard) {
        this.input.keyboard.once('keydown-C', continueSavedGame);
        this.input.keyboard.once('keydown-ENTER', startNewGame);
        this.input.keyboard.once('keydown-SPACE', startNewGame);
      }
    } else {
      // 5. Pulsing Start Prompt for New Players
      this.promptText = this.add
        .text(640, 656, '⚔   CLICK OR PRESS ENTER TO SWEAR OATH & BEGIN   ⚔', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: PALETTE_HEX.GOLD_BRIGHT,
          letterSpacing: 2,
          resolution: 2,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      this.tweens.add({
        targets: this.promptText,
        alpha: { from: 1, to: 0.3 },
        duration: 650,
        yoyo: true,
        repeat: -1,
      });

      this.promptText.on('pointerdown', startNewGame);
      this.input.on('pointerdown', startNewGame);
      if (this.input.keyboard) {
        this.input.keyboard.once('keydown-SPACE', startNewGame);
        this.input.keyboard.once('keydown-ENTER', startNewGame);
      }
    }
  }
}
