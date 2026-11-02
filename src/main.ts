import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MapScene } from './scenes/MapScene';

/**
 * Defender of the Crown - Amiga 1986 Modernized Remake
 * Main Entry Point with Low-Res 320x200 Pixel-Art Scaling Pipeline
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-canvas',
  width: 320,
  height: 200,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#000000',
  zoom: 4,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 320,
    height: 200,
    zoom: 4,
  },
  scene: [BootScene, TitleScene, CharacterSelectScene, MapScene],
};

window.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);
});
