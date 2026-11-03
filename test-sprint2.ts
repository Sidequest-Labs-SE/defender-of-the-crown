import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import { CombatResolver } from './src/core/CombatResolver.ts';
import { ROBIN_HOOD_MERRY_MEN_COUNT, UNIT_COSTS } from './src/core/types.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Testing Sprint 2 Strategy Map Logic, Economy, CombatResolver & TurnManager...');

const gs = GameState.getInstance();
const tm = new TurnManager(gs);

// ============================================================================
// 1. Strict 1986 Prices & Unit / Castle Purchasing
// ============================================================================
gs.startNewCampaign('ivanhoe');
assert(UNIT_COSTS.soldiers === 1, 'Soldier must cost 1 Gold');
assert(UNIT_COSTS.knights === 8, 'Knight must cost 8 Gold');
assert(UNIT_COSTS.catapults === 15, 'Catapult must cost 15 Gold');
assert(UNIT_COSTS.castle === 20, 'Castle must cost 20 Gold');

// Ivanhoe starts with 10G, 10 Soldiers, 1 Knight, 0 Catapults
let buyKnight = gs.purchaseUnit('ivanhoe', 'knights', 1, 'campaign');
assert(buyKnight.success === true, 'Should afford 1 Knight (8G) from 10G');
assert(gs.getPlayerLord().gold === 2, 'Gold must drop from 10G to 2G');
assert(gs.getPlayerLord().campaignArmy.knights === 2, 'Campaign knights must be 2');

let buyCatapultFail = gs.purchaseUnit('ivanhoe', 'catapults', 1, 'campaign');
assert(buyCatapultFail.success === false, 'Cannot buy 15G Catapult with 2G');

let buySoldiers = gs.purchaseUnit('ivanhoe', 'soldiers', 2, 'campaign');
assert(buySoldiers.success === true, 'Should afford 2 Soldiers (2G)');
assert(gs.getPlayerLord().gold === 0, 'Gold must be 0G');
assert(gs.getPlayerLord().campaignArmy.soldiers === 12, 'Campaign soldiers must be 12');

// ============================================================================
// 2. Garrison <-> Campaign Army Transfers
// ============================================================================
// Ivanhoe is in Yorkshire (owned, 10 soldiers in garrison)
let toArmy = gs.transferTroops('ivanhoe', 'toCampaign', 'soldiers', 6);
assert(toArmy.success === true, 'Should transfer 6 garrison soldiers to campaign army');
assert(gs.getTerritory('yorkshire')!.garrison.soldiers === 4, 'Yorkshire garrison should have 4 soldiers');
assert(gs.getPlayerLord().campaignArmy.soldiers === 18, 'Campaign army should have 18 soldiers');

let toGar = gs.transferTroops('ivanhoe', 'toGarrison', 'knights', 1);
assert(toGar.success === true, 'Should transfer 1 knight to Yorkshire garrison');
assert(gs.getTerritory('yorkshire')!.garrison.knights === 1, 'Yorkshire garrison should have 1 knight');
assert(gs.getPlayerLord().campaignArmy.knights === 1, 'Campaign army should have 1 knight');

let invalidTransfer = gs.transferTroops('ivanhoe', 'toCampaign', 'catapults', 1);
assert(invalidTransfer.success === false, 'Cannot transfer catapult that garrison does not have');

// ============================================================================
// 3. Adjacency Validation, Neutral Annexation, Connected Friendly Path & Castle Building
// ============================================================================
let invalidFarMove = gs.moveCampaignArmy('ivanhoe', 'kent');
assert(invalidFarMove.success === false && invalidFarMove.outcome === 'BLOCKED', 'Cannot jump from Yorkshire to Kent');

// Annex adjacent Neutral Derbyshire (+2G/mo)
let annexDerby = gs.moveCampaignArmy('ivanhoe', 'derbyshire');
assert(annexDerby.success === true && annexDerby.outcome === 'ANNEXED', 'Should annex adjacent Derbyshire');
assert(gs.getTerritory('derbyshire')!.ownerId === 'ivanhoe', 'Derbyshire must now belong to Ivanhoe');
assert(gs.getPlayerLord().currentTerritoryId === 'derbyshire', 'Ivanhoe army now stationed in Derbyshire');

// Second conquest in same month should be blocked, while friendly relocation back to Yorkshire is allowed!
let secondConquestSameTurn = gs.moveCampaignArmy('ivanhoe', 'leicester');
assert(secondConquestSameTurn.success === false, 'Only 1 conquest/attack allowed per monthly turn');

let friendlyRelocate = gs.moveCampaignArmy('ivanhoe', 'yorkshire');
assert(friendlyRelocate.success === true && friendlyRelocate.outcome === 'RELOCATED', 'Friendly relocation must succeed');
assert(gs.getPlayerLord().currentTerritoryId === 'yorkshire', 'Army relocated back to Yorkshire');

// Verify Sherwood Forest (notts) cannot be annexed (borders Derbyshire which is connected friendly to Yorkshire!)
gs.resetTurnLocks();
let sherwoodMove = gs.moveCampaignArmy('ivanhoe', 'notts');
assert(sherwoodMove.success === false && sherwoodMove.outcome === 'SHERWOOD', 'Sherwood Forest cannot be annexed');
assert(gs.getTerritory('notts')!.ownerId === null, 'Nottingham remains unowned sanctuary');

// Step through connected friendly Derbyshire directly from Yorkshire into neutral Leicestershire!
let stepThroughMove = gs.moveCampaignArmy('ivanhoe', 'leicester');
assert(stepThroughMove.success === true && stepThroughMove.outcome === 'ANNEXED', 'Should step through connected friendly Derbyshire into Leicestershire');
assert(gs.getTerritory('leicester')!.ownerId === 'ivanhoe', 'Leicestershire owned by Ivanhoe');

// Empty army movement check
gs.resetTurnLocks();
const armySoldiersCount = gs.getPlayerLord().campaignArmy.soldiers;
const armyKnightsCount = gs.getPlayerLord().campaignArmy.knights;
gs.transferTroops('ivanhoe', 'toGarrison', 'soldiers', armySoldiersCount);
gs.transferTroops('ivanhoe', 'toGarrison', 'knights', armyKnightsCount);
let emptyArmyMove = gs.moveCampaignArmy('ivanhoe', 'gloucester');
assert(emptyArmyMove.success === false, 'Army with 0 soldiers and 0 knights cannot move');
// Restore army
gs.transferTroops('ivanhoe', 'toCampaign', 'soldiers', armySoldiersCount);
gs.transferTroops('ivanhoe', 'toCampaign', 'knights', armyKnightsCount);

// Tax Collection & Castle Building (20G)
// Ivanhoe owns Yorkshire (4) + Derbyshire (2) + Leicestershire (3) = 9G/mo
assert(gs.getLordTaxIncome('ivanhoe') === 9, `Expected 9G/mo tax income, got ${gs.getLordTaxIncome('ivanhoe')}`);
gs.collectTaxes();
gs.collectTaxes();
gs.collectTaxes(); // 3 * 9 = 27G
assert(gs.getPlayerLord().gold === 27, `Expected 27G after 3 tax cycles, got ${gs.getPlayerLord().gold}`);

let buildOnExistingCastle = gs.buildCastle('ivanhoe', 'yorkshire');
assert(buildOnExistingCastle.success === false, 'Cannot build castle where hasCastle === true');

let buildCastleDerby = gs.buildCastle('ivanhoe', 'derbyshire');
assert(buildCastleDerby.success === true, 'Should build castle in owned Derbyshire for 20G');
assert(gs.getTerritory('derbyshire')!.hasCastle === true, 'Derbyshire now has a castle');
assert(gs.getPlayerLord().gold === 7, '27G - 20G = 7G remaining');

// ============================================================================
// 4. Robin Hood Consultation Rules (1/turn, max 3/campaign)
// ============================================================================
const soldiersBeforeRobin = gs.getPlayerLord().campaignArmy.soldiers;
let rh1 = gs.consultRobinHood();
assert(rh1.success === true, 'First Robin Hood call should succeed');
assert(gs.getPlayerLord().campaignArmy.soldiers === soldiersBeforeRobin + ROBIN_HOOD_MERRY_MEN_COUNT, 'Merry Men added');
assert(gs.getState().robinHoodUsesLeft === 2, '2 Robin Hood uses left');

let rhSameTurn = gs.consultRobinHood();
assert(rhSameTurn.success === false, 'Cannot consult Robin Hood twice in the same turn');

gs.resetTurnLocks();
assert(gs.consultRobinHood().success === true, 'Second Robin Hood call after turn reset');
gs.resetTurnLocks();
assert(gs.consultRobinHood().success === true, 'Third Robin Hood call after turn reset');
gs.resetTurnLocks();
assert(gs.consultRobinHood().success === false, 'Fourth Robin Hood call must be rejected (max 3)');

// ============================================================================
// 5. Castle Siege Catapult Rule, Combat Math & Home Castle Elimination
// ============================================================================
gs.startNewCampaign('ivanhoe');
// Verify Combat Strength Formula: ((Soldiers * 1) + (Knights * 6)) * (1 + leadership * 0.05) * (castle ? 1.25 : 1)
// Ivanhoe (leadership 7 -> 1.35x) with 10S + 1K (=16): 16 * 1.35 = 21.6
const pwrCheck = CombatResolver.calculateCombatStrength({ soldiers: 10, knights: 1 }, 7, false);
assert(pwrCheck === 21.6, `Expected strength 21.6, got ${pwrCheck}`);
const castlePwrCheck = CombatResolver.calculateCombatStrength({ soldiers: 10, knights: 0 }, 4, true);
// leadership 4 -> 1.2x; 10 * 1.2 * 1.25 = 15
assert(castlePwrCheck === 15, `Expected castle strength 15, got ${castlePwrCheck}`);

// Geoffrey is active in Northumberland (adjacent to Yorkshire, hasCastle === true)
// Give Geoffrey an extra outlying territory (Cumberland if neutral, or Lancashire) to verify revert-to-neutral on defeat!
// Let Geoffrey annex Lancashire first:
gs.moveCampaignArmy('geoffrey', 'yorkshire'); // blocked (no catapult)
// Move Geoffrey to Northumberland -> he neighbors Cumberland and Yorkshire. Let's have Cedric (Shropshire) annex Cheshire, then we test eliminating Geoffrey or Cedric!
const cedricAnnex = gs.moveCampaignArmy('cedric', 'cheshire');
assert(cedricAnnex.success === true, 'Cedric annexes Cheshire');
assert(gs.getTerritory('cheshire')!.ownerId === 'cedric', 'Cheshire owned by Cedric');
// Move Cedric's field army back to Shropshire so both garrison + field army defend Shropshire
gs.moveCampaignArmy('cedric', 'shropshire');

// Connect Ivanhoe to Shropshire via Derbyshire -> Leicestershire (adjacent to Shropshire)
gs.resetTurnLocks();
gs.moveCampaignArmy('ivanhoe', 'derbyshire');
gs.resetTurnLocks();
gs.moveCampaignArmy('ivanhoe', 'leicester');
gs.resetTurnLocks();

// Try besieging Shropshire (Cedric's Home Castle) WITHOUT a Catapult -> MUST BLOCK!
const blockedSiege = gs.moveCampaignArmy('ivanhoe', 'shropshire');
assert(blockedSiege.success === false, 'Castle siege without catapult must be blocked');
assert(
  blockedSiege.message === 'You need at least 1 Catapult in your Campaign Army to besiege a fortified Castle!',
  `Unexpected siege block message: ${blockedSiege.message}`
);

// Fund Ivanhoe via tax cycles, buy 1 Catapult (15G) + overwhelming Knights & Soldiers, then storm Shropshire!
for (let i = 0; i < 8; i++) {
  gs.collectTaxes(); // 9G * 8 = 72G + 10G = 82G
}
assert(gs.purchaseUnit('ivanhoe', 'catapults', 1, 'campaign').success === true, 'Bought Catapult');
assert(gs.purchaseUnit('ivanhoe', 'knights', 5, 'campaign').success === true, 'Bought 5 Knights (40G)');
assert(gs.purchaseUnit('ivanhoe', 'soldiers', 20, 'campaign').success === true, 'Bought 20 Soldiers (20G)');

const siegeWin = gs.moveCampaignArmy('ivanhoe', 'shropshire');
assert(siegeWin.success === true && siegeWin.outcome === 'BATTLE_WON', 'Ivanhoe should storm Shropshire');
assert(siegeWin.battle?.homeCastleCaptured === true, 'Must flag homeCastleCaptured');
assert(siegeWin.battle?.eliminatedLordId === 'cedric', 'Cedric must be eliminated');

// Verify Cedric is permanently defeated & Cheshire reverted to Neutral!
const defeatedCedric = gs.getLord('cedric')!;
assert(defeatedCedric.isActive === false && defeatedCedric.isDefeated === true, 'Cedric marked inactive & defeated');
assert(
  defeatedCedric.campaignArmy.soldiers === 0 && defeatedCedric.campaignArmy.knights === 0,
  'Cedric field army disbanded'
);
assert(gs.getTerritory('shropshire')!.ownerId === 'ivanhoe', 'Shropshire now owned by Ivanhoe');
assert(gs.getTerritory('cheshire')!.ownerId === null, 'Outlying Cheshire reverted to Neutral!');

// ============================================================================
// 6. Full Campaign Victory Check (Defeating remaining 4 enemy Home Castles)
// ============================================================================
// Remaining active rivals: geoffrey (northumberland), malvoisin (norfolk), frontdeboeuf (essex), boisguilbert (kent)
for (let i = 0; i < 15; i++) gs.collectTaxes();
gs.purchaseUnit('ivanhoe', 'knights', 12, 'campaign');
gs.purchaseUnit('ivanhoe', 'soldiers', 40, 'campaign');

// Capture Northumberland (adjacent to Yorkshire, which is connected friendly through Derbyshire-Leicester-Shropshire!)
gs.resetTurnLocks();
assert(gs.moveCampaignArmy('ivanhoe', 'northumberland').outcome === 'BATTLE_WON', 'Captured Northumberland');
assert(gs.getLord('geoffrey')!.isDefeated === true, 'Geoffrey defeated');

// Annex Lincoln (connected to Yorkshire) -> Capture Norfolk (Malvoisin)
gs.resetTurnLocks();
assert(gs.moveCampaignArmy('ivanhoe', 'lincoln').outcome === 'ANNEXED', 'Annexed Lincoln');
gs.resetTurnLocks();
assert(gs.moveCampaignArmy('ivanhoe', 'norfolk').outcome === 'BATTLE_WON', 'Captured Norfolk');
assert(gs.getLord('malvoisin')!.isDefeated === true, 'Malvoisin defeated');

// Capture Essex (borders Leicestershire!) -> Front-de-Boeuf defeated
gs.resetTurnLocks();
assert(gs.moveCampaignArmy('ivanhoe', 'essex').outcome === 'BATTLE_WON', 'Captured Essex');
assert(gs.getLord('frontdeboeuf')!.isDefeated === true, 'Front-de-Boeuf defeated');
assert(gs.getState().victoryStatus === 'ONGOING', 'Still 1 rival remaining (Bois-Guilbert)');

// Capture Kent (borders Essex!) -> Bois-Guilbert defeated -> CAMPAIGN VICTORY!
gs.resetTurnLocks();
const finalBattle = gs.moveCampaignArmy('ivanhoe', 'kent');
assert(finalBattle.outcome === 'BATTLE_WON', 'Captured Kent');
assert(finalBattle.battle?.campaignVictoryTriggered === true, 'Campaign Victory must trigger!');
assert(gs.getState().victoryStatus === 'VICTORY', 'CampaignState victoryStatus must be VICTORY');
assert(gs.getState().winnerLordId === 'ivanhoe', 'Ivanhoe must be recorded as winner');

// ============================================================================
// 7. TurnManager AI Execution & 12-Month Calendar Rollover (1149 -> 1150)
// ============================================================================
gs.startNewCampaign('wolfric'); // Wolfric starts in Cumberland
const initialNeutralCount = Object.values(gs.getState().territories).filter((t) => t.ownerId === null).length;
assert(initialNeutralCount === 12, 'Starts with 12 neutral territories (including Sherwood)');

// Summon Robin Hood on the first 3 turns and garrison Cumberland with taxes across 12 months (Jan 1149 -> Jan 1150)
for (let t = 0; t < 12; t++) {
  if (t < 3) {
    gs.consultRobinHood();
  }
  const availGold = gs.getPlayerLord().gold;
  if (availGold > 0) {
    gs.purchaseUnit('wolfric', 'soldiers', availGold, 'garrison', 'cumberland');
  }
  tm.endTurn();
}

const afterYearState = gs.getState();
assert(afterYearState.year === 1150, `Expected year 1150 after 12 turns, got ${afterYearState.year}`);
assert(afterYearState.month === 1, `Expected month 1 (JAN) after 12 turns, got ${afterYearState.month}`);
assert(afterYearState.turn === 13, `Expected turn 13 after 12 turns, got ${afterYearState.turn}`);

// AI Lords must have expanded across England, recruited Catapults (when >= 25G), and collected taxes
const postAiNeutralCount = Object.values(afterYearState.territories).filter((t) => t.ownerId === null).length;
assert(postAiNeutralCount < initialNeutralCount, 'AI Lords must annex territories during turns');
assert(afterYearState.territories['notts'].ownerId === null, 'Sherwood Forest must never be annexed by AI');
const anyAiHasCatapult = Object.values(afterYearState.activeLords).some(
  (l) => !l.isPlayer && l.campaignArmy.catapults >= 1
);
assert(anyAiHasCatapult === true, 'AI Lords with >= 25G must purchase Catapults for Castle Sieges');
assert(gs.getRecentLog(8).length === 8, 'Chronicle log must maintain recent monthly events');

console.log('✅ ALL SPRINT 2 ECONOMY, MOVEMENT, SIEGE, COMBAT & AI TURN TESTS PASSED!');
