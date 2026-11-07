import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { TurnManager } from '../core/TurnManager';
import { CombatResolver } from '../core/CombatResolver';
import {
  AiTurnQueueState,
  CampaignState,
  getCinemawareStatRating,
  InteractiveTurnResult,
  JoustStakesType,
  Lord,
  MONTH_NAMES,
  PendingBattleContext,
  PendingJoustContext,
  PendingSwordplayContext,
  ROBIN_HOOD_MERRY_MEN_COUNT,
  Territory,
  UNIT_COSTS,
  UnitType,
} from '../core/types';
import { SAXON_DAMSELS } from '../data/damsels';
import { ALL_RELICS, RelicId } from '../data/relics';
import { isCoastalPort, EAST_COAST_PORTS, WEST_COAST_PORTS } from '../data/territories';
import { PALETTE, PALETTE_HEX } from '../data/palette';
import { PixelArtGenerator } from '../utils/PixelArtGenerator';
import { SidequestArtGenerator } from '../utils/SidequestArtGenerator';
import { AudioManager } from '../utils/AudioManager';

export interface MapSceneInitData {
  resumeAiQueue?: AiTurnQueueState;
  lastBattleMessage?: string;
  lastBattleAlert?: boolean;
  focusTerritoryId?: string;
}

type RightPanelMode =
  | 'DOSSIER'
  | 'RECRUIT'
  | 'RAID'
  | 'ROBIN_HOOD'
  | 'CHRONICLE'
  | 'TOURNAMENT'
  | 'TAVERN';

interface TerritoryPolyHit {
  id: string;
  poly: Phaser.Geom.Polygon;
}

const FONT_HEADING = 'Cinzel, Georgia, serif';
const FONT_BODY = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
const TEXT_RES = 2;

export class MapScene extends Phaser.Scene {
  private turnManager!: TurnManager;

  // Presentation UI State (All state mutations live strictly in core/)
  private selectedTerritoryId = 'yorkshire';
  private hoveredTerritoryId: string | null = null;
  private isMarchMode = false;
  private panelMode: RightPanelMode = 'DOSSIER';
  private tournamentStakes: JoustStakesType = 'FAME';
  private statusBannerMessage = 'Select a territory or issue commands to thy host.';
  private statusBannerIsAlert = false;
  private pulsePhase = 0;
  private refreshPending = false;
  private isTransitioningToBattle = false;

  private territoryPolys: TerritoryPolyHit[] = [];

  // Left Map Zone Layers (x: 0..780, y: 0..720)
  private mapTerritoryGraphics!: Phaser.GameObjects.Graphics;
  private mapPathsGraphics!: Phaser.GameObjects.Graphics;
  private mapHighlightGraphics!: Phaser.GameObjects.Graphics;
  private mapMarkersContainer!: Phaser.GameObjects.Container;
  private mapTooltipBg!: Phaser.GameObjects.Graphics;
  private mapTooltipText!: Phaser.GameObjects.Text;
  private mapStatusBannerBg!: Phaser.GameObjects.Graphics;
  private mapStatusBannerText!: Phaser.GameObjects.Text;
  private mapDamselAlertContainer!: Phaser.GameObjects.Container;

  // Right Command HUD Containers (x: 780..1280, y: 0..720)
  private topBannerContainer!: Phaser.GameObjects.Container;
  private dynamicPanelContainer!: Phaser.GameObjects.Container;
  private commandButtonsContainer!: Phaser.GameObjects.Container;
  private endGameModalContainer!: Phaser.GameObjects.Container;

  private unsubscribeState?: () => void;

  constructor() {
    super({ key: 'MapScene' });
  }

  create(data?: MapSceneInitData): void {
    PixelArtGenerator.generateAll(this);

    const gameState = GameState.getInstance();
    this.turnManager = new TurnManager(gameState);
    this.isTransitioningToBattle = false;

    const initialCheck = gameState.getState();
    const playerCheck = initialCheck.activeLords[initialCheck.selectedLordId];
    if (!playerCheck || (!playerCheck.isActive && initialCheck.victoryStatus === 'ONGOING')) {
      gameState.startNewCampaign(initialCheck.selectedLordId || 'ivanhoe');
    }

    const latestState = gameState.getState();
    const player = gameState.getPlayerLord();
    this.selectedTerritoryId =
      data?.focusTerritoryId && latestState.territories[data.focusTerritoryId]
        ? data.focusTerritoryId
        : player.currentTerritoryId || player.homeTerritoryId;
    this.hoveredTerritoryId = null;
    this.isMarchMode = false;
    this.panelMode = 'DOSSIER';

    if (data?.lastBattleMessage) {
      this.statusBannerMessage = data.lastBattleMessage;
      this.statusBannerIsAlert = Boolean(data.lastBattleAlert);
    } else {
      this.statusBannerMessage = `Lord ${player.name} commands from ${
        gameState.getTerritory(this.selectedTerritoryId)?.name ?? 'Yorkshire'
      }.`;
      this.statusBannerIsAlert = false;
    }

    this.buildPolygonHitRegions(latestState);

    // 1. Left Zone (0..780 x 0..720): Widescreen Strategy Map of England & Wales
    this.createLeftMapZone();

    // 2. Right Zone (780..1280 x 0..720): Ornate Stone & Parchment Command HUD
    this.createRightHudChrome();

    // 3. Pointer & Keyboard Interactions
    this.setupMapInteractions();

    // 4. Batched State Listener
    this.unsubscribeState = gameState.subscribe(() => {
      this.scheduleRefresh();
    });

    // Smooth pulse animation for March / Attack reachable shires
    this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        this.pulsePhase = (this.pulsePhase + 1) % 12;
        if (this.isMarchMode) {
          this.renderMapHighlights();
        }
      },
    });

    this.refreshAll();
    this.cameras.main.fadeIn(180, 0, 0, 0);

    // Resume paused AI turn queue if returning from an interactive defensive BattleScene
    if (data?.resumeAiQueue && latestState.victoryStatus === 'ONGOING') {
      this.isTransitioningToBattle = true;
      this.time.delayedCall(260, () => {
        if (!this.scene || !this.scene.isActive()) return;
        this.isTransitioningToBattle = false;
        const stepRes = this.turnManager.continueInteractiveTurn(data.resumeAiQueue!);
        this.processInteractiveTurnResult(stepRes);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.unsubscribeState) {
        this.unsubscribeState();
      }
    });
  }

  private buildPolygonHitRegions(state: CampaignState): void {
    this.territoryPolys = [];
    for (const terr of Object.values(state.territories)) {
      if (terr.polygon && terr.polygon.length >= 3) {
        this.territoryPolys.push({
          id: terr.id,
          poly: new Phaser.Geom.Polygon(terr.polygon),
        });
      }
    }
  }

  private createLeftMapZone(): void {
    this.add.image(0, 0, 'map_britain_base').setOrigin(0, 0);

    // Crisp Cartographic Labels for Non-Playable Borderlands & Seas
    this.add
      .text(334, 52, 'SCOTIA', {
        fontFamily: FONT_HEADING,
        fontSize: '13px',
        fontStyle: 'bold',
        color: PALETTE_HEX.STONE_LIGHT,
        letterSpacing: 4,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.75);

    this.add
      .text(192, 412, 'CAMBRIA', {
        fontFamily: FONT_HEADING,
        fontSize: '12px',
        fontStyle: 'bold',
        color: PALETTE_HEX.STONE_LIGHT,
        letterSpacing: 2,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setAlpha(0.75);

    this.add
      .text(672, 174, 'MARE\nGERMANICUM', {
        fontFamily: FONT_HEADING,
        fontSize: '11px',
        fontStyle: 'bold',
        color: PALETTE_HEX.SKY_LIGHT,
        align: 'center',
        letterSpacing: 2,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setAlpha(0.55);

    this.mapTerritoryGraphics = this.add.graphics();
    this.mapPathsGraphics = this.add.graphics();
    this.mapHighlightGraphics = this.add.graphics();
    this.mapMarkersContainer = this.add.container(0, 0);

    // Ornate Map Bezel Frame (x: 0..780, y: 0..720)
    const mapFrame = this.add.graphics();
    mapFrame.lineStyle(5, PALETTE.WOOD_DARK, 1);
    mapFrame.strokeRect(2.5, 2.5, 775, 715);
    mapFrame.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    mapFrame.strokeRect(6, 6, 768, 708);

    // Top-Left Action Status Banner (x: 14..606, y: 12..46 — clears Compass Rose on right)
    this.mapStatusBannerBg = this.add.graphics();
    this.mapStatusBannerText = this.add
      .text(28, 29, '', {
        fontFamily: FONT_BODY,
        fontSize: '13.5px',
        fontStyle: '600',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0, 0.5);

    // Bottom Map Intel / Hover Tooltip Bar (x: 14..766, y: 672..706)
    this.mapTooltipBg = this.add.graphics();
    this.mapTooltipText = this.add
      .text(390, 689, '', {
        fontFamily: FONT_BODY,
        fontSize: '13.5px',
        fontStyle: '600',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    // Urgent Damsel in Distress Alert Card (Open Sea x: 14..238, y: 112..210)
    this.mapDamselAlertContainer = this.add.container(0, 0).setDepth(40);
  }

  private createRightHudChrome(): void {
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x23252e, 1);
    hudBg.fillRect(780, 0, 500, 720);

    // Subtle stone masonry lines
    hudBg.fillStyle(0x14161d, 0.5);
    for (let y = 0; y < 720; y += 28) {
      hudBg.fillRect(780, y, 500, 1.5);
    }

    // Outer Ornate Wood & Gold Trim
    hudBg.lineStyle(5, PALETTE.WOOD_DARK, 1);
    hudBg.strokeRect(782.5, 2.5, 495, 715);
    hudBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.95);
    hudBg.strokeRect(786, 6, 488, 708);

    this.topBannerContainer = this.add.container(0, 0);
    this.dynamicPanelContainer = this.add.container(0, 0);
    this.commandButtonsContainer = this.add.container(0, 0);
    this.endGameModalContainer = this.add.container(0, 0);
    this.endGameModalContainer.setDepth(5000);
  }

  private setupMapInteractions(): void {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x >= 780 || GameState.getInstance().getState().victoryStatus !== 'ONGOING') {
        if (this.hoveredTerritoryId !== null) {
          this.hoveredTerritoryId = null;
          this.renderMapHighlights();
          this.renderMapTooltip();
        }
        return;
      }

      const hitId = this.findTerritoryAtPoint(pointer.x, pointer.y);
      if (hitId !== this.hoveredTerritoryId) {
        this.hoveredTerritoryId = hitId;
        this.input.setDefaultCursor(hitId ? 'pointer' : 'default');
        this.renderMapHighlights();
        this.renderMapTooltip();
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.x >= 780 || this.isTransitioningToBattle) return;

      const gameState = GameState.getInstance();
      const state = gameState.getState();
      if (state.victoryStatus !== 'ONGOING') return;

      const hitId = this.findTerritoryAtPoint(pointer.x, pointer.y);
      if (!hitId) {
        if (this.isMarchMode) {
          this.isMarchMode = false;
          this.setStatusMessage('March cancelled.', false);
          this.scheduleRefresh();
        }
        return;
      }

      this.handleTerritoryClick(hitId);
    });

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown-ESC', () => {
        if (this.isMarchMode || this.panelMode !== 'DOSSIER') {
          this.isMarchMode = false;
          this.panelMode = 'DOSSIER';
          this.setStatusMessage('Returned to Territory Dossier.', false);
          this.scheduleRefresh();
        }
      });
      this.input.keyboard.on('keydown-S', () => {
        this.handleSaveCampaign();
      });
      this.input.keyboard.on('keydown-M', () => {
        const muted = AudioManager.getInstance().toggleMute();
        this.setStatusMessage(`Audio sound effects ${muted ? 'MUTED' : 'UNMUTED'}.`, false);
      });
    }
  }

  private findTerritoryAtPoint(x: number, y: number): string | null {
    for (const item of this.territoryPolys) {
      if (Phaser.Geom.Polygon.Contains(item.poly, x, y)) {
        return item.id;
      }
    }

    const state = GameState.getInstance().getState();
    let closestId: string | null = null;
    let closestDist = 32;
    for (const terr of Object.values(state.territories)) {
      const d = Math.hypot(x - terr.mapCoords.x, y - terr.mapCoords.y);
      if (d < closestDist) {
        closestDist = d;
        closestId = terr.id;
      }
    }
    return closestId;
  }

  private handleTerritoryClick(territoryId: string): void {
    const gameState = GameState.getInstance();
    const state = gameState.getState();
    const territory = state.territories[territoryId];
    if (!territory) return;

    // Sherwood Forest special rule: clicking Sherwood opens Consult Robin Hood interface
    if (territory.isSherwood) {
      this.selectedTerritoryId = territoryId;
      this.isMarchMode = false;
      this.panelMode = 'ROBIN_HOOD';
      this.setStatusMessage('Entered Sherwood Forest — Robin of Locksley awaits!', false);
      this.scheduleRefresh();
      return;
    }

    if (this.isMarchMode) {
      const player = gameState.getPlayerLord();
      if (territoryId === player.currentTerritoryId) {
        this.isMarchMode = false;
        this.selectedTerritoryId = territoryId;
        this.setStatusMessage(`Host remains encamped at ${territory.name}.`, false);
        this.scheduleRefresh();
        return;
      }

      const moveResult = gameState.moveCampaignArmy(player.id, territoryId, {
        interactiveBattle: true,
      });

      if (moveResult.outcome === 'BATTLE_PENDING' && moveResult.pendingBattle) {
        this.isMarchMode = false;
        this.selectedTerritoryId = territoryId;
        this.setStatusMessage(
          moveResult.pendingBattle.hasCastle
            ? `🏰 Laying siege to ${territory.name}!`
            : `⚔ Marching to battle in ${territory.name}!`,
          false
        );
        this.scheduleRefresh();
        this.launchBattleScene(moveResult.pendingBattle);
        return;
      }

      if (moveResult.success) {
        this.selectedTerritoryId = territoryId;
        this.isMarchMode = false;
        this.setStatusMessage(moveResult.message, false);
      } else if (moveResult.outcome === 'BATTLE_LOST') {
        this.isMarchMode = false;
        this.selectedTerritoryId = territoryId;
        this.setStatusMessage(moveResult.message, true);
      } else {
        this.setStatusMessage(moveResult.message, true);
      }
      this.scheduleRefresh();
      return;
    }

    this.selectedTerritoryId = territoryId;
    if (this.panelMode === 'ROBIN_HOOD' || this.panelMode === 'CHRONICLE') {
      this.panelMode = 'DOSSIER';
    }
    this.setStatusMessage(`Inspecting ${territory.name}.`, false);
    this.scheduleRefresh();
  }

  private setStatusMessage(msg: string, isAlert: boolean): void {
    this.statusBannerMessage = msg;
    this.statusBannerIsAlert = isAlert;
  }

  private scheduleRefresh(): void {
    if (this.refreshPending) return;
    this.refreshPending = true;
    this.time.delayedCall(1, () => {
      this.refreshPending = false;
      if (this.scene && this.scene.isActive()) {
        this.refreshAll();
      }
    });
  }

  private refreshAll(): void {
    const state = GameState.getInstance().getState();
    this.renderTerritoriesAndPaths(state);
    this.renderMapMarkers(state);
    this.renderMapHighlights();
    this.renderStatusAndTooltipBanners(state);
    this.renderDamselAlertBanner(state);
    this.renderTopHudBanner(state);
    this.renderDynamicRightPanel(state);
    this.renderCommandButtons(state);
    this.renderEndGameModal(state);
  }

  private getTerritoryFillColors(
    territory: Territory,
    state: CampaignState,
    saxonAiIndexMap: Record<string, number>
  ): { fill: number; innerBevel: number } {
    if (territory.isSherwood) {
      return { fill: PALETTE.FOLIAGE_DARK, innerBevel: PALETTE.FOLIAGE_MID };
    }
    if (!territory.ownerId) {
      return { fill: PALETTE.PARCHMENT_DARK, innerBevel: 0xbfa074 };
    }
    if (territory.ownerId === state.selectedLordId) {
      return { fill: PALETTE.ROYAL_BLUE, innerBevel: 0x3b73dc };
    }

    const owner = state.activeLords[territory.ownerId];
    if (!owner) {
      return { fill: PALETTE.PARCHMENT_DARK, innerBevel: 0xbfa074 };
    }

    if (owner.faction === 'saxon') {
      const idx = saxonAiIndexMap[owner.id] ?? 0;
      return idx === 0
        ? { fill: PALETTE.FOLIAGE_MID, innerBevel: PALETTE.FOLIAGE_LIGHT }
        : { fill: 0x4d8744, innerBevel: PALETTE.FOLIAGE_LIGHT };
    }

    return { fill: PALETTE.BLOOD_RED, innerBevel: 0x821616 };
  }

  private renderTerritoriesAndPaths(state: CampaignState): void {
    this.mapTerritoryGraphics.clear();
    this.mapPathsGraphics.clear();

    const saxonAiIds = Object.values(state.activeLords)
      .filter((l) => l.faction === 'saxon' && !l.isPlayer)
      .map((l) => l.id);
    const saxonAiIndexMap: Record<string, number> = {};
    saxonAiIds.forEach((id, i) => {
      saxonAiIndexMap[id] = i;
    });

    // 1. Clean Smooth Territory Fills + Subtle Painted Inner Shading (Zero noisy dithering)
    for (const terr of Object.values(state.territories)) {
      const pts = terr.polygon;
      if (!pts || pts.length < 3) continue;

      const { fill, innerBevel } = this.getTerritoryFillColors(
        terr,
        state,
        saxonAiIndexMap
      );

      this.mapTerritoryGraphics.fillStyle(fill, 1);
      this.mapTerritoryGraphics.beginPath();
      this.mapTerritoryGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this.mapTerritoryGraphics.lineTo(pts[i].x, pts[i].y);
      }
      this.mapTerritoryGraphics.closePath();
      this.mapTerritoryGraphics.fillPath();

      // Soft inner bevel along shire border for illustrated boardgame depth
      this.mapTerritoryGraphics.lineStyle(4, innerBevel, 0.42);
      this.mapTerritoryGraphics.beginPath();
      this.mapTerritoryGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this.mapTerritoryGraphics.lineTo(pts[i].x, pts[i].y);
      }
      this.mapTerritoryGraphics.closePath();
      this.mapTerritoryGraphics.strokePath();

      // Crisp Dark Wood/Ink Shire Border
      this.mapTerritoryGraphics.lineStyle(2, 0x2c1b0e, 0.95);
      this.mapTerritoryGraphics.beginPath();
      this.mapTerritoryGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this.mapTerritoryGraphics.lineTo(pts[i].x, pts[i].y);
      }
      this.mapTerritoryGraphics.closePath();
      this.mapTerritoryGraphics.strokePath();
    }

    // 2. Subtle Cartographic Road Dashes between Adjacent Neighbors
    const drawnPairs = new Set<string>();
    for (const terr of Object.values(state.territories)) {
      for (const nId of terr.neighbors) {
        const pairKey = [terr.id, nId].sort().join('--');
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        const neighbor = state.territories[nId];
        if (!neighbor) continue;

        const ax = terr.mapCoords.x;
        const ay = terr.mapCoords.y;
        const bx = neighbor.mapCoords.x;
        const by = neighbor.mapCoords.y;
        const dist = Math.hypot(bx - ax, by - ay);
        const steps = Math.max(4, Math.floor(dist / 12));

        for (let s = 1; s < steps; s++) {
          if (s % 2 === 1) continue;
          const t0 = (s - 0.3) / steps;
          const t1 = (s + 0.3) / steps;
          const x0 = ax + (bx - ax) * t0;
          const y0 = ay + (by - ay) * t0;
          const x1 = ax + (bx - ax) * t1;
          const y1 = ay + (by - ay) * t1;

          this.mapPathsGraphics.lineStyle(2.5, PALETTE.BLACK, 0.28);
          this.mapPathsGraphics.lineBetween(x0, y0 + 1, x1, y1 + 1);
          this.mapPathsGraphics.lineStyle(1.5, PALETTE.PARCHMENT_LIGHT, 0.48);
          this.mapPathsGraphics.lineBetween(x0, y0, x1, y1);
        }
      }
    }

    // 3. Coastal Amphibious Sea Routes (Sidequest Labs Edition)
    if (state.edition === 'SIDEQUEST_LABS') {
      const drawSeaLanes = (ports: readonly string[], isEast: boolean) => {
        for (let i = 0; i < ports.length - 1; i++) {
          const t1 = state.territories[ports[i]];
          const t2 = state.territories[ports[i + 1]];
          if (!t1 || !t2) continue;
          const ax = t1.mapCoords.x + (isEast ? 44 : -38);
          const ay = t1.mapCoords.y;
          const bx = t2.mapCoords.x + (isEast ? 44 : -38);
          const by = t2.mapCoords.y;
          this.mapPathsGraphics.lineStyle(2, 0x38bdf8, 0.65);
          this.mapPathsGraphics.lineBetween(ax, ay, bx, by);
        }
      };
      drawSeaLanes(EAST_COAST_PORTS, true);
      drawSeaLanes(WEST_COAST_PORTS, false);
    }
  }

  private renderMapMarkers(state: CampaignState): void {
    this.mapMarkersContainer.removeAll(true);

    const armiesByTerritory: Record<string, Lord[]> = {};
    for (const lord of Object.values(state.activeLords)) {
      if (
        lord.isActive &&
        !lord.isDefeated &&
        (lord.campaignArmy.soldiers > 0 || lord.campaignArmy.knights > 0)
      ) {
        if (!armiesByTerritory[lord.currentTerritoryId]) {
          armiesByTerritory[lord.currentTerritoryId] = [];
        }
        armiesByTerritory[lord.currentTerritoryId].push(lord);
      }
    }

    const activeHomeTerritorySet = new Set<string>();
    for (const lord of Object.values(state.activeLords)) {
      if (lord.isActive && !lord.isDefeated) {
        activeHomeTerritorySet.add(lord.homeTerritoryId);
      }
    }

    for (const terr of Object.values(state.territories)) {
      const cx = terr.mapCoords.x;
      const cy = terr.mapCoords.y;
      const armiesHere = armiesByTerritory[terr.id] ?? [];
      const hasArmy = armiesHere.length > 0;

      // 1. Sherwood Forest Emblem & Crisp Badge
      if (terr.isSherwood) {
        const oak = this.add
          .image(cx, cy - 5, 'icon_sherwood')
          .setDisplaySize(32, 32);
        this.mapMarkersContainer.add(oak);

        const lbl = this.add
          .text(cx, cy + 16, 'SHERWOOD', {
            fontFamily: FONT_BODY,
            fontSize: '10px',
            fontStyle: 'bold',
            color: PALETTE_HEX.GOLD_BRIGHT,
            backgroundColor: '#101812CC',
            padding: { x: 4, y: 1 },
            resolution: TEXT_RES,
          })
          .setOrigin(0.5);
        this.mapMarkersContainer.add(lbl);
        continue;
      }

      // 2. Castle / Royal Home Castle / Royal Keep Icon (Crisp 1.25x NEAREST pixel art)
      if (terr.hasCastle) {
        const isHome = activeHomeTerritorySet.has(terr.id);
        const castleX = hasArmy ? cx - 15 : cx;
        const castleY = isHome ? cy - 5 : cy - 2;
        const isSidequest = state.edition === 'SIDEQUEST_LABS';
        let castleIcon = isHome ? 'icon_home_castle' : 'icon_castle';
        if (isSidequest && terr.isRoyalKeep) {
          castleIcon = 'sq_icon_royal_keep';
        } else if (isSidequest) {
          castleIcon = SidequestArtGenerator.getMapIconKey(
            this,
            isHome ? 'icon_home_castle' : 'icon_castle',
            true
          );
        }
        const castleImg = this.add
          .image(castleX, castleY, castleIcon)
          .setDisplaySize(
            terr.isRoyalKeep ? 34 : isHome ? 34 : 28,
            terr.isRoyalKeep ? 36 : isHome ? 36 : 28
          );
        this.mapMarkersContainer.add(castleImg);

        // Captive Saxon Damsel Pin on Captor's Stronghold
        if (state.captiveDamsel?.castleTerritoryId === terr.id) {
          const capTag = this.add
            .text(cx, cy - 28, '👸 CAPTIVE!', {
              fontFamily: FONT_BODY,
              fontSize: '9.5px',
              fontStyle: 'bold',
              color: PALETTE_HEX.GOLD_BRIGHT,
              backgroundColor: '#8B1414EE',
              padding: { x: 4, y: 1.5 },
              resolution: TEXT_RES,
            })
            .setOrigin(0.5);
          this.mapMarkersContainer.add(capTag);
        }
      }

      // Territory Market/Mill Icon (Sidequest Labs)
      if (state.edition === 'SIDEQUEST_LABS' && terr.hasMarket) {
        const marketImg = this.add
          .image(cx - 20, cy + 14, 'sq_icon_market')
          .setDisplaySize(20, 20);
        this.mapMarkersContainer.add(marketImg);
      }

      // Coastal Port Cog Ship Icon (Sidequest Labs)
      if (state.edition === 'SIDEQUEST_LABS' && isCoastalPort(terr.id)) {
        const shipX = cx + (EAST_COAST_PORTS.includes(terr.id) ? 38 : -34);
        const shipY = cy + 4;
        const shipImg = this.add
          .image(shipX, shipY, 'sq_icon_ship')
          .setDisplaySize(20, 17)
          .setAlpha(0.85);
        this.mapMarkersContainer.add(shipImg);
      }

      // 3. Heraldic Shield / Campaign Army Pawns
      armiesHere.forEach((lord, idx) => {
        const pawnX = terr.hasCastle ? cx + 16 + idx * 14 : cx + idx * 14;
        const pawnY = cy;

        if (lord.isPlayer) {
          const halo = this.add.graphics();
          halo.fillStyle(PALETTE.GOLD_BRIGHT, 0.95);
          halo.fillCircle(pawnX, pawnY, 17);
          halo.lineStyle(2, PALETTE.WOOD_DARK, 1);
          halo.strokeCircle(pawnX, pawnY, 17);
          this.mapMarkersContainer.add(halo);
        }

        const shield = this.add
          .image(pawnX, pawnY, `shield_${lord.id}`)
          .setDisplaySize(lord.isPlayer ? 26 : 23, lord.isPlayer ? 33 : 29);
        this.mapMarkersContainer.add(shield);
      });

      // Subtle Shire Name & Tax Node on quiet territories
      if (!terr.hasCastle && !hasArmy) {
        const node = this.add.graphics();
        node.fillStyle(0x2c1b0e, 0.9);
        node.fillCircle(cx, cy - 4, 4.5);
        node.fillStyle(
          terr.ownerId ? PALETTE.PARCHMENT_LIGHT : PALETTE.GOLD_BRIGHT,
          1
        );
        node.fillCircle(cx, cy - 4, 2.5);
        this.mapMarkersContainer.add(node);
      }

      // Compact Shire Name Label underneath marker
      const shortShire =
        terr.id === 'cornwall'
          ? 'Cornwall'
          : terr.id === 'northumberland'
          ? 'Northumb.'
          : terr.id === 'gloucester'
          ? 'Gloucester'
          : terr.id === 'leicester'
          ? 'Leicester'
          : terr.id === 'lincoln'
          ? 'Lincoln'
          : terr.name;

      const labelY = terr.hasCastle || hasArmy ? cy + 20 : cy + 9;
      const shireTxt = this.add
        .text(cx, labelY, shortShire, {
          fontFamily: FONT_BODY,
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: terr.ownerId ? '#FFFFFF' : '#2A1B0E',
          stroke: terr.ownerId ? '#0E1016' : '#F4E4C1',
          strokeThickness: terr.ownerId ? 2.5 : 2,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);
      this.mapMarkersContainer.add(shireTxt);
    }
  }

  private renderMapHighlights(): void {
    this.mapHighlightGraphics.clear();
    const gameState = GameState.getInstance();
    const state = gameState.getState();

    const strokePoly = (
      territoryId: string,
      color: number,
      width: number,
      alpha: number
    ) => {
      const pts = state.territories[territoryId]?.polygon;
      if (!pts || pts.length < 3) return;
      this.mapHighlightGraphics.lineStyle(width, color, alpha);
      this.mapHighlightGraphics.beginPath();
      this.mapHighlightGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this.mapHighlightGraphics.lineTo(pts[i].x, pts[i].y);
      }
      this.mapHighlightGraphics.closePath();
      this.mapHighlightGraphics.strokePath();
    };

    // 1. Selected Shire Border
    if (this.selectedTerritoryId && state.territories[this.selectedTerritoryId]) {
      strokePoly(this.selectedTerritoryId, PALETTE.PARCHMENT_LIGHT, 3, 0.95);
    }

    // 2. March / Attack Mode Pulsing Reachable Highlights
    if (this.isMarchMode) {
      const player = gameState.getPlayerLord();
      const reachable = gameState.getReachableTerritories(player.id);
      const pulseAlpha =
        0.55 + Math.sin((this.pulsePhase / 12) * Math.PI * 2) * 0.35;
      const alreadyConquered = Boolean(state.hasConqueredThisTurn[player.id]);

      for (const fid of reachable.friendlyIds) {
        strokePoly(fid, PALETTE.SKY_LIGHT, 3.5, pulseAlpha);
      }

      if (!alreadyConquered) {
        for (const nid of reachable.neutralIds) {
          strokePoly(nid, PALETTE.GOLD_BRIGHT, 3.5, pulseAlpha);
        }

        for (const eid of reachable.enemyIds) {
          const terr = state.territories[eid];
          const needsCatapult =
            terr.hasCastle && player.campaignArmy.catapults === 0;
          if (needsCatapult) {
            strokePoly(eid, PALETTE.STONE_LIGHT, 2.5, 0.7);
          } else {
            strokePoly(
              eid,
              this.pulsePhase % 4 < 2 ? PALETTE.GOLD_BRIGHT : PALETTE.BLOOD_RED,
              4,
              0.95
            );
          }
        }
      }

      strokePoly(player.currentTerritoryId, PALETTE.GOLD_BRIGHT, 3, 1);
    }

    // 3. Hover Shire Border
    if (this.hoveredTerritoryId && state.territories[this.hoveredTerritoryId]) {
      strokePoly(this.hoveredTerritoryId, PALETTE.GOLD_BRIGHT, 3.5, 1);
    }
  }

  private renderStatusAndTooltipBanners(state: CampaignState): void {
    this.mapStatusBannerBg.clear();
    const bannerColor = this.statusBannerIsAlert
      ? PALETTE.BLOOD_RED
      : PALETTE.WOOD_DARK;
    this.mapStatusBannerBg.fillStyle(bannerColor, 0.93);
    this.mapStatusBannerBg.fillRoundedRect(14, 12, 592, 34, 5);
    this.mapStatusBannerBg.lineStyle(
      1.5,
      this.statusBannerIsAlert ? PALETTE.GOLD_BRIGHT : PALETTE.GOLD_DARK,
      0.95
    );
    this.mapStatusBannerBg.strokeRoundedRect(14, 12, 592, 34, 5);

    const maxChars = 72;
    const clippedMsg =
      this.statusBannerMessage.length > maxChars
        ? this.statusBannerMessage.slice(0, maxChars - 1) + '…'
        : this.statusBannerMessage;
    this.mapStatusBannerText.setText(clippedMsg);
    this.mapStatusBannerText.setColor(
      this.statusBannerIsAlert ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.PARCHMENT_LIGHT
    );

    this.renderMapTooltip(state);
  }

  private renderDamselAlertBanner(state: CampaignState): void {
    this.mapDamselAlertContainer.removeAll(true);
    if (state.victoryStatus !== 'ONGOING' || !state.captiveDamsel) {
      this.mapDamselAlertContainer.setVisible(false);
      return;
    }

    this.mapDamselAlertContainer.setVisible(true);
    const ev = state.captiveDamsel;
    const lady = SAXON_DAMSELS[ev.damselId];
    const terr = state.territories[ev.castleTerritoryId];

    // Urgent Alert Card in Open Irish Sea (x: 14..234, y: 112..210 — clears all shires!)
    const x = 14;
    const y = 112;
    const w = 220;
    const h = 98;

    const card = this.add.graphics();
    const drawCard = (hover: boolean) => {
      card.clear();
      card.fillStyle(hover ? 0x8b1c1c : 0x6e1414, 0.96);
      card.fillRoundedRect(x, y, w, h, 6);
      card.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      card.strokeRoundedRect(x, y, w, h, 6);
    };
    drawCard(false);
    this.mapDamselAlertContainer.add(card);

    const portrait = this.add
      .image(x + 30, y + 36, `portrait_${lady.id}`)
      .setDisplaySize(42, 42);

    const hdr = this.add.text(x + 58, y + 12, 'DAMSEL IN DISTRESS!', {
      fontFamily: FONT_BODY,
      fontSize: '11px',
      fontStyle: 'bold',
      color: PALETTE_HEX.GOLD_BRIGHT,
      resolution: TEXT_RES,
    });

    const sub = this.add.text(
      x + 58,
      y + 29,
      `${lady.name}\nHeld in ${terr?.name ?? 'Keep'}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        fontStyle: '600',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        lineSpacing: 2,
        resolution: TEXT_RES,
      }
    );

    const cta = this.add
      .text(x + w / 2, y + 81, '⚔  CLICK TO RESCUE  ⚔', {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#FFF3B0',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const zone = this.add
      .zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawCard(true));
    zone.on('pointerout', () => drawCard(false));
    zone.on('pointerdown', () => this.handleLaunchDamselRescue());

    this.mapDamselAlertContainer.add([portrait, hdr, sub, cta, zone]);
  }

  private renderMapTooltip(providedState?: CampaignState): void {
    const gameState = GameState.getInstance();
    const state = providedState ?? gameState.getState();

    this.mapTooltipBg.clear();
    this.mapTooltipBg.fillStyle(0x10131d, 0.9);
    this.mapTooltipBg.fillRoundedRect(14, 672, 752, 34, 5);
    this.mapTooltipBg.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    this.mapTooltipBg.strokeRoundedRect(14, 672, 752, 34, 5);

    const targetId = this.hoveredTerritoryId ?? this.selectedTerritoryId;
    const terr = state.territories[targetId];
    if (!terr) {
      this.mapTooltipText.setText('Hover or click any territory on the map for intelligence.');
      return;
    }

    if (terr.isSherwood) {
      this.mapTooltipText.setText(
        `SHERWOOD FOREST  •  Click to consult Robin Hood (${state.robinHoodUsesLeft}/3 campaign favors remaining)`
      );
      this.mapTooltipText.setColor(PALETTE_HEX.FOLIAGE_LIGHT);
      return;
    }

    const player = gameState.getPlayerLord();
    if (this.isMarchMode && this.hoveredTerritoryId && targetId !== player.currentTerritoryId) {
      const reachable = gameState.getReachableTerritories(player.id);
      if (reachable.friendlyIds.includes(targetId)) {
        this.mapTooltipText.setText(
          `RELOCATE ARMY  →  ${terr.name.toUpperCase()} (Connected Friendly Territory)`
        );
        this.mapTooltipText.setColor(PALETTE_HEX.SKY_LIGHT);
        return;
      }
      if (state.hasConqueredThisTurn[player.id]) {
        this.mapTooltipText.setText(
          `ALREADY CONQUERED THIS MONTH  •  Click END TURN to advance (or relocate within friendly lands)`
        );
        this.mapTooltipText.setColor(PALETTE_HEX.PARCHMENT_DARK);
        return;
      }
      if (reachable.neutralIds.includes(targetId)) {
        this.mapTooltipText.setText(
          `CLICK TO ANNEX ${terr.name.toUpperCase()}  •  +${terr.taxIncome} Gold / Month (Unclaimed)`
        );
        this.mapTooltipText.setColor(PALETTE_HEX.GOLD_BRIGHT);
        return;
      }
      if (reachable.enemyIds.includes(targetId)) {
        const preview = CombatResolver.calculateBattlePreview(
          state,
          player.id,
          targetId
        );
        if (!preview.allowed) {
          this.mapTooltipText.setText(
            `${terr.name.toUpperCase()}: You need at least 1 Catapult in your Campaign Army to besiege a Castle!`
          );
          this.mapTooltipText.setColor(PALETTE_HEX.GOLD_BRIGHT);
          return;
        }
        const modeLabel = terr.hasCastle
          ? '🏰 BESIEGE ' + terr.name.toUpperCase() + ' [CATAPULT SIEGE]'
          : '⚔ INVADE ' + terr.name.toUpperCase() + ' (TACTICAL BATTLE)';
        this.mapTooltipText.setText(
          `${modeLabel}  •  Your Strength: ${preview.attackerStrength}  vs  Defender: ${preview.defenderStrength}`
        );
        this.mapTooltipText.setColor(
          preview.attackerStrength > preview.defenderStrength
            ? PALETTE_HEX.FOLIAGE_LIGHT
            : '#FF6B6B'
        );
        return;
      }

      this.mapTooltipText.setText(
        `${terr.name.toUpperCase()}  •  Out of reach (must border your Campaign Army or connected friendly lands)`
      );
      this.mapTooltipText.setColor(PALETTE_HEX.STONE_LIGHT);
      return;
    }

    const ownerName = terr.ownerId
      ? state.activeLords[terr.ownerId]?.name ?? 'Lord'
      : 'Neutral Unclaimed';
    const castleTag = terr.hasCastle ? ' [Castle]' : '';
    const garTotal = terr.garrison.soldiers + terr.garrison.knights;
    this.mapTooltipText.setText(
      `${terr.name.toUpperCase()}${castleTag}  •  ${ownerName}  •  +${terr.taxIncome}G/mo  •  Garrison: ${garTotal} troops`
    );
    this.mapTooltipText.setColor(PALETTE_HEX.GOLD_BRIGHT);
  }

  /**
   * Renders Top Royal Command Header (x: 796..1264, y: 12..192)
   */
  private renderTopHudBanner(state: CampaignState): void {
    this.topBannerContainer.removeAll(true);
    const gameState = GameState.getInstance();
    const player = gameState.getPlayerLord();
    const taxIncome = gameState.getLordTaxIncome(player.id);
    const monthStr = MONTH_NAMES[(state.month - 1) % 12];
    const armyLocName =
      state.territories[player.currentTerritoryId]?.name ?? player.currentTerritoryId;

    const bg = this.add.graphics();
    bg.fillStyle(PALETTE.WOOD_DARK, 0.97);
    bg.fillRoundedRect(796, 12, 468, 180, 6);
    bg.lineStyle(2, PALETTE.GOLD_DARK, 1);
    bg.strokeRoundedRect(796, 12, 468, 180, 6);

    // Field Army Status Inset
    bg.fillStyle(0x120d0a, 0.85);
    bg.fillRoundedRect(808, 132, 444, 50, 4);
    bg.lineStyle(1, PALETTE.WOOD_MID, 0.9);
    bg.strokeRoundedRect(808, 132, 444, 50, 4);
    this.topBannerContainer.add(bg);

    const dateTxt = this.add.text(
      812,
      20,
      `${monthStr} ${state.year} A.D.  •  TURN ${state.turn}`,
      {
        fontFamily: FONT_HEADING,
        fontSize: '15px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        letterSpacing: 1,
        resolution: TEXT_RES,
      }
    );

    const isNorman = player.faction === 'norman';
    const isSidequest = state.edition === 'SIDEQUEST_LABS';
    const factionLabel = isNorman
      ? isSidequest ? '⚔ NORMAN' : 'NORMAN'
      : isSidequest ? '👑 SAXON' : 'SAXON CROWN';
    const factionColor = isNorman ? '#FF8282' : '#82B1FF';

    const factionBadge = this.add
      .text(1248, 22, factionLabel, {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: factionColor,
        resolution: TEXT_RES,
      })
      .setOrigin(1, 0);
    this.topBannerContainer.add([dateTxt, factionBadge]);

    if (isSidequest && state.nemesisLordId) {
      const nemesis = state.activeLords[state.nemesisLordId];
      if (nemesis && !nemesis.isDefeated) {
        const nemBadge = this.add
          .text(1135, 22, `[NEMESIS: ${nemesis.name.split(' ')[0]}]`, {
            fontFamily: FONT_BODY,
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#EF4444',
            resolution: TEXT_RES,
          })
          .setOrigin(1, 0);
        this.topBannerContainer.add(nemBadge);
      }
    }

    // Crisp 68x68 Retro Portrait & 40x52 Heraldic Shield
    const portraitKey = SidequestArtGenerator.getPortraitKey(
      this,
      player.id,
      isSidequest
    );
    const shieldKey = SidequestArtGenerator.getShieldKey(
      this,
      player.id,
      isSidequest
    );
    const portrait = this.add
      .image(846, 84, portraitKey)
      .setDisplaySize(68, 68);
    const shield = this.add
      .image(906, 84, shieldKey)
      .setDisplaySize(40, 50);
    this.topBannerContainer.add([portrait, shield]);

    const lordTitle = this.add.text(940, 48, player.name.toUpperCase(), {
      fontFamily: FONT_HEADING,
      fontSize: '17px',
      fontStyle: 'bold',
      color: PALETTE_HEX.PARCHMENT_LIGHT,
      resolution: TEXT_RES,
    });

    const ransomPart =
      isSidequest && (state.royalRansomPaid ?? 0) > 0
        ? `  •  ${isNorman ? 'Coronation' : 'Ransom'}: ${state.royalRansomPaid}/200G`
        : '';
    const goldTxt = this.add.text(
      940,
      74,
      `TREASURY: ${player.gold} Gold   (+${taxIncome}G / mo)${ransomPart}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.GOLD_BRIGHT,
        resolution: TEXT_RES,
      }
    );

    const spouseTag =
      state.rescuedDamselIds.length > 0
        ? `  •  ♥ ${SAXON_DAMSELS[state.rescuedDamselIds[0]].name}${
            state.rescuedDamselIds.length > 1
              ? ` (+${state.rescuedDamselIds.length - 1})`
              : ''
          }`
        : '';

    const locTxt = this.add.text(
      940,
      99,
      `Host: ${armyLocName}${spouseTag}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '12.5px',
        color:
          state.rescuedDamselIds.length > 0
            ? PALETTE_HEX.GOLD_BRIGHT
            : PALETTE_HEX.PARCHMENT_DARK,
        resolution: TEXT_RES,
      }
    );
    this.topBannerContainer.add([lordTitle, goldTxt, locTxt]);

    const { soldiers, knights, catapults } = player.campaignArmy;
    const marched = Boolean(state.hasConqueredThisTurn[player.id]);
    const armyPower = CombatResolver.calculateCombatStrength(
      player.campaignArmy,
      player.leadership,
      false
    );

    const archerStr =
      isSidequest && player.campaignArmy.archers !== undefined
        ? `   •   ${player.campaignArmy.archers} Archers`
        : '';
    const armyLine1 = this.add.text(
      820,
      139,
      `CAMPAIGN ARMY:   ${soldiers} Soldiers   •   ${knights} Knights   •   ${catapults} Catapults${archerStr}`,
      {
        fontFamily: FONT_BODY,
        fontSize: '13px',
        fontStyle: 'bold',
        color: PALETTE_HEX.PARCHMENT_LIGHT,
        resolution: TEXT_RES,
      }
    );

    const armyLine2 = this.add.text(
      820,
      159,
      `Combat Strength: ${armyPower}   •   ${
        marched ? 'CONQUEST COMPLETED THIS MONTH' : 'READY TO MARCH'
      }`,
      {
        fontFamily: FONT_BODY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: marched ? PALETTE_HEX.STONE_LIGHT : PALETTE_HEX.FOLIAGE_LIGHT,
        resolution: TEXT_RES,
      }
    );
    this.topBannerContainer.add([armyLine1, armyLine2]);
  }

  private renderDynamicRightPanel(state: CampaignState): void {
    this.dynamicPanelContainer.removeAll(true);

    if (this.panelMode === 'DOSSIER') {
      this.renderTerritoryDossierPanel(state);
    } else if (this.panelMode === 'RECRUIT') {
      this.renderRecruitAndGarrisonPanel(state);
    } else if (this.panelMode === 'RAID') {
      this.renderRaidCastlesPanel(state);
    } else if (this.panelMode === 'TOURNAMENT') {
      this.renderTournamentPanel(state);
    } else if (this.panelMode === 'ROBIN_HOOD') {
      this.renderRobinHoodPanel(state);
    } else if (this.panelMode === 'CHRONICLE') {
      this.renderChronicleAndLordsPanel(state);
    } else if (this.panelMode === 'TAVERN') {
      this.renderTavernAndDiplomacyPanel(state);
    }
  }

  private drawParchmentCard(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const card = this.add.graphics();
    card.fillStyle(PALETTE.WOOD_DARK, 1);
    card.fillRoundedRect(x, y, w, h, 6);
    card.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    card.fillRoundedRect(x + 7, y + 7, w - 14, h - 14, 4);
    card.lineStyle(1.5, PALETTE.WOOD_MID, 0.85);
    card.strokeRoundedRect(x + 11, y + 11, w - 22, h - 22, 3);
    this.dynamicPanelContainer.add(card);
    return card;
  }

  private renderTerritoryDossierPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();
    const player = gameState.getPlayerLord();
    const terr =
      state.territories[this.selectedTerritoryId] ??
      state.territories[player.currentTerritoryId];

    // Parchment Dossier Card (x: 796..1264, y: 202..466, h: 264)
    const card = this.drawParchmentCard(796, 202, 468, 264);
    card.lineBetween(818, 248, 1242, 248);

    if (!terr) return;

    const title = this.add
      .text(
        1030,
        230,
        terr.isSherwood ? 'SHERWOOD FOREST' : terr.name.toUpperCase(),
        {
          fontFamily: FONT_HEADING,
          fontSize: '20px',
          fontStyle: 'bold',
          color: PALETTE_HEX.WOOD_DARK,
          letterSpacing: 1,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(title);

    if (terr.isSherwood) {
      const desc = this.add.text(
        822,
        264,
        `Sanctuary of Robin of Locksley and his Merry Men.\nSherwood Forest cannot be taxed or annexed by any Lord.\n\nCampaign Reinforcements Left: ${state.robinHoodUsesLeft} / 3`,
        {
          fontFamily: FONT_BODY,
          fontSize: '14.5px',
          color: PALETTE_HEX.FOLIAGE_DARK,
          lineSpacing: 6,
          resolution: TEXT_RES,
        }
      );
      this.dynamicPanelContainer.add(desc);
      return;
    }

    const owner = terr.ownerId ? state.activeLords[terr.ownerId] : null;
    const ownerLabel = owner
      ? `${owner.name}  (${owner.faction === 'saxon' ? 'Saxon' : 'Norman'})`
      : 'Unclaimed Neutral Territory';
    const ownerColor = !owner
      ? PALETTE_HEX.STONE_DARK
      : owner.isPlayer
      ? PALETTE_HEX.ROYAL_BLUE
      : owner.faction === 'saxon'
      ? PALETTE_HEX.FOLIAGE_DARK
      : PALETTE_HEX.BLOOD_RED;

    const isSidequest = state.edition === 'SIDEQUEST_LABS';
    const isActiveHome = Boolean(
      owner && !owner.isDefeated && owner.homeTerritoryId === terr.id
    );
    const castleStr =
      isSidequest && terr.isRoyalKeep
        ? 'Royal Keep (+40% Defense, 150 Wall Integrity)'
        : isActiveHome
        ? 'Royal Home Stronghold (+25% Defense)'
        : terr.hasCastle
        ? 'Fortified Stone Castle (+25% Defense)'
        : 'Open Shire (No Castle Built)';

    const marketBonus = isSidequest && terr.hasMarket ? ' (+2 Market)' : '';
    const archerGarStr = isSidequest
      ? `  •  ${terr.garrison.archers ?? 0} Archers`
      : '';

    const lines: Array<{ text: string; color: string; bold?: boolean }> = [
      { text: `Ruler: ${ownerLabel}`, color: ownerColor, bold: true },
      {
        text: `Monthly Tax Income: +${terr.taxIncome}${marketBonus} Gold / Month`,
        color: PALETTE_HEX.WOOD_DARK,
        bold: true,
      },
      { text: `Fortification: ${castleStr}`, color: '#5A3A1E' },
      {
        text: `Garrison: ${terr.garrison.soldiers} Soldiers  •  ${terr.garrison.knights} Knights  •  ${terr.garrison.catapults} Catapults${archerGarStr}`,
        color: '#1C1814',
        bold: true,
      },
    ];

    if (isSidequest && (state.spiedTurnsRemaining ?? 0) > 0 && owner && !owner.isPlayer) {
      const sabotageStr = terr.sabotagedWallDamage
        ? `  •  ⚠️ Sabotaged (-${terr.sabotagedWallDamage} Wall)`
        : '';
      lines.push({
        text: `[🔍 SPY INTEL ACTIVE] Vault: ${owner.gold} Gold${sabotageStr}`,
        color: PALETTE_HEX.BLOOD_RED,
        bold: true,
      });
    }

    let ry = 260;
    for (const l of lines) {
      const t = this.add.text(820, ry, l.text, {
        fontFamily: FONT_BODY,
        fontSize: '14px',
        fontStyle: l.bold ? 'bold' : 'normal',
        color: l.color,
        resolution: TEXT_RES,
      });
      this.dynamicPanelContainer.add(t);
      ry += 35;
    }

    const lordsStationed = Object.values(state.activeLords).filter(
      (l) =>
        l.isActive &&
        !l.isDefeated &&
        l.currentTerritoryId === terr.id &&
        l.campaignArmy.soldiers + l.campaignArmy.knights > 0
    );

    let footerStr = '';
    let footerColor: string = PALETTE_HEX.WOOD_DARK;

    if (lordsStationed.length > 0) {
      const l = lordsStationed[0];
      footerStr = `Field Host Present: ${l.name} (${l.campaignArmy.soldiers}S / ${l.campaignArmy.knights}K / ${l.campaignArmy.catapults}C)`;
      footerColor = l.isPlayer ? PALETTE_HEX.ROYAL_BLUE : PALETTE_HEX.BLOOD_RED;
    } else if (terr.ownerId && terr.ownerId !== player.id) {
      const preview = CombatResolver.calculateBattlePreview(
        state,
        player.id,
        terr.id
      );
      footerStr = preview.allowed
        ? `Estimated Defense Combat Strength: ${preview.defenderStrength}`
        : `Fortified Castle — Requires at least 1 Catapult to besiege!`;
      footerColor = PALETTE_HEX.BLOOD_RED;
    } else {
      footerStr = `Connected Borders: ${terr.neighbors.length} neighboring shires`;
    }

    card.lineBetween(818, 412, 1242, 412);
    const footerTxt = this.add.text(820, 424, footerStr, {
      fontFamily: FONT_BODY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: footerColor,
      resolution: TEXT_RES,
    });
    this.dynamicPanelContainer.add(footerTxt);

    // In SIDEQUEST_LABS mode, display player's active Armory Relics
    if (isSidequest && player.relicIds && player.relicIds.length > 0) {
      let rx = 824;
      for (const rid of player.relicIds) {
        const rDef = ALL_RELICS[rid as RelicId];
        if (!rDef) continue;
        const icon = this.add
          .image(rx, 448, `sq_relic_${rid}`)
          .setDisplaySize(24, 24);
        this.dynamicPanelContainer.add(icon);
        rx += 30;
      }
    }
  }

  private renderRecruitAndGarrisonPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();
    const player = gameState.getPlayerLord();
    const stationedTerr = state.territories[player.currentTerritoryId];
    const selectedTerr = state.territories[this.selectedTerritoryId];
    const castleTargetTerr =
      selectedTerr && selectedTerr.ownerId === player.id && !selectedTerr.isSherwood
        ? selectedTerr
        : stationedTerr;

    // Expanded Parchment Sub-Panel (x: 796..1264, y: 202..648, h: 446)
    const card = this.drawParchmentCard(796, 202, 468, 446);
    card.lineBetween(818, 244, 1242, 244);
    card.lineBetween(818, 424, 1242, 424);

    const header = this.add
      .text(1030, 226, 'RECRUIT & GARRISON', {
        fontFamily: FONT_HEADING,
        fontSize: '18px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(header);

    const isSidequest = state.edition === 'SIDEQUEST_LABS';

    const recruitRows: Array<{
      label: string;
      y: number;
      buttons: Array<{
        text: string;
        x: number;
        w: number;
        enabled: boolean;
        onClick: () => void;
      }>;
    }> = isSidequest
      ? [
          {
            label: `Soldier (${UNIT_COSTS.soldiers}G)`,
            y: 252,
            buttons: [
              {
                text: '+1',
                x: 1112,
                w: 58,
                enabled: player.gold >= UNIT_COSTS.soldiers,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'soldiers', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
              {
                text: '+5',
                x: 1178,
                w: 62,
                enabled: player.gold >= UNIT_COSTS.soldiers * 5,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'soldiers', 5, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Longbowman (${UNIT_COSTS.archers}G)`,
            y: 284,
            buttons: [
              {
                text: '+1',
                x: 1112,
                w: 58,
                enabled: player.gold >= UNIT_COSTS.archers,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'archers', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
              {
                text: '+5',
                x: 1178,
                w: 62,
                enabled: player.gold >= UNIT_COSTS.archers * 5,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'archers', 5, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Knight (${UNIT_COSTS.knights}G)`,
            y: 316,
            buttons: [
              {
                text: 'BUY +1',
                x: 1112,
                w: 128,
                enabled: player.gold >= UNIT_COSTS.knights,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'knights', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Catapult (${UNIT_COSTS.catapults}G)`,
            y: 348,
            buttons: [
              {
                text: 'BUY +1',
                x: 1112,
                w: 128,
                enabled: player.gold >= UNIT_COSTS.catapults,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'catapults', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Upgrades (${castleTargetTerr.name})`,
            y: 382,
            buttons: [
              {
                text: castleTargetTerr.hasMarket ? 'MARKET' : 'MKT (12G)',
                x: 1040,
                w: 96,
                enabled:
                  castleTargetTerr.ownerId === player.id &&
                  !castleTargetTerr.hasMarket &&
                  player.gold >= UNIT_COSTS.market,
                onClick: () => {
                  const r = gameState.buildMarket(player.id, castleTargetTerr.id);
                  this.setStatusMessage(r.message, !r.success);
                },
              },
              {
                text: castleTargetTerr.isRoyalKeep
                  ? 'ROYAL KEEP'
                  : castleTargetTerr.hasCastle
                  ? 'KEEP (30G)'
                  : 'CASTLE (20G)',
                x: 1142,
                w: 100,
                enabled:
                  castleTargetTerr.ownerId === player.id &&
                  ((!castleTargetTerr.hasCastle && player.gold >= UNIT_COSTS.castle) ||
                    (castleTargetTerr.hasCastle &&
                      !castleTargetTerr.isRoyalKeep &&
                      player.gold >= UNIT_COSTS.royalKeep)),
                onClick: () => {
                  if (!castleTargetTerr.hasCastle) {
                    const r = gameState.buildCastle(player.id, castleTargetTerr.id);
                    this.setStatusMessage(r.message, !r.success);
                  } else {
                    const r = gameState.upgradeRoyalKeep(player.id, castleTargetTerr.id);
                    this.setStatusMessage(r.message, !r.success);
                  }
                },
              },
            ],
          },
        ]
      : [
          {
            label: `Men-at-Arms Soldier (${UNIT_COSTS.soldiers}G)`,
            y: 268,
            buttons: [
              {
                text: '+1',
                x: 1112,
                w: 58,
                enabled: player.gold >= UNIT_COSTS.soldiers,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'soldiers', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
              {
                text: '+5',
                x: 1178,
                w: 62,
                enabled: player.gold >= UNIT_COSTS.soldiers * 5,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'soldiers', 5, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Armored Knight (${UNIT_COSTS.knights}G)`,
            y: 310,
            buttons: [
              {
                text: 'BUY +1',
                x: 1112,
                w: 128,
                enabled: player.gold >= UNIT_COSTS.knights,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'knights', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Siege Catapult (${UNIT_COSTS.catapults}G)`,
            y: 352,
            buttons: [
              {
                text: 'BUY +1',
                x: 1112,
                w: 128,
                enabled: player.gold >= UNIT_COSTS.catapults,
                onClick: () => {
                  const r = gameState.purchaseUnit(player.id, 'catapults', 1, 'campaign');
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
          {
            label: `Castle in ${castleTargetTerr.name} (${UNIT_COSTS.castle}G)`,
            y: 394,
            buttons: [
              {
                text: castleTargetTerr.hasCastle ? 'CASTLE BUILT' : 'BUILD (20G)',
                x: 1112,
                w: 128,
                enabled:
                  castleTargetTerr.ownerId === player.id &&
                  !castleTargetTerr.hasCastle &&
                  player.gold >= UNIT_COSTS.castle,
                onClick: () => {
                  const r = gameState.buildCastle(player.id, castleTargetTerr.id);
                  this.setStatusMessage(r.message, !r.success);
                },
              },
            ],
          },
        ];

    for (const row of recruitRows) {
      const lbl = this.add
        .text(820, row.y, row.label, {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          fontStyle: '600',
          color: '#1E1A16',
          resolution: TEXT_RES,
        })
        .setOrigin(0, 0.5);
      this.dynamicPanelContainer.add(lbl);

      for (const b of row.buttons) {
        this.addMiniButton(
          this.dynamicPanelContainer,
          b.x,
          row.y - 15,
          b.w,
          30,
          b.text,
          b.enabled,
          b.onClick
        );
      }
    }

    // Section B: Garrison <-> Campaign Army Transfers
    const canTransfer = stationedTerr && stationedTerr.ownerId === player.id;
    const transferTitleY = isSidequest ? 420 : 444;
    const subLegendY = isSidequest ? 440 : 466;

    const transferTitle = this.add
      .text(
        1030,
        transferTitleY,
        `GARRISON  ↔  FIELD ARMY  (${stationedTerr.name.toUpperCase()})`,
        {
          fontFamily: FONT_BODY,
          fontSize: '13.5px',
          fontStyle: 'bold',
          color: PALETTE_HEX.BLOOD_RED,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(transferTitle);

    const subLegend = this.add
      .text(1030, subLegendY, 'UNIT            GARRISON      [ - To Gar  /  + To Army ]      ARMY', {
        fontFamily: FONT_BODY,
        fontSize: '11.5px',
        fontStyle: '600',
        color: PALETTE_HEX.WOOD_MID,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(subLegend);

    const transferUnits: Array<{ label: string; key: UnitType; y: number }> = isSidequest
      ? [
          { label: 'Soldiers', key: 'soldiers', y: 466 },
          { label: 'Archers', key: 'archers', y: 498 },
          { label: 'Knights', key: 'knights', y: 530 },
          { label: 'Catapults', key: 'catapults', y: 562 },
        ]
      : [
          { label: 'Soldiers', key: 'soldiers', y: 496 },
          { label: 'Knights', key: 'knights', y: 534 },
          { label: 'Catapults', key: 'catapults', y: 572 },
        ];

    for (const u of transferUnits) {
      const garCount = stationedTerr ? (stationedTerr.garrison[u.key] ?? 0) : 0;
      const armCount = player.campaignArmy[u.key] ?? 0;

      const rowLbl = this.add
        .text(820, u.y, u.label, {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#1E1A16',
          resolution: TEXT_RES,
        })
        .setOrigin(0, 0.5);

      const garTxt = this.add
        .text(942, u.y, `${garCount}`, {
          fontFamily: FONT_BODY,
          fontSize: '14.5px',
          fontStyle: 'bold',
          color: PALETTE_HEX.WOOD_DARK,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      const armTxt = this.add
        .text(1214, u.y, `${armCount}`, {
          fontFamily: FONT_BODY,
          fontSize: '14.5px',
          fontStyle: 'bold',
          color: PALETTE_HEX.ROYAL_BLUE,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);

      this.dynamicPanelContainer.add([rowLbl, garTxt, armTxt]);

      this.addMiniButton(
        this.dynamicPanelContainer,
        984,
        u.y - 14,
        42,
        28,
        '-5',
        Boolean(canTransfer && armCount >= 1),
        () => {
          const amt = Math.min(5, armCount);
          const r = gameState.transferTroops(player.id, 'toGarrison', u.key, amt);
          this.setStatusMessage(r.message, !r.success);
        }
      );

      this.addMiniButton(
        this.dynamicPanelContainer,
        1032,
        u.y - 14,
        42,
        28,
        '-',
        Boolean(canTransfer && armCount > 0),
        () => {
          const r = gameState.transferTroops(player.id, 'toGarrison', u.key, 1);
          this.setStatusMessage(r.message, !r.success);
        }
      );

      this.addMiniButton(
        this.dynamicPanelContainer,
        1084,
        u.y - 14,
        42,
        28,
        '+',
        Boolean(canTransfer && garCount > 0),
        () => {
          const r = gameState.transferTroops(player.id, 'toCampaign', u.key, 1);
          this.setStatusMessage(r.message, !r.success);
        }
      );

      this.addMiniButton(
        this.dynamicPanelContainer,
        1132,
        u.y - 14,
        42,
        28,
        '+5',
        Boolean(canTransfer && garCount >= 1),
        () => {
          const amt = Math.min(5, garCount);
          const r = gameState.transferTroops(player.id, 'toCampaign', u.key, amt);
          this.setStatusMessage(r.message, !r.success);
        }
      );
    }

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      602,
      420,
      32,
      '←  BACK TO TERRITORY DOSSIER',
      true,
      () => {
        this.panelMode = 'DOSSIER';
        this.scheduleRefresh();
      }
    );
  }

  private renderRobinHoodPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();
    const isNorman = state.playerFaction === 'norman';

    const card = this.drawParchmentCard(796, 202, 468, 446);
    card.lineBetween(818, 248, 1242, 248);

    const header = this.add
      .text(
        1030,
        228,
        isNorman ? "PRINCE JOHN'S CHARTER" : 'ROBIN OF LOCKSLEY',
        {
          fontFamily: FONT_HEADING,
          fontSize: '19px',
          fontStyle: 'bold',
          color: isNorman ? PALETTE_HEX.BLOOD_RED : PALETTE_HEX.FOLIAGE_DARK,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(header);

    const iconKey = isNorman
      ? (state.edition === 'SIDEQUEST_LABS' ? 'sq_icon_royal_keep' : 'icon_home_castle')
      : SidequestArtGenerator.getMapIconKey(
          this,
          'icon_sherwood',
          state.edition === 'SIDEQUEST_LABS'
        );
    const icon = this.add
      .image(856, 308, iconKey)
      .setDisplaySize(56, 56);
    this.dynamicPanelContainer.add(icon);

    const quoteStr = isNorman
      ? '"By Royal Decree of Prince John, Regent of England!\nLoyal Norman barons enforcing the King\'s peace\nreceive mercenary reinforcements and archery levy."'
      : '"Hail, noble Saxon! My Merry Men stand\nready beneath the boughs of Sherwood to\naid thy banner against Norman tyranny!"';

    const quote = this.add.text(900, 268, quoteStr, {
      fontFamily: 'Georgia, serif',
      fontSize: '15.5px',
      fontStyle: 'italic',
      color: PALETTE_HEX.WOOD_DARK,
      lineSpacing: 6,
      resolution: TEXT_RES,
    });
    this.dynamicPanelContainer.add(quote);

    const usesLabel = isNorman
      ? `ROYAL WRITS REMAINING:  ${state.robinHoodUsesLeft} / 3`
      : `CAMPAIGN FAVORS REMAINING:  ${state.robinHoodUsesLeft} / 3`;

    const usesInfo = this.add
      .text(1030, 396, usesLabel, {
        fontFamily: FONT_BODY,
        fontSize: '16px',
        fontStyle: 'bold',
        color:
          state.robinHoodUsesLeft > 0
            ? PALETTE_HEX.BLOOD_RED
            : PALETTE_HEX.STONE_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(usesInfo);

    const statusLine = isNorman
      ? state.robinHoodUsesLeft <= 0
        ? 'Prince John has issued all 3 royal writs this campaign.'
        : state.robinHoodUsedThisTurn
        ? 'A royal writ has already been exercised this month.'
        : 'Grants +10 Mercenary Soldiers & +2 Longbowmen directly to thy Host!'
      : state.robinHoodUsesLeft <= 0
      ? 'Robin Hood has already aided thy cause 3 times this campaign.'
      : state.robinHoodUsedThisTurn
      ? 'Merry Men have already joined thy host this month.'
      : `Grants +${ROBIN_HOOD_MERRY_MEN_COUNT} Free Soldiers directly to thy Campaign Army!`;

    const subTxt = this.add
      .text(1030, 434, statusLine, {
        fontFamily: FONT_BODY,
        fontSize: '13.5px',
        color: '#1E1A16',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(subTxt);

    const canCall =
      state.robinHoodUsesLeft > 0 && !state.robinHoodUsedThisTurn;
    const btnLabel = isNorman
      ? '👑  INVOKE ROYAL CHARTER (+10 SOLDIERS & +2 ARCHERS)'
      : `🏹  SUMMON MERRY MEN (+${ROBIN_HOOD_MERRY_MEN_COUNT} SOLDIERS)`;

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      478,
      420,
      46,
      btnLabel,
      canCall,
      () => {
        const res = isNorman
          ? gameState.invokePrinceJohnCharter()
          : gameState.consultRobinHood();
        this.setStatusMessage(res.message, !res.success);
      }
    );

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      602,
      420,
      32,
      '←  BACK TO TERRITORY DOSSIER',
      true,
      () => {
        this.panelMode = 'DOSSIER';
        this.scheduleRefresh();
      }
    );
  }

  private renderChronicleAndLordsPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();

    const card = this.drawParchmentCard(796, 202, 468, 446);
    card.lineBetween(818, 242, 1242, 242);
    card.lineBetween(818, 424, 1242, 424);

    const header = this.add
      .text(1030, 224, 'LORDS OF THE REALM', {
        fontFamily: FONT_HEADING,
        fontSize: '17px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(header);

    let ly = 256;
    for (const lord of Object.values(state.activeLords)) {
      const castles = gameState.getLordCastleCount(lord.id);
      const lands = gameState.getLordTerritories(lord.id).length;
      const factionStr = lord.faction === 'saxon' ? 'SAX' : 'NOR';

      const miniShield = this.add
        .image(828, ly + 8, `shield_${lord.id}`)
        .setDisplaySize(16, 20)
        .setAlpha(lord.isDefeated ? 0.4 : 1);
      this.dynamicPanelContainer.add(miniShield);

      const nameColor = lord.isDefeated
        ? PALETTE_HEX.STONE_MID
        : lord.isPlayer
        ? PALETTE_HEX.ROYAL_BLUE
        : lord.faction === 'saxon'
        ? PALETTE_HEX.FOLIAGE_DARK
        : PALETTE_HEX.BLOOD_RED;

      const pactTag =
        (lord.pactWithPlayerTurns ?? 0) > 0
          ? ` [PACT ${lord.pactWithPlayerTurns}T]`
          : '';

      const leftTxt = this.add.text(
        844,
        ly,
        `${lord.name} [${factionStr}]${pactTag}`,
        {
          fontFamily: FONT_BODY,
          fontSize: '13px',
          fontStyle: lord.isPlayer ? 'bold' : '600',
          color: nameColor,
          resolution: TEXT_RES,
        }
      );

      const rightStr = lord.isDefeated
        ? 'DEFEATED'
        : `${lord.gold}G  •  ${castles} Castles / ${lands} Shires`;
      const rightTxt = this.add
        .text(1240, ly, rightStr, {
          fontFamily: FONT_BODY,
          fontSize: '12.5px',
          fontStyle: 'bold',
          color: lord.isDefeated ? PALETTE_HEX.STONE_MID : PALETTE_HEX.WOOD_DARK,
          resolution: TEXT_RES,
        })
        .setOrigin(1, 0);

      this.dynamicPanelContainer.add([leftTxt, rightTxt]);
      ly += 27;
    }

    const logHeader = this.add
      .text(
        1030,
        438,
        state.rescuedDamselIds.length > 0
          ? `CHRONICLE  •  LADIES: ${state.rescuedDamselIds
              .map((id) => SAXON_DAMSELS[id].name.replace('Lady ', ''))
              .join(', ')}`
          : 'CHRONICLE OF ENGLAND',
        {
          fontFamily: FONT_HEADING,
          fontSize: '14px',
          fontStyle: 'bold',
          color: PALETTE_HEX.BLOOD_RED,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(logHeader);

    const recentLogs = gameState.getRecentLog(6);
    const formattedLog = recentLogs
      .map((entry) => {
        const clean = entry.length > 58 ? entry.slice(0, 57) + '…' : entry;
        return `• ${clean}`;
      })
      .join('\n');

    const logBody = this.add.text(820, 458, formattedLog, {
      fontFamily: FONT_BODY,
      fontSize: '12px',
      color: '#1E1A16',
      lineSpacing: 5,
      resolution: TEXT_RES,
    });
    this.dynamicPanelContainer.add(logBody);

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      602,
      420,
      32,
      '←  BACK TO TERRITORY DOSSIER',
      true,
      () => {
        this.panelMode = 'DOSSIER';
        this.scheduleRefresh();
      }
    );
  }

  private renderTavernAndDiplomacyPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();
    const player = gameState.getPlayerLord();
    const isNorman = player.faction === 'norman';

    const card = this.drawParchmentCard(796, 202, 468, 446);
    card.lineBetween(818, 244, 1242, 244);
    card.lineBetween(818, 428, 1242, 428);

    const header = this.add
      .text(1030, 226, '🍺  THE CROWN TAVERN & DIPLOMACY', {
        fontFamily: FONT_HEADING,
        fontSize: '17px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add(header);

    // 1. Hire Spy (5G)
    const spyActive = (state.spiedTurnsRemaining ?? 0) > 0;
    this.addMiniButton(
      this.dynamicPanelContainer,
      818,
      256,
      204,
      34,
      spyActive ? `SPY INTEL (${state.spiedTurnsRemaining}T)` : '🔍 HIRE SPY (5G)',
      Boolean(!spyActive && player.gold >= 5),
      () => {
        const res = gameState.hireSpy();
        this.setStatusMessage(res.message, !res.success);
      }
    );

    // 2. Hire Mercenaries (15G)
    const mercsHired = Boolean(state.mercenariesHiredThisTurn);
    this.addMiniButton(
      this.dynamicPanelContainer,
      1034,
      256,
      208,
      34,
      mercsHired ? 'MERCENARIES HIRED' : '⚔ HIRE MERCS (15G)',
      Boolean(!mercsHired && player.gold >= 15),
      () => {
        const res = gameState.hireMercenaries();
        this.setStatusMessage(res.message, !res.success);
      }
    );

    // 3. Send Saboteur (12G)
    const enemyCastles = Object.values(state.territories).filter(
      (t) => t.hasCastle && t.ownerId && t.ownerId !== player.id
    );
    const selectedTerr = state.territories[this.selectedTerritoryId];
    const targetTerr =
      selectedTerr && selectedTerr.hasCastle && selectedTerr.ownerId && selectedTerr.ownerId !== player.id
        ? selectedTerr
        : enemyCastles[0];

    const saboteurSent = Boolean(state.saboteurSentThisTurn);
    const saboteurLabel = saboteurSent
      ? 'SABOTEUR SENT'
      : targetTerr
      ? `🗡 SABOTAGE ${targetTerr.name.slice(0, 8)} (12G)`
      : 'NO ENEMY CASTLES';

    this.addMiniButton(
      this.dynamicPanelContainer,
      818,
      300,
      204,
      34,
      saboteurLabel,
      Boolean(!saboteurSent && targetTerr && player.gold >= 12),
      () => {
        if (!targetTerr) return;
        const res = gameState.sendSaboteur(targetTerr.id);
        this.setStatusMessage(res.message, !res.success);
      }
    );

    // 4. Propose Non-Aggression Pact (10G)
    const alliedLords = Object.values(state.activeLords).filter(
      (l) => l.faction === player.faction && !l.isPlayer && !l.isDefeated
    );
    const pactPartner = alliedLords[0];
    const pactActive = pactPartner && (pactPartner.pactWithPlayerTurns ?? 0) > 0;
    const pactLabel = pactActive
      ? `PACT ACTIVE (${pactPartner.pactWithPlayerTurns}T)`
      : pactPartner
      ? `🤝 PACT: ${pactPartner.name.split(' ')[0]} (10G)`
      : 'NO ALLIED LORDS';

    this.addMiniButton(
      this.dynamicPanelContainer,
      1034,
      300,
      208,
      34,
      pactLabel,
      Boolean(!pactActive && pactPartner && player.gold >= 10),
      () => {
        if (!pactPartner) return;
        const res = gameState.proposeNonAggressionPact(pactPartner.id);
        this.setStatusMessage(res.message, !res.success);
      }
    );

    // Explanatory Subtext for Tavern actions
    const tavernInfo = this.add.text(
      818,
      346,
      '• Spy: Exact garrisons, treasury & sabotage intel for 3 turns.\n• Mercenaries: +8 Soldiers & +2 Longbowmen to Campaign Army.\n• Saboteur: -30 Castle Wall Integrity & poisons 15% garrison.\n• Pact: 3-Turn non-aggression agreement with an allied Lord.',
      {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        color: '#1E1A16',
        lineSpacing: 3,
        resolution: TEXT_RES,
      }
    );
    this.dynamicPanelContainer.add(tavernInfo);

    // Section B: Royal Ransom / Coronation Fund (200 Gold Victory Condition)
    const ransomGoal = 200;
    const paid = state.royalRansomPaid ?? 0;
    const victoryTitle = isNorman
      ? "👑  PRINCE JOHN'S CORONATION FUND"
      : "👑  KING RICHARD'S ROYAL RANSOM";
    const victoryDesc = isNorman
      ? 'Fund 200 Gold to coronate Prince John as King of England!'
      : 'Ransom King Richard the Lionheart with 200 Gold for Victory!';

    const fundTitle = this.add
      .text(1030, 442, victoryTitle, {
        fontFamily: FONT_HEADING,
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.BLOOD_RED,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const fundSub = this.add
      .text(1030, 460, `${victoryDesc} (${paid} / ${ransomGoal} Gold)`, {
        fontFamily: FONT_BODY,
        fontSize: '11px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.dynamicPanelContainer.add([fundTitle, fundSub]);

    // Progress Bar
    const progBg = this.add.graphics();
    progBg.fillStyle(PALETTE.WOOD_DARK, 0.9);
    progBg.fillRoundedRect(820, 478, 420, 16, 3);
    progBg.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    const fillW = Math.min(416, Math.round((paid / ransomGoal) * 416));
    if (fillW > 0) {
      progBg.fillRoundedRect(822, 480, fillW, 12, 2);
    }
    this.dynamicPanelContainer.add(progBg);

    // Contribution Buttons (+25G, +50G)
    const can25 = player.gold >= 25 && paid < ransomGoal;
    const can50 = player.gold >= 50 && paid < ransomGoal;

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      506,
      204,
      34,
      '+25 GOLD CONTRIB',
      can25,
      () => {
        const res = gameState.contributeRoyalRansom(25);
        this.setStatusMessage(res.message, !res.success);
      }
    );

    this.addMiniButton(
      this.dynamicPanelContainer,
      1036,
      506,
      204,
      34,
      '+50 GOLD CONTRIB',
      can50,
      () => {
        const res = gameState.contributeRoyalRansom(50);
        this.setStatusMessage(res.message, !res.success);
      }
    );

    // Back button
    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      602,
      420,
      32,
      '←  BACK TO TERRITORY DOSSIER',
      true,
      () => {
        this.panelMode = 'DOSSIER';
        this.scheduleRefresh();
      }
    );
  }

  private renderRaidCastlesPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();
    const targets = gameState.getRaidableTargets();
    const canRaidThisTurn = !state.hasRaidedThisTurn;

    const card = this.drawParchmentCard(796, 202, 468, 446);
    card.lineBetween(818, 246, 1242, 246);

    const header = this.add
      .text(1030, 226, 'NIGHT CASTLE RAID', {
        fontFamily: FONT_HEADING,
        fontSize: '18.5px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(
        1030,
        259,
        canRaidThisTurn
          ? 'Infiltrate a rival stronghold by night to plunder 60% of their vault (min 8G)!'
          : 'Thy blade rests — already conducted a Night Raid this month!',
        {
          fontFamily: FONT_BODY,
          fontSize: '11.5px',
          fontStyle: '600',
          color: canRaidThisTurn ? PALETTE_HEX.BLOOD_RED : PALETTE_HEX.STONE_DARK,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);

    this.dynamicPanelContainer.add([header, sub]);

    let ry = 286;
    if (targets.length === 0) {
      const noneTxt = this.add
        .text(1030, 360, 'No eligible rival strongholds remain.', {
          fontFamily: FONT_BODY,
          fontSize: '14px',
          color: PALETTE_HEX.STONE_DARK,
          resolution: TEXT_RES,
        })
        .setOrigin(0.5);
      this.dynamicPanelContainer.add(noneTxt);
    } else {
      for (const item of targets.slice(0, 5)) {
        const shieldKey = this.textures.exists(`shield_${item.lord.id}`)
          ? `shield_${item.lord.id}`
          : 'shield_garrison';
        const shield = this.add
          .image(828, ry + 18, shieldKey)
          .setDisplaySize(22, 28);

        const rating = getCinemawareStatRating(item.lord.swordplay);
        const nameTxt = this.add.text(
          846,
          ry + 2,
          `${item.lord.name}  (${item.territoryName})`,
          {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            fontStyle: 'bold',
            color:
              item.lord.faction === 'norman'
                ? PALETTE_HEX.BLOOD_RED
                : PALETTE_HEX.FOLIAGE_DARK,
            resolution: TEXT_RES,
          }
        );

        const infoTxt = this.add.text(
          846,
          ry + 20,
          `Vault: ${item.lord.gold}G (Loot: +${item.estimatedLoot}G) • Sword: ${item.lord.swordplay} (${rating})`,
          {
            fontFamily: FONT_BODY,
            fontSize: '11.5px',
            color: '#2B221A',
            resolution: TEXT_RES,
          }
        );

        this.dynamicPanelContainer.add([shield, nameTxt, infoTxt]);

        this.addMiniButton(
          this.dynamicPanelContainer,
          1158,
          ry + 4,
          84,
          30,
          '🗡 RAID',
          canRaidThisTurn,
          () => this.handleLaunchRaid(item.lord.id)
        );

        ry += 50;
      }
    }

    if (state.captiveDamsel) {
      const lady = SAXON_DAMSELS[state.captiveDamsel.damselId];
      this.addMiniButton(
        this.dynamicPanelContainer,
        820,
        558,
        420,
        36,
        `👸  RESCUE CAPTIVE ${lady.name.toUpperCase()}!`,
        true,
        () => this.handleLaunchDamselRescue()
      );
    }

    if (state.edition === 'SIDEQUEST_LABS' && state.pendingAssassinMission) {
      this.addMiniButton(
        this.dynamicPanelContainer,
        820,
        514,
        420,
        36,
        '🗡  DEFEND AGAINST NIGHT ASSASSIN!',
        true,
        () => this.handleLaunchAssassinDuel()
      );
    }

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      602,
      420,
      32,
      '←  BACK TO TERRITORY DOSSIER',
      true,
      () => {
        this.panelMode = 'DOSSIER';
        this.scheduleRefresh();
      }
    );
  }

  private renderTournamentPanel(state: CampaignState): void {
    const gameState = GameState.getInstance();
    const player = gameState.getPlayerLord();
    const canJoustThisTurn = !state.hasJoustedThisTurn;
    const isLand = this.tournamentStakes === 'LAND';

    const card = this.drawParchmentCard(796, 202, 468, 446);
    card.lineBetween(818, 246, 1242, 246);

    const header = this.add
      .text(1030, 226, 'ROYAL JOUSTING TOURNAMENT', {
        fontFamily: FONT_HEADING,
        fontSize: '18px',
        fontStyle: 'bold',
        color: PALETTE_HEX.WOOD_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(
        1030,
        259,
        canJoustThisTurn
          ? 'Enter the royal tilt-yard to compete for purse & honor, or wager territory!'
          : 'Thy lance rests — already jousted in the lists this month!',
        {
          fontFamily: FONT_BODY,
          fontSize: '11px',
          fontStyle: '600',
          color: canJoustThisTurn ? PALETTE_HEX.BLOOD_RED : PALETTE_HEX.STONE_DARK,
          resolution: TEXT_RES,
        }
      )
      .setOrigin(0.5);

    this.dynamicPanelContainer.add([header, sub]);

    // Stakes Toggles (y: 276, h: 28)
    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      276,
      205,
      28,
      this.tournamentStakes === 'FAME' ? '🏆 STAKES: FAME (+15G)' : 'STAKES: FAME (+15G)',
      true,
      () => {
        this.tournamentStakes = 'FAME';
        this.scheduleRefresh();
      }
    );

    this.addMiniButton(
      this.dynamicPanelContainer,
      1035,
      276,
      205,
      28,
      this.tournamentStakes === 'LAND' ? '🏰 STAKES: LAND' : 'STAKES: LAND',
      true,
      () => {
        this.tournamentStakes = 'LAND';
        this.scheduleRefresh();
      }
    );

    let ry = 316;
    if (!canJoustThisTurn) {
      const waitTxt = this.add
        .text(
          1030,
          390,
          'The King holds jousts once per month.\nAwait the next turn to enter the Lists again!',
          {
            fontFamily: FONT_BODY,
            fontSize: '14px',
            color: PALETTE_HEX.STONE_DARK,
            align: 'center',
            lineSpacing: 6,
            resolution: TEXT_RES,
          }
        )
        .setOrigin(0.5);
      this.dynamicPanelContainer.add(waitTxt);
    } else {
      const targets = gameState.getJoustableTargets(player.id, this.tournamentStakes);
      if (targets.length === 0) {
        const noneMsg = isLand
          ? 'Cannot wager land: either thou or the rival lords\ndo not possess any non-home border territories.\nTry Jousting for Fame!'
          : 'No eligible rival lords remain in the realm!';
        const noneTxt = this.add
          .text(1030, 390, noneMsg, {
            fontFamily: FONT_BODY,
            fontSize: '13px',
            color: PALETTE_HEX.STONE_DARK,
            align: 'center',
            lineSpacing: 6,
            resolution: TEXT_RES,
          })
          .setOrigin(0.5);
        this.dynamicPanelContainer.add(noneTxt);
      } else {
        for (const item of targets.slice(0, 4)) {
          const shieldKey = this.textures.exists(`shield_${item.lord.id}`)
            ? `shield_${item.lord.id}`
            : 'shield_garrison';
          const shield = this.add
            .image(828, ry + 18, shieldKey)
            .setDisplaySize(24, 30);

          const rating = getCinemawareStatRating(item.lord.jousting);
          const nameTxt = this.add.text(
            848,
            ry + 2,
            `${item.lord.name}  (${item.lord.faction.toUpperCase()})`,
            {
              fontFamily: FONT_BODY,
              fontSize: '13px',
              fontStyle: 'bold',
              color:
                item.lord.faction === 'norman'
                  ? PALETTE_HEX.BLOOD_RED
                  : PALETTE_HEX.FOLIAGE_DARK,
              resolution: TEXT_RES,
            }
          );

          const desc =
            isLand && item.wagerTerritoryId
              ? `Wager Shire: ${
                  gameState.getTerritory(item.wagerTerritoryId)?.name || 'Border'
                } • Joust: ${item.lord.jousting} (${rating})`
              : `Purse: +15 Gold • Jousting Mastery: ${item.lord.jousting} (${rating})`;

          const infoTxt = this.add.text(848, ry + 20, desc, {
            fontFamily: FONT_BODY,
            fontSize: '11.5px',
            color: '#2B221A',
            resolution: TEXT_RES,
          });

          this.dynamicPanelContainer.add([shield, nameTxt, infoTxt]);

          this.addMiniButton(
            this.dynamicPanelContainer,
            1150,
            ry + 6,
            92,
            30,
            isLand ? '🏰 WAGER' : '🏇 TILT',
            canJoustThisTurn,
            () =>
              this.handleLaunchJoust(
                item.lord.id,
                this.tournamentStakes,
                item.wagerTerritoryId
              )
          );

          ry += 52;
        }
      }
    }

    this.addMiniButton(
      this.dynamicPanelContainer,
      820,
      602,
      420,
      32,
      '←  BACK TO TERRITORY DOSSIER',
      true,
      () => {
        this.panelMode = 'DOSSIER';
        this.scheduleRefresh();
      }
    );
  }

  private renderCommandButtons(state: CampaignState): void {
    this.commandButtonsContainer.removeAll(true);
    const isOngoing = state.victoryStatus === 'ONGOING';

    if (this.panelMode === 'DOSSIER') {
      // Row 1 (y: 474, h: 38): RECRUIT & GARRISON | MARCH / ATTACK
      this.addHudCommandButton(
        796,
        474,
        229,
        38,
        '⚔  RECRUIT & GARRISON',
        isOngoing,
        false,
        false,
        () => {
          this.isMarchMode = false;
          this.panelMode = 'RECRUIT';
          this.scheduleRefresh();
        }
      );

      this.addHudCommandButton(
        1035,
        474,
        229,
        38,
        this.isMarchMode ? '✕  CANCEL MARCH [ESC]' : '➔  MARCH / ATTACK',
        isOngoing,
        false,
        this.isMarchMode,
        () => {
          this.isMarchMode = !this.isMarchMode;
          if (this.isMarchMode) {
            this.setStatusMessage(
              'MARCH MODE: Click a highlighted territory on the map!',
              false
            );
          } else {
            this.setStatusMessage('March cancelled.', false);
          }
          this.scheduleRefresh();
        }
      );

      // Row 2 (y: 518, h: 38): RAID CASTLE | ROYAL TOURNAMENT
      this.addHudCommandButton(
        796,
        518,
        229,
        38,
        state.hasRaidedThisTurn ? '🗡  CASTLE RAIDED' : '🗡  RAID CASTLE',
        isOngoing,
        false,
        false,
        () => {
          this.isMarchMode = false;
          this.panelMode = 'RAID';
          this.scheduleRefresh();
        }
      );

      this.addHudCommandButton(
        1035,
        518,
        229,
        38,
        state.hasJoustedThisTurn ? '🏇  LISTS CLOSED' : '🏇  TOURNAMENT',
        isOngoing,
        false,
        false,
        () => {
          this.isMarchMode = false;
          this.panelMode = 'TOURNAMENT';
          this.scheduleRefresh();
        }
      );

      // Row 3 (y: 562, h: 38): ROBIN HOOD / PRINCE JOHN | CHRONICLE & LORDS
      const isNorman = state.playerFaction === 'norman';
      const sanctuaryLabel = isNorman
        ? `👑  PRINCE JOHN (${state.robinHoodUsesLeft}/3)`
        : `🏹  ROBIN HOOD (${state.robinHoodUsesLeft}/3)`;

      this.addHudCommandButton(
        796,
        562,
        229,
        38,
        sanctuaryLabel,
        isOngoing,
        false,
        false,
        () => {
          this.isMarchMode = false;
          this.panelMode = 'ROBIN_HOOD';
          this.scheduleRefresh();
        }
      );

      this.addHudCommandButton(
        1035,
        562,
        229,
        38,
        '📜  CHRONICLE & LORDS',
        isOngoing,
        false,
        false,
        () => {
          this.isMarchMode = false;
          this.panelMode = 'CHRONICLE';
          this.scheduleRefresh();
        }
      );

      // Row 4 (y: 606, h: 38): TAVERN & DIPLOMACY | ARCHERY | SAVE (or Damsel Rescue)
      const isSidequest = state.edition === 'SIDEQUEST_LABS';
      if (state.captiveDamsel) {
        const lady = SAXON_DAMSELS[state.captiveDamsel.damselId];
        if (isSidequest) {
          this.addHudCommandButton(
            796,
            606,
            120,
            38,
            `👸  RESCUE!`,
            isOngoing,
            true,
            true,
            () => this.handleLaunchDamselRescue()
          );
          this.addHudCommandButton(
            922,
            606,
            106,
            38,
            '🍺  TAVERN',
            isOngoing,
            false,
            false,
            () => {
              this.isMarchMode = false;
              this.panelMode = 'TAVERN';
              this.scheduleRefresh();
            }
          );
          this.addHudCommandButton(
            1034,
            606,
            126,
            38,
            '🏹  ARCHERY',
            isOngoing,
            false,
            false,
            () => this.handleLaunchArcheryContest()
          );
          this.addHudCommandButton(
            1166,
            606,
            98,
            38,
            '💾  SAVE',
            isOngoing,
            false,
            false,
            () => this.handleSaveCampaign()
          );
        } else {
          this.addHudCommandButton(
            796,
            606,
            320,
            38,
            `👸  RESCUE ${lady.name.toUpperCase()}!`,
            isOngoing,
            true,
            true,
            () => this.handleLaunchDamselRescue()
          );

          this.addHudCommandButton(
            1126,
            606,
            138,
            38,
            '💾  SAVE [S]',
            isOngoing,
            false,
            false,
            () => this.handleSaveCampaign()
          );
        }
      } else {
        if (isSidequest) {
          this.addHudCommandButton(
            796,
            606,
            146,
            38,
            '🍺  TAVERN',
            isOngoing,
            false,
            false,
            () => {
              this.isMarchMode = false;
              this.panelMode = 'TAVERN';
              this.scheduleRefresh();
            }
          );

          this.addHudCommandButton(
            950,
            606,
            180,
            38,
            '🏹  ARCHERY CONTEST',
            isOngoing,
            false,
            false,
            () => this.handleLaunchArcheryContest()
          );

          this.addHudCommandButton(
            1138,
            606,
            126,
            38,
            '💾  SAVE [S]',
            isOngoing,
            false,
            false,
            () => this.handleSaveCampaign()
          );
        } else {
          this.addHudCommandButton(
            796,
            606,
            468,
            38,
            '💾  SAVE CAMPAIGN PROGRESS [S]',
            isOngoing,
            false,
            false,
            () => this.handleSaveCampaign()
          );
        }
      }

      // Bottom Row (y: 654, h: 52): END TURN
      this.addHudCommandButton(
        796,
        654,
        468,
        52,
        '⏳   END TURN  (NEXT MONTH)',
        isOngoing,
        true,
        false,
        () => this.handleEndTurn()
      );
    } else {
      this.addHudCommandButton(
        796,
        654,
        468,
        52,
        '⏳   END TURN  (NEXT MONTH)',
        isOngoing,
        true,
        false,
        () => this.handleEndTurn()
      );
    }
  }

  private handleSaveCampaign(): void {
    const saved = GameState.getInstance().saveToStorage();
    if (saved) {
      AudioManager.getInstance().playFanfare();
      this.setStatusMessage(
        '💾 Campaign progress successfully archived to parchment scrolls!',
        false
      );
    } else {
      this.setStatusMessage('Unable to archive campaign (storage unavailable).', true);
    }
  }

  private handleLaunchJoust(
    targetLordId: string,
    stakes: JoustStakesType,
    wagerTerritoryId?: string
  ): void {
    if (this.isTransitioningToBattle) return;
    const res = GameState.getInstance().initiateJoust(
      targetLordId,
      stakes,
      wagerTerritoryId
    );
    if (!res.success || !res.context) {
      this.setStatusMessage(res.message, true);
      this.scheduleRefresh();
      return;
    }

    this.setStatusMessage(res.message, false);
    this.launchJoustScene(res.context);
  }

  private launchJoustScene(joustContext: PendingJoustContext): void {
    if (this.isTransitioningToBattle) return;
    this.isTransitioningToBattle = true;
    this.isMarchMode = false;

    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('JoustScene', {
        joustContext,
      });
    });
  }

  private handleLaunchRaid(targetLordId: string): void {
    if (this.isTransitioningToBattle) return;
    const res = GameState.getInstance().initiateCastleRaid(targetLordId);
    if (!res.success || !res.context) {
      this.setStatusMessage(res.message, true);
      this.scheduleRefresh();
      return;
    }

    this.setStatusMessage(res.message, false);
    this.launchSwordplayScene(res.context);
  }

  private handleLaunchDamselRescue(): void {
    if (this.isTransitioningToBattle) return;
    const res = GameState.getInstance().initiateDamselRescue();
    if (!res.success || !res.context) {
      this.setStatusMessage(res.message, true);
      this.scheduleRefresh();
      return;
    }

    this.setStatusMessage(res.message, false);
    this.launchSwordplayScene(res.context);
  }

  private handleLaunchAssassinDuel(): void {
    if (this.isTransitioningToBattle) return;
    const res = GameState.getInstance().initiateAssassinDuel();
    if (!res.success || !res.context) {
      this.setStatusMessage(res.message, true);
      this.scheduleRefresh();
      return;
    }

    this.setStatusMessage(res.message, false);
    this.launchSwordplayScene(res.context);
  }

  private handleLaunchArcheryContest(): void {
    if (this.isTransitioningToBattle) return;
    const res = GameState.getInstance().initiateArcheryContest();
    if (!res.success) {
      this.setStatusMessage(res.message, true);
      this.scheduleRefresh();
      return;
    }

    this.isTransitioningToBattle = true;
    this.isMarchMode = false;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('ArcheryScene');
    });
  }

  private launchSwordplayScene(swordplayContext: PendingSwordplayContext): void {
    if (this.isTransitioningToBattle) return;
    this.isTransitioningToBattle = true;
    this.isMarchMode = false;

    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('SwordplayScene', {
        swordplayContext,
      });
    });
  }

  private handleEndTurn(): void {
    if (this.isTransitioningToBattle) return;
    this.isMarchMode = false;
    const stepResult = this.turnManager.beginInteractiveTurn();
    this.processInteractiveTurnResult(stepResult);
  }

  private processInteractiveTurnResult(stepResult: InteractiveTurnResult): void {
    if (
      stepResult.status === 'PAUSED_FOR_PLAYER_DEFENSE' &&
      stepResult.pendingBattle
    ) {
      const state = GameState.getInstance().getState();
      const invName =
        state.activeLords[stepResult.pendingBattle.attackerId]?.name ?? 'Rival Host';
      const terrName =
        state.territories[stepResult.pendingBattle.territoryId]?.name ?? 'thy Shire';

      this.selectedTerritoryId = stepResult.pendingBattle.territoryId;
      this.setStatusMessage(
        stepResult.pendingBattle.hasCastle
          ? `🏰 ${invName} besieges ${terrName}! To the ramparts!`
          : `⚔ ${invName} invades ${terrName}! To arms!`,
        true
      );
      this.scheduleRefresh();
      this.launchBattleScene(stepResult.pendingBattle, stepResult.queueState);
      return;
    }

    const summary = stepResult.summary;
    if (!summary) {
      this.scheduleRefresh();
      return;
    }

    const monthStr = MONTH_NAMES[(summary.month - 1) % 12];
    const player = GameState.getInstance().getPlayerLord();
    const myTax = summary.taxesCollected[player.id] ?? 0;

    if (summary.victoryStatus === 'DEFEAT') {
      this.setStatusMessage('Thy Home Stronghold has fallen! Defeat!', true);
    } else if (summary.victoryStatus === 'VICTORY') {
      this.setStatusMessage('ALL RIVALS VANQUISHED! VICTORY IS THINE!', false);
    } else {
      const postState = GameState.getInstance().getState();
      if (
        postState.captiveDamsel &&
        postState.captiveDamsel.turnCaptured === summary.turn
      ) {
        const lady = SAXON_DAMSELS[postState.captiveDamsel.damselId];
        const terr =
          postState.territories[postState.captiveDamsel.castleTerritoryId];
        this.setStatusMessage(
          `👸 DAMSEL IN DISTRESS! ${lady.name} held captive in ${
            terr?.name ?? 'a Norman keep'
          }! (+${myTax}G tax)`,
          true
        );
      } else {
        this.setStatusMessage(
          `${monthStr} ${summary.year}: AI Lords marched • Collected +${myTax}G in taxes.`,
          false
        );
      }
    }

    this.scheduleRefresh();
  }

  private launchBattleScene(
    battleContext: PendingBattleContext,
    resumeAiQueue?: AiTurnQueueState
  ): void {
    if (this.isTransitioningToBattle) return;
    this.isTransitioningToBattle = true;
    const targetScene = battleContext.hasCastle ? 'SiegeScene' : 'BattleScene';
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(targetScene, {
        battleContext,
        resumeAiQueue,
      });
    });
  }

  private addHudCommandButton(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    isAccent: boolean,
    isActiveToggle: boolean,
    onClick: () => void
  ): void {
    const g = this.add.graphics();
    const fillColor = !enabled
      ? PALETTE.STONE_DARK
      : isActiveToggle || isAccent
      ? PALETTE.BLOOD_RED
      : PALETTE.WOOD_DARK;
    const borderColor = !enabled
      ? PALETTE.STONE_MID
      : isActiveToggle || isAccent
      ? PALETTE.GOLD_BRIGHT
      : PALETTE.GOLD_DARK;

    const drawState = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? PALETTE.WOOD_MID : fillColor, 1);
      g.fillRoundedRect(x, y, w, h, 5);
      g.lineStyle(
        hover ? 2.5 : 1.5,
        hover ? PALETTE.GOLD_BRIGHT : borderColor,
        1
      );
      g.strokeRoundedRect(x, y, w, h, 5);
    };

    drawState(false);
    this.commandButtonsContainer.add(g);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: isAccent ? FONT_HEADING : FONT_BODY,
        fontSize: isAccent ? '15.5px' : '14.5px',
        fontStyle: 'bold',
        color: !enabled
          ? PALETTE_HEX.STONE_LIGHT
          : isAccent || isActiveToggle
          ? PALETTE_HEX.GOLD_BRIGHT
          : PALETTE_HEX.PARCHMENT_LIGHT,
        letterSpacing: isAccent ? 1 : 0.5,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.commandButtonsContainer.add(txt);

    if (enabled) {
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        drawState(true);
        txt.setColor(PALETTE_HEX.GOLD_BRIGHT);
      });
      zone.on('pointerout', () => {
        drawState(false);
        txt.setColor(
          isAccent || isActiveToggle
            ? PALETTE_HEX.GOLD_BRIGHT
            : PALETTE_HEX.PARCHMENT_LIGHT
        );
      });
      zone.on('pointerdown', () => {
        AudioManager.getInstance().playUiClick();
        onClick();
      });
      this.commandButtonsContainer.add(zone);
    }
  }

  private addMiniButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void
  ): void {
    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(
        !enabled
          ? PALETTE.PARCHMENT_DARK
          : hover
          ? PALETTE.BLOOD_RED
          : PALETTE.WOOD_DARK,
        1
      );
      g.fillRoundedRect(x, y, w, h, 4);
      g.lineStyle(
        1.5,
        !enabled
          ? PALETTE.STONE_MID
          : hover
          ? PALETTE.GOLD_BRIGHT
          : PALETTE.GOLD_DARK,
        1
      );
      g.strokeRoundedRect(x, y, w, h, 4);
    };
    draw(false);
    parent.add(g);

    const txt = this.add
      .text(x + w / 2, y + h / 2, label, {
        fontFamily: FONT_BODY,
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: enabled ? PALETTE_HEX.GOLD_BRIGHT : PALETTE_HEX.STONE_DARK,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    parent.add(txt);

    if (enabled) {
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h);
      zone.setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => draw(true));
      zone.on('pointerout', () => draw(false));
      zone.on('pointerdown', () => {
        AudioManager.getInstance().playUiClick();
        onClick();
      });
      parent.add(zone);
    }
  }

  private renderEndGameModal(state: CampaignState): void {
    this.endGameModalContainer.removeAll(true);
    if (state.victoryStatus === 'ONGOING') {
      this.endGameModalContainer.setVisible(false);
      return;
    }

    this.endGameModalContainer.setVisible(true);
    const isVictory = state.victoryStatus === 'VICTORY';
    const player = GameState.getInstance().getPlayerLord();
    const heldCount = GameState.getInstance().getPlayerTerritories().length;
    const isRansomVictory =
      isVictory &&
      state.edition === 'SIDEQUEST_LABS' &&
      (state.royalRansomPaid ?? 0) >= 200;
    const isNorman = player.faction === 'norman';

    const shade = this.add.graphics();
    shade.fillStyle(PALETTE.BLACK, 0.76);
    shade.fillRect(0, 0, 1280, 720);

    shade.fillStyle(PALETTE.WOOD_DARK, 1);
    shade.fillRoundedRect(290, 160, 700, 390, 10);
    shade.lineStyle(4, PALETTE.GOLD_BRIGHT, 1);
    shade.strokeRoundedRect(290, 160, 700, 390, 10);
    shade.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    shade.fillRoundedRect(308, 178, 664, 354, 6);
    this.endGameModalContainer.add(shade);

    let titleText = isVictory
      ? '★  DEFENDER OF THE CROWN!  ★'
      : '☠  THY REALM HAS FALLEN  ☠';
    let bodyMsg = isVictory
      ? `Hail King ${player.name}!\nEvery rival Saxon and Norman stronghold\nhas bowed before thy royal banner!\n\nConcluded in ${MONTH_NAMES[(state.month - 1) % 12]} ${state.year} A.D. (Turn ${state.turn})\nShires United: ${heldCount}  •  Royal Treasury: ${player.gold} Gold`
      : `Alas! ${player.name}'s ancestral stronghold\nhas been stormed and conquered.\nEngland falls into rival hands in ${MONTH_NAMES[(state.month - 1) % 12]} ${state.year} A.D.`;

    if (isRansomVictory) {
      titleText = isNorman
        ? '👑  PRINCE JOHN CORONATED KING!  👑'
        : '👑  KING RICHARD RESTORED TO ENGLAND!  👑';
      bodyMsg = isNorman
        ? `By Royal Proclamation, Prince John's 200 Gold Coronation Fund is complete!\nThy steadfast loyalty has placed the English Crown upon his brow,\nnaming ${player.name} High Chancellor of the realm!\n\nConcluded in ${MONTH_NAMES[(state.month - 1) % 12]} ${state.year} A.D. (Turn ${state.turn})\nRoyal Treasury: ${player.gold} Gold  •  Shires: ${heldCount}`
        : `Rejoice, merry England! The 200 Gold Royal Ransom has been paid in full!\nKing Richard the Lionheart returns triumphantly to his rightful throne,\nproclaiming ${player.name} as the true Defender of the Crown!\n\nConcluded in ${MONTH_NAMES[(state.month - 1) % 12]} ${state.year} A.D. (Turn ${state.turn})\nRoyal Treasury: ${player.gold} Gold  •  Shires: ${heldCount}`;
    }

    const title = this.add
      .text(640, 230, titleText, {
        fontFamily: FONT_HEADING,
        fontSize: isRansomVictory ? '26px' : '32px',
        fontStyle: 'bold',
        color: isVictory ? PALETTE_HEX.ROYAL_BLUE : PALETTE_HEX.BLOOD_RED,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    const body = this.add
      .text(640, 348, bodyMsg, {
        fontFamily: FONT_BODY,
        fontSize: '17px',
        fontStyle: '600',
        color: '#1E1A16',
        align: 'center',
        lineSpacing: 8,
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);

    this.endGameModalContainer.add([title, body]);

    this.addMiniButton(
      this.endGameModalContainer,
      440,
      462,
      400,
      48,
      '⚔   START NEW CAMPAIGN   ⚔',
      true,
      () => {
        this.cameras.main.fadeOut(250, 0, 0, 0);
        this.cameras.main.once(
          Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
          () => {
            this.scene.start('CharacterSelectScene');
          }
        );
      }
    );
  }
}
