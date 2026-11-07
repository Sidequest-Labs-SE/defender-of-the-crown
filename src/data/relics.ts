/**
 * Legendary Medieval Relics for Defender of the Crown (Sidequest Labs Edition)
 * Pure TypeScript definitions with zero framework dependencies.
 */

export type RelicId =
  | 'excalibur_hilt'
  | 'milanese_plate'
  | 'hastings_horn'
  | 'sherwood_yew_bow'
  | 'greek_fire_siphon'
  | 'st_edward_crown_ring';

export interface Relic {
  id: RelicId;
  name: string;
  title: string;
  description: string;
  effectDescription: string;
  iconKey: string;
  statBonus?: {
    swordplay?: number;
    jousting?: number;
    leadership?: number;
  };
}

export const ALL_RELICS: Record<RelicId, Relic> = {
  excalibur_hilt: {
    id: 'excalibur_hilt',
    name: 'Hilt of Excalibur',
    title: 'Relic of King Arthur',
    description:
      'The jewel-encrusted pommel and gold crossguard of the legendary blade Excalibur, retrieved from the mists of Avalon.',
    effectDescription: '+2 Swordplay and +10% counter-damage on fencing Ripostes.',
    iconKey: 'sq_relic_excalibur_hilt',
    statBonus: { swordplay: 2 },
  },
  milanese_plate: {
    id: 'milanese_plate',
    name: 'Milanese Tournament Plate',
    title: 'Masterwork Lombard Steel',
    description:
      'Tempered fluted steel forged in Northern Italy, deflects tournament lances with ease.',
    effectDescription: '+2 Jousting, steadier lance aim, and +15% Unhorse resistance in royal tilts.',
    iconKey: 'sq_relic_milanese_plate',
    statBonus: { jousting: 2 },
  },
  hastings_horn: {
    id: 'hastings_horn',
    name: 'Warhorn of Hastings',
    title: 'Relic of 1066',
    description:
      'Carved from an ancient aurochs horn, its clarion call strikes valor into allies and dread into foes.',
    effectDescription: '+2 Leadership and +10 starting frontline Momentum in tactical field battles.',
    iconKey: 'sq_relic_hastings_horn',
    statBonus: { leadership: 2 },
  },
  sherwood_yew_bow: {
    id: 'sherwood_yew_bow',
    name: 'Golden Yew Longbow',
    title: 'Masterwork of the Greenwood',
    description:
      'A master-crafted English warbow cut from sacred heartwood yew, strung with twisted silk.',
    effectDescription: '+25% Longbowmen arrow volley damage and steadies bow sway in Archery Contests.',
    iconKey: 'sq_relic_sherwood_yew_bow',
  },
  greek_fire_siphon: {
    id: 'greek_fire_siphon',
    name: 'Byzantine Fire Siphon',
    title: 'Secret of Constantinople',
    description:
      'A brass naval combustion nozzle salvaged from the crusades, amplifying catapult ammunition lethality.',
    effectDescription: '+15 bonus wall and courtyard damage on Boulder and Greek Fire catapult volleys.',
    iconKey: 'sq_relic_greek_fire_siphon',
  },
  st_edward_crown_ring: {
    id: 'st_edward_crown_ring',
    name: 'Signet of St. Edward',
    title: 'Royal Confessor Ring',
    description:
      'Golden coronation ring blessed by Edward the Confessor, commanding feudal reverence.',
    effectDescription: '+3 Gold/mo royal tribute bonus collected every month.',
    iconKey: 'sq_relic_st_edward_crown_ring',
  },
};

export const RELIC_IDS = Object.keys(ALL_RELICS) as RelicId[];

export function getRelic(id: string): Relic | undefined {
  return ALL_RELICS[id as RelicId];
}
