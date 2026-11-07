import Phaser from 'phaser';
import { SIDEQUEST_PALETTE, SIDEQUEST_PALETTE_HEX } from '../data/palette';
import { ALL_LORDS } from '../data/lords';
import { SAXON_DAMSELS } from '../data/damsels';
import { Lord, Season } from '../core/types';

/**
 * SIDEQUEST LABS EDITION — HD-Retro Procedural Pixel-Art & Texture Pipeline
 *
 * Generates 90s NeoGeo / SNES-Plus / 32-bit Era pixel-art textures under isolated `sq_*`
 * texture keys (`NEAREST` filtering on pixel-art portraits, shields, and sprites) while
 * leaving all `CLASSIC` 1986 texture keys 100% untouched for zero regression.
 */
export class SidequestArtGenerator {
  public static generateAll(scene: Phaser.Scene): void {
    if (scene.textures.exists('sq_title_backdrop')) {
      return;
    }

    const steps: Array<[string, () => void]> = [
      ['generateTitleBackdrop', () => this.generateTitleBackdrop(scene)],
      ['generateLordPortraits', () => this.generateLordPortraits(scene)],
      ['generateDamselPortraits', () => this.generateDamselPortraits(scene)],
      ['generateHeraldryShields', () => this.generateHeraldryShields(scene)],
      ['generateMapSeasonalAssets', () => this.generateMapSeasonalAssets(scene)],
      ['generateBattleSeasonalAssets', () => this.generateBattleSeasonalAssets(scene)],
      ['generateSiegeAssets', () => this.generateSiegeAssets(scene)],
      ['generateSwordplayAssets', () => this.generateSwordplayAssets(scene)],
      ['generateJoustAssets', () => this.generateJoustAssets(scene)],
      ['generateNavalAssets', () => this.generateNavalAssets(scene)],
      ['generateArcheryAssets', () => this.generateArcheryAssets(scene)],
      ['generateRelicAssets', () => this.generateRelicAssets(scene)],
    ];

    for (const [name, fn] of steps) {
      try {
        fn();
      } catch (err) {
        console.error(`[SidequestArtGenerator] Error in ${name}:`, err);
      }
    }
  }

  /**
   * Resolves a portrait texture key based on whether Sidequest Labs Edition is active.
   * Accepts either a raw id ('ivanhoe', 'rowena', 'garrison') or a prefixed key ('portrait_ivanhoe').
   */
  public static getPortraitKey(
    scene: Phaser.Scene,
    idOrKey: string,
    isSidequest: boolean
  ): string {
    const cleanId = idOrKey
      .replace(/^sq_portrait_/, '')
      .replace(/^portrait_/, '');
    if (isSidequest) {
      const sqKey = `sq_portrait_${cleanId}`;
      if (scene.textures.exists(sqKey)) {
        return sqKey;
      }
    }
    const classicKey = `portrait_${cleanId}`;
    return scene.textures.exists(classicKey) ? classicKey : idOrKey;
  }

  /**
   * Resolves a heraldic shield texture key based on whether Sidequest Labs Edition is active.
   */
  public static getShieldKey(
    scene: Phaser.Scene,
    idOrKey: string,
    isSidequest: boolean
  ): string {
    const cleanId = idOrKey
      .replace(/^sq_shield_/, '')
      .replace(/^shield_/, '');
    if (isSidequest) {
      const sqKey = `sq_shield_${cleanId}`;
      if (scene.textures.exists(sqKey)) {
        return sqKey;
      }
    }
    const classicKey = `shield_${cleanId}`;
    return scene.textures.exists(classicKey) ? classicKey : idOrKey;
  }

  /**
   * Resolves a map icon texture key ('icon_castle', 'icon_home_castle', 'icon_sherwood') for active edition.
   */
  public static getMapIconKey(
    scene: Phaser.Scene,
    baseKey: 'icon_castle' | 'icon_home_castle' | 'icon_sherwood' | 'icon_market' | 'icon_royal_keep' | string,
    isSidequest: boolean
  ): string {
    if (isSidequest) {
      const sqKey = `sq_${baseKey}`;
      if (scene.textures.exists(sqKey)) {
        return sqKey;
      }
    }
    return baseKey;
  }

  /**
   * Resolves the seasonal Britain map ocean/coastal base texture for Sidequest Labs Edition.
   */
  public static getMapBackdropKey(
    scene: Phaser.Scene,
    season: Season,
    isSidequest: boolean
  ): string {
    if (!isSidequest) return 'map_britain_base';
    const sqKey = `sq_map_britain_${season.toLowerCase()}`;
    return scene.textures.exists(sqKey) ? sqKey : 'map_britain_base';
  }

  /**
   * Resolves the seasonal BattleScene backdrop texture for Sidequest Labs Edition.
   */
  public static getBattleBackdropKey(
    scene: Phaser.Scene,
    hasCastle: boolean,
    season: Season,
    isSidequest: boolean
  ): string {
    if (!isSidequest) {
      return hasCastle ? 'battle_bg_siege' : 'battle_bg_field';
    }
    const kind = hasCastle ? 'siege' : 'field';
    const sqKey = `sq_battle_bg_${kind}_${season.toLowerCase()}`;
    if (scene.textures.exists(sqKey)) return sqKey;
    return hasCastle ? 'battle_bg_siege' : 'battle_bg_field';
  }

  /**
   * Renders an ornate, animated gleaming metallic portrait/crest frame in `SIDEQUEST_LABS` mode.
   */
  public static addGleamingFrame(
    scene: Phaser.Scene,
    targetContainer: Phaser.GameObjects.Container | null,
    cx: number,
    cy: number,
    width: number,
    height: number,
    accentColor: number = SIDEQUEST_PALETTE.GOLD_GLEAM
  ): Phaser.GameObjects.Container {
    const wrap = scene.add.container(cx, cy);
    const hw = width / 2;
    const hh = height / 2;

    const frameG = scene.add.graphics();
    // Outer shadow bevel
    frameG.lineStyle(3, SIDEQUEST_PALETTE.BRONZE_SHADOW, 0.95);
    frameG.strokeRect(-hw - 2, -hh - 2, width + 4, height + 4);
    // Primary royal metallic rim
    frameG.lineStyle(2, accentColor, 1);
    frameG.strokeRect(-hw - 1, -hh - 1, width + 2, height + 2);
    // Inner specular highlight
    frameG.lineStyle(1, SIDEQUEST_PALETTE.GOLD_SPECULAR, 0.65);
    frameG.strokeRect(-hw + 1, -hh + 1, width - 2, height - 2);

    // Ornate corner rivets / cabochons
    const corners = [
      [-hw - 1, -hh - 1],
      [hw + 1, -hh - 1],
      [-hw - 1, hh + 1],
      [hw + 1, hh + 1],
    ];
    for (const [rx, ry] of corners) {
      frameG.fillStyle(SIDEQUEST_PALETTE.BRONZE_SHADOW, 1);
      frameG.fillCircle(rx, ry, 3);
      frameG.fillStyle(SIDEQUEST_PALETTE.GOLD_SPECULAR, 1);
      frameG.fillCircle(rx - 0.5, ry - 0.5, 1.6);
    }
    wrap.add(frameG);

    // Animated gleaming border pulse
    const gleamG = scene.add.graphics();
    gleamG.lineStyle(1.8, SIDEQUEST_PALETTE.GOLD_SPECULAR, 0.85);
    gleamG.strokeRect(-hw - 1, -hh - 1, width + 2, height + 2);
    gleamG.setAlpha(0.15);
    wrap.add(gleamG);

    scene.tweens.add({
      targets: gleamG,
      alpha: { from: 0.12, to: 0.72 },
      duration: 1650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    if (targetContainer) {
      targetContainer.add(wrap);
    }
    return wrap;
  }

  // ==========================================================================
  // 1. SIDEQUEST LABS TITLE BACKDROP (1280x720 MOONLIT CASTLE SIEGE)
  // ==========================================================================

  private static generateTitleBackdrop(scene: Phaser.Scene): void {
    const tex = scene.textures.createCanvas('sq_title_backdrop', 1280, 720);
    if (!tex) return;
    const ctx = tex.getContext();

    // Rich 32-bit twilight indigo-to-violet-to-ember horizon gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 560);
    skyGrad.addColorStop(0, '#070A16');
    skyGrad.addColorStop(0.32, '#131D3B');
    skyGrad.addColorStop(0.66, '#27294F');
    skyGrad.addColorStop(0.88, '#462A3E');
    skyGrad.addColorStop(1, '#6B3429');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1280, 720);

    // Pixel starfield with cross-twinkle stars
    let seed = 41986;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 140; i++) {
      const sx = Math.floor(nextRand() * 1280);
      const sy = Math.floor(nextRand() * 340);
      const bright = nextRand() > 0.72;
      ctx.fillStyle = bright ? '#FFF4C8' : '#9CB8E8';
      ctx.fillRect(sx, sy, 2, 2);
      if (bright && i % 5 === 0) {
        ctx.fillStyle = 'rgba(255, 244, 200, 0.45)';
        ctx.fillRect(sx - 2, sy, 6, 2);
        ctx.fillRect(sx, sy - 2, 2, 6);
      }
    }

    // Luminous Harvest Moon with atmospheric halo & pixel craters
    const moonX = 985;
    const moonY = 152;
    const halo = ctx.createRadialGradient(moonX, moonY, 40, moonX, moonY, 210);
    halo.addColorStop(0, 'rgba(255, 236, 179, 0.42)');
    halo.addColorStop(0.45, 'rgba(148, 178, 236, 0.16)');
    halo.addColorStop(1, 'rgba(18, 28, 58, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(moonX - 220, moonY - 220, 440, 440);

    ctx.fillStyle = '#FFF4D2';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E6D2A2';
    ctx.beginPath();
    ctx.arc(moonX - 16, moonY - 12, 11, 0, Math.PI * 2);
    ctx.arc(moonX + 18, moonY + 14, 15, 0, Math.PI * 2);
    ctx.arc(moonX - 8, moonY + 24, 8, 0, Math.PI * 2);
    ctx.fill();

    // Distant mountain ridges
    ctx.fillStyle = '#181E36';
    ctx.beginPath();
    ctx.moveTo(0, 470);
    for (let x = 0; x <= 1280; x += 64) {
      const ridgeY = 415 + Math.sin(x * 0.008) * 38 + Math.cos(x * 0.021) * 18;
      ctx.lineTo(x, ridgeY);
    }
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();

    // Moonlit Norman/Saxon Fortress Keep on Left-Center Crag (x: 80..410)
    ctx.fillStyle = '#24293D';
    ctx.fillRect(108, 300, 236, 210);
    ctx.fillRect(86, 268, 56, 242);
    ctx.fillRect(312, 276, 56, 234);
    ctx.fillRect(184, 232, 84, 278);

    // Moonlit right-edge specular rim on towers
    ctx.fillStyle = '#536285';
    ctx.fillRect(136, 268, 6, 220);
    ctx.fillRect(262, 232, 6, 246);
    ctx.fillRect(362, 276, 6, 220);

    // Crenellations
    ctx.fillStyle = '#1D2234';
    for (let bx = 84; bx <= 364; bx += 18) {
      const topY = bx >= 182 && bx <= 264 ? 220 : 258;
      ctx.fillRect(bx, topY, 10, 14);
    }

    // Warm torchlit arrow-slit windows inside the besieged keep
    const slits = [
      [110, 314],
      [110, 368],
      [212, 268],
      [234, 268],
      [223, 332],
      [336, 320],
      [336, 374],
    ];
    for (const [wx, wy] of slits) {
      ctx.fillStyle = 'rgba(245, 155, 35, 0.32)';
      ctx.fillRect(wx - 5, wy - 4, 14, 22);
      ctx.fillStyle = '#FFE07D';
      ctx.fillRect(wx, wy, 4, 14);
    }

    // Foreground rolling siege hills & war-camp silhouettes
    ctx.fillStyle = '#101624';
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.quadraticCurveTo(280, 465, 620, 528);
    ctx.quadraticCurveTo(960, 575, 1280, 492);
    ctx.lineTo(1280, 720);
    ctx.lineTo(0, 720);
    ctx.closePath();
    ctx.fill();

    // Besieging War Pavilions & Trebuchet Silhouette on Right Ridge (x: 920..1210)
    const tents = [960, 1045, 1135];
    for (const tx of tents) {
      ctx.fillStyle = '#2A1624';
      ctx.beginPath();
      ctx.moveTo(tx - 34, 548);
      ctx.lineTo(tx, 504);
      ctx.lineTo(tx + 34, 548);
      ctx.closePath();
      ctx.fill();
      // Gold ridge trim & pennant
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.fillRect(tx - 1, 488, 2, 18);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(tx + 1, 489, 14, 6);
    }

    // Trebuchet silhouette at x=865
    ctx.strokeStyle = '#241816';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(842, 545);
    ctx.lineTo(866, 500);
    ctx.lineTo(890, 545);
    ctx.moveTo(834, 522);
    ctx.lineTo(904, 484);
    ctx.stroke();

    // Foreground vignette
    ctx.fillStyle = '#070910';
    ctx.fillRect(0, 635, 1280, 85);

    tex.refresh();
  }

  // ==========================================================================
  // 2. UPGRADED 96x96 HD-RETRO LORD & DAMSEL PORTRAITS (NEAREST)
  // ==========================================================================

  private static setNearestFilter(scene: Phaser.Scene, key: string): void {
    const tex = scene.textures.get(key);
    if (tex) {
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  private static drawPixelFrame96(
    ctx: CanvasRenderingContext2D,
    primaryHex: string,
    secondaryHex: string,
    isRoyalGold = true
  ): void {
    // Rich stone + heraldic diagonal tapestry backdrop
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SHADOW_ABYSS;
    ctx.fillRect(0, 0, 96, 96);

    for (let y = 6; y < 90; y += 4) {
      for (let x = 6; x < 90; x += 4) {
        const stripe = ((x + y) >> 3) % 2 === 0;
        ctx.fillStyle = stripe ? primaryHex : secondaryHex;
        ctx.globalAlpha = stripe ? 0.34 : 0.18;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.globalAlpha = 1;

    // Warm torchlight radial vignette behind character bust
    const glow = ctx.createRadialGradient(48, 44, 6, 48, 46, 44);
    glow.addColorStop(0, 'rgba(255, 224, 125, 0.24)');
    glow.addColorStop(1, 'rgba(7, 9, 16, 0.55)');
    ctx.fillStyle = glow;
    ctx.fillRect(4, 4, 88, 88);

    // Ornate 4px Beveled Pixel Border (96x96)
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OBSIDIAN;
    ctx.fillRect(0, 0, 96, 96);
    ctx.clearRect(5, 5, 86, 86);
    // Re-draw inner backdrop cleanly inside (5..91)
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SHADOW_ABYSS;
    ctx.fillRect(5, 5, 86, 86);
    for (let y = 6; y < 90; y += 4) {
      for (let x = 6; x < 90; x += 4) {
        const stripe = ((x + y) >> 3) % 2 === 0;
        ctx.fillStyle = stripe ? primaryHex : secondaryHex;
        ctx.globalAlpha = stripe ? 0.38 : 0.2;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(5, 5, 86, 86);

    const rimOuter = isRoyalGold
      ? SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW
      : SIDEQUEST_PALETTE_HEX.STEEL_DARK;
    const rimMid = isRoyalGold
      ? SIDEQUEST_PALETTE_HEX.GOLD_ROYAL
      : SIDEQUEST_PALETTE_HEX.STEEL_LIGHT;
    const rimSpec = isRoyalGold
      ? SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR
      : SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;

    // Outer 2px dark bronze, middle 2px gold, inner 1px specular
    ctx.strokeStyle = rimOuter;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 94, 94);
    ctx.strokeStyle = rimMid;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 90, 90);
    ctx.fillStyle = rimSpec;
    ctx.fillRect(4, 4, 88, 1);
    ctx.fillRect(4, 4, 1, 88);

    // Corner Gem Cabochons
    const corners = [
      [3, 3],
      [89, 3],
      [3, 89],
      [89, 89],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(cx, cy, 4, 4);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR;
      ctx.fillRect(cx, cy, 2, 2);
    }
  }

  private static generateLordPortraits(scene: Phaser.Scene): void {
    const configs: Record<
      string,
      {
        hair: string;
        hairLight: string;
        beard: 'clean' | 'goatee' | 'full_braid' | 'moustache' | 'short_beard';
        helm: 'plumed_circlet' | 'saxon_crown' | 'winged_helm' | 'wolf_hood' | 'norman_nasal' | 'ducal_coronet' | 'boar_helm';
        plumeColor: string;
        cloakPrimary: string;
        cloakHighlight: string;
        armorTone: 'bright_steel' | 'dark_iron' | 'gilded_plate';
        scar?: boolean;
      }
    > = {
      ivanhoe: {
        hair: '#5E381E',
        hairLight: '#8F5B34',
        beard: 'clean',
        helm: 'plumed_circlet',
        plumeColor: SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.AZURE_MID,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.AZURE_HIGHLIGHT,
        armorTone: 'gilded_plate',
      },
      cedric: {
        hair: '#9C8C76',
        hairLight: '#D8CCB8',
        beard: 'full_braid',
        helm: 'saxon_crown',
        plumeColor: SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.EMERALD_MID,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT,
        armorTone: 'bright_steel',
      },
      geoffrey: {
        hair: '#4A2B16',
        hairLight: '#7A4A28',
        beard: 'short_beard',
        helm: 'winged_helm',
        plumeColor: SIDEQUEST_PALETTE_HEX.GOLD_GLEAM,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.CRIMSON_MID,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.CRIMSON_HIGHLIGHT,
        armorTone: 'gilded_plate',
      },
      wolfric: {
        hair: '#8A3B1B',
        hairLight: '#C25E2E',
        beard: 'moustache',
        helm: 'wolf_hood',
        plumeColor: SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.EMERALD_SHADOW,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT,
        armorTone: 'bright_steel',
      },
      brian: {
        hair: '#1A1822',
        hairLight: '#3A364A',
        beard: 'goatee',
        helm: 'norman_nasal',
        plumeColor: SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.CRIMSON_SHADOW,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT,
        armorTone: 'dark_iron',
      },
      boisguilbert: {
        hair: '#1A1822',
        hairLight: '#3A364A',
        beard: 'goatee',
        helm: 'norman_nasal',
        plumeColor: SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.CRIMSON_SHADOW,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT,
        armorTone: 'dark_iron',
      },
      philip: {
        hair: '#2F221C',
        hairLight: '#594238',
        beard: 'goatee',
        helm: 'ducal_coronet',
        plumeColor: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_LIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_MID,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_LIGHT,
        armorTone: 'gilded_plate',
      },
      malvoisin: {
        hair: '#2F221C',
        hairLight: '#594238',
        beard: 'goatee',
        helm: 'ducal_coronet',
        plumeColor: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_LIGHT,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_MID,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_LIGHT,
        armorTone: 'gilded_plate',
      },
      reginald: {
        hair: '#241E1C',
        hairLight: '#4A3E3A',
        beard: 'short_beard',
        helm: 'boar_helm',
        plumeColor: SIDEQUEST_PALETTE_HEX.TORCH_ORANGE,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.STEEL_DARK,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.CRIMSON_MID,
        armorTone: 'dark_iron',
        scar: true,
      },
      frontdeboeuf: {
        hair: '#241E1C',
        hairLight: '#4A3E3A',
        beard: 'short_beard',
        helm: 'boar_helm',
        plumeColor: SIDEQUEST_PALETTE_HEX.TORCH_ORANGE,
        cloakPrimary: SIDEQUEST_PALETTE_HEX.STEEL_DARK,
        cloakHighlight: SIDEQUEST_PALETTE_HEX.CRIMSON_MID,
        armorTone: 'dark_iron',
        scar: true,
      },
    };

    for (const lord of Object.values(ALL_LORDS)) {
      const key = `sq_portrait_${lord.id}`;
      const tex = scene.textures.createCanvas(key, 96, 96);
      if (!tex) continue;
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;

      const cfg = configs[lord.id] ?? configs.ivanhoe;
      const pHex = `#${lord.heraldry.primaryColor.toString(16).padStart(6, '0')}`;
      const sHex = `#${lord.heraldry.secondaryColor.toString(16).padStart(6, '0')}`;

      this.drawPixelFrame96(ctx, pHex, sHex, true);
      this.drawLordBust96(ctx, lord, cfg);

      tex.refresh();
      this.setNearestFilter(scene, key);
    }

    // Also generate upgraded 96x96 Garrison Commander portrait (`sq_portrait_garrison`)
    const gKey = 'sq_portrait_garrison';
    const gTex = scene.textures.createCanvas(gKey, 96, 96);
    if (gTex) {
      const ctx = gTex.getContext();
      ctx.imageSmoothingEnabled = false;
      this.drawPixelFrame96(
        ctx,
        SIDEQUEST_PALETTE_HEX.MASONRY_DARK,
        SIDEQUEST_PALETTE_HEX.STEEL_DARK,
        false
      );
      this.drawLordBust96(
        ctx,
        ALL_LORDS.frontdeboeuf ?? ALL_LORDS.ivanhoe,
        {
          hair: '#3A3432',
          hairLight: '#625854',
          beard: 'short_beard',
          helm: 'norman_nasal',
          plumeColor: SIDEQUEST_PALETTE_HEX.STEEL_LIGHT,
          cloakPrimary: SIDEQUEST_PALETTE_HEX.MASONRY_DARK,
          cloakHighlight: SIDEQUEST_PALETTE_HEX.STEEL_LIGHT,
          armorTone: 'dark_iron',
          scar: true,
        }
      );
      gTex.refresh();
      this.setNearestFilter(scene, gKey);
    }
  }

  private static drawLordBust96(
    ctx: CanvasRenderingContext2D,
    lord: Lord,
    cfg: {
      hair: string;
      hairLight: string;
      beard: 'clean' | 'goatee' | 'full_braid' | 'moustache' | 'short_beard';
      helm: 'plumed_circlet' | 'saxon_crown' | 'winged_helm' | 'wolf_hood' | 'norman_nasal' | 'ducal_coronet' | 'boar_helm';
      plumeColor: string;
      cloakPrimary: string;
      cloakHighlight: string;
      armorTone: 'bright_steel' | 'dark_iron' | 'gilded_plate';
      scar?: boolean;
    }
  ): void {
    const steelDark =
      cfg.armorTone === 'dark_iron'
        ? '#242A36'
        : SIDEQUEST_PALETTE_HEX.STEEL_DARK;
    const steelMid =
      cfg.armorTone === 'dark_iron'
        ? '#3E485C'
        : SIDEQUEST_PALETTE_HEX.STEEL_MID;
    const steelLight =
      cfg.armorTone === 'gilded_plate'
        ? SIDEQUEST_PALETTE_HEX.GOLD_GLEAM
        : SIDEQUEST_PALETTE_HEX.STEEL_BRIGHT;

    // 1. Flowing Helmet Plume behind head
    if (
      cfg.helm === 'plumed_circlet' ||
      cfg.helm === 'winged_helm' ||
      cfg.helm === 'norman_nasal'
    ) {
      ctx.fillStyle = cfg.plumeColor;
      ctx.fillRect(52, 9, 18, 8);
      ctx.fillRect(60, 14, 16, 8);
      ctx.fillRect(66, 20, 12, 10);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR;
      ctx.fillRect(54, 10, 8, 2);
    }

    // 2. Broad Armored Shoulders, Chainmail & Heraldic Surcoat (y: 62..91)
    ctx.fillStyle = steelDark;
    ctx.fillRect(12, 64, 72, 27);
    // Chainmail pixel stipple on neck/chest
    for (let cy = 58; cy < 88; cy += 2) {
      for (let cx = 26; cx < 70; cx += 2) {
        ctx.fillStyle = (cx + cy) % 4 === 0 ? steelMid : steelDark;
        ctx.fillRect(cx, cy, 2, 2);
      }
    }

    // Surcoat & Velvet Mantle Drapery
    ctx.fillStyle = cfg.cloakPrimary;
    ctx.fillRect(14, 66, 22, 25);
    ctx.fillRect(60, 66, 22, 25);
    ctx.fillRect(34, 72, 28, 19);
    ctx.fillStyle = cfg.cloakHighlight;
    ctx.fillRect(16, 66, 6, 24);
    ctx.fillRect(62, 66, 5, 24);

    // Pauldron Armor Plates with Metallic Specular Gleam
    ctx.fillStyle = steelMid;
    ctx.fillRect(10, 64, 16, 14);
    ctx.fillRect(70, 64, 16, 14);
    ctx.fillStyle = steelLight;
    ctx.fillRect(12, 65, 10, 3);
    ctx.fillRect(72, 65, 10, 3);
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
    ctx.fillRect(14, 65, 4, 2);
    ctx.fillRect(74, 65, 4, 2);

    // Golden Cloak Brooch Clasp
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
    ctx.fillRect(28, 66, 8, 8);
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
    ctx.fillRect(29, 67, 6, 6);
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
    ctx.fillRect(31, 69, 2, 2);

    // 3. Neck & 4-Tone Sculpted Face (x: 32..64, y: 24..60)
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_SHADOW;
    ctx.fillRect(40, 54, 16, 8);

    // Hair / Coif Sides behind ears
    ctx.fillStyle = cfg.hair;
    ctx.fillRect(28, 26, 40, 28);
    ctx.fillStyle = cfg.hairLight;
    ctx.fillRect(29, 30, 4, 18);
    ctx.fillRect(63, 30, 4, 18);

    // Main Face Block
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_MID;
    ctx.fillRect(33, 25, 30, 30);
    ctx.fillRect(36, 55, 24, 4);
    // Left-lit cheekbone & forehead highlights
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_LIGHT;
    ctx.fillRect(35, 26, 20, 24);
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_HIGHLIGHT;
    ctx.fillRect(37, 28, 10, 6);
    ctx.fillRect(37, 40, 6, 5);
    // Jaw shadow on right side
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_SHADOW;
    ctx.fillRect(58, 30, 5, 24);

    // Expressive Brows & Eyes with Specular Catchlight
    ctx.fillStyle = cfg.hair;
    ctx.fillRect(36, 34, 9, 2);
    ctx.fillRect(51, 34, 9, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(37, 37, 7, 4);
    ctx.fillRect(52, 37, 7, 4);
    const irisColor =
      (lord?.faction ?? 'saxon') === 'saxon'
        ? SIDEQUEST_PALETTE_HEX.AZURE_MID
        : SIDEQUEST_PALETTE_HEX.SHADOW_ABYSS;
    ctx.fillStyle = irisColor;
    ctx.fillRect(39, 37, 4, 4);
    ctx.fillRect(54, 37, 4, 4);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(39, 37, 1, 2);
    ctx.fillRect(54, 37, 1, 2);

    // Sculpted Nose
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_HIGHLIGHT;
    ctx.fillRect(46, 37, 2, 9);
    ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_SHADOW;
    ctx.fillRect(48, 38, 2, 9);
    ctx.fillRect(45, 45, 6, 2);

    // Optional Battle Scar (Reginald / Garrison)
    if (cfg.scar) {
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_MID;
      ctx.fillRect(54, 41, 2, 9);
      ctx.fillRect(56, 46, 2, 5);
    }

    // Mouth & Beard Styles
    ctx.fillStyle = '#7A3E32';
    ctx.fillRect(43, 50, 10, 2);

    if (cfg.beard === 'full_braid') {
      ctx.fillStyle = cfg.hair;
      ctx.fillRect(33, 47, 30, 14);
      ctx.fillRect(38, 61, 20, 8);
      ctx.fillStyle = cfg.hairLight;
      ctx.fillRect(37, 48, 6, 16);
      ctx.fillRect(53, 48, 6, 16);
      // Gold beard rings
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(39, 64, 4, 2);
      ctx.fillRect(53, 64, 4, 2);
    } else if (cfg.beard === 'short_beard') {
      ctx.fillStyle = cfg.hair;
      ctx.fillRect(34, 48, 28, 11);
      ctx.fillStyle = cfg.hairLight;
      ctx.fillRect(42, 48, 12, 3);
      ctx.fillStyle = '#8F4D3E';
      ctx.fillRect(45, 51, 6, 2);
    } else if (cfg.beard === 'goatee') {
      ctx.fillStyle = cfg.hair;
      ctx.fillRect(41, 48, 14, 3);
      ctx.fillRect(44, 52, 8, 8);
    } else if (cfg.beard === 'moustache') {
      ctx.fillStyle = cfg.hair;
      ctx.fillRect(38, 47, 20, 4);
      ctx.fillRect(36, 50, 5, 4);
      ctx.fillRect(55, 50, 5, 4);
    }

    // 4. Distinct HD-Retro Headgear / Helmets
    if (cfg.helm === 'plumed_circlet') {
      // Flowing noble locks + gilded knightly circlet
      ctx.fillStyle = cfg.hair;
      ctx.fillRect(31, 18, 34, 10);
      ctx.fillStyle = cfg.hairLight;
      ctx.fillRect(35, 19, 14, 5);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
      ctx.fillRect(31, 24, 34, 5);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(32, 25, 32, 3);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.AZURE_HIGHLIGHT;
      ctx.fillRect(46, 24, 4, 5);
    } else if (cfg.helm === 'saxon_crown') {
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
      ctx.fillRect(30, 17, 36, 11);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.fillRect(32, 19, 32, 7);
      for (let x = 33; x <= 59; x += 8) {
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
        ctx.fillRect(x, 13, 4, 6);
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT;
        ctx.fillRect(x + 1, 21, 2, 3);
      }
    } else if (cfg.helm === 'winged_helm') {
      ctx.fillStyle = steelMid;
      ctx.fillRect(31, 16, 34, 14);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(36, 18, 10, 4);
      // Gilded wings on sides
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(22, 14, 9, 12);
      ctx.fillRect(65, 14, 9, 12);
      ctx.fillRect(19, 10, 6, 8);
      ctx.fillRect(71, 10, 6, 8);
    } else if (cfg.helm === 'wolf_hood') {
      // Forest ranger hood & fur mantle trim
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_SHADOW;
      ctx.fillRect(27, 14, 42, 16);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_MID;
      ctx.fillRect(30, 16, 24, 11);
      // Feather in cap
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(60, 10, 12, 4);
      ctx.fillRect(66, 7, 10, 4);
    } else if (cfg.helm === 'norman_nasal') {
      // Conical steel Norman helm + iconic nasal bar
      ctx.fillStyle = steelDark;
      ctx.fillRect(30, 15, 36, 15);
      ctx.fillRect(36, 10, 24, 6);
      ctx.fillStyle = steelMid;
      ctx.fillRect(33, 16, 20, 12);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(36, 17, 7, 9);
      // Gilded band & steel nasal guard
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.fillRect(30, 27, 36, 3);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_BRIGHT;
      ctx.fillRect(46, 28, 4, 16);
    } else if (cfg.helm === 'ducal_coronet') {
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_MID;
      ctx.fillRect(31, 15, 34, 11);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(30, 23, 36, 5);
      ctx.fillRect(34, 19, 4, 5);
      ctx.fillRect(46, 18, 4, 6);
      ctx.fillRect(58, 19, 4, 5);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(47, 24, 2, 3);
    } else if (cfg.helm === 'boar_helm') {
      ctx.fillStyle = steelDark;
      ctx.fillRect(29, 15, 38, 15);
      ctx.fillStyle = steelMid;
      ctx.fillRect(33, 17, 22, 10);
      // Iron cheek-guards & boar tusks crest
      ctx.fillRect(30, 30, 5, 16);
      ctx.fillRect(61, 30, 5, 16);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT;
      ctx.fillRect(25, 16, 5, 6);
      ctx.fillRect(66, 16, 5, 6);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_BURNISHED;
      ctx.fillRect(44, 11, 8, 6);
    }
  }

  private static generateDamselPortraits(scene: Phaser.Scene): void {
    const damselStyles: Record<
      string,
      {
        hair: string;
        hairHighlight: string;
        gown: string;
        gownLight: string;
        veil: string;
        gem: string;
      }
    > = {
      rowena: {
        hair: '#C9932B',
        hairHighlight: '#F7D97E',
        gown: SIDEQUEST_PALETTE_HEX.AZURE_MID,
        gownLight: SIDEQUEST_PALETTE_HEX.AZURE_HIGHLIGHT,
        veil: '#EEF5FF',
        gem: SIDEQUEST_PALETTE_HEX.AZURE_HIGHLIGHT,
      },
      rebecca: {
        hair: '#1B1626',
        hairHighlight: '#4A3A68',
        gown: SIDEQUEST_PALETTE_HEX.CRIMSON_MID,
        gownLight: SIDEQUEST_PALETTE_HEX.CRIMSON_HIGHLIGHT,
        veil: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_LIGHT,
        gem: SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT,
      },
      marian: {
        hair: '#8E3A1C',
        hairHighlight: '#CC6638',
        gown: SIDEQUEST_PALETTE_HEX.EMERALD_MID,
        gownLight: SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT,
        veil: SIDEQUEST_PALETTE_HEX.GOLD_GLEAM,
        gem: SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT,
      },
      rosalind: {
        hair: '#6B4426',
        hairHighlight: '#A87246',
        gown: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_MID,
        gownLight: SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_LIGHT,
        veil: '#FADCE8',
        gem: SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR,
      },
    };

    for (const damsel of Object.values(SAXON_DAMSELS)) {
      const key = `sq_portrait_${damsel.id}`;
      const tex = scene.textures.createCanvas(key, 96, 96);
      if (!tex) continue;
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;

      const st = damselStyles[damsel.id] ?? damselStyles.rowena;
      this.drawPixelFrame96(ctx, st.gown, SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_DARK, true);

      // Flowing Silk Veil behind hair & shoulders
      ctx.fillStyle = st.veil;
      ctx.globalAlpha = 0.72;
      ctx.fillRect(24, 18, 48, 56);
      ctx.globalAlpha = 1;

      // Cascading Hair Locks
      ctx.fillStyle = st.hair;
      ctx.fillRect(26, 20, 44, 48);
      ctx.fillStyle = st.hairHighlight;
      ctx.fillRect(28, 24, 6, 38);
      ctx.fillRect(62, 24, 6, 38);

      // Velvet Court Gown & Gold Brocade Bodice
      ctx.fillStyle = st.gown;
      ctx.fillRect(16, 66, 64, 25);
      ctx.fillStyle = st.gownLight;
      ctx.fillRect(20, 68, 14, 22);
      ctx.fillRect(62, 68, 14, 22);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT;
      ctx.fillRect(36, 66, 24, 10);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(34, 66, 3, 25);
      ctx.fillRect(59, 66, 3, 25);

      // Graceful Neck & Pearl/Gem Necklace
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_LIGHT;
      ctx.fillRect(41, 53, 14, 14);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR;
      ctx.fillRect(38, 63, 20, 2);
      ctx.fillStyle = st.gem;
      ctx.fillRect(46, 64, 4, 4);

      // Soft Sculpted Face
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_LIGHT;
      ctx.fillRect(35, 26, 26, 26);
      ctx.fillRect(38, 52, 20, 3);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_HIGHLIGHT;
      ctx.fillRect(37, 28, 14, 18);
      // Rosy cheeks
      ctx.fillStyle = '#E88A84';
      ctx.fillRect(37, 43, 5, 3);
      ctx.fillRect(54, 43, 5, 3);

      // Lashes & Sparkling Eyes
      ctx.fillStyle = '#241822';
      ctx.fillRect(38, 36, 7, 2);
      ctx.fillRect(51, 36, 7, 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(39, 38, 6, 4);
      ctx.fillRect(51, 38, 6, 4);
      ctx.fillStyle = st.gown;
      ctx.fillRect(41, 38, 3, 4);
      ctx.fillRect(53, 38, 3, 4);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(41, 38, 1, 2);
      ctx.fillRect(53, 38, 1, 2);

      // Delicate Nose & Rose Lips
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_MID;
      ctx.fillRect(48, 40, 2, 5);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(44, 48, 8, 2);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_HIGHLIGHT;
      ctx.fillRect(45, 48, 4, 1);

      // Jeweled Golden Tiara / Circlet
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
      ctx.fillRect(32, 21, 32, 5);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(33, 22, 30, 3);
      ctx.fillRect(44, 17, 8, 5);
      ctx.fillStyle = st.gem;
      ctx.fillRect(46, 19, 4, 4);

      tex.refresh();
      this.setNearestFilter(scene, key);
    }
  }

  // ==========================================================================
  // 3. UPGRADED 66x84 HD-RETRO HERALDIC SHIELDS (NEAREST)
  // ==========================================================================

  private static generateHeraldryShields(scene: Phaser.Scene): void {
    const entries: Array<{
      id: string;
      primary: number;
      secondary: number;
      accent: number;
      symbol: string;
    }> = Object.values(ALL_LORDS).map((l) => ({
      id: l.id,
      primary: l.heraldry.primaryColor,
      secondary: l.heraldry.secondaryColor,
      accent: l.heraldry.accentColor,
      symbol: l.heraldry.symbol,
    }));

    entries.push({
      id: 'garrison',
      primary: SIDEQUEST_PALETTE.MASONRY_DARK,
      secondary: SIDEQUEST_PALETTE.STEEL_DARK,
      accent: SIDEQUEST_PALETTE.STEEL_BRIGHT,
      symbol: 'tower',
    });

    for (const item of entries) {
      const key = `sq_shield_${item.id}`;
      const tex = scene.textures.createCanvas(key, 66, 84);
      if (!tex) continue;
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;

      const pHex = `#${item.primary.toString(16).padStart(6, '0')}`;
      const sHex = `#${item.secondary.toString(16).padStart(6, '0')}`;
      const aHex = `#${item.accent.toString(16).padStart(6, '0')}`;

      const traceHeater = (inset: number) => {
        ctx.beginPath();
        ctx.moveTo(4 + inset, 4 + inset);
        ctx.lineTo(62 - inset, 4 + inset);
        ctx.lineTo(62 - inset, 38);
        ctx.quadraticCurveTo(60 - inset, 65 - inset * 0.6, 33, 80 - inset);
        ctx.quadraticCurveTo(6 + inset, 65 - inset * 0.6, 4 + inset, 38);
        ctx.closePath();
      };

      // Outer Bronze Shadow Rim
      traceHeater(0);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
      ctx.fill();

      // Burnished Royal Gold Rim
      traceHeater(2);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fill();

      // Quartered Heraldic Field
      ctx.save();
      traceHeater(5);
      ctx.clip();

      ctx.fillStyle = pHex;
      ctx.fillRect(0, 0, 66, 84);
      ctx.fillStyle = sHex;
      ctx.fillRect(33, 0, 33, 40);
      ctx.fillRect(0, 40, 33, 44);

      // Diagonal Metallic Specular Sheen across shield face
      const sheen = ctx.createLinearGradient(0, 0, 66, 84);
      sheen.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
      sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.04)');
      sheen.addColorStop(0.5, 'rgba(255, 243, 186, 0.22)');
      sheen.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, 66, 84);

      // Central Heraldic Charge with crisp drop-shadow
      const drawCharge = (ox: number, oy: number, color: string) => {
        ctx.fillStyle = color;
        switch (item.symbol) {
          case 'cross':
            ctx.fillRect(29 + ox, 14 + oy, 8, 52);
            ctx.fillRect(14 + ox, 29 + oy, 38, 8);
            break;
          case 'sword':
            ctx.fillRect(31 + ox, 14 + oy, 4, 42);
            ctx.fillRect(21 + ox, 46 + oy, 24, 4);
            ctx.fillRect(30 + ox, 50 + oy, 6, 11);
            break;
          case 'lion':
            ctx.fillRect(25 + ox, 20 + oy, 16, 12);
            ctx.fillRect(22 + ox, 32 + oy, 18, 18);
            ctx.fillRect(18 + ox, 24 + oy, 6, 8);
            ctx.fillRect(40 + ox, 26 + oy, 7, 16);
            ctx.fillRect(22 + ox, 50 + oy, 6, 10);
            ctx.fillRect(34 + ox, 50 + oy, 6, 10);
            break;
          case 'wolf':
            ctx.fillRect(20 + ox, 28 + oy, 24, 14);
            ctx.fillRect(22 + ox, 20 + oy, 6, 10);
            ctx.fillRect(32 + ox, 20 + oy, 6, 10);
            ctx.fillRect(38 + ox, 32 + oy, 10, 7);
            ctx.fillRect(24 + ox, 42 + oy, 14, 14);
            break;
          case 'falcon':
            ctx.fillRect(14 + ox, 24 + oy, 14, 18);
            ctx.fillRect(38 + ox, 24 + oy, 14, 18);
            ctx.fillRect(27 + ox, 20 + oy, 12, 30);
            ctx.fillRect(24 + ox, 50 + oy, 18, 8);
            break;
          case 'boar':
            ctx.fillRect(18 + ox, 28 + oy, 28, 18);
            ctx.fillRect(42 + ox, 34 + oy, 8, 8);
            ctx.fillRect(46 + ox, 30 + oy, 4, 5);
            ctx.fillRect(21 + ox, 46 + oy, 6, 9);
            ctx.fillRect(37 + ox, 46 + oy, 6, 9);
            break;
          case 'axe':
            ctx.fillRect(31 + ox, 16 + oy, 4, 48);
            ctx.fillRect(17 + ox, 20 + oy, 14, 18);
            ctx.fillRect(35 + ox, 20 + oy, 14, 18);
            break;
          default:
            // Tower
            ctx.fillRect(23 + ox, 22 + oy, 20, 36);
            ctx.fillRect(21 + ox, 18 + oy, 6, 6);
            ctx.fillRect(30 + ox, 18 + oy, 6, 6);
            ctx.fillRect(39 + ox, 18 + oy, 6, 6);
            break;
        }
      };

      drawCharge(2, 2, 'rgba(7, 9, 16, 0.75)');
      drawCharge(0, 0, aHex);
      ctx.restore();

      // Perimeter Rivets on Gold Rim
      const rivets = [
        [10, 8],
        [33, 7],
        [56, 8],
        [9, 36],
        [57, 36],
        [33, 75],
      ];
      for (const [rx, ry] of rivets) {
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR;
        ctx.fillRect(rx - 1, ry - 1, 2, 2);
      }

      tex.refresh();
      this.setNearestFilter(scene, key);
    }
  }

  // ==========================================================================
  // 4. LIVING STRATEGY MAP SEASONAL BACKDROPS & UPGRADED CASTLE ICONS
  // ==========================================================================

  private static generateMapSeasonalAssets(scene: Phaser.Scene): void {
    const seasonConfigs: Record<
      Season,
      { deep: string; mid: string; shelf: string; gridAlpha: number }
    > = {
      WINTER: {
        deep: SIDEQUEST_PALETTE_HEX.WINTER_SEA_DEEP,
        mid: '#24486E',
        shelf: SIDEQUEST_PALETTE_HEX.WINTER_SEA_COAST,
        gridAlpha: 0.12,
      },
      SPRING: {
        deep: SIDEQUEST_PALETTE_HEX.SPRING_SEA_DEEP,
        mid: '#296599',
        shelf: SIDEQUEST_PALETTE_HEX.SPRING_SEA_COAST,
        gridAlpha: 0.1,
      },
      SUMMER: {
        deep: SIDEQUEST_PALETTE_HEX.SUMMER_SEA_DEEP,
        mid: '#2E72AA',
        shelf: SIDEQUEST_PALETTE_HEX.SUMMER_SEA_COAST,
        gridAlpha: 0.1,
      },
      AUTUMN: {
        deep: SIDEQUEST_PALETTE_HEX.AUTUMN_SEA_DEEP,
        mid: '#2B5680',
        shelf: SIDEQUEST_PALETTE_HEX.AUTUMN_SEA_COAST,
        gridAlpha: 0.12,
      },
    };

    for (const season of ['WINTER', 'SPRING', 'SUMMER', 'AUTUMN'] as Season[]) {
      const key = `sq_map_britain_${season.toLowerCase()}`;
      const tex = scene.textures.createCanvas(key, 780, 720);
      if (!tex) continue;
      const ctx = tex.getContext();
      const cfg = seasonConfigs[season];

      const seaGrad = ctx.createRadialGradient(410, 380, 90, 390, 360, 520);
      seaGrad.addColorStop(0, cfg.shelf);
      seaGrad.addColorStop(0.55, cfg.mid);
      seaGrad.addColorStop(1, cfg.deep);
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, 0, 780, 720);

      // Subtle cartographic rhumb / compass lines
      ctx.strokeStyle = `rgba(248, 236, 209, ${cfg.gridAlpha})`;
      ctx.lineWidth = 1;
      const roseX = 118;
      const roseY = 560;
      for (let a = 0; a < 16; a++) {
        const rad = (a * Math.PI) / 8;
        ctx.beginPath();
        ctx.moveTo(roseX, roseY);
        ctx.lineTo(roseX + Math.cos(rad) * 760, roseY + Math.sin(rad) * 760);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(roseX, roseY, 28, 0, Math.PI * 2);
      ctx.stroke();

      // Ornate Royal Map Viewport Inner Bevel
      ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 774, 714);
      ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.lineWidth = 2;
      ctx.strokeRect(6, 6, 768, 708);

      tex.refresh();
    }

    // Upgraded Castle Icon (`sq_icon_castle`, 28x28 NEAREST)
    const cTex = scene.textures.createCanvas('sq_icon_castle', 28, 28);
    if (cTex) {
      const ctx = cTex.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#070910';
      ctx.fillRect(3, 8, 22, 18);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_MID;
      ctx.fillRect(4, 9, 20, 16);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_HIGHLIGHT;
      ctx.fillRect(4, 9, 6, 15);
      // Towers & merlons
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_LIGHT;
      ctx.fillRect(3, 5, 6, 20);
      ctx.fillRect(19, 5, 6, 20);
      ctx.fillRect(11, 3, 6, 22);
      // Warm torchlit gate & windows
      ctx.fillStyle = '#1A120C';
      ctx.fillRect(11, 17, 6, 8);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.TORCH_GLOW;
      ctx.fillRect(13, 9, 2, 4);
      ctx.fillRect(5, 10, 2, 3);
      ctx.fillRect(21, 10, 2, 3);
      cTex.refresh();
      this.setNearestFilter(scene, 'sq_icon_castle');
    }

    // Upgraded Home Castle Icon (`sq_icon_home_castle`, 32x32 NEAREST)
    const hcTex = scene.textures.createCanvas('sq_icon_home_castle', 32, 32);
    if (hcTex) {
      const ctx = hcTex.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#070910';
      ctx.fillRect(3, 8, 26, 22);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_LIGHT;
      ctx.fillRect(4, 10, 24, 19);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_HIGHLIGHT;
      ctx.fillRect(4, 6, 7, 23);
      ctx.fillRect(21, 6, 7, 23);
      ctx.fillRect(12, 3, 8, 26);
      // Gold royal roof & banner
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(4, 5, 7, 2);
      ctx.fillRect(21, 5, 7, 2);
      ctx.fillRect(12, 2, 8, 2);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(16, 0, 7, 3);
      // Glowing arched gate & arrow slits
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(13, 20, 6, 9);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.TORCH_GLOW;
      ctx.fillRect(15, 10, 2, 4);
      ctx.fillRect(7, 12, 2, 3);
      ctx.fillRect(23, 12, 2, 3);
      hcTex.refresh();
      this.setNearestFilter(scene, 'sq_icon_home_castle');
    }

    // Upgraded Sherwood Oak Icon (`sq_icon_sherwood`, 30x30 NEAREST)
    const shTex = scene.textures.createCanvas('sq_icon_sherwood', 30, 30);
    if (shTex) {
      const ctx = shTex.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(12, 17, 6, 11);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_HIGHLIGHT;
      ctx.fillRect(13, 18, 2, 9);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_SHADOW;
      ctx.fillRect(4, 6, 22, 14);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT;
      ctx.fillRect(6, 4, 18, 12);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT;
      ctx.fillRect(8, 5, 10, 6);
      shTex.refresh();
      this.setNearestFilter(scene, 'sq_icon_sherwood');
    }

    // Upgraded Territory Market/Mill Icon (`sq_icon_market`, 24x24 NEAREST)
    const mktTex = scene.textures.createCanvas('sq_icon_market', 24, 24);
    if (mktTex) {
      const ctx = mktTex.getContext();
      ctx.imageSmoothingEnabled = false;
      // Stone base & timber posts
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(3, 11, 18, 11);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_LIGHT;
      ctx.fillRect(4, 13, 16, 9);
      // Striped golden & crimson merchant market canopy
      for (let x = 2; x < 22; x += 4) {
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
        ctx.fillRect(x, 5, 2, 6);
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
        ctx.fillRect(x + 2, 5, 2, 6);
      }
      // Top golden roof peak & coin sign
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.fillRect(5, 3, 14, 2);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR;
      ctx.fillRect(10, 1, 4, 3);
      // Timber market table with golden wheat/produce
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_HIGHLIGHT;
      ctx.fillRect(6, 14, 12, 4);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(7, 15, 3, 2);
      ctx.fillRect(11, 15, 4, 2);
      mktTex.refresh();
      this.setNearestFilter(scene, 'sq_icon_market');
    }

    // Upgraded Royal Keep Icon (`sq_icon_royal_keep`, 32x34 NEAREST)
    const rkTex = scene.textures.createCanvas('sq_icon_royal_keep', 32, 34);
    if (rkTex) {
      const ctx = rkTex.getContext();
      ctx.imageSmoothingEnabled = false;
      // Fortress dark base & shadow
      ctx.fillStyle = '#070910';
      ctx.fillRect(2, 9, 28, 23);
      // Twin Spired Heavy Masonry Walls
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_LIGHT;
      ctx.fillRect(3, 11, 26, 21);
      // Left Spire & Right Spire
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
      ctx.fillRect(3, 5, 8, 27);
      ctx.fillRect(21, 5, 8, 27);
      // Spire roofs with specular highlights
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_MID;
      ctx.fillRect(3, 3, 8, 3);
      ctx.fillRect(21, 3, 8, 3);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(6, 1, 2, 3);
      ctx.fillRect(24, 1, 2, 3);
      // Central Keep with Royal Golden Crown
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_HIGHLIGHT;
      ctx.fillRect(11, 8, 10, 24);
      // Ornate Gold Crown Crest atop Keep
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.fillRect(11, 4, 10, 4);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_SPECULAR;
      ctx.fillRect(11, 2, 2, 3);
      ctx.fillRect(15, 1, 2, 4);
      ctx.fillRect(19, 2, 2, 3);
      // Crown Ruby Jewel
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(15, 5, 2, 2);
      // Iron Portcullis & Torchlit Windows
      ctx.fillStyle = '#100D09';
      ctx.fillRect(13, 22, 6, 10);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.TORCH_GLOW;
      ctx.fillRect(15, 12, 2, 4);
      ctx.fillRect(6, 11, 2, 3);
      ctx.fillRect(24, 11, 2, 3);
      rkTex.refresh();
      this.setNearestFilter(scene, 'sq_icon_royal_keep');
    }

    // Longbowmen Archer Idle & Firing Sprites (`sq_unit_archer_0`, `sq_unit_archer_1`, `sq_arrow`)
    const archer0 = scene.textures.createCanvas('sq_unit_archer_0', 28, 28);
    if (archer0) {
      const ctx = archer0.getContext();
      ctx.imageSmoothingEnabled = false;
      // Forester green hooded cowl & tunic
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_SHADOW;
      ctx.fillRect(9, 6, 10, 16);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT;
      ctx.fillRect(10, 8, 8, 12);
      // Feathered Bycocket Cap
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT;
      ctx.fillRect(9, 4, 10, 4);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(8, 2, 3, 4); // Feather plume
      // Face
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_MID;
      ctx.fillRect(11, 7, 6, 4);
      // Leather Boots & Bracers
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(10, 20, 3, 7);
      ctx.fillRect(15, 20, 3, 7);
      // Yew Longbow (Vertical Idle) & Quiver
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_BURNISHED;
      ctx.fillRect(19, 3, 2, 22);
      ctx.fillStyle = '#E8E4D8';
      ctx.fillRect(18, 5, 1, 18); // Bowstring
      // Quiver with arrows on back
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(6, 9, 3, 11);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, 7, 3, 2); // Fletchings
      archer0.refresh();
      this.setNearestFilter(scene, 'sq_unit_archer_0');
    }

    const archer1 = scene.textures.createCanvas('sq_unit_archer_1', 28, 28);
    if (archer1) {
      const ctx = archer1.getContext();
      ctx.imageSmoothingEnabled = false;
      // Tunic in dynamic draw pose
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_SHADOW;
      ctx.fillRect(7, 7, 11, 15);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT;
      ctx.fillRect(8, 9, 9, 11);
      // Feathered cap
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT;
      ctx.fillRect(8, 5, 9, 4);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(7, 3, 3, 4);
      // Face
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_MID;
      ctx.fillRect(11, 8, 6, 4);
      // Boots
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(8, 21, 4, 6);
      ctx.fillRect(14, 21, 4, 6);
      // Drawn C-Curve Longbow forward
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_BURNISHED;
      ctx.fillRect(20, 2, 2, 5);
      ctx.fillRect(22, 7, 2, 14);
      ctx.fillRect(20, 21, 2, 5);
      // Drawn Bowstring pulled back to cheek
      ctx.fillStyle = '#E8E4D8';
      ctx.beginPath();
      ctx.moveTo(21, 4);
      ctx.lineTo(13, 11);
      ctx.lineTo(21, 24);
      ctx.strokeStyle = '#E8E4D8';
      ctx.stroke();
      // Nocked Steel Arrow
      ctx.fillStyle = '#C8CCD4';
      ctx.fillRect(12, 11, 13, 2);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(24, 10, 2, 4);
      archer1.refresh();
      this.setNearestFilter(scene, 'sq_unit_archer_1');
    }

    // Flying Arrow Projectile (`sq_arrow`, 16x5 NEAREST)
    const arrowTex = scene.textures.createCanvas('sq_arrow', 16, 5);
    if (arrowTex) {
      const ctx = arrowTex.getContext();
      ctx.imageSmoothingEnabled = false;
      // Bodkin steel point
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(12, 1, 4, 3);
      // Wooden shaft
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_BURNISHED;
      ctx.fillRect(3, 2, 9, 1);
      // Goose fletching
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 3, 2);
      ctx.fillRect(0, 3, 3, 2);
      arrowTex.refresh();
      this.setNearestFilter(scene, 'sq_arrow');
    }
  }

  // ==========================================================================
  // 5. SEASONAL BATTLEFIELD BACKDROPS (1280x500)
  // ==========================================================================

  private static generateBattleSeasonalAssets(scene: Phaser.Scene): void {
    const palettes: Record<
      Season,
      {
        skyTop: string;
        skyHorizon: string;
        hillsFar: string;
        hillsNear: string;
        fieldTop: string;
        fieldBottom: string;
        accentTuft: string;
      }
    > = {
      WINTER: {
        skyTop: '#334E73',
        skyHorizon: '#B8D4EB',
        hillsFar: '#6C87A6',
        hillsNear: '#8EAAC4',
        fieldTop: '#DCEAF7',
        fieldBottom: '#B5CDE3',
        accentTuft: '#FFFFFF',
      },
      SPRING: {
        skyTop: '#245B9E',
        skyHorizon: '#A8D4F5',
        hillsFar: '#2E6642',
        hillsNear: '#3B7D46',
        fieldTop: '#4A9648',
        fieldBottom: '#2F6E32',
        accentTuft: '#7BD468',
      },
      SUMMER: {
        skyTop: '#1E5499',
        skyHorizon: '#BCE0FA',
        hillsFar: '#3A6B38',
        hillsNear: '#538238',
        fieldTop: '#6B9A3B',
        fieldBottom: '#477328',
        accentTuft: '#B2CC56',
      },
      AUTUMN: {
        skyTop: '#3B426E',
        skyHorizon: '#DFA26C',
        hillsFar: '#5E3B36',
        hillsNear: '#804828',
        fieldTop: '#8C622B',
        fieldBottom: '#5E421E',
        accentTuft: '#D9862B',
      },
    };

    for (const season of ['WINTER', 'SPRING', 'SUMMER', 'AUTUMN'] as Season[]) {
      for (const isSiege of [false, true]) {
        const key = `sq_battle_bg_${isSiege ? 'siege' : 'field'}_${season.toLowerCase()}`;
        const tex = scene.textures.createCanvas(key, 1280, 500);
        if (!tex) continue;
        const ctx = tex.getContext();
        const p = palettes[season];

        // Sky gradient
        const sky = ctx.createLinearGradient(0, 0, 0, 175);
        sky.addColorStop(0, p.skyTop);
        sky.addColorStop(1, p.skyHorizon);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 1280, 175);

        // Far & near hills
        ctx.fillStyle = p.hillsFar;
        ctx.beginPath();
        ctx.moveTo(0, 175);
        for (let x = 0; x <= 1280; x += 80) {
          ctx.lineTo(x, 128 + Math.sin(x * 0.007) * 24);
        }
        ctx.lineTo(1280, 210);
        ctx.lineTo(0, 210);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.hillsNear;
        ctx.beginPath();
        ctx.moveTo(0, 185);
        for (let x = 0; x <= 1280; x += 64) {
          ctx.lineTo(x, 152 + Math.cos(x * 0.011) * 16);
        }
        ctx.lineTo(1280, 225);
        ctx.lineTo(0, 225);
        ctx.closePath();
        ctx.fill();

        // Main tactical field (y: 175..500)
        const ground = ctx.createLinearGradient(0, 175, 0, 500);
        ground.addColorStop(0, p.fieldTop);
        ground.addColorStop(1, p.fieldBottom);
        ctx.fillStyle = ground;
        ctx.fillRect(0, 175, 1280, 325);

        // Grass / snow / autumn-leaf pixel tufts
        ctx.fillStyle = p.accentTuft;
        ctx.globalAlpha = 0.42;
        for (let i = 0; i < 180; i++) {
          const gx = (i * 97) % 1260;
          const gy = 190 + ((i * 53) % 295);
          ctx.fillRect(gx, gy, 6, 2);
          ctx.fillRect(gx + 2, gy - 2, 2, 2);
        }
        ctx.globalAlpha = 1;

        // If Siege Assault backdrop: draw massive stone curtain wall on right (x: 1050..1280)
        if (isSiege) {
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_DARK;
          ctx.fillRect(1085, 95, 195, 405);
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.MASONRY_MID;
          for (let wy = 105; wy < 490; wy += 22) {
            for (let wx = 1090; wx < 1270; wx += 36) {
              const shift = (wy / 22) % 2 === 0 ? 0 : 16;
              ctx.fillRect(wx + shift, wy, 32, 18);
            }
          }
          ctx.fillStyle = '#120E0C';
          ctx.fillRect(1085, 290, 46, 95);
        }

        tex.refresh();
      }
    }
  }

  // ==========================================================================
  // 6. SIEGE SCENE HD-RETRO LANDSCAPE BACKDROP (1280x500)
  // ==========================================================================

  private static generateSiegeAssets(scene: Phaser.Scene): void {
    const tex = scene.textures.createCanvas('sq_siege_bg_landscape', 1280, 500);
    if (!tex) return;
    const ctx = tex.getContext();

    // Dramatic windswept storm-gold sky
    const sky = ctx.createLinearGradient(0, 0, 0, 310);
    sky.addColorStop(0, '#1B2A4A');
    sky.addColorStop(0.55, '#3E5B85');
    sky.addColorStop(1, '#9EB6CE');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 310);

    // Distant mountain range & silhouette watchtower
    ctx.fillStyle = '#2B3E5E';
    ctx.beginPath();
    ctx.moveTo(0, 310);
    for (let x = 0; x <= 1280; x += 64) {
      ctx.lineTo(x, 232 + Math.sin(x * 0.006) * 32 + Math.cos(x * 0.017) * 14);
    }
    ctx.lineTo(1280, 340);
    ctx.lineTo(0, 340);
    ctx.closePath();
    ctx.fill();

    // Rolling emerald-russet siege valley
    const ground = ctx.createLinearGradient(0, 295, 0, 500);
    ground.addColorStop(0, '#3D6E38');
    ground.addColorStop(0.45, '#2E592B');
    ground.addColorStop(1, '#1E3D1E');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 295, 1280, 205);

    // Worn earthen siege road leading toward the castle ramparts
    ctx.fillStyle = '#5E462C';
    ctx.beginPath();
    ctx.moveTo(140, 445);
    ctx.quadraticCurveTo(540, 420, 960, 412);
    ctx.lineTo(980, 434);
    ctx.quadraticCurveTo(540, 448, 160, 472);
    ctx.closePath();
    ctx.fill();

    tex.refresh();
  }

  // ==========================================================================
  // 7. SWORDPLAY GREAT HALL HD-RETRO BACKDROP (1280x500)
  // ==========================================================================

  private static generateSwordplayAssets(scene: Phaser.Scene): void {
    const tex = scene.textures.createCanvas('sq_swordplay_hall_backdrop', 1280, 500);
    if (!tex) return;
    const ctx = tex.getContext();

    // Deep vaulted Norman stone masonry wall
    ctx.fillStyle = '#141622';
    ctx.fillRect(0, 0, 1280, 500);

    for (let row = 0; row < 16; row++) {
      const y = row * 26;
      const offset = (row % 2) * 32;
      for (let col = -1; col < 22; col++) {
        const x = col * 64 + offset;
        ctx.fillStyle = (row + col) % 3 === 0 ? '#26293B' : '#1E2130';
        ctx.fillRect(x + 2, y + 2, 60, 22);
        ctx.fillStyle = '#32374E';
        ctx.fillRect(x + 2, y + 2, 58, 2);
      }
    }

    // 3 Gothic Lancet Windows (x = 340, 640, 915) showing starry indigo night & crescent moon
    const lancets = [340, 640, 915];
    for (const lx of lancets) {
      ctx.fillStyle = '#0B132B';
      ctx.beginPath();
      ctx.moveTo(lx - 30, 245);
      ctx.lineTo(lx - 30, 120);
      ctx.quadraticCurveTo(lx, 68, lx + 30, 120);
      ctx.lineTo(lx + 30, 245);
      ctx.closePath();
      ctx.fill();

      // Lunar glow in lancet
      const lGlow = ctx.createLinearGradient(lx, 75, lx, 245);
      lGlow.addColorStop(0, 'rgba(168, 212, 240, 0.55)');
      lGlow.addColorStop(1, 'rgba(56, 116, 212, 0.14)');
      ctx.fillStyle = lGlow;
      ctx.fill();

      // Stone mullion & tracery
      ctx.strokeStyle = '#4A506B';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#2B3044';
      ctx.fillRect(lx - 2, 86, 4, 159);
      ctx.fillRect(lx - 28, 158, 56, 4);
    }

    // Royal Crimson & Gold Tapestries between lancets
    const tapestries = [195, 490, 778];
    for (const tx of tapestries) {
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_SHADOW;
      ctx.fillRect(tx - 28, 92, 56, 165);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_MID;
      ctx.fillRect(tx - 22, 98, 44, 150);
      ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
      ctx.lineWidth = 2;
      ctx.strokeRect(tx - 22, 98, 44, 150);
    }

    // Iron Torch Wall Sconces at (190, 175), (490, 175), (780, 175)
    for (const sx of [190, 490, 780]) {
      ctx.fillStyle = '#232733';
      ctx.fillRect(sx - 5, 174, 10, 28);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.BRONZE_SHADOW;
      ctx.fillRect(sx - 9, 170, 18, 6);
    }

    // Flagstone Duel Walkway & Grand Staircase on Right (x > 980)
    const floor = ctx.createLinearGradient(0, 392, 0, 500);
    floor.addColorStop(0, '#36394A');
    floor.addColorStop(1, '#1A1C26');
    ctx.fillStyle = floor;
    ctx.fillRect(0, 392, 1280, 108);
    ctx.fillStyle = '#585E78';
    ctx.fillRect(0, 392, 1280, 4);

    for (let step = 0; step < 6; step++) {
      const sx = 990 + step * 46;
      const sy = 392 - (step + 1) * 20;
      ctx.fillStyle = '#2E3244';
      ctx.fillRect(sx, sy, 290 - step * 46, 22);
      ctx.fillStyle = '#585E78';
      ctx.fillRect(sx, sy, 290 - step * 46, 3);
    }

    tex.refresh();
  }

  // ==========================================================================
  // 8. JOUST TOURNAMENT LISTS, BARDING & ARMOR SHINE (SIDEQUEST_LABS)
  // ==========================================================================

  private static generateJoustAssets(scene: Phaser.Scene): void {
    // 1. Upgraded Joust Arena Backdrop (`sq_joust_arena_backdrop`, 1280x510)
    const bgTex = scene.textures.createCanvas('sq_joust_arena_backdrop', 1280, 510);
    if (bgTex) {
      const ctx = bgTex.getContext();

      // Crisp royal tournament sky
      const sky = ctx.createLinearGradient(0, 0, 0, 198);
      sky.addColorStop(0, '#1B4D9E');
      sky.addColorStop(0.65, '#5C9CE6');
      sky.addColorStop(1, '#C4E4FF');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 1280, 198);

      // Distant whitecastle & treelines
      ctx.fillStyle = '#4B7248';
      ctx.fillRect(0, 168, 1280, 42);

      // Timber Grandstands & Royal Box with spectators
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_SHADOW;
      ctx.fillRect(60, 128, 1160, 82);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_MID;
      ctx.fillRect(60, 122, 1160, 14);
      // Scalloped canopy valance
      for (let x = 60; x < 1220; x += 28) {
        ctx.fillStyle =
          (x / 28) % 2 === 0
            ? SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT
            : SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
        ctx.fillRect(x, 134, 28, 8);
      }

      // Crowd silhouettes & colorful attire in stands
      const crowdColors = [
        SIDEQUEST_PALETTE_HEX.AZURE_BRIGHT,
        SIDEQUEST_PALETTE_HEX.CRIMSON_HIGHLIGHT,
        SIDEQUEST_PALETTE_HEX.GOLD_GLEAM,
        SIDEQUEST_PALETTE_HEX.EMERALD_HIGHLIGHT,
        SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT,
      ];
      for (let cx = 78; cx < 1200; cx += 14) {
        ctx.fillStyle = crowdColors[(cx * 7) % crowdColors.length];
        ctx.fillRect(cx, 162 + (cx % 3) * 3, 9, 16);
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.SKIN_LIGHT;
        ctx.fillRect(cx + 2, 155 + (cx % 3) * 3, 5, 6);
      }

      // Royal King's Box at x = 640
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.PURPLE_REGAL_MID;
      ctx.fillRect(575, 106, 130, 102);
      ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.lineWidth = 3;
      ctx.strokeRect(575, 106, 130, 102);

      // Lush Tournament Turf & Sand Lists Track (y: 208..510)
      const turf = ctx.createLinearGradient(0, 208, 0, 510);
      turf.addColorStop(0, '#3C853B');
      turf.addColorStop(0.35, '#4A9844');
      turf.addColorStop(1, '#265928');
      ctx.fillStyle = turf;
      ctx.fillRect(0, 208, 1280, 302);

      // Perspective sandy tilt lane
      ctx.fillStyle = 'rgba(201, 168, 116, 0.72)';
      ctx.beginPath();
      ctx.moveTo(608, 210);
      ctx.lineTo(648, 210);
      ctx.lineTo(840, 510);
      ctx.lineTo(360, 510);
      ctx.closePath();
      ctx.fill();

      // Cast shadow & Wooden Tilt Barrier (dividing rail from vanishing point to foreground)
      ctx.fillStyle = 'rgba(7, 9, 16, 0.38)';
      ctx.beginPath();
      ctx.moveTo(640, 210);
      ctx.lineTo(600, 510);
      ctx.lineTo(626, 510);
      ctx.lineTo(645, 210);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_SHADOW;
      ctx.beginPath();
      ctx.moveTo(640, 212);
      ctx.lineTo(584, 460);
      ctx.lineTo(584, 482);
      ctx.lineTo(640, 222);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_MID;
      ctx.beginPath();
      ctx.moveTo(640, 218);
      ctx.lineTo(584, 474);
      ctx.lineTo(584, 488);
      ctx.lineTo(640, 226);
      ctx.closePath();
      ctx.fill();

      const posts = [
        { y: 215, h: 20, w: 4, x: 640 },
        { y: 235, h: 32, w: 6, x: 635 },
        { y: 265, h: 48, w: 8, x: 628 },
        { y: 310, h: 70, w: 12, x: 618 },
        { y: 375, h: 105, w: 16, x: 602 },
        { y: 470, h: 150, w: 22, x: 580 },
      ];
      for (const p of posts) {
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_SHADOW;
        ctx.fillRect(p.x - p.w / 2, p.y - p.h, p.w, p.h);
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_HIGHLIGHT;
        ctx.fillRect(p.x - p.w / 2 + 1, p.y - p.h + 2, Math.max(1, p.w / 3), p.h - 4);
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
        ctx.fillRect(p.x - p.w / 2, p.y - Math.floor(p.h * 0.7), p.w, Math.max(2, p.w / 3));
      }

      bgTex.refresh();
    }

    // 2. Upgraded Player Warhorse Neck with Ornate Caparison Barding & Steel Chanfron (`sq_joust_horse_neck`, 260x180)
    const neckTex = scene.textures.createCanvas('sq_joust_horse_neck', 260, 180);
    if (neckTex) {
      const ctx = neckTex.getContext();
      ctx.imageSmoothingEnabled = false;

      // Muscular destrier neck
      ctx.fillStyle = '#3B2314';
      ctx.beginPath();
      ctx.moveTo(45, 180);
      ctx.quadraticCurveTo(75, 72, 120, 24);
      ctx.lineTo(155, 42);
      ctx.quadraticCurveTo(192, 95, 218, 180);
      ctx.closePath();
      ctx.fill();

      // Ornate Royal Azure & Gold Quilted Caparison Barding
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.AZURE_MID;
      ctx.beginPath();
      ctx.moveTo(52, 180);
      ctx.quadraticCurveTo(84, 96, 122, 54);
      ctx.quadraticCurveTo(168, 98, 210, 180);
      ctx.closePath();
      ctx.fill();

      // Gold diamond lattice embroidery on barding
      ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.lineWidth = 2;
      for (let d = -2; d <= 4; d++) {
        ctx.beginPath();
        ctx.moveTo(75 + d * 24, 180);
        ctx.lineTo(125 + d * 18, 82);
        ctx.stroke();
      }

      // Gleaming Fluted Steel Chanfron & Crinet (Horse Head/Neck Plate Armor)
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
      ctx.fillRect(108, 18, 44, 52);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_BRIGHT;
      ctx.fillRect(114, 22, 18, 42);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(118, 24, 7, 36);
      // Horse ears & royal crimson-gold plume
      ctx.fillStyle = '#2B180E';
      ctx.fillRect(102, 8, 10, 16);
      ctx.fillRect(146, 8, 10, 16);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(122, 2, 16, 16);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(126, 14, 8, 6);

      neckTex.refresh();
      this.setNearestFilter(scene, 'sq_joust_horse_neck');
    }

    // 3. Upgraded Rival Charger with Rich Caparison Barding & Armor Shine (`sq_joust_rival_charger`, 180x220)
    const rivTex = scene.textures.createCanvas('sq_joust_rival_charger', 180, 220);
    if (rivTex) {
      const ctx = rivTex.getContext();
      ctx.imageSmoothingEnabled = false;

      // Destrier body & galloping forelegs
      ctx.fillStyle = '#1C1820';
      ctx.fillRect(54, 96, 72, 78);
      ctx.fillRect(62, 170, 14, 42);
      ctx.fillRect(104, 166, 14, 40);

      // Rich Crimson & Burnished Gold Caparison Barding Skirt
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_MID;
      ctx.fillRect(46, 102, 88, 68);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_HIGHLIGHT;
      ctx.fillRect(50, 106, 24, 58);
      ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 104, 84, 64);

      // Steel Peytral Chest-Plate & Chanfron with Specular Shine
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
      ctx.fillRect(60, 104, 60, 32);
      ctx.fillRect(74, 68, 32, 42);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(66, 108, 18, 8);
      ctx.fillRect(82, 72, 8, 28);

      // Armored Rival Knight Torso & Plumed Great-Helm
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_DARK;
      ctx.fillRect(56, 36, 68, 48);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_BRIGHT;
      ctx.fillRect(62, 40, 26, 36);
      // Great-Helm
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
      ctx.fillRect(72, 14, 36, 26);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(76, 16, 10, 20);
      ctx.fillStyle = '#070910';
      ctx.fillRect(76, 24, 28, 3);
      // Plume
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(82, 2, 22, 12);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(88, 5, 20, 8);

      // Couched Rival Lance Tip Aimed Forward
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.beginPath();
      ctx.moveTo(38, 66);
      ctx.lineTo(48, 42);
      ctx.lineTo(56, 68);
      ctx.closePath();
      ctx.fill();

      rivTex.refresh();
      this.setNearestFilter(scene, 'sq_joust_rival_charger');
    }

    // 4. Upgraded Tournament Lance (`sq_joust_player_lance`, 340x160 angled couched lance)
    const lanceTex = scene.textures.createCanvas('sq_joust_player_lance', 340, 160);
    if (lanceTex) {
      const ctx = lanceTex.getContext();
      ctx.imageSmoothingEnabled = false;

      // Tapered diagonal tournament lance from vamplate (290, 140) to coronel tip (10, 22)
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.beginPath();
      ctx.moveTo(10, 20);
      ctx.lineTo(292, 129);
      ctx.lineTo(286, 149);
      ctx.lineTo(10, 24);
      ctx.closePath();
      ctx.fill();

      // Crimson barber-pole tournament livery stripes
      const stripeCount = 7;
      for (let i = 0; i < stripeCount; i++) {
        const t1 = 0.12 + i * 0.12;
        const t2 = t1 + 0.06;
        const x1 = 10 + 280 * t1;
        const y1 = 21 + 114 * t1;
        const x2 = 10 + 280 * t2;
        const y2 = 21 + 114 * t2;
        const halfThick = 2 + t1 * 8;
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
        ctx.beginPath();
        ctx.moveTo(x1, y1 - halfThick * 0.45);
        ctx.lineTo(x2, y2 - halfThick * 0.45);
        ctx.lineTo(x2 - 4, y2 + halfThick * 0.75);
        ctx.lineTo(x1 - 4, y1 + halfThick * 0.75);
        ctx.closePath();
        ctx.fill();
      }

      // Upper specular gleam along shaft
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, 21);
      ctx.lineTo(272, 124);
      ctx.stroke();

      // Blunted Steel Coronel Tip
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
      ctx.fillRect(6, 17, 10, 10);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(7, 18, 5, 4);

      // Fluted Conical Steel Vamplate & Gauntlet
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_DARK;
      ctx.beginPath();
      ctx.ellipse(276, 138, 16, 24, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_BRIGHT;
      ctx.beginPath();
      ctx.ellipse(275, 137, 12, 19, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.beginPath();
      ctx.ellipse(275, 138, 5, 9, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Articulated Steel Gauntlet
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
      ctx.fillRect(286, 131, 36, 18);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
      ctx.fillRect(288, 133, 30, 5);

      lanceTex.refresh();
      this.setNearestFilter(scene, 'sq_joust_player_lance');
    }
  }

  /**
   * Generates naval sea-lane assets (e.g. sq_icon_ship) for coastal amphibious routes.
   */
  public static generateNavalAssets(scene: Phaser.Scene): void {
    if (!scene.textures.exists('sq_icon_ship')) {
      const tex = scene.textures.createCanvas('sq_icon_ship', 28, 24);
      if (!tex) return;
      const ctx = tex.getContext();
      ctx.imageSmoothingEnabled = false;

      // Deep sea wave base
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.AZURE_SHADOW;
      ctx.fillRect(0, 18, 28, 6);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.AZURE_HIGHLIGHT;
      ctx.fillRect(2, 19, 6, 2);
      ctx.fillRect(12, 20, 7, 2);
      ctx.fillRect(22, 19, 5, 2);

      // Wooden Cog Hull
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.beginPath();
      ctx.moveTo(3, 13);
      ctx.lineTo(25, 13);
      ctx.lineTo(21, 20);
      ctx.lineTo(7, 20);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_MID;
      ctx.fillRect(6, 14, 16, 3);
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.fillRect(4, 12, 4, 3); // Forecastle
      ctx.fillRect(20, 11, 5, 4); // Aftcastle

      // Central Mast
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
      ctx.fillRect(13, 3, 2, 13);

      // Billowing Square Sail
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT;
      ctx.beginPath();
      ctx.moveTo(7, 6);
      ctx.quadraticCurveTo(14, 8, 21, 6);
      ctx.lineTo(20, 14);
      ctx.quadraticCurveTo(14, 16, 8, 14);
      ctx.closePath();
      ctx.fill();

      // Red St. George Cross on sail
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
      ctx.fillRect(13, 6, 2, 9);
      ctx.fillRect(9, 9, 10, 2);

      // Pennant at mast top
      ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
      ctx.beginPath();
      ctx.moveTo(15, 3);
      ctx.lineTo(21, 4);
      ctx.lineTo(15, 6);
      ctx.closePath();
      ctx.fill();

      tex.refresh();
      this.setNearestFilter(scene, 'sq_icon_ship');
    }
  }

  /**
   * Generates assets for the 5th Mini-Game: Sherwood Archery Contest (bow, arrow, target butt).
   */
  public static generateArcheryAssets(scene: Phaser.Scene): void {
    // 1. Longbow
    if (!scene.textures.exists('sq_archery_bow')) {
      const tex = scene.textures.createCanvas('sq_archery_bow', 48, 112);
      if (tex) {
        const ctx = tex.getContext();
        ctx.imageSmoothingEnabled = false;

        // Curved English Yew Stave
        ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(12, 6);
        ctx.quadraticCurveTo(38, 56, 12, 106);
        ctx.stroke();

        ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.OAK_MID;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(13, 8);
        ctx.quadraticCurveTo(36, 56, 13, 104);
        ctx.stroke();

        // Horn Nocks at tips
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
        ctx.fillRect(8, 4, 6, 6);
        ctx.fillRect(8, 102, 6, 6);

        // Leather Handgrip
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_SHADOW;
        ctx.fillRect(32, 48, 8, 16);
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
        ctx.fillRect(33, 50, 6, 2);
        ctx.fillRect(33, 58, 6, 2);

        // Taut Flax Bowstring
        ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(11, 7);
        ctx.lineTo(11, 105);
        ctx.stroke();

        tex.refresh();
        this.setNearestFilter(scene, 'sq_archery_bow');
      }
    }

    // 2. Clothyard Arrow
    if (!scene.textures.exists('sq_archery_arrow')) {
      const tex = scene.textures.createCanvas('sq_archery_arrow', 48, 12);
      if (tex) {
        const ctx = tex.getContext();
        ctx.imageSmoothingEnabled = false;

        // Ash shaft
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_HIGHLIGHT;
        ctx.fillRect(8, 5, 34, 2);

        // Steel Bodkin Head (pointed right)
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
        ctx.beginPath();
        ctx.moveTo(42, 3);
        ctx.lineTo(47, 6);
        ctx.lineTo(42, 9);
        ctx.closePath();
        ctx.fill();

        // Goose feather fletchings (left side)
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT;
        ctx.beginPath();
        ctx.moveTo(3, 2);
        ctx.lineTo(12, 5);
        ctx.lineTo(3, 5);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(3, 10);
        ctx.lineTo(12, 7);
        ctx.lineTo(3, 7);
        ctx.closePath();
        ctx.fill();

        // Crimson silk binding thread
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
        ctx.fillRect(11, 4, 2, 4);

        tex.refresh();
        this.setNearestFilter(scene, 'sq_archery_arrow');
      }
    }

    // 3. Straw Target Butt (128x128)
    if (!scene.textures.exists('sq_archery_target')) {
      const tex = scene.textures.createCanvas('sq_archery_target', 128, 128);
      if (tex) {
        const ctx = tex.getContext();
        ctx.imageSmoothingEnabled = false;

        const cx = 64;
        const cy = 64;

        // Straw Boss Ring Outer
        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.OAK_DARK;
        ctx.beginPath();
        ctx.arc(cx, cy, 63, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = SIDEQUEST_PALETTE_HEX.VELLUM_DARK;
        ctx.beginPath();
        ctx.arc(cx, cy, 60, 0, Math.PI * 2);
        ctx.fill();

        // Concentric Hit Rings: White (56), Blue (42), Red (26), Gold (14)
        // White Outer
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx, cy, 56, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#D1D5DB';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Blue Ring
        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.arc(cx, cy, 42, 0, Math.PI * 2);
        ctx.fill();

        // Red Ring
        ctx.fillStyle = '#DC2626';
        ctx.beginPath();
        ctx.arc(cx, cy, 26, 0, Math.PI * 2);
        ctx.fill();

        // Gold Bullseye
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();

        // Center Pin X
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy);
        ctx.lineTo(cx + 3, cy);
        ctx.moveTo(cx, cy - 3);
        ctx.lineTo(cx, cy + 3);
        ctx.stroke();

        tex.refresh();
        this.setNearestFilter(scene, 'sq_archery_target');
      }
    }
  }

  /**
   * Generates the 6 Legendary Relic icons for the Lord's Armory.
   */
  public static generateRelicAssets(scene: Phaser.Scene): void {
    const relicDefs: Array<{
      key: string;
      draw: (ctx: CanvasRenderingContext2D) => void;
    }> = [
      {
        key: 'sq_relic_excalibur_hilt',
        draw: (ctx) => {
          // Golden crossguard & wire hilt
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
          ctx.fillRect(6, 16, 24, 4); // Crossguard
          ctx.fillRect(16, 20, 4, 10); // Grip
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
          ctx.beginPath();
          ctx.arc(18, 31, 3, 0, Math.PI * 2); // Pommel
          ctx.fill();
          // Gleaming blade fragment
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.AZURE_HIGHLIGHT;
          ctx.fillRect(16, 4, 4, 12);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(17, 4, 2, 10);
        },
      },
      {
        key: 'sq_relic_milanese_plate',
        draw: (ctx) => {
          // Polished tournament cuirass
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_MID;
          ctx.beginPath();
          ctx.moveTo(10, 6);
          ctx.lineTo(26, 6);
          ctx.lineTo(24, 28);
          ctx.lineTo(18, 32);
          ctx.lineTo(12, 28);
          ctx.closePath();
          ctx.fill();
          // Specular fluting & gold trim
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.STEEL_SPECULAR;
          ctx.fillRect(17, 8, 2, 20);
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
          ctx.fillRect(11, 6, 14, 2);
          ctx.fillRect(13, 27, 10, 2);
        },
      },
      {
        key: 'sq_relic_hastings_horn',
        draw: (ctx) => {
          // Warhorn curved body
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.VELLUM_LIGHT;
          ctx.beginPath();
          ctx.moveTo(8, 26);
          ctx.quadraticCurveTo(18, 24, 26, 8);
          ctx.lineTo(30, 10);
          ctx.quadraticCurveTo(22, 28, 10, 30);
          ctx.closePath();
          ctx.fill();
          // Brass bands
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
          ctx.fillRect(25, 7, 5, 4);
          ctx.fillRect(15, 19, 4, 4);
          ctx.fillRect(7, 26, 4, 4);
        },
      },
      {
        key: 'sq_relic_sherwood_yew_bow',
        draw: (ctx) => {
          // Golden bow
          ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(6, 6);
          ctx.quadraticCurveTo(24, 18, 6, 30);
          ctx.stroke();
          // Arrow crossed
          ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(8, 30);
          ctx.lineTo(28, 8);
          ctx.stroke();
          // Arrowhead
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(27, 6, 4, 4);
        },
      },
      {
        key: 'sq_relic_greek_fire_siphon',
        draw: (ctx) => {
          // Byzantine Bronze Siphon Nozzle
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_BURNISHED;
          ctx.fillRect(6, 14, 16, 8);
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
          ctx.fillRect(20, 12, 6, 12);
          // Leaping Emerald / Azure alchemical flame
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.EMERALD_BRIGHT;
          ctx.beginPath();
          ctx.moveTo(26, 14);
          ctx.lineTo(34, 10);
          ctx.lineTo(31, 18);
          ctx.lineTo(35, 22);
          ctx.lineTo(26, 20);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(27, 16, 3, 3);
        },
      },
      {
        key: 'sq_relic_st_edward_crown_ring',
        draw: (ctx) => {
          // Golden signet ring
          ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_GLEAM;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(18, 22, 9, 0, Math.PI * 2);
          ctx.stroke();
          // Crown bezel on top
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.GOLD_ROYAL;
          ctx.beginPath();
          ctx.moveTo(11, 14);
          ctx.lineTo(13, 8);
          ctx.lineTo(18, 11);
          ctx.lineTo(23, 8);
          ctx.lineTo(25, 14);
          ctx.closePath();
          ctx.fill();
          // Royal Ruby Gem
          ctx.fillStyle = SIDEQUEST_PALETTE_HEX.CRIMSON_BRIGHT;
          ctx.fillRect(16, 11, 4, 4);
        },
      },
    ];

    for (const r of relicDefs) {
      if (!scene.textures.exists(r.key)) {
        const tex = scene.textures.createCanvas(r.key, 36, 36);
        if (tex) {
          const ctx = tex.getContext();
          ctx.imageSmoothingEnabled = false;
          // Subtly bevelled dark badge background
          ctx.fillStyle = '#1A1D26';
          ctx.fillRect(0, 0, 36, 36);
          ctx.strokeStyle = SIDEQUEST_PALETTE_HEX.GOLD_BURNISHED;
          ctx.lineWidth = 1;
          ctx.strokeRect(1, 1, 34, 34);

          r.draw(ctx);

          tex.refresh();
          this.setNearestFilter(scene, r.key);
        }
      }
    }
  }
}
