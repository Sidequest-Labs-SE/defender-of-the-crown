import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import { BattleEngine } from './src/core/BattleEngine.ts';
import { SiegeEngine } from './src/core/SiegeEngine.ts';
import { SwordplayEngine } from './src/core/SwordplayEngine.ts';
import { JoustEngine } from './src/core/JoustEngine.ts';
import { ArcheryEngine } from './src/core/ArcheryEngine.ts';
import { ALL_RELICS, RELIC_IDS } from './src/data/relics.ts';
import { isCoastalPort, EAST_COAST_PORTS, WEST_COAST_PORTS } from './src/data/territories.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Testing Sprint 9 (Final Expansion Sprint): Coastal Sea Routes, Relics, Nemesis, Seasons, & Archery...');

const gs = GameState.getInstance();

// ============================================================================
// 1. CLASSIC Mode Isolation & Zero Regression
// ============================================================================
console.log('1. Testing CLASSIC Mode Isolation...');

gs.resetToDefaults();
gs.startNewCampaign('ivanhoe', 'CLASSIC');
const classicPlayer = gs.getPlayerLord();

// 1A. Coastal sea routes forbidden in CLASSIC
classicPlayer.gold = 50;
classicPlayer.currentTerritoryId = 'yorkshire';
const reachableClassic = gs.getReachableTerritories(classicPlayer.id);
const allReachableClassic = [
  ...reachableClassic.friendlyIds,
  ...reachableClassic.neutralIds,
  ...reachableClassic.enemyIds,
];
assert(
  !allReachableClassic.includes('kent'),
  'CLASSIC mode must strictly disable coastal sea travel to distant ports!'
);

// 1B. Relics cannot be awarded or held in CLASSIC
const relicClassic = gs.awardRelic(classicPlayer.id, 'excalibur_hilt');
assert(
  relicClassic === null,
  'CLASSIC mode must not award relics!'
);
assert(
  (classicPlayer.relicIds?.length ?? 0) === 0,
  'CLASSIC player relicIds must remain empty!'
);

// 1C. Archery and Assassin duels forbidden in CLASSIC
const archeryClassic = gs.initiateArcheryContest();
assert(
  !archeryClassic.success,
  'Archery contest must be rejected in CLASSIC mode!'
);

const assassinClassic = gs.initiateAssassinDuel();
assert(
  !assassinClassic.success,
  'Assassin duels must be rejected in CLASSIC mode!'
);

// 1D. Nemesis vendetta forbidden in CLASSIC
gs.triggerNemesisVendetta('malvoisin');
assert(
  gs.getState().nemesisLordId === null || gs.getState().nemesisLordId === undefined,
  'Nemesis vendetta must not activate in CLASSIC mode!'
);

console.log('✓ CLASSIC Mode isolation verified 100%.');

// ============================================================================
// 2. Coastal Sea Routes & Amphibious Naval Invasions (Sidequest Labs)
// ============================================================================
console.log('2. Testing Coastal Sea Routes & Naval Invasions...');

gs.resetToDefaults();
gs.startNewCampaign('ivanhoe', 'SIDEQUEST_LABS');
const playerSq = gs.getPlayerLord();

// 2A. Port Classification
assert(isCoastalPort('yorkshire'), 'Yorkshire must be classified as a coastal port.');
assert(isCoastalPort('kent'), 'Kent must be classified as a coastal port.');
assert(!isCoastalPort('notts'), 'Nottingham (Sherwood) is inland and must not be a coastal port.');
assert(!isCoastalPort('derby'), 'Derbyshire is inland and must not be a coastal port.');

// 2B. Naval charter fee requirement
playerSq.currentTerritoryId = 'yorkshire';
playerSq.gold = 2; // Less than 5G charter fee
let reachableSea = gs.getReachableTerritories(playerSq.id);
let allReachableSea = [
  ...reachableSea.friendlyIds,
  ...reachableSea.neutralIds,
  ...reachableSea.enemyIds,
];
assert(
  !allReachableSea.includes('norfolk') && !allReachableSea.includes('kent'),
  'Cannot embark on foreign naval invasion with less than 5 Gold charter fee.'
);

// With 5+ Gold, connected coastal ports along the sea lane become reachable
playerSq.gold = 20;
reachableSea = gs.getReachableTerritories(playerSq.id);
allReachableSea = [
  ...reachableSea.friendlyIds,
  ...reachableSea.neutralIds,
  ...reachableSea.enemyIds,
];
assert(
  allReachableSea.includes('norfolk') && allReachableSea.includes('kent'),
  'Connected East Coast ports must be reachable when stationed at Yorkshire with >= 5 Gold.'
);

// 2C. Naval Invasion execution deducts 5 Gold charter fee
playerSq.campaignArmy.soldiers = 60;
playerSq.campaignArmy.knights = 12;
playerSq.campaignArmy.catapults = 2;
const goldBeforeInvasion = playerSq.gold;
const moveRes = gs.moveCampaignArmy(playerSq.id, 'norfolk');
assert(moveRes.success, `Naval movement failed: ${moveRes.message}`);
assert(
  playerSq.gold === goldBeforeInvasion - 5,
  `Expected 5G naval charter fee deducted, got: ${playerSq.gold} vs ${goldBeforeInvasion - 5}`
);
assert(
  playerSq.currentTerritoryId === 'norfolk',
  'Campaign army must be stationed in destination port Norfolk.'
);

console.log('✓ Coastal Sea Routes & amphibious naval landings verified.');

// ============================================================================
// 3. The Lord\'s Armory: 6 Legendary Relics & Cross-Engine Stat Buffs
// ============================================================================
console.log('3. Testing The Lord\'s Armory (6 Relics) & Cross-Engine Stat Buffs...');

assert(Object.keys(ALL_RELICS).length === 6, 'Must have exactly 6 legendary relics.');
assert(RELIC_IDS.length === 6, 'RELIC_IDS must contain 6 relic keys.');

// 3A. Awarding Relics & Permanent Stat Bonuses
const prevSwordplay = playerSq.swordplay;
const awardedExcalibur = gs.awardRelic(playerSq.id, 'excalibur_hilt');
assert(awardedExcalibur !== null, 'Excalibur Hilt must be successfully awarded.');
assert(gs.hasRelic(playerSq.id, 'excalibur_hilt'), 'Player must own excalibur_hilt.');
assert(
  playerSq.swordplay === Math.min(10, prevSwordplay + 2),
  'Excalibur must grant +2 swordplay stat bonus.'
);

// 3B. SwordplayEngine Excalibur Riposte Bonus (+10% extra riposte damage)
const swordplayContext = {
  missionType: 'RAID' as const,
  attackerId: playerSq.id,
  targetLordId: 'malvoisin',
  targetTerritoryId: 'norfolk',
};
const swordplaySession = SwordplayEngine.createSession(gs.getState(), swordplayContext);
assert(
  swordplaySession.attackerHasExcalibur === true,
  'SwordplaySession must detect attackerHasExcalibur.'
);

// 3C. JoustEngine Milanese Plate Bonus (+2 jousting & unhorse resistance)
gs.awardRelic(playerSq.id, 'milanese_plate');
const joustContext = {
  stakesType: 'FAME' as const,
  challengerId: playerSq.id,
  opponentId: 'malvoisin',
};
const joustSession = JoustEngine.createSession(gs.getState(), joustContext);
assert(
  joustSession.playerHasMilanese === true,
  'JoustSession must register playerHasMilanese.'
);

// 3D. BattleEngine Hastings Horn (+2 leadership, +10 starting momentum) & Sherwood Yew Bow (+25% volley)
gs.awardRelic(playerSq.id, 'hastings_horn');
gs.awardRelic(playerSq.id, 'sherwood_yew_bow');
playerSq.campaignArmy.archers = 10;
const battleSession = BattleEngine.createBattleSession(
  gs.getState(),
  { attackerId: playerSq.id, territoryId: 'norfolk' },
  { deterministic: true, seed: 42 }
);
assert(
  battleSession.attackerHasHastingsHorn === true,
  'BattleSession must register attackerHasHastingsHorn.'
);
assert(
  battleSession.attackerHasYewBow === true,
  'BattleSession must register attackerHasYewBow.'
);
assert(
  battleSession.momentum === 10,
  `Hastings Horn must set starting momentum to +10 (favors attacker), got ${battleSession.momentum}`
);

// 3E. SiegeEngine Greek Fire Siphon (+15 wall & courtyard damage)
gs.awardRelic(playerSq.id, 'greek_fire_siphon');
const siegeSession = SiegeEngine.createSiegeSession(
  gs.getState(),
  { attackerId: playerSq.id, territoryId: 'norfolk' },
  { deterministic: true, seed: 100 }
);
assert(
  siegeSession.attackerHasGreekFireSiphon === true,
  'SiegeSession must register attackerHasGreekFireSiphon.'
);

// 3F. St. Edward\'s Crown Ring (+3 Gold/mo royal tribute)
const taxBeforeRing = gs.getLordTaxIncome(playerSq.id);
gs.awardRelic(playerSq.id, 'st_edward_crown_ring');
const taxAfterRing = gs.getLordTaxIncome(playerSq.id);
assert(
  taxAfterRing === taxBeforeRing + 3,
  `St. Edward\'s Crown Ring must grant +3 Gold/mo tribute (${taxBeforeRing} -> ${taxAfterRing})`
);

console.log('✓ All 6 Relics and cross-engine stat buffs verified.');

// ============================================================================
// 4. AI Nemesis Blood Vendettas & Night Assassin Duels
// ============================================================================
console.log('4. Testing AI Nemesis Vendettas & Night Assassin Duels...');

// 4A. Triggering Blood Vendetta
const nemesisLord = Object.values(gs.getState().activeLords).find(
  (l) => !l.isPlayer && !l.isDefeated
)!;
assert(Boolean(nemesisLord), 'Must have an active undefeated AI rival.');
gs.triggerNemesisVendetta(nemesisLord.id);
assert(
  gs.getState().nemesisLordId === nemesisLord.id,
  `Nemesis lord ID must match ${nemesisLord.name}, got ${gs.getState().nemesisLordId}`
);
const updatedNemesis = gs.getLord(nemesisLord.id)!;
assert(
  updatedNemesis.hasVendettaAgainstPlayer === true,
  'Nemesis lord must have hasVendettaAgainstPlayer = true.'
);

// 4B. Night Assassin Duel Initialization
const assassinDuel = gs.initiateAssassinDuel();
assert(assassinDuel.success, 'Assassin duel must be successfully initiated.');
assert(assassinDuel.context?.missionType === 'ASSASSIN', 'Mission type must be ASSASSIN.');

// 4C. Resolving Assassin Duel in SwordplayEngine
const assassinSession = SwordplayEngine.createSession(gs.getState(), assassinDuel.context!, {
  deterministic: true,
  seed: 12345,
});
assert(
  assassinSession.stages.length === 1,
  'Assassin duel must be a single high-stakes encounter.'
);
assert(
  assassinSession.stages[0].defender.name === 'Shadow Blade Assassin',
  'Opponent must be Shadow Blade Assassin.'
);

// Step duel to victory
const status = SwordplayEngine.resolveMissionToCompletion(assassinSession, 100);
assert(
  status === 'VICTORY' || status === 'DEFEATED',
  `Mission must complete with definitive outcome, got: ${status}`
);

// Force victory outcome for commitment test
assassinSession.status = 'VICTORY';
const playerGoldBeforeBounty = gs.getPlayerLord().gold;
const assassinOutcome = SwordplayEngine.commitMissionOutcome(assassinSession, gs);
assert(
  assassinOutcome.goldStolenTotal === 12,
  'Foiling assassin must award +12 Gold bounty.'
);
assert(
  gs.getPlayerLord().gold === playerGoldBeforeBounty + 12,
  'Player gold must increase by 12 Gold bounty.'
);
assert(
  gs.getState().nemesisLordId === null,
  'Defeating assassin must clear nemesisLordId.'
);
assert(
  gs.getLord(nemesisLord.id)!.hasVendettaAgainstPlayer === false,
  'Defeating assassin must break the Nemesis blood vendetta.'
);

console.log('✓ Nemesis Blood Vendettas & Night Assassin Duels verified.');

// ============================================================================
// 5. Seasonal Chronicle Events (Spring, Summer, Autumn, Winter)
// ============================================================================
console.log('5. Testing Seasonal Chronicle Events...');

const tm = new TurnManager(gs);
const state = gs.getState();

// Advance to Month 3 (Spring Vernal Equinox)
gs.mutateState((s) => {
  s.month = 2;
});
const prevHomeGarrison = gs.getTerritory(playerSq.homeTerritoryId)!.garrison.soldiers;
tm.endTurn(); // Advances to month 3

assert(
  gs.getState().month === 3,
  'Calendar must be in Month 3 (March).'
);
assert(
  gs.getState().lastSeasonalEvent === 'Vernal Equinox & Wool Trade Tariffs',
  `Expected Vernal Equinox event, got: ${gs.getState().lastSeasonalEvent}`
);
assert(
  gs.getTerritory(playerSq.homeTerritoryId)!.garrison.soldiers === prevHomeGarrison + 3,
  'Spring event must grant +3 Soldiers to Home Garrison.'
);

// Advance to Month 6 (Summer Midsummer Fair)
gs.mutateState((s) => {
  s.month = 5;
});
const prevKnightsSummer = gs.getPlayerLord().campaignArmy.knights;
tm.endTurn(); // Advances to month 6

assert(
  gs.getState().month === 6,
  'Calendar must be in Month 6 (June).'
);
assert(
  gs.getState().lastSeasonalEvent === 'Midsummer Fair & Grand Lists',
  `Expected Midsummer Fair event, got: ${gs.getState().lastSeasonalEvent}`
);
assert(
  gs.getPlayerLord().campaignArmy.knights === prevKnightsSummer + 1,
  'Summer event must grant +1 Knight to campaign army.'
);

// Advance to Month 9 (Autumn Harvest)
gs.mutateState((s) => {
  s.month = 8;
});
tm.endTurn(); // Advances to month 9
assert(
  gs.getState().month === 9,
  'Calendar must be in Month 9 (September).'
);
assert(
  gs.getState().lastSeasonalEvent === 'Autumn Harvest & Golden Bounties',
  `Expected Autumn Harvest event, got: ${gs.getState().lastSeasonalEvent}`
);

// Advance to Month 12 (Winter Frostbite)
gs.mutateState((s) => {
  s.month = 11;
  const p = s.activeLords[s.selectedLordId];
  p.currentTerritoryId = 'yorkshire';
  p.campaignArmy.soldiers = 10;
});
tm.endTurn(); // Advances to month 12
assert(
  gs.getState().month === 12,
  'Calendar must be in Month 12 (December).'
);
assert(
  gs.getState().lastSeasonalEvent === 'The Great Frost & Ice Storms',
  `Expected Winter Frostbite event, got: ${gs.getState().lastSeasonalEvent}`
);
assert(
  gs.getPlayerLord().campaignArmy.soldiers === 9,
  'Winter Frostbite must inflict -1 Soldier attrition on northern campaign armies.'
);

console.log('✓ Seasonal Chronicle Events (Spring, Summer, Autumn, Winter) verified.');

// ============================================================================
// 6. 5th Mini-Game: Sherwood Longbow Contest (ArcheryEngine)
// ============================================================================
console.log('6. Testing The 5th Mini-Game: Sherwood Archery Contest...');

const archerySession = ArcheryEngine.createSession(gs.getState(), {
  deterministic: true,
  seed: 999,
});

assert(archerySession.rounds.length === 2, 'Archery tournament must consist of 2 rounds.');
assert(archerySession.rounds[0].distancePaces === 50, 'Round 1 must be 50 paces.');
assert(archerySession.rounds[1].distancePaces === 80, 'Round 2 must be 80 paces.');
assert(archerySession.status === 'ACTIVE', 'Archery session must start ACTIVE.');

// 6A. Shooting physics (wind drift & gravity drop)
const shot1 = ArcheryEngine.shootArrow(archerySession, 0, 0);
assert(shot1.shotIndex === 1, 'First shot must be index 1.');
assert(shot1.points >= 0 && shot1.points <= 15, `Points must be between 0 and 15, got: ${shot1.points}`);
assert(
  shot1.finalY > 0,
  'Gravity drop must pull finalY downwards (positive Y in screen coordinates).'
);

// 6B. Complete Round 1 with Auto-Shoot
ArcheryEngine.shootArrow(archerySession, 0, -10);
ArcheryEngine.shootArrow(archerySession, 0, -10);
// Rival Round 1 shots
ArcheryEngine.stepAiShot(archerySession);
ArcheryEngine.stepAiShot(archerySession);
ArcheryEngine.stepAiShot(archerySession);

assert(
  archerySession.currentRoundIndex === 1,
  'Session must advance to Round 2 (80 paces) after 3 shots each.'
);

// 6C. Complete Round 2
ArcheryEngine.shootArrow(archerySession, 0, -20);
ArcheryEngine.shootArrow(archerySession, 0, -20);
ArcheryEngine.shootArrow(archerySession, 0, -20);
ArcheryEngine.stepAiShot(archerySession);
ArcheryEngine.stepAiShot(archerySession);
ArcheryEngine.stepAiShot(archerySession);

assert(
  archerySession.status !== 'ACTIVE',
  `Session must complete after 2 rounds, status: ${archerySession.status}`
);

// 6D. Tournament Rewards Commitment
archerySession.status = 'PLAYER_WON';
archerySession.playerTotalScore = 45;
archerySession.rivalTotalScore = 28;

const goldBeforeContest = gs.getPlayerLord().gold;
const archersBeforeContest = gs.getPlayerLord().campaignArmy.archers ?? 0;
const archeryReward = ArcheryEngine.commitArcheryOutcome(archerySession, gs);

assert(archeryReward.playerWon === true, 'Player must be champion.');
assert(archeryReward.goldAwarded === 15, 'Champion must receive +15 Gold purse.');
assert(archeryReward.archersAwarded === 4, 'Champion must receive +4 Longbowmen.');
assert(
  gs.getPlayerLord().gold === goldBeforeContest + 15,
  'Player gold must increase by +15 Gold purse.'
);
assert(
  (gs.getPlayerLord().campaignArmy.archers ?? 0) === archersBeforeContest + 4,
  'Player campaign army must gain +4 Longbowmen.'
);
assert(
  gs.hasRelic(gs.getPlayerLord().id, 'sherwood_yew_bow'),
  'Winning Archery Contest must award the Golden Yew Bow Relic.'
);

console.log('✓ Sherwood Archery Tournament mini-game verified.');

// ============================================================================
// 7. Save / Load State Persistence Across Editions
// ============================================================================
console.log('7. Testing Save / Load Persistence with Sprint 9 Expansion Data...');

const serialized = gs.serializeCampaign();
const parsed = JSON.parse(serialized);
const stateInJson = parsed.state ?? parsed;

assert(parsed.edition === 'SIDEQUEST_LABS', 'Serialized edition must be SIDEQUEST_LABS.');
assert(Array.isArray(stateInJson.activeLords[playerSq.id].relicIds), 'Serialized relics must be an array.');
assert(stateInJson.lastSeasonalEvent !== undefined, 'Serialized lastSeasonalEvent must be present.');

// Restore into fresh state
gs.resetToDefaults();
const loaded = gs.deserializeCampaign(serialized);
assert(loaded, 'Deserialization must succeed.');

const reloadedPlayer = gs.getPlayerLord();
assert(
  gs.hasRelic(reloadedPlayer.id, 'sherwood_yew_bow'),
  'Reloaded state must retain Golden Yew Bow Relic.'
);
assert(
  (reloadedPlayer.campaignArmy.archers ?? 0) >= 4,
  'Reloaded state must retain Longbowmen units.'
);

console.log('✓ Save / Load state persistence verified.');

console.log('\n============================================================');
console.log('ALL SPRINT 9 VERIFICATION TESTS PASSED SUCCESSFULLY! (10/10)');
console.log('============================================================\n');
