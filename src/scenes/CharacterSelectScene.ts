import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { SAXON_LORDS } from '../data/lords';
import { Lord, getCinemawareStatRating } from '../core/types';
import { PALETTE, PALETTE_HEX } from '../data/palette';

interface LordCardUI {
  id: string;
  container: Phaser.GameObjects.Container;
  selectionBorder: Phaser.GameObjects.Graphics;
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedLordId = 'ivanhoe';
  private lordCards: LordCardUI[] = [];

  private detailPanelContainer!: Phaser.GameObjects.Container;
  private lordNameText!: Phaser.GameObjects.Text;
  private lordTitleText!: Phaser.GameObjects.Text;
  private lordHomeText!: Phaser.GameObjects.Text;
  private lordBioText!: Phaser.GameObjects.Text;
  private lordQuoteText!: Phaser.GameObjects.Text;

  private leadershipRatingText!: Phaser.GameObjects.Text;
  private joustingRatingText!: Phaser.GameObjects.Text;
  private swordplayRatingText!: Phaser.GameObjects.Text;
  private statBarsGraphics!: Phaser.GameObjects.Graphics;

  private confirmBtnContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    GameState.getInstance().setPhase('SELECT_CHARACTER');
    this.lordCards = [];

    this.createBackground();
    this.createHeader();
    this.createLordCards();
    this.createDetailPanel();
    this.createConfirmButton();
    this.selectLord('ivanhoe');
  }

  private createBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x1f222b, 1);
    bg.fillRect(0, 0, 1280, 720);

    // Subtle stone masonry lines
    bg.fillStyle(0x13151c, 0.55);
    for (let y = 0; y < 720; y += 36) {
      bg.fillRect(0, y, 1280, 2);
      const offset = y % 72 === 0 ? 0 : 60;
      for (let x = offset; x < 1280; x += 120) {
        bg.fillRect(x, y, 2, 36);
      }
    }
  }

  private createHeader(): void {
    const headerBg = this.add.graphics();
    headerBg.fillStyle(PALETTE.WOOD_DARK, 0.96);
    headerBg.fillRoundedRect(60, 20, 1160, 58, 6);
    headerBg.lineStyle(2.5, PALETTE.GOLD_DARK, 1);
    headerBg.strokeRoundedRect(60, 20, 1160, 58, 6);

    this.add
      .text(640, 49, '★  CHOOSE THY SAXON CHAMPION  ★', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 3,
        resolution: 2,
      })
      .setOrigin(0.5);
  }

  private createLordCards(): void {
    const lords = Object.values(SAXON_LORDS);
    const cardWidth = 264;
    const cardHeight = 208;
    const startX = 192;
    const spacingX = 298;
    const cardY = 204;

    lords.forEach((lord, index) => {
      const cx = startX + index * spacingX;
      const container = this.add.container(cx, cardY);

      const bg = this.add.graphics();
      bg.fillStyle(PALETTE.BLACK, 0.5);
      bg.fillRoundedRect(-cardWidth / 2 + 4, -cardHeight / 2 + 5, cardWidth, cardHeight, 6);
      bg.fillStyle(PALETTE.WOOD_DARK, 0.96);
      bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      bg.lineStyle(2, PALETTE.WOOD_MID, 1);
      bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      container.add(bg);

      // Crisp 2x Retro Pixel-Art Portrait (96x96) & Shield (66x84)
      const portrait = this.add
        .image(-48, -24, `portrait_${lord.id}`)
        .setDisplaySize(96, 96);
      container.add(portrait);

      const shield = this.add
        .image(56, -24, `shield_${lord.id}`)
        .setDisplaySize(60, 76);
      container.add(shield);

      const namePlate = this.add.graphics();
      namePlate.fillStyle(PALETTE.BLACK, 0.82);
      namePlate.fillRoundedRect(-cardWidth / 2 + 10, 44, cardWidth - 20, 46, 4);
      container.add(namePlate);

      const nameText = this.add
        .text(0, 67, lord.name.toUpperCase(), {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: 2,
        })
        .setOrigin(0.5);
      container.add(nameText);

      const selectionBorder = this.add.graphics();
      selectionBorder.lineStyle(4, PALETTE.GOLD_BRIGHT, 1);
      selectionBorder.strokeRoundedRect(
        -cardWidth / 2 - 3,
        -cardHeight / 2 - 3,
        cardWidth + 6,
        cardHeight + 6,
        8
      );
      selectionBorder.setVisible(false);
      container.add(selectionBorder);

      const hitZone = this.add.zone(0, 0, cardWidth + 10, cardHeight + 10);
      hitZone.setInteractive({ useHandCursor: true });

      hitZone.on('pointerover', () => {
        if (this.selectedLordId !== lord.id) {
          bg.lineStyle(2.5, PALETTE.GOLD_DARK, 1);
          bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
        }
      });

      hitZone.on('pointerout', () => {
        if (this.selectedLordId !== lord.id) {
          bg.lineStyle(2, PALETTE.WOOD_MID, 1);
          bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
        }
      });

      hitZone.on('pointerdown', () => {
        this.selectLord(lord.id);
      });

      this.lordCards.push({ id: lord.id, container, selectionBorder });
    });
  }

  private createDetailPanel(): void {
    this.detailPanelContainer = this.add.container(640, 456);

    const w = 1160;
    const h = 236;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(PALETTE.BLACK, 0.65);
    panelBg.fillRoundedRect(-w / 2 + 5, -h / 2 + 6, w, h, 8);
    panelBg.fillStyle(PALETTE.WOOD_DARK, 1);
    panelBg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    panelBg.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    panelBg.fillRoundedRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 5);
    panelBg.lineStyle(2, PALETTE.WOOD_MID, 0.85);
    panelBg.strokeRoundedRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 4);
    panelBg.lineBetween(90, -h / 2 + 24, 90, h / 2 - 24);
    this.detailPanelContainer.add(panelBg);

    this.lordNameText = this.add.text(-546, -92, '', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '26px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
      resolution: 2,
    });
    this.detailPanelContainer.add(this.lordNameText);

    this.lordTitleText = this.add.text(-546, -58, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: 'italic',
      color: PALETTE_HEX.BLOOD_RED,
      resolution: 2,
    });
    this.detailPanelContainer.add(this.lordTitleText);

    this.lordHomeText = this.add.text(-546, -28, '', {
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_MID,
      resolution: 2,
    });
    this.detailPanelContainer.add(this.lordHomeText);

    this.lordBioText = this.add.text(-546, 4, '', {
      fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
      fontSize: '15.5px',
      color: '#1E1A16',
      wordWrap: { width: 610 },
      lineSpacing: 5,
      resolution: 2,
    });
    this.detailPanelContainer.add(this.lordBioText);

    this.lordQuoteText = this.add.text(-546, 68, '', {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      fontStyle: 'italic',
      color: PALETTE_HEX.WOOD_DARK,
      wordWrap: { width: 610 },
      resolution: 2,
    });
    this.detailPanelContainer.add(this.lordQuoteText);

    // Right Column: Cinemaware Ability Ratings
    const statsHeader = this.add.text(122, -90, 'COMBAT & COMMAND RATINGS', {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
      resolution: 2,
    });
    this.detailPanelContainer.add(statsHeader);

    const makeStatRow = (label: string, y: number) => {
      const lbl = this.add.text(122, y, label, {
        fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: 2,
      });
      const val = this.add
        .text(546, y, '', {
          fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
          fontSize: '15px',
          fontStyle: 'bold',
          color: PALETTE_HEX.BLOOD_RED,
          resolution: 2,
        })
        .setOrigin(1, 0);
      this.detailPanelContainer.add([lbl, val]);
      return val;
    };

    this.leadershipRatingText = makeStatRow('LEADERSHIP', -50);
    this.joustingRatingText = makeStatRow('JOUSTING', 2);
    this.swordplayRatingText = makeStatRow('SWORDPLAY', 54);

    this.statBarsGraphics = this.add.graphics();
    this.detailPanelContainer.add(this.statBarsGraphics);
  }

  private drawStatBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    value: number
  ): void {
    const totalPips = 10;
    const pipWidth = 36;
    const pipHeight = 13;
    const gap = 6.5;

    for (let i = 0; i < totalPips; i++) {
      const px = x + i * (pipWidth + gap);
      if (i < value) {
        g.fillStyle(PALETTE.BLOOD_RED, 1);
        g.fillRoundedRect(px, y, pipWidth, pipHeight, 2);
        g.fillStyle(PALETTE.GOLD_BRIGHT, 0.65);
        g.fillRect(px + 2, y + 2, pipWidth - 4, 3);
      } else {
        g.fillStyle(PALETTE.PARCHMENT_DARK, 0.75);
        g.fillRoundedRect(px, y, pipWidth, pipHeight, 2);
      }
      g.lineStyle(1, PALETTE.WOOD_DARK, 0.85);
      g.strokeRoundedRect(px, y, pipWidth, pipHeight, 2);
    }
  }

  private createConfirmButton(): void {
    this.confirmBtnContainer = this.add.container(640, 646);

    const btnWidth = 540;
    const btnHeight = 56;

    const bg = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(PALETTE.BLACK, 0.65);
      bg.fillRoundedRect(-btnWidth / 2 + 4, -btnHeight / 2 + 5, btnWidth, btnHeight, 6);
      bg.fillStyle(hover ? PALETTE.BLOOD_RED : PALETTE.WOOD_DARK, 1);
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
      bg.lineStyle(2.5, hover ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK, 1);
      bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 6);
    };
    drawBtn(false);
    this.confirmBtnContainer.add(bg);

    const btnText = this.add
      .text(0, 0, '⚔   SWEAR OATH & BEGIN CAMPAIGN   ⚔', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 2,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.confirmBtnContainer.add(btnText);

    const hitZone = this.add.zone(0, 0, btnWidth + 12, btnHeight + 12);
    hitZone.setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      drawBtn(true);
      btnText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    });

    hitZone.on('pointerout', () => {
      drawBtn(false);
      btnText.setColor(PALETTE_HEX.GOLD_BRIGHT);
    });

    hitZone.on('pointerdown', () => {
      this.startCampaign();
    });

    this.confirmBtnContainer.add(hitZone);
  }

  public selectLord(lordId: string): void {
    this.selectedLordId = lordId;
    const lord: Lord = SAXON_LORDS[lordId];

    for (const card of this.lordCards) {
      card.selectionBorder.setVisible(card.id === lordId);
    }

    this.lordNameText.setText(lord.name.toUpperCase());
    this.lordTitleText.setText(lord.title);
    this.lordHomeText.setText(
      `Ancestral Stronghold: ${lord.homeTerritoryId.toUpperCase()}  •  Starting Treasury: ${lord.gold} Gold`
    );
    this.lordBioText.setText(lord.bio);
    this.lordQuoteText.setText(lord.historicalQuote);

    this.leadershipRatingText.setText(
      `${getCinemawareStatRating(lord.leadership)} (${lord.leadership}/10)`
    );
    this.joustingRatingText.setText(
      `${getCinemawareStatRating(lord.jousting)} (${lord.jousting}/10)`
    );
    this.swordplayRatingText.setText(
      `${getCinemawareStatRating(lord.swordplay)} (${lord.swordplay}/10)`
    );

    this.statBarsGraphics.clear();
    this.drawStatBar(this.statBarsGraphics, 122, -26, lord.leadership);
    this.drawStatBar(this.statBarsGraphics, 122, 26, lord.jousting);
    this.drawStatBar(this.statBarsGraphics, 122, 78, lord.swordplay);
  }

  private startCampaign(): void {
    GameState.getInstance().startNewCampaign(this.selectedLordId);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene');
    });
  }
}
