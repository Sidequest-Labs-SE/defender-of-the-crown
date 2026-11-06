import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MapScene } from './scenes/MapScene';
import { SiegeScene } from './scenes/SiegeScene';
import { BattleScene } from './scenes/BattleScene';
import { SwordplayScene } from './scenes/SwordplayScene';
import { JoustScene } from './scenes/JoustScene';

/**
 * Defender of the Crown - 16:9 HD Hybrid Edition (1280x720)
 * Combines crisp nearest-neighbor retro pixel-art portraits & heraldry
 * with smooth, anti-aliased widescreen UI, map geometry, and high-DPI typography.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-canvas',
  width: 1280,
  height: 720,
  pixelArt: false,
  roundPixels: true,
  antialias: true,
  backgroundColor: '#0B0D14',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [
    BootScene,
    TitleScene,
    CharacterSelectScene,
    MapScene,
    SiegeScene,
    BattleScene,
    SwordplayScene,
    JoustScene,
  ],
};

window.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);
});
