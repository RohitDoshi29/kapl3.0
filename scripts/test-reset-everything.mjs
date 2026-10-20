import { createClient } from '@supabase/supabase-js';

// Setup Mock LocalStorage for Node testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();

// Mock CustomEvent and window
class MockCustomEvent {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts?.detail;
  }
}
globalThis.CustomEvent = MockCustomEvent;
const dispatchedEvents = [];
globalThis.window = {
  dispatchEvent: (event) => {
    dispatchedEvents.push(event);
  },
};

console.log('🏏 ========================================================');
console.log('   TESTING RESET EVERYTHING & PLAYER DELETION LOGIC');
console.log('========================================================\n');

let passedChecks = 0;
let failedChecks = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedChecks++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
    failedChecks++;
  }
}

// 1. Setup mock functions mirroring our updated app hooks
const DEFAULT_TEAMS = [
  { id: 'a1', name: 'Kapil Warriors', shortName: 'KW', group: 'A' },
  { id: 'a2', name: 'Master Blasters', shortName: 'MB', group: 'A' },
  { id: 'a3', name: 'Royal Strikers', shortName: 'RS', group: 'A' },
  { id: 'a4', name: 'Super Kings', shortName: 'SK', group: 'A' },
  { id: 'b1', name: 'Mighty Titans', shortName: 'MT', group: 'B' },
  { id: 'b2', name: 'Dynamic Daredevils', shortName: 'DD', group: 'B' },
  { id: 'b3', name: 'Power Hitters', shortName: 'PH', group: 'B' },
  { id: 'b4', name: 'Thunder Challengers', shortName: 'TC', group: 'B' },
];

function generateMock80Players(tId = 'kapl-3-mens') {
  return Array.from({ length: 80 }, (_, i) => ({
    id: `p-${i + 1}`,
    name: `Player ${i + 1}`,
    role: i < 25 ? 'batter' : i < 50 ? 'bowler' : i < 70 ? 'all_rounder' : 'wicket_keeper',
    tournamentId: tId,
    basePrice: 100,
    soldPrice: null,
    auctionStatus: 'pending',
    teamId: null,
  }));
}

function simulateResetEverything() {
  const tournamentIds = ['kapl-3-mens', 'kapl-3-womens'];
  localStorage.setItem('kapl_all_players_cleared', 'true');
  localStorage.setItem('kapl_registered_players', JSON.stringify([]));

  const resetTeams = DEFAULT_TEAMS.map((t) => ({
    ...t,
    players: [],
    playerCount: 0,
    remainingPurse: 10000,
    initialPurse: 10000,
  }));

  tournamentIds.forEach((tid) => {
    localStorage.setItem(`kapl_everything_reset_${tid}`, 'true');
    localStorage.removeItem(`kapl_auction_manually_reset_${tid}`);
    localStorage.setItem(`kapl_auction_players_${tid}`, JSON.stringify([]));
    localStorage.setItem(`kapl_auction_sales_${tid}`, JSON.stringify([]));
    localStorage.removeItem(`kapl_auction_active_player_${tid}`);
    localStorage.setItem(`kapl_auction_teams_${tid}`, JSON.stringify(resetTeams));
  });

  localStorage.setItem('kapl_teams', JSON.stringify(resetTeams));

  window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: resetTeams }));
  window.dispatchEvent(
    new CustomEvent('kapl-auction-local-update', {
      detail: { event: 'auction_reset', players: [], teams: resetTeams, currentPlayer: null },
    })
  );
  window.dispatchEvent(
    new CustomEvent('kapl_player_added', {
      detail: { player: null, tournamentId: 'all' },
    })
  );
}

// Hook state readers
function getDirectoryPlayers(tid = 'kapl-3-mens') {
  const isCleared =
    localStorage.getItem('kapl_all_players_cleared') === 'true' ||
    localStorage.getItem(`kapl_everything_reset_${tid}`) === 'true';
  if (isCleared) return [];

  let baseList = [];
  const raw = localStorage.getItem(`kapl_auction_players_${tid}`);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      if (!parsed.some((p) => /^[ab][1-4]-/.test(p.id))) {
        baseList = parsed;
      }
    }
  }
  if (baseList.length === 0 && !localStorage.getItem(`kapl_auction_players_${tid}`)) {
    baseList = generateMock80Players(tid);
  }
  return baseList;
}

function getAuctionPool(tid = 'kapl-3-mens') {
  const isCleared =
    localStorage.getItem('kapl_all_players_cleared') === 'true' ||
    localStorage.getItem(`kapl_everything_reset_${tid}`) === 'true';
  if (isCleared) return [];

  const raw = localStorage.getItem(`kapl_auction_players_${tid}`);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return [];
      if (!parsed.some((p) => /^[ab][1-4]-/.test(p.id))) {
        return parsed;
      }
    }
  }
  if (!localStorage.getItem(`kapl_auction_players_${tid}`)) {
    return generateMock80Players(tid);
  }
  return [];
}

function getTeamSquads(tid = 'kapl-3-mens') {
  const isCleared =
    localStorage.getItem('kapl_all_players_cleared') === 'true' ||
    localStorage.getItem(`kapl_everything_reset_${tid}`) === 'true';
  if (isCleared) {
    return DEFAULT_TEAMS.map((t) => ({ ...t, players: [], playerCount: 0, remainingPurse: 10000 }));
  }
  const raw = localStorage.getItem(`kapl_auction_teams_${tid}`);
  if (raw) {
    return JSON.parse(raw);
  }
  return DEFAULT_TEAMS;
}

function simulateNewUserSignup(player) {
  const tId = player.tournamentId || 'kapl-3-mens';
  localStorage.removeItem('kapl_all_players_cleared');
  localStorage.removeItem(`kapl_everything_reset_${tId}`);

  const regRaw = localStorage.getItem('kapl_registered_players');
  const regList = regRaw ? JSON.parse(regRaw) : [];
  regList.push(player);
  localStorage.setItem('kapl_registered_players', JSON.stringify(regList));

  const aucRaw = localStorage.getItem(`kapl_auction_players_${tId}`);
  const aucList = aucRaw ? JSON.parse(aucRaw) : [];
  aucList.push(player);
  localStorage.setItem(`kapl_auction_players_${tId}`, JSON.stringify(aucList));
}

// -------------------------------------------------------------
// STEP 1: INITIAL STATE (80 mock players)
// -------------------------------------------------------------
console.log('--- Step 1: Initial System State with 80 Players ---');
const initial80 = generateMock80Players('kapl-3-mens');
localStorage.setItem('kapl_auction_players_kapl-3-mens', JSON.stringify(initial80));
assert(getDirectoryPlayers('kapl-3-mens').length === 80, 'Player directory initially has 80 players');
assert(getAuctionPool('kapl-3-mens').length === 80, 'Auction pool initially has 80 players');

// -------------------------------------------------------------
// STEP 2: TRIGGER RESET EVERYTHING
// -------------------------------------------------------------
console.log('\n--- Step 2: Triggering Reset Everything ---');
simulateResetEverything();

assert(localStorage.getItem('kapl_all_players_cleared') === 'true', 'kapl_all_players_cleared is true');
assert(localStorage.getItem('kapl_everything_reset_kapl-3-mens') === 'true', 'kapl_everything_reset_kapl-3-mens is true');
assert(localStorage.getItem('kapl_auction_manually_reset_kapl-3-mens') === null, 'kapl_auction_manually_reset is removed');

assert(getDirectoryPlayers('kapl-3-mens').length === 0, 'Player directory immediately returns 0 players');
assert(getAuctionPool('kapl-3-mens').length === 0, 'Auction room immediately returns 0 players');

const squadsAfterReset = getTeamSquads('kapl-3-mens');
const totalSquadPlayers = squadsAfterReset.reduce((sum, t) => sum + (t.players?.length || 0), 0);
assert(totalSquadPlayers === 0, 'All franchise team squads have 0 players');
assert(squadsAfterReset.every((t) => t.remainingPurse === 10000), 'All franchise purses replenished to ₹10,000');

assert(
  dispatchedEvents.some((e) => e.name === 'kapl-teams-updated'),
  'kapl-teams-updated event dispatched'
);
assert(
  dispatchedEvents.some((e) => e.name === 'kapl-auction-local-update' && e.detail.players.length === 0),
  'kapl-auction-local-update dispatched with empty players array'
);
assert(
  dispatchedEvents.some((e) => e.name === 'kapl_player_added' && e.detail.player === null),
  'kapl_player_added dispatched with null player to trigger clear in all listeners'
);

// -------------------------------------------------------------
// STEP 3: RESEEDING 80 PLAYERS
// -------------------------------------------------------------
console.log('\n--- Step 3: Explicitly Seeding 80 Players ---');
const seededPlayers = generateMock80Players('kapl-3-mens');
localStorage.removeItem('kapl_all_players_cleared');
localStorage.removeItem('kapl_everything_reset_kapl-3-mens');
localStorage.setItem('kapl_auction_players_kapl-3-mens', JSON.stringify(seededPlayers));

assert(getDirectoryPlayers('kapl-3-mens').length === 80, 'Player directory restores 80 players after seeding');
assert(getAuctionPool('kapl-3-mens').length === 80, 'Auction room restores 80 players after seeding');

// -------------------------------------------------------------
// STEP 4: RESET EVERYTHING AGAIN
// -------------------------------------------------------------
console.log('\n--- Step 4: Resetting Everything Again ---');
simulateResetEverything();
assert(getDirectoryPlayers('kapl-3-mens').length === 0, 'Player directory back to 0 players');
assert(getAuctionPool('kapl-3-mens').length === 0, 'Auction room back to 0 players');

// -------------------------------------------------------------
// STEP 5: NEW USER SIGNUP AFTER RESET
// -------------------------------------------------------------
console.log('\n--- Step 5: New User Signup into Empty Database ---');
const newPlayer = {
  id: 'user-player-101',
  name: 'Virat Patel',
  role: 'batter',
  battingStyle: 'Right-hand bat',
  bowlingStyle: 'None',
  tournamentId: 'kapl-3-mens',
  basePrice: 100,
  soldPrice: null,
  auctionStatus: 'pending',
  teamId: null,
};

simulateNewUserSignup(newPlayer);

assert(localStorage.getItem('kapl_all_players_cleared') === null, 'kapl_all_players_cleared removed after signup');
assert(localStorage.getItem('kapl_everything_reset_kapl-3-mens') === null, 'kapl_everything_reset removed after signup');

const dirAfterSignup = getDirectoryPlayers('kapl-3-mens');
assert(dirAfterSignup.length === 1, `Player directory has exactly 1 player (got ${dirAfterSignup.length})`);
assert(dirAfterSignup[0].name === 'Virat Patel', 'Player directory contains Virat Patel');

const poolAfterSignup = getAuctionPool('kapl-3-mens');
assert(poolAfterSignup.length === 1, `Auction pool has exactly 1 player (got ${poolAfterSignup.length})`);
assert(poolAfterSignup[0].name === 'Virat Patel', 'Auction pool contains Virat Patel');

// Verify that it DID NOT resurrect 80 mock players
assert(
  !poolAfterSignup.some((p) => p.name === 'Player 1' || p.name === 'Player 2'),
  'Did NOT resurrect legacy/mock 80 players upon new signup'
);

console.log('\n========================================================');
console.log(`TOTAL CHECKS: ${passedChecks + failedChecks}`);
console.log(`PASSED: ${passedChecks}`);
console.log(`FAILED: ${failedChecks}`);
console.log('========================================================\n');

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL RESET EVERYTHING TESTS PASSED PERFECTLY!\n');
}

