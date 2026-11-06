import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import {
  BattleEngine,
  TACTIC_PROFILES,
} from './src/core/BattleEngine.ts';
import { CombatResolver } from './src/core/CombatResolver.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Testing Sprint 3 Tactical Field Battle Engine, Maneuver Matrix, Retreat & Campaign Integration...');

const gs = GameState.getInstance();

// ============================================================================
// 1. Tactical Multipliers, Leadership Formula & Rock-Paper-Scissors Matrix
// ============================================================================
assert(
  TACTIC_PROFILES.FEROCIOUS_ATTACK.offenseMult === 1.35 &&
    TACTIC_PROFILES.FEROCIOUS_ATTACK.vulnerabilityMult === 1.3,
  'FEROCIOUS_ATTACK must be +35% offense and +30% vulnerability'
);
assert(
  TACTIC_PROFILES.NORMAL_ATTACK.offenseMult === 1.0 &&
    TACTIC_PROFILES.NORMAL_ATTACK.vulnerabilityMult === 1.0,
  'NORMAL_ATTACK must be 1.0x offense and 1.0x defense'
);
assert(
  TACTIC_PROFILES.CAUTIOUS_ATTACK.offenseMult === 0.75 &&
    TACTIC_PROFILES.CAUTIOUS_ATTACK.vulnerabilityMult === 0.75,
  'CAUTIOUS_ATTACK must be -25% offense and -25% casualties taken'
);
assert(
  TACTIC_PROFILES.STAND_AND_FIGHT.vulnerabilityMult === 0.65 &&
    TACTIC_PROFILES.STAND_AND_FIGHT.basePush === 0,
  'STAND_AND_FIGHT must grant +35% defense mitigation and 0 base push'
);
assert(
  TACTIC_PROFILES.OUTFLANK.requiresKnights === true,
  'OUTFLANK must require knights > 0'
);

assert(
  BattleEngine.getLeadershipMultiplier(7) === 1.35,
  'Leadership 7 must yield 1.35x multiplier'
);
assert(
  BattleEngine.getLeadershipMultiplier(9) === 1.45,
  'Leadership 9 must yield 1.45x multiplier'
);

// Verify RPS counters:
// A) STAND_AND_FIGHT counters FEROCIOUS_ATTACK
const standVsFerocious = BattleEngine.evaluateManeuverMatchup(
  'STAND_AND_FIGHT',
  'FEROCIOUS_ATTACK',
  1,
  1
);
assert(
  standVsFerocious.offenseMult > TACTIC_PROFILES.STAND_AND_FIGHT.offenseMult &&
    standVsFerocious.vulnerabilityMult < TACTIC_PROFILES.STAND_AND_FIGHT.vulnerabilityMult,
  'STAND_AND_FIGHT must gain counter-offense and extra mitigation against FEROCIOUS_ATTACK'
);

// B) OUTFLANK bypasses NORMAL_ATTACK / FEROCIOUS_ATTACK when knights > 0
const outflankVsFerocious = BattleEngine.evaluateManeuverMatchup(
  'OUTFLANK',
  'FEROCIOUS_ATTACK',
  3,
  1
);
assert(
  outflankVsFerocious.flankBypassSuccess === true &&
    outflankVsFerocious.flankCountered === false,
  'OUTFLANK with knights must bypass FEROCIOUS_ATTACK front line'
);

// C) STAND_AND_FIGHT counters OUTFLANK
const outflankVsStand = BattleEngine.evaluateManeuverMatchup(
  'OUTFLANK',
  'STAND_AND_FIGHT',
  3,
  0
);
assert(
  outflankVsStand.flankCountered === true &&
    outflankVsStand.flankBypassSuccess === false,
  'OUTFLANK must be countered by STAND_AND_FIGHT'
);

// D) Counter-flanking with superior Knights counters inferior OUTFLANK
const inferiorFlank = BattleEngine.evaluateManeuverMatchup('OUTFLANK', 'OUTFLANK', 1, 4);
const superiorFlank = BattleEngine.evaluateManeuverMatchup('OUTFLANK', 'OUTFLANK', 4, 1);
assert(
  inferiorFlank.flankCountered === true && superiorFlank.flankBypassSuccess === true,
  'Superior Knights in OUTFLANK vs OUTFLANK must counter inferior cavalry'
);

// ============================================================================
// 2. OUTFLANK Knight Requirement & Mid-Battle Fallback When Knights Hit 0
// ============================================================================
gs.startNewCampaign('ivanhoe');
// Strip Ivanhoe's 1 knight into Yorkshire garrison so campaignArmy has 0 knights
gs.transferTroops('ivanhoe', 'toGarrison', 'knights', 1);
assert(gs.getPlayerLord().campaignArmy.knights === 0, 'Ivanhoe should have 0 campaign knights');

// Have Malvoisin annex Lincoln (no castle) so Ivanhoe can attack an open shire
gs.moveCampaignArmy('ivanhoe', 'lincoln');
// Reset and let Malvoisin own Lincoln instead:
gs.startNewCampaign('ivanhoe');
gs.moveCampaignArmy('malvoisin', 'lincoln');
assert(gs.getTerritory('lincoln')!.ownerId === 'malvoisin', 'Malvoisin owns Lincoln');
// Station garrison in Lincoln
gs.mutateState((st) => {
  st.territories['lincoln'].garrison = { soldiers: 14, knights: 1, catapults: 0 };
  st.activeLords['malvoisin'].currentTerritoryId = 'norfolk';
});

// Remove Ivanhoe's knight temporarily to verify OUTFLANK rejection
gs.transferTroops('ivanhoe', 'toGarrison', 'knights', 1);
const zeroKnightSession = BattleEngine.createBattleSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'lincoln' },
  { deterministic: true }
);
const rejectedFlank = BattleEngine.setTactic(zeroKnightSession, 'attacker', 'OUTFLANK');
assert(
  rejectedFlank.success === false && zeroKnightSession.attackerTactic !== 'OUTFLANK',
  'Cannot select OUTFLANK when knights === 0'
);

// Return knight + buy 3 more knights & 1 catapult to test OUTFLANK strike & Catapult bombardment
gs.transferTroops('ivanhoe', 'toCampaign', 'knights', 1);
for (let i = 0; i < 12; i++) gs.collectTaxes();
gs.purchaseUnit('ivanhoe', 'knights', 3, 'campaign');
gs.purchaseUnit('ivanhoe', 'catapults', 1, 'campaign');

const flankSession = BattleEngine.createBattleSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'lincoln' },
  { deterministic: true }
);
// Force defender onto NORMAL_ATTACK so OUTFLANK bypasses cleanly on Tick 1
flankSession.defenderTactic = 'NORMAL_ATTACK';
const validFlank = BattleEngine.setTactic(flankSession, 'attacker', 'OUTFLANK');
assert(validFlank.success === true && flankSession.attackerTactic === 'OUTFLANK', 'OUTFLANK enabled with 4 knights');

const tick1 = BattleEngine.stepTick(flankSession);
assert(tick1.attackerFlankSuccess === true, 'Tick 1 must register successful cavalry outflank');
assert(flankSession.defenderDamagePools.knights > 0 || tick1.defenderLosses.knights > 0, 'Outflank must deal knight damage');

const tick2 = BattleEngine.stepTick(flankSession);
assert(tick2.attackerCatapultFired === true, 'Catapult must bombard enemy ranks on even tick 2');

// Simulate losing all knights mid-battle while on OUTFLANK -> must auto-revert to NORMAL_ATTACK
flankSession.attackerTactic = 'OUTFLANK';
flankSession.attackerArmy.knights = 0;
if (flankSession.status === 'ONGOING') {
  const tick3 = BattleEngine.stepTick(flankSession);
  assert(
    tick3.attackerTactic !== 'OUTFLANK',
    'Commander with 0 remaining knights must automatically fall back from OUTFLANK'
  );
}

// ============================================================================
// 3. Retreat Logic (~15% Parting Penalty, Origin Return & Territory Uncaptured)
// ============================================================================
gs.startNewCampaign('ivanhoe');
gs.moveCampaignArmy('malvoisin', 'lincoln');
gs.mutateState((st) => {
  st.activeLords['ivanhoe'].campaignArmy = { soldiers: 20, knights: 2, catapults: 1 };
  st.territories['lincoln'].garrison = { soldiers: 25, knights: 2, catapults: 0 };
});

const retreatSession = BattleEngine.createBattleSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'lincoln', originTerritoryId: 'yorkshire' },
  { deterministic: true }
);
BattleEngine.stepTick(retreatSession);
const preRetreatSoldiers = retreatSession.attackerArmy.soldiers;
assert(preRetreatSoldiers > 0 && retreatSession.status === 'ONGOING', 'Still fighting before retreat');

const retreatResult = BattleEngine.retreatFromBattle(retreatSession, 'attacker', gs);
assert(retreatResult.retreated === true, 'Result must be marked retreated');
assert(retreatResult.attackerWon === false, 'Retreating attacker must NOT win territory');
assert(
  retreatSession.retreatPenaltyLosses.soldiers === Math.round(preRetreatSoldiers * 0.15),
  'Retreat must inflict ~15% parting soldier penalty'
);
assert(gs.getTerritory('lincoln')!.ownerId === 'malvoisin', 'Lincoln remains owned by Malvoisin');
assert(gs.getPlayerLord().currentTerritoryId === 'yorkshire', 'Ivanhoe returned to starting Yorkshire');
assert(
  gs.getPlayerLord().campaignArmy.soldiers === retreatSession.attackerArmy.soldiers,
  'Surviving post-retreat army committed accurately to GameState'
);

// ============================================================================
// 4. Castle Siege Catapult Check, BattleScene Resolution & Home Castle Elimination
// ============================================================================
gs.startNewCampaign('ivanhoe');
// Cedric (Shropshire) annexes Cheshire so he has an outlying shire
gs.moveCampaignArmy('cedric', 'cheshire');
gs.moveCampaignArmy('cedric', 'shropshire');
assert(gs.getTerritory('cheshire')!.ownerId === 'cedric', 'Cedric owns Cheshire');

// Ivanhoe connects Yorkshire -> Derbyshire -> Leicester (adjacent to Shropshire)
gs.resetTurnLocks();
gs.moveCampaignArmy('ivanhoe', 'derbyshire', { interactiveBattle: true });
gs.resetTurnLocks();
gs.moveCampaignArmy('ivanhoe', 'leicester', { interactiveBattle: true });
gs.resetTurnLocks();

// Attempt interactive march on Cedric's Home Castle (Shropshire) WITHOUT a Catapult -> MUST BLOCK!
const siegeBlocked = gs.moveCampaignArmy('ivanhoe', 'shropshire', { interactiveBattle: true });
assert(
  siegeBlocked.success === false &&
    siegeBlocked.outcome === 'BLOCKED' &&
    siegeBlocked.message === CombatResolver.CASTLE_SIEGE_BLOCK_MSG,
  'Interactive attack on a Castle without a Catapult must be blocked'
);

// Equip Ivanhoe with a Catapult + strong host and march interactively on Shropshire
gs.mutateState((st) => {
  st.activeLords['ivanhoe'].campaignArmy = { soldiers: 45, knights: 8, catapults: 2 };
});

const siegePending = gs.moveCampaignArmy('ivanhoe', 'shropshire', { interactiveBattle: true });
assert(
  siegePending.success === true &&
    siegePending.outcome === 'BATTLE_PENDING' &&
    siegePending.pendingBattle?.hasCastle === true &&
    siegePending.pendingBattle?.mode === 'PLAYER_ATTACK',
  'Player attack with Catapult must emit BATTLE_PENDING for BattleScene'
);

const siegeBattle = BattleEngine.createBattleSession(
  gs.getState(),
  siegePending.pendingBattle!,
  { deterministic: true }
);
assert(siegeBattle.hasCastleDefense === true, 'Castle siege defense modifier active');
BattleEngine.setTactic(siegeBattle, 'attacker', 'OUTFLANK');
BattleEngine.resolveToCompletion(siegeBattle);

assert(siegeBattle.status === 'ATTACKER_WON', 'Ivanhoe must win the Shropshire siege');
const committedSiege = BattleEngine.commitBattleOutcome(siegeBattle, gs);

assert(committedSiege.attackerWon === true, 'Attacker won committed');
assert(committedSiege.homeCastleCaptured === true, 'Home Castle capture flagged');
assert(committedSiege.eliminatedLordId === 'cedric', 'Cedric eliminated');
assert(gs.getLord('cedric')!.isDefeated === true && gs.getLord('cedric')!.isActive === false, 'Cedric marked defeated');
assert(gs.getTerritory('shropshire')!.ownerId === 'ivanhoe', 'Shropshire owned by Ivanhoe');
assert(gs.getTerritory('cheshire')!.ownerId === null, 'Outlying Cheshire reverted to Neutral after BattleScene win!');
assert(
  gs.getPlayerLord().campaignArmy.soldiers === siegeBattle.attackerArmy.soldiers &&
    gs.getPlayerLord().campaignArmy.knights === siegeBattle.attackerArmy.knights,
  'Exact surviving BattleScene army counts written back to GameState'
);

// ============================================================================
// 5. TurnManager Interactive Pause & Resume When AI Attacks Defended Player Shire
// ============================================================================
gs.startNewCampaign('ivanhoe');
const tm = new TurnManager(gs);

// Set up a scenario where Malvoisin has no adjacent neutral territories and a huge host bordering Ivanhoe's Lincoln!
gs.mutateState((st) => {
  // Claim Norfolk's neighbors (lincoln & suffolk) so Malvoisin attacks defended Lincoln!
  for (const tid of ['lincoln', 'suffolk']) {
    if (st.territories[tid]) {
      st.territories[tid].ownerId = 'ivanhoe';
      st.territories[tid].garrison = { soldiers: 8, knights: 0, catapults: 0 };
    }
  }
  st.territories['lincoln'].hasCastle = false;

  // Give Malvoisin a massive invading army in Norfolk so Lincoln/Suffolk is his top invasion target
  st.activeLords['malvoisin'].currentTerritoryId = 'norfolk';
  st.activeLords['malvoisin'].campaignArmy = { soldiers: 40, knights: 5, catapults: 1 };
});

const preTurnMonth = gs.getState().month;
const step1 = tm.beginInteractiveTurn();
assert(
  step1.status === 'PAUSED_FOR_PLAYER_DEFENSE' &&
    step1.pendingBattle !== undefined &&
    step1.pendingBattle.mode === 'PLAYER_DEFENSE',
  `Expected TurnManager to pause for Player Defense when AI attacks defended shire, got ${step1.status}`
);
assert(
  gs.getState().month === preTurnMonth,
  'Calendar must NOT advance while paused for Player Defense BattleScene'
);

// Resolve the defensive BattleScene tactically and commit outcome
const defSession = BattleEngine.createBattleSession(gs.getState(), step1.pendingBattle!, {
  deterministic: true,
});
assert(defSession.playerSide === 'defender', 'Player must be assigned defender side');
BattleEngine.setTactic(defSession, 'defender', 'STAND_AND_FIGHT');
BattleEngine.resolveToCompletion(defSession);
BattleEngine.commitBattleOutcome(defSession, gs);

// Resume remaining AI queue (may pause again if another AI attacks, so loop cleanly until TURN_COMPLETE)
let resumeStep = tm.continueInteractiveTurn(step1.queueState!);
while (resumeStep.status === 'PAUSED_FOR_PLAYER_DEFENSE' && resumeStep.pendingBattle) {
  const nextDef = BattleEngine.createBattleSession(gs.getState(), resumeStep.pendingBattle, {
    deterministic: true,
  });
  BattleEngine.resolveToCompletion(nextDef);
  BattleEngine.commitBattleOutcome(nextDef, gs);
  resumeStep = tm.continueInteractiveTurn(resumeStep.queueState!);
}

assert(resumeStep.status === 'TURN_COMPLETE', 'AI turn queue must finish cleanly after defense');
assert(
  gs.getState().month === preTurnMonth + 1,
  `Calendar must advance to month ${preTurnMonth + 1} once AI queue completes`
);

console.log('✅ ALL SPRINT 3 TACTICAL BATTLE ENGINE, MANEUVER MATRIX, RETREAT & AI DEFENSE QUEUE TESTS PASSED!');
