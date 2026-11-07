import { Territory, MapPoint } from '../core/types';

/**
 * Decorative Non-Playable Highland Border Regions (Scotland & Wales)
 * Completes the natural silhouette of Great Britain inside the 780x720 HD Map Viewport.
 */
export const SCOTLAND_POLYGON: MapPoint[] = [
  { x: 216, y: 48 },
  { x: 310, y: 44 },
  { x: 428, y: 48 },
  { x: 444, y: 68 },
  { x: 449, y: 87 },
  { x: 358, y: 84 },
  { x: 278, y: 104 },
  { x: 228, y: 94 },
  { x: 198, y: 74 },
];

export const WALES_POLYGON: MapPoint[] = [
  { x: 168, y: 304 },
  { x: 214, y: 308 },
  { x: 247, y: 326 },
  { x: 259, y: 363 },
  { x: 244, y: 404 },
  { x: 259, y: 446 },
  { x: 232, y: 482 },
  { x: 184, y: 486 },
  { x: 134, y: 478 },
  { x: 126, y: 454 },
  { x: 158, y: 426 },
  { x: 142, y: 388 },
  { x: 124, y: 356 },
  { x: 148, y: 324 },
];

/**
 * 18 Historical Territories of Medieval England (1986 Defender of the Crown Map)
 * Upgraded to 1280x720 (16:9 HD Hybrid) coordinates (Left Map Zone: x: 0..780, y: 0..720).
 * Shared interior edges interlock seamlessly while exterior coasts follow natural British contours.
 */
export const INITIAL_TERRITORIES: Record<string, Territory> = {
  northumberland: {
    id: 'northumberland',
    name: 'Northumberland',
    taxIncome: 2,
    hasCastle: true,
    homeLordId: 'geoffrey',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['cumberland', 'yorkshire'],
    mapCoords: { x: 422, y: 136 },
    polygon: [
      { x: 358, y: 84 },
      { x: 449, y: 87 },
      { x: 474, y: 118 },
      { x: 488, y: 152 },
      { x: 483, y: 183 },
      { x: 365, y: 183 },
    ],
  },
  cumberland: {
    id: 'cumberland',
    name: 'Cumberland',
    taxIncome: 2,
    hasCastle: true,
    homeLordId: 'wolfric',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['northumberland', 'lancashire', 'yorkshire'],
    mapCoords: { x: 306, y: 156 },
    polygon: [
      { x: 278, y: 104 },
      { x: 358, y: 84 },
      { x: 365, y: 183 },
      { x: 342, y: 210 },
      { x: 259, y: 210 },
      { x: 242, y: 176 },
      { x: 248, y: 138 },
    ],
  },
  lancashire: {
    id: 'lancashire',
    name: 'Lancashire',
    taxIncome: 2,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['cumberland', 'yorkshire', 'cheshire'],
    mapCoords: { x: 304, y: 252 },
    polygon: [
      { x: 259, y: 210 },
      { x: 342, y: 210 },
      { x: 354, y: 293 },
      { x: 266, y: 293 },
      { x: 250, y: 264 },
      { x: 256, y: 236 },
    ],
  },
  yorkshire: {
    id: 'yorkshire',
    name: 'Yorkshire',
    taxIncome: 4,
    hasCastle: true,
    homeLordId: 'ivanhoe',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['northumberland', 'cumberland', 'lancashire', 'derbyshire', 'lincoln'],
    mapCoords: { x: 434, y: 238 },
    polygon: [
      { x: 365, y: 183 },
      { x: 483, y: 183 },
      { x: 518, y: 216 },
      { x: 540, y: 252 },
      { x: 529, y: 283 },
      { x: 422, y: 293 },
      { x: 354, y: 293 },
      { x: 342, y: 210 },
    ],
  },
  cheshire: {
    id: 'cheshire',
    name: 'Cheshire',
    taxIncome: 2,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['lancashire', 'derbyshire', 'shropshire'],
    mapCoords: { x: 302, y: 329 },
    polygon: [
      { x: 266, y: 293 },
      { x: 354, y: 293 },
      { x: 346, y: 363 },
      { x: 259, y: 363 },
      { x: 247, y: 326 },
    ],
  },
  derbyshire: {
    id: 'derbyshire',
    name: 'Derbyshire',
    taxIncome: 2,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['yorkshire', 'cheshire', 'notts', 'leicester'],
    mapCoords: { x: 378, y: 332 },
    polygon: [
      { x: 354, y: 293 },
      { x: 422, y: 293 },
      { x: 422, y: 310 },
      { x: 400, y: 316 },
      { x: 400, y: 370 },
      { x: 346, y: 363 },
    ],
  },
  notts: {
    id: 'notts',
    name: 'Nottingham',
    taxIncome: 2,
    hasCastle: false,
    isSherwood: true, // Robin Hood's sanctuary
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['derbyshire', 'lincoln', 'leicester'],
    mapCoords: { x: 436, y: 343 },
    polygon: [
      { x: 400, y: 316 },
      { x: 422, y: 310 },
      { x: 472, y: 316 },
      { x: 472, y: 373 },
      { x: 400, y: 370 },
    ],
  },
  lincoln: {
    id: 'lincoln',
    name: 'Lincolnshire',
    taxIncome: 3,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['yorkshire', 'notts', 'norfolk', 'leicester'],
    mapCoords: { x: 518, y: 336 },
    polygon: [
      { x: 422, y: 293 },
      { x: 529, y: 283 },
      { x: 562, y: 316 },
      { x: 574, y: 346 },
      { x: 578, y: 366 },
      { x: 548, y: 389 },
      { x: 494, y: 389 },
      { x: 472, y: 373 },
      { x: 472, y: 316 },
      { x: 422, y: 310 },
    ],
  },
  shropshire: {
    id: 'shropshire',
    name: 'Shropshire',
    taxIncome: 2,
    hasCastle: true,
    homeLordId: 'cedric',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['cheshire', 'gloucester', 'leicester'],
    mapCoords: { x: 300, y: 404 },
    polygon: [
      { x: 259, y: 363 },
      { x: 346, y: 363 },
      { x: 350, y: 446 },
      { x: 259, y: 446 },
      { x: 244, y: 404 },
    ],
  },
  leicester: {
    id: 'leicester',
    name: 'Leicestershire',
    taxIncome: 3,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['derbyshire', 'notts', 'lincoln', 'shropshire', 'gloucester', 'suffolk', 'essex'],
    mapCoords: { x: 434, y: 420 },
    polygon: [
      { x: 346, y: 363 },
      { x: 400, y: 370 },
      { x: 472, y: 373 },
      { x: 494, y: 389 },
      { x: 532, y: 426 },
      { x: 513, y: 469 },
      { x: 422, y: 472 },
      { x: 350, y: 446 },
    ],
  },
  norfolk: {
    id: 'norfolk',
    name: 'Norfolk',
    taxIncome: 3,
    hasCastle: true,
    homeLordId: 'malvoisin',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['lincoln', 'suffolk'],
    mapCoords: { x: 632, y: 396 },
    polygon: [
      { x: 578, y: 366 },
      { x: 616, y: 358 },
      { x: 676, y: 362 },
      { x: 712, y: 392 },
      { x: 703, y: 429 },
      { x: 548, y: 422 },
      { x: 548, y: 389 },
    ],
  },
  suffolk: {
    id: 'suffolk',
    name: 'Suffolk',
    taxIncome: 2,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['norfolk', 'leicester', 'essex'],
    mapCoords: { x: 604, y: 452 },
    polygon: [
      { x: 494, y: 389 },
      { x: 548, y: 389 },
      { x: 548, y: 422 },
      { x: 703, y: 429 },
      { x: 698, y: 456 },
      { x: 684, y: 479 },
      { x: 586, y: 482 },
      { x: 513, y: 469 },
      { x: 532, y: 426 },
    ],
  },
  gloucester: {
    id: 'gloucester',
    name: 'Gloucestershire',
    taxIncome: 2,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['shropshire', 'leicester', 'hampshire', 'cornwall'],
    mapCoords: { x: 334, y: 496 },
    polygon: [
      { x: 259, y: 446 },
      { x: 350, y: 446 },
      { x: 422, y: 472 },
      { x: 396, y: 535 },
      { x: 304, y: 545 },
      { x: 251, y: 515 },
      { x: 274, y: 482 },
    ],
  },
  essex: {
    id: 'essex',
    name: 'Essex',
    taxIncome: 4,
    hasCastle: true,
    homeLordId: 'frontdeboeuf',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['leicester', 'suffolk', 'hampshire', 'kent'],
    mapCoords: { x: 536, y: 509 },
    polygon: [
      { x: 422, y: 472 },
      { x: 513, y: 469 },
      { x: 586, y: 482 },
      { x: 662, y: 480 },
      { x: 668, y: 508 },
      { x: 646, y: 542 },
      { x: 548, y: 545 },
      { x: 479, y: 542 },
      { x: 422, y: 515 },
    ],
  },
  hampshire: {
    id: 'hampshire',
    name: 'Hampshire',
    taxIncome: 4,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['gloucester', 'essex', 'sussex', 'cornwall'],
    mapCoords: { x: 396, y: 568 },
    polygon: [
      { x: 396, y: 535 },
      { x: 422, y: 472 },
      { x: 422, y: 515 },
      { x: 479, y: 542 },
      { x: 475, y: 608 },
      { x: 404, y: 616 },
      { x: 335, y: 612 },
      { x: 304, y: 545 },
    ],
  },
  sussex: {
    id: 'sussex',
    name: 'Sussex',
    taxIncome: 2,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['hampshire', 'kent'],
    mapCoords: { x: 525, y: 578 },
    polygon: [
      { x: 479, y: 542 },
      { x: 548, y: 545 },
      { x: 601, y: 598 },
      { x: 540, y: 608 },
      { x: 475, y: 608 },
    ],
  },
  kent: {
    id: 'kent',
    name: 'Kent',
    taxIncome: 3,
    hasCastle: true,
    homeLordId: 'boisguilbert',
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['essex', 'sussex'],
    mapCoords: { x: 632, y: 572 },
    polygon: [
      { x: 548, y: 545 },
      { x: 646, y: 542 },
      { x: 704, y: 556 },
      { x: 710, y: 576 },
      { x: 688, y: 596 },
      { x: 601, y: 598 },
    ],
  },
  cornwall: {
    id: 'cornwall',
    name: 'Cornwall & Devon',
    taxIncome: 3,
    hasCastle: false,
    ownerId: null,
    garrison: { soldiers: 0, knights: 0, catapults: 0 },
    neighbors: ['gloucester', 'hampshire'],
    mapCoords: { x: 224, y: 590 },
    polygon: [
      { x: 251, y: 515 },
      { x: 304, y: 545 },
      { x: 335, y: 612 },
      { x: 266, y: 626 },
      { x: 184, y: 634 },
      { x: 108, y: 642 },
      { x: 92, y: 626 },
      { x: 126, y: 598 },
      { x: 178, y: 568 },
    ],
  },
};

export const TERRITORY_IDS = Object.keys(INITIAL_TERRITORIES);

/**
 * Strategic Coastal Sea Lanes (Sidequest Labs Edition)
 * Enables amphibious fleet landings and coastal port relocations for 5 Gold.
 */
export const EAST_COAST_PORTS: readonly string[] = [
  'northumberland',
  'yorkshire',
  'lincoln',
  'norfolk',
  'essex',
  'kent',
] as const;

export const WEST_COAST_PORTS: readonly string[] = [
  'kent',
  'wiltshire',
  'somerset',
  'sussex',
  'hampshire',
  'cornwall',
  'gloucester',
  'gwynedd',
  'cheshire',
  'lancashire',
  'cumberland',
] as const;

export const NAVAL_CHARTER_COST = 5;

export function isCoastalPort(territoryId: string): boolean {
  return (
    EAST_COAST_PORTS.includes(territoryId) ||
    WEST_COAST_PORTS.includes(territoryId)
  );
}

export function getConnectedSeaPorts(
  territoryId: string,
  territories?: Record<string, Territory>
): string[] {
  const ports = new Set<string>();
  if (EAST_COAST_PORTS.includes(territoryId)) {
    for (const p of EAST_COAST_PORTS) {
      if (p !== territoryId && (!territories || territories[p])) {
        ports.add(p);
      }
    }
  }
  if (WEST_COAST_PORTS.includes(territoryId)) {
    for (const p of WEST_COAST_PORTS) {
      if (p !== territoryId && (!territories || territories[p])) {
        ports.add(p);
      }
    }
  }
  return Array.from(ports);
}
