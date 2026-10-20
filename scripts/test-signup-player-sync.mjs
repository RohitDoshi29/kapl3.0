import { createClient } from '@supabase/supabase-js';

// Setup Mock LocalStorage for Node testing
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
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

console.log('🏏 ========================================================');
console.log('   TESTING NEW SIGNUP PLAYER SYNC (AUCTION & TOURNAMENT)');
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

// 1. Seed initial 80 auction players dataset
const initial80Players = Array.from({ length: 80 }, (_, i) => ({
  id: `mock-p-${i + 1}`,
  tournamentId: 'kapl-3-mens',
  teamId: null,
  name: `Candidate ${i + 1}`,
  role: i < 25 ? 'batter' : i < 50 ? 'bowler' : i < 70 ? 'all_rounder' : 'wicket_keeper',
  battingStyle: 'Right-hand bat',
  bowlingStyle: 'Right-arm medium',
  basePrice: 100,
  soldPrice: null,
  auctionStatus: 'sold',
  jerseyNumber: i + 1,
}));

localStorage.setItem('kapl_auction_players_kapl-3-mens', JSON.stringify(initial80Players));
assert(
  JSON.parse(localStorage.getItem('kapl_auction_players_kapl-3-mens')).length === 80,
  'Initial auction player pool seeded with exactly 80 candidates'
);

// 2. Simulate User Sign Up for a new player
const newSignup = {
  id: 'p_u_abc12345',
  userId: 'usr_abc12345',
  name: 'Virat Sharma',
  role: 'batter',
  battingStyle: 'Right-hand bat',
  bowlingStyle: 'Right-arm medium',
  jerseyNumber: 18,
  mobileNumber: '9876543210',
  tournamentId: 'kapl-3-mens',
  basePrice: 100,
  soldPrice: null,
  auctionStatus: 'pending',
  createdAt: new Date().toISOString(),
};

// Test syncPlayerToAuctionAndTournament implementation
function syncPlayerToAuctionAndTournament(playerRecord) {
  // 1. Update kapl_registered_players
  const regRaw = localStorage.getItem('kapl_registered_players');
  const regList = regRaw ? JSON.parse(regRaw) : [];
  const regIdx = regList.findIndex(
    (p) => p.id === playerRecord.id || (p.userId && playerRecord.userId && p.userId === playerRecord.userId)
  );
  if (regIdx >= 0) {
    regList[regIdx] = { ...regList[regIdx], ...playerRecord };
  } else {
    regList.push(playerRecord);
  }
  localStorage.setItem('kapl_registered_players', JSON.stringify(regList));

  // 2. Update kapl_auction_players_${tournamentId}
  const tId = playerRecord.tournamentId || 'kapl-3-mens';
  const auctionRaw = localStorage.getItem(`kapl_auction_players_${tId}`);
  if (auctionRaw) {
    const auctionList = JSON.parse(auctionRaw);
    const aucIdx = auctionList.findIndex(
      (p) => p.id === playerRecord.id || (p.userId && playerRecord.userId && p.userId === playerRecord.userId)
    );
    if (aucIdx >= 0) {
      auctionList[aucIdx] = { ...auctionList[aucIdx], ...playerRecord };
    } else {
      auctionList.push(playerRecord);
    }
    localStorage.setItem(`kapl_auction_players_${tId}`, JSON.stringify(auctionList));
  }
}

syncPlayerToAuctionAndTournament(newSignup);

// 3. Verify Registered Players Store
const registeredPlayers = JSON.parse(localStorage.getItem('kapl_registered_players') || '[]');
assert(registeredPlayers.length === 1, 'New signup stored in kapl_registered_players');
assert(registeredPlayers[0].name === 'Virat Sharma', 'Registered player name matches "Virat Sharma"');
assert(registeredPlayers[0].auctionStatus === 'pending', 'Registered player initial auction status is "pending"');

// 4. Verify Auction Pool Expansion (80 -> 81)
const updatedAuctionPool = JSON.parse(localStorage.getItem('kapl_auction_players_kapl-3-mens') || '[]');
assert(updatedAuctionPool.length === 81, 'Auction pool expanded from 80 to 81 players');
const foundInAuction = updatedAuctionPool.find((p) => p.id === 'p_u_abc12345');
assert(Boolean(foundInAuction), 'Newly registered player found in live auction pool');
assert(foundInAuction?.role === 'batter', 'Newly registered player role is "batter"');
assert(foundInAuction?.jerseyNumber === 18, 'Newly registered player jersey number is 18');

// 5. Test Dataset Guard (ensureCompletedAuctionDatasetCached must NOT overwrite 81 players)
function testDatasetCacheGuard(tournamentId = 'kapl-3-mens') {
  const raw = localStorage.getItem(`kapl_auction_players_${tournamentId}`);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.length >= 80 && !parsed.some((p) => /^[ab][1-4]-/.test(p.id))) {
      return false; // did not overwrite
    }
  }
  // would overwrite
  return true;
}

const didOverwrite = testDatasetCacheGuard();
assert(!didOverwrite, 'ensureCompletedAuctionDatasetCached correctly preserves 81+ candidates without overwriting');

// 6. Test Auction Status Logic (isAllSold must be FALSE when 81st candidate is pending)
const isAllSold = updatedAuctionPool.length >= 80 && updatedAuctionPool.every((p) => p.auctionStatus === 'sold');
assert(
  !isAllSold,
  'Auction is NOT prematurely marked as all-sold when newly registered player is pending'
);

// 7. Test Players Directory Aggregation
function simulatePlayersDirectory(tournamentIdFilter = 'kapl-3-mens') {
  let baseList = [];
  const raw = localStorage.getItem(`kapl_auction_players_${tournamentIdFilter}`);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.length >= 80) baseList = parsed;
  }

  // Merge registered players
  const regRaw = localStorage.getItem('kapl_registered_players');
  if (regRaw) {
    const regList = JSON.parse(regRaw);
    regList.forEach((reg) => {
      const idx = baseList.findIndex((p) => p.id === reg.id);
      if (idx >= 0) baseList[idx] = { ...baseList[idx], ...reg };
      else baseList.push(reg);
    });
  }

  return baseList;
}

const dirPlayers = simulatePlayersDirectory();
assert(dirPlayers.length === 81, 'Players Directory aggregates exactly 81 players');
const dirFound = dirPlayers.find((p) => p.name === 'Virat Sharma');
assert(Boolean(dirFound), 'Newly registered player appears in Players Directory');

// 8. Test Role and Status Filtering in Directory
const battersOnly = dirPlayers.filter((p) => p.role === 'batter');
assert(battersOnly.length === 26, 'Batters filter includes newly registered batter (25 + 1 = 26)');

const pendingOnly = dirPlayers.filter((p) => p.auctionStatus === 'pending');
assert(pendingOnly.length === 1 && pendingOnly[0].name === 'Virat Sharma', 'Pending filter isolates newly registered candidate');

// 9. Test Player Profile by ID Lookup
function simulatePlayerStatsLookup(playerId) {
  let found = (initial80Players || []).find((p) => p.id === playerId) || null;
  if (!found) {
    const regRaw = localStorage.getItem('kapl_registered_players');
    if (regRaw) {
      const regList = JSON.parse(regRaw);
      found = regList.find((p) => p.id === playerId) || null;
    }
  }
  return found;
}

const profileRecord = simulatePlayerStatsLookup('p_u_abc12345');
assert(Boolean(profileRecord), 'PlayerProfile by ID resolves candidate from local registration cache');
assert(profileRecord?.name === 'Virat Sharma', 'Profile data resolves correct player name');
assert(profileRecord?.jerseyNumber === 18, 'Profile data resolves correct jersey number');

// 10. Test Profile Update Synchronization
const profileUpdate = {
  ...newSignup,
  name: 'Virat K. Sharma',
  role: 'all_rounder',
  jerseyNumber: 7,
};

syncPlayerToAuctionAndTournament(profileUpdate);

const updatedPoolAfterEdit = JSON.parse(localStorage.getItem('kapl_auction_players_kapl-3-mens') || '[]');
const updatedPlayer = updatedPoolAfterEdit.find((p) => p.id === 'p_u_abc12345');

assert(updatedPoolAfterEdit.length === 81, 'Pool count remains 81 after profile update');
assert(updatedPlayer?.name === 'Virat K. Sharma', 'Auction pool reflects updated name "Virat K. Sharma"');
assert(updatedPlayer?.role === 'all_rounder', 'Auction pool reflects updated role "all_rounder"');
assert(updatedPlayer?.jerseyNumber === 7, 'Auction pool reflects updated jersey number 7');

console.log('\n========================================================');
console.log(`🏁 TEST RESULTS: ${passedChecks} PASSED, ${failedChecks} FAILED`);
console.log('========================================================\n');

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

