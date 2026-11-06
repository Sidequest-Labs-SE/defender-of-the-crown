import { SaxonDamsel, SaxonDamselId } from '../core/types';

/**
 * The 4 Iconic Saxon Ladies of 1986 Cinemaware's "Defender of the Crown"
 * Pure TypeScript definitions with zero framework dependencies.
 */
export const SAXON_DAMSELS: Record<SaxonDamselId, SaxonDamsel> = {
  rowena: {
    id: 'rowena',
    name: 'Lady Rowena',
    title: 'Royal Ward of Rotherwood',
    dowryGold: 15,
    leadershipBonus: 1,
    secondaryStat: 'jousting',
    secondaryBonus: 1,
    quote: '"My champion! Thy valor puts every Norman baron to shame!"',
    bio: 'Descendant of King Alfred and jewel of the Saxon court. Her royal favor rallies knights across the shires and inspires unmatched chivalry in the lists.',
  },
  rebecca: {
    id: 'rebecca',
    name: 'Lady Rebecca',
    title: 'Noble Healer of York',
    dowryGold: 15,
    leadershipBonus: 1,
    secondaryStat: 'swordplay',
    secondaryBonus: 1,
    quote: '"Steadfast heart and swift blade have delivered me from darkness!"',
    bio: 'Renowned throughout Yorkshire for wisdom, courage, and healing craft. Her counsel sharpens a lord’s focus in single combat and steadies his host.',
  },
  marian: {
    id: 'marian',
    name: 'Lady Marian',
    title: 'Maid of Locksley & Sherwood',
    dowryGold: 15,
    leadershipBonus: 1,
    secondaryStat: 'swordplay',
    secondaryBonus: 1,
    quote: '"Bravely fought, bold Saxon! Together we shall humble the Norman usurpers!"',
    bio: 'Spirited noblewoman allied with the outlaws of Sherwood Forest. Her secret intelligence of Norman castles makes every blade strike truer.',
  },
  rosalind: {
    id: 'rosalind',
    name: 'Lady Rosalind',
    title: 'Rose of Canterbury',
    dowryGold: 15,
    leadershipBonus: 1,
    secondaryStat: 'jousting',
    secondaryBonus: 1,
    quote: '"Through fire and steel thou hast come for me, my noble lord!"',
    bio: 'Beloved heiress of the southern marches whose union cements Saxon legitimacy and brings rich ancestral coffers to the royal cause.',
  },
};

export const SAXON_DAMSEL_IDS: SaxonDamselId[] = [
  'rowena',
  'rebecca',
  'marian',
  'rosalind',
];
