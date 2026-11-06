import { GameState } from './src/core/GameState.ts';
import { TurnManager } from './src/core/TurnManager.ts';
import { SwordplayEngine } from './src/core/SwordplayEngine.ts';
import { CombatResolver } from './src/core/CombatResolver.ts';
import { SAXON_DAMSELS, SAXON_DAMSEL_IDS } from './src/data/damsels.ts';

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log(
  'Testing Sprint 5 Swashbuckling Swordplay Engine, Stances, Parry/Riposte, 3-Room Progression, Night Castle Raids, Robin Hood Bailout & Damsel Rescues...'
);

const gs = GameState.getInstance();

// ============================================================================
// 1. Swordplay Stat Scaling Formulas (1..10) & Geoffrey vs Cedric Benchmark
// ============================================================================
assert(
  SwordplayEngine.getDamageMultiplier(1) === 1.07 &&
    SwordplayEngine.getDamageMultiplier(4) === 1.28 &&
    SwordplayEngine.getDamageMultiplier(6) === 1.42 &&
    SwordplayEngine.getDamageMultiplier(9) === 1.63 &&
    SwordplayEngine.getDamageMultiplier(10) === 1.7,
  'Swordplay damage/pushback formula must strictly equal (1 + swordplay * 0.07)'
);

assert(
  SwordplayEngine.getStaminaCost(16, 9) < SwordplayEngine.getStaminaCost(16, 3),
  'Higher swordplay must reduce stamina cost per swing'
);

assert(
  SwordplayEngine.getStrikeAccuracy(9) > SwordplayEngine.getStrikeAccuracy(4) &&
    SwordplayEngine.getEffectiveSpeed('ATTACK_MID', 9) >
      SwordplayEngine.getEffectiveSpeed('ATTACK_MID', 4),
  'Higher swordplay must increase blade accuracy and attack speed'
);

assert(
  SwordplayEngine.getParryEffectiveness(9, false, false) >
    SwordplayEngine.getParryEffectiveness(3, false, false) &&
    SwordplayEngine.getParryEffectiveness(4, true, true) === 1.0,
  'Higher swordplay must widen off-line parry effectiveness while matching-stance parry is 100%'
);

// Compare Geoffrey (swordplay 9) vs Cedric (swordplay 4) across 20 deterministic seeds against Malvoisin (swordplay 8)
let geoffreyWins = 0;
let cedricWins = 0;
for (let trial = 1; trial <= 20; trial++) {
  gs.startNewCampaign('geoffrey');
  const gSess = SwordplayEngine.createSession(
    gs.getState(),
    {
      missionType: 'RAID',
      attackerId: 'geoffrey',
      targetLordId: 'malvoisin',
      targetTerritoryId: 'norfolk',
    },
    { deterministic: true, seed: 1000 + trial * 37 }
  );
  if (SwordplayEngine.resolveMissionToCompletion(gSess) === 'VICTORY') {
    geoffreyWins += 1;
  }

  gs.startNewCampaign('cedric');
  const cSess = SwordplayEngine.createSession(
    gs.getState(),
    {
      missionType: 'RAID',
      attackerId: 'cedric',
      targetLordId: 'malvoisin',
      targetTerritoryId: 'norfolk',
    },
    { deterministic: true, seed: 1000 + trial * 37 }
  );
  if (SwordplayEngine.resolveMissionToCompletion(cSess) === 'VICTORY') {
    cedricWins += 1;
  }
}
assert(
  geoffreyWins > cedricWins,
  `Geoffrey (Swordplay 9) must win more castle raids than Cedric (Swordplay 4): got ${geoffreyWins} vs ${cedricWins}`
);

// ============================================================================
// 2. Stance Matchups, Enemy Telegraph (350-550ms), Parry & 1.6x Riposte, Step Back
// ============================================================================
gs.startNewCampaign('geoffrey');
const duel = SwordplayEngine.createSession(
  gs.getState(),
  {
    missionType: 'RAID',
    attackerId: 'geoffrey',
    targetLordId: 'frontdeboeuf',
    targetTerritoryId: 'essex',
  },
  { deterministic: true, seed: 42 }
);

// A) Enemy Telegraph Window (350ms - 550ms) -> Player PARRY -> Arms 1.6x RIPOSTE!
duel.player.stamina = 60;
const telegraph = SwordplayEngine.beginEnemyTelegraph(duel, 'HIGH');
assert(
  telegraph.zone === 'HIGH' &&
    telegraph.action === 'ATTACK_HIGH' &&
    telegraph.durationMs >= 350 &&
    telegraph.durationMs <= 550,
  `Telegraph duration must be within 350ms..550ms, got ${telegraph.durationMs}ms`
);

duel.player.stance = 'HIGH';
const parryRep = SwordplayEngine.executeExchange(duel, 'PARRY', {
  inTelegraphWindow: true,
});
assert(
  parryRep.outcome === 'PLAYER_PARRY_SUCCESS' &&
    parryRep.enemyDamageDealt === 0 &&
    parryRep.riposteArmed === true &&
    duel.player.riposteReady === true &&
    duel.player.stamina > 60 &&
    parryRep.positionDelta > 0,
  'Parrying a telegraphed strike must deal 0 self-damage, restore stamina, push back enemy, and arm RIPOSTE'
);

// B) Unleash 1.6x RIPOSTE on next strike and verify 1.6x damage vs normal hit!
const normalRef = SwordplayEngine.createSession(
  gs.getState(),
  {
    missionType: 'RAID',
    attackerId: 'geoffrey',
    targetLordId: 'frontdeboeuf',
    targetTerritoryId: 'essex',
  },
  { deterministic: true, seed: 99 }
);
const normalHit = SwordplayEngine.executeExchange(normalRef, 'ATTACK_MID', {
  forcedEnemyAction: 'ATTACK_HIGH',
});
assert(normalHit.playerDamageDealt > 0, 'Mid Thrust should beat slower High Slash');

const riposteHit = SwordplayEngine.executeExchange(duel, 'ATTACK_MID', {
  forcedEnemyAction: 'PARRY', // Even if enemy tries to parry, Riposte pierces through!
});
assert(
  riposteHit.outcome === 'PLAYER_RIPOSTE_HIT' &&
    riposteHit.riposteTriggered === true &&
    duel.player.riposteReady === false &&
    riposteHit.playerDamageDealt >= Math.round(normalHit.playerDamageDealt * 1.55),
  `Riposte must pierce enemy guard for ~1.6x counter-damage (${riposteHit.playerDamageDealt} vs normal ${normalHit.playerDamageDealt})`
);

// C) ATTACK_LOW ducks under ATTACK_HIGH (Guard Break + heavy pushback)
const lowCounterSess = SwordplayEngine.createSession(
  gs.getState(),
  {
    missionType: 'RAID',
    attackerId: 'ivanhoe',
    targetLordId: 'malvoisin',
    targetTerritoryId: 'norfolk',
  },
  { deterministic: true, seed: 777 }
);
const lowVsHigh = SwordplayEngine.executeExchange(lowCounterSess, 'ATTACK_LOW', {
  forcedEnemyAction: 'ATTACK_HIGH',
});
assert(
  lowVsHigh.guardBroken === true &&
    lowVsHigh.playerDamageDealt > 0 &&
    lowVsHigh.positionDelta >= 25,
  `ATTACK_LOW must duck under ATTACK_HIGH with heavy footing pushback, got delta=${lowVsHigh.positionDelta}`
);

// D) STEP_BACK rapidly regenerates Stamina/Poise
lowCounterSess.player.stamina = 22;
const stamBefore = lowCounterSess.player.stamina;
const stepRep = SwordplayEngine.executeExchange(lowCounterSess, 'STEP_BACK', {
  forcedEnemyAction: 'ATTACK_HIGH',
});
assert(
  stepRep.outcome === 'PLAYER_RECOVERED' &&
    lowCounterSess.player.stamina >= stamBefore + 34,
  'STEP_BACK must rapidly regenerate +34+ Stamina'
);

// ============================================================================
// 3. 3-Stage Castle Progression & Dual Win Conditions (HP === 0 & Position >= 100)
// ============================================================================
gs.startNewCampaign('geoffrey');
const progSess = SwordplayEngine.createSession(
  gs.getState(),
  {
    missionType: 'RAID',
    attackerId: 'geoffrey',
    targetLordId: 'boisguilbert',
    targetTerritoryId: 'kent',
  },
  { deterministic: true, seed: 2025 }
);

assert(
  progSess.stages.length === 3 &&
    progSess.stages[0].roomCode === 'COURTYARD' &&
    progSess.stages[1].roomCode === 'GREAT_HALL' &&
    progSess.stages[2].roomCode === 'VAULT' &&
    progSess.stages[2].defender.id === 'boisguilbert' &&
    progSess.stages[2].defender.swordplay === 7,
  '3-stage castle progression must culminate in the Rival Lord scaled by their swordplay stat'
);

// Stage 1: Clear by Sword-Point Yield (position >= 100 while enemy.health > 0)!
progSess.position = 88;
progSess.enemy.health = 70;
const yieldClear = SwordplayEngine.executeExchange(progSess, 'ATTACK_LOW', {
  forcedEnemyAction: 'STEP_BACK',
});
assert(
  yieldClear.stageCleared === true &&
    yieldClear.stageClearReason === 'FORCED_YIELD' &&
    progSess.position === 100 &&
    progSess.enemy.health > 0 &&
    progSess.stagesCleared === 1,
  'Driving opponent to position >= 100 must win the stage by sword-point surrender!'
);

// Advance to Stage 2 (Great Hall)
progSess.player.health = 60;
progSess.player.stamina = 35;
const movedTo2 = SwordplayEngine.advanceToNextStage(progSess);
assert(
  movedTo2 === true &&
    progSess.stageNumber === 2 &&
    progSess.position === 0 &&
    progSess.player.health > 60 &&
    progSess.player.stamina > 35,
  'Advancing to Stage 2 must reset position to 0 and grant breather vigor/stamina recovery'
);

// Stage 2: Clear by Health Depletion (enemy.health === 0)!
progSess.enemy.health = 12;
progSess.player.riposteReady = true;
const hpClear = SwordplayEngine.executeExchange(progSess, 'ATTACK_HIGH', {
  forcedEnemyAction: 'PARRY',
});
assert(
  hpClear.stageCleared === true &&
    hpClear.stageClearReason === 'HEALTH_DEPLETED' &&
    progSess.enemy.health === 0 &&
    progSess.stagesCleared === 2,
  'Reducing opponent health to 0 must clear Stage 2'
);

// Advance to Stage 3 (Treasure Vault vs Brian de Bois-Guilbert) & Clear for Mission VICTORY!
const movedTo3 = SwordplayEngine.advanceToNextStage(progSess);
assert(
  movedTo3 === true &&
    progSess.stageNumber === 3 &&
    progSess.enemy.id === 'boisguilbert',
  'Stage 3 opponent must be Brian de Bois-Guilbert'
);

progSess.enemy.health = 15;
progSess.player.riposteReady = true;
const vaultClear = SwordplayEngine.executeExchange(progSess, 'ATTACK_HIGH', {
  forcedEnemyAction: 'ATTACK_MID',
});
assert(
  vaultClear.stageCleared === true &&
    progSess.status === 'VICTORY' &&
    progSess.stagesCleared === 3,
  'Clearing Stage 3 must complete the mission with status === VICTORY'
);

// ============================================================================
// 4. Night Castle Raid: 60% Treasury Theft (Min 8G), 50% Ransom, Robin Hood Bailout & Flee
// ============================================================================
gs.startNewCampaign('ivanhoe');
gs.mutateState((st) => {
  st.activeLords['malvoisin'].gold = 50; // 60% of 50G = 30G
  st.activeLords['ivanhoe'].gold = 10;
});

const raidInit = gs.initiateCastleRaid('malvoisin');
assert(
  raidInit.success === true &&
    raidInit.context?.missionType === 'RAID' &&
    gs.getState().phase === 'RAID',
  'initiateCastleRaid must transition phase to RAID and return context'
);

const richRaid = SwordplayEngine.createSession(gs.getState(), raidInit.context!, {
  deterministic: true,
});
richRaid.status = 'VICTORY';
richRaid.stagesCleared = 3;
const richSummary = SwordplayEngine.commitMissionOutcome(richRaid, gs);

assert(
  richSummary.goldStolenTotal === 30 &&
    richSummary.goldTakenFromLord === 30 &&
    gs.getPlayerLord().gold === 40 &&
    gs.getLord('malvoisin')!.gold === 20,
  `Raid victory on 50G lord must steal 30G (60%): player=${gs.getPlayerLord().gold}G, malvoisin=${gs.getLord('malvoisin')!.gold}G`
);
assert(
  gs.getState().hasRaidedThisTurn === true &&
    gs.initiateCastleRaid('frontdeboeuf').success === false,
  'Only 1 Night Castle Raid allowed per monthly turn'
);

// Verify minimum 8 Gold vault loot even when target Lord has < 14G (e.g. 5G -> 3G from lord + 5G vault bonus = 8G!)
gs.resetTurnLocks();
gs.mutateState((st) => {
  st.activeLords['frontdeboeuf'].gold = 5;
});
const preMinGold = gs.getPlayerLord().gold;
const minLootInit = gs.initiateCastleRaid('frontdeboeuf');
const minRaid = SwordplayEngine.createSession(gs.getState(), minLootInit.context!, {
  deterministic: true,
});
minRaid.status = 'VICTORY';
minRaid.stagesCleared = 3;
const minSummary = SwordplayEngine.commitMissionOutcome(minRaid, gs);
assert(
  minSummary.goldStolenTotal === 8 &&
    minSummary.goldTakenFromLord === 3 &&
    minSummary.vaultBonusGold === 5 &&
    gs.getPlayerLord().gold === preMinGold + 8 &&
    gs.getLord('frontdeboeuf')!.gold === 2,
  `Minimum Raid Victory reward must be 8 Gold even when lord had 5G (got +${minSummary.goldStolenTotal}G)`
);

// Defeat Consequence A: Robin Hood Dungeon Bailout (-1 use, 0 Gold lost!)
gs.resetTurnLocks();
gs.mutateState((st) => {
  st.activeLords['ivanhoe'].gold = 28;
  st.robinHoodUsesLeft = 3;
});
const rhDefeatSess = SwordplayEngine.createSession(
  gs.getState(),
  gs.initiateCastleRaid('boisguilbert').context!,
  { deterministic: true }
);
rhDefeatSess.status = 'DEFEATED';
const rhBailout = SwordplayEngine.commitMissionOutcome(rhDefeatSess, gs, {
  useRobinHoodBailout: true,
});
assert(
  rhBailout.robinHoodBailoutUsed === true &&
    rhBailout.ransomPaid === 0 &&
    gs.getPlayerLord().gold === 28 &&
    gs.getState().robinHoodUsesLeft === 2,
  'Robin Hood bailout on Raid defeat must cost 1 favor and lose 0 Gold!'
);

// Defeat Consequence B: 50% Ransom Paid & Credited to Defending Lord!
gs.resetTurnLocks();
const boisGoldBeforeRansom = gs.getLord('boisguilbert')!.gold;
const ransomSess = SwordplayEngine.createSession(
  gs.getState(),
  gs.initiateCastleRaid('boisguilbert').context!,
  { deterministic: true }
);
ransomSess.status = 'DEFEATED';
const ransomSummary = SwordplayEngine.commitMissionOutcome(ransomSess, gs, {
  useRobinHoodBailout: false,
});
assert(
  ransomSummary.robinHoodBailoutUsed === false &&
    ransomSummary.ransomPaid === 14 &&
    gs.getPlayerLord().gold === 14 &&
    gs.getLord('boisguilbert')!.gold === boisGoldBeforeRansom + 14,
  `Defeat without Robin Hood must pay 50% Ransom (14G of 28G) credited to defending Lord`
);

// Fleeing Castle Safely (0G stolen, 0G lost)
gs.resetTurnLocks();
const fleeSess = SwordplayEngine.createSession(
  gs.getState(),
  gs.initiateCastleRaid('malvoisin').context!,
  { deterministic: true }
);
SwordplayEngine.fleeCastle(fleeSess);
const fleeSummary = SwordplayEngine.commitMissionOutcome(fleeSess, gs);
assert(
  fleeSummary.status === 'FLED' &&
    fleeSummary.goldStolenTotal === 0 &&
    fleeSummary.ransomPaid === 0 &&
    gs.getPlayerLord().gold === 14,
  'Fleeing castle safely must preserve exact player gold'
);

// ============================================================================
// 5. Captured Saxon Damsel Event (Periodic Turn 3/6/9 + Rescue Marriage Buffs)
// ============================================================================
assert(
  SAXON_DAMSEL_IDS.length === 4 &&
    SAXON_DAMSELS.rowena.name === 'Lady Rowena' &&
    SAXON_DAMSELS.rebecca.name === 'Lady Rebecca' &&
    SAXON_DAMSELS.marian.name === 'Lady Marian' &&
    SAXON_DAMSELS.rosalind.name === 'Lady Rosalind',
  'All 4 iconic Saxon Damsels must be defined'
);

gs.startNewCampaign('ivanhoe');
const tm = new TurnManager(gs);
assert(gs.getState().captiveDamsel === null, 'Starts Turn 1 with no captive damsel');

// Advance Turn 1 -> Turn 2 (no damsel yet), then Turn 2 -> Turn 3 (periodic trigger!)
tm.endTurn(); // Now Turn 2
assert(gs.getState().turn === 2 && gs.getState().captiveDamsel === null, 'Turn 2 no damsel yet');
tm.endTurn(); // Now Turn 3 -> Damsel in Distress spawns!
const turn3State = gs.getState();
assert(
  turn3State.turn === 3 &&
    turn3State.captiveDamsel !== null &&
    turn3State.captiveDamsel.damselId === 'rowena',
  'Turn 3 must periodically trigger a Captured Saxon Damsel event (Lady Rowena)'
);

const preRescuePlayer = gs.getPlayerLord();
const preGold = preRescuePlayer.gold;
const preLead = preRescuePlayer.leadership; // 7 for Ivanhoe
const preJoust = preRescuePlayer.jousting; // 7 for Ivanhoe
const preCombatPower = CombatResolver.calculateCombatStrength(
  preRescuePlayer.campaignArmy,
  preLead,
  false
);

const rescueInit = gs.initiateDamselRescue();
assert(
  rescueInit.success === true &&
    rescueInit.context?.missionType === 'RESCUE' &&
    gs.getState().phase === 'RESCUE',
  'initiateDamselRescue must transition phase to RESCUE'
);

const rescueSess = SwordplayEngine.createSession(
  gs.getState(),
  rescueInit.context!,
  { deterministic: true, seed: 7 }
);
// Fight through all 3 stages to rescue Lady Rowena!
while (rescueSess.status === 'ACTIVE') {
  rescueSess.player.riposteReady = true;
  const rep = SwordplayEngine.executeExchange(rescueSess, 'ATTACK_HIGH', {
    forcedEnemyAction: 'ATTACK_MID',
  });
  if (rep.stageCleared && rescueSess.status === 'ACTIVE') {
    SwordplayEngine.advanceToNextStage(rescueSess);
  }
}
assert(rescueSess.status === 'VICTORY', 'Ivanhoe defeats captor in Tower Chamber');

const marriageSummary = SwordplayEngine.commitMissionOutcome(rescueSess, gs);
const postRescuePlayer = gs.getPlayerLord();
const postCombatPower = CombatResolver.calculateCombatStrength(
  postRescuePlayer.campaignArmy,
  postRescuePlayer.leadership,
  false
);

assert(
  marriageSummary.marriedDamsel === true &&
    marriageSummary.rescuedDamsel?.id === 'rowena' &&
    postRescuePlayer.gold === preGold + 15 &&
    postRescuePlayer.leadership === preLead + 1 &&
    postRescuePlayer.jousting === preJoust + 1 &&
    postCombatPower > preCombatPower &&
    gs.getState().captiveDamsel === null &&
    gs.getState().rescuedDamselIds.includes('rowena') &&
    gs.getState().marriedDamselId === 'rowena',
  'Rescuing Lady Rowena must grant +15G dowry, +1 permanent Leadership (boosting army combat strength), +1 Jousting, and record her in GameState'
);

// Verify Turn 6 spawns the NEXT unrescued Saxon Lady (Lady Rebecca, +1 Leadership & +1 Swordplay)!
tm.endTurn(); // Turn 4
tm.endTurn(); // Turn 5
tm.endTurn(); // Turn 6
assert(
  gs.getState().turn === 6 &&
    gs.getState().captiveDamsel?.damselId === 'rebecca',
  'Turn 6 must spawn the next unrescued Saxon Lady (Lady Rebecca)'
);

const preSword = gs.getPlayerLord().swordplay;
const rebInit = gs.initiateDamselRescue();
const rebSess = SwordplayEngine.createSession(gs.getState(), rebInit.context!, {
  deterministic: true,
});
rebSess.status = 'VICTORY';
rebSess.stagesCleared = 3;
SwordplayEngine.commitMissionOutcome(rebSess, gs);
assert(
  gs.getPlayerLord().swordplay === preSword + 1 &&
    gs.getState().rescuedDamselIds.length === 2,
  'Rescuing Lady Rebecca must grant +1 permanent Swordplay and record second rescued Damsel'
);

console.log(
  '✅ ALL SPRINT 5 SWORDPLAY ENGINE, STANCES, PARRY/RIPOSTE, 3-ROOM PROGRESSION, NIGHT RAIDS, ROBIN HOOD BAILOUT & DAMSEL RESCUE TESTS PASSED!'
);
