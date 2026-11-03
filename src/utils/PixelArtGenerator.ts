import Phaser from 'phaser';
import { PALETTE } from '../data/palette';
import {
  INITIAL_TERRITORIES,
  SCOTLAND_POLYGON,
  WALES_POLYGON,
} from '../data/territories';
import { MapPoint } from '../core/types';

/**
 * PixelArtGenerator — 16:9 HD (1280x720) Hybrid Edition
 * - Smooth, anti-aliased widescreen backdrops & cartographic coastlines (no noisy dithering)
 * - Crisp nearest-neighbor retro pixel-art portraits, heraldic shields, and map icons
 */
export class PixelArtGenerator {
  private static markNearest(scene: Phaser.Scene, key: string): void {
    const tex = scene.textures.get(key);
    if (tex) {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  /**
   * Generates a smooth vertical gradient rectangle without noisy checkerboard dithering.
   */
  public static drawSmoothVerticalGradient(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    topColor: number,
    bottomColor: number,
    steps = 48
  ): void {
    const r1 = (topColor >> 16) & 0xff;
    const g1 = (topColor >> 8) & 0xff;
    const b1 = topColor & 0xff;

    const r2 = (bottomColor >> 16) & 0xff;
    const g2 = (bottomColor >> 8) & 0xff;
    const b2 = bottomColor & 0xff;

    const bandH = Math.ceil(h / steps) + 1;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const gr = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      const col = (r << 16) | (gr << 8) | b;
      g.fillStyle(col, 1);
      g.fillRect(x, y + Math.floor((i * h) / steps), w, bandH);
    }
  }

  /**
   * Generates the iconic Title Screen Castle Siege backdrop in native 1280x720 Widescreen.
   */
  public static createTitleBackdrop(scene: Phaser.Scene): void {
    const key = 'title_backdrop';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Smooth Twilight Sky Gradient (1280 x 490)
    this.drawSmoothVerticalGradient(g, 0, 0, 1280, 220, 0x090c18, PALETTE.SHADOW, 48);
    this.drawSmoothVerticalGradient(g, 0, 218, 1280, 160, PALETTE.SHADOW, PALETTE.SKY_NIGHT, 40);
    this.drawSmoothVerticalGradient(g, 0, 376, 1280, 120, PALETTE.SKY_NIGHT, PALETTE.SKY_MID, 32);

    // Subtle twilight stars
    const stars: Array<[number, number, number]> = [
      [110, 48, 0.7], [240, 82, 0.5], [390, 36, 0.8], [580, 64, 0.6],
      [740, 42, 0.7], [890, 92, 0.5], [1160, 56, 0.8], [1080, 128, 0.5],
    ];
    for (const [sx, sy, sa] of stars) {
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, sa);
      g.fillCircle(sx, sy, 1.5);
    }

    // 2. Full Harvest Moon with Soft Atmospheric Halo
    const moonX = 1010;
    const moonY = 148;
    const moonR = 54;
    g.fillStyle(PALETTE.GOLD_DARK, 0.14);
    g.fillCircle(moonX, moonY, moonR + 28);
    g.fillStyle(PALETTE.GOLD_BRIGHT, 0.22);
    g.fillCircle(moonX, moonY, moonR + 12);
    g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    g.fillCircle(moonX, moonY, moonR);
    g.fillStyle(PALETTE.PARCHMENT_DARK, 0.65);
    g.fillCircle(moonX - 15, moonY - 11, 12);
    g.fillCircle(moonX + 18, moonY + 14, 10);
    g.fillCircle(moonX + 7, moonY - 19, 7);

    // 3. Distant Misty Ridge
    g.fillStyle(0x16331b, 1);
    g.beginPath();
    g.moveTo(0, 445);
    g.lineTo(280, 385);
    g.lineTo(580, 420);
    g.lineTo(920, 372);
    g.lineTo(1280, 412);
    g.lineTo(1280, 510);
    g.lineTo(0, 510);
    g.closePath();
    g.fillPath();

    // 4. Rolling Foreground Hills
    g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
    g.beginPath();
    g.moveTo(0, 480);
    g.lineTo(420, 456);
    g.lineTo(840, 492);
    g.lineTo(1280, 462);
    g.lineTo(1280, 720);
    g.lineTo(0, 720);
    g.closePath();
    g.fillPath();

    g.fillStyle(PALETTE.FOLIAGE_MID, 0.55);
    g.beginPath();
    g.moveTo(0, 535);
    g.lineTo(360, 512);
    g.lineTo(780, 558);
    g.lineTo(1280, 530);
    g.lineTo(1280, 720);
    g.lineTo(0, 720);
    g.closePath();
    g.fillPath();

    // 5. Majestic Castle Fortress on the Hill (Left, x: 140..510)
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(140, 438, 370, 110);

    // Left Keep Tower
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(158, 286, 84, 170);
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(158, 274, 22, 14);
    g.fillRect(189, 274, 22, 14);
    g.fillRect(220, 274, 22, 14);
    g.fillStyle(PALETTE.STONE_LIGHT, 0.85);
    g.fillRect(158, 288, 9, 166);

    // Right Great Keep Tower
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(386, 248, 98, 208);
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(386, 234, 24, 16);
    g.fillRect(423, 234, 24, 16);
    g.fillRect(460, 234, 24, 16);
    g.fillStyle(PALETTE.STONE_LIGHT, 0.85);
    g.fillRect(386, 250, 10, 204);

    // Central Curtain Wall
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(242, 330, 144, 126);
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    for (let cx = 248; cx < 380; cx += 34) {
      g.fillRect(cx, 318, 20, 14);
    }

    // Portcullis Gatehouse
    g.fillStyle(PALETTE.BLACK, 1);
    g.fillRect(288, 386, 52, 70);
    g.fillStyle(PALETTE.STONE_LIGHT, 0.8);
    for (let bx = 298; bx <= 330; bx += 10) {
      g.fillRect(bx, 392, 3, 64);
    }
    g.fillRect(288, 408, 52, 3);
    g.fillRect(288, 430, 52, 3);

    // Glowing Torchlit Arrow Slits
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillRect(192, 316, 10, 28);
    g.fillRect(430, 280, 10, 28);
    g.fillRect(430, 340, 10, 28);
    g.fillRect(276, 352, 8, 18);
    g.fillRect(344, 352, 8, 18);

    // Royal Banner atop Main Keep
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(432, 184, 6, 52);
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillTriangle(438, 186, 502, 204, 438, 222);

    // 6. Siege Trebuchet Silhouette in Foreground (Right, x: 930..1150)
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(930, 602, 184, 18);
    g.beginPath();
    g.moveTo(950, 602);
    g.lineTo(1018, 498);
    g.lineTo(1034, 498);
    g.lineTo(1092, 602);
    g.lineTo(1072, 602);
    g.lineTo(1026, 514);
    g.lineTo(970, 602);
    g.closePath();
    g.fillPath();

    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.beginPath();
    g.moveTo(1106, 572);
    g.lineTo(912, 454);
    g.lineTo(920, 444);
    g.lineTo(1114, 562);
    g.closePath();
    g.fillPath();

    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(1088, 558, 44, 36);
    g.lineStyle(2, PALETTE.BLACK, 1);
    g.strokeRect(1088, 558, 44, 36);

    // 7. Burning Siege Torches & Campfire Glow
    const torches: Array<[number, number]> = [
      [868, 582],
      [1176, 594],
    ];
    for (const [tx, ty] of torches) {
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(tx - 3, ty, 6, 36);
      g.fillStyle(PALETTE.GOLD_DARK, 0.3);
      g.fillCircle(tx, ty - 6, 20);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillCircle(tx, ty - 6, 9);
      g.fillStyle(PALETTE.BLOOD_RED, 0.9);
      g.fillCircle(tx, ty - 2, 4);
    }

    g.generateTexture(key, 1280, 720);
    g.destroy();
  }

  /**
   * Generates Coat of Arms Shields for Saxon and Norman Lords (44x56, crisp NEAREST filter).
   */
  public static createHeraldicShield(
    scene: Phaser.Scene,
    key: string,
    primaryColor: number,
    secondaryColor: number,
    accentColor: number,
    symbol: string
  ): void {
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    const w = 44;
    const h = 56;

    const drawShieldPath = () => {
      g.beginPath();
      g.moveTo(5, 3);
      g.lineTo(38, 3);
      g.lineTo(38, 32);
      g.lineTo(22, 52);
      g.lineTo(5, 32);
      g.closePath();
    };

    // Drop Shadow
    g.fillStyle(PALETTE.BLACK, 0.7);
    g.beginPath();
    g.moveTo(7, 5);
    g.lineTo(40, 5);
    g.lineTo(40, 33);
    g.lineTo(23, 54);
    g.lineTo(7, 33);
    g.closePath();
    g.fillPath();

    // Gold Trim
    g.fillStyle(PALETTE.GOLD_DARK, 1);
    drawShieldPath();
    g.fillPath();

    // Primary Field
    g.fillStyle(primaryColor, 1);
    g.beginPath();
    g.moveTo(8, 6);
    g.lineTo(35, 6);
    g.lineTo(35, 30);
    g.lineTo(22, 48);
    g.lineTo(8, 30);
    g.closePath();
    g.fillPath();

    // Heraldic Charges
    if (symbol === 'cross') {
      g.fillStyle(secondaryColor, 1);
      g.fillRect(19, 6, 6, 42);
      g.fillRect(8, 17, 27, 6);
      g.fillStyle(accentColor, 1);
      g.fillRect(21, 7, 2, 40);
      g.fillRect(9, 19, 25, 2);
    } else if (symbol === 'boar') {
      g.fillStyle(secondaryColor, 1);
      g.fillRect(22, 6, 13, 17);
      g.fillRect(8, 23, 14, 14);
      g.fillStyle(accentColor, 1);
      g.fillRect(15, 14, 14, 9);
      g.fillRect(11, 17, 6, 5);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 16, 3, 3);
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(11, 20, 3, 4);
    } else if (symbol === 'sword') {
      g.fillStyle(secondaryColor, 1);
      for (let i = 0; i < 25; i++) {
        g.fillRect(10 + i, 7 + i, 4, 4);
      }
      g.fillStyle(accentColor, 1);
      g.fillRect(21, 10, 3, 28);
      g.fillRect(17, 32, 11, 3);
      g.fillRect(21, 35, 3, 6);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(20, 40, 5, 3);
    } else if (symbol === 'wolf') {
      g.fillStyle(secondaryColor, 1);
      g.fillTriangle(22, 12, 12, 34, 32, 34);
      g.fillStyle(accentColor, 1);
      g.fillTriangle(22, 15, 15, 28, 29, 28);
      g.fillRect(15, 10, 4, 6);
      g.fillRect(25, 10, 4, 6);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(18, 19, 3, 3);
      g.fillRect(23, 19, 3, 3);
      g.fillRect(20, 26, 5, 6);
    } else if (symbol === 'falcon') {
      g.fillStyle(secondaryColor, 1);
      g.fillTriangle(22, 9, 11, 23, 33, 23);
      g.fillRect(19, 23, 6, 14);
      g.fillStyle(accentColor, 1);
      g.fillRect(21, 13, 3, 3);
      g.fillRect(22, 16, 4, 3);
    } else if (symbol === 'axe') {
      g.fillStyle(secondaryColor, 1);
      g.fillRect(21, 10, 3, 30);
      g.fillStyle(accentColor, 1);
      g.fillRect(14, 14, 7, 12);
      g.fillRect(24, 14, 7, 12);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(19, 13, 6, 14);
    } else if (symbol === 'lion') {
      g.fillStyle(secondaryColor, 1);
      g.fillRect(17, 14, 11, 20);
      g.fillRect(19, 10, 8, 7);
      g.fillRect(12, 13, 6, 4);
      g.fillRect(25, 17, 6, 4);
      g.fillRect(14, 31, 6, 7);
      g.fillRect(24, 30, 6, 8);
      g.fillRect(11, 20, 3, 10);
      g.fillRect(10, 18, 3, 3);
      g.fillStyle(accentColor, 1);
      g.fillRect(21, 11, 2, 2);
    }

    // Specular rim
    g.fillStyle(PALETTE.GOLD_BRIGHT, 0.75);
    g.fillRect(7, 4, 31, 2);
    g.fillRect(5, 4, 2, 25);

    g.generateTexture(key, w, h);
    g.destroy();
    this.markNearest(scene, key);
  }

  /**
   * Generates 64x64 retro pixel-art portraits for the Saxon Lords (clean non-dithered backgrounds + NEAREST filter).
   */
  public static createLordPortraits(scene: Phaser.Scene): void {
    const size = 64;

    const drawPortraitFrame = (
      g: Phaser.GameObjects.Graphics,
      topBg: number,
      botBg: number
    ) => {
      g.fillStyle(topBg, 1);
      g.fillRect(0, 0, size, size);
      g.fillStyle(botBg, 1);
      g.fillRect(0, 32, size, 32);
      g.lineStyle(2, PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);
    };

    // 1. Ivanhoe
    if (!scene.textures.exists('portrait_ivanhoe')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x22293d, PALETTE.SHADOW);

      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(11, 43, 42, 19);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(29, 43, 6, 19);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(13, 37, 38, 8);

      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(21, 19, 22, 21);
      g.fillRect(24, 35, 16, 5);

      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(19, 11, 26, 9);
      g.fillRect(17, 17, 4, 20);
      g.fillRect(43, 17, 4, 20);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(22, 12, 3, 3);
      g.fillRect(30, 12, 3, 3);
      g.fillRect(38, 12, 3, 3);

      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(24, 19, 16, 3);

      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(24, 24, 4, 3);
      g.fillRect(36, 24, 4, 3);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(23, 21, 5, 2);
      g.fillRect(36, 21, 5, 2);

      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 25, 3, 6);

      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(26, 32, 12, 3);
      g.fillRect(25, 34, 3, 3);
      g.fillRect(36, 34, 3, 3);

      g.generateTexture('portrait_ivanhoe', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_ivanhoe');
    }

    // 2. Cedric
    if (!scene.textures.exists('portrait_cedric')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x2b1d12, 0x1a110a);

      g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
      g.fillRect(11, 43, 42, 19);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(19, 40, 26, 11);

      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(21, 16, 22, 21);

      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(17, 11, 30, 8);
      g.fillRect(16, 16, 5, 24);
      g.fillRect(43, 16, 5, 24);

      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(23, 20, 7, 3);
      g.fillRect(34, 20, 7, 3);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 24, 4, 3);
      g.fillRect(36, 24, 4, 3);

      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 24, 4, 7);

      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(23, 32, 18, 13);
      g.fillRect(25, 43, 14, 8);
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(27, 35, 10, 3);
      g.fillRect(28, 41, 8, 3);

      g.generateTexture('portrait_cedric', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_cedric');
    }

    // 3. Geoffrey
    if (!scene.textures.exists('portrait_geoffrey')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x18253d, 0x0f1626);

      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(11, 43, 42, 19);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(24, 40, 16, 5);

      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(23, 17, 18, 20);
      g.fillRect(25, 35, 14, 5);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(20, 9, 24, 9);
      g.fillRect(19, 15, 5, 19);
      g.fillRect(40, 15, 5, 19);
      g.fillRect(23, 16, 5, 4);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 23, 4, 3);
      g.fillRect(36, 23, 4, 3);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(23, 20, 7, 2);
      g.fillRect(34, 20, 7, 2);

      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 24, 3, 7);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(27, 32, 10, 3);
      g.fillRect(30, 36, 5, 5);

      g.generateTexture('portrait_geoffrey', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_geoffrey');
    }

    // 4. Wolfric
    if (!scene.textures.exists('portrait_wolfric')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x26262e, 0x16161c);

      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(11, 43, 42, 19);
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(13, 37, 19, 8);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(15, 40, 4, 4);

      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(21, 16, 22, 21);

      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(17, 8, 30, 9);
      g.fillRect(15, 13, 8, 24);
      g.fillRect(41, 13, 8, 24);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(20, 9, 11, 4);
      g.fillRect(33, 9, 11, 4);

      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(21, 20, 8, 3);
      g.fillRect(35, 20, 8, 3);

      g.fillStyle(PALETTE.FOLIAGE_MID, 1);
      g.fillRect(24, 23, 4, 3);
      g.fillRect(36, 23, 4, 3);

      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 23, 4, 7);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(27, 21, 3, 5);

      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(21, 31, 22, 13);
      g.fillRect(24, 43, 16, 8);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(25, 33, 14, 4);
      g.fillRect(28, 41, 8, 5);

      g.generateTexture('portrait_wolfric', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_wolfric');
    }
  }

  /**
   * Generates the Left-Zone Britain Coastal Sea, Smooth Shorelines, Scotland & Wales (780x720 HD).
   */
  public static createBritainMapBackdrop(scene: Phaser.Scene): void {
    const key = 'map_britain_base';
    if (scene.textures.exists(key)) return;

    const w = 780;
    const h = 720;
    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Smooth Deep Nautical Sea Gradient
    this.drawSmoothVerticalGradient(g, 0, 0, w, h, 0x1b3358, 0x264778, 64);

    // Subtle cartographic latitude lines
    g.lineStyle(1, PALETTE.SKY_LIGHT, 0.08);
    for (let y = 90; y < h; y += 90) {
      g.lineBetween(10, y, w - 10, y);
    }
    for (let x = 110; x < w; x += 110) {
      g.lineBetween(x, 10, x, h - 10);
    }

    const drawPoly = (pts: MapPoint[]) => {
      if (pts.length === 0) return;
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        g.lineTo(pts[i].x, pts[i].y);
      }
      g.closePath();
    };

    const allLandPolys: MapPoint[][] = [
      SCOTLAND_POLYGON,
      WALES_POLYGON,
      ...Object.values(INITIAL_TERRITORIES)
        .map((t) => t.polygon)
        .filter((p): p is MapPoint[] => Boolean(p)),
    ];

    // 2. Smooth Anti-Aliased Coastal Shallow-Water Halos (No noisy dithering!)
    for (const poly of allLandPolys) {
      g.lineStyle(26, 0x355c96, 0.32);
      drawPoly(poly);
      g.strokePath();
    }
    for (const poly of allLandPolys) {
      g.lineStyle(14, PALETTE.SKY_MID, 0.45);
      drawPoly(poly);
      g.strokePath();
    }
    for (const poly of allLandPolys) {
      g.lineStyle(4, PALETTE.SKY_LIGHT, 0.78);
      drawPoly(poly);
      g.strokePath();
    }

    // 3. Non-Playable Highland Border Regions: Scotland & Wales
    const drawHighlandRegion = (pts: MapPoint[]) => {
      g.fillStyle(0x474952, 1);
      drawPoly(pts);
      g.fillPath();

      g.lineStyle(4, 0x33353d, 0.65);
      drawPoly(pts);
      g.strokePath();

      g.lineStyle(2, 0x1d1e24, 0.95);
      drawPoly(pts);
      g.strokePath();
    };

    drawHighlandRegion(SCOTLAND_POLYGON);
    drawHighlandRegion(WALES_POLYGON);

    // Shaded Mountain Peaks on Scotland & Wales
    const drawMountainPeak = (mx: number, my: number, scale = 1) => {
      const halfW = Math.round(13 * scale);
      const peakH = Math.round(14 * scale);
      // Left lit slope
      g.fillStyle(PALETTE.STONE_LIGHT, 0.85);
      g.fillTriangle(mx, my - peakH, mx - halfW, my + 4, mx, my + 4);
      // Right shaded slope
      g.fillStyle(0x34363e, 0.9);
      g.fillTriangle(mx, my - peakH, mx, my + 4, mx + halfW, my + 4);
      // Snow / stone ridge outline
      g.lineStyle(1.2, 0x1b1c22, 0.85);
      g.lineBetween(mx, my - peakH, mx - halfW, my + 4);
      g.lineBetween(mx, my - peakH, mx + halfW, my + 4);
    };

    drawMountainPeak(286, 72, 1.0);
    drawMountainPeak(334, 66, 1.15);
    drawMountainPeak(388, 70, 0.95);
    drawMountainPeak(178, 356, 1.0);
    drawMountainPeak(202, 396, 1.1);
    drawMountainPeak(184, 444, 0.95);

    // 4. Subtle Cartographic Wave Lines in Open Sea
    const wavePositions: Array<[number, number]> = [
      [84, 134], [134, 210], [88, 272], [68, 520],
      [604, 206], [678, 276], [648, 326], [732, 514],
      [684, 636], [442, 646], [296, 652],
    ];
    for (const [wx, wy] of wavePositions) {
      g.lineStyle(1.5, PALETTE.SKY_LIGHT, 0.45);
      g.lineBetween(wx, wy, wx + 18, wy);
      g.lineStyle(1.2, PALETTE.SKY_MID, 0.55);
      g.lineBetween(wx + 5, wy + 5, wx + 22, wy + 5);
    }

    // 5. Ornate Cartographic Compass Rose (Top-Right North Sea: 672, 118)
    const cx = 672;
    const cy = 118;
    g.fillStyle(PALETTE.SHADOW, 0.55);
    g.fillCircle(cx + 2, cy + 2, 34);
    g.lineStyle(1.5, PALETTE.GOLD_DARK, 0.9);
    g.strokeCircle(cx, cy, 32);
    g.strokeCircle(cx, cy, 24);
    // Minor intercardinal points
    g.fillStyle(PALETTE.GOLD_DARK, 0.75);
    g.fillTriangle(cx - 18, cy - 18, cx - 4, cy, cx, cy - 4);
    g.fillTriangle(cx + 18, cy - 18, cx + 4, cy, cx, cy - 4);
    g.fillTriangle(cx - 18, cy + 18, cx - 4, cy, cx, cy + 4);
    g.fillTriangle(cx + 18, cy + 18, cx + 4, cy, cx, cy + 4);
    // Cardinal points
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillTriangle(cx, cy - 40, cx - 7, cy - 6, cx + 7, cy - 6);
    g.fillStyle(PALETTE.GOLD_DARK, 1);
    g.fillTriangle(cx, cy + 36, cx - 6, cy + 6, cx + 6, cy + 6);
    g.fillTriangle(cx - 36, cy, cx - 6, cy - 6, cx - 6, cy + 6);
    g.fillTriangle(cx + 36, cy, cx + 6, cy - 6, cx + 6, cy + 6);
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillCircle(cx, cy, 5);
    g.lineStyle(1, PALETTE.GOLD_BRIGHT, 1);
    g.strokeCircle(cx, cy, 5);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Generates crisp retro pixel-art Castle, Royal Home Castle, and Sherwood Forest icons (NEAREST filter).
   */
  public static createMapIcons(scene: Phaser.Scene): void {
    // 1. Standard Fortified Castle Icon (24x24)
    if (!scene.textures.exists('icon_castle')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 0.92);
      g.fillRect(2, 5, 20, 17);

      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(3, 9, 18, 12);

      // Battlements
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(3, 6, 4, 4);
      g.fillRect(10, 6, 4, 4);
      g.fillRect(17, 6, 4, 4);

      // Left highlight & right shadow
      g.fillRect(3, 9, 3, 12);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(18, 9, 3, 12);

      // Gate & torchlit slits
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(9, 14, 6, 7);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(6, 11, 2, 3);
      g.fillRect(16, 11, 2, 3);

      g.generateTexture('icon_castle', 24, 24);
      g.destroy();
      this.markNearest(scene, 'icon_castle');
    }

    // 2. Home Castle Icon with Royal Gold Pennant (28x30)
    if (!scene.textures.exists('icon_home_castle')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Flagpole & Royal Pennant
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(13, 1, 2, 9);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(15, 2, 9, 6);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(15, 4, 6, 2);

      // Castle Shadow / Border
      g.fillStyle(PALETTE.BLACK, 0.95);
      g.fillRect(2, 9, 24, 19);

      // Keep Body
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(3, 13, 22, 14);

      // Battlements
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(3, 10, 5, 4);
      g.fillRect(11, 10, 6, 4);
      g.fillRect(20, 10, 5, 4);
      g.fillRect(3, 13, 3, 14);

      // Royal Gold Band
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(3, 15, 22, 2);

      // Right Shadow
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(22, 13, 3, 14);

      // Gatehouse & Windows
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(11, 19, 6, 8);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(6, 18, 2, 3);
      g.fillRect(20, 18, 2, 3);

      g.generateTexture('icon_home_castle', 28, 30);
      g.destroy();
      this.markNearest(scene, 'icon_home_castle');
    }

    // 3. Sherwood Forest Great Oak & Longbow Icon (28x28)
    if (!scene.textures.exists('icon_sherwood')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 0.85);
      g.fillCircle(14, 14, 12);

      g.fillStyle(PALETTE.FOLIAGE_MID, 1);
      g.fillCircle(14, 11, 9);
      g.fillCircle(9, 13, 7);
      g.fillCircle(19, 13, 7);
      g.fillStyle(PALETTE.FOLIAGE_LIGHT, 1);
      g.fillCircle(11, 9, 5);
      g.fillRect(15, 7, 4, 4);

      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(11, 17, 6, 8);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(13, 17, 2, 8);

      g.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      g.beginPath();
      g.arc(13, 14, 8, -1.1, 1.1, false);
      g.strokePath();
      g.lineStyle(1, PALETTE.PARCHMENT_LIGHT, 0.95);
      g.lineBetween(16, 7, 16, 21);

      g.generateTexture('icon_sherwood', 28, 28);
      g.destroy();
      this.markNearest(scene, 'icon_sherwood');
    }
  }

  /**
   * Initializes all procedural art textures at boot time.
   */
  public static generateAll(scene: Phaser.Scene): void {
    this.createTitleBackdrop(scene);
    this.createBritainMapBackdrop(scene);
    this.createMapIcons(scene);
    this.createLordPortraits(scene);

    // Saxon Lord Shields
    this.createHeraldicShield(scene, 'shield_ivanhoe', PALETTE.BLOOD_RED, PALETTE.GOLD_BRIGHT, PALETTE.PARCHMENT_LIGHT, 'cross');
    this.createHeraldicShield(scene, 'shield_cedric', PALETTE.FOLIAGE_MID, PALETTE.GOLD_BRIGHT, PALETTE.WOOD_DARK, 'boar');
    this.createHeraldicShield(scene, 'shield_geoffrey', PALETTE.ROYAL_BLUE, PALETTE.STONE_LIGHT, PALETTE.GOLD_DARK, 'sword');
    this.createHeraldicShield(scene, 'shield_wolfric', PALETTE.WOOD_MID, PALETTE.PARCHMENT_LIGHT, PALETTE.STONE_DARK, 'wolf');

    // Norman Lord Shields
    this.createHeraldicShield(scene, 'shield_malvoisin', PALETTE.STONE_DARK, PALETTE.BLOOD_RED, PALETTE.GOLD_DARK, 'falcon');
    this.createHeraldicShield(scene, 'shield_frontdeboeuf', PALETTE.BLACK, PALETTE.GOLD_DARK, PALETTE.BLOOD_RED, 'axe');
    this.createHeraldicShield(scene, 'shield_boisguilbert', PALETTE.STONE_LIGHT, PALETTE.BLOOD_RED, PALETTE.BLACK, 'lion');
  }
}
