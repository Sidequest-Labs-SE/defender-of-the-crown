import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { SAXON_LORDS } from '../data/lords';
import { Lord, getCinemawareStatRating } from '../core/types';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { CrtOverlay } from '../utils/CrtOverlay';

interface LordCardUI {
  id: string;
  container: Phaser.GameObjects.Container;
  selectionBorder: Phaser.GameObjects.Graphics;
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedLordId = 'ivanhoe';
  private lordCards: LordCardUI[] = [];
  private crtOverlay!: CrtOverlay;

  // Detail panel elements
  private detailPanelContainer!: Phaser.GameObjects.Container;
  private lordNameText!: Phaser.GameObjects.Text;
  private lordTitleText!: Phaser.GameObjects.Text;
  private lordHomeText!: Phaser.GameObjects.Text;
  private lordBioText!: Phaser.GameObjects.Text;
  private lordQuoteText!: Phaser.GameObjects.Text;

  // Stat Bars & Ratings
  private leadershipRatingText!: Phaser.GameObjects.Text;
  private joustingRatingText!: Phaser.GameObjects.Text;
  private swordplayRatingText!: Phaser.GameObjects.Text;
  private statBarsGraphics!: Phaser.GameObjects.Graphics;

  // Confirm Button
  private confirmBtnContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    GameState.getInstance().setPhase('SELECT_CHARACTER');

    // 1. Medieval Stone Wall Background (640x400)
    this.createBackground();

    // 2. Header Bar
    this.createHeader();

    // 3. Four Selectable Lord Cards (Top Section)
    this.createLordCards();

    // 4. Dossier Detail Panel (Middle Section)
    this.createDetailPanel();

    // 5. "SWEAR OATH / BEGIN CAMPAIGN" Button (Bottom)
    this.createConfirmButton();

    // 6. Select default lord and refresh view
    this.selectLord('ivanhoe');

    // 7. Attach CRT Overlay
    this.crtOverlay = new CrtOverlay(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.crtOverlay.destroy();
    });
  }

  private createBackground(): void {
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.STONE_DARK, 1);
    bg.fillRect(0, 0, 640, 400);

    // Stone wall mortar lines
    bg.fillStyle(PALETTE.SHADOW, 0.4);
    for (let y = 0; y < 400; y += 16) {
      bg.fillRect(0, y, 640, 2);
      const offset = (y % 32 === 0) ? 0 : 32;
      for (let x = offset; x < 640; x += 64) {
        bg.fillRect(x, y, 2, 16);
      }
    }
  }

  private createHeader(): void {
    const headerBg = this.add.graphics();
    headerBg.fillStyle(PALETTE.WOOD_DARK, 0.95);
    headerBg.fillRect(20, 8, 600, 32);
    headerBg.lineStyle(2, PALETTE.GOLD_DARK, 1);
    headerBg.strokeRect(20, 8, 600, 32);

    headerBg.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    headerBg.fillRect(23, 11, 4, 4);
    headerBg.fillRect(613, 11, 4, 4);
    headerBg.fillRect(23, 33, 4, 4);
    headerBg.fillRect(613, 33, 4, 4);

    this.add.text(320, 24, '★ CHOOSE THY SAXON CHAMPION ★', {
      fontFamily: 'Courier New, monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 2,
    }).setOrigin(0.5);
  }

  private createLordCards(): void {
    const lords = Object.values(SAXON_LORDS);
    const cardWidth = 136;
    const cardHeight = 118;
    const startX = 86;
    const spacingX = 156;
    const cardY = 108;

    lords.forEach((lord, index) => {
      const cx = startX + index * spacingX;
      const container = this.add.container(cx, cardY);

      // Card Background
      const bg = this.add.graphics();
      bg.fillStyle(PALETTE.WOOD_DARK, 0.92);
      bg.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      bg.lineStyle(2, PALETTE.WOOD_MID, 1);
      bg.strokeRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      container.add(bg);

      // Card Portrait (52x52)
      const portrait = this.add.image(-28, -14, `portrait_${lord.id}`);
      portrait.setDisplaySize(54, 54);
      container.add(portrait);

      // Lord Shield Icon (32x40)
      const shield = this.add.image(30, -14, `shield_${lord.id}`);
      shield.setDisplaySize(34, 42);
      container.add(shield);

      // Short name banner
      const namePlate = this.add.graphics();
      namePlate.fillStyle(PALETTE.BLACK, 0.85);
      namePlate.fillRect(-cardWidth / 2 + 4, 26, cardWidth - 8, 26);
      container.add(namePlate);

      const nameText = this.add.text(0, 39, lord.name.split(' ')[0], {
        fontFamily: 'Courier New, monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        letterSpacing: 1,
      }).setOrigin(0.5);
      container.add(nameText);

      // Selection Glow Border
      const selectionBorder = this.add.graphics();
      selectionBorder.lineStyle(3, PALETTE.GOLD_BRIGHT, 1);
      selectionBorder.strokeRect(-cardWidth / 2 - 2, -cardHeight / 2 - 2, cardWidth + 4, cardHeight + 4);
      selectionBorder.setVisible(false);
      container.add(selectionBorder);

      // Interactive hit area (generous for mobile & desktop)
      const hitZone = this.add.zone(0, 0, cardWidth + 8, cardHeight + 8);
      hitZone.setInteractive({ useHandCursor: true });

      hitZone.on('pointerover', () => {
        if (this.selectedLordId !== lord.id) {
          bg.lineStyle(2, PALETTE.GOLD_DARK, 1);
          bg.strokeRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        }
      });

      hitZone.on('pointerout', () => {
        if (this.selectedLordId !== lord.id) {
          bg.lineStyle(2, PALETTE.WOOD_MID, 1);
          bg.strokeRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        }
      });

      hitZone.on('pointerdown', () => {
        this.selectLord(lord.id);
      });

      this.lordCards.push({
        id: lord.id,
        container,
        selectionBorder,
      });
    });
  }

  private createDetailPanel(): void {
    this.detailPanelContainer = this.add.container(320, 248);

    // Parchment Panel Background (600 x 128)
    const panelBg = this.add.graphics();
    // Drop shadow
    panelBg.fillStyle(PALETTE.BLACK, 0.8);
    panelBg.fillRect(-297, -61, 600, 128);
    // Wood border
    panelBg.fillStyle(PALETTE.WOOD_DARK, 1);
    panelBg.fillRect(-300, -64, 600, 128);
    // Parchment interior
    panelBg.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    panelBg.fillRect(-294, -58, 588, 116);
    // Dividing line between Bio (left) and Stats (right)
    panelBg.lineStyle(1, PALETTE.WOOD_MID, 0.8);
    panelBg.strokeRect(-294, -58, 588, 116);
    panelBg.lineBetween(50, -58, 50, 58);
    this.detailPanelContainer.add(panelBg);

    // Left Column: Lord Dossier (width ~330)
    this.lordNameText = this.add.text(-280, -50, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '15px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
      letterSpacing: 1,
    });
    this.detailPanelContainer.add(this.lordNameText);

    this.lordTitleText = this.add.text(-280, -32, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      fontStyle: 'italic',
      color: PALETTE_HEX.BLOOD_RED,
    });
    this.detailPanelContainer.add(this.lordTitleText);

    this.lordHomeText = this.add.text(-280, -17, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_MID,
    });
    this.detailPanelContainer.add(this.lordHomeText);

    this.lordBioText = this.add.text(-280, 0, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: PALETTE_HEX.BLACK,
      wordWrap: { width: 315 },
      lineSpacing: 3,
    });
    this.detailPanelContainer.add(this.lordBioText);

    this.lordQuoteText = this.add.text(-280, 36, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '10.5px',
      fontStyle: 'italic',
      color: PALETTE_HEX.WOOD_DARK,
      wordWrap: { width: 315 },
    });
    this.detailPanelContainer.add(this.lordQuoteText);

    // Right Column: Classic Cinemaware Stats Breakdown
    const statsHeader = this.add.text(65, -50, 'RATINGS & ABILITY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
      letterSpacing: 1,
    });
    this.detailPanelContainer.add(statsHeader);

    // Leadership Label
    const ldrLbl = this.add.text(65, -28, 'LEADERSHIP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(ldrLbl);

    this.leadershipRatingText = this.add.text(280, -28, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
    }).setOrigin(1, 0);
    this.detailPanelContainer.add(this.leadershipRatingText);

    // Jousting Label
    const jstLbl = this.add.text(65, -2, 'JOUSTING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(jstLbl);

    this.joustingRatingText = this.add.text(280, -2, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
    }).setOrigin(1, 0);
    this.detailPanelContainer.add(this.joustingRatingText);

    // Swordplay Label
    const swdLbl = this.add.text(65, 24, 'SWORDPLAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(swdLbl);

    this.swordplayRatingText = this.add.text(280, 24, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
    }).setOrigin(1, 0);
    this.detailPanelContainer.add(this.swordplayRatingText);

    // Stat bars graphics layer
    this.statBarsGraphics = this.add.graphics();
    this.detailPanelContainer.add(this.statBarsGraphics);
  }

  private drawStatBar(g: Phaser.GameObjects.Graphics, x: number, y: number, value: number): void {
    const totalPips = 10;
    const pipWidth = 17;
    const pipHeight = 7;
    const gap = 4;

    for (let i = 0; i < totalPips; i++) {
      const px = x + i * (pipWidth + gap);
      if (i < value) {
        g.fillStyle(PALETTE.BLOOD_RED, 1);
        g.fillRect(px, y, pipWidth, pipHeight);
        g.fillStyle(PALETTE.GOLD_BRIGHT, 0.7);
        g.fillRect(px, y, pipWidth, 2);
      } else {
        g.fillStyle(PALETTE.PARCHMENT_DARK, 0.7);
        g.fillRect(px, y, pipWidth, pipHeight);
      }
      g.lineStyle(1, PALETTE.WOOD_DARK, 0.8);
      g.strokeRect(px, y, pipWidth, pipHeight);
    }
  }

  private createConfirmButton(): void {
    this.confirmBtnContainer = this.add.container(320, 362);

    const btnWidth = 380;
    const btnHeight = 36;

    const bg = this.add.graphics();
    // Drop shadow
    bg.fillStyle(PALETTE.BLACK, 0.75);
    bg.fillRect(-btnWidth / 2 + 3, -btnHeight / 2 + 3, btnWidth, btnHeight);
    // Button body
    bg.fillStyle(PALETTE.WOOD_DARK, 1);
    bg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    // Gold trim
    bg.lineStyle(2, PALETTE.GOLD_DARK, 1);
    bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    this.confirmBtnContainer.add(bg);

    const btnText = this.add.text(0, 0, '⚔  SWEAR OATH / BEGIN CAMPAIGN  ⚔', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.confirmBtnContainer.add(btnText);

    // Generous touch target
    const hitZone = this.add.zone(0, 0, btnWidth + 12, btnHeight + 10);
    hitZone.setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      bg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      btnText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    });

    hitZone.on('pointerout', () => {
      bg.lineStyle(2, PALETTE.GOLD_DARK, 1);
      bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
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

    // Update selection indicators
    for (const card of this.lordCards) {
      card.selectionBorder.setVisible(card.id === lordId);
    }

    // Update Dossier Info
    this.lordNameText.setText(lord.name.toUpperCase());
    this.lordTitleText.setText(lord.title);
    this.lordHomeText.setText(`Home Castle: ${lord.homeTerritoryId.toUpperCase()} • Gold: ${lord.gold}`);
    this.lordBioText.setText(lord.bio);
    this.lordQuoteText.setText(lord.historicalQuote);

    // Update Cinemaware Rating Labels
    this.leadershipRatingText.setText(`${getCinemawareStatRating(lord.leadership)} (${lord.leadership}/10)`);
    this.joustingRatingText.setText(`${getCinemawareStatRating(lord.jousting)} (${lord.jousting}/10)`);
    this.swordplayRatingText.setText(`${getCinemawareStatRating(lord.swordplay)} (${lord.swordplay}/10)`);

    // Redraw Stat Bars
    this.statBarsGraphics.clear();
    this.drawStatBar(this.statBarsGraphics, 65, -16, lord.leadership);
    this.drawStatBar(this.statBarsGraphics, 65, 10, lord.jousting);
    this.drawStatBar(this.statBarsGraphics, 65, 36, lord.swordplay);
  }

  private startCampaign(): void {
    GameState.getInstance().startNewCampaign(this.selectedLordId);

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene');
    });
  }
}
