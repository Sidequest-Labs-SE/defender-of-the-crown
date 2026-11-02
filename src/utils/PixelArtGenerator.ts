import Phaser from 'phaser';
import { PALETTE } from '../data/palette';

/**
 * PixelArtGenerator
 * Generates all 1986 Amiga OCS pixel-art textures procedurally using Phaser Graphics.
 * Employs classic Amiga 2x2 and checkerboard dithering to simulate deep 32-color palettes.
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
    // Fill background with colorA
    g.fillStyle(colorA, 1);
    g.fillRect(x, y, w, h);

    // Dither colorB over top
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
   * Generates the iconic Title Screen Castle Siege backdrop (320x200).
   */
  public static createTitleBackdrop(scene: Phaser.Scene): void {
    const key = 'title_backdrop';
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });

    // 1. Sky Gradient with Dithered Bands
    // Band 1: Deep Black / Midnight
    g.fillStyle(PALETTE.BLACK, 1);
    g.fillRect(0, 0, 320, 35);

    // Band 1 -> 2 Dither
    this.drawDitheredRect(g, 0, 30, 320, 10, PALETTE.BLACK, PALETTE.SHADOW, 'checker');

    // Band 2: Deep Night Blue
    g.fillStyle(PALETTE.SHADOW, 1);
    g.fillRect(0, 40, 320, 25);

    // Band 2 -> 3 Dither
    this.drawDitheredRect(g, 0, 60, 320, 10, PALETTE.SHADOW, PALETTE.SKY_NIGHT, 'checker');

    // Band 3: Dark Blue
    g.fillStyle(PALETTE.SKY_NIGHT, 1);
    g.fillRect(0, 70, 320, 30);

    // Band 3 -> 4 Dither
    this.drawDitheredRect(g, 0, 95, 320, 10, PALETTE.SKY_NIGHT, PALETTE.SKY_MID, 'checker');

    // Band 4: Horizon Blue
    g.fillStyle(PALETTE.SKY_MID, 1);
    g.fillRect(0, 105, 320, 25);

    // 2. Full Autumn Moon
    const moonX = 250;
    const moonY = 38;
    const moonR = 16;
    // Outer glow
    g.fillStyle(PALETTE.GOLD_DARK, 0.4);
    g.fillCircle(moonX, moonY, moonR + 3);
    // Moon body
    g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
    g.fillCircle(moonX, moonY, moonR);
    // Moon craters / texture
    g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
    g.fillCircle(moonX - 4, moonY - 3, 4);
    g.fillCircle(moonX + 5, moonY + 4, 3);
    g.fillCircle(moonX + 2, moonY - 5, 2);

    // 3. Distant Misty Hills
    g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
    g.beginPath();
    g.moveTo(0, 120);
    g.lineTo(80, 105);
    g.lineTo(160, 115);
    g.lineTo(240, 102);
    g.lineTo(320, 112);
    g.lineTo(320, 135);
    g.lineTo(0, 135);
    g.closePath();
    g.fillPath();

    this.drawDitheredRect(g, 0, 125, 320, 8, PALETTE.FOLIAGE_DARK, PALETTE.FOLIAGE_MID, 'checker');

    // 4. Foreground Slopes / Valley
    g.fillStyle(PALETTE.FOLIAGE_MID, 1);
    g.beginPath();
    g.moveTo(0, 133);
    g.lineTo(110, 128);
    g.lineTo(210, 135);
    g.lineTo(320, 128);
    g.lineTo(320, 200);
    g.lineTo(0, 200);
    g.closePath();
    g.fillPath();

    // Foliage highlights & dithered shadows
    this.drawDitheredRect(g, 0, 145, 120, 55, PALETTE.FOLIAGE_MID, PALETTE.FOLIAGE_LIGHT, 'sparse');
    this.drawDitheredRect(g, 120, 155, 200, 45, PALETTE.FOLIAGE_MID, PALETTE.FOLIAGE_DARK, 'checker');

    // 5. Majestic Castle Silhouette on the Hill (Left-Center, x: 20-130)
    // Castle Base Rock
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(35, 122, 100, 40);

    // Main Keep / Towers
    // Left Tower
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(40, 80, 22, 50);
    // Crenelations Left Tower
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(40, 77, 6, 4);
    g.fillRect(48, 77, 6, 4);
    g.fillRect(56, 77, 6, 4);
    // Shading on tower wall
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(40, 81, 3, 48);

    // Right Tower (Taller)
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(100, 70, 26, 60);
    // Crenelations Right Tower
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(100, 66, 6, 5);
    g.fillRect(110, 66, 6, 5);
    g.fillRect(120, 66, 6, 5);
    // Tower highlights
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(100, 71, 3, 58);

    // Central Curtain Wall
    g.fillStyle(PALETTE.STONE_MID, 1);
    g.fillRect(62, 92, 38, 38);
    // Wall crenelations
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(63, 89, 5, 4);
    g.fillRect(73, 89, 5, 4);
    g.fillRect(83, 89, 5, 4);
    g.fillRect(93, 89, 5, 4);

    // Castle Gatehouse / Portcullis
    g.fillStyle(PALETTE.BLACK, 1);
    g.fillRect(74, 110, 14, 20);
    // Portcullis iron bars
    g.fillStyle(PALETTE.STONE_LIGHT, 1);
    g.fillRect(77, 112, 1, 18);
    g.fillRect(80, 112, 1, 18);
    g.fillRect(83, 112, 1, 18);
    g.fillRect(74, 116, 14, 1);
    g.fillRect(74, 122, 14, 1);

    // Castle Windows & Arrow Slits glowing with torchlight
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillRect(48, 88, 3, 8);
    g.fillRect(111, 78, 3, 8);
    g.fillRect(111, 95, 3, 8);
    g.fillRect(72, 98, 2, 5);
    g.fillRect(88, 98, 2, 5);

    // Banner flying atop the main keep
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(112, 53, 2, 14); // Flagpole
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillTriangle(114, 53, 130, 58, 114, 63); // Pennant

    // 6. Siege Trebuchet / Catapult in Foreground (Right side, x: 230-290)
    // Wooden Frame
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    // Base beams
    g.fillRect(235, 168, 48, 5);
    // A-Frame supports
    g.beginPath();
    g.moveTo(240, 168);
    g.lineTo(258, 140);
    g.lineTo(262, 140);
    g.lineTo(276, 168);
    g.lineTo(271, 168);
    g.lineTo(260, 144);
    g.lineTo(245, 168);
    g.closePath();
    g.fillPath();
    // Throwing Beam (pointing toward castle)
    g.fillStyle(PALETTE.WOOD_MID, 1);
    g.beginPath();
    g.moveTo(280, 160); // Counterweight end
    g.lineTo(230, 128); // Sling end high
    g.lineTo(232, 125);
    g.lineTo(282, 157);
    g.closePath();
    g.fillPath();
    // Heavy Counterweight Box
    g.fillStyle(PALETTE.STONE_DARK, 1);
    g.fillRect(275, 156, 12, 10);
    g.fillStyle(PALETTE.BLACK, 1);
    g.strokeRect(275, 156, 12, 10);

    // 7. Torches burning on the ground / siege camp
    g.fillStyle(PALETTE.WOOD_DARK, 1);
    g.fillRect(215, 162, 2, 10);
    g.fillRect(298, 166, 2, 10);
    // Torch Flames
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    g.fillCircle(216, 160, 3);
    g.fillCircle(299, 164, 3);
    g.fillStyle(PALETTE.BLOOD_RED, 1);
    g.fillRect(215, 161, 2, 2);
    g.fillRect(298, 165, 2, 2);

    // 8. Distant Campfires
    g.fillStyle(PALETTE.GOLD_BRIGHT, 0.8);
    g.fillRect(175, 137, 3, 2);
    g.fillRect(190, 140, 2, 2);
    g.fillStyle(PALETTE.BLOOD_RED, 0.8);
    g.fillRect(176, 136, 1, 1);

    g.generateTexture(key, 320, 200);
    g.destroy();
  }

  /**
   * Generates a medieval ornamental stone / parchment panel.
   */
  public static createPanelTexture(
    scene: Phaser.Scene,
    key: string,
    w: number,
    h: number,
    fillColor = PALETTE.PARCHMENT_LIGHT,
    borderColor = PALETTE.WOOD_DARK
  ): void {
    if (scene.textures.exists(key)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });

    // Outer shadow
    g.fillStyle(PALETTE.BLACK, 0.6);
    g.fillRect(2, 2, w, h);

    // Outer dark border
    g.fillStyle(borderColor, 1);
    g.fillRect(0, 0, w, h);

    // Inner gold trim
    g.fillStyle(PALETTE.GOLD_DARK, 1);
    g.strokeRect(2, 2, w - 4, h - 4);

    // Parchment interior
    g.fillStyle(fillColor, 1);
    g.fillRect(3, 3, w - 6, h - 6);

    // Subtle dithered texture on parchment
    this.drawDitheredRect(g, 4, 4, w - 8, h - 8, fillColor, PALETTE.PARCHMENT_DARK, 'sparse');

    // Ornate Medieval Corner Brackets
    const cornerSize = 5;
    g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
    // Top-left
    g.fillRect(2, 2, cornerSize, 2);
    g.fillRect(2, 2, 2, cornerSize);
    // Top-right
    g.fillRect(w - 2 - cornerSize, 2, cornerSize, 2);
    g.fillRect(w - 4, 2, 2, cornerSize);
    // Bottom-left
    g.fillRect(2, h - 4, cornerSize, 2);
    g.fillRect(2, h - 2 - cornerSize, 2, cornerSize);
    // Bottom-right
    g.fillRect(w - 2 - cornerSize, h - 4, cornerSize, 2);
    g.fillRect(w - 4, h - 2 - cornerSize, 2, cornerSize);

    // Corner Studs / Rivets
    g.fillStyle(PALETTE.BLACK, 1);
    g.fillRect(3, 3, 1, 1);
    g.fillRect(w - 4, 3, 1, 1);
    g.fillRect(3, h - 4, 1, 1);
    g.fillRect(w - 4, h - 4, 1, 1);

    g.generateTexture(key, w + 2, h + 2);
    g.destroy();
  }

  /**
   * Generates interactive button states.
   */
  public static createButtonTextures(scene: Phaser.Scene): void {
    const states = [
      { key: 'btn_wood_normal', bg: PALETTE.WOOD_MID, border: PALETTE.GOLD_DARK, textHighlight: PALETTE.PARCHMENT_LIGHT },
      { key: 'btn_wood_hover', bg: PALETTE.WOOD_DARK, border: PALETTE.GOLD_BRIGHT, textHighlight: PALETTE.GOLD_BRIGHT },
      { key: 'btn_wood_active', bg: PALETTE.BLACK, border: PALETTE.BLOOD_RED, textHighlight: PALETTE.GOLD_DARK },
    ];

    const w = 110;
    const h = 20;

    for (const s of states) {
      if (scene.textures.exists(s.key)) continue;
      const g = scene.make.graphics({ x: 0, y: 0 });

      // Drop shadow
      g.fillStyle(PALETTE.BLACK, 0.7);
      g.fillRect(2, 2, w - 2, h - 2);

      // Border
      g.fillStyle(s.border, 1);
      g.fillRect(0, 0, w - 2, h - 2);

      // Face
      g.fillStyle(s.bg, 1);
      g.fillRect(2, 2, w - 6, h - 6);

      // Highlight line on top and left edge
      g.fillStyle(s.textHighlight, 0.6);
      g.fillRect(2, 2, w - 6, 1);
      g.fillRect(2, 2, 1, h - 6);

      g.generateTexture(s.key, w, h);
      g.destroy();
    }
  }

  /**
   * Generates Coat of Arms Shields for Saxon and Norman Lords (32x40).
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
    const w = 32;
    const h = 40;

    // Shield Silhouette Points:
    // Top flat: (3, 2) to (28, 2)
    // Sides straight down to y = 24
    // Pointed bottom curving to (16, 38)
    const drawShieldPath = () => {
      g.beginPath();
      g.moveTo(4, 2);
      g.lineTo(27, 2);
      g.lineTo(27, 22);
      g.lineTo(16, 37);
      g.lineTo(4, 22);
      g.closePath();
    };

    // 1. Drop Shadow
    g.fillStyle(PALETTE.BLACK, 0.7);
    g.beginPath();
    g.moveTo(6, 4);
    g.lineTo(29, 4);
    g.lineTo(29, 23);
    g.lineTo(17, 39);
    g.lineTo(6, 23);
    g.closePath();
    g.fillPath();

    // 2. Shield Gold Border
    g.fillStyle(PALETTE.GOLD_DARK, 1);
    drawShieldPath();
    g.fillPath();

    // 3. Shield Primary Field (inset by 2px)
    g.fillStyle(primaryColor, 1);
    g.beginPath();
    g.moveTo(6, 4);
    g.lineTo(25, 4);
    g.lineTo(25, 21);
    g.lineTo(16, 34);
    g.lineTo(6, 21);
    g.closePath();
    g.fillPath();

    // 4. Heraldic Charges & Divisions based on Symbol
    if (symbol === 'cross') {
      // St. George style cross
      g.fillStyle(secondaryColor, 1);
      g.fillRect(14, 4, 4, 30); // Vertical bar
      g.fillRect(6, 12, 19, 4); // Horizontal bar
      // Accent outline
      g.fillStyle(accentColor, 1);
      g.fillRect(15, 5, 2, 28);
      g.fillRect(7, 13, 17, 2);
    } else if (symbol === 'boar') {
      // Quarterly division
      g.fillStyle(secondaryColor, 1);
      g.fillRect(15, 4, 10, 12);
      g.fillRect(6, 16, 9, 10);
      // Boar head charge
      g.fillStyle(accentColor, 1);
      g.fillRect(11, 10, 10, 6);
      g.fillRect(8, 12, 4, 3); // Snout
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(17, 11, 2, 2); // Eye
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(8, 14, 2, 3); // Tusk
    } else if (symbol === 'sword') {
      // Diagonal bend
      g.fillStyle(secondaryColor, 1);
      for (let i = 0; i < 18; i++) {
        g.fillRect(7 + i, 5 + i, 3, 3);
      }
      // Sword in center
      g.fillStyle(accentColor, 1);
      g.fillRect(15, 7, 2, 20); // Blade
      g.fillRect(12, 23, 8, 2); // Crossguard
      g.fillRect(15, 25, 2, 4); // Hilt
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(14, 28, 4, 2); // Pommel
    } else if (symbol === 'wolf') {
      // Wolf Head Motif
      g.fillStyle(secondaryColor, 1);
      g.fillTriangle(16, 8, 9, 24, 23, 24);
      // Wolf silhouette
      g.fillStyle(accentColor, 1);
      g.fillTriangle(16, 10, 11, 20, 21, 20);
      // Ears
      g.fillRect(11, 7, 3, 4);
      g.fillRect(18, 7, 3, 4);
      // Fierce glowing eyes
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(13, 13, 2, 2);
      g.fillRect(17, 13, 2, 2);
      // Muzzle
      g.fillRect(14, 18, 4, 4);
    } else if (symbol === 'falcon') {
      // Falcon / Bird of prey
      g.fillStyle(secondaryColor, 1);
      g.fillTriangle(16, 6, 8, 16, 24, 16); // Wings
      g.fillRect(14, 16, 4, 10); // Body
      g.fillStyle(accentColor, 1);
      g.fillRect(15, 9, 2, 2); // Eye
      g.fillRect(16, 11, 3, 2); // Beak
    } else if (symbol === 'axe') {
      // Battle Axe
      g.fillStyle(secondaryColor, 1);
      g.fillRect(15, 7, 2, 22); // Shaft
      g.fillStyle(accentColor, 1);
      // Double blades
      g.fillRect(10, 10, 5, 8);
      g.fillRect(17, 10, 5, 8);
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(14, 9, 4, 10);
    } else if (symbol === 'lion') {
      // Rampant Lion
      g.fillStyle(secondaryColor, 1);
      g.fillRect(12, 10, 8, 14); // Torso
      g.fillRect(14, 7, 6, 5);   // Head
      g.fillRect(9, 9, 4, 3);    // Forepaw up
      g.fillRect(18, 12, 4, 3);   // Forepaw down
      g.fillRect(10, 22, 4, 5);  // Hind leg
      g.fillRect(17, 21, 4, 6);  // Rear leg
      // Tail
      g.fillRect(8, 14, 2, 7);
      g.fillRect(7, 13, 2, 2);
      g.fillStyle(accentColor, 1);
      g.fillRect(15, 8, 1, 1); // Eye
    }

    // 5. Specular highlight on shield rim
    g.fillStyle(PALETTE.GOLD_BRIGHT, 0.7);
    g.fillRect(5, 3, 22, 1);
    g.fillRect(4, 3, 1, 18);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Generates 48x48 pixel art portraits for the Saxon Lords.
   */
  public static createLordPortraits(scene: Phaser.Scene): void {
    const size = 48;

    // 1. Ivanhoe: Blond hair, silver helm/coif, noble blue eyes, red/gold tunic
    if (!scene.textures.exists('portrait_ivanhoe')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      // Background stone arch
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.STONE_DARK, PALETTE.SHADOW, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Red Tunic
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(8, 32, 32, 16);
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(22, 32, 4, 16); // Gold trim on tunic
      // Shoulders / Chainmail mantle
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(10, 28, 28, 6);

      // Face / Flesh
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(16, 14, 16, 16);
      // Jaw / Chin
      g.fillRect(18, 26, 12, 4);

      // Chainmail Coif around head
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(14, 8, 20, 7);
      g.fillRect(13, 13, 3, 15);
      g.fillRect(32, 13, 3, 15);
      // Chainmail texture dots
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(16, 9, 2, 2);
      g.fillRect(22, 9, 2, 2);
      g.fillRect(28, 9, 2, 2);

      // Blond / Light Hair fringes
      g.fillStyle(PALETTE.GOLD_BRIGHT, 1);
      g.fillRect(18, 14, 12, 2);

      // Eyes
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(18, 18, 3, 2);
      g.fillRect(27, 18, 3, 2);
      // Eyebrows
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(17, 16, 4, 1);
      g.fillRect(27, 16, 4, 1);

      // Nose
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(23, 19, 2, 4);

      // Noble Mustache
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(20, 24, 8, 2);
      g.fillRect(19, 25, 2, 2);
      g.fillRect(27, 25, 2, 2);

      g.generateTexture('portrait_ivanhoe', size, size);
      g.destroy();
    }

    // 2. Cedric: Older, gray hair and thick beard, leather & brass armor, determined
    if (!scene.textures.exists('portrait_cedric')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.WOOD_DARK, PALETTE.BLACK, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Dark Forest Tunic with leather harness
      g.fillStyle(PALETTE.FOLIAGE_DARK, 1);
      g.fillRect(8, 32, 32, 16);
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(14, 30, 20, 8); // Leather mantle

      // Head / Face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(16, 12, 16, 16);

      // Long Gray Hair
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(13, 8, 22, 6);
      g.fillRect(12, 12, 4, 18);
      g.fillRect(32, 12, 4, 18);

      // Bushy Gray Eyebrows
      g.fillStyle(PALETTE.STONE_DARK, 1);
      g.fillRect(17, 15, 5, 2);
      g.fillRect(26, 15, 5, 2);

      // Piercing eyes
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(18, 18, 3, 2);
      g.fillRect(27, 18, 3, 2);

      // Weathered Nose
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(23, 18, 3, 5);

      // Great Gray Beard
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(17, 24, 14, 10);
      g.fillRect(19, 32, 10, 6);
      // Beard dither / shading
      g.fillStyle(PALETTE.STONE_MID, 1);
      g.fillRect(20, 26, 8, 2);
      g.fillRect(21, 30, 6, 2);

      g.generateTexture('portrait_cedric', size, size);
      g.destroy();
    }

    // 3. Geoffrey: Steel blade master, dark locks, blue tabard, lean keen gaze
    if (!scene.textures.exists('portrait_geoffrey')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.SHADOW, PALETTE.BLACK, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Royal Blue Tabard with steel gorget
      g.fillStyle(PALETTE.ROYAL_BLUE, 1);
      g.fillRect(8, 32, 32, 16);
      g.fillStyle(PALETTE.STONE_LIGHT, 1);
      g.fillRect(18, 30, 12, 4); // Steel collar

      // Face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(17, 13, 14, 15);
      g.fillRect(19, 26, 10, 4);

      // Dark Swept Hair
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(15, 7, 18, 7);
      g.fillRect(14, 11, 4, 14);
      g.fillRect(30, 11, 4, 14);
      g.fillRect(17, 12, 4, 3); // Forelock

      // Sharp dark eyes
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(18, 17, 3, 2);
      g.fillRect(27, 17, 3, 2);
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(17, 15, 5, 1);
      g.fillRect(26, 15, 5, 1);

      // Nose
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(23, 18, 2, 5);

      // Chin goatee / trim beard
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(20, 24, 8, 2); // Thin mustache
      g.fillRect(22, 27, 4, 4); // Goatee

      g.generateTexture('portrait_geoffrey', size, size);
      g.destroy();
    }

    // 4. Wolfric: Wild warlord, red hair and wild beard, wolf pelt on shoulder
    if (!scene.textures.exists('portrait_wolfric')) {
      const g = scene.make.graphics({ x: 0, y: 0 });
      this.drawDitheredRect(g, 0, 0, size, size, PALETTE.STONE_DARK, PALETTE.BLACK, 'checker');
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.strokeRect(1, 1, size - 2, size - 2);

      // Torso / Wolf fur pelt
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(8, 32, 32, 16);
      // Fur texture across shoulder
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(10, 28, 14, 6);
      g.fillStyle(PALETTE.BLACK, 1);
      g.fillRect(11, 30, 3, 3); // Wolf snout clasp

      // Face
      g.fillStyle(PALETTE.PARCHMENT_LIGHT, 1);
      g.fillRect(16, 12, 16, 16);

      // Wild Auburn / Red Hair
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(13, 6, 22, 7);
      g.fillRect(11, 10, 6, 18);
      g.fillRect(31, 10, 6, 18);
      // Hair volume
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(15, 7, 8, 3);
      g.fillRect(25, 7, 8, 3);

      // Fierce Brow
      g.fillStyle(PALETTE.WOOD_DARK, 1);
      g.fillRect(16, 15, 6, 2);
      g.fillRect(26, 15, 6, 2);

      // Green / Wild Eyes
      g.fillStyle(PALETTE.FOLIAGE_MID, 1);
      g.fillRect(18, 17, 3, 2);
      g.fillRect(27, 17, 3, 2);

      // Rugged Nose with scar
      g.fillStyle(PALETTE.PARCHMENT_DARK, 1);
      g.fillRect(23, 17, 3, 5);
      g.fillStyle(PALETTE.BLOOD_RED, 1);
      g.fillRect(20, 16, 2, 4); // Battle scar

      // Full Wild Red Beard
      g.fillStyle(PALETTE.WOOD_MID, 1);
      g.fillRect(16, 23, 16, 10);
      g.fillRect(18, 32, 12, 6);
      // Beard highlights
      g.fillStyle(PALETTE.GOLD_DARK, 1);
      g.fillRect(19, 25, 10, 3);
      g.fillRect(21, 31, 6, 4);

      g.generateTexture('portrait_wolfric', size, size);
      g.destroy();
    }
  }

  /**
   * Initializes all procedural art textures at boot time.
   */
  public static generateAll(scene: Phaser.Scene): void {
    // 1. Backdrops
    this.createTitleBackdrop(scene);

    // 2. UI Panels
    this.createPanelTexture(scene, 'panel_parchment', 160, 100);
    this.createPanelTexture(scene, 'panel_stat_box', 280, 52);
    this.createPanelTexture(scene, 'panel_bio', 290, 75);
    this.createPanelTexture(scene, 'panel_verify', 296, 160);

    // 3. UI Buttons
    this.createButtonTextures(scene);

    // 4. Saxon Lord Portraits
    this.createLordPortraits(scene);

    // 5. Saxon Lord Shields
    this.createHeraldicShield(scene, 'shield_ivanhoe', PALETTE.BLOOD_RED, PALETTE.GOLD_BRIGHT, PALETTE.PARCHMENT_LIGHT, 'cross');
    this.createHeraldicShield(scene, 'shield_cedric', PALETTE.FOLIAGE_MID, PALETTE.GOLD_BRIGHT, PALETTE.WOOD_DARK, 'boar');
    this.createHeraldicShield(scene, 'shield_geoffrey', PALETTE.ROYAL_BLUE, PALETTE.STONE_LIGHT, PALETTE.GOLD_DARK, 'sword');
    this.createHeraldicShield(scene, 'shield_wolfric', PALETTE.WOOD_MID, PALETTE.PARCHMENT_LIGHT, PALETTE.STONE_DARK, 'wolf');

    // 6. Norman Lord Shields
    this.createHeraldicShield(scene, 'shield_malvoisin', PALETTE.STONE_DARK, PALETTE.BLOOD_RED, PALETTE.GOLD_DARK, 'falcon');
    this.createHeraldicShield(scene, 'shield_frontdeboeuf', PALETTE.BLACK, PALETTE.GOLD_DARK, PALETTE.BLOOD_RED, 'axe');
    this.createHeraldicShield(scene, 'shield_boisguilbert', PALETTE.STONE_LIGHT, PALETTE.BLOOD_RED, PALETTE.BLACK, 'lion');
  }
}
