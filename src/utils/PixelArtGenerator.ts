import Phaser from 'phaser';
import { PALETTE } from '../data/palette';

/**
 * PixelArtGenerator
 * Procedural Amiga OCS Pixel-Art Generator upgraded to 640x400 (Amiga Hi-Res).
 * Provides crisp readability, authentic 32-color dithering, and rich medieval heraldry.
 */
export class PixelArtGenerator {
  /**
   * Helper to draw a dithered rectangle between two palette colors.
   */
  public static drawDitheredRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    colorA: number,
    colorB: number,
    pattern: 'checker' | 'sparse' | 'dense' = 'checker'
  ): void {
    g.fillStyle(colorA, 1);
    g.fillRect(x, y, w, h);

    g.fillStyle(colorB, 1);
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        let shouldDraw = false;
        if (pattern === 'checker') {
          shouldDraw = (px + py) % 2 === 0;
        } else if (pattern === 'sparse') {
          shouldDraw = px % 2 === 0 && py % 2 === 0;
        } else if (pattern === 'dense') {
          shouldDraw = (px + py) % 2 === 0 || px % 2 === 0;
        }
        if (shouldDraw) {
          g.fillRect(x + px, y + py, 1, 1);
        }
      }
    }
  }

  /**
   * Generates the iconic Title Screen Castle Siege backdrop (640x400).
   */
  public static createTitleBackdrop(scene: Phaser.Scene): void {
    const key = 'title_backdrop';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Sky Gradient with Dithered Bands (640 x 400)
    // Band 1: Deep Black / Midnight
    g.fillStyle(PALETTE.BLACK, 1);
    g.fillRect(0, 0, 640, 70);

    // Band 1 -> 2 Dither
    this.drawDitheredRect(g, 0, 65, 640, 20, PALETTE.BLACK, PALETTE.SHADOW, 'checker');

    // Band 2: Deep Night Blue
    g.fillStyle(PALETTE.SHADOW, 1);
    g.fillRect(0, 85, 640, 50);

    // Band 2 -> 3 Dither
    this.drawDitheredRect(g, 0, 130, 640, 20, PALETTE.SHADOW, PALETTE.SKY_NIGHT, 'checker');

    // Band 3: Dark Blue
    g.fillStyle(PALETTE.SKY_NIGHT, 1);
    g.fillRect(0, 150, 640, 60);

    // Band 3 -> 4 Dither
    this.drawDitheredRect(g, 0, 200, 640, 20, PALETTE.SKY_NIGHT, PALETTE.SKY_MID, 'checker');

    // Band 4: Horizon Blue
    g.fillStyle(PALETTE.SKY_MID, 1);
    g.fillRect(0, 220, 640, 50);

    // 2. Full Autumn Moon
    const moonX = 500;
    const moonY = 75;
    const moonR = 30;
    // Outer glow
    g.fillStyle(PALETTE.GOLD_DARK, 0.4);
    g.fillCircle(moonX, moonY, moonR + 6);
    // Moon body
    g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    g.fillCircle(moonX, moonY, moonR);
    // Moon craters / texture
    g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
    g.fillCircle(moonX - 8, moonY - 6, 7);
    g.fillCircle(moonX + 10, moonY + 8, 6);
    g.fillCircle(moonX + 4, moonY - 10, 4);

    // 3. Distant Misty Hills
    g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
    g.beginPath();
    g.moveTo(0, 240);
    g.lineTo(160, 210);
    g.lineTo(320, 230);
    g.lineTo(480, 205);
    g.lineTo(640, 225);
    g.lineTo(640, 270);
    g.lineTo(0, 270);
    g.closePath();
    g.fillPath();

    this.drawDitheredRect(g, 0, 250, 640, 16, PALETTE.FOLIAGE_DARK, PALETTE.FOLIAGE_MID, 'checker');

    // 4. Foreground Slopes / Valley
    g.fillStyle(PALETTE.FOLIAGE_MID, 1);
    g.beginPath();
    g.moveTo(0, 265);
    g.lineTo(220, 255);
    g.lineTo(420, 270);
    g.lineTo(640, 255);
    g.lineTo(640, 400);
    g.lineTo(0, 400);
    g.closePath();
    g.fillPath();

    this.drawDitheredRect(g, 0, 290, 240, 110, PALETTE.FOLIAGE_MID, PALETTE.FOLIAGE_LIGHT, 'sparse');
    this.drawDitheredRect(g, 240, 310, 400, 90, PALETTE.FOLIAGE_MID, PALETTE.FOLIAGE_DARK, 'checker');

    // 5. Majestic Castle Fortress on the Hill (Left-Center, x: 70-260)
    // Castle Base Rock
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(70, 244, 200, 80);

    // Left Tower
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(80, 160, 44, 100);
    // Crenelations Left Tower
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(80, 154, 12, 8);
    g.fillRect(96, 154, 12, 8);
    g.fillRect(112, 154, 12, 8);
    // Shading on tower wall
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(80, 162, 5, 96);

    // Right Tower (Taller)
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(200, 140, 52, 120);
    // Crenelations Right Tower
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(200, 132, 12, 10);
    g.fillRect(220, 132, 12, 10);
    g.fillRect(240, 132, 12, 10);
    // Tower highlights
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(200, 142, 5, 116);

    // Central Curtain Wall
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(124, 184, 76, 76);
    // Wall crenelations
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(126, 178, 10, 8);
    g.fillRect(146, 178, 10, 8);
    g.fillRect(166, 178, 10, 8);
    g.fillRect(186, 178, 10, 8);

    // Castle Gatehouse / Portcullis
    g.fillStyle(PALETTE.BLACK, 1);
    g.fillRect(148, 220, 28, 40);
    // Portcullis iron bars
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(154, 224, 2, 36);
    g.fillRect(160, 224, 2, 36);
    g.fillRect(166, 224, 2, 36);
    g.fillRect(148, 232, 28, 2);
    g.fillRect(148, 244, 28, 2);

    // Castle Windows & Arrow Slits glowing with torchlight
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillRect(96, 176, 6, 16);
    g.fillRect(222, 156, 6, 16);
    g.fillRect(222, 190, 6, 16);
    g.fillRect(144, 196, 4, 10);
    g.fillRect(176, 196, 4, 10);

    // Royal Banner flying atop the main keep
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(224, 106, 4, 28); // Flagpole
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillTriangle(228, 106, 260, 116, 228, 126); // Pennant

    // 6. Siege Trebuchet in Foreground (Right side, x: 470-580)
    // Wooden Frame
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    // Base beams
    g.fillRect(470, 336, 96, 10);
    // A-Frame supports
    g.beginPath();
    g.moveTo(480, 336);
    g.lineTo(516, 280);
    g.lineTo(524, 280);
    g.lineTo(552, 336);
    g.lineTo(542, 336);
    g.lineTo(520, 288);
    g.lineTo(490, 336);
    g.closePath();
    g.fillPath();

    // Throwing Beam
    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.beginPath();
    g.moveTo(560, 320); // Counterweight end
    g.lineTo(460, 256); // Sling end high
    g.lineTo(464, 250);
    g.lineTo(564, 314);
    g.closePath();
    g.fillPath();

    // Counterweight Box
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(550, 312, 24, 20);
    g.fillStyle(PALETTE.BLACK, 1);
    g.strokeRect(550, 312, 24, 20);

    // 7. Torches burning on the ground
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(430, 324, 4, 20);
    g.fillRect(596, 332, 4, 20);
    // Torch Flames
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillCircle(432, 320, 6);
    g.fillCircle(598, 328, 6);
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillRect(430, 322, 4, 4);
    g.fillRect(596, 330, 4, 4);

    // 8. Distant Campfires
    g.fillStyle(PALETTE.GOLD_BRIGHT, 0.8);
    g.fillRect(350, 274, 6, 4);
    g.fillRect(380, 280, 4, 4);
    g.fillStyle(PALETTE.BLOOD_RED, 0.8);
    g.fillRect(352, 272, 2, 2);

    g.generateTexture(key, 640, 400);
    g.destroy();
  }

  /**
   * Generates Coat of Arms Shields for Saxon and Norman Lords (44x56).
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

    // 1. Drop Shadow
    g.fillStyle(PALETTE.BLACK, 0.7);
    g.beginPath();
    g.moveTo(7, 5);
    g.lineTo(40, 5);
    g.lineTo(40, 33);
    g.lineTo(23, 54);
    g.lineTo(7, 33);
    g.closePath();
    g.fillPath();

    // 2. Shield Gold Border
    g.fillStyle(PALETTE.GOLD_DARK, 1);
    drawShieldPath();
    g.fillPath();

    // 3. Shield Primary Field
    g.fillStyle(primaryColor, 1);
    g.beginPath();
    g.moveTo(8, 6);
    g.lineTo(35, 6);
    g.lineTo(35, 30);
    g.lineTo(22, 48);
    g.lineTo(8, 30);
    g.closePath();
    g.fillPath();

    // 4. Heraldic Charges based on Symbol
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
      // Boar head charge
      g.fillStyle(accentColor, 1);
      g.fillRect(15, 14, 14, 9);
      g.fillRect(11, 17, 6, 5); // Snout
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 16, 3, 3); // Eye
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(11, 20, 3, 4); // Tusk
    } else if (symbol === 'sword') {
      g.fillStyle(secondaryColor, 1);
      for (let i = 0; i < 25; i++) {
        g.fillRect(10 + i, 7 + i, 4, 4);
      }
      // Sword in center
      g.fillStyle(accentColor, 1);
      g.fillRect(21, 10, 3, 28); // Blade
      g.fillRect(17, 32, 11, 3); // Crossguard
      g.fillRect(21, 35, 3, 6);  // Hilt
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(20, 40, 5, 3);  // Pommel
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

    // Specular highlight on shield rim
    g.fillStyle(PALETTE.GOLD_BRIGHT, 0.7);
    g.fillRect(7, 4, 31, 2);
    g.fillRect(5, 4, 2, 25);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Generates 64x64 detailed pixel art portraits for the Saxon Lords.
   */
  public static createLordPortraits(scene: Phaser.Scene): void {
    const size = 64;

    // 1. Ivanhoe
    if (!scene.textures.exists('portrait_ivanhoe')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.STONE_DARK, PALETTE.SHADOW, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Red Tunic
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(11, 43, 42, 21);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(29, 43, 6, 21);
      // Chainmail mantle
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(13, 37, 38, 8);

      // Face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(21, 19, 22, 21);
      g.fillRect(24, 35, 16, 5);

      // Chainmail Coif
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(19, 11, 26, 9);
      g.fillRect(17, 17, 4, 20);
      g.fillRect(43, 17, 4, 20);
      // Highlights
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(22, 12, 3, 3);
      g.fillRect(30, 12, 3, 3);
      g.fillRect(38, 12, 3, 3);

      // Blond Hair fringes
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(24, 19, 16, 3);

      // Eyes
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(24, 24, 4, 3);
      g.fillRect(36, 24, 4, 3);
      // Brows
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(23, 21, 5, 2);
      g.fillRect(36, 21, 5, 2);

      // Nose
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 25, 3, 6);

      // Mustache
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(26, 32, 12, 3);
      g.fillRect(25, 34, 3, 3);
      g.fillRect(36, 34, 3, 3);

      g.generateTexture('portrait_ivanhoe', size, size);
      g.destroy();
    }

    // 2. Cedric
    if (!scene.textures.exists('portrait_cedric')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.WOOD_DARK, PALETTE.BLACK, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Leather & Green tunic
      g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
      g.fillRect(11, 43, 42, 21);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(19, 40, 26, 11);

      // Head
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(21, 16, 22, 21);

      // Long Gray Hair
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(17, 11, 30, 8);
      g.fillRect(16, 16, 5, 24);
      g.fillRect(43, 16, 5, 24);

      // Eyebrows
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(23, 20, 7, 3);
      g.fillRect(34, 20, 7, 3);

      // Eyes
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 24, 4, 3);
      g.fillRect(36, 24, 4, 3);

      // Nose
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 24, 4, 7);

      // Great Gray Beard
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(23, 32, 18, 13);
      g.fillRect(25, 43, 14, 8);
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(27, 35, 10, 3);
      g.fillRect(28, 41, 8, 3);

      g.generateTexture('portrait_cedric', size, size);
      g.destroy();
    }

    // 3. Geoffrey
    if (!scene.textures.exists('portrait_geoffrey')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.SHADOW, PALETTE.BLACK, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Blue Tabard & Steel gorget
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(11, 43, 42, 21);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(24, 40, 16, 5);

      // Face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(23, 17, 18, 20);
      g.fillRect(25, 35, 14, 5);

      // Dark Swept Hair
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(20, 9, 24, 9);
      g.fillRect(19, 15, 5, 19);
      g.fillRect(40, 15, 5, 19);
      g.fillRect(23, 16, 5, 4);

      // Eyes
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(24, 23, 4, 3);
      g.fillRect(36, 23, 4, 3);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(23, 20, 7, 2);
      g.fillRect(34, 20, 7, 2);

      // Nose
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 24, 3, 7);

      // Beard / Goatee
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(27, 32, 10, 3);
      g.fillRect(30, 36, 5, 5);

      g.generateTexture('portrait_geoffrey', size, size);
      g.destroy();
    }

    // 4. Wolfric
    if (!scene.textures.exists('portrait_wolfric')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.STONE_DARK, PALETTE.BLACK, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Wolf fur pelt
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(11, 43, 42, 21);
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(13, 37, 19, 8);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(15, 40, 4, 4);

      // Face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(21, 16, 22, 21);

      // Wild Auburn Hair
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(17, 8, 30, 9);
      g.fillRect(15, 13, 8, 24);
      g.fillRect(41, 13, 8, 24);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(20, 9, 11, 4);
      g.fillRect(33, 9, 11, 4);

      // Brow
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(21, 20, 8, 3);
      g.fillRect(35, 20, 8, 3);

      // Eyes
      g.fillStyle(PALETTE.FOLIAGE_MID, 1);
      g.fillRect(24, 23, 4, 3);
      g.fillRect(36, 23, 4, 3);

      // Nose & Scar
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(31, 23, 4, 7);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(27, 21, 3, 5); // Battle scar

      // Full Wild Red Beard
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(21, 31, 22, 13);
      g.fillRect(24, 43, 16, 8);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(25, 33, 14, 4);
      g.fillRect(28, 41, 8, 5);

      g.generateTexture('portrait_wolfric', size, size);
      g.destroy();
    }
  }

  /**
   * Initializes all procedural art textures at boot time.
   */
  public static generateAll(scene: Phaser.Scene): void {
    // 1. Backdrops (640x400)
    this.createTitleBackdrop(scene);

    // 2. Lord Portraits (64x64)
    this.createLordPortraits(scene);

    // 3. Saxon Lord Shields (44x56)
    this.createHeraldicShield(scene, 'shield_ivanhoe', PALETTE.BLOOD_RED, PALETTE.GOLD_BRIGHT, PALETTE.PARCHMENT_LIGHT, 'cross');
    this.createHeraldicShield(scene, 'shield_cedric', PALETTE.FOLIAGE_MID, PALETTE.GOLD_BRIGHT, PALETTE.WOOD_DARK, 'boar');
    this.createHeraldicShield(scene, 'shield_geoffrey', PALETTE.ROYAL_BLUE, PALETTE.STONE_LIGHT, PALETTE.GOLD_DARK, 'sword');
    this.createHeraldicShield(scene, 'shield_wolfric', PALETTE.WOOD_MID, PALETTE.PARCHMENT_LIGHT, PALETTE.STONE_DARK, 'wolf');

    // 4. Norman Lord Shields
    this.createHeraldicShield(scene, 'shield_malvoisin', PALETTE.STONE_DARK, PALETTE.BLOOD_RED, PALETTE.GOLD_DARK, 'falcon');
    this.createHeraldicShield(scene, 'shield_frontdeboeuf', PALETTE.BLACK, PALETTE.GOLD_DARK, PALETTE.BLOOD_RED, 'axe');
    this.createHeraldicShield(scene, 'shield_boisguilbert', PALETTE.STONE_LIGHT, PALETTE.BLOOD_RED, PALETTE.BLACK, 'lion');
  }
}
