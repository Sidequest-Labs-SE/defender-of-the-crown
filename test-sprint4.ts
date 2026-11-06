import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import { SiegeEngine } from './src/core/SiegeEngine.ts';
import { BattleEngine } from './src/core/BattleEngine.ts';
import { CombatResolver } from './src/core/CombatResolver.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log(
  'Testing Sprint 4 Catapult Siege Engine, Ballistic Zones, Wind Compensation, Ammo Effects, Breach Modifiers & Full Campaign Integration...'
);

const gs = GameState.getInstance();

// ============================================================================
// 1. Catapult Volley Count Formula & Catapult Prerequisite Check
// ============================================================================
assert(SiegeEngine.calculateMaxVolleys(0) === 0, '0 catapults -> 0 volleys');
assert(SiegeEngine.calculateMaxVolleys(1) === 5, '1 catapult -> 5 base volleys');
assert(SiegeEngine.calculateMaxVolleys(2) === 7, '2 catapults -> 7 volleys');
assert(SiegeEngine.calculateMaxVolleys(3) === 9, '3 catapults -> 9 volleys');
assert(SiegeEngine.calculateMaxVolleys(5) === 9, '4+ catapults capped at 9 volleys');

gs.startNewCampaign('ivanhoe');
// Attempt to create a SiegeSession on Northumberland without a catapult -> must throw
let threwNoCatapult = false;
try {
  SiegeEngine.createSiegeSession(gs.getState(), {
    attackerId: 'ivanhoe',
    territoryId: 'northumberland',
  });
} catch (err) {
  threwNoCatapult =
    err instanceof Error && err.message === CombatResolver.CASTLE_SIEGE_BLOCK_MSG;
}
assert(
  threwNoCatapult === true,
  'Creating a SiegeSession without a Catapult must throw CASTLE_SIEGE_BLOCK_MSG'
);

// ============================================================================
// 2. Ballistic Hit Zones & Wind Compensation Math (-10..+10)
// ============================================================================
assert(
  SiegeEngine.classifyImpactZone(0) === 'SHORT_MISS' &&
    SiegeEngine.classifyImpactZone(41) === 'SHORT_MISS',
  'Effective distance < 42 must be SHORT_MISS'
);
assert(
  SiegeEngine.classifyImpactZone(42) === 'WALL_HIT' &&
    SiegeEngine.classifyImpactZone(55) === 'WALL_HIT' &&
    SiegeEngine.classifyImpactZone(68) === 'WALL_HIT',
  'Effective distance 42..68 must be WALL_HIT'
);
assert(
  SiegeEngine.classifyImpactZone(69) === 'OVER_WALL_COURTYARD' &&
    SiegeEngine.classifyImpactZone(78) === 'OVER_WALL_COURTYARD' &&
    SiegeEngine.classifyImpactZone(86) === 'OVER_WALL_COURTYARD',
  'Effective distance 69..86 must be OVER_WALL_COURTYARD'
);
assert(
  SiegeEngine.classifyImpactZone(87) === 'LONG_MISS' &&
    SiegeEngine.classifyImpactZone(105) === 'LONG_MISS',
  'Effective distance > 86 must be LONG_MISS'
);

// Strong Headwind (-10): uncompensated neutral wall shot (55) falls SHORT_MISS, compensated shot hits WALL_HIT!
const uncompHeadwindDist = SiegeEngine.computeEffectiveDistance(55, -10, 0);
assert(
  SiegeEngine.classifyImpactZone(uncompHeadwindDist) === 'SHORT_MISS',
  `Uncompensated Power 55 in -10 Headwind must fall SHORT_MISS (got dist=${uncompHeadwindDist})`
);
const compHeadwindWin = SiegeEngine.getPowerWindowForZone('WALL_HIT', -10);
const compHeadwindDist = SiegeEngine.computeEffectiveDistance(
  compHeadwindWin.idealPower,
  -10,
  0
);
assert(
  SiegeEngine.classifyImpactZone(compHeadwindDist) === 'WALL_HIT',
  `Wind-compensated idealPower (${compHeadwindWin.idealPower}) in -10 Headwind must hit WALL_HIT`
);

// Strong Tailwind (+10): uncompensated neutral courtyard shot (78) overshoots LONG_MISS, compensated shot hits OVER_WALL_COURTYARD!
const uncompTailwindDist = SiegeEngine.computeEffectiveDistance(78, 10, 0);
assert(
  SiegeEngine.classifyImpactZone(uncompTailwindDist) === 'LONG_MISS',
  `Uncompensated Power 78 in +10 Tailwind must overshoot LONG_MISS (got dist=${uncompTailwindDist})`
);
const compTailwindWin = SiegeEngine.getPowerWindowForZone('OVER_WALL_COURTYARD', 10);
const compTailwindDist = SiegeEngine.computeEffectiveDistance(
  compTailwindWin.idealPower,
  10,
  0
);
assert(
  SiegeEngine.classifyImpactZone(compTailwindDist) === 'OVER_WALL_COURTYARD',
  `Wind-compensated idealPower (${compTailwindWin.idealPower}) in +10 Tailwind must hit OVER_WALL_COURTYARD`
);

// ============================================================================
// 3. BOULDER Structural Wall Damage & Wall Breach (wallIntegrity === 0)
// ============================================================================
gs.startNewCampaign('ivanhoe');
gs.mutateState((st) => {
  st.activeLords['ivanhoe'].campaignArmy = { soldiers: 30, knights: 4, catapults: 2 };
  st.territories['northumberland'].garrison = { soldiers: 20, knights: 2, catapults: 0 };
  // Move Geoffrey's field army away so we measure pure castle garrison first
  st.activeLords['geoffrey'].currentTerritoryId = 'cumberland';
});

const boulderSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'northumberland' },
  { deterministic: true, initialWind: 0 }
);
assert(boulderSiege.maxVolleys === 7, '2 Catapults must grant 7 volleys');
assert(boulderSiege.wallIntegrity === 100, 'Castle wall starts at 100% integrity');

// Shot 1: BOULDER direct WALL_HIT (Power 55, Wind 0 -> Dist 55)
const bShot1 = SiegeEngine.fireVolley(boulderSiege, 55, 'BOULDER');
assert(bShot1.impactZone === 'WALL_HIT', 'Shot 1 must be WALL_HIT');
assert(
  bShot1.wallDamage >= 30 && bShot1.wallDamage <= 45,
  `Boulder WALL_HIT must deal 30..45 wall damage, got ${bShot1.wallDamage}`
);
assert(
  bShot1.immediateDefenderLosses.soldiers >= 1 &&
    bShot1.immediateDefenderLosses.soldiers <= 2,
  'Boulder WALL_HIT must deal 1..2 collateral soldier casualties'
);
assert(boulderSiege.wallIntegrity === 100 - bShot1.wallDamage, 'Wall integrity reduced');

// Shot 2: BOULDER OVER_WALL_COURTYARD (compensate for current wind)
const bKeepPower = SiegeEngine.getPowerWindowForZone(
  'OVER_WALL_COURTYARD',
  boulderSiege.wind
).idealPower;
const bShot2 = SiegeEngine.fireVolley(boulderSiege, bKeepPower, 'BOULDER');
assert(bShot2.impactZone === 'OVER_WALL_COURTYARD', 'Shot 2 must hit OVER_WALL_COURTYARD');
assert(
  bShot2.wallDamage >= 5 && bShot2.wallDamage <= 10,
  `Boulder courtyard hit must deal 5..10 wall damage, got ${bShot2.wallDamage}`
);
assert(
  bShot2.immediateDefenderLosses.soldiers >= 1 &&
    bShot2.immediateDefenderLosses.soldiers <= 3,
  'Boulder courtyard hit must crush 1..3 soldiers'
);

// Shot 3 & Shot 4: Finish breaching the wall to 0!
while (!boulderSiege.wallBreached && boulderSiege.shotsRemaining > 0) {
  const wallPow = SiegeEngine.getPowerWindowForZone('WALL_HIT', boulderSiege.wind).idealPower;
  SiegeEngine.fireVolley(boulderSiege, wallPow, 'BOULDER');
}
assert(
  boulderSiege.wallIntegrity === 0 && boulderSiege.wallBreached === true,
  'Repeated Boulder wall hits must breach wallIntegrity to 0'
);
assert(
  boulderSiege.shotsRemaining > 0 && boulderSiege.status === 'ACTIVE',
  'Attacker may still fire remaining volleys after breaching the wall if desired'
);

// ============================================================================
// 4. GREEK_FIRE Courtyard Conflagration (15%–25% Garrison Burned) vs Wall Scorch
// ============================================================================
const fireSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'northumberland' },
  { deterministic: true, initialWind: 0 }
);
// Garrison has 20 Soldiers + 2 Knights = 22 defending troops
const fireWallShot = SiegeEngine.fireVolley(fireSiege, 55, 'GREEK_FIRE');
assert(fireWallShot.impactZone === 'WALL_HIT', 'Greek Fire at 55 hits wall');
assert(
  fireWallShot.wallDamage === 5 &&
    fireWallShot.immediateDefenderLosses.soldiers === 1 &&
    fireSiege.isOnFire === false,
  'Greek Fire hitting stone outer wall only scorches stone (5 wall dmg, 1 soldier casualty)'
);

// Now arc Greek Fire OVER_WALL_COURTYARD into remaining 21 troops
const preFireTroops =
  fireSiege.defenderGarrison.soldiers + fireSiege.defenderGarrison.knights;
const fireKeepPow = SiegeEngine.getPowerWindowForZone(
  'OVER_WALL_COURTYARD',
  fireSiege.wind
).idealPower;
const fireKeepShot = SiegeEngine.fireVolley(fireSiege, fireKeepPow, 'GREEK_FIRE');
const burnedTroops =
  fireKeepShot.immediateDefenderLosses.soldiers +
  fireKeepShot.immediateDefenderLosses.knights;
assert(fireKeepShot.impactZone === 'OVER_WALL_COURTYARD', 'Greek Fire arcs over wall');
assert(fireSiege.isOnFire === true, 'Castle barracks ignited (isOnFire === true)');
assert(
  burnedTroops >= Math.max(2, Math.floor(preFireTroops * 0.15)) &&
    burnedTroops <= Math.max(5, Math.ceil(preFireTroops * 0.25)),
  `Greek Fire courtyard hit must burn 15%..25% (min 2..5) of garrison, burned ${burnedTroops} of ${preFireTroops}`
);

// ============================================================================
// 5. DISEASE Immediate Casualties (10%–15%), Ongoing Attrition & Morale Penalty
// ============================================================================
const diseaseSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  { attackerId: 'ivanhoe', territoryId: 'northumberland' },
  { deterministic: true, initialWind: 0 }
);
// Shot 1: Arc DISEASE over wall into 22 defending troops
const disKeepPow = SiegeEngine.getPowerWindowForZone(
  'OVER_WALL_COURTYARD',
  diseaseSiege.wind
).idealPower;
const disShot1 = SiegeEngine.fireVolley(diseaseSiege, disKeepPow, 'DISEASE');
const immediatePlagueDead =
  disShot1.immediateDefenderLosses.soldiers +
  disShot1.immediateDefenderLosses.knights;
assert(disShot1.impactZone === 'OVER_WALL_COURTYARD', 'Disease lands in courtyard');
assert(
  diseaseSiege.isPlagueInfected === true && disShot1.infectedOnShot === true,
  'Fortress must become plague-infected'
);
assert(
  immediatePlagueDead >= 2 && immediatePlagueDead <= 4,
  `Disease must immediately kill 10%..15% of 22 troops, got ${immediatePlagueDead}`
);
assert(
  disShot1.plagueAttritionLosses.soldiers === 0,
  'Ongoing attrition triggers on subsequent shots, not double-counted on initial infection shot'
);

// Shot 2: Even on a SHORT_MISS (Power 10), ongoing plague attrition must kill 1..3 soldiers!
const soldiersBeforeShot2 = diseaseSiege.defenderGarrison.soldiers;
const disShot2 = SiegeEngine.fireVolley(diseaseSiege, 10, 'BOULDER');
assert(disShot2.impactZone === 'SHORT_MISS', 'Shot 2 intentionally falls short');
assert(
  disShot2.plagueAttritionLosses.soldiers >= 1 &&
    disShot2.plagueAttritionLosses.soldiers <= 3 &&
    diseaseSiege.defenderGarrison.soldiers ===
      soldiersBeforeShot2 - disShot2.plagueAttritionLosses.soldiers,
  'Ongoing plague attrition must kill 1..3 defending soldiers after every subsequent shot!'
);

// ============================================================================
// 6. Dynamic Castle Armor Scaling, Breach Bonus & Plague Modifiers in BattleEngine
// ============================================================================
// A) Intact Wall (100% integrity, no plague) -> 1.25x Castle Armor, 0 Momentum
const intactCtx = SiegeEngine.buildPostSiegeBattleContext(
  SiegeEngine.createSiegeSession(
    gs.getState(),
    { attackerId: 'ivanhoe', territoryId: 'northumberland' },
    { deterministic: true }
  )
);
const intactBattle = BattleEngine.createBattleSession(gs.getState(), intactCtx, {
  deterministic: true,
});
assert(
  intactBattle.castleDefenseMult === 1.25 && intactBattle.hasCastleDefense === true,
  '100% wallIntegrity must grant 1.25x (+25%) castle defense bonus'
);
assert(intactBattle.momentum === 0, 'Intact non-plague battle starts at 0 momentum');

// B) Half-Damaged Wall (50% integrity) -> 1.125x (+12.5%) Castle Armor
const halfDamagedCtx = {
  ...intactCtx,
  siege: {
    ...intactCtx.siege!,
    wallIntegrity: 50,
    wallBreached: false,
  },
};
const halfBattle = BattleEngine.createBattleSession(gs.getState(), halfDamagedCtx, {
  deterministic: true,
});
assert(
  halfBattle.castleDefenseMult === 1.125 && halfBattle.hasCastleDefense === true,
  `50% wallIntegrity must scale castle bonus to 1.125x, got ${halfBattle.castleDefenseMult}`
);

// C) Breached Wall (wallIntegrity === 0) -> 1.0x (0% Castle Armor) + +20 Attacker Momentum!
const breachedCtx = SiegeEngine.buildPostSiegeBattleContext(boulderSiege);
const breachedBattle = BattleEngine.createBattleSession(gs.getState(), breachedCtx, {
  deterministic: true,
});
assert(
  breachedBattle.wallBreached === true &&
    breachedBattle.castleDefenseMult === 1.0 &&
    breachedBattle.hasCastleDefense === false,
  `Breached castle (wallIntegrity === 0) must remove castle armor bonus (1.0x), got ${breachedBattle.castleDefenseMult}`
);
assert(
  breachedBattle.momentum === 20,
  `Breached castle must grant Attacker +20 starting Momentum, got ${breachedBattle.momentum}`
);

// Verify actual melee tick damage reflects removal of the 1.25x defender castle armor!
intactBattle.defenderArmy = { soldiers: 20, knights: 2, catapults: 0 };
intactBattle.attackerTactic = 'NORMAL_ATTACK';
intactBattle.defenderTactic = 'STAND_AND_FIGHT';
intactBattle.momentum = 0;

breachedBattle.defenderArmy = { soldiers: 20, knights: 2, catapults: 0 };
breachedBattle.attackerTactic = 'NORMAL_ATTACK';
breachedBattle.defenderTactic = 'STAND_AND_FIGHT';
breachedBattle.momentum = 0; // isolate pure armor difference on tick 1

const intactTick1 = BattleEngine.stepTick(intactBattle);
const breachedTick1 = BattleEngine.stepTick(breachedBattle);
assert(
  breachedTick1.attackerDamageDealt > intactTick1.attackerDamageDealt * 1.2 &&
    breachedTick1.defenderDamageDealt < intactTick1.defenderDamageDealt,
  `Breached wall must increase attacker melee damage (${breachedTick1.attackerDamageDealt} vs ${intactTick1.attackerDamageDealt}) and remove defender rampart damage boost`
);

// D) Plague Handoff into BattleEngine -> -2 Defender Leadership & -15 Defender Momentum (+15 session.momentum)
const plagueCtx = SiegeEngine.buildPostSiegeBattleContext(diseaseSiege);
const plagueBattle = BattleEngine.createBattleSession(gs.getState(), plagueCtx, {
  deterministic: true,
});
assert(
  plagueBattle.isPlagueInfected === true &&
    plagueBattle.defenderLeadership === Math.max(0, plagueBattle.baseDefenderLeadership - 2),
  `Plague must penalize Defender Leadership by -2 (base ${plagueBattle.baseDefenderLeadership} -> ${plagueBattle.defenderLeadership})`
);
assert(
  plagueBattle.momentum === 15,
  `Plague must apply -15 Defender starting momentum (+15 session.momentum), got ${plagueBattle.momentum}`
);
assert(
  plagueBattle.defenderArmy.soldiers === diseaseSiege.defenderGarrison.soldiers &&
    plagueBattle.defenderArmy.knights === diseaseSiege.defenderGarrison.knights,
  'Post-siege reduced garrison counts must flow directly into BattleSession'
);

// ============================================================================
// 7. Defender Counter-Battery Fire & Abandon Siege (Retreat)
// ============================================================================
const retreatSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  {
    attackerId: 'ivanhoe',
    territoryId: 'northumberland',
    originTerritoryId: 'yorkshire',
  },
  { deterministic: true, initialWind: 0 }
);
// Fire 1 Greek Fire into courtyard, then test Counter-Fire & Abandon Siege
SiegeEngine.fireVolley(retreatSiege, 78, 'GREEK_FIRE');
const defSoldiersAfterFire = retreatSiege.defenderGarrison.soldiers;
assert(defSoldiersAfterFire < 20, 'Greek Fire reduced defender garrison before retreat');

const counterLoss = SiegeEngine.applyCounterFireToAttacker(retreatSiege);
assert(
  counterLoss.soldiers >= 1 && retreatSiege.attackerArmy.soldiers === 30 - counterLoss.soldiers,
  'Counter-battery fire must inflict attacker soldier losses'
);

const preAbandonAttSoldiers = retreatSiege.attackerArmy.soldiers;
const abandonResult = SiegeEngine.abandonSiege(retreatSiege, gs);
assert(
  abandonResult.retreated === true && abandonResult.attackerWon === false,
  'Abandoned siege must return retreated=true and attackerWon=false'
);
assert(
  retreatSiege.retreatPenaltyLosses.soldiers ===
    Math.round(preAbandonAttSoldiers * 0.15),
  'Abandoning siege must apply standard 15% retreat penalty'
);
assert(
  gs.getPlayerLord().currentTerritoryId === 'yorkshire',
  'Retreating besieger must return to originTerritoryId (Yorkshire)'
);
assert(
  gs.getTerritory('northumberland')!.ownerId === 'geoffrey',
  'Northumberland must remain owned by Geoffrey after abandoned siege'
);
assert(
  gs.getTerritory('northumberland')!.garrison.soldiers === defSoldiersAfterFire,
  'Defender siege casualties suffered prior to retreat must persist in GameState'
);

// ============================================================================
// 8. Full End-to-End Integration: Map Move -> SiegeEngine -> BattleEngine -> GameState
//    + AI Turn Castle Defense Queue Preservation
// ============================================================================
gs.startNewCampaign('ivanhoe');
// Have Cedric annex Cheshire so we verify outlying territory neutralization after Siege -> Battle!
gs.moveCampaignArmy('cedric', 'cheshire');
gs.moveCampaignArmy('cedric', 'shropshire');
assert(gs.getTerritory('cheshire')!.ownerId === 'cedric', 'Cedric owns Cheshire');

// Connect Ivanhoe: Yorkshire -> Derbyshire -> Leicester (borders Shropshire)
gs.resetTurnLocks();
gs.moveCampaignArmy('ivanhoe', 'derbyshire', { interactiveBattle: true });
gs.resetTurnLocks();
gs.moveCampaignArmy('ivanhoe', 'leicester', { interactiveBattle: true });
gs.resetTurnLocks();

gs.mutateState((st) => {
  st.activeLords['ivanhoe'].campaignArmy = { soldiers: 36, knights: 5, catapults: 2 };
  st.territories['shropshire'].garrison = { soldiers: 24, knights: 2, catapults: 0 };
});

// Step A: Initiate interactive invasion on fortified Shropshire -> phase === 'SIEGE'
const movePending = gs.moveCampaignArmy('ivanhoe', 'shropshire', {
  interactiveBattle: true,
});
assert(
  movePending.success === true &&
    movePending.outcome === 'BATTLE_PENDING' &&
    movePending.pendingBattle?.hasCastle === true &&
    gs.getState().phase === 'SIEGE',
  'Attacking enemy Castle interactively must transition GameState phase to SIEGE'
);

// Step B: Execute Catapult Siege (Infect with Disease, Burn with Greek Fire, Breach with Boulders!)
const fullSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  movePending.pendingBattle!,
  { deterministic: true, initialWind: -4 }
);

const pDis = SiegeEngine.getPowerWindowForZone('OVER_WALL_COURTYARD', fullSiege.wind).idealPower;
SiegeEngine.fireVolley(fullSiege, pDis, 'DISEASE');

const pFire = SiegeEngine.getPowerWindowForZone('OVER_WALL_COURTYARD', fullSiege.wind).idealPower;
SiegeEngine.fireVolley(fullSiege, pFire, 'GREEK_FIRE');

while (!fullSiege.wallBreached && fullSiege.shotsRemaining > 0) {
  const pWall = SiegeEngine.getPowerWindowForZone('WALL_HIT', fullSiege.wind).idealPower;
  SiegeEngine.fireVolley(fullSiege, pWall, 'BOULDER');
}
assert(fullSiege.wallBreached === true, 'Shropshire walls breached before assault');

// Step C: Handoff to BattleEngine & Resolve Assault
const assaultContext = SiegeEngine.buildPostSiegeBattleContext(fullSiege);
const assaultBattle = BattleEngine.createBattleSession(gs.getState(), assaultContext, {
  deterministic: true,
});
assert(
  assaultBattle.wallBreached === true &&
    assaultBattle.castleDefenseMult === 1.0 &&
    assaultBattle.isPlagueInfected === true &&
    assaultBattle.momentum === 35,
  `Expected breached + plagued assault to start at +35 momentum (20 breach + 15 plague), got ${assaultBattle.momentum}`
);

BattleEngine.setTactic(assaultBattle, 'attacker', 'OUTFLANK');
BattleEngine.resolveToCompletion(assaultBattle);
assert(assaultBattle.status === 'ATTACKER_WON', 'Ivanhoe must carry the breached castle assault');

// Step D: Commit Outcome to GameState
const finalResult = BattleEngine.commitBattleOutcome(assaultBattle, gs);
assert(finalResult.attackerWon === true, 'Attacker victory committed');
assert(finalResult.homeCastleCaptured === true, 'Home Castle capture flagged');
assert(finalResult.eliminatedLordId === 'cedric', 'Cedric eliminated');
assert(gs.getTerritory('shropshire')!.ownerId === 'ivanhoe', 'Ivanhoe now owns Shropshire');
assert(gs.getTerritory('cheshire')!.ownerId === null, 'Outlying Cheshire turned Neutral');
assert(
  gs.getPlayerLord().campaignArmy.soldiers === assaultBattle.attackerArmy.soldiers,
  'Surviving attacker soldiers written accurately to GameState'
);

// Step E: Verify AI Lord besieging Player-owned Castle during END TURN preserves AI queue!
gs.startNewCampaign('ivanhoe');
const tm = new TurnManager(gs);
gs.mutateState((st) => {
  // Surround Norman Lord Malvoisin (Norfolk) with Ivanhoe-owned Lincoln (Fortified Castle) & Suffolk!
  for (const tid of ['lincoln', 'suffolk']) {
    st.territories[tid].ownerId = 'ivanhoe';
    st.territories[tid].garrison = { soldiers: 14, knights: 1, catapults: 0 };
  }
  st.territories['lincoln'].hasCastle = true;
  st.territories['suffolk'].hasCastle = true;

  st.activeLords['malvoisin'].currentTerritoryId = 'norfolk';
  st.activeLords['malvoisin'].campaignArmy = { soldiers: 55, knights: 8, catapults: 2 };
});

const preDefMonth = gs.getState().month;
const aiTurnStep = tm.beginInteractiveTurn();
assert(
  aiTurnStep.status === 'PAUSED_FOR_PLAYER_DEFENSE' &&
    aiTurnStep.pendingBattle?.hasCastle === true &&
    aiTurnStep.pendingBattle?.mode === 'PLAYER_DEFENSE',
  'AI besieging Player Castle must pause TurnManager with hasCastle=true & mode=PLAYER_DEFENSE'
);

// Simulate AI Catapult Siege against Player's Castle -> BattleEngine -> Resume AI Queue
const aiDefSiege = SiegeEngine.createSiegeSession(
  gs.getState(),
  aiTurnStep.pendingBattle!,
  { deterministic: true }
);
const aiVolleys = SiegeEngine.resolveRemainingAiVolleys(aiDefSiege);
assert(aiVolleys.length === aiDefSiege.maxVolleys, 'AI fires all siege volleys');

const defBattleCtx = SiegeEngine.buildPostSiegeBattleContext(aiDefSiege);
const defBattle = BattleEngine.createBattleSession(gs.getState(), defBattleCtx, {
  deterministic: true,
});
BattleEngine.setTactic(defBattle, 'defender', 'STAND_AND_FIGHT');
BattleEngine.resolveToCompletion(defBattle);
BattleEngine.commitBattleOutcome(defBattle, gs);

let resumeRes = tm.continueInteractiveTurn(aiTurnStep.queueState!);
while (resumeRes.status === 'PAUSED_FOR_PLAYER_DEFENSE' && resumeRes.pendingBattle) {
  const subBattle = BattleEngine.createBattleSession(gs.getState(), resumeRes.pendingBattle, {
    deterministic: true,
  });
  BattleEngine.resolveToCompletion(subBattle);
  BattleEngine.commitBattleOutcome(subBattle, gs);
  resumeRes = tm.continueInteractiveTurn(resumeRes.queueState!);
}

assert(resumeRes.status === 'TURN_COMPLETE', 'AI Turn Queue must complete cleanly after Castle Defense');
if (gs.getState().victoryStatus === 'ONGOING') {
  assert(
    gs.getState().month === preDefMonth + 1,
    'Calendar must advance by 1 month after resumed AI turn completes'
  );
}

console.log(
  '✅ ALL SPRINT 4 CATAPULT SIEGE ENGINE, BALLISTICS, WIND, AMMO EFFECTS, BREACH & INTEGRATION TESTS PASSED!'
);
