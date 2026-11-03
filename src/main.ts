import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { MapScene } from './scenes/MapScene';

/**
 * Defender of the Crown - Amiga 1986 Modernized Remake
 * Upgraded Amiga Hi-Res 640x400 Pixel Pipeline (16:10 Aspect Ratio)
 * Crisp typography, detailed heraldry, and responsive full-screen scaling.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'phaser-canvas',
  width: 640,
  height: 400,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 640,
    height: 400,
  },
  scene: [BootScene, TitleScene, CharacterSelectScene, MapScene],
};

window.addEventListener('DOMContentLoaded', () => {
  new Phaser.Game(config);
});
