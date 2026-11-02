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

    // 1. Medieval Stone / Wood Wall Background
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
    // Dark stone background
    bg.fillStyle(PALETTE.STONE_DARK, 1);
    bg.fillRect(0, 0, 320, 200);

    // Dithered stone wall pattern
    bg.fillStyle(PALETTE.SHADOW, 0.4);
    for (let y = 0; y < 200; y += 8) {
      bg.fillRect(0, y, 320, 1);
      const offset = (y % 16 === 0) ? 0 : 16;
      for (let x = offset; x < 320; x += 32) {
        bg.fillRect(x, y, 1, 8);
      }
    }
  }

  private createHeader(): void {
    const headerBg = this.add.graphics();
    headerBg.fillStyle(PALETTE.WOOD_DARK, 0.95);
    headerBg.fillRect(10, 4, 300, 20);
    headerBg.lineStyle(1, PALETTE.GOLD_DARK, 1);
    headerBg.strokeRect(10, 4, 300, 20);

    // Inner gold studs
    headerBg.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    headerBg.fillRect(12, 6, 2, 2);
    headerBg.fillRect(306, 6, 2, 2);
    headerBg.fillRect(12, 20, 2, 2);
    headerBg.fillRect(306, 20, 2, 2);

    this.add.text(160, 14, '★ CHOOSE THY SAXON CHAMPION ★', {
      fontFamily: 'Courier New, monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);
  }

  private createLordCards(): void {
    const lords = Object.values(SAXON_LORDS);
    const cardWidth = 68;
    const cardHeight = 64;
    const startX = 44;
    const spacingX = 77;
    const cardY = 58;

    lords.forEach((lord, index) => {
      const cx = startX + index * spacingX;
      const container = this.add.container(cx, cardY);

      // Card Background
      const bg = this.add.graphics();
      bg.fillStyle(PALETTE.WOOD_DARK, 0.9);
      bg.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      bg.lineStyle(1, PALETTE.WOOD_MID, 1);
      bg.strokeRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      container.add(bg);

      // Card Portrait (scaled slightly to fit 36x36)
      const portrait = this.add.image(-12, -8, `portrait_${lord.id}`);
      portrait.setDisplaySize(34, 34);
      container.add(portrait);

      // Lord Shield Icon
      const shield = this.add.image(18, -8, `shield_${lord.id}`);
      shield.setDisplaySize(20, 25);
      container.add(shield);

      // Short name banner
      const namePlate = this.add.graphics();
      namePlate.fillStyle(PALETTE.BLACK, 0.8);
      namePlate.fillRect(-cardWidth / 2 + 2, 14, cardWidth - 4, 14);
      container.add(namePlate);

      const nameText = this.add.text(0, 21, lord.name.split(' ')[0], {
        fontFamily: 'Courier New, monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
      }).setOrigin(0.5);
      container.add(nameText);

      // Selection Glow Border
      const selectionBorder = this.add.graphics();
      selectionBorder.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      selectionBorder.strokeRect(-cardWidth / 2 - 1, -cardHeight / 2 - 1, cardWidth + 2, cardHeight + 2);
      selectionBorder.setVisible(false);
      container.add(selectionBorder);

      // Interactive hit area
      const hitZone = this.add.zone(0, 0, cardWidth, cardHeight);
      hitZone.setInteractive({ useHandCursor: true });

      hitZone.on('pointerover', () => {
        if (this.selectedLordId !== lord.id) {
          bg.lineStyle(1, PALETTE.GOLD_DARK, 1);
          bg.strokeRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
        }
      });

      hitZone.on('pointerout', () => {
        if (this.selectedLordId !== lord.id) {
          bg.lineStyle(1, PALETTE.WOOD_MID, 1);
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
    this.detailPanelContainer = this.add.container(160, 131);

    // Parchment Panel Background (296 x 68)
    const panelBg = this.add.graphics();
    // Drop shadow
    panelBg.fillStyle(PALETTE.BLACK, 0.8);
    panelBg.fillRect(-147, -33, 296, 68);
    // Wood border
    panelBg.fillStyle(PALETTE.WOOD_DARK, 1);
    panelBg.fillRect(-148, -34, 296, 68);
    // Parchment interior
    panelBg.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    panelBg.fillRect(-145, -31, 290, 62);
    // Gold filigree line dividing Bio (left) and Stats (right)
    panelBg.lineStyle(1, PALETTE.WOOD_MID, 0.7);
    panelBg.strokeRect(-145, -31, 290, 62);
    panelBg.lineBetween(25, -31, 25, 31);
    this.detailPanelContainer.add(panelBg);

    // Left Column: Lord Dossier
    this.lordNameText = this.add.text(-138, -27, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(this.lordNameText);

    this.lordTitleText = this.add.text(-138, -17, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      fontStyle: 'italic',
      color: PALETTE_HEX.BLOOD_RED,
    });
    this.detailPanelContainer.add(this.lordTitleText);

    this.lordHomeText = this.add.text(-138, -8, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7px',
      color: PALETTE_HEX.WOOD_MID,
    });
    this.detailPanelContainer.add(this.lordHomeText);

    this.lordBioText = this.add.text(-138, 3, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
      color: PALETTE_HEX.BLACK,
      wordWrap: { width: 160 },
      lineSpacing: 1,
    });
    this.detailPanelContainer.add(this.lordBioText);

    this.lordQuoteText = this.add.text(-138, 22, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      fontStyle: 'italic',
      color: PALETTE_HEX.WOOD_DARK,
      wordWrap: { width: 160 },
    });
    this.detailPanelContainer.add(this.lordQuoteText);

    // Right Column: Classic Cinemaware Stats Breakdown
    const statsHeader = this.add.text(32, -27, 'RATINGS & ABILITY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(statsHeader);

    // Leadership Label
    const ldrLbl = this.add.text(32, -15, 'LEADERSHIP', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(ldrLbl);

    this.leadershipRatingText = this.add.text(140, -15, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
    }).setOrigin(1, 0);
    this.detailPanelContainer.add(this.leadershipRatingText);

    // Jousting Label
    const jstLbl = this.add.text(32, -1, 'JOUSTING', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(jstLbl);

    this.joustingRatingText = this.add.text(140, -1, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.BLOOD_RED,
    }).setOrigin(1, 0);
    this.detailPanelContainer.add(this.joustingRatingText);

    // Swordplay Label
    const swdLbl = this.add.text(32, 13, 'SWORDPLAY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
      color: PALETTE_HEX.WOOD_DARK,
    });
    this.detailPanelContainer.add(swdLbl);

    this.swordplayRatingText = this.add.text(140, 13, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '6.5px',
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
    const pipWidth = 9;
    const pipHeight = 4;
    const gap = 2;

    for (let i = 0; i < totalPips; i++) {
      const px = x + i * (pipWidth + gap);
      if (i < value) {
        // Filled pip
        g.fillStyle(PALETTE.BLOOD_RED, 1);
        g.fillRect(px, y, pipWidth, pipHeight);
        g.fillStyle(PALETTE.GOLD_BRIGHT, 0.6);
        g.fillRect(px, y, pipWidth, 1);
      } else {
        // Empty pip
        g.fillStyle(PALETTE.PARCHMENT_DARK, 0.6);
        g.fillRect(px, y, pipWidth, pipHeight);
      }
      g.lineStyle(1, PALETTE.WOOD_DARK, 0.7);
      g.strokeRect(px, y, pipWidth, pipHeight);
    }
  }

  private createConfirmButton(): void {
    this.confirmBtnContainer = this.add.container(160, 182);

    const btnWidth = 190;
    const btnHeight = 22;

    const bg = this.add.graphics();
    // Drop shadow
    bg.fillStyle(PALETTE.BLACK, 0.7);
    bg.fillRect(-btnWidth / 2 + 2, -btnHeight / 2 + 2, btnWidth, btnHeight);
    // Button body
    bg.fillStyle(PALETTE.WOOD_DARK, 1);
    bg.fillRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    // Gold trim
    bg.lineStyle(1, PALETTE.GOLD_DARK, 1);
    bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
    this.confirmBtnContainer.add(bg);

    const btnText = this.add.text(0, 0, '⚔  SWEAR OATH / BEGIN CAMPAIGN  ⚔', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 0.5,
    }).setOrigin(0.5);
    this.confirmBtnContainer.add(btnText);

    const hitZone = this.add.zone(0, 0, btnWidth, btnHeight);
    hitZone.setInteractive({ useHandCursor: true });

    hitZone.on('pointerover', () => {
      bg.lineStyle(1, PALETTE.GOLD_BRIGHT, 1);
      bg.strokeRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight);
      btnText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    });

    hitZone.on('pointerout', () => {
      bg.lineStyle(1, PALETTE.GOLD_DARK, 1);
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
    this.drawStatBar(this.statBarsGraphics, 32, -7, lord.leadership);
    this.drawStatBar(this.statBarsGraphics, 32, 7, lord.jousting);
    this.drawStatBar(this.statBarsGraphics, 32, 21, lord.swordplay);
  }

  private startCampaign(): void {
    // 1. Initialize GameState for the selected lord
    GameState.getInstance().startNewCampaign(this.selectedLordId);

    // 2. Transition to MapScene
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene');
    });
  }
}
