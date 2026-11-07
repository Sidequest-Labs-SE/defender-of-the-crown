import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import { BattleEngine } from './src/core/BattleEngine.ts';
import { SiegeEngine } from './src/core/SiegeEngine.ts';
import { CombatResolver } from './src/core/CombatResolver.ts';
import { SwordplayEngine } from './src/core/SwordplayEngine.ts';
import { UNIT_COSTS } from './src/core/types.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Testing Sprint 8: Sidequest Labs Edition Gameplay Expansion...');

const gs = GameState.getInstance();

// ============================================================================
// 1. CLASSIC Mode Isolation & Zero Regression
// ============================================================================
console.log('1. Testing CLASSIC Mode Isolation (Sprint 8 mechanics forbidden in CLASSIC)...');

gs.resetToDefaults();
gs.startNewCampaign('ivanhoe', 'CLASSIC');

// 1A. Selecting a Norman Lord in CLASSIC must throw error
let normanSelectedInClassic = false;
try {
  gs.startNewCampaign('malvoisin', 'CLASSIC');
  normanSelectedInClassic = true;
} catch (e: any) {
  assert(
    e.message.includes('valid Saxon Lord'),
    `Expected valid Saxon Lord error, got: ${e.message}`
  );
}
assert(
  !normanSelectedInClassic,
  'CLASSIC mode must strictly reject selecting Norman lords as player!'
);

// Re-init classic campaign for remaining isolation tests
gs.startNewCampaign('ivanhoe', 'CLASSIC');
const playerClassic = gs.getPlayerLord();

// 1B. Purchasing archers rejected in CLASSIC
const archerBuyClassic = gs.purchaseUnit(playerClassic.id, 'archers', 1, 'campaign');
assert(
  !archerBuyClassic.success,
  'Purchasing archers in CLASSIC mode must be rejected!'
);
assert(
  (playerClassic.campaignArmy.archers ?? 0) === 0,
  'CLASSIC army archers must remain 0'
);

// 1C. Troop transfer of archers rejected in CLASSIC
const archerTransferClassic = gs.transferTroops(playerClassic.id, 'toGarrison', 'archers', 1);
assert(
  !archerTransferClassic.success,
  'Transferring archers in CLASSIC mode must be rejected!'
);

// 1D. Building market / upgrading royal keep rejected in CLASSIC
const marketClassic = gs.buildMarket(playerClassic.id, 'yorkshire');
assert(!marketClassic.success, 'Building Market in CLASSIC mode must be rejected!');

const keepClassic = gs.upgradeRoyalKeep(playerClassic.id, 'yorkshire');
assert(!keepClassic.success, 'Upgrading Royal Keep in CLASSIC mode must be rejected!');

// 1E. Tavern actions rejected in CLASSIC
const spyClassic = gs.hireSpy();
assert(!spyClassic.success, 'Hiring Spy in CLASSIC mode must be rejected!');

const saboteurClassic = gs.sendSaboteur('norfolk');
assert(!saboteurClassic.success, 'Sending Saboteur in CLASSIC mode must be rejected!');

const mercsClassic = gs.hireMercenaries();
assert(!mercsClassic.success, 'Hiring Mercenaries in CLASSIC mode must be rejected!');

const pactClassic = gs.proposeNonAggressionPact('cedric');
assert(!pactClassic.success, 'Proposing Non-Aggression Pact in CLASSIC mode must be rejected!');

const ransomClassic = gs.contributeRoyalRansom(25);
assert(!ransomClassic.success, 'Royal Ransom contribution in CLASSIC mode must be rejected!');

// ============================================================================
// 2. Playable Norman Lords Campaign Initialization & Faction Sanctuary
// ============================================================================
console.log('2. Testing Playable Norman Lords Campaign Initialization & Faction Sanctuary...');

// 2A. Initialize as Phillip Malvoisin (Norfolk home castle)
gs.startNewCampaign('malvoisin', 'SIDEQUEST_LABS');
const normanPlayer = gs.getPlayerLord();
assert(normanPlayer.id === 'malvoisin', 'Player Lord should be malvoisin');
assert(normanPlayer.faction === 'norman', 'Player Lord faction should be norman');
assert(normanPlayer.isPlayer === true, 'Player Lord isPlayer should be true');
assert(
  normanPlayer.homeTerritoryId === 'norfolk',
  `Expected Norfolk home territory for Malvoisin, got: ${normanPlayer.homeTerritoryId}`
);
assert(
  normanPlayer.currentTerritoryId === 'norfolk',
  `Expected Malvoisin host stationed at Norfolk, got: ${normanPlayer.currentTerritoryId}`
);

const stateNorman = gs.getState();
assert(stateNorman.playerFaction === 'norman', 'State playerFaction should be norman');
assert(stateNorman.territories.norfolk.ownerId === 'malvoisin', 'Norfolk must be owned by Malvoisin');
assert(stateNorman.territories.norfolk.hasCastle === true, 'Norfolk must have a fortified stone castle');

// Verify active lords: 3 Normans + 3 Saxons = 6 active lords
const activeLords = Object.values(stateNorman.activeLords);
assert(activeLords.length === 6, `Expected exactly 6 active lords, got ${activeLords.length}`);
const normanCount = activeLords.filter((l) => l.faction === 'norman').length;
const saxonCount = activeLords.filter((l) => l.faction === 'saxon').length;
assert(normanCount === 3, `Expected 3 active Norman lords, got ${normanCount}`);
assert(saxonCount === 3, `Expected 3 active Saxon lords, got ${saxonCount}`);

// 2B. Test Prince John's Charter Reinforcements
const initialSoldiers = normanPlayer.campaignArmy.soldiers;
const initialArchers = normanPlayer.campaignArmy.archers ?? 0;
const charterResult = gs.invokePrinceJohnCharter();
assert(charterResult.success === true, `Expected Charter success, got: ${charterResult.message}`);
assert(
  normanPlayer.campaignArmy.soldiers === initialSoldiers + 10,
  `Expected +10 soldiers from Prince John, got ${normanPlayer.campaignArmy.soldiers}`
);
assert(
  (normanPlayer.campaignArmy.archers ?? 0) === initialArchers + 2,
  `Expected +2 archers from Prince John, got ${normanPlayer.campaignArmy.archers}`
);
assert(gs.getState().robinHoodUsesLeft === 2, `Expected 2 uses left, got ${gs.getState().robinHoodUsesLeft}`);
assert(gs.getState().robinHoodUsedThisTurn === true, 'robinHoodUsedThisTurn must be true');

// Second invocation in same turn must be rejected
const secondCharter = gs.invokePrinceJohnCharter();
assert(!secondCharter.success, 'Should not allow multiple charter invocations in the same turn');

// 2C. Test Prince John's Royal Writ Dungeon Bailout
gs.resetTurnLocks();
const raidInit = gs.initiateCastleRaid('cedric');
assert(raidInit.success === true, `Failed to initiate castle raid: ${raidInit.message}`);
const normanSwordplay = SwordplayEngine.createSession(
  gs.getState(),
  raidInit.context!,
  { deterministic: true }
);
// Simulate defeat
normanSwordplay.status = 'DEFEATED';
const bailoutOutcome = SwordplayEngine.commitMissionOutcome(normanSwordplay, gs, {
  useRobinHoodBailout: true,
});
assert(
  bailoutOutcome.robinHoodBailoutUsed === true,
  'Norman player with remaining favors should be bailed out via Prince John Royal Writ!'
);
assert(
  bailoutOutcome.headline === 'PRINCE JOHN ROYAL WRIT BAILOUT!',
  `Expected Royal Writ headline, got: ${bailoutOutcome.headline}`
);
assert(
  bailoutOutcome.chronicleMessage.includes("Prince John's Royal Writ"),
  `Expected Royal Writ in chronicle, got: ${bailoutOutcome.chronicleMessage}`
);
assert(
  gs.getState().robinHoodUsesLeft === 1,
  `Expected 1 writ remaining after bailout, got ${gs.getState().robinHoodUsesLeft}`
);

// ============================================================================
// 3. Longbowmen (Archers) Recruitment, Transfers, & BattleEngine Mechanics
// ============================================================================
console.log('3. Testing Longbowmen (Archers) Recruitment, Transfers, & Tactical Battle...');

gs.startNewCampaign('ivanhoe', 'SIDEQUEST_LABS');
const playerSaxon = gs.getPlayerLord();
playerSaxon.gold = 50;

// 3A. Purchase archers (4 Gold each)
const initialArcherCount = playerSaxon.campaignArmy.archers ?? 0;
const buyRes = gs.purchaseUnit(playerSaxon.id, 'archers', 3, 'campaign');
assert(buyRes.success === true, `Failed to buy archers: ${buyRes.message}`);
assert(playerSaxon.gold === 50 - 3 * UNIT_COSTS.archers, `Expected 38G remaining, got ${playerSaxon.gold}`);
assert(
  playerSaxon.campaignArmy.archers === initialArcherCount + 3,
  `Expected ${initialArcherCount + 3} archers, got ${playerSaxon.campaignArmy.archers}`
);

// 3B. Transfer archers to garrison and back
const homeTerr = gs.getState().territories.yorkshire;
const initialGarrisonArchers = homeTerr.garrison.archers ?? 0;
const transToGar = gs.transferTroops(playerSaxon.id, 'toGarrison', 'archers', 2);
assert(transToGar.success === true, `Failed to transfer archers to garrison: ${transToGar.message}`);
const updatedHomeTerr = gs.getState().territories.yorkshire;
assert(
  updatedHomeTerr.garrison.archers === initialGarrisonArchers + 2,
  `Expected 2 garrison archers, got ${updatedHomeTerr.garrison.archers}`
);
assert(
  playerSaxon.campaignArmy.archers === 1,
  `Expected 1 army archer left, got ${playerSaxon.campaignArmy.archers}`
);

const transToArm = gs.transferTroops(playerSaxon.id, 'toFieldArmy', 'archers', 1);
assert(transToArm.success === true, `Failed to transfer archer to field army: ${transToArm.message}`);
assert(playerSaxon.campaignArmy.archers === 2, 'Expected 2 army archers');

// 3C. BattleEngine: Ranged Arrow Volleys
// Attacker has 10 archers, defender has stand and fight or ferocious attack
gs.mutateState((st) => {
  st.activeLords['ivanhoe'].campaignArmy = { soldiers: 0, knights: 0, catapults: 0, archers: 10 };
  st.territories['lincoln'].ownerId = 'frontdeboeuf';
  st.territories['lincoln'].hasCastle = false; // Open field
  st.territories['lincoln'].garrison = { soldiers: 30, knights: 0, catapults: 0, archers: 0 };
  st.activeLords['frontdeboeuf'].currentTerritoryId = 'norfolk';
});

const battleSession = BattleEngine.createBattleSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'lincoln' },
  { deterministic: true }
);

// Tick with defender in FEROCIOUS_ATTACK (+30% archer damage bonus)
battleSession.attackerTactic = 'STAND_AND_FIGHT';
battleSession.defenderTactic = 'FEROCIOUS_ATTACK';
const tickReport = BattleEngine.stepTick(battleSession);

assert(
  tickReport.attackerArcherVolleyFired === true,
  'Attacker archers must fire an arrow volley when archers > 0'
);
// 10 archers * 2.5 * 1.30 * 1.35 (lead) = 43.875 damage dealt!
assert(
  tickReport.attackerDamageDealt >= 30,
  `Expected >= 30 archer damage vs FEROCIOUS_ATTACK, got ${tickReport.attackerDamageDealt}`
);

// 3D. Tactical Outflank charge striking rear-line archers
gs.mutateState((st) => {
  st.activeLords['frontdeboeuf'].campaignArmy = { soldiers: 10, knights: 5, catapults: 0, archers: 0 };
  st.territories['lincoln'].ownerId = 'ivanhoe';
  st.territories['lincoln'].hasCastle = false;
  st.territories['lincoln'].garrison = { soldiers: 20, knights: 0, catapults: 0, archers: 8 };
  st.activeLords['ivanhoe'].currentTerritoryId = 'yorkshire';
});

const outflankSession = BattleEngine.createBattleSession(
  gs.getState(),
  { attackerId: 'frontdeboeuf', territoryId: 'lincoln' },
  { deterministic: true }
);
outflankSession.attackerTactic = 'OUTFLANK';
outflankSession.defenderTactic = 'NORMAL_ATTACK';
const outflankTick = BattleEngine.stepTick(outflankSession);

assert(
  (outflankSession.defenderDamagePools.archers ?? 0) > 0 || (outflankTick.defenderLosses.archers ?? 0) > 0,
  `Cavalry OUTFLANK must route damage into rear-line archers! Got pool: ${outflankSession.defenderDamagePools.archers}, losses: ${outflankTick.defenderLosses.archers}`
);

// ============================================================================
// 4. Territory Upgrades: Market/Mill & Royal Keep
// ============================================================================
console.log('4. Testing Territory Upgrades (Market/Mill & Royal Keep)...');

gs.startNewCampaign('ivanhoe', 'SIDEQUEST_LABS');
const playerLord = gs.getPlayerLord();
playerLord.gold = 100;

// 4A. Build Market (12 Gold, +2G/mo tax)
const initialTax = gs.getLordTaxIncome(playerLord.id);
const marketBuild = gs.buildMarket(playerLord.id, 'yorkshire');
assert(marketBuild.success === true, `Failed to build market: ${marketBuild.message}`);
assert(playerLord.gold === 100 - UNIT_COSTS.market, `Expected 88G, got ${playerLord.gold}`);
assert(gs.getState().territories.yorkshire.hasMarket === true, 'Yorkshire hasMarket must be true');

const upgradedTax = gs.getLordTaxIncome(playerLord.id);
assert(
  upgradedTax === initialTax + 2,
  `Expected tax to increase by +2 Gold/mo (from ${initialTax} to ${initialTax + 2}), got ${upgradedTax}`
);

// Building duplicate market in same territory must fail
const dupMarket = gs.buildMarket(playerLord.id, 'yorkshire');
assert(!dupMarket.success, 'Duplicate market in same territory must be rejected!');

// 4B. Upgrade Royal Keep (30 Gold, 150 Wall Integrity & 1.40x defense bonus)
// Yorkshire already has hasCastle === true
const keepUpgrade = gs.upgradeRoyalKeep(playerLord.id, 'yorkshire');
assert(keepUpgrade.success === true, `Failed to upgrade Royal Keep: ${keepUpgrade.message}`);
assert(playerLord.gold === 88 - UNIT_COSTS.royalKeep, `Expected 58G, got ${playerLord.gold}`);
assert(gs.getState().territories.yorkshire.isRoyalKeep === true, 'Yorkshire isRoyalKeep must be true');

// Verify Royal Keep defense multiplier in BattleEngine (+40% = 1.40x)
const keepMultiplier = BattleEngine.getCastleDefenseMultiplier(150, true, true);
assert(
  Math.abs(keepMultiplier - 1.40) < 0.001,
  `Expected 1.40x defense multiplier for Royal Keep, got ${keepMultiplier}`
);

// Verify SiegeEngine initialization with 150 wall integrity
gs.mutateState((st) => {
  st.activeLords['frontdeboeuf'].campaignArmy = { soldiers: 20, knights: 0, catapults: 2, archers: 0 };
  st.territories['yorkshire'].garrison = { soldiers: 10, knights: 0, catapults: 0, archers: 4 };
});

const siegeSession = SiegeEngine.createSiegeSession(
  gs.getState(),
  { attackerId: 'frontdeboeuf', territoryId: 'yorkshire' },
  { deterministic: true, enableCounterFire: true }
);
assert(siegeSession.maxWallIntegrity === 150, `Expected maxWallIntegrity 150, got ${siegeSession.maxWallIntegrity}`);
assert(siegeSession.wallIntegrity === 150, `Expected wallIntegrity 150, got ${siegeSession.wallIntegrity}`);

// Counter-battery fire chance boosted by defender archers (+2% per archer = +8%)
const counterBatteryPct = SiegeEngine.calculateCounterBatteryChance(
  { soldiers: 10, knights: 0, catapults: 0, archers: 4 }
);
assert(
  Math.abs(counterBatteryPct - 0.23) < 0.001,
  `Expected 23% (0.23) counter-battery chance with 4 archers, got ${counterBatteryPct}`
);

// ============================================================================
// 5. The Tavern: Espionage, Sabotage, Mercenaries & Diplomacy Pacts
// ============================================================================
console.log('5. Testing The Tavern: Espionage, Sabotage, Mercenaries & Diplomacy Pacts...');

gs.startNewCampaign('ivanhoe', 'SIDEQUEST_LABS');
const tavernPlayer = gs.getPlayerLord();
tavernPlayer.gold = 100;

// 5A. Hire Spy (5G)
const spyRes = gs.hireSpy();
assert(spyRes.success === true, `Failed to hire spy: ${spyRes.message}`);
assert(tavernPlayer.gold === 95, `Expected 95G after spy, got ${tavernPlayer.gold}`);
assert(gs.getState().spiedTurnsRemaining === 3, `Expected 3 spied turns, got ${gs.getState().spiedTurnsRemaining}`);

// 5B. Send Saboteur (12G, poisons 15% garrison soldiers and damages walls by -30)
gs.mutateState((st) => {
  st.territories.norfolk.garrison = { soldiers: 20, knights: 2, catapults: 1, archers: 0 };
  st.activeLords['ivanhoe'].campaignArmy.catapults = 1;
});
const saboteurRes = gs.sendSaboteur('norfolk');
assert(saboteurRes.success === true, `Failed to send saboteur: ${saboteurRes.message}`);
assert(tavernPlayer.gold === 95 - 12, `Expected 83G after saboteur, got ${tavernPlayer.gold}`);
const enemyTargetTerr = gs.getState().territories.norfolk;
assert(enemyTargetTerr.sabotagedWallDamage === 30, `Expected 30 sabotaged wall damage, got ${enemyTargetTerr.sabotagedWallDamage}`);
assert(
  enemyTargetTerr.garrison.soldiers === 17, // 20 - ceil(20 * 0.15) = 17
  `Expected 17 garrison soldiers after poisoning 15%, got ${enemyTargetTerr.garrison.soldiers}`
);

// Verify that a siege created against the sabotaged castle starts with wallIntegrity reduced by 30
const sabotagedSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'norfolk' },
  { deterministic: true }
);
assert(
  sabotagedSiege.wallIntegrity === 70,
  `Expected 70 starting wall integrity after -30 sabotage, got ${sabotagedSiege.wallIntegrity}`
);

// 5C. Hire Mercenaries (15G, +8 Soldiers & +2 Longbowmen)
const preMercArmy = { ...tavernPlayer.campaignArmy };
const mercRes = gs.hireMercenaries();
assert(mercRes.success === true, `Failed to hire mercenaries: ${mercRes.message}`);
assert(tavernPlayer.gold === 83 - 15, `Expected 68G after mercenaries, got ${tavernPlayer.gold}`);
assert(
  tavernPlayer.campaignArmy.soldiers === preMercArmy.soldiers + 8,
  `Expected +8 soldiers from mercenaries, got ${tavernPlayer.campaignArmy.soldiers}`
);
assert(
  (tavernPlayer.campaignArmy.archers ?? 0) === (preMercArmy.archers ?? 0) + 2,
  `Expected +2 archers from mercenaries, got ${tavernPlayer.campaignArmy.archers}`
);

// Second mercenary hire in same turn must fail
const dupMerc = gs.hireMercenaries();
assert(!dupMerc.success, 'Should not allow hiring mercenaries twice in one month!');

// 5D. Propose Non-Aggression Pact (10G, 3 Turns with same-faction AI)
const pactRes = gs.proposeNonAggressionPact('cedric');
assert(pactRes.success === true, `Failed to sign pact: ${pactRes.message}`);
assert(tavernPlayer.gold === 68 - 10, `Expected 58G after pact, got ${tavernPlayer.gold}`);
const cedric = gs.getState().activeLords.cedric;
assert(cedric.pactWithPlayerTurns === 3, `Expected 3 pact turns on Cedric, got ${cedric.pactWithPlayerTurns}`);

// TurnManager AI must NOT attack player territories while pact is active!
gs.mutateState((st) => {
  st.activeLords.cedric.currentTerritoryId = 'cumberland';
  st.territories.cumberland.ownerId = 'cedric';
  st.territories.northumberland.ownerId = 'cedric';
  st.territories.lancashire.ownerId = 'cedric';
  st.activeLords.cedric.campaignArmy = { soldiers: 50, knights: 10, catapults: 2, archers: 10 };
  // Make player's yorkshire undefended so it would be irresistible without a pact
  st.territories.yorkshire.garrison = { soldiers: 1, knights: 0, catapults: 0, archers: 0 };
});

const turnMgr = new TurnManager(gs);
turnMgr.executeAiLordTurn('cedric');
// Verify Cedric did NOT attack Yorkshire
assert(
  gs.getState().territories.yorkshire.ownerId === 'ivanhoe',
  'AI Lord with active non-aggression pact must NOT invade player territory!'
);

// ============================================================================
// 6. Alternative Victory Condition: Royal Ransom / Crown Fund (200 Gold)
// ============================================================================
console.log('6. Testing Royal Ransom / Crown Fund (200 Gold Victory Condition)...');

gs.startNewCampaign('ivanhoe', 'SIDEQUEST_LABS');
const ransomPlayer = gs.getPlayerLord();
ransomPlayer.gold = 250;

assert(gs.getState().royalRansomPaid === 0, 'royalRansomPaid should start at 0');

// Contribute 50 Gold
const c1 = gs.contributeRoyalRansom(50);
assert(c1.success === true, `Contribution 1 failed: ${c1.message}`);
assert(gs.getState().royalRansomPaid === 50, 'royalRansomPaid should be 50');
assert(ransomPlayer.gold === 200, 'Player gold should be 200');
assert(gs.getState().victoryStatus === 'ONGOING', 'Victory should still be ONGOING');

// Contribute another 100 Gold
const c2 = gs.contributeRoyalRansom(100);
assert(c2.success === true, `Contribution 2 failed: ${c2.message}`);
assert(gs.getState().royalRansomPaid === 150, 'royalRansomPaid should be 150');
assert(gs.getState().victoryStatus === 'ONGOING', 'Victory should still be ONGOING');

// Final contribution of 50 Gold to reach 200 Gold!
const c3 = gs.contributeRoyalRansom(50);
assert(c3.success === true, `Contribution 3 failed: ${c3.message}`);
assert(gs.getState().royalRansomPaid === 200, 'royalRansomPaid should be 200');
assert(
  gs.getState().victoryStatus === 'VICTORY',
  `Expected VICTORY status when 200 Gold ransom paid, got: ${gs.getState().victoryStatus}`
);

// ============================================================================
// 7. Save / Load Persistence of Sprint 8 Sidequest Fields
// ============================================================================
console.log('7. Testing Save / Load Persistence of Sprint 8 Sidequest Fields...');

gs.startNewCampaign('frontdeboeuf', 'SIDEQUEST_LABS');
const normanSavePlayer = gs.getPlayerLord();
normanSavePlayer.gold = 85;
normanSavePlayer.campaignArmy.archers = 6;
gs.mutateState((st) => {
  st.territories.norfolk.hasMarket = true;
  st.territories.norfolk.isRoyalKeep = true;
  st.territories.norfolk.sabotagedWallDamage = 30;
  st.spiedTurnsRemaining = 2;
  st.royalRansomPaid = 125;
  st.activeLords.malvoisin.pactWithPlayerTurns = 2;
});

const serialized = gs.serializeCampaign();
assert(typeof serialized === 'string', 'Serialized output must be a string');

// Reset and restore
gs.resetToDefaults();
const loadOk = gs.deserializeCampaign(serialized);
assert(loadOk === true, 'deserializeCampaign must return true');
const loadedState = gs.getState();

assert(loadedState.edition === 'SIDEQUEST_LABS', 'Loaded edition must be SIDEQUEST_LABS');
assert(loadedState.selectedLordId === 'frontdeboeuf', 'Loaded selectedLordId must be frontdeboeuf');
assert(loadedState.playerFaction === 'norman', 'Loaded playerFaction must be norman');
assert(
  loadedState.activeLords.frontdeboeuf.campaignArmy.archers === 6,
  `Expected 6 loaded archers, got ${loadedState.activeLords.frontdeboeuf.campaignArmy.archers}`
);
assert(
  loadedState.territories.norfolk.hasMarket === true,
  'Loaded territory hasMarket must be true'
);
assert(
  loadedState.territories.norfolk.isRoyalKeep === true,
  'Loaded territory isRoyalKeep must be true'
);
assert(
  loadedState.territories.norfolk.sabotagedWallDamage === 30,
  'Loaded sabotagedWallDamage must be 30'
);
assert(
  loadedState.spiedTurnsRemaining === 2,
  'Loaded spiedTurnsRemaining must be 2'
);
assert(
  loadedState.royalRansomPaid === 125,
  'Loaded royalRansomPaid must be 125'
);
assert(
  loadedState.activeLords.malvoisin.pactWithPlayerTurns === 2,
  'Loaded malvoisin pactWithPlayerTurns must be 2'
);

console.log('★ All Sprint 8 tests passed successfully! Zero regressions on CLASSIC edition. ★');
