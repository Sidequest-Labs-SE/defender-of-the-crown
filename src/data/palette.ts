/**
 * Curated 1986 Amiga OCS Color Palette
 * Faithful 32-color low-res palette adhering to Cinemaware classic standards.
 */

export const PALETTE_HEX = {
  // Shadows / Outlines
  BLACK: '#000000',
  SHADOW: '#1A1A2E',

  // Stone / Castles
  STONE_DARK: '#4A4A52',
  STONE_MID: '#787882',
  STONE_LIGHT: '#A8A8B2',

  // Foliage / Hills
  FOLIAGE_DARK: '#1E4620',
  FOLIAGE_MID: '#3A7034',
  FOLIAGE_LIGHT: '#689E54',

  // Wood / Parchment
  WOOD_DARK: '#4E2A14',
  WOOD_MID: '#8A5229',
  PARCHMENT_DARK: '#D2B48C',
  PARCHMENT_LIGHT: '#F4E4C1',

  // Sky / Water
  SKY_NIGHT: '#2B4C7E',
  SKY_MID: '#5C88C4',
  SKY_LIGHT: '#A4C2E8',

  // Gold / Heraldry / Blood / Emblems
  GOLD_DARK: '#C89D28',
  GOLD_BRIGHT: '#F2D06B',
  BLOOD_RED: '#A82020',
  ROYAL_BLUE: '#285CC4',
} as const;

export const PALETTE = {
  // Numeric 0xRRGGBB values for Phaser Graphics & Fill
  BLACK: 0x000000,
  SHADOW: 0x1A1A2E,

  STONE_DARK: 0x4A4A52,
  STONE_MID: 0x787882,
  STONE_LIGHT: 0xA8A8B2,

  FOLIAGE_DARK: 0x1E4620,
  FOLIAGE_MID: 0x3A7034,
  FOLIAGE_LIGHT: 0x689E54,

  WOOD_DARK: 0x4E2A14,
  WOOD_MID: 0x8A5229,
  PARCHMENT_DARK: 0xD2B48C,
  PARCHMENT_LIGHT: 0xF4E4C1,

  SKY_NIGHT: 0x2B4C7E,
  SKY_MID: 0x5C88C4,
  SKY_LIGHT: 0xA4C2E8,

  GOLD_DARK: 0xC89D28,
  GOLD_BRIGHT: 0xF2D06B,
  BLOOD_RED: 0xA82020,
  ROYAL_BLUE: 0x285CC4,
} as const;

export type PaletteColorName = keyof typeof PALETTE;
