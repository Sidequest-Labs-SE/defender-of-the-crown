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

    // 1. Amiga Slate / Wood Background (640x400)
    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.SHADOW, 1);
    bg.fillRect(0, 0, 640, 400);

    // Subtle stone texture
    bg.fillStyle(PALETTE.STONE_DARK, 0.35);
    for (let y = 0; y < 400; y += 8) {
      bg.fillRect(0, y, 640, 2);
    }

    // 2. Header Banner
    const header = this.add.graphics();
    header.fillStyle(PALETTE.WOOD_DARK, 0.95);
    header.fillRect(18, 8, 604, 32);
    header.lineStyle(2, PALETTE.GOLD_DARK, 1);
    header.strokeRect(18, 8, 604, 32);

    this.add.text(320, 24, '★ CAMPAIGN INITIATION VERIFIED (SPRINT 1) ★', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);

    // 3. Player Lord Dossier Card (Left Panel, x: 18, y: 48, w: 296, h: 290)
    const leftPanel = this.add.graphics();
    leftPanel.fillStyle(PALETTE.WOOD_DARK, 0.92);
    leftPanel.fillRect(18, 48, 296, 290);
    leftPanel.lineStyle(2, PALETTE.GOLD_DARK, 0.85);
    leftPanel.strokeRect(18, 48, 296, 290);

    // Lord Portrait & Shield
    this.add.image(56, 90, `portrait_${playerLord.id}`).setDisplaySize(54, 54);
    this.add.image(108, 90, `shield_${playerLord.id}`).setDisplaySize(32, 40);

    this.add.text(138, 70, playerLord.name.toUpperCase(), {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
    });

    this.add.text(138, 90, `FACTION: SAXON (PLAYER)`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
    });

    this.add.text(138, 106, `HOME: ${playerLord.homeTerritoryId.toUpperCase()}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: PALETTE_HEX.PARCHMENT_DARK,
    });

    // Divider
    leftPanel.lineBetween(30, 130, 302, 130);

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

    let vitalY = 142;
    for (const line of vitals) {
      const isBullet = line.startsWith('  •');
      const isHeader = line.endsWith(':');
      this.add.text(30, vitalY, line, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        fontStyle: isHeader ? 'bold' : 'normal',
        color: isHeader
          ? PALETTE_HEX.GOLD_BRIGHT
          : isBullet
          ? PALETTE_HEX.PARCHMENT_LIGHT
          : PALETTE_HEX.PARCHMENT_DARK,
      });
      vitalY += 17;
    }

    // 4. Realm Overview Panel (Right Panel, x: 326, y: 48, w: 296, h: 290)
    const rightPanel = this.add.graphics();
    rightPanel.fillStyle(PALETTE.WOOD_DARK, 0.92);
    rightPanel.fillRect(326, 48, 296, 290);
    rightPanel.lineStyle(2, PALETTE.GOLD_DARK, 0.85);
    rightPanel.strokeRect(326, 48, 296, 290);

    this.add.text(474, 64, 'REALM & ACTIVE LORDS (6)', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);

    rightPanel.lineBetween(338, 80, 610, 80);

    let lordY = 90;
    for (const lord of Object.values(state.activeLords)) {
      const isPlayer = lord.id === state.selectedLordId;
      const factionTag = lord.faction === 'saxon' ? 'SAXON' : 'NORMAN';
      const homeTerritory = state.territories[lord.homeTerritoryId];

      const lordLine = `${lord.name.split(' ')[0]}: [${factionTag}]`;
      this.add.text(338, lordY, lordLine, {
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        fontStyle: isPlayer ? 'bold' : 'normal',
        color: isPlayer ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.PARCHMENT_LIGHT,
      });

      const terrLine = `  Hold: ${homeTerritory ? homeTerritory.name : lord.homeTerritoryId} (Castle)`;
      this.add.text(338, lordY + 14, terrLine, {
        fontFamily: 'Courier New, monospace',
        fontSize: '10.5px',
        color: PALETTE_HEX.STONE_LIGHT,
      });

      lordY += 30;
    }

    // Territory summary
    const neutralCount = Object.values(state.territories).filter((t) => !t.ownerId).length;
    const assignedCount = Object.values(state.territories).filter((t) => !!t.ownerId).length;

    this.add.text(338, 280, `Territories: ${assignedCount} Held, ${neutralCount} Neutral`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: PALETTE_HEX.PARCHMENT_DARK,
    });

    const nottsSherwood = state.territories['notts']?.isSherwood ? 'VERIFIED' : 'FAILED';
    this.add.text(338, 302, `Sherwood Sanctuary: ${nottsSherwood}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.FOLIAGE_LIGHT,
    });

    // 5. Bottom Navigation Bar: "RETURN / SELECT ANOTHER LORD"
    const btnContainer = this.add.container(320, 365);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(PALETTE.WOOD_DARK, 1);
    btnBg.fillRect(-200, -18, 400, 36);
    btnBg.lineStyle(2, PALETTE.GOLD_DARK, 1);
    btnBg.strokeRect(-200, -18, 400, 36);
    btnContainer.add(btnBg);

    const btnText = this.add.text(0, 0, '← RETURN TO CHARACTER SELECTION', {
      fontFamily: 'Courier New, monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      letterSpacing: 1,
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    const hitZone = this.add.zone(0, 0, 410, 44);
    hitZone.setInteractive({ useHandCursor: true });
    hitZone.on('pointerover', () => {
      btnBg.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      btnBg.strokeRect(-200, -18, 400, 36);
      btnText.setColor(PALETTE_HEX.PARCHMENT_LIGHT);
    });
    hitZone.on('pointerout', () => {
      btnBg.lineStyle(2, PALETTE.GOLD_DARK, 1);
      btnBg.strokeRect(-200, -18, 400, 36);
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
