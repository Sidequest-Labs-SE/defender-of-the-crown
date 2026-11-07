import Phaser from 'phaser';
import {
  PALETTE,
  PALETTE_HEX,
  SIDEQUEST_PALETTE,
  SIDEQUEST_PALETTE_HEX,
} from '../data/palette';
import { GameState, SavedCampaignMeta } from '../core/GameState';
import { GameEdition } from '../core/types';
import { AudioManager } from '../utils/AudioManager';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';

interface TitleTorchEmber {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vy: number;
  drift: number;
  life: number;
  maxLife: number;
  size: number;
}

interface TitleMistBand {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
}

export class TitleScene extends Phaser.Scene {
  private previewEdition: GameEdition = 'CLASSIC';
  private isTransitioning = false;

  private sidequestBackdrop!: Phaser.GameObjects.Image;
  private sidequestFxContainer!: Phaser.GameObjects.Container;
  private sidequestAmbientGraphics!: Phaser.GameObjects.Graphics;
  private sidequestCrestContainer!: Phaser.GameObjects.Container;
  private subtitleText!: Phaser.GameObjects.Text;

  private classicCardBg!: Phaser.GameObjects.Graphics;
  private sidequestCardBg!: Phaser.GameObjects.Graphics;

  private continueButtonContainer?: Phaser.GameObjects.Container;
  private continueLabelText?: Phaser.GameObjects.Text;
  private activeSaveMeta: SavedCampaignMeta | null = null;

  private embers: TitleTorchEmber[] = [];
  private mistBands: TitleMistBand[] = [];

  constructor() {
    super({ key: 'TitleScene' });
  }

  create(): void {
    this.isTransitioning = false;
    this.cameras.main.fadeIn(200, 0, 0, 0);

    try {
      PixelArtGenerator.generateAll(this);
    } catch (err) {
      console.error('[TitleScene] Error in PixelArtGenerator.generateAll:', err);
    }

    try {
      SidequestArtGenerator.generateAll(this);
    } catch (err) {
      console.error('[TitleScene] Error in SidequestArtGenerator.generateAll:', err);
    }

    const gs = GameState.getInstance();
    gs.setPhase('TITLE');
    this.previewEdition = gs.getEdition();

    // 1. Dual 1280x720 Backdrops (Classic 1986 vs Sidequest Labs Moonlit Siege)
    this.add.image(0, 0, 'title_backdrop').setOrigin(0, 0);
    this.sidequestBackdrop = this.add
      .image(0, 0, 'sq_title_backdrop')
      .setOrigin(0, 0)
      .setAlpha(0);

    // 2. Sidequest Labs Live Atmospheric FX Layer (Mist, Torch Halos & Embers)
    this.sidequestFxContainer = this.add.container(0, 0).setAlpha(0);
    this.sidequestAmbientGraphics = this.add.graphics();
    this.sidequestFxContainer.add(this.sidequestAmbientGraphics);
    this.initSidequestAtmosphere();

    // 3. Ornate Title Header Banner Box (1280x720 layout)
    const bannerBox = this.add.graphics();
    bannerBox.fillStyle(PALETTE.BLACK, 0.74);
    bannerBox.fillRoundedRect(166, 30, 956, 132, 6);
    bannerBox.fillStyle(PALETTE.WOOD_DARK, 0.94);
    bannerBox.fillRoundedRect(160, 24, 960, 132, 6);
    bannerBox.lineStyle(3, PALETTE.GOLD_DARK, 1);
    bannerBox.strokeRoundedRect(168, 32, 944, 116, 4);

    // Corner Gold Filigree
    bannerBox.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    bannerBox.fillRect(174, 38, 10, 10);
    bannerBox.fillRect(1096, 38, 10, 10);
    bannerBox.fillRect(174, 134, 10, 10);
    bannerBox.fillRect(1096, 134, 10, 10);

    // "DEFENDER OF THE CROWN" HD Title Typography
    this.add
      .text(643, 74, 'DEFENDER OF THE CROWN', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: PALETTE_HEX.BLACK,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.add
      .text(640, 70, 'DEFENDER OF THE CROWN', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);

    this.subtitleText = this.add
      .text(640, 122, 'A CINEMAWARE 1986 TRIBUTE • WIDESCREEN HD EDITION', {
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: '14.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        letterSpacing: 2.5,
        resolution: 2,
      })
      .setOrigin(0.5);

    // Gleaming "SIDEQUEST LABS EDITION" Royal Crest Ribbon (visible when previewing SIDEQUEST_LABS)
    this.sidequestCrestContainer = this.add.container(640, 174).setAlpha(0);
    const crestG = this.add.graphics();
    crestG.fillStyle(SIDEQUEST_PALETTE.SHADOW_ABYSS, 0.95);
    crestG.fillRoundedRect(-215, -17, 430, 34, 16);
    crestG.fillStyle(SIDEQUEST_PALETTE.CRIMSON_MID, 0.92);
    crestG.fillRoundedRect(-211, -14, 422, 28, 14);
    crestG.lineStyle(2.5, SIDEQUEST_PALETTE.GOLD_GLEAM, 1);
    crestG.strokeRoundedRect(-213, -16, 426, 32, 15);
    this.sidequestCrestContainer.add(crestG);

    const crestShimmer = this.add.graphics();
    crestShimmer.lineStyle(2, SIDEQUEST_PALETTE.GOLD_SPECULAR, 0.9);
    crestShimmer.strokeRoundedRect(-213, -16, 426, 32, 15);
    this.sidequestCrestContainer.add(crestShimmer);
    this.tweens.add({
      targets: crestShimmer,
      alpha: { from: 0.15, to: 0.9 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    });

    const crestTxt = this.add
      .text(0, 0, '👑   SIDEQUEST LABS HD-RETRO EDITION   👑', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR,
        letterSpacing: 2,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.sidequestCrestContainer.add(crestTxt);

    // 4. Prologue Parchment Box
    const prologueBox = this.add.graphics();
    prologueBox.fillStyle(PALETTE.BLACK, 0.72);
    prologueBox.fillRoundedRect(226, 356, 836, 108, 6);
    prologueBox.fillStyle(PALETTE.WOOD_DARK, 0.92);
    prologueBox.fillRoundedRect(220, 350, 840, 108, 6);
    prologueBox.lineStyle(2, PALETTE.GOLD_DARK, 0.9);
    prologueBox.strokeRoundedRect(228, 358, 824, 92, 4);

    const prologue =
      'ENGLAND, 1149 A.D. — The King is slain, the Crown stolen, and civil war tears the realm asunder!\n' +
      'Choose your Edition below to lead the noble Saxons against the Norman usurpers and unite Britain:';

    this.add
      .text(640, 404, prologue, {
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: '15.5px',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        align: 'center',
        lineSpacing: 7,
        resolution: 2,
      })
      .setOrigin(0.5);

    // 5. Dual-Edition Selector Cards (Classic 1986 vs Sidequest Labs)
    this.buildEditionSelectorCards();

    // 6. Continue Saved Campaign Button (if save exists in either slot)
    this.buildContinueSavedButton();

    // Apply initial visual preview state
    this.setPreviewEdition(this.previewEdition, false);

    // 7. Keyboard Navigation
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-LEFT', () =>
        this.setPreviewEdition('CLASSIC', true)
      );
      this.input.keyboard.on('keydown-RIGHT', () =>
        this.setPreviewEdition('SIDEQUEST_LABS', true)
      );
      this.input.keyboard.on('keydown-ONE', () =>
        this.launchEdition('CLASSIC')
      );
      this.input.keyboard.on('keydown-TWO', () =>
        this.launchEdition('SIDEQUEST_LABS')
      );
      this.input.keyboard.on('keydown-ENTER', () =>
        this.launchEdition(this.previewEdition)
      );
      this.input.keyboard.on('keydown-SPACE', () =>
        this.launchEdition(this.previewEdition)
      );
      this.input.keyboard.on('keydown-C', () => {
        if (this.activeSaveMeta) {
          this.continueSavedGame();
        }
      });
    }
  }

  private initSidequestAtmosphere(): void {
    this.mistBands = [
      { x: 140, y: 458, w: 420, h: 46, speed: 14, alpha: 0.14 },
      { x: 680, y: 492, w: 480, h: 54, speed: 19, alpha: 0.12 },
      { x: 960, y: 245, w: 340, h: 36, speed: 10, alpha: 0.1 },
    ];

    const torchSources = [
      { x: 112, y: 318 },
      { x: 224, y: 270 },
      { x: 338, y: 322 },
      { x: 960, y: 512 },
      { x: 1045, y: 512 },
      { x: 1135, y: 512 },
    ];

    this.embers = [];
    for (let i = 0; i < 30; i++) {
      const src = torchSources[i % torchSources.length];
      this.embers.push({
        x: src.x + (Math.random() - 0.5) * 14,
        y: src.y - Math.random() * 48,
        baseX: src.x,
        baseY: src.y,
        vy: 18 + Math.random() * 22,
        drift: (Math.random() - 0.5) * 16,
        life: Math.random(),
        maxLife: 1.4 + Math.random() * 1.1,
        size: i % 3 === 0 ? 3 : 2,
      });
    }
  }

  private buildEditionSelectorCards(): void {
    const cardW = 492;
    const cardH = 122;
    const cardY = 478;
    const leftX = 128;
    const rightX = 660;

    this.classicCardBg = this.add.graphics();
    this.sidequestCardBg = this.add.graphics();

    // Card 1: CLASSIC 1986 EDITION
    this.add
      .text(
        leftX + cardW / 2,
        cardY + 34,
        '[ ⚔ PLAY CLASSIC 1986 EDITION ]',
        {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '19px',
          fontStyle: 'bold',
          color: PALETTE_HEX.GOLD_BRIGHT,
          letterSpacing: 1,
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        leftX + cardW / 2,
        cardY + 68,
        'Authentic 1986 Amiga Rules & Original Hybrid Visuals',
        {
          fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
          fontSize: '13.5px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        leftX + cardW / 2,
        cardY + 96,
        '• Original 32-Color Palette  • Classic Static Map  • Pure Gold Master [1]',
        {
          fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
          fontSize: '11.5px',
          color: PALETTE_HEX.PARCHMENT_DARK,
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    const classicZone = this.add
      .zone(leftX + cardW / 2, cardY + cardH / 2, cardW, cardH)
      .setInteractive({ useHandCursor: true });
    classicZone.on('pointerover', () => {
      if (this.previewEdition !== 'CLASSIC') {
        this.setPreviewEdition('CLASSIC', true);
      }
    });
    classicZone.on('pointerdown', () => this.launchEdition('CLASSIC'));

    // Card 2: SIDEQUEST LABS EDITION
    this.add
      .text(
        rightX + cardW / 2,
        cardY + 34,
        '[ 👑 PLAY SIDEQUEST LABS EDITION ]',
        {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '19px',
          fontStyle: 'bold',
          color: SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR,
          letterSpacing: 1,
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        rightX + cardW / 2,
        cardY + 68,
        'Upgraded HD-Retro Graphics, Dynamic Weather, Seasons & Expanded Realm',
        {
          fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          color: SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT,
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        rightX + cardW / 2,
        cardY + 96,
        '• 96x96 HD-Retro Portraits  • 4-Season Living Britain  • Atmospheric FX [2]',
        {
          fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
          fontSize: '11.5px',
          color: SIDEQUEST_PALETTE_HEX.GOLD_GLEAM,
          resolution: 2,
        }
      )
      .setOrigin(0.5);

    const sqZone = this.add
      .zone(rightX + cardW / 2, cardY + cardH / 2, cardW, cardH)
      .setInteractive({ useHandCursor: true });
    sqZone.on('pointerover', () => {
      if (this.previewEdition !== 'SIDEQUEST_LABS') {
        this.setPreviewEdition('SIDEQUEST_LABS', true);
      }
    });
    sqZone.on('pointerdown', () => this.launchEdition('SIDEQUEST_LABS'));
  }

  private redrawEditionCards(): void {
    const cardW = 492;
    const cardH = 122;
    const cardY = 478;
    const leftX = 128;
    const rightX = 660;
    const isSq = this.previewEdition === 'SIDEQUEST_LABS';

    this.classicCardBg.clear();
    this.classicCardBg.fillStyle(PALETTE.BLACK, 0.78);
    this.classicCardBg.fillRoundedRect(leftX + 4, cardY + 5, cardW, cardH, 8);
    this.classicCardBg.fillStyle(
      !isSq ? 0x5c2f16 : PALETTE.WOOD_DARK,
      !isSq ? 0.97 : 0.88
    );
    this.classicCardBg.fillRoundedRect(leftX, cardY, cardW, cardH, 8);
    this.classicCardBg.lineStyle(
      !isSq ? 3.2 : 1.8,
      !isSq ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK,
      1
    );
    this.classicCardBg.strokeRoundedRect(leftX, cardY, cardW, cardH, 8);

    this.sidequestCardBg.clear();
    this.sidequestCardBg.fillStyle(PALETTE.BLACK, 0.78);
    this.sidequestCardBg.fillRoundedRect(rightX + 4, cardY + 5, cardW, cardH, 8);
    this.sidequestCardBg.fillStyle(
      isSq ? SIDEQUEST_PALETTE.AZURE_SHADOW : SIDEQUEST_PALETTE.SHADOW_SLATE,
      isSq ? 0.97 : 0.88
    );
    this.sidequestCardBg.fillRoundedRect(rightX, cardY, cardW, cardH, 8);
    this.sidequestCardBg.lineStyle(
      isSq ? 3.4 : 1.8,
      isSq ? SIDEQUEST_PALETTE.GOLD_GLEAM : SIDEQUEST_PALETTE.GOLD_BURNISHED,
      1
    );
    this.sidequestCardBg.strokeRoundedRect(rightX, cardY, cardW, cardH, 8);
  }

  private buildContinueSavedButton(): void {
    const info = GameState.getInstance().getSavedCampaignInfo(
      this.previewEdition
    );
    this.activeSaveMeta = info;

    if (!info) {
      const hint = this.add
        .text(
          640,
          654,
          'HOVER TO PREVIEW EDITION  •  CLICK AN EDITION CARD OR PRESS [ENTER] TO BEGIN',
          {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: PALETTE_HEX.GOLD_BRIGHT,
            letterSpacing: 1.5,
            resolution: 2,
          }
        )
        .setOrigin(0.5);

      this.tweens.add({
        targets: hint,
        alpha: { from: 1, to: 0.4 },
        duration: 850,
        yoyo: true,
        repeat: -1,
      });
      return;
    }

    this.continueButtonContainer = this.add.container(640, 650);
    const cbg = this.add.graphics();
    cbg.fillStyle(PALETTE.BLOOD_RED, 0.96);
    cbg.fillRoundedRect(-330, -21, 660, 42, 6);
    cbg.lineStyle(2.5, PALETTE.GOLD_BRIGHT, 1);
    cbg.strokeRoundedRect(-330, -21, 660, 42, 6);
    this.continueButtonContainer.add(cbg);

    this.continueLabelText = this.add
      .text(0, 0, '', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.continueButtonContainer.add(this.continueLabelText);

    const cZone = this.add
      .zone(0, 0, 660, 42)
      .setInteractive({ useHandCursor: true });
    this.continueButtonContainer.add(cZone);
    cZone.on('pointerdown', () => this.continueSavedGame());

    this.refreshContinueButtonLabel();
  }

  private refreshContinueButtonLabel(): void {
    const info = GameState.getInstance().getSavedCampaignInfo(
      this.previewEdition
    );
    this.activeSaveMeta = info;
    if (!info || !this.continueLabelText) return;

    const editionBadge =
      info.edition === 'SIDEQUEST_LABS' ? '[SIDEQUEST LABS]' : '[CLASSIC]';
    this.continueLabelText.setText(
      `💾  CONTINUE SAVED CAMPAIGN (C) — ${editionBadge} • ${info.lordName.toUpperCase()} (${info.monthLabel} ${info.year})`
    );
  }

  private setPreviewEdition(edition: GameEdition, playSound: boolean): void {
    this.previewEdition = edition;
    GameState.getInstance().setEdition(edition);
    if (playSound) {
      AudioManager.getInstance().playUiClick();
    }

    const isSq = edition === 'SIDEQUEST_LABS';

    this.tweens.killTweensOf([
      this.sidequestBackdrop,
      this.sidequestFxContainer,
      this.sidequestCrestContainer,
    ]);

    this.tweens.add({
      targets: [
        this.sidequestBackdrop,
        this.sidequestFxContainer,
        this.sidequestCrestContainer,
      ],
      alpha: isSq ? 1 : 0,
      duration: 240,
      ease: 'Quad.easeOut',
    });

    this.subtitleText.setText(
      isSq
        ? 'SIDEQUEST LABS HD-RETRO • DYNAMIC SEASONS & LIVING REALM'
        : 'A CINEMAWARE 1986 TRIBUTE • WIDESCREEN HD EDITION'
    );
    this.subtitleText.setColor(
      isSq ? SIDEQUEST_PALETTE_HEX.GOLD_GLEAM : PALETTE_HEX.PARCHMENT_LIGHT
    );

    this.redrawEditionCards();
    this.refreshContinueButtonLabel();
  }

  private launchEdition(edition: GameEdition): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    GameState.getInstance().setEdition(edition);
    AudioManager.getInstance().playUiClick();
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => {
        this.scene.start('CharacterSelectScene');
      }
    );
  }

  private continueSavedGame(): void {
    if (this.isTransitioning) return;
    const gs = GameState.getInstance();
    const info = gs.getSavedCampaignInfo(this.previewEdition);
    const loaded = info
      ? gs.loadFromStorage(info.slotKey)
      : gs.loadFromStorage();

    if (loaded) {
      this.isTransitioning = true;
      AudioManager.getInstance().playFanfare();
      const edTag = gs.isSidequestEdition()
        ? 'Sidequest Labs Edition'
        : 'Classic 1986 Edition';
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once(
        Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
        () => {
          this.scene.start('MapScene', {
            lastBattleMessage: `${edTag} campaign restored from parchment archives. Welcome back, Sire!`,
            lastBattleAlert: false,
          });
        }
      );
    } else {
      this.launchEdition(this.previewEdition);
    }
  }

  update(time: number, delta: number): void {
    if (this.sidequestFxContainer.alpha <= 0.01) return;

    const dt = delta / 1000;
    const g = this.sidequestAmbientGraphics;
    g.clear();

    // 1. Drifting Moonlit Mist / Cloud Bands across the ramparts
    for (const band of this.mistBands) {
      band.x += band.speed * dt;
      if (band.x - band.w / 2 > 1320) {
        band.x = -band.w / 2 - 40;
      }
      g.fillStyle(0xbacbe2, band.alpha);
      g.fillEllipse(band.x, band.y, band.w, band.h);
      g.fillStyle(0xecf4ff, band.alpha * 0.5);
      g.fillEllipse(band.x - 30, band.y - 6, band.w * 0.65, band.h * 0.55);
    }

    // 2. Flickering Siege Torch Halos & Rising Ember Particles
    const flicker = 0.85 + Math.sin(time * 0.014) * 0.15;
    const torchHalos = [
      [112, 320, 26],
      [224, 272, 30],
      [338, 324, 26],
      [960, 515, 22],
      [1045, 515, 22],
      [1135, 515, 22],
    ];
    for (const [hx, hy, hr] of torchHalos) {
      g.fillStyle(SIDEQUEST_PALETTE.TORCH_AMBER, 0.16 * flicker);
      g.fillCircle(hx, hy, hr * flicker);
      g.fillStyle(SIDEQUEST_PALETTE.TORCH_GLOW, 0.28 * flicker);
      g.fillCircle(hx, hy, hr * 0.42);
    }

    for (const e of this.embers) {
      e.life += dt;
      e.y -= e.vy * dt;
      e.x += (e.drift + Math.sin(time * 0.005 + e.baseX) * 10) * dt;
      if (e.life >= e.maxLife) {
        e.life = 0;
        e.x = e.baseX + (Math.random() - 0.5) * 12;
        e.y = e.baseY;
      }
      const alpha = Math.max(0, 1 - e.life / e.maxLife);
      g.fillStyle(
        e.life < e.maxLife * 0.45
          ? SIDEQUEST_PALETTE.TORCH_GLOW
          : SIDEQUEST_PALETTE.TORCH_ORANGE,
        alpha * 0.9
      );
      g.fillRect(e.x, e.y, e.size, e.size);
    }
  }
}
