import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { CrtOverlay } from '../utils/CrtOverlay';

export class MapScene extends Phaser.Scene {
  private crtOverlay!: CrtOverlay;

  constructor() {
    super({ key: 'MapScene' });
  }

  create(): void {
    const gameState = GameState.getInstance();
    const state = gameState.getState();
    const playerLord = gameState.getPlayerLord();

    // 1. Amiga Slate / Wood Background
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.SHADOW, 1);
    bg.fillRect(0, 0, 320, 200);

    // Subtle dithered texture
    bg.fillStyle(PALETTE.STONE_DARK, 0.35);
    for (let y = 0; y < 200; y += 4) {
      bg.fillRect(0, y, 320, 1);
    }

    // 2. Header Banner
    const header = this.add.graphics();
    header.fillStyle(PALETTE.WOOD_DARK, 0.95);
    header.fillRect(8, 4, 304, 18);
    header.lineStyle(1, PALETTE.GOLD_DARK, 1);
    header.strokeRect(8, 4, 304, 18);

    this.add.text(160, 13, '★ CAMPAIGN INITIATION VERIFIED (SPRINT 1) ★', {
      fontFamily: 'Courier New, monospace',
      fontSize: '8.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    }).setOrigin(0.5);

    // 3. Player Lord Dossier Card (Left Panel, x: 8, y: 26, w: 148, h: 148)
    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(PALETTE.WOOD_DARK, 0.9);
    leftPanel.fillRect(8, 26, 148, 146);
    leftPanel.lineStyle(1, PALETTE.GOLD_DARK, 0.8);
    leftPanel.strokeRect(8, 26, 148, 146);

    // Lord Portrait & Shield
    this.add.image(28, 48, `portrait_${playerLord.id}`).setDisplaySize(32, 32);
    this.add.image(54, 48, `shield_${playerLord.id}`).setDisplaySize(18, 23);

    this.add.text(68, 38, playerLord.name.toUpperCase(), {
      fontFamily: 'Courier New, monospace',
      fontSize: '7.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    });

    this.add.text(68, 49, `FACTION: SAXON (PLAYER)`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
    });

    this.add.text(68, 58, `HOME: ${playerLord.homeTerritoryId.toUpperCase()}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      color: PALETTE_HEX.PARCHMENT_DARK,
    });

    // Divider
    leftPanel.lineBetween(14, 70, 150, 70);

    // Campaign Vitals
    const vitals = [
      `YEAR: ${state.year} A.D.  MONTH: ${state.month} (JAN)`,
      `TURN: ${state.turn} | ROBIN HOOD USES: ${state.robinHoodUsesLeft}`,
      `TREASURY: ${playerLord.gold} GOLD PIECES`,
      `CAMPAIGN ARMY (FIELD):`,
      `  • ${playerLord.campaignArmy.soldiers} Soldiers`,
      `  • ${playerLord.campaignArmy.knights} Knight`,
      `  • ${playerLord.campaignArmy.catapults} Catapults`,
      `HOME CASTLE GARRISON:`,
      `  • 10 Soldiers (Guarding Castle)`,
    ];

    let vitalY = 76;
    for (const line of vitals) {
      const isBullet = line.startsWith('  •');
      const isHeader = line.endsWith(':');
      this.add.text(14, vitalY, line, {
        fontFamily: 'Courier New, monospace',
        fontSize: '6.5px',
        fontStyle: isHeader ? 'bold' : 'normal',
        color: isHeader
          ? PALETTE_HEX.GOLD_BRIGHT
          : isBullet
          ? PALETTE_HEX.PARCHMENT_LIGHT
          : PALETTE_HEX.PARCHMENT_DARK,
      });
      vitalY += 9;
    }

    // 4. Realm Overview Panel (Right Panel, x: 162, y: 26, w: 150, h: 146)
    const rightPanel = this.add.graphics();
    rightPanel.fillStyle(PALETTE.WOOD_DARK, 0.9);
    rightPanel.fillRect(162, 26, 150, 146);
    rightPanel.lineStyle(1, PALETTE.GOLD_DARK, 0.8);
    rightPanel.strokeRect(162, 26, 150, 146);

    this.add.text(237, 34, 'REALM & ACTIVE LORDS (6)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    }).setOrigin(0.5);

    rightPanel.lineBetween(168, 42, 306, 42);

    let lordY = 46;
    for (const lord of Object.values(state.activeLords)) {
      const isPlayer = lord.id === state.selectedLordId;
      const factionTag = lord.faction === 'saxon' ? 'SAXON' : 'NORMAN';
      const homeTerritory = state.territories[lord.homeTerritoryId];

      const lordLine = `${lord.name.split(' ')[0]}: [${factionTag}]`;
      this.add.text(168, lordY, lordLine, {
        fontFamily: 'Courier New, monospace',
        fontSize: '6.5px',
        fontStyle: isPlayer ? 'bold' : 'normal',
        color: isPlayer ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.PARCHMENT_LIGHT,
      });

      const terrLine = `  Hold: ${homeTerritory ? homeTerritory.name : lord.homeTerritoryId} (Castle)`;
      this.add.text(168, lordY + 8, terrLine, {
        fontFamily: 'Courier New, monospace',
        fontSize: '6px',
        color: PALETTE_HEX.STONE_LIGHT,
      });

      lordY += 16;
    }

    // Territory summary
    const neutralCount = Object.values(state.territories).filter((t) => !t.ownerId).length;
    const assignedCount = Object.values(state.territories).filter((t) => !!t.ownerId).length;

    this.add.text(168, 148, `Territories: ${assignedCount} Held, ${neutralCount} Neutral`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      color: PALETTE_HEX.PARCHMENT_DARK,
    });

    const nottsSherwood = state.territories['notts']?.isSherwood ? 'VERIFIED' : 'FAILED';
    this.add.text(168, 158, `Sherwood Sanctuary: ${nottsSherwood}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '6px',
      fontStyle: 'bold',
      color: PALETTE_HEX.FOLIAGE_LIGHT,
    });

    // 5. Bottom Navigation Bar: "RETURN / SELECT ANOTHER LORD"
    const btnContainer = this.add.container(160, 185);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(PALETTE.WOOD_DARK, 1);
    btnBg.fillRect(-110, -9, 220, 18);
    btnBg.lineStyle(1, PALETTE.GOLD_DARK, 1);
    btnBg.strokeRect(-110, -9, 220, 18);
    btnContainer.add(btnBg);

    const btnText = this.add.text(0, 0, '← RETURN TO CHARACTER SELECTION', {
      fontFamily: 'Courier New, monospace',
      fontSize: '7.5px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    const hitZone = this.add.zone(0, 0, 220, 18);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => {
      btnBg.lineStyle(1, PALETTE.GOLD_BRIGHT, 1);
      btnBg.strokeRect(-110, -9, 220, 18);
      btnText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    });
    hitZone.on('pointerout', () => {
      btnBg.lineStyle(1, PALETTE.GOLD_DARK, 1);
      btnBg.strokeRect(-110, -9, 220, 18);
      btnText.setColor(PALETTE_HEX.GOLD_BRIGHT);
    });
    hitZone.on('pointerdown', () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start('CharacterSelectScene');
      });
    });
    btnContainer.add(hitZone);

    // 6. CRT Overlay
    this.crtOverlay = new CrtOverlay(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.crtOverlay.destroy();
    });
  }
}
