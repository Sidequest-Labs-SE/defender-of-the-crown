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

    // 5. Malvoisin (Norman Baron of Norfolk — dark crimson velvet & pointed beard)
    if (!scene.textures.exists('portrait_malvoisin')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x2c1518, 0x180a0d);

      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(11, 42, 42, 20);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(16, 40, 32, 22);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(20, 40, 24, 4);

      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(22, 17, 20, 21);

      // Dark nobleman cap & sleek hair
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(19, 10, 26, 8);
      g.fillRect(19, 16, 4, 16);
      g.fillRect(41, 16, 4, 16);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(21, 9, 22, 4);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(39, 8, 4, 5);

      // Arched scheming brows & piercing dark eyes
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(23, 20, 7, 2);
      g.fillRect(34, 19, 7, 2);
      g.fillRect(25, 23, 3, 3);
      g.fillRect(36, 23, 3, 3);

      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 23, 3, 7);

      // Pointed goatee & moustache
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(26, 32, 12, 2);
      g.fillRect(29, 34, 6, 7);

      g.generateTexture('portrait_malvoisin', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_malvoisin');
    }

    // 6. Front-de-Boeuf (Brutal Iron-Helmed Norman Warlord)
    if (!scene.textures.exists('portrait_frontdeboeuf')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x261a1a, 0x120c0c);

      // Heavy black-iron plate shoulders
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(9, 41, 46, 21);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(12, 39, 40, 8);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(24, 45, 16, 17);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(29, 45, 6, 17);

      // Stern weathered face beneath iron nasal helm
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(20, 19, 24, 20);

      // Conical iron helm + nasal bar
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(18, 9, 28, 12);
      g.fillRect(16, 18, 5, 20);
      g.fillRect(43, 18, 5, 20);
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(22, 10, 20, 4);
      g.fillRect(30, 19, 4, 11); // Nasal guard

      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(24, 24, 4, 3);
      g.fillRect(36, 24, 4, 3);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(21, 33, 22, 9);

      g.generateTexture('portrait_frontdeboeuf', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_frontdeboeuf');
    }

    // 7. Bois-Guilbert (Templar Preceptor — white mantle & crimson cross)
    if (!scene.textures.exists('portrait_boisguilbert')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x2a1f2d, 0x161019);

      // White Templar surcoat with Blood Red Cross
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(11, 41, 42, 21);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(29, 43, 6, 19);
      g.fillRect(22, 48, 20, 5);

      // Chainmail coif framing face
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(17, 10, 30, 31);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(20, 11, 24, 5);

      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(22, 18, 20, 19);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(23, 20, 7, 2);
      g.fillRect(34, 20, 7, 2);
      g.fillRect(25, 23, 3, 3);
      g.fillRect(36, 23, 3, 3);

      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 23, 3, 7);

      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(26, 32, 12, 3);

      g.generateTexture('portrait_boisguilbert', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_boisguilbert');
    }

    // 8. Garrison Captain Fallback Portrait
    if (!scene.textures.exists('portrait_garrison')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawPortraitFrame(g, 0x222630, 0x14171f);

      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(13, 42, 38, 20);
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(22, 19, 20, 18);

      // Steel kettle hat
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(18, 11, 28, 8);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(14, 17, 36, 4);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(25, 24, 3, 3);
      g.fillRect(36, 24, 3, 3);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(26, 32, 12, 3);

      g.generateTexture('portrait_garrison', size, size);
      g.destroy();
      this.markNearest(scene, 'portrait_garrison');
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
   * Generates smooth 1280x490 HD painted English battlefield backdrops (Field & Castle Siege).
   */
  public static createBattleBackdrops(scene: Phaser.Scene): void {
    const buildBackdrop = (key: string, includeCastle: boolean) => {
      if (scene.textures.exists(key)) return;

      const w = 1280;
      const h = 490;
      const g = scene.make.graphics({ x: 0, y: 0 });

      // 1. Dramatic English Sky Gradient (Smooth HD, zero dithering)
      this.drawSmoothVerticalGradient(g, 0, 0, w, 92, 0x1b2f52, PALETTE.SKY_MID, 32);
      this.drawSmoothVerticalGradient(g, 0, 90, w, 78, PALETTE.SKY_MID, PALETTE.SKY_LIGHT, 28);
      this.drawSmoothVerticalGradient(g, 0, 166, w, 46, PALETTE.SKY_LIGHT, 0xd8d2be, 20);

      // Soft sunlit horizon cloud banks
      const clouds: Array<[number, number, number, number]> = [
        [210, 96, 95, 22],
        [520, 78, 120, 26],
        [860, 102, 108, 22],
        [1110, 84, 86, 20],
      ];
      for (const [cx, cy, cw, ch] of clouds) {
        g.fillStyle(PALETTE.PARCHMENT_LIGHT, 0.26);
        g.fillEllipse(cx, cy, cw * 2, ch * 2);
        g.fillStyle(0xffffff, 0.18);
        g.fillEllipse(cx - 14, cy - 5, cw * 1.4, ch * 1.3);
      }

      // 2. Distant Misty Pennine / Cotswold Ridges
      g.fillStyle(0x3b5856, 1);
      g.beginPath();
      g.moveTo(0, 198);
      g.lineTo(190, 164);
      g.lineTo(430, 188);
      g.lineTo(690, 156);
      g.lineTo(960, 184);
      g.lineTo(1160, 158);
      g.lineTo(w, 178);
      g.lineTo(w, 240);
      g.lineTo(0, 240);
      g.closePath();
      g.fillPath();

      // Midground Wooded Hills
      g.fillStyle(0x28542a, 1);
      g.beginPath();
      g.moveTo(0, 214);
      g.lineTo(260, 192);
      g.lineTo(560, 212);
      g.lineTo(880, 190);
      g.lineTo(w, 208);
      g.lineTo(w, 260);
      g.lineTo(0, 260);
      g.closePath();
      g.fillPath();

      // Distant English Oak Treeline Silhouettes
      const treeClusters = includeCastle
        ? [72, 145, 290, 415, 595, 760, 885]
        : [72, 145, 290, 415, 595, 760, 910, 1055, 1190];
      for (const tx of treeClusters) {
        g.fillStyle(PALETTE.FOLIAGE_DARK, 0.95);
        g.fillCircle(tx, 196, 13);
        g.fillCircle(tx - 10, 201, 10);
        g.fillCircle(tx + 10, 201, 10);
        g.fillStyle(PALETTE.FOLIAGE_MID, 0.55);
        g.fillCircle(tx - 3, 192, 8);
      }

      // Optional Fortified Stone Castle on Defender's Ridge (Right, x: 1028..1262)
      if (includeCastle) {
        // Raised stone escarpment
        g.fillStyle(0x2c4228, 1);
        g.beginPath();
        g.moveTo(965, 224);
        g.lineTo(1035, 184);
        g.lineTo(1280, 180);
        g.lineTo(1280, 245);
        g.closePath();
        g.fillPath();

        // Outer Curtain Wall & Towers
        g.fillStyle(PALETTE.STONE_DARK, 1);
        g.fillRect(1042, 128, 210, 74);

        // Left Gate Tower
        g.fillStyle(PALETTE.STONE_MID, 1);
        g.fillRect(1034, 98, 48, 104);
        g.fillStyle(PALETTE.STONE_LIGHT, 1);
        for (let bx = 1034; bx < 1080; bx += 14) {
          g.fillRect(bx, 90, 9, 9);
        }

        // Great Keep Tower
        g.fillStyle(PALETTE.STONE_MID, 1);
        g.fillRect(1148, 76, 68, 126);
        g.fillStyle(PALETTE.STONE_LIGHT, 1);
        for (let bx = 1148; bx < 1214; bx += 16) {
          g.fillRect(bx, 66, 10, 11);
        }
        g.fillRect(1148, 76, 7, 126);

        // Curtain Wall Battlements
        for (let wx = 1086; wx < 1144; wx += 14) {
          g.fillRect(wx, 120, 9, 9);
        }
        for (let wx = 1220; wx < 1256; wx += 14) {
          g.fillRect(wx, 120, 9, 9);
        }

        // Portcullis Arch & Torchlit Slits
        g.fillStyle(PALETTE.BLACK, 1);
        g.fillRect(1098, 158, 32, 44);
        g.fillStyle(PALETTE.STONE_LIGHT, 0.7);
        for (let px = 1104; px <= 1124; px += 6) {
          g.fillRect(px, 162, 2, 40);
        }
        g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
        g.fillRect(1054, 124, 5, 14);
        g.fillRect(1176, 104, 6, 16);
        g.fillRect(1176, 134, 6, 16);

        // Pennant atop Great Keep
        g.fillStyle(PALETTE.WOOD_DARK, 1);
        g.fillRect(1180, 38, 4, 30);
        g.fillStyle(PALETTE.BLOOD_RED, 1);
        g.fillTriangle(1180, 40, 1142, 50, 1180, 60);
      }

      // 3. Main Battlefield Meadow & Subtle Tactical Lane Bands (y: 218..490)
      this.drawSmoothVerticalGradient(g, 0, 218, w, 272, 0x3b7234, 0x244c22, 44);

      // Subtle sunlit turf bands for Upper Flank, Center Melee Road, and Lower Flank
      g.fillStyle(PALETTE.FOLIAGE_LIGHT, 0.14);
      g.fillRect(0, 224, w, 46); // Upper cavalry flank turf
      g.fillStyle(0x8a6d3b, 0.18);
      g.fillRect(0, 286, w, 104); // Trampled central melee ground
      g.fillStyle(PALETTE.FOLIAGE_LIGHT, 0.12);
      g.fillRect(0, 408, w, 54); // Lower cavalry flank turf

      // Defensive wooden palisade stakes on Siege backdrop
      if (includeCastle) {
        for (let sy = 236; sy <= 456; sy += 28) {
          const sx = 1095 + ((sy / 28) % 2) * 8;
          g.fillStyle(PALETTE.WOOD_DARK, 0.9);
          g.fillTriangle(sx + 10, sy + 8, sx - 6, sy - 4, sx + 4, sy + 8);
          g.fillStyle(PALETTE.WOOD_MID, 0.9);
          g.fillTriangle(sx + 6, sy + 12, sx - 8, sy, sx + 1, sy + 12);
        }
      }

      g.generateTexture(key, w, h);
      g.destroy();
    };

    buildBackdrop('battle_bg_field', false);
    buildBackdrop('battle_bg_siege', true);
  }

  /**
   * Generates crisp NEAREST-filtered retro pixel-art battlefield sprites:
   * Men-at-Arms, Mounted Knights, Catapults, Banners, Boulders, and Clash Sparks.
   */
  public static createBattleUnitSprites(scene: Phaser.Scene): void {
    const themes: Array<{
      id: 'saxon' | 'norman' | 'rival_saxon';
      primary: number;
      trim: number;
      plume: number;
    }> = [
      {
        id: 'saxon',
        primary: PALETTE.ROYAL_BLUE,
        trim: PALETTE.GOLD_BRIGHT,
        plume: PALETTE.GOLD_BRIGHT,
      },
      {
        id: 'norman',
        primary: PALETTE.BLOOD_RED,
        trim: PALETTE.STONE_LIGHT,
        plume: PALETTE.BLOOD_RED,
      },
      {
        id: 'rival_saxon',
        primary: PALETTE.FOLIAGE_MID,
        trim: PALETTE.GOLD_DARK,
        plume: PALETTE.PARCHMENT_LIGHT,
      },
    ];

    for (const th of themes) {
      // 1. Men-at-Arms Infantry (24x28, 2 frames: 0=march, 1=thrust)
      for (const frame of [0, 1] as const) {
        const key = `unit_soldier_${th.id}_${frame}`;
        if (!scene.textures.exists(key)) {
          const g = scene.make.graphics({ x: 0, y: 0 });

          // Ground shadow
          g.fillStyle(PALETTE.BLACK, 0.45);
          g.fillEllipse(11, 26, 14, 4);

          // Boots & Legs (striding in frame 1)
          g.fillStyle(PALETTE.WOOD_DARK, 1);
          if (frame === 0) {
            g.fillRect(7, 20, 3, 6);
            g.fillRect(12, 20, 3, 6);
          } else {
            g.fillRect(5, 20, 3, 6);
            g.fillRect(14, 19, 3, 7);
          }

          // Chainmail hauberk & Heraldic Surcoat
          g.fillStyle(PALETTE.STONE_DARK, 1);
          g.fillRect(6, 10, 10, 11);
          g.fillStyle(th.primary, 1);
          g.fillRect(7, 11, 8, 9);
          g.fillStyle(th.trim, 1);
          g.fillRect(10, 11, 2, 9);

          // Face & Conical Steel Nasal Helm
          g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
          g.fillRect(8, 6, 6, 4);
          g.fillStyle(PALETTE.STONE_MID, 1);
          g.fillRect(7, 2, 8, 5);
          g.fillStyle(PALETTE.STONE_LIGHT, 1);
          g.fillRect(8, 2, 3, 4);
          g.fillRect(13, 6, 1, 3); // Nasal bar

          // Heater Shield
          g.fillStyle(PALETTE.BLACK, 1);
          g.fillRect(4, 11, 6, 8);
          g.fillStyle(th.primary, 1);
          g.fillRect(5, 12, 4, 6);
          g.fillStyle(th.trim, 1);
          g.fillRect(6, 13, 2, 4);

          // Broadsword / Spear (upright in frame 0, lunging forward in frame 1)
          if (frame === 0) {
            g.fillStyle(PALETTE.WOOD_MID, 1);
            g.fillRect(15, 13, 3, 2);
            g.fillStyle(PALETTE.STONE_LIGHT, 1);
            g.fillRect(16, 3, 2, 10);
            g.fillStyle(0xffffff, 1);
            g.fillRect(16, 3, 1, 6);
          } else {
            g.fillStyle(PALETTE.GOLD_DARK, 1);
            g.fillRect(15, 12, 2, 4);
            g.fillStyle(PALETTE.STONE_LIGHT, 1);
            g.fillRect(17, 13, 7, 2);
            g.fillStyle(0xffffff, 1);
            g.fillRect(18, 13, 5, 1);
          }

          g.generateTexture(key, 24, 28);
          g.destroy();
          this.markNearest(scene, key);
        }
      }

      // 2. Mounted Knights on Warhorse (36x32, 2 frames: 0=trot, 1=couched lance charge)
      for (const frame of [0, 1] as const) {
        const key = `unit_knight_${th.id}_${frame}`;
        if (!scene.textures.exists(key)) {
          const g = scene.make.graphics({ x: 0, y: 0 });

          // Shadow
          g.fillStyle(PALETTE.BLACK, 0.45);
          g.fillEllipse(16, 29, 24, 5);

          // Destrier Warhorse Legs
          g.fillStyle(PALETTE.WOOD_DARK, 1);
          if (frame === 0) {
            g.fillRect(7, 22, 3, 8);
            g.fillRect(12, 23, 2, 6);
            g.fillRect(20, 22, 3, 8);
            g.fillRect(24, 23, 2, 6);
          } else {
            // Full gallop extension
            g.fillRect(4, 23, 4, 6);
            g.fillRect(9, 22, 3, 6);
            g.fillRect(22, 21, 3, 6);
            g.fillRect(26, 22, 4, 6);
          }

          // Horse Body & Flowing Tail
          g.fillStyle(PALETTE.WOOD_MID, 1);
          g.fillRect(6, 15, 20, 8);
          g.fillRect(22, 10, 6, 8); // Neck
          g.fillRect(25, 9, 5, 5);  // Head
          g.fillStyle(PALETTE.BLACK, 1);
          g.fillRect(3, 15, 3, 7);  // Tail

          // Heraldic Caparison (Barding Cloth)
          g.fillStyle(th.primary, 1);
          g.fillRect(7, 16, 18, 7);
          g.fillStyle(th.trim, 1);
          g.fillRect(7, 21, 18, 2);
          g.fillStyle(PALETTE.STONE_LIGHT, 1);
          g.fillRect(26, 9, 4, 3); // Steel chanfron on horse head

          // Armored Knight Rider & Plumed Great-Helm
          g.fillStyle(PALETTE.STONE_MID, 1);
          g.fillRect(12, 7, 7, 10);
          g.fillStyle(th.primary, 1);
          g.fillRect(13, 9, 5, 7);
          g.fillStyle(PALETTE.STONE_LIGHT, 1);
          g.fillRect(13, 3, 6, 6); // Great helm
          g.fillStyle(PALETTE.BLACK, 1);
          g.fillRect(16, 5, 3, 1); // Visor slit
          g.fillStyle(th.plume, 1);
          g.fillRect(10, 2, 4, 3); // Crest plume

          // Knight Shield
          g.fillStyle(th.primary, 1);
          g.fillRect(12, 10, 5, 6);
          g.fillStyle(th.trim, 1);
          g.fillRect(14, 11, 2, 4);

          // War Lance & Fluttering Pennant
          if (frame === 0) {
            g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
            g.fillRect(17, 2, 2, 15);
            g.fillStyle(th.primary, 1);
            g.fillRect(19, 3, 5, 3);
          } else {
            g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
            g.fillRect(15, 12, 20, 2);
            g.fillStyle(PALETTE.GOLD_DARK, 1);
            g.fillRect(18, 11, 3, 4); // Vamplate handguard
            g.fillStyle(th.primary, 1);
            g.fillRect(28, 9, 6, 3);  // Lance pennant
          }

          g.generateTexture(key, 36, 32);
          g.destroy();
          this.markNearest(scene, key);
        }
      }

      // 3. Siege Catapult (38x30, 2 frames: 0=loaded, 1=fired)
      for (const frame of [0, 1] as const) {
        const key = `unit_catapult_${th.id}_${frame}`;
        if (!scene.textures.exists(key)) {
          const g = scene.make.graphics({ x: 0, y: 0 });

          g.fillStyle(PALETTE.BLACK, 0.45);
          g.fillEllipse(19, 27, 30, 5);

          // Heavy Timber Chassis
          g.fillStyle(PALETTE.WOOD_DARK, 1);
          g.fillRect(4, 20, 28, 5);
          g.fillStyle(PALETTE.WOOD_MID, 1);
          g.fillRect(5, 21, 26, 2);

          // Throwing Arm (Drawn back with boulder in frame 0; Upright fired in frame 1)
          if (frame === 0) {
            g.fillStyle(PALETTE.WOOD_MID, 1);
            g.beginPath();
            g.moveTo(20, 18);
            g.lineTo(5, 9);
            g.lineTo(7, 7);
            g.lineTo(22, 16);
            g.closePath();
            g.fillPath();

            // Loaded granite boulder
            g.fillStyle(PALETTE.STONE_MID, 1);
            g.fillCircle(6, 7, 4);
            g.fillStyle(PALETTE.STONE_LIGHT, 1);
            g.fillRect(4, 5, 3, 2);
          } else {
            g.fillStyle(PALETTE.WOOD_MID, 1);
            g.fillRect(19, 3, 3, 16);
            g.fillStyle(PALETTE.WOOD_DARK, 1);
            g.fillRect(17, 2, 7, 4); // Empty spoon
          }

          // A-Frame Upright Stanchion & Faction Banner
          g.fillStyle(PALETTE.WOOD_DARK, 1);
          g.fillTriangle(18, 9, 11, 21, 25, 21);
          g.fillStyle(th.primary, 1);
          g.fillRect(16, 13, 5, 6);
          g.fillStyle(th.trim, 1);
          g.fillRect(17, 14, 3, 2);

          // Iron-rimmed Spoked Wheels
          for (const wx of [9, 26]) {
            g.fillStyle(PALETTE.STONE_DARK, 1);
            g.fillCircle(wx, 24, 5);
            g.fillStyle(PALETTE.WOOD_MID, 1);
            g.fillCircle(wx, 24, 3);
            g.fillStyle(PALETTE.STONE_LIGHT, 1);
            g.fillRect(wx - 1, 23, 2, 2);
          }

          g.generateTexture(key, 38, 30);
          g.destroy();
          this.markNearest(scene, key);
        }
      }

      // 4. Battlefield Standard / Heraldic Pennant Banner (20x36)
      const bannerKey = `unit_banner_${th.id}`;
      if (!scene.textures.exists(bannerKey)) {
        const g = scene.make.graphics({ x: 0, y: 0 });
        g.fillStyle(PALETTE.GOLD_DARK, 1);
        g.fillRect(3, 2, 2, 33);
        g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
        g.fillRect(2, 1, 4, 3);

        // Forked War Banner
        g.fillStyle(th.primary, 1);
        g.fillRect(5, 4, 13, 11);
        g.fillTriangle(18, 4, 14, 9, 18, 9);
        g.fillTriangle(18, 10, 14, 10, 18, 15);
        g.fillStyle(th.trim, 1);
        g.fillRect(5, 4, 12, 2);
        g.fillRect(8, 8, 5, 3);

        g.generateTexture(bannerKey, 20, 36);
        g.destroy();
        this.markNearest(scene, bannerKey);
      }
    }

    // 5. Stone Catapult Boulder Projectile (12x12, NEAREST)
    if (!scene.textures.exists('proj_boulder')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillCircle(6, 6, 5);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillCircle(6, 6, 4);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(4, 3, 3, 3);
      g.generateTexture('proj_boulder', 12, 12);
      g.destroy();
      this.markNearest(scene, 'proj_boulder');
    }

    // 6. Sword-on-Shield Clash Spark (12x12, NEAREST)
    if (!scene.textures.exists('fx_clash_spark')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(5, 1, 2, 10);
      g.fillRect(1, 5, 10, 2);
      g.fillRect(3, 3, 6, 6);
      g.fillStyle(0xffffff, 1);
      g.fillRect(4, 4, 4, 4);
      g.generateTexture('fx_clash_spark', 12, 12);
      g.destroy();
      this.markNearest(scene, 'fx_clash_spark');
    }
  }

  /**
   * Generates the smooth, dither-free 1280x510 1986-homage Catapult Siege panorama backdrop
   * (atmospheric English sky, distant ridges, castle hill escarpment, and rolling green foreground turf).
   */
  public static createSiegeSkyAndHillsBackdrop(scene: Phaser.Scene): void {
    const key = 'siege_bg_landscape';
    if (scene.textures.exists(key)) return;

    const w = 1280;
    const h = 510;
    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Smooth Atmospheric English Sky (Zero dithering)
    this.drawSmoothVerticalGradient(g, 0, 0, w, 96, 0x162b4d, 0x3b67a4, 34);
    this.drawSmoothVerticalGradient(g, 0, 94, w, 86, 0x3b67a4, PALETTE.SKY_LIGHT, 30);
    this.drawSmoothVerticalGradient(g, 0, 178, w, 64, PALETTE.SKY_LIGHT, 0xd8d3bf, 24);

    // 2. Distant Blue-Grey Mountain Ranges (Left & Right flanking the Castle Hill)
    g.fillStyle(0x3a545b, 1);
    g.beginPath();
    g.moveTo(0, 224);
    g.lineTo(130, 176);
    g.lineTo(275, 202);
    g.lineTo(440, 168);
    g.lineTo(640, 198);
    g.lineTo(860, 166);
    g.lineTo(1060, 196);
    g.lineTo(1195, 172);
    g.lineTo(w, 194);
    g.lineTo(w, 275);
    g.lineTo(0, 275);
    g.closePath();
    g.fillPath();

    // Mid-distance wooded hills
    g.fillStyle(0x254d29, 1);
    g.beginPath();
    g.moveTo(0, 248);
    g.lineTo(190, 222);
    g.lineTo(420, 242);
    g.lineTo(640, 218);
    g.lineTo(870, 240);
    g.lineTo(1110, 220);
    g.lineTo(w, 238);
    g.lineTo(w, 300);
    g.lineTo(0, 300);
    g.closePath();
    g.fillPath();

    // Distant treeline silhouettes flanking castle hill
    const treeX = [56, 118, 195, 282, 356, 922, 998, 1084, 1168, 1230];
    for (const tx of treeX) {
      const ty = tx < 500 ? 228 + (tx % 14) : 226 + (tx % 12);
      g.fillStyle(PALETTE.FOLIAGE_DARK, 0.95);
      g.fillCircle(tx, ty, 13);
      g.fillCircle(tx - 10, ty + 4, 10);
      g.fillCircle(tx + 10, ty + 4, 10);
      g.fillStyle(PALETTE.FOLIAGE_MID, 0.5);
      g.fillCircle(tx - 3, ty - 3, 7);
    }

    // 3. Raised Castle Hilltop Escarpment (Center x: 350..930, crest y: 238)
    g.fillStyle(0x2f5e2c, 1);
    g.beginPath();
    g.moveTo(220, 312);
    g.lineTo(435, 238);
    g.lineTo(845, 238);
    g.lineTo(1060, 312);
    g.closePath();
    g.fillPath();

    // Exposed limestone crag outcrops beneath castle foundation
    g.fillStyle(PALETTE.STONE_DARK, 0.72);
    g.fillTriangle(456, 242, 434, 262, 488, 256);
    g.fillTriangle(792, 242, 768, 258, 836, 262);

    // 4. Iconic Rolling Green English Siege Slope (y: 256..510)
    this.drawSmoothVerticalGradient(g, 0, 268, w, 242, 0x457d3b, 0x1f4720, 48);

    // Soft curved hillside turf contours for depth perspective
    g.fillStyle(PALETTE.FOLIAGE_LIGHT, 0.18);
    g.beginPath();
    g.moveTo(0, 305);
    g.lineTo(430, 252);
    g.lineTo(850, 252);
    g.lineTo(w, 305);
    g.lineTo(w, 336);
    g.lineTo(830, 278);
    g.lineTo(450, 278);
    g.lineTo(0, 336);
    g.closePath();
    g.fillPath();

    // Subtle trampled earthen siege approach road narrowing into perspective toward castle gate
    g.fillStyle(0x7c633b, 0.28);
    g.beginPath();
    g.moveTo(520, 510);
    g.lineTo(608, 244);
    g.lineTo(672, 244);
    g.lineTo(760, 510);
    g.closePath();
    g.fillPath();

    // Foreground grassy crest where Catapult, Guards & Greek Fire Pots stand (y: 418..510)
    g.fillStyle(0x1b3d1c, 0.88);
    g.beginPath();
    g.moveTo(0, 432);
    g.lineTo(340, 414);
    g.lineTo(640, 424);
    g.lineTo(940, 414);
    g.lineTo(w, 432);
    g.lineTo(w, 510);
    g.lineTo(0, 510);
    g.closePath();
    g.fillPath();

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Generates crisp NEAREST-filtered retro pixel-art Siege Sprites:
   * Multi-part Catapult frame & arm, winch wheel, flanking Men-at-Arms sentries,
   * Greek Fire pots, Disease barrels, Boulder pile, 3 Siege Projectiles, and Stone Debris.
   */
  public static createSiegeSprites(scene: Phaser.Scene): void {
    // 1. Multi-Part Wooden Siege Catapult Base (132x76, NEAREST)
    if (!scene.textures.exists('siege_catapult_base')) {
      const g = scene.make.graphics({ x: 0, y: 0 });

      // Ground shadow
      g.fillStyle(PALETTE.BLACK, 0.55);
      g.fillEllipse(66, 68, 118, 14);

      // Heavy Horizontal Oak Chassis Beams
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(14, 49, 104, 15);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(16, 51, 100, 11);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(18, 52, 96, 4);

      // Angled A-Frame Timber Stanchions & Upright Crossbar Stop
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.beginPath();
      g.moveTo(34, 52);
      g.lineTo(58, 14);
      g.lineTo(68, 14);
      g.lineTo(44, 52);
      g.closePath();
      g.fillPath();

      g.beginPath();
      g.moveTo(92, 52);
      g.lineTo(68, 14);
      g.lineTo(58, 14);
      g.lineTo(82, 52);
      g.closePath();
      g.fillPath();

      // Padded Crossbeam Impact Stop Block
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(54, 10, 18, 10);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(53, 10, 4, 10);
      g.fillRect(69, 10, 4, 10);

      // Iron Rivet Plates
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(22, 52, 6, 9);
      g.fillRect(60, 52, 8, 9);
      g.fillRect(102, 52, 6, 9);

      // Twin Iron-Shod Spoked Siege Wheels
      for (const wx of [30, 98]) {
        g.fillStyle(PALETTE.BLACK, 1);
        g.fillCircle(wx, 60, 13);
        g.fillStyle(PALETTE.STONE_DARK, 1);
        g.fillCircle(wx, 60, 11);
        g.fillStyle(PALETTE.WOOD_DARK, 1);
        g.fillCircle(wx, 60, 9);
        g.fillStyle(PALETTE.WOOD_MID, 1);
        g.fillRect(wx - 8, 59, 16, 2);
        g.fillRect(wx - 1, 52, 2, 16);
        g.fillStyle(PALETTE.STONE_LIGHT, 1);
        g.fillRect(wx - 2, 58, 4, 4);
      }

      g.generateTexture('siege_catapult_base', 132, 76);
      g.destroy();
      this.markNearest(scene, 'siege_catapult_base');
    }

    // 2. Pivoting Catapult Throwing Arm + Cupped Spoon (96x28, NEAREST; pivot near right end x=84,y=14)
    if (!scene.textures.exists('siege_catapult_arm')) {
      const g = scene.make.graphics({ x: 0, y: 0 });

      // Arm beam
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(18, 9, 72, 10);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(19, 10, 70, 8);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(19, 11, 68, 3);

      // Iron reinforcement bands
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(36, 9, 4, 10);
      g.fillRect(60, 9, 4, 10);
      g.fillRect(80, 8, 8, 12);

      // Heavy Cupped Wooden Spoon / Bucket at left tip (x: 4..22, y: 4..22)
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(3, 5, 19, 16);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(5, 7, 15, 12);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(6, 7, 13, 4);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(4, 11, 3, 7);

      g.generateTexture('siege_catapult_arm', 96, 28);
      g.destroy();
      this.markNearest(scene, 'siege_catapult_arm');
    }

    // 3. Rotating Wooden Winch Capstan Wheel (28x28, NEAREST)
    if (!scene.textures.exists('siege_winch_wheel')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillCircle(14, 14, 11);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillCircle(14, 14, 9);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(2, 13, 24, 2);
      g.fillRect(13, 2, 2, 24);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillCircle(14, 14, 4);
      g.generateTexture('siege_winch_wheel', 28, 28);
      g.destroy();
      this.markNearest(scene, 'siege_winch_wheel');
    }

    // 4. Flanking Foreground Men-at-Arms Guards with Tall Spears & Shields (44x68, NEAREST)
    const guardThemes: Array<{
      key: string;
      primary: number;
      secondary: number;
    }> = [
      {
        key: 'siege_guard_saxon',
        primary: PALETTE.ROYAL_BLUE,
        secondary: PALETTE.GOLD_BRIGHT,
      },
      {
        key: 'siege_guard_norman',
        primary: PALETTE.BLOOD_RED,
        secondary: PALETTE.STONE_LIGHT,
      },
    ];

    for (const gt of guardThemes) {
      if (!scene.textures.exists(gt.key)) {
        const g = scene.make.graphics({ x: 0, y: 0 });

        // Shadow
        g.fillStyle(PALETTE.BLACK, 0.5);
        g.fillEllipse(21, 64, 26, 6);

        // Tall Ash Spear Shaft + Steel Leaf Spearhead
        g.fillStyle(PALETTE.WOOD_MID, 1);
        g.fillRect(33, 10, 3, 54);
        g.fillStyle(PALETTE.STONE_LIGHT, 1);
        g.fillTriangle(34, 1, 30, 11, 39, 11);
        g.fillStyle(0xffffff, 1);
        g.fillRect(34, 3, 1, 7);

        // Boots & Mail Chausses
        g.fillStyle(PALETTE.WOOD_DARK, 1);
        g.fillRect(14, 54, 5, 10);
        g.fillRect(23, 54, 5, 10);
        g.fillStyle(PALETTE.STONE_DARK, 1);
        g.fillRect(14, 44, 5, 10);
        g.fillRect(23, 44, 5, 10);

        // Chainmail Hauberk & Faction Surcoat
        g.fillStyle(PALETTE.STONE_MID, 1);
        g.fillRect(11, 24, 20, 22);
        g.fillStyle(gt.primary, 1);
        g.fillRect(13, 25, 16, 20);
        g.fillStyle(gt.secondary, 1);
        g.fillRect(19, 25, 4, 20);
        g.fillStyle(PALETTE.WOOD_DARK, 1);
        g.fillRect(12, 35, 18, 3); // Leather belt

        // Conical Nasal Helm & Chainmail Coif
        g.fillStyle(PALETTE.STONE_DARK, 1);
        g.fillRect(14, 14, 14, 11);
        g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
        g.fillRect(16, 17, 10, 6);
        g.fillStyle(PALETTE.STONE_MID, 1);
        g.fillTriangle(21, 6, 13, 17, 29, 17);
        g.fillStyle(PALETTE.STONE_LIGHT, 1);
        g.fillTriangle(21, 6, 15, 16, 21, 16);
        g.fillRect(20, 16, 2, 5); // Nasal guard

        // Heraldic Kite Shield on Left Arm
        g.fillStyle(PALETTE.BLACK, 1);
        g.beginPath();
        g.moveTo(4, 25);
        g.lineTo(18, 25);
        g.lineTo(18, 41);
        g.lineTo(11, 51);
        g.lineTo(4, 41);
        g.closePath();
        g.fillPath();

        g.fillStyle(gt.primary, 1);
        g.beginPath();
        g.moveTo(6, 27);
        g.lineTo(16, 27);
        g.lineTo(16, 40);
        g.lineTo(11, 48);
        g.lineTo(6, 40);
        g.closePath();
        g.fillPath();

        g.fillStyle(gt.secondary, 1);
        g.fillRect(10, 28, 2, 18);
        g.fillRect(7, 33, 8, 2);

        g.generateTexture(gt.key, 44, 68);
        g.destroy();
        this.markNearest(scene, gt.key);
      }
    }

    // 5. Foreground Flaming Greek Fire Pot on Iron Tripod (32x34, NEAREST)
    if (!scene.textures.exists('siege_fire_pot')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 0.5);
      g.fillEllipse(16, 31, 22, 5);

      // Tripod legs
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(7, 24, 3, 7);
      g.fillRect(22, 24, 3, 7);
      g.fillRect(15, 25, 2, 6);

      // Terracotta / Iron Oil Cauldron
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillEllipse(16, 21, 20, 14);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillEllipse(16, 20, 16, 10);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillEllipse(16, 15, 16, 6);

      // Glowing Incendiary Pitch Surface
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillEllipse(16, 15, 12, 4);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillTriangle(16, 3, 9, 15, 23, 15);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(16, 7, 13, 15, 19, 15);

      g.generateTexture('siege_fire_pot', 32, 34);
      g.destroy();
      this.markNearest(scene, 'siege_fire_pot');
    }

    // 6. Foreground Plague / Disease Cask (28x32, NEAREST)
    if (!scene.textures.exists('siege_plague_barrel')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 0.5);
      g.fillEllipse(14, 29, 20, 5);

      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(5, 6, 18, 22);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(6, 7, 16, 20);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(8, 7, 5, 20);

      // Iron hoops
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(5, 10, 18, 2);
      g.fillRect(5, 22, 18, 2);

      // Oozing green pestilence & skull emblem
      g.fillStyle(0x7ccf35, 1);
      g.fillRect(8, 6, 11, 3);
      g.fillRect(15, 9, 3, 5);
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(11, 14, 6, 5);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(12, 15, 1, 2);
      g.fillRect(15, 15, 1, 2);

      g.generateTexture('siege_plague_barrel', 28, 32);
      g.destroy();
      this.markNearest(scene, 'siege_plague_barrel');
    }

    // 7. Foreground Hewn Boulder Pile (44x28, NEAREST)
    if (!scene.textures.exists('siege_boulder_pile')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 0.5);
      g.fillEllipse(22, 24, 38, 6);

      const stones: Array<[number, number, number]> = [
        [13, 18, 8],
        [29, 18, 8],
        [21, 11, 8],
      ];
      for (const [sx, sy, sr] of stones) {
        g.fillStyle(PALETTE.BLACK, 1);
        g.fillCircle(sx, sy, sr + 1);
        g.fillStyle(PALETTE.STONE_DARK, 1);
        g.fillCircle(sx, sy, sr);
        g.fillStyle(PALETTE.STONE_MID, 1);
        g.fillCircle(sx - 1, sy - 1, sr - 2);
        g.fillStyle(PALETTE.STONE_LIGHT, 1);
        g.fillRect(sx - 4, sy - 4, 4, 3);
      }

      g.generateTexture('siege_boulder_pile', 44, 28);
      g.destroy();
      this.markNearest(scene, 'siege_boulder_pile');
    }

    // 8. Flying Siege Projectiles (24x26, NEAREST)
    if (!scene.textures.exists('proj_siege_boulder')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillCircle(12, 12, 10);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillCircle(12, 12, 9);
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillCircle(10, 10, 7);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(7, 6, 5, 4);
      g.generateTexture('proj_siege_boulder', 24, 24);
      g.destroy();
      this.markNearest(scene, 'proj_siege_boulder');
    }

    if (!scene.textures.exists('proj_siege_greek_fire')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Pot body
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillCircle(12, 16, 8);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillCircle(12, 16, 6);
      // Blazing crest
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillCircle(12, 10, 7);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillTriangle(12, 1, 6, 13, 18, 13);
      g.fillStyle(0xffffff, 1);
      g.fillRect(10, 8, 4, 4);
      g.generateTexture('proj_siege_greek_fire', 24, 26);
      g.destroy();
      this.markNearest(scene, 'proj_siege_greek_fire');
    }

    if (!scene.textures.exists('proj_siege_disease')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(5, 5, 14, 16);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(6, 6, 12, 14);
      g.fillStyle(0x7ccf35, 1);
      g.fillCircle(12, 6, 5);
      g.fillRect(8, 10, 8, 4);
      g.fillStyle(0xc8ff68, 1);
      g.fillRect(10, 5, 4, 3);
      g.generateTexture('proj_siege_disease', 24, 26);
      g.destroy();
      this.markNearest(scene, 'proj_siege_disease');
    }

    // 9. Jagged Stone Masonry Debris Chunk (12x12, NEAREST)
    if (!scene.textures.exists('fx_stone_debris')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(1, 2, 10, 8);
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(2, 3, 8, 6);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(2, 3, 5, 3);
      g.generateTexture('fx_stone_debris', 12, 12);
      g.destroy();
      this.markNearest(scene, 'fx_stone_debris');
    }
  }

  /**
   * Generates 64x64 retro pixel-art portraits for the 4 Saxon Damsels (NEAREST filter, no noisy dithering).
   */
  public static createDamselPortraits(scene: Phaser.Scene): void {
    const size = 64;

    const drawFrame = (
      g: Phaser.GameObjects.Graphics,
      topBg: number,
      botBg: number
    ) => {
      g.fillStyle(topBg, 1);
      g.fillRect(0, 0, size, size);
      g.fillStyle(botBg, 1);
      g.fillRect(0, 32, size, 32);
      g.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      g.strokeRect(1, 1, size - 2, size - 2);
      g.lineStyle(1, PALETTE.GOLD_DARK, 0.9);
      g.strokeRect(4, 4, size - 8, size - 8);
    };

    const ladies: Array<{
      key: string;
      topBg: number;
      botBg: number;
      hair: number;
      gown: number;
      trim: number;
      veil: number;
      eyes: number;
    }> = [
      {
        key: 'portrait_rowena',
        topBg: 0x1d2b4c,
        botBg: 0x111a30,
        hair: PALETTE.GOLD_BRIGHT,
        gown: PALETTE.ROYAL_BLUE,
        trim: PALETTE.GOLD_BRIGHT,
        veil: PALETTE.PARCHMENT_LIGHT,
        eyes: PALETTE.SKY_MID,
      },
      {
        key: 'portrait_rebecca',
        topBg: 0x331624,
        botBg: 0x1d0b14,
        hair: 0x141218,
        gown: PALETTE.BLOOD_RED,
        trim: PALETTE.GOLD_BRIGHT,
        veil: PALETTE.GOLD_DARK,
        eyes: PALETTE.WOOD_DARK,
      },
      {
        key: 'portrait_marian',
        topBg: 0x183020,
        botBg: 0x0e1d13,
        hair: 0x8f3a1c,
        gown: PALETTE.FOLIAGE_MID,
        trim: PALETTE.PARCHMENT_LIGHT,
        veil: PALETTE.GOLD_BRIGHT,
        eyes: PALETTE.FOLIAGE_DARK,
      },
      {
        key: 'portrait_rosalind',
        topBg: 0x2f1d38,
        botBg: 0x1a1022,
        hair: 0xd89c46,
        gown: 0x9b2848,
        trim: PALETTE.PARCHMENT_LIGHT,
        veil: PALETTE.GOLD_BRIGHT,
        eyes: PALETTE.ROYAL_BLUE,
      },
    ];

    for (const l of ladies) {
      if (scene.textures.exists(l.key)) continue;
      const g = scene.make.graphics({ x: 0, y: 0 });
      drawFrame(g, l.topBg, l.botBg);

      // Flowing medieval court gown & bodice
      g.fillStyle(l.gown, 1);
      g.fillRect(12, 42, 40, 18);
      g.fillStyle(l.trim, 1);
      g.fillRect(22, 42, 20, 4);
      g.fillRect(29, 46, 6, 14);

      // Back hair tresses
      g.fillStyle(l.hair, 1);
      g.fillRect(16, 13, 32, 33);
      g.fillRect(14, 24, 6, 24);
      g.fillRect(44, 24, 6, 24);

      // Graceful neck & ivory face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(27, 35, 10, 8);
      g.fillRect(22, 17, 20, 19);
      g.fillRect(24, 34, 16, 3);

      // Soft cheek blush
      g.fillStyle(0xe5988b, 0.65);
      g.fillRect(23, 28, 4, 3);
      g.fillRect(37, 28, 4, 3);

      // Eyes & lashes
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 22, 5, 1);
      g.fillRect(35, 22, 5, 1);
      g.fillStyle(l.eyes, 1);
      g.fillRect(25, 24, 3, 3);
      g.fillRect(36, 24, 3, 3);

      // Delicate nose & rose lips
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 25, 2, 5);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(29, 32, 6, 2);

      // Royal Saxon circlet & veil trim
      g.fillStyle(l.veil, 1);
      g.fillRect(19, 10, 26, 4);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(21, 12, 22, 3);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(31, 11, 2, 3);

      // Necklace jewel
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(28, 40, 8, 2);

      g.generateTexture(l.key, size, size);
      g.destroy();
      this.markNearest(scene, l.key);
    }
  }

  /**
   * Generates the smooth 1280x500 HD Torchlit Castle Hall backdrop for SwordplayScene.
   * Includes vaulted stone masonry, moonlit gothic lancet windows, oak rafters,
   * left castle doorway, right ascending stone staircase, and flagstone floor.
   */
  public static createSwordplayCastleBackdrop(scene: Phaser.Scene): void {
    const key = 'swordplay_hall_backdrop';
    if (scene.textures.exists(key)) return;

    const w = 1280;
    const h = 500;
    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Smooth Atmospheric Torchlit Stone Wall Gradient (y: 0..388)
    this.drawSmoothVerticalGradient(g, 0, 0, w, 140, 0x11131d, 0x222534, 36);
    this.drawSmoothVerticalGradient(g, 0, 138, w, 252, 0x222534, 0x322b2c, 48);

    // Subtle ashlar stone masonry courses (clean lines, zero noisy dithering)
    g.lineStyle(1, 0x14151e, 0.52);
    for (let row = 0; row < 12; row++) {
      const ry = 42 + row * 29;
      g.lineBetween(0, ry, w, ry);
      const offset = (row % 2) * 46;
      for (let col = offset; col < w; col += 92) {
        g.lineBetween(col, ry, col, ry + 29);
      }
    }

    // 2. Heavy Timber Ceiling Beams & Vaulted Stone Corbels (y: 0..42)
    g.fillStyle(0x1b110b, 1);
    g.fillRect(0, 0, w, 28);
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(0, 24, w, 12);
    g.lineStyle(1.5, PALETTE.GOLD_DARK, 0.35);
    g.lineBetween(0, 36, w, 36);

    const pillarXs = [190, 490, 790, 1040];
    for (const px of pillarXs) {
      // Stone wall pilaster
      g.fillStyle(0x282b37, 0.9);
      g.fillRect(px - 18, 36, 36, 352);
      g.fillStyle(0x3b3f4e, 0.55);
      g.fillRect(px - 14, 36, 8, 352);
      // Vault ribs fanning to ceiling
      g.lineStyle(5, 0x1e202b, 0.85);
      g.lineBetween(px, 68, px - 90, 26);
      g.lineBetween(px, 68, px + 90, 26);
    }

    // 3. Arched Gothic Lancet Windows with Night Sky & Moonlight Shafts
    const windowXs = [340, 640, 915];
    for (const wx of windowXs) {
      const wy = 88;
      const ww = 74;
      const wh = 152;

      // Stone window recess
      g.fillStyle(0x151722, 1);
      g.fillRoundedRect(wx - ww / 2 - 8, wy - 8, ww + 16, wh + 16, 28);

      // Night sky pane
      this.drawSmoothVerticalGradient(
        g,
        wx - ww / 2,
        wy + 18,
        ww,
        wh - 18,
        0x132544,
        0x2b4c7e,
        20
      );
      g.fillStyle(0x162b4f, 1);
      g.fillCircle(wx, wy + 28, ww / 2);

      // Moon & stars visible in central gothic window
      if (wx === 640) {
        g.fillStyle(PALETTE.PARCHMENT_LIGHT, 0.95);
        g.fillCircle(wx + 12, wy + 44, 15);
        g.fillStyle(PALETTE.SKY_MID, 0.35);
        g.fillCircle(wx + 12, wy + 44, 24);
      } else {
        g.fillStyle(PALETTE.PARCHMENT_LIGHT, 0.75);
        g.fillCircle(wx - 14, wy + 38, 1.5);
        g.fillCircle(wx + 16, wy + 58, 1.5);
      }

      // Lead-lattice diamond mullions
      g.lineStyle(2, 0x11131c, 0.9);
      g.lineBetween(wx, wy + 2, wx, wy + wh);
      for (let ly = wy + 38; ly < wy + wh; ly += 32) {
        g.lineBetween(wx - ww / 2, ly, wx + ww / 2, ly);
      }
      g.lineStyle(3, 0x454959, 0.9);
      g.strokeRoundedRect(wx - ww / 2 - 2, wy, ww + 4, wh + 4, 26);

      // Diagonal cool silver-blue moonlight beam washing onto the floor
      g.fillStyle(PALETTE.SKY_LIGHT, 0.065);
      g.beginPath();
      g.moveTo(wx - ww / 2, wy + wh);
      g.lineTo(wx + ww / 2, wy + wh);
      g.lineTo(wx + ww / 2 + 85, 488);
      g.lineTo(wx - ww / 2 + 30, 488);
      g.closePath();
      g.fillPath();
    }

    // 4. Left Iron-Studded Castle Entry Doorway (x: 24..144, y: 176..390)
    g.fillStyle(0x171822, 1);
    g.fillRoundedRect(22, 166, 126, 224, 42);
    g.lineStyle(6, 0x454857, 1);
    g.strokeRoundedRect(24, 168, 122, 220, 40);
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRoundedRect(34, 180, 102, 208, 32);
    g.lineStyle(2, 0x261308, 0.9);
    g.lineBetween(85, 182, 85, 388);
    // Iron hinge straps & studs
    g.fillStyle(PALETTE.STONE_MID, 0.85);
    g.fillRect(36, 232, 98, 6);
    g.fillRect(36, 318, 98, 6);

    // 5. Right Ascending Stone Staircase & Vault Arch (x: 1054..1280)
    g.fillStyle(0x161720, 1);
    g.fillRoundedRect(1110, 120, 152, 268, 48);
    g.lineStyle(6, 0x484b5c, 1);
    g.strokeRoundedRect(1112, 122, 148, 264, 46);

    // Warm torchlit glow emanating from upper vault doorway
    g.fillStyle(PALETTE.GOLD_DARK, 0.16);
    g.fillCircle(1186, 236, 68);

    // Ascending chiseled stone steps (8 steps climbing left-to-right)
    for (let s = 0; s < 8; s++) {
      const sx = 1018 + s * 28;
      const sy = 388 - s * 17;
      const sw = 262 - s * 24;
      g.fillStyle(0x333645, 1);
      g.fillRect(sx, sy, sw, 18);
      g.fillStyle(PALETTE.STONE_LIGHT, 0.65);
      g.fillRect(sx, sy, sw, 4);
      g.fillStyle(0x1b1d26, 0.85);
      g.fillRect(sx, sy + 14, sw, 4);
    }

    // 6. Perspective Flagstone Hall Floor (y: 388..500)
    this.drawSmoothVerticalGradient(g, 0, 388, w, 112, 0x2b2933, 0x17161e, 32);
    g.lineStyle(2, 0x454352, 0.85);
    g.lineBetween(0, 388, w, 388);

    // Perspective stone tile joints
    g.lineStyle(1, 0x121118, 0.65);
    for (const fy of [412, 440, 472]) {
      g.lineBetween(0, fy, w, fy);
    }
    for (let i = -2; i <= 14; i++) {
      const topX = i * 96;
      const botX = 640 + (topX - 640) * 1.28;
      g.lineBetween(topX, 388, botX, 500);
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Generates crisp NEAREST pixel-art duelist poses, steel clash sparks, treasure chests,
   * and captive damsel sprites for SwordplayScene.
   */
  public static createSwordplaySprites(scene: Phaser.Scene): void {
    const archetypes: Array<{
      prefix: string;
      tunic: number;
      trim: number;
      cloak: number;
      helm: number;
      plume: number | null;
      pants: number;
      skin: number;
    }> = [
      {
        prefix: 'fencer_saxon',
        tunic: PALETTE.ROYAL_BLUE,
        trim: PALETTE.GOLD_BRIGHT,
        cloak: PALETTE.BLOOD_RED,
        helm: PALETTE.STONE_LIGHT,
        plume: PALETTE.GOLD_BRIGHT,
        pants: 0x2c3448,
        skin: PALETTE.PARCHMENT_LIGHT,
      },
      {
        prefix: 'fencer_guard',
        tunic: PALETTE.WOOD_MID,
        trim: PALETTE.STONE_LIGHT,
        cloak: 0x3b2416,
        helm: PALETTE.STONE_MID,
        plume: null,
        pants: 0x2e2e36,
        skin: PALETTE.PARCHMENT_DARK,
      },
      {
        prefix: 'fencer_norman',
        tunic: 0x1c1d24,
        trim: PALETTE.GOLD_DARK,
        cloak: PALETTE.BLOOD_RED,
        helm: PALETTE.STONE_DARK,
        plume: PALETTE.BLOOD_RED,
        pants: 0x191920,
        skin: PALETTE.PARCHMENT_LIGHT,
      },
    ];

    const poses = [
      'en_garde',
      'windup_high',
      'windup_mid',
      'windup_low',
      'attack_high',
      'attack_mid',
      'attack_low',
      'parry',
      'stagger',
      'defeat',
    ] as const;

    const w = 96;
    const h = 84;

    const drawSwordBlade = (
      g: Phaser.GameObjects.Graphics,
      hx: number,
      hy: number,
      tx: number,
      ty: number,
      drawSlashArc = false
    ) => {
      // Crossguard & Gold Pommel
      g.lineStyle(3, PALETTE.GOLD_BRIGHT, 1);
      const dx = tx - hx;
      const dy = ty - hy;
      const len = Math.max(1, Math.hypot(dx, dy));
      const px = (-dy / len) * 5;
      const py = (dx / len) * 5;
      g.lineBetween(hx - px, hy - py, hx + px, hy + py);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(Math.round(hx - (dx / len) * 4) - 1, Math.round(hy - (dy / len) * 4) - 1, 3, 3);

      // Gleaming Steel Blade (dark edge + bright core)
      g.lineStyle(3, PALETTE.STONE_MID, 1);
      g.lineBetween(hx, hy, tx, ty);
      g.lineStyle(1.5, 0xffffff, 1);
      g.lineBetween(hx, hy, tx, ty);

      if (drawSlashArc) {
        g.lineStyle(2, PALETTE.GOLD_BRIGHT, 0.75);
        g.lineBetween(tx - 8, ty - 10, tx, ty);
      }
    };

    for (const arch of archetypes) {
      for (const pose of poses) {
        const key = `${arch.prefix}_${pose}`;
        if (scene.textures.exists(key)) continue;

        const g = scene.make.graphics({ x: 0, y: 0 });

        const isCrouch = pose === 'windup_low' || pose === 'attack_low';
        const isLunge =
          pose === 'attack_mid' || pose === 'attack_high' || pose === 'attack_low';
        const isStagger = pose === 'stagger';
        const isDefeat = pose === 'defeat';

        const bodyX = isDefeat
          ? 34
          : isStagger
          ? 26
          : isLunge
          ? 44
          : 34;
        const bodyY = isDefeat ? 44 : isCrouch ? 38 : 30;

        // 1. Boots & Fencing Legs (Pixel-art blocks)
        g.fillStyle(arch.pants, 1);
        if (isDefeat) {
          // Kneeling in surrender
          g.fillRect(bodyX - 8, 64, 14, 10);
          g.fillRect(bodyX + 6, 58, 10, 16);
          g.fillStyle(PALETTE.WOOD_DARK, 1);
          g.fillRect(bodyX - 12, 72, 14, 6);
          g.fillRect(bodyX + 6, 72, 13, 6);
        } else {
          const backLegX = isLunge ? bodyX - 16 : bodyX - 9;
          const frontLegX = isLunge ? bodyX + 12 : bodyX + 7;
          const hipY = bodyY + 22;
          g.fillRect(backLegX, hipY, 7, 72 - hipY);
          g.fillRect(frontLegX, hipY, 7, 72 - hipY);

          // Leather Cavalier Boots
          g.fillStyle(PALETTE.WOOD_DARK, 1);
          g.fillRect(backLegX - 2, 68, 10, 10);
          g.fillRect(frontLegX, 68, 12, 10);
        }

        // 2. Flowing Swashbuckling Cloak (Behind Torso)
        g.fillStyle(arch.cloak, 1);
        if (isDefeat) {
          g.fillTriangle(bodyX - 2, bodyY + 2, bodyX - 18, 75, bodyX + 4, 75);
        } else {
          const cloakTailX = isLunge ? bodyX - 22 : isStagger ? bodyX - 8 : bodyX - 16;
          g.fillTriangle(
            bodyX,
            bodyY + 2,
            cloakTailX,
            bodyY + 34,
            bodyX - 2,
            bodyY + 30
          );
        }

        // 3. Armored Torso / Surcoat & Heraldic Belt
        g.fillStyle(PALETTE.BLACK, 1);
        g.fillRect(bodyX - 7, bodyY - 1, 18, 25);
        g.fillStyle(arch.tunic, 1);
        g.fillRect(bodyX - 6, bodyY, 16, 23);
        g.fillStyle(arch.trim, 1);
        g.fillRect(bodyX - 1, bodyY + 2, 4, 18); // Vertical surcoat stripe
        g.fillStyle(PALETTE.WOOD_DARK, 1);
        g.fillRect(bodyX - 6, bodyY + 15, 16, 4); // Belt
        g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
        g.fillRect(bodyX + 1, bodyY + 15, 4, 4); // Buckle

        // 4. Head, Face & Medieval Helm
        const headX = isStagger ? bodyX - 3 : bodyX;
        const headY = isDefeat ? bodyY - 11 : bodyY - 14;
        g.fillStyle(arch.skin, 1);
        g.fillRect(headX - 3, headY + 3, 11, 10);
        g.fillStyle(PALETTE.BLACK, 1);
        g.fillRect(headX + 4, headY + 6, 2, 2); // Eye

        g.fillStyle(arch.helm, 1);
        g.fillRect(headX - 5, headY - 1, 14, 6);
        g.fillRect(headX - 5, headY + 3, 5, 9);
        if (arch.prefix === 'fencer_guard') {
          // Kettle hat brim
          g.fillStyle(PALETTE.STONE_LIGHT, 1);
          g.fillRect(headX - 8, headY + 3, 20, 3);
        } else if (arch.plume) {
          // Noble crest / plume
          g.fillStyle(arch.plume, 1);
          g.fillRect(headX - 7, headY - 5, 9, 4);
          g.fillRect(headX - 10, headY - 3, 5, 4);
        }

        // 5. Off-Hand Balance Arm & Sword Arm + Gleaming Steel Rapier/Broadsword
        g.fillStyle(arch.tunic, 1);
        g.fillRect(bodyX - 11, bodyY + 4, 6, 9);

        let hiltX = bodyX + 14;
        let hiltY = bodyY + 9;
        let tipX = bodyX + 46;
        let tipY = bodyY + 3;
        let slashArc = false;

        if (pose === 'en_garde') {
          hiltX = bodyX + 15;
          hiltY = bodyY + 9;
          tipX = bodyX + 47;
          tipY = bodyY + 1;
        } else if (pose === 'windup_high') {
          hiltX = bodyX + 6;
          hiltY = bodyY - 14;
          tipX = bodyX + 28;
          tipY = bodyY - 26;
        } else if (pose === 'windup_mid') {
          hiltX = bodyX - 2;
          hiltY = bodyY + 8;
          tipX = bodyX + 30;
          tipY = bodyY + 8;
        } else if (pose === 'windup_low') {
          hiltX = bodyX + 4;
          hiltY = bodyY + 18;
          tipX = bodyX + 32;
          tipY = bodyY + 28;
        } else if (pose === 'attack_high') {
          hiltX = bodyX + 19;
          hiltY = bodyY - 4;
          tipX = bodyX + 50;
          tipY = bodyY - 14;
          slashArc = true;
        } else if (pose === 'attack_mid') {
          hiltX = bodyX + 21;
          hiltY = bodyY + 7;
          tipX = bodyX + 51;
          tipY = bodyY + 7;
          slashArc = true;
        } else if (pose === 'attack_low') {
          hiltX = bodyX + 19;
          hiltY = bodyY + 16;
          tipX = bodyX + 49;
          tipY = bodyY + 26;
          slashArc = true;
        } else if (pose === 'parry') {
          hiltX = bodyX + 13;
          hiltY = bodyY + 12;
          tipX = bodyX + 22;
          tipY = bodyY - 18;
        } else if (pose === 'stagger') {
          hiltX = bodyX + 8;
          hiltY = bodyY - 4;
          tipX = bodyX - 8;
          tipY = bodyY - 22;
        } else if (pose === 'defeat') {
          hiltX = bodyX + 12;
          hiltY = bodyY + 18;
          tipX = bodyX + 34;
          tipY = 75;
        }

        // Sword arm connecting shoulder to hilt
        g.lineStyle(5, arch.tunic, 1);
        g.lineBetween(bodyX + 6, bodyY + 5, hiltX, hiltY);
        g.fillStyle(PALETTE.WOOD_DARK, 1);
        g.fillCircle(hiltX, hiltY, 3); // Leather gauntlet

        drawSwordBlade(g, hiltX, hiltY, tipX, tipY, slashArc);

        g.generateTexture(key, w, h);
        g.destroy();
        this.markNearest(scene, key);
      }
    }

    // Steel Clash Spark Star (20x20, NEAREST)
    if (!scene.textures.exists('fx_steel_spark')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(9, 1, 2, 18);
      g.fillRect(1, 9, 18, 2);
      g.fillRect(5, 5, 10, 10);
      g.fillStyle(0xffffff, 1);
      g.fillRect(7, 7, 6, 6);
      g.fillRect(9, 3, 2, 14);
      g.fillRect(3, 9, 14, 2);
      g.generateTexture('fx_steel_spark', 20, 20);
      g.destroy();
      this.markNearest(scene, 'fx_steel_spark');
    }

    // Treasure Chest Closed & Open (56x48, NEAREST)
    if (!scene.textures.exists('prop_treasure_chest_closed')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(4, 12, 48, 32);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(6, 20, 44, 22);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(6, 13, 44, 8);
      // Iron & Gold Straps
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(12, 13, 5, 29);
      g.fillRect(39, 13, 5, 29);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(25, 19, 6, 8);
      g.generateTexture('prop_treasure_chest_closed', 56, 48);
      g.destroy();
      this.markNearest(scene, 'prop_treasure_chest_closed');
    }

    if (!scene.textures.exists('prop_treasure_chest_open')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Raised lid
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(4, 3, 48, 41);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(6, 5, 44, 12);
      // Overflowing Gold Coins & Crown Jewels
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(8, 15, 40, 9);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(11, 13, 34, 9);
      g.fillStyle(0xffffff, 1);
      g.fillRect(16, 14, 3, 3);
      g.fillRect(34, 15, 3, 3);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(25, 14, 5, 4); // Ruby jewel
      // Lower oak coffer
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(6, 23, 44, 19);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(12, 23, 5, 19);
      g.fillRect(39, 23, 5, 19);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(25, 24, 6, 7);
      g.generateTexture('prop_treasure_chest_open', 56, 48);
      g.destroy();
      this.markNearest(scene, 'prop_treasure_chest_open');
    }

    // Full-Body Captive Saxon Damsel Sprite for Tower Chamber (48x76, NEAREST)
    if (!scene.textures.exists('sprite_damsel_captive')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Golden hair & royal circlet
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(16, 8, 16, 22);
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(19, 12, 10, 11);
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(20, 16, 2, 2);
      g.fillRect(25, 16, 2, 2);
      // Flowing medieval azure & gold gown
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(16, 25, 16, 16);
      g.fillTriangle(24, 34, 8, 72, 40, 72);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(22, 26, 4, 46);
      g.fillRect(14, 69, 20, 3);
      // Clasped hands
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(20, 33, 8, 5);
      g.generateTexture('sprite_damsel_captive', 48, 76);
      g.destroy();
      this.markNearest(scene, 'sprite_damsel_captive');
    }
  }

  /**
   * Generates the 1280x510 widescreen Royal Jousting Arena Tournament backdrop.
   */
  public static createJoustArenaBackdrop(scene: Phaser.Scene): void {
    const key = 'joust_arena_backdrop';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Summer sky gradient (y: 0..200)
    this.drawSmoothVerticalGradient(g, 0, 0, 1280, 200, PALETTE.SKY_MID, PALETTE.SKY_LIGHT, 32);

    // Fluffy cumulus clouds
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(220, 60, 48);
    g.fillCircle(270, 50, 60);
    g.fillCircle(320, 65, 45);
    g.fillCircle(780, 70, 55);
    g.fillCircle(840, 58, 68);
    g.fillCircle(890, 72, 50);

    // 2. Far rolling green hills (y: 130..210)
    g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
    g.beginPath();
    g.moveTo(0, 185);
    const hillPoints = [
      { x: 120, y: 165 },
      { x: 260, y: 145 },
      { x: 420, y: 175 },
      { x: 580, y: 165 },
      { x: 740, y: 145 },
      { x: 920, y: 135 },
      { x: 1100, y: 160 },
      { x: 1280, y: 155 },
    ];
    for (const p of hillPoints) {
      g.lineTo(p.x, p.y);
    }
    g.lineTo(1280, 220);
    g.lineTo(0, 220);
    g.closePath();
    g.fillPath();

    // Distant castle silhouette on hill (x: 980..1060)
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(1000, 130, 32, 28);
    g.fillRect(995, 122, 12, 16);
    g.fillRect(1025, 122, 12, 16);
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillTriangle(1001, 122, 1001, 112, 1012, 117);

    // 3. Royal pavilions and spectator grandstands (x: 40..420, y: 110..220)
    // Left Pavilion Tent 1 (Striped Azure & Gold)
    g.fillStyle(PALETTE.ROYAL_BLUE, 1);
    g.fillTriangle(100, 95, 40, 190, 160, 190);
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillTriangle(100, 95, 75, 190, 125, 190);
    g.fillRect(40, 190, 120, 30);
    g.fillStyle(PALETTE.ROYAL_BLUE, 1);
    g.fillRect(60, 190, 30, 30);
    g.fillRect(110, 190, 30, 30);
    // Pennant
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillRect(98, 75, 4, 20);
    g.fillTriangle(102, 76, 128, 83, 102, 90);

    // Central Royal Pavilion (Crimson & Gold King's Pavilion, x: 190..340)
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillTriangle(260, 80, 180, 185, 340, 185);
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillTriangle(260, 80, 225, 185, 295, 185);
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(180, 185, 160, 35);
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillRect(190, 188, 140, 32);
    // Royal pennants
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillRect(258, 60, 4, 20);
    g.fillTriangle(262, 60, 295, 70, 262, 80);

    // Spectator Grandstand Silhouettes (cheering lords and ladies)
    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.fillRect(360, 165, 220, 50);
    g.fillStyle(PALETTE.STONE_DARK, 1);
    for (let sp = 370; sp < 570; sp += 16) {
      g.fillCircle(sp, 160 + (sp % 3) * 3, 6);
      g.fillRect(sp - 5, 166, 10, 14);
    }
    // Colorful banners hanging from grandstand
    for (let b = 375; b < 570; b += 32) {
      g.fillStyle(b % 64 === 0 ? PALETTE.BLOOD_RED : PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(b, 185, 20, 26);
      g.fillTriangle(b, 211, b + 20, 211, b + 10, 222);
    }

    // 4. Tournament Field Turf & Charging Track (y: 200..510)
    this.drawSmoothVerticalGradient(g, 0, 200, 1280, 310, PALETTE.FOLIAGE_MID, PALETTE.FOLIAGE_DARK, 40);

    // Packed dirt & sand charging lanes on both sides of the tilt barrier
    g.fillStyle(PALETTE.WOOD_MID, 0.45);
    g.beginPath();
    g.moveTo(630, 210);
    g.lineTo(820, 510);
    g.lineTo(380, 510);
    g.lineTo(610, 210);
    g.closePath();
    g.fillPath();

    // Fine arena sand path
    g.fillStyle(PALETTE.PARCHMENT_DARK, 0.55);
    g.beginPath();
    g.moveTo(635, 210);
    g.lineTo(760, 510);
    g.lineTo(470, 510);
    g.lineTo(625, 210);
    g.closePath();
    g.fillPath();

    // 5. Wooden Tilt Barrier (The quintain / tilt rail dividing the fencers/horses)
    // Runs from vanishing point (x: 640, y: 210) down to foreground (x: 570, y: 510)
    g.fillStyle(PALETTE.BLACK, 0.4);
    // Cast shadow of tilt rail onto ground
    g.beginPath();
    g.moveTo(640, 210);
    g.lineTo(600, 510);
    g.lineTo(625, 510);
    g.lineTo(644, 210);
    g.closePath();
    g.fillPath();

    // Wooden Tilt Posts
    const posts = [
      { y: 215, h: 20, w: 4, x: 640 },
      { y: 235, h: 32, w: 6, x: 635 },
      { y: 265, h: 48, w: 8, x: 628 },
      { y: 310, h: 70, w: 12, x: 618 },
      { y: 375, h: 105, w: 16, x: 602 },
      { y: 470, h: 150, w: 22, x: 580 },
    ];

    // Longitudinal wooden rails
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.beginPath();
    g.moveTo(640, 212);
    g.lineTo(584, 460);
    g.lineTo(584, 480);
    g.lineTo(640, 220);
    g.closePath();
    g.fillPath();

    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.beginPath();
    g.moveTo(640, 218);
    g.lineTo(584, 474);
    g.lineTo(584, 488);
    g.lineTo(640, 226);
    g.closePath();
    g.fillPath();

    // Draw the tilt barrier posts with woodgrain & iron cap bands
    for (const p of posts) {
      // Post body
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
      // Highlight on wood edge
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(p.x - p.w / 2 + 1, p.y - p.h + 2, Math.max(1, p.w / 3), p.h - 4);
      // Iron reinforcement ring
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(p.x - p.w / 2, p.y - Math.floor(p.h * 0.7), p.w, Math.max(2, p.w / 3));
    }

    g.generateTexture(key, 1280, 510);
    g.destroy();
  }

  /**
   * Generates procedural Jousting sprites:
   * - joust_horse_neck: Player's destrier bobbing in foreground (180x150)
   * - joust_player_lance: Couched tournament lance with vamplate (340x160)
   * - joust_rival_charger: Pixel-art oncoming knight on warhorse (180x180)
   * - joust_target_reticle: Aiming crosshair (48x48)
   * - joust_shield_overlay: Detailed close-up target shield with sweetspot, outer shield, foul zone (200x240)
   * - joust_splinter: Wooden shard particle (12x12)
   * - joust_unhorsed: Tumble silhouette (160x140)
   */
  public static createJoustSprites(scene: Phaser.Scene): void {
    // 1. Player's Warhorse Neck & Bridle (Foreground Lower-Left, 180x150)
    if (!scene.textures.exists('joust_horse_neck')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Powerful horse neck muscle
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.beginPath();
      g.moveTo(0, 150);
      g.lineTo(30, 40);
      g.lineTo(75, 20);
      g.lineTo(110, 45);
      g.lineTo(150, 150);
      g.closePath();
      g.fillPath();

      // Pricked ears
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillTriangle(60, 25, 72, 2, 78, 25);
      g.fillTriangle(85, 25, 96, 5, 102, 28);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillTriangle(64, 23, 73, 7, 76, 23);

      // Steel Chanfron / Horse Brow Armor
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.beginPath();
      g.moveTo(70, 26);
      g.lineTo(105, 28);
      g.lineTo(115, 75);
      g.lineTo(80, 85);
      g.closePath();
      g.fillPath();
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(86, 38, 8, 8); // Gold crest emblem

      // Flowing warhorse mane
      g.fillStyle(PALETTE.BLACK, 1);
      for (let my = 35; my < 140; my += 14) {
        g.fillTriangle(35, my, 8, my + 18, 45, my + 10);
      }

      // Leather bridle & silver bit
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(72, 50, 42, 6);
      g.fillRect(80, 50, 6, 45);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillCircle(82, 92, 5);

      g.generateTexture('joust_horse_neck', 180, 150);
      g.destroy();
      this.markNearest(scene, 'joust_horse_neck');
    }

    // 2. Foreground Couched Player Tournament Lance (340x160)
    if (!scene.textures.exists('joust_player_lance')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Couched lance shaft tapering towards tip at top-left
      // Tip at (10, 20), vamplate & grip at (290, 140)
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.beginPath();
      g.moveTo(10, 20);
      g.lineTo(290, 130);
      g.lineTo(285, 148);
      g.lineTo(10, 24);
      g.closePath();
      g.fillPath();

      // Heraldic spiral wrapping around lance shaft
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      const stripes = [
        { x1: 50, y1: 34, x2: 70, y2: 44 },
        { x1: 100, y1: 54, x2: 125, y2: 66 },
        { x1: 160, y1: 80, x2: 190, y2: 95 },
        { x1: 225, y1: 108, x2: 255, y2: 124 },
      ];
      for (const s of stripes) {
        g.beginPath();
        g.moveTo(s.x1, s.y1);
        g.lineTo(s.x2, s.y2);
        g.lineTo(s.x2 - 8, s.y2 + 8);
        g.lineTo(s.x1 - 8, s.y1 + 8);
        g.closePath();
        g.fillPath();
      }

      // Blunted Tournament Coronel Tip (steel crown tip)
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillCircle(10, 22, 6);
      g.fillRect(8, 17, 8, 10);
      g.fillStyle(0xffffff, 1);
      g.fillRect(9, 18, 3, 3);

      // Steel Vamplate (circular hand shield protector)
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillEllipse(275, 138, 28, 44);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillEllipse(275, 138, 22, 36);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillEllipse(275, 138, 10, 16);

      // Gauntleted hand gripping the lance butt
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(285, 132, 35, 18);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(295, 132, 4, 18);
      g.fillRect(305, 132, 4, 18);

      g.generateTexture('joust_player_lance', 340, 160);
      g.destroy();
      this.markNearest(scene, 'joust_player_lance');
    }

    // 3. Oncoming Rival Charger (Knight on charging destrier, 180x180)
    if (!scene.textures.exists('joust_rival_charger')) {
      const g = scene.make.graphics({ x: 0, y: 0 });

      // Horse body & legs galloping forward
      g.fillStyle(PALETTE.BLACK, 1);
      // Horse chest & head
      g.fillEllipse(85, 125, 50, 40);
      g.fillTriangle(60, 115, 85, 60, 100, 115); // horse neck
      g.fillEllipse(85, 65, 22, 18); // horse head
      // Horse ears
      g.fillTriangle(78, 55, 82, 42, 85, 55);
      g.fillTriangle(88, 55, 92, 42, 95, 55);

      // Trapper / Caparison (azure heraldic horse cloth)
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.beginPath();
      g.moveTo(50, 115);
      g.lineTo(120, 115);
      g.lineTo(135, 165);
      g.lineTo(35, 165);
      g.closePath();
      g.fillPath();
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(40, 155, 90, 6); // gold fringe

      // Horse galloping hooves / legs
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(55, 150, 12, 28);
      g.fillRect(100, 150, 12, 28);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(53, 172, 16, 8); // steel shoes
      g.fillRect(98, 172, 16, 8);

      // Armored Rival Knight in saddle
      // Knight Torso in Plate Armor
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(72, 38, 28, 36);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(72, 54, 28, 4);

      // Great Helm with Visor Slit
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(74, 18, 24, 22);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(78, 28, 16, 3); // Eye visor slit
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(78, 33, 16, 2); // Breathing holes

      // Knight's Feather Plume
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillTriangle(86, 18, 98, 2, 80, 10);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillTriangle(86, 18, 104, 8, 86, 12);

      // Rival's Couched Lance pointing toward viewer (right side from his perspective, left on screen)
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.beginPath();
      g.moveTo(42, 60);
      g.lineTo(5, 78);
      g.lineTo(42, 68);
      g.closePath();
      g.fillPath();
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillCircle(5, 78, 5); // Lance tip aimed at player

      // Rival's Heater Shield Held on Left Arm (Right side of sprite, x: 92..138)
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.beginPath();
      g.moveTo(96, 38);
      g.lineTo(136, 38);
      g.lineTo(136, 75);
      g.lineTo(116, 105);
      g.lineTo(96, 75);
      g.closePath();
      g.fillPath();

      // Shield Cross / Boss
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(113, 40, 6, 60);
      g.fillRect(98, 55, 36, 6);
      g.fillCircle(116, 58, 6);

      g.generateTexture('joust_rival_charger', 180, 180);
      g.destroy();
      this.markNearest(scene, 'joust_rival_charger');
    }

    // 4. Target Aiming Reticle (48x48)
    if (!scene.textures.exists('joust_target_reticle')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Reticle shadow
      g.lineStyle(3, PALETTE.BLACK, 0.7);
      g.strokeCircle(24, 24, 18);
      g.lineBetween(24, 2, 24, 14);
      g.lineBetween(24, 34, 24, 46);
      g.lineBetween(2, 24, 14, 24);
      g.lineBetween(34, 24, 46, 24);

      // Bright Golden Crosshair
      g.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      g.strokeCircle(24, 24, 18);
      g.lineBetween(24, 3, 24, 13);
      g.lineBetween(24, 35, 24, 45);
      g.lineBetween(3, 24, 13, 24);
      g.lineBetween(35, 24, 45, 24);

      // Center dot
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillCircle(24, 24, 3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(24, 24, 1);

      g.generateTexture('joust_target_reticle', 48, 48);
      g.destroy();
      this.markNearest(scene, 'joust_target_reticle');
    }

    // 5. High-Detail Target Shield Overlay (Close-up Impact Target, 200x240)
    // Coordinates match JoustEngine target plane:
    // Center boss: (100, 100) -> Sweetspot
    // Upper: Helm/Rim (y: 10..40)
    // Lower: Horse/Saddle warning zone (y: 190..240)
    if (!scene.textures.exists('joust_shield_overlay')) {
      const g = scene.make.graphics({ x: 0, y: 0 });

      // Shield drop shadow
      g.fillStyle(PALETTE.BLACK, 0.6);
      g.beginPath();
      g.moveTo(34, 34);
      g.lineTo(174, 34);
      g.lineTo(174, 140);
      g.lineTo(104, 210);
      g.lineTo(34, 140);
      g.closePath();
      g.fillPath();

      // Heater Shield Base (Blood Red & Royal Blue quarters)
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.beginPath();
      g.moveTo(30, 30);
      g.lineTo(170, 30);
      g.lineTo(170, 135);
      g.lineTo(100, 205);
      g.lineTo(30, 135);
      g.closePath();
      g.fillPath();

      // Blue quartering
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.beginPath();
      g.moveTo(100, 30);
      g.lineTo(170, 30);
      g.lineTo(170, 100);
      g.lineTo(100, 100);
      g.closePath();
      g.fillPath();

      g.beginPath();
      g.moveTo(30, 100);
      g.lineTo(100, 100);
      g.lineTo(100, 205);
      g.lineTo(30, 135);
      g.closePath();
      g.fillPath();

      // Outer Shield Border (Polished Iron Rim)
      g.lineStyle(5, PALETTE.STONE_LIGHT, 1);
      g.beginPath();
      g.moveTo(30, 30);
      g.lineTo(170, 30);
      g.lineTo(170, 135);
      g.lineTo(100, 205);
      g.lineTo(30, 135);
      g.closePath();
      g.strokePath();

      // Golden Shield Boss / Cross - UNHORSE SWEETSPOT (Center at 100, 100)
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillCircle(100, 100, 28);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillCircle(100, 100, 20);
      g.fillStyle(PALETTE.BLACK, 1);
      // Pierced cross design in boss
      g.fillRect(98, 86, 4, 28);
      g.fillRect(86, 98, 28, 4);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(100, 100, 4);

      // Upper Helm Edge / Visor (GLANCING BLOW ZONE: y: 5..28)
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(60, 6, 80, 22);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(62, 8, 76, 8);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(72, 18, 56, 4); // Visor slit

      // Lower Steed / Saddle Warning Hazard Band (FOUL ZONE: y > 195)
      g.fillStyle(PALETTE.BLOOD_RED, 0.85);
      g.fillRect(20, 208, 160, 28);
      g.lineStyle(2, PALETTE.GOLD_BRIGHT, 1);
      g.strokeRect(20, 208, 160, 28);
      // Warning stripes
      g.fillStyle(PALETTE.BLACK, 0.8);
      for (let hz = 24; hz < 170; hz += 20) {
        g.fillTriangle(hz, 236, hz + 8, 208, hz + 14, 208);
      }

      g.generateTexture('joust_shield_overlay', 200, 240);
      g.destroy();
      this.markNearest(scene, 'joust_shield_overlay');
    }

    // 6. Flying Wood Splinter Particle (12x12)
    if (!scene.textures.exists('joust_splinter')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillTriangle(2, 10, 10, 2, 6, 10);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillTriangle(3, 8, 8, 3, 5, 8);
      g.generateTexture('joust_splinter', 12, 12);
      g.destroy();
      this.markNearest(scene, 'joust_splinter');
    }

    // 7. Unhorsed Rider Tumble Silhouette (160x140)
    if (!scene.textures.exists('joust_unhorsed')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Knight tumbling upside-down / backwards in mid-air
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      // Torso angled
      g.fillEllipse(80, 70, 36, 24);
      // Legs flailing upward
      g.fillRect(88, 30, 14, 38);
      g.fillRect(104, 24, 14, 34);
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(86, 22, 18, 10); // Sabatons
      g.fillRect(102, 16, 18, 10);

      // Helm tumbling backward
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillCircle(55, 85, 16);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(45, 83, 16, 4);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillTriangle(60, 95, 78, 110, 50, 105); // Dislodged plume

      // Shattered lance fragment flying
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.beginPath();
      g.moveTo(120, 90);
      g.lineTo(155, 60);
      g.lineTo(150, 56);
      g.lineTo(116, 86);
      g.closePath();
      g.fillPath();

      // Flying shield spinning away
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillEllipse(30, 45, 20, 28);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(28, 33, 4, 24);

      g.generateTexture('joust_unhorsed', 160, 140);
      g.destroy();
      this.markNearest(scene, 'joust_unhorsed');
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
    this.createDamselPortraits(scene);
    this.createBattleBackdrops(scene);
    this.createBattleUnitSprites(scene);
    this.createSiegeSkyAndHillsBackdrop(scene);
    this.createSiegeSprites(scene);
    this.createSwordplayCastleBackdrop(scene);
    this.createSwordplaySprites(scene);
    this.createJoustArenaBackdrop(scene);
    this.createJoustSprites(scene);

    // Saxon Lord Shields
    this.createHeraldicShield(scene, 'shield_ivanhoe', PALETTE.BLOOD_RED, PALETTE.GOLD_BRIGHT, PALETTE.PARCHMENT_LIGHT, 'cross');
    this.createHeraldicShield(scene, 'shield_cedric', PALETTE.FOLIAGE_MID, PALETTE.GOLD_BRIGHT, PALETTE.WOOD_DARK, 'boar');
    this.createHeraldicShield(scene, 'shield_geoffrey', PALETTE.ROYAL_BLUE, PALETTE.STONE_LIGHT, PALETTE.GOLD_DARK, 'sword');
    this.createHeraldicShield(scene, 'shield_wolfric', PALETTE.WOOD_MID, PALETTE.PARCHMENT_LIGHT, PALETTE.STONE_DARK, 'wolf');

    // Norman Lord Shields & Garrison Fallback Shield
    this.createHeraldicShield(scene, 'shield_malvoisin', PALETTE.STONE_DARK, PALETTE.BLOOD_RED, PALETTE.GOLD_DARK, 'falcon');
    this.createHeraldicShield(scene, 'shield_frontdeboeuf', PALETTE.BLACK, PALETTE.GOLD_DARK, PALETTE.BLOOD_RED, 'axe');
    this.createHeraldicShield(scene, 'shield_boisguilbert', PALETTE.STONE_LIGHT, PALETTE.BLOOD_RED, PALETTE.BLACK, 'lion');
    this.createHeraldicShield(scene, 'shield_garrison', PALETTE.STONE_MID, PALETTE.WOOD_DARK, PALETTE.STONE_LIGHT, 'sword');
  }
}
