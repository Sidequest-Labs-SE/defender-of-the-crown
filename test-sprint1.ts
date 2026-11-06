import { GameState } from './src/core/GameState.ts';
import { SAXON_LORDS, NORMAN_LORDS } from './src/data/lords.ts';
import { INITIAL_TERRITORIES } from './src/data/territories.ts';
import { getCinemawareStatRating } from './src/core/types.ts';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('Testing Sprint 1 Core Architecture & GameState...');

// 1. Check Data Definitions
assert(Object.keys(SAXON_LORDS).length === 4, 'Must have 4 Saxon lords');
assert(Object.keys(NORMAN_LORDS).length === 3, 'Must have 3 Norman lords');
assert(Object.keys(INITIAL_TERRITORIES).length === 18, 'Must have 18 territories');

// Check stats for all lords
assert(SAXON_LORDS.ivanhoe.leadership === 7 && SAXON_LORDS.ivanhoe.jousting === 7 && SAXON_LORDS.ivanhoe.swordplay === 6, 'Ivanhoe stats');
assert(SAXON_LORDS.cedric.leadership === 6 && SAXON_LORDS.cedric.jousting === 9 && SAXON_LORDS.cedric.swordplay === 4, 'Cedric stats');
assert(SAXON_LORDS.geoffrey.leadership === 4 && SAXON_LORDS.geoffrey.jousting === 6 && SAXON_LORDS.geoffrey.swordplay === 9, 'Geoffrey stats');
assert(SAXON_LORDS.wolfric.leadership === 9 && SAXON_LORDS.wolfric.jousting === 4 && SAXON_LORDS.wolfric.swordplay === 6, 'Wolfric stats');

assert(NORMAN_LORDS.malvoisin.leadership === 5 && NORMAN_LORDS.malvoisin.jousting === 6 && NORMAN_LORDS.malvoisin.swordplay === 8, 'Malvoisin stats');
assert(NORMAN_LORDS.frontdeboeuf.leadership === 8 && NORMAN_LORDS.frontdeboeuf.jousting === 5 && NORMAN_LORDS.frontdeboeuf.swordplay === 7, 'Front-de-Boeuf stats');
assert(NORMAN_LORDS.boisguilbert.leadership === 7 && NORMAN_LORDS.boisguilbert.jousting === 9 && NORMAN_LORDS.boisguilbert.swordplay === 7, 'Bois-Guilbert stats');

// Check Cinemaware ratings
assert(getCinemawareStatRating(2) === 'Poor', 'Rating for 2');
assert(getCinemawareStatRating(4) === 'Average', 'Rating for 4');
assert(getCinemawareStatRating(7) === 'Good', 'Rating for 7');
assert(getCinemawareStatRating(9) === 'Best', 'Rating for 9');
assert(getCinemawareStatRating(10) === 'Legendary', 'Rating for 10');

// 2. Test GameState.startNewCampaign for Ivanhoe
const stateMgr = GameState.getInstance();
const campaign = stateMgr.startNewCampaign('ivanhoe');

assert(campaign.year === 1149, 'Year must be 1149');
assert(campaign.month === 1, 'Month must be 1 (January)');
assert(campaign.turn === 1, 'Turn must be 1');
assert(campaign.robinHoodUsesLeft === 3, 'Robin Hood uses must be 3');
assert(campaign.selectedLordId === 'ivanhoe', 'Selected lord must be ivanhoe');

const activeLords = Object.values(campaign.activeLords);
assert(activeLords.length === 6, `Must have exactly 6 active lords, found ${activeLords.length}`);

// Player lord checks
const player = stateMgr.getPlayerLord();
assert(player.id === 'ivanhoe', 'Player must be Ivanhoe');
assert(player.isPlayer === true, 'Player lord isPlayer must be true');
assert(player.gold === 10, 'Player gold must be 10');
assert(player.campaignArmy.soldiers === 10, 'Campaign army soldiers must be 10');
assert(player.campaignArmy.knights === 1, 'Campaign army knights must be 1');
assert(player.campaignArmy.catapults === 0, 'Campaign army catapults must be 0');

// Check home territory of Ivanhoe (Yorkshire)
const yorkshire = campaign.territories['yorkshire'];
assert(yorkshire.ownerId === 'ivanhoe', 'Yorkshire owner must be ivanhoe');
assert(yorkshire.hasCastle === true, 'Yorkshire must have castle');
assert(yorkshire.garrison.soldiers === 10, 'Yorkshire garrison soldiers must be 10');

// Check Sherwood Forest
const notts = campaign.territories['notts'];
assert(notts.isSherwood === true, 'Nottingham must be Sherwood Forest');
assert(notts.ownerId === null, 'Nottingham must start neutral');

// Check neutral territory count: 18 - 6 = 12
const neutralTerritories = Object.values(campaign.territories).filter(t => t.ownerId === null);
assert(neutralTerritories.length === 12, `Must have 12 neutral territories, found ${neutralTerritories.length}`);

// Test switching lord to Cedric, Geoffrey, and Wolfric
const campaign2 = stateMgr.startNewCampaign('cedric');
assert(campaign2.selectedLordId === 'cedric', 'Switched to Cedric');
assert(campaign2.activeLords.cedric.isPlayer === true, 'Cedric is now player');
assert(campaign2.territories.shropshire.ownerId === 'cedric', 'Shropshire owner must be cedric');

const campaign3 = stateMgr.startNewCampaign('geoffrey');
assert(campaign3.selectedLordId === 'geoffrey', 'Switched to Geoffrey');
assert(campaign3.activeLords.geoffrey.isPlayer === true, 'Geoffrey is now player');
assert(campaign3.territories.northumberland.ownerId === 'geoffrey', 'Northumberland owner must be geoffrey');

const campaign4 = stateMgr.startNewCampaign('wolfric');
assert(campaign4.selectedLordId === 'wolfric', 'Switched to Wolfric');
assert(campaign4.activeLords.wolfric.isPlayer === true, 'Wolfric is now player');
assert(campaign4.territories.cumberland.ownerId === 'wolfric', 'Cumberland owner must be wolfric');

console.log('✅ ALL SPRINT 1 ARCHITECTURE AND GAMESTATE TESTS PASSED!');
