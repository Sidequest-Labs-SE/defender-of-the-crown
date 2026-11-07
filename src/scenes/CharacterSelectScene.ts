import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { SAXON_LORDS, NORMAN_LORDS, ALL_LORDS } from '../data/lords';
import { Lord, getCinemawareStatRating } from '../core/types';
import { PALETTE, PALETTE_HEX, SIDEQUEST_PALETTE, SIDEQUEST_PALETTE_HEX } from '../data/palette';
import { AudioManager } from '../utils/AudioManager';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';

interface LordCardUI {
  id: string;
  container: Phaser.GameObjects.Container;
  selectionBorder: Phaser.GameObjects.Graphics;
  hoverBorder: Phaser.GameObjects.Graphics;
  hitRect: Phaser.GameObjects.Rectangle;
}

export class CharacterSelectScene extends Phaser.Scene {
  private selectedLordId = 'ivanhoe';
  private selectedFaction: 'saxon' | 'norman' = 'saxon';
  private lordCards: LordCardUI[] = [];
  private activeHitRects: Phaser.GameObjects.Rectangle[] = [];
  private headerContainer!: Phaser.GameObjects.Container;
  private lastClickTime = 0;
  private isStarting = false;

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
  private confirmBtnText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  create(): void {
    PixelArtGenerator.generateAll(this);
    SidequestArtGenerator.generateAll(this);
    GameState.getInstance().setPhase('SELECT_CHARACTER');
    this.lordCards = [];
    this.isStarting = false;

    this.createBackground();
    this.createHeader();
    this.createLordCards();
    this.createDetailPanel();
    this.createConfirmButton();
    this.createKeyboardShortcuts();
    this.selectLord('ivanhoe', false);
  }

  private createBackground(): void {
    const isSidequest = GameState.getInstance().isSidequestEdition();
    const bg = this.add.graphics();
    bg.fillStyle(isSidequest ? SIDEQUEST_PALETTE.SHADOW_ABYSS : 0x1f222b, 1);
    bg.fillRect(0, 0, 1280, 720);

    // Subtle stone masonry lines
    bg.fillStyle(isSidequest ? SIDEQUEST_PALETTE.MASONRY_SHADOW : 0x13151c, 0.55);
    for (let y = 0; y < 720; y += 36) {
      bg.fillRect(0, y, 1280, 2);
      const offset = y % 72 === 0 ? 0 : 60;
      for (let x = offset; x < 1280; x += 120) {
        bg.fillRect(x, y, 2, 36);
      }
    }

    if (isSidequest) {
      // Warm council-hall torchlight halos in upper corners
      bg.fillStyle(SIDEQUEST_PALETTE.TORCH_AMBER, 0.08);
      bg.fillCircle(90, 90, 210);
      bg.fillCircle(1190, 90, 210);
    }
  }

  private createHeader(): void {
    if (this.headerContainer) {
      this.headerContainer.destroy();
    }
    this.headerContainer = this.add.container(0, 0);

    const isSidequest = GameState.getInstance().isSidequestEdition();
    const headerBg = this.add.graphics();
    headerBg.fillStyle(
      isSidequest ? SIDEQUEST_PALETTE.OAK_SHADOW : PALETTE.WOOD_DARK,
      0.96
    );
    headerBg.fillRoundedRect(60, 20, 1160, 58, 6);
    headerBg.lineStyle(
      2.5,
      isSidequest ? SIDEQUEST_PALETTE.GOLD_GLEAM : PALETTE.GOLD_DARK,
      1
    );
    headerBg.strokeRoundedRect(60, 20, 1160, 58, 6);
    this.headerContainer.add(headerBg);

    if (!isSidequest) {
      const title = this.add
        .text(640, 49, '★  CHOOSE THY SAXON CHAMPION  ★', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '26px',
          fontStyle: 'bold',
          color: PALETTE_HEX.GOLD_BRIGHT,
          letterSpacing: 3,
          resolution: 2,
        })
        .setOrigin(0.5);
      this.headerContainer.add(title);
      return;
    }

    // SIDEQUEST LABS: Title + Faction Toggle Tabs [ 🛡 SAXON LORDS (4) ] vs [ ⚔ NORMAN LORDS (3) ]
    const title = this.add
      .text(210, 49, '★ CHOOSE THY LORD ★', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR,
        letterSpacing: 2,
        resolution: 2,
      })
      .setOrigin(0.5);
    this.headerContainer.add(title);

    const isSax = this.selectedFaction === 'saxon';
    const saxTab = this.addFactionTab(480, 49, '🛡  SAXON LORDS (4)', isSax, () => {
      if (this.selectedFaction !== 'saxon') {
        this.selectedFaction = 'saxon';
        this.createHeader();
        this.createLordCards();
        this.selectLord('ivanhoe');
      }
    });

    const normTab = this.addFactionTab(750, 49, '⚔  NORMAN LORDS (3)', !isSax, () => {
      if (this.selectedFaction !== 'norman') {
        this.selectedFaction = 'norman';
        this.createHeader();
        this.createLordCards();
        this.selectLord('malvoisin');
      }
    });
    this.headerContainer.add([saxTab, normTab]);

    const editionBadge = this.add
      .text(1204, 49, '👑 SIDEQUEST LABS', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: SIDEQUEST_PALETTE_HEX.GOLD_GLEAM,
        backgroundColor: SIDEQUEST_PALETTE_HEX.CRIMSON_SHADOW,
        padding: { x: 8, y: 4 },
        resolution: 2,
      })
      .setOrigin(1, 0.5);
    this.headerContainer.add(editionBadge);
  }

  private addFactionTab(
    x: number,
    y: number,
    text: string,
    isActive: boolean,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const w = 220;
    const h = 38;
    const tab = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(
      isActive ? SIDEQUEST_PALETTE.GOLD_ROYAL : SIDEQUEST_PALETTE.SHADOW_SLATE,
      0.95
    );
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    bg.lineStyle(
      2,
      isActive ? SIDEQUEST_PALETTE.GOLD_SPECULAR : SIDEQUEST_PALETTE.BRONZE_SHADOW,
      1
    );
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    tab.add(bg);

    const label = this.add
      .text(0, 0, text, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: isActive ? '#140D05' : PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: 2,
      })
      .setOrigin(0.5);
    tab.add(label);

    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      AudioManager.playUiClick();
      onClick();
    });
    tab.add(hit);

    return tab;
  }

  private createLordCards(): void {
    const isSidequest = GameState.getInstance().isSidequestEdition();
    this.lordCards.forEach((c) => c.container.destroy());
    this.lordCards = [];
    this.activeHitRects.forEach((h) => h.destroy());
    this.activeHitRects = [];

    const isNorman = isSidequest && this.selectedFaction === 'norman';
    const lords = isNorman ? Object.values(NORMAN_LORDS) : Object.values(SAXON_LORDS);
    const cardWidth = isNorman ? 290 : 264;
    const cardHeight = 208;
    const startX = isNorman ? 280 : 192;
    const spacingX = isNorman ? 360 : 298;
    const cardY = 204;

    lords.forEach((lord, index) => {
      const cx = startX + index * spacingX;
      const container = this.add.container(cx, cardY);
      container.setDepth(5);

      const bg = this.add.graphics();
      bg.fillStyle(PALETTE.BLACK, 0.5);
      bg.fillRoundedRect(-cardWidth / 2 + 4, -cardHeight / 2 + 5, cardWidth, cardHeight, 6);
      bg.fillStyle(
        isSidequest ? SIDEQUEST_PALETTE.SHADOW_SLATE : PALETTE.WOOD_DARK,
        0.96
      );
      bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      bg.lineStyle(
        2,
        isSidequest ? SIDEQUEST_PALETTE.GOLD_BURNISHED : PALETTE.WOOD_MID,
        1
      );
      bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      container.add(bg);

      // Crisp 2x Retro Pixel-Art Portrait (96x96) & Shield (66x84)
      const portraitKey = SidequestArtGenerator.getPortraitKey(
        this,
        lord.id,
        isSidequest
      );
      const portrait = this.add
        .image(-48, -24, portraitKey)
        .setDisplaySize(96, 96);
      container.add(portrait);

      if (isSidequest) {
        SidequestArtGenerator.addGleamingFrame(
          this,
          container,
          -48,
          -24,
          96,
          96,
          SIDEQUEST_PALETTE.GOLD_GLEAM
        );
      }

      const shieldKey = SidequestArtGenerator.getShieldKey(
        this,
        lord.id,
        isSidequest
      );
      const shield = this.add
        .image(56, -24, shieldKey)
        .setDisplaySize(60, 76);
      container.add(shield);

      const namePlate = this.add.graphics();
      namePlate.fillStyle(PALETTE.BLACK, 0.82);
      namePlate.fillRoundedRect(-cardWidth / 2 + 10, 44, cardWidth - 20, 46, 4);
      container.add(namePlate);

      const nameText = this.add
        .text(0, 67, lord.name.toUpperCase(), {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: isNorman ? '13.5px' : '15px',
          fontStyle: 'bold',
          color: PALETTE_HEX.PARCHMENT_LIGHT,
          resolution: 2,
        })
        .setOrigin(0.5);
      container.add(nameText);

      // Subtle hover border indicator
      const hoverBorder = this.add.graphics();
      hoverBorder.lineStyle(2.5, PALETTE.GOLD_DARK, 0.9);
      hoverBorder.strokeRoundedRect(
        -cardWidth / 2 - 1,
        -cardHeight / 2 - 1,
        cardWidth + 2,
        cardHeight + 2,
        7
      );
      hoverBorder.setVisible(false);
      container.add(hoverBorder);

      // Golden highlight border for active selection
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

      // Dedicated Top-Level Hit Rectangle for full card clickability
      const hitRect = this.add.rectangle(cx, cardY, cardWidth, cardHeight, 0x000000, 0);
      hitRect.setDepth(100);
      hitRect.setInteractive({ useHandCursor: true });

      hitRect.on('pointerdown', () => {
        this.selectLord(lord.id);
      });

      hitRect.on('pointerup', () => {
        this.selectLord(lord.id);
      });

      hitRect.on('pointerover', () => {
        if (this.selectedLordId !== lord.id) {
          hoverBorder.setVisible(true);
        }
      });

      hitRect.on('pointerout', () => {
        hoverBorder.setVisible(false);
      });

      this.lordCards.push({ id: lord.id, container, selectionBorder, hoverBorder, hitRect });
      this.activeHitRects.push(hitRect);
    });
  }

  private createDetailPanel(): void {
    this.detailPanelContainer = this.add.container(640, 456);
    this.detailPanelContainer.setDepth(5);

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
    this.confirmBtnContainer.setDepth(5);

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
    this.confirmBtnText = btnText;
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

  private createKeyboardShortcuts(): void {
    if (!this.input.keyboard) return;

    const getLordIds = () =>
      this.selectedFaction === 'norman'
        ? ['malvoisin', 'frontdeboeuf', 'boisguilbert']
        : ['ivanhoe', 'cedric', 'geoffrey', 'wolfric'];

    const selectByIndex = (index: number) => {
      const ids = getLordIds();
      if (index >= 0 && index < ids.length) {
        this.selectLord(ids[index]);
      }
    };

    const cycleLord = (delta: number) => {
      const ids = getLordIds();
      const currentIndex = ids.indexOf(this.selectedLordId);
      const newIndex = (currentIndex + delta + ids.length) % ids.length;
      this.selectLord(ids[newIndex]);
    };

    this.input.keyboard.on('keydown-ONE', () => selectByIndex(0));
    this.input.keyboard.on('keydown-TWO', () => selectByIndex(1));
    this.input.keyboard.on('keydown-THREE', () => selectByIndex(2));
    this.input.keyboard.on('keydown-FOUR', () => selectByIndex(3));

    this.input.keyboard.on('keydown-NUMPAD_ONE', () => selectByIndex(0));
    this.input.keyboard.on('keydown-NUMPAD_TWO', () => selectByIndex(1));
    this.input.keyboard.on('keydown-NUMPAD_THREE', () => selectByIndex(2));
    this.input.keyboard.on('keydown-NUMPAD_FOUR', () => selectByIndex(3));

    this.input.keyboard.on('keydown-LEFT', () => cycleLord(-1));
    this.input.keyboard.on('keydown-RIGHT', () => cycleLord(1));

    if (GameState.getInstance().isSidequestEdition()) {
      this.input.keyboard.on('keydown-TAB', (e: KeyboardEvent) => {
        if (e && e.preventDefault) e.preventDefault();
        const nextFaction = this.selectedFaction === 'saxon' ? 'norman' : 'saxon';
        this.selectedFaction = nextFaction;
        this.createHeader();
        this.createLordCards();
        this.selectLord(nextFaction === 'norman' ? 'malvoisin' : 'ivanhoe');
      });
    }

    this.input.keyboard.on('keydown-ENTER', () => this.startCampaign());
    this.input.keyboard.on('keydown-SPACE', () => this.startCampaign());
  }

  public selectLord(lordId: string, playSound = true): void {
    const lord: Lord = (ALL_LORDS as Record<string, Lord>)[lordId] ?? SAXON_LORDS[lordId];
    if (!lord) return;

    this.selectedLordId = lordId;
    if (this.confirmBtnText) {
      this.confirmBtnText.setText(
        lord.faction === 'norman'
          ? '⚔   SWEAR FEALTY & BEGIN CONQUEST   ⚔'
          : '⚔   SWEAR OATH & BEGIN CAMPAIGN   ⚔'
      );
    }

    if (playSound) {
      const now = Date.now();
      if (now - this.lastClickTime > 80) {
        this.lastClickTime = now;
        AudioManager.playUiClick();
      }
    }

    for (const card of this.lordCards) {
      const isSelected = card.id === lordId;
      card.selectionBorder.setVisible(isSelected);
      if (isSelected) {
        card.hoverBorder.setVisible(false);
      }
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
    if (this.isStarting) return;
    this.isStarting = true;

    AudioManager.playUiClick();
    const gs = GameState.getInstance();
    gs.startNewCampaign(this.selectedLordId, gs.getEdition());

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MapScene');
    });
  }
}
