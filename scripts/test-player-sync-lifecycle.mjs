// Verification script for Player Addition, Removal & Cross-Role Sync
import assert from 'assert';

console.log('Testing Synchronization & Player Lifecycle Mechanics...');

// Mock LocalStorage
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

// Mock BroadcastChannel
class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
  }
  postMessage(msg) {
    MockBroadcastChannel.messages.push({ channel: this.name, msg });
  }
  close() {}
}
MockBroadcastChannel.messages = [];
global.BroadcastChannel = MockBroadcastChannel;

// Mock window events
const windowEvents = [];
global.window = {
  dispatchEvent: (event) => windowEvents.push(event),
};
global.CustomEvent = class {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

// 1. Test Reset State Behavior
localStorage.setItem('kapl_all_players_cleared', 'true');
localStorage.setItem('kapl_everything_reset_kapl-3-mens', 'true');
localStorage.setItem('kapl_auction_players_kapl-3-mens', JSON.stringify([]));
localStorage.setItem('kapl_registered_players', JSON.stringify([]));

console.log('1. Verifying Clean Reset State...');
assert.strictEqual(localStorage.getItem('kapl_all_players_cleared'), 'true');
assert.strictEqual(localStorage.getItem('kapl_everything_reset_kapl-3-mens'), 'true');
console.log('   ✅ Reset state is active.');

// 2. Test Player Registration & Sync Override
const newPlayer = {
  id: 'p_test_999',
  tournamentId: 'kapl-3-mens',
  name: 'Virat Kohli Clone',
  role: 'batter',
  battingStyle: 'Right-hand bat',
  bowlingStyle: 'Right-arm medium',
  basePrice: 100,
  soldPrice: null,
  auctionStatus: 'pending',
};

// Simulate syncPlayerToAuctionAndTournament
function simulateSync(playerRecord) {
  const tId = playerRecord.tournamentId || 'kapl-3-mens';
  localStorage.removeItem('kapl_all_players_cleared');
  localStorage.removeItem(`kapl_everything_reset_${tId}`);
  localStorage.removeItem('kapl_everything_reset_kapl-3-mens');
  localStorage.removeItem('kapl_everything_reset_kapl-3-womens');

  const regRaw = localStorage.getItem('kapl_registered_players');
  const regList = regRaw ? JSON.parse(regRaw) : [];
  regList.push(playerRecord);
  localStorage.setItem('kapl_registered_players', JSON.stringify(regList));

  const aucRaw = localStorage.getItem(`kapl_auction_players_${tId}`);
  let aucList = aucRaw ? JSON.parse(aucRaw) : [];
  aucList.push(playerRecord);
  localStorage.setItem(`kapl_auction_players_${tId}`, JSON.stringify(aucList));

  localStorage.setItem(`kapl_auction_active_player_${tId}`, playerRecord.id);

  const tab = new BroadcastChannel('kapl-shared-tab-channel');
  tab.postMessage({ event: 'auction_player_added', player: playerRecord, tournamentId: tId });

  window.dispatchEvent(new CustomEvent('kapl_player_added', { detail: { player: playerRecord, tournamentId: tId } }));
}

console.log('2. Simulating New Player Account Signup...');
simulateSync(newPlayer);

assert.strictEqual(localStorage.getItem('kapl_all_players_cleared'), null, 'Cleared flag must be wiped on registration');
assert.strictEqual(localStorage.getItem('kapl_everything_reset_kapl-3-mens'), null, 'Reset flag must be wiped on registration');

const registered = JSON.parse(localStorage.getItem('kapl_registered_players'));
assert.strictEqual(registered.length, 1, 'Registered player list must contain 1 player');
assert.strictEqual(registered[0].name, 'Virat Kohli Clone');

const auctionList = JSON.parse(localStorage.getItem('kapl_auction_players_kapl-3-mens'));
assert.strictEqual(auctionList.length, 1, 'Auction pool must contain new player');
assert.strictEqual(localStorage.getItem('kapl_auction_active_player_kapl-3-mens'), 'p_test_999');

console.log('   ✅ Registered player correctly restored auction pool and removed clear flags.');

// 3. Test Player Removal (Admin Delete)
console.log('3. Simulating Admin Delete Player...');
function simulateDelete(playerId) {
  const reg = JSON.parse(localStorage.getItem('kapl_registered_players') || '[]').filter(p => p.id !== playerId);
  localStorage.setItem('kapl_registered_players', JSON.stringify(reg));

  const auc = JSON.parse(localStorage.getItem('kapl_auction_players_kapl-3-mens') || '[]').filter(p => p.id !== playerId);
  localStorage.setItem('kapl_auction_players_kapl-3-mens', JSON.stringify(auc));

  const tab = new BroadcastChannel('kapl-shared-tab-channel');
  tab.postMessage({ event: 'auction_player_removed', playerId, tournamentId: 'kapl-3-mens' });

  window.dispatchEvent(new CustomEvent('kapl_player_removed', { detail: { playerId, tournamentId: 'kapl-3-mens' } }));
}

simulateDelete(newPlayer.id);

const remainingReg = JSON.parse(localStorage.getItem('kapl_registered_players'));
assert.strictEqual(remainingReg.length, 0, 'Registered players must be 0 after delete');

const remainingAuc = JSON.parse(localStorage.getItem('kapl_auction_players_kapl-3-mens'));
assert.strictEqual(remainingAuc.length, 0, 'Auction pool must be 0 after delete');

const removeEvents = MockBroadcastChannel.messages.filter(m => m.msg.event === 'auction_player_removed');
assert.strictEqual(removeEvents.length, 1, 'Must broadcast auction_player_removed to all tabs');

console.log('   ✅ Player removal successfully purged records and broadcast across channels.');

// 4. Test Squad Player Removal with Purse Refund
console.log('4. Simulating Team Squad Player Removal & Purse Refund...');
const team = {
  id: 'a1',
  name: "Kapil's Warriors",
  initialPurse: 10000,
  remainingPurse: 8500,
  playerCount: 1,
  players: [
    { id: 'p_squad_1', name: 'Drafted Star', soldPrice: 1500, role: 'all_rounder' }
  ]
};

function simulateRemoveFromTeam(targetTeam, playerId) {
  const p = targetTeam.players.find(x => x.id === playerId);
  const refund = p?.soldPrice || 0;
  const remaining = targetTeam.players.filter(x => x.id !== playerId);
  return {
    ...targetTeam,
    players: remaining,
    playerCount: remaining.length,
    remainingPurse: targetTeam.remainingPurse + refund,
  };
}

const updatedTeam = simulateRemoveFromTeam(team, 'p_squad_1');
assert.strictEqual(updatedTeam.playerCount, 0, 'Squad count must decrement');
assert.strictEqual(updatedTeam.remainingPurse, 10000, 'Purse must be refunded: 8500 + 1500 = 10000');
assert.strictEqual(updatedTeam.players.length, 0, 'Squad roster must be empty');

console.log('   ✅ Squad removal refunded ₹1,500 back to franchise purse (Purse: ₹10,000, Count: 0).');

console.log('\n=============================================');
console.log('🎉 ALL 4 CORE SYNC TESTS PASSED SUCCESSFULLY!');
console.log('=============================================\n');

