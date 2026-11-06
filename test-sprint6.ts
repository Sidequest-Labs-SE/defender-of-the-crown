import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import { JoustEngine, Point2D, PendingJoustContext } from './src/core/JoustEngine.ts';
import { AudioManager } from './src/utils/AudioManager.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log(
  'Testing Sprint 6 Royal Jousting Tournament, Lance Physics, Hit Zones, Stat Scaling, Fame vs Land Stakes, Save/Load Persistence, Procedural Web Audio...'
);

const gs = GameState.getInstance();

// ============================================================================
// 1. Joust Hit Zones & Shield Coordinate Space Classification
// ============================================================================
console.log('Testing Joust Hit-Zone Classification...');

// Center boss sweetspot (100, 100)
assert(
  JoustEngine.classifyHitZone({ x: 100, y: 100 }, 5) === 'UNHORSED',
  'Center boss (100, 100) must classify as UNHORSED'
);

// Slight offset within default sweetspot radius (20px)
assert(
  JoustEngine.classifyHitZone({ x: 108, y: 106 }, 5) === 'UNHORSED',
  'Impact within sweetspot radius must classify as UNHORSED'
);

// Outer shield body (beyond sweetspot, within 75px radius, y <= 190)
assert(
  JoustEngine.classifyHitZone({ x: 140, y: 100 }, 5) === 'LANCE_SHATTERED',
  'Impact on outer shield body must classify as LANCE_SHATTERED'
);
assert(
  JoustEngine.classifyHitZone({ x: 100, y: 150 }, 5) === 'LANCE_SHATTERED',
  'Impact on lower-center shield must classify as LANCE_SHATTERED'
);

// Upper helm rim / visor edge (y <= 30, x: 60..140)
assert(
  JoustEngine.classifyHitZone({ x: 100, y: 22 }, 5) === 'GLANCING_BLOW',
  'Impact on upper helm rim must classify as GLANCING_BLOW'
);

// Clean Miss (off target entirely)
assert(
  JoustEngine.classifyHitZone({ x: 10, y: 10 }, 5) === 'MISS',
  'Impact far off-target (10, 10) must classify as MISS'
);
assert(
  JoustEngine.classifyHitZone({ x: 195, y: 100 }, 5) === 'MISS',
  'Impact far right of shield (195, 100) must classify as MISS'
);

// Horse strike / Low hazard band (y > 190) -> FOUL
assert(
  JoustEngine.classifyHitZone({ x: 100, y: 205 }, 5) === 'FOUL_HIT_HORSE',
  'Striking low below saddle into steed (y > 190) must classify as FOUL_HIT_HORSE'
);
assert(
  JoustEngine.classifyHitZone({ x: 60, y: 220 }, 5) === 'FOUL_HIT_HORSE',
  'Striking horse body must classify as FOUL_HIT_HORSE'
);

// ============================================================================
// 2. Jousting Stat Scaling (1..10): Cedric (9) vs Wolfric (4)
// ============================================================================
console.log('Testing Jousting Stat Scaling: Cedric (9) vs Wolfric (4)...');

const cedricRadius = JoustEngine.getSweetspotRadius(9);
const wolfricRadius = JoustEngine.getSweetspotRadius(4);
assert(
  cedricRadius > wolfricRadius,
  `Cedric sweetspot radius (${cedricRadius}) must be larger than Wolfric (${wolfricRadius})`
);
assert(
  cedricRadius === 20 * (1 + 4 * 0.05),
  'Cedric sweetspot radius must scale at +5% per stat point above baseline 5'
);
assert(
  wolfricRadius === 20 * (1 - 1 * 0.05),
  'Wolfric sweetspot radius must scale down at -5% below baseline 5'
);

const cedricSway = JoustEngine.getSwayMultiplier(9);
const wolfricSway = JoustEngine.getSwayMultiplier(4);
assert(
  cedricSway < wolfricSway,
  `Cedric sway multiplier (${cedricSway}) must be lower than Wolfric (${wolfricSway})`
);
assert(
  Math.abs(cedricSway - (1 - 4 * 0.07)) < 0.0001,
  'Cedric lance sway must be reduced by -7% per point above baseline 5'
);
assert(
  Math.abs(wolfricSway - (1 + 1 * 0.07)) < 0.0001,
  'Wolfric lance sway must be increased by +7% below baseline 5'
);

// AI Monte Carlo test: Cedric (9) vs Wolfric (4) over 100 aim attempts
let cedricUnhorseCount = 0;
let wolfricUnhorseCount = 0;
for (let i = 0; i < 100; i++) {
  const cAim = JoustEngine.resolveAiAim(9);
  const wAim = JoustEngine.resolveAiAim(4);
  if (JoustEngine.classifyHitZone(cAim, 9) === 'UNHORSED') cedricUnhorseCount++;
  if (JoustEngine.classifyHitZone(wAim, 4) === 'UNHORSED') wolfricUnhorseCount++;
}
assert(
  cedricUnhorseCount > wolfricUnhorseCount,
  `Cedric (9) unhorse count (${cedricUnhorseCount}) must exceed Wolfric (4) (${wolfricUnhorseCount})`
);

// ============================================================================
// 3. Match Progression & Foul Disqualification
// ============================================================================
console.log('Testing Match Progression and Foul Disqualification...');

// A. Challenger commits foul -> Immediate RIVAL_WON
const foulContext: PendingJoustContext = {
  challengerLordId: 'ivanhoe',
  rivalLordId: 'boisguilbert',
  stakes: 'FAME',
  passesCompleted: 0,
  maxPasses: 3,
  challengerScore: 0,
  rivalScore: 0,
  challengerBrokenLances: 0,
  rivalBrokenLances: 0,
  matchStatus: 'IN_PROGRESS',
  history: [],
};

const foulPass = JoustEngine.resolveJoustPass(
  foulContext,
  { x: 100, y: 215 }, // Foul hit on horse
  { x: 140, y: 100 }  // Shattered lance
);
assert(
  foulPass.challengerHitZone === 'FOUL_HIT_HORSE',
  'Challenger hit zone must be FOUL_HIT_HORSE'
);
assert(
  foulContext.matchStatus === 'RIVAL_WON',
  'Challenger horse strike must result in immediate RIVAL_WON disqualification'
);

// B. Rival commits foul -> Immediate CHALLENGER_WON
const rivalFoulContext: PendingJoustContext = {
  challengerLordId: 'ivanhoe',
  rivalLordId: 'boisguilbert',
  stakes: 'FAME',
  passesCompleted: 0,
  maxPasses: 3,
  challengerScore: 0,
  rivalScore: 0,
  challengerBrokenLances: 0,
  rivalBrokenLances: 0,
  matchStatus: 'IN_PROGRESS',
  history: [],
};

const rivalFoulPass = JoustEngine.resolveJoustPass(
  rivalFoulContext,
  { x: 140, y: 100 }, // Shattered lance
  { x: 100, y: 215 }  // Rival strikes horse
);
assert(
  rivalFoulPass.rivalHitZone === 'FOUL_HIT_HORSE',
  'Rival hit zone must be FOUL_HIT_HORSE'
);
assert(
  rivalFoulContext.matchStatus === 'CHALLENGER_WON',
  'Rival horse strike must result in immediate CHALLENGER_WON disqualification'
);

// C. Direct Unhorse -> Immediate Match End
const unhorseContext: PendingJoustContext = {
  challengerLordId: 'cedric',
  rivalLordId: 'malvoisin',
  stakes: 'FAME',
  passesCompleted: 0,
  maxPasses: 3,
  challengerScore: 0,
  rivalScore: 0,
  challengerBrokenLances: 0,
  rivalBrokenLances: 0,
  matchStatus: 'IN_PROGRESS',
  history: [],
};

const unhorsePass = JoustEngine.resolveJoustPass(
  unhorseContext,
  { x: 100, y: 100 }, // Sweetspot
  { x: 10, y: 10 }    // Miss
);
assert(
  unhorsePass.challengerHitZone === 'UNHORSED',
  'Bullseye strike must be UNHORSED'
);
assert(
  unhorseContext.matchStatus === 'CHALLENGER_WON',
  'Direct unhorse must instantly win match'
);

// ============================================================================
// 4. Fame Stakes vs Land Stakes Resolution
// ============================================================================
console.log('Testing Fame Stakes and Land Stakes Resolution in GameState...');

// A. Fame Stakes: +15 Gold Royal Purse, +1 Leadership, +1 Jousting
gs.startNewCampaign('ivanhoe');
const initialGold = gs.getPlayerLord().gold;
const initialLdr = gs.getPlayerLord().leadership;
const initialJoust = gs.getPlayerLord().jousting;

const fameInit = gs.initiateJoust('boisguilbert', 'FAME');
assert(fameInit.success && !!fameInit.context, 'Must initiate Fame joust');

gs.commitJoustOutcome({
  context: {
    ...fameInit.context!,
    matchStatus: 'CHALLENGER_WON',
  },
  winnerLordId: 'ivanhoe',
  goldAwarded: 15,
  narrativeChronicle: 'Ivanhoe triumphed in the King lists for Fame.',
});

const afterFamePlayer = gs.getPlayerLord();
assert(
  afterFamePlayer.gold === initialGold + 15,
  `Player gold must increase by +15 (was ${initialGold}, now ${afterFamePlayer.gold})`
);
assert(
  afterFamePlayer.leadership === initialLdr + 1,
  `Player leadership must increase by +1 (was ${initialLdr}, now ${afterFamePlayer.leadership})`
);
assert(
  afterFamePlayer.jousting === Math.min(10, initialJoust + 1),
  `Player jousting must increase by +1 (was ${initialJoust}, now ${afterFamePlayer.jousting})`
);

// B. Land Stakes Validation and Territory Transfer
gs.startNewCampaign('ivanhoe');
// Give player a second territory and give Bois-Guilbert a second territory so both can wager land
gs.getTerritory('cumberland')!.ownerId = 'ivanhoe';
gs.getTerritory('sussex')!.ownerId = 'boisguilbert';

assert(
  JoustEngine.canWagerLand(gs.getState(), 'ivanhoe', 'boisguilbert').allowed,
  'Both lords owning non-home territories must allow Land wagering'
);

const landInit = gs.initiateJoust('boisguilbert', 'LAND', 'sussex');
assert(landInit.success && !!landInit.context, 'Must initiate Land joust');

// Player wins the joust -> Sussex transfers to Ivanhoe!
gs.commitJoustOutcome({
  context: {
    ...landInit.context!,
    matchStatus: 'CHALLENGER_WON',
  },
  winnerLordId: 'ivanhoe',
  territoryTransferredId: 'sussex',
  narrativeChronicle: 'Ivanhoe won Sussex in the Royal Lists.',
});

assert(
  gs.getTerritory('sussex')?.ownerId === 'ivanhoe',
  'Won territory Sussex must transfer ownership to Ivanhoe'
);
assert(
  gs.getPlayerTerritories().some((t) => t.id === 'sussex'),
  'Player owned territories must include won territory'
);

// ============================================================================
// 5. Campaign Save / Load Persistence
// ============================================================================
console.log('Testing Campaign Serialization and Save/Load Persistence...');

gs.startNewCampaign('geoffrey');
gs.getPlayerLord().gold = 42;
gs.mutateState((s) => {
  s.month = 7;
  s.year = 1150;
});

// Test serialization & deserialization
const serialized = gs.serializeCampaign();
assert(typeof serialized === 'string' && serialized.length > 200, 'Serialized state must be valid string');

const parsed = JSON.parse(serialized);
assert(parsed.version === 1, 'Save version must be 1');
assert(parsed.state.selectedLordId === 'geoffrey', 'Selected lord must match');
assert(parsed.state.activeLords['geoffrey'].gold === 42, 'Lord gold must match');
assert(parsed.state.month === 7, 'Calendar month must match');
assert(parsed.state.year === 1150, 'Campaign year must match');

// Test deserialization into fresh state
gs.startNewCampaign('cedric');
assert(gs.getPlayerLord().id === 'cedric', 'Player must temporarily be Cedric');

const restored = gs.deserializeCampaign(serialized);
assert(restored, 'Campaign deserialization must return true');
assert(gs.getPlayerLord().id === 'geoffrey', 'Restored lord must be Geoffrey');
assert(gs.getPlayerLord().gold === 42, 'Restored gold must be 42');
assert(gs.getState().month === 7, 'Restored month must be 7');
assert(gs.getState().year === 1150, 'Restored year must be 1150');

// Mock localStorage for storage methods
const storageMap: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storageMap[key] || null,
  setItem: (key: string, val: string) => {
    storageMap[key] = val;
  },
  removeItem: (key: string) => {
    delete storageMap[key];
  },
  clear: () => {
    Object.keys(storageMap).forEach((k) => delete storageMap[k]);
  },
};

(globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;
(globalThis as unknown as { window: { localStorage: typeof mockLocalStorage } }).window = {
  localStorage: mockLocalStorage,
};

assert(gs.saveToStorage(), 'saveToStorage() must return true with localStorage present');
assert(gs.hasSavedCampaign(), 'hasSavedCampaign() must detect saved campaign');

// Reset to Cedric and restore from storage
gs.startNewCampaign('cedric');
assert(gs.loadFromStorage(), 'loadFromStorage() must return true');
assert(gs.getPlayerLord().id === 'geoffrey', 'Storage restore must load Geoffrey');
assert(gs.getPlayerLord().gold === 42, 'Storage restore must have 42 gold');

// ============================================================================
// 6. Procedural Web Audio Manager Graceful Degradation
// ============================================================================
console.log('Testing AudioManager in headless Node environment...');

const audio = AudioManager.getInstance();
assert(typeof audio.isMuted() === 'boolean', 'isMuted must return boolean');
assert(audio.toggleMute() === true, 'toggleMute must toggle to true');
assert(audio.toggleMute() === false, 'toggleMute must toggle back to false');

// Calling all sound triggers in headless environment must not throw!
audio.playFanfare();
audio.playHoofbeats();
audio.playLanceImpact(true);
audio.playLanceImpact(false);
audio.playSwordClash(true);
audio.playSwordClash(false);
audio.playCatapultLaunch();
audio.playWallCrash();
audio.playCrowdCheer();
audio.playFoulHorn();
audio.playUiClick();
console.log('AudioManager headless execution verified with zero errors.');

console.log('✅ ALL SPRINT 6 TESTS PASSED SUCCESSFULLY!');
