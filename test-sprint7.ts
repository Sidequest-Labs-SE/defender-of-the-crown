import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import {
  GameEdition,
  Season,
  getSeasonForMonth,
  getSeasonBadgeLabel,
} from './src/core/types.ts';
import { PALETTE, SIDEQUEST_PALETTE } from './src/data/palette.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log(
  'Testing Sprint 7 Edition Selector Architecture (CLASSIC vs SIDEQUEST_LABS), Seasonal Calendar Engine, Palette Isolation & Dual-Edition Save/Load Persistence...'
);

const gs = GameState.getInstance();

// ============================================================================
// 1. Classic Edition Default Initialization & Zero Regression Guarantee
// ============================================================================
console.log('1. Testing CLASSIC Edition Default Initialization & Isolation...');

gs.resetToDefaults();
assert(
  gs.getEdition() === 'CLASSIC',
  `Expected default edition to be 'CLASSIC', got '${gs.getEdition()}'`
);
assert(
  gs.isSidequestEdition() === false,
  'Expected isSidequestEdition() to be false by default'
);
assert(
  gs.getState().edition === 'CLASSIC',
  'Expected CampaignState.edition to default to CLASSIC'
);

// Calling startNewCampaign without an edition argument must preserve CLASSIC behavior for headless Sprint 1-6 compatibility
const classicState = gs.startNewCampaign('ivanhoe');
assert(
  classicState.edition === 'CLASSIC',
  'startNewCampaign("ivanhoe") without edition arg must default to CLASSIC'
);
assert(
  gs.isSidequestEdition() === false,
  'isSidequestEdition() must remain false on CLASSIC campaign'
);
assert(
  classicState.year === 1149 && classicState.month === 1 && classicState.turn === 1,
  'CLASSIC campaign must initialize at Jan 1149, Turn 1'
);

const playerClassic = gs.getPlayerLord();
assert(
  playerClassic.gold === 10 &&
    playerClassic.campaignArmy.soldiers === 10 &&
    playerClassic.campaignArmy.knights === 1 &&
    playerClassic.campaignArmy.catapults === 0,
  'CLASSIC starting lord stats & army must remain 100% identical to Sprint 6 Gold Master'
);

// Verify Classic PALETTE keys remain 100% intact alongside new SIDEQUEST_PALETTE
assert(PALETTE.ROYAL_BLUE === 0x285cc4, 'CLASSIC PALETTE.ROYAL_BLUE must remain untouched');
assert(PALETTE.BLOOD_RED === 0xa82020, 'CLASSIC PALETTE.BLOOD_RED must remain untouched');
assert(PALETTE.GOLD_BRIGHT === 0xf2d06b, 'CLASSIC PALETTE.GOLD_BRIGHT must remain untouched');
assert(
  Object.keys(SIDEQUEST_PALETTE).length >= 60,
  `Expected 64-color SIDEQUEST_PALETTE, found ${Object.keys(SIDEQUEST_PALETTE).length} colors`
);
assert(
  SIDEQUEST_PALETTE.GOLD_GLEAM === 0xf7d469 &&
    SIDEQUEST_PALETTE.TORCH_AMBER === 0xf59b23 &&
    SIDEQUEST_PALETTE.WINTER_FROST === 0xcbe4f5,
  'SIDEQUEST_PALETTE must expose HD-Retro metallic, torchlight, and seasonal colors'
);

// ============================================================================
// 2. Sidequest Labs Edition Switching & Initialization
// ============================================================================
console.log('2. Testing SIDEQUEST_LABS Edition State Switching & Campaign Creation...');

const editionsToVerify: GameEdition[] = ['CLASSIC', 'SIDEQUEST_LABS'];
assert(editionsToVerify.length === 2, 'Both CLASSIC and SIDEQUEST_LABS editions must be defined');
gs.setEdition('SIDEQUEST_LABS');
assert(
  gs.getEdition() === 'SIDEQUEST_LABS',
  'setEdition("SIDEQUEST_LABS") must update active edition'
);
assert(
  gs.isSidequestEdition() === true,
  'isSidequestEdition() must return true after setEdition("SIDEQUEST_LABS")'
);

// Starting campaign after setEdition('SIDEQUEST_LABS') inherits SIDEQUEST_LABS
const sqInherited = gs.startNewCampaign('geoffrey');
assert(
  sqInherited.edition === 'SIDEQUEST_LABS' && gs.isSidequestEdition() === true,
  'startNewCampaign(lordId) must inherit active SIDEQUEST_LABS edition when set via setEdition'
);

// Explicit edition override in startNewCampaign(selectedLordId, edition)
const explicitClassic = gs.startNewCampaign('wolfric', 'CLASSIC');
assert(
  explicitClassic.edition === 'CLASSIC' && gs.isSidequestEdition() === false,
  'startNewCampaign(lordId, "CLASSIC") must explicitly switch to CLASSIC'
);

const explicitSidequest = gs.startNewCampaign('cedric', 'SIDEQUEST_LABS');
assert(
  explicitSidequest.edition === 'SIDEQUEST_LABS' && gs.isSidequestEdition() === true,
  'startNewCampaign(lordId, "SIDEQUEST_LABS") must explicitly activate SIDEQUEST_LABS'
);

// TurnManager full round compatibility in SIDEQUEST_LABS mode
const tm = new TurnManager(gs);
const turnSummary = tm.endTurn();
assert(
  turnSummary.month === 2 && gs.isSidequestEdition() === true,
  'Advancing campaign round in SIDEQUEST_LABS must preserve edition state'
);

// ============================================================================
// 3. Seasonal Calendar Engine (WINTER, SPRING, SUMMER, AUTUMN across Months 1..12)
// ============================================================================
console.log('3. Testing Seasonal Mapping Across Months 1..12 & Calendar Progression...');

const expectedSeasonsByMonth: Record<number, { season: Season; badge: string }> = {
  1: { season: 'WINTER', badge: '❄ WINTER' },
  2: { season: 'WINTER', badge: '❄ WINTER' },
  3: { season: 'SPRING', badge: '🌱 SPRING' },
  4: { season: 'SPRING', badge: '🌱 SPRING' },
  5: { season: 'SPRING', badge: '🌱 SPRING' },
  6: { season: 'SUMMER', badge: '☀ SUMMER' },
  7: { season: 'SUMMER', badge: '☀ SUMMER' },
  8: { season: 'SUMMER', badge: '☀ SUMMER' },
  9: { season: 'AUTUMN', badge: '🍂 AUTUMN' },
  10: { season: 'AUTUMN', badge: '🍂 AUTUMN' },
  11: { season: 'AUTUMN', badge: '🍂 AUTUMN' },
  12: { season: 'WINTER', badge: '❄ WINTER' },
};

for (let m = 1; m <= 12; m++) {
  const season = getSeasonForMonth(m);
  const badge = getSeasonBadgeLabel(season);
  assert(
    season === expectedSeasonsByMonth[m].season,
    `Month ${m}: expected season ${expectedSeasonsByMonth[m].season}, got ${season}`
  );
  assert(
    badge === expectedSeasonsByMonth[m].badge,
    `Month ${m}: expected badge '${expectedSeasonsByMonth[m].badge}', got '${badge}'`
  );
}

// Walk an entire 12-month campaign year and verify GameState.getSeason() & getSeasonBadge()
gs.startNewCampaign('ivanhoe', 'SIDEQUEST_LABS');
for (let step = 0; step < 12; step++) {
  const curMonth = gs.getState().month;
  assert(
    gs.getSeason() === expectedSeasonsByMonth[curMonth].season,
    `GameState.getSeason() mismatch at month ${curMonth}`
  );
  assert(
    gs.getSeasonBadge() === expectedSeasonsByMonth[curMonth].badge,
    `GameState.getSeasonBadge() mismatch at month ${curMonth}`
  );
  gs.advanceCalendar();
}
assert(
  gs.getState().year === 1150 && gs.getState().month === 1 && gs.getSeason() === 'WINTER',
  'After 12 monthly advances, calendar must roll to Jan 1150 (WINTER)'
);

// ============================================================================
// 4. Save / Load Serialization & Dual-Slot LocalStorage Persistence
// ============================================================================
console.log('4. Testing Save/Load Persistence for CLASSIC vs SIDEQUEST_LABS...');

// 4A. Direct JSON Serialization / Deserialization
gs.startNewCampaign('ivanhoe', 'CLASSIC');
gs.advanceCalendar(); // Month 2
const classicJson = gs.serializeCampaign();
const parsedClassicPayload = JSON.parse(classicJson);
assert(
  parsedClassicPayload.edition === 'CLASSIC' &&
    parsedClassicPayload.state.edition === 'CLASSIC',
  'Serialized CLASSIC payload must persist edition: "CLASSIC"'
);

gs.startNewCampaign('cedric', 'SIDEQUEST_LABS');
gs.advanceCalendar(); // Month 2
gs.advanceCalendar(); // Month 3 (SPRING)
gs.advanceCalendar(); // Month 4 (SPRING)
const sidequestJson = gs.serializeCampaign();
const parsedSidequestPayload = JSON.parse(sidequestJson);
assert(
  parsedSidequestPayload.edition === 'SIDEQUEST_LABS' &&
    parsedSidequestPayload.state.edition === 'SIDEQUEST_LABS',
  'Serialized SIDEQUEST_LABS payload must persist edition: "SIDEQUEST_LABS"'
);

// Restore CLASSIC from JSON while currently in SIDEQUEST_LABS
assert(
  gs.deserializeCampaign(classicJson) === true,
  'deserializeCampaign(classicJson) must succeed'
);
assert(
  gs.getEdition() === 'CLASSIC' &&
    !gs.isSidequestEdition() &&
    gs.getState().selectedLordId === 'ivanhoe' &&
    gs.getState().month === 2,
  'Restoring CLASSIC JSON must restore edition="CLASSIC", lord="ivanhoe", month=2'
);

// Restore SIDEQUEST_LABS from JSON while currently in CLASSIC
assert(
  gs.deserializeCampaign(sidequestJson) === true,
  'deserializeCampaign(sidequestJson) must succeed'
);
assert(
  gs.getEdition() === 'SIDEQUEST_LABS' &&
    gs.isSidequestEdition() &&
    gs.getState().selectedLordId === 'cedric' &&
    gs.getState().month === 4 &&
    gs.getSeason() === 'SPRING',
  'Restoring SIDEQUEST_LABS JSON must restore edition="SIDEQUEST_LABS", lord="cedric", month=4 (SPRING)'
);

// 4B. Legacy Sprint 6 Save Payload Backwards Compatibility (no `edition` field)
const legacySprint6Payload = JSON.parse(classicJson);
delete legacySprint6Payload.edition;
delete legacySprint6Payload.state.edition;
assert(
  gs.deserializeCampaign(JSON.stringify(legacySprint6Payload)) === true,
  'Legacy Sprint 6 save payload without edition property must load cleanly'
);
assert(
  gs.getEdition() === 'CLASSIC' && !gs.isSidequestEdition(),
  'Legacy Sprint 6 save payload must default to CLASSIC edition'
);

// 4C. Dual-Slot window.localStorage Persistence (`dotc_save_v1` & `dotc_save_sidequest_v1`)
const mockStore = new Map<string, string>();
const hadWindow = typeof (globalThis as Record<string, unknown>).window !== 'undefined';
const previousWindow = (globalThis as Record<string, unknown>).window;

(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (mockStore.has(k) ? mockStore.get(k)! : null),
    setItem: (k: string, v: string) => {
      mockStore.set(k, String(v));
    },
    removeItem: (k: string) => {
      mockStore.delete(k);
    },
    clear: () => {
      mockStore.clear();
    },
  },
};

try {
  // Save a CLASSIC campaign
  gs.startNewCampaign('geoffrey', 'CLASSIC');
  gs.advanceCalendar(); // FEB 1149 (Turn 2)
  assert(gs.saveToStorage() === true, 'saveToStorage() for CLASSIC must succeed');
  assert(
    mockStore.has(GameState.SAVE_STORAGE_KEY),
    `CLASSIC save must write to ${GameState.SAVE_STORAGE_KEY}`
  );
  assert(
    !mockStore.has(GameState.SAVE_SIDEQUEST_STORAGE_KEY),
    'Saving CLASSIC must not touch dotc_save_sidequest_v1'
  );

  const classicMeta = gs.getSavedCampaignInfo();
  assert(
    classicMeta !== null &&
      classicMeta.edition === 'CLASSIC' &&
      classicMeta.lordId === 'geoffrey' &&
      classicMeta.monthLabel === 'FEB',
    'getSavedCampaignInfo() must identify saved CLASSIC campaign metadata'
  );

  // Save a SIDEQUEST_LABS campaign alongside the existing CLASSIC campaign
  gs.startNewCampaign('wolfric', 'SIDEQUEST_LABS');
  for (let i = 0; i < 9; i++) gs.advanceCalendar(); // OCT 1149 (AUTUMN)
  assert(gs.saveToStorage() === true, 'saveToStorage() for SIDEQUEST_LABS must succeed');
  assert(
    mockStore.has(GameState.SAVE_SIDEQUEST_STORAGE_KEY),
    `SIDEQUEST_LABS save must write to ${GameState.SAVE_SIDEQUEST_STORAGE_KEY}`
  );
  assert(
    mockStore.has(GameState.SAVE_STORAGE_KEY),
    'CLASSIC save slot must remain intact when saving SIDEQUEST_LABS'
  );

  // Verify most recent save info reports SIDEQUEST_LABS, while preferredEdition queries return each slot accurately
  const latestMeta = gs.getSavedCampaignInfo();
  assert(
    latestMeta !== null &&
      latestMeta.edition === 'SIDEQUEST_LABS' &&
      latestMeta.lordId === 'wolfric' &&
      latestMeta.monthLabel === 'OCT',
    'getSavedCampaignInfo() must report latest saved SIDEQUEST_LABS campaign'
  );

  const preferredClassicMeta = gs.getSavedCampaignInfo('CLASSIC');
  assert(
    preferredClassicMeta !== null &&
      preferredClassicMeta.edition === 'CLASSIC' &&
      preferredClassicMeta.lordId === 'geoffrey',
    'getSavedCampaignInfo("CLASSIC") must resolve the CLASSIC slot when requested'
  );

  const preferredSqMeta = gs.getSavedCampaignInfo('SIDEQUEST_LABS');
  assert(
    preferredSqMeta !== null &&
      preferredSqMeta.edition === 'SIDEQUEST_LABS' &&
      preferredSqMeta.lordId === 'wolfric',
    'getSavedCampaignInfo("SIDEQUEST_LABS") must resolve the SIDEQUEST_LABS slot when requested'
  );

  // Load each slot back and verify edition + campaign state restoration
  gs.resetToDefaults();
  assert(
    gs.loadFromStorage(GameState.SAVE_SIDEQUEST_STORAGE_KEY) === true,
    'loadFromStorage(SAVE_SIDEQUEST_STORAGE_KEY) must succeed'
  );
  assert(
    gs.isSidequestEdition() &&
      gs.getState().selectedLordId === 'wolfric' &&
      gs.getSeason() === 'AUTUMN',
    'Loading SIDEQUEST_LABS slot must activate SIDEQUEST_LABS edition and AUTUMN season'
  );

  assert(
    gs.loadFromStorage(GameState.SAVE_STORAGE_KEY) === true,
    'loadFromStorage(SAVE_STORAGE_KEY) must succeed'
  );
  assert(
    !gs.isSidequestEdition() &&
      gs.getEdition() === 'CLASSIC' &&
      gs.getState().selectedLordId === 'geoffrey' &&
      gs.getState().month === 2,
    'Loading CLASSIC slot must activate CLASSIC edition and restore Geoffrey Longsword campaign'
  );
} finally {
  if (hadWindow) {
    (globalThis as Record<string, unknown>).window = previousWindow;
  } else {
    delete (globalThis as Record<string, unknown>).window;
  }
  gs.resetToDefaults();
}

console.log(
  '✅ ALL SPRINT 7 EDITION ARCHITECTURE, SEASONAL CALENDAR & PERSISTENCE TESTS PASSED!'
);
