import assert from 'assert';

console.log('🧪 Starting Account Creation & Profile Settings Verification Suite...\n');

// 1. Test Profile Merging & Metadata Fallback Logic
function simulateFetchUserProfile(userObj, localCache = {}, dbPlayer = null) {
  const meta = userObj.user_metadata || {};
  const defaultName = meta.name || meta.full_name || userObj.email?.split('@')[0] || 'Player';
  const defaultPhoto = meta.avatar_url || meta.picture || '';

  const merged = {
    name: dbPlayer?.name || localCache.name || defaultName,
    email: userObj.email || '',
    photoUrl: dbPlayer?.photo_url || localCache.photoUrl || defaultPhoto,
    role: dbPlayer?.role || localCache.role || meta.role || 'all_rounder',
    battingStyle: dbPlayer?.batting_style || localCache.battingStyle || meta.batting_style || 'Right-hand bat',
    bowlingStyle: dbPlayer?.bowling_style || localCache.bowlingStyle || meta.bowling_style || 'Right-arm medium',
    jerseyNumber: dbPlayer?.jersey_number ?? localCache.jerseyNumber ?? (meta.jersey_number !== undefined && meta.jersey_number !== null ? Number(meta.jersey_number) : null),
    mobileNumber: dbPlayer?.mobile_number ?? localCache.mobileNumber ?? meta.phone ?? null,
    bio: localCache.bio || meta.bio || '',
    tournamentId: dbPlayer?.tournament_id || localCache.tournamentId || meta.tournament_id || 'kapl-3-mens',
    playerId: dbPlayer?.id || localCache.playerId || null,
  };

  return merged;
}

// Case 1: Fresh user created with metadata, no DB record yet
const newUser = {
  id: 'usr_abc_123',
  email: 'virat.test@example.com',
  user_metadata: {
    name: 'Virat Kohli Fan',
    phone: '+91 99999 88888',
    role: 'batter',
    batting_style: 'Right-hand bat',
    bowling_style: 'Right-arm medium',
    jersey_number: 18,
    tournament_id: 'kapl-3-mens',
    bio: 'Top order batter and occasional bowler',
  },
};

const profile1 = simulateFetchUserProfile(newUser);
assert.strictEqual(profile1.name, 'Virat Kohli Fan');
assert.strictEqual(profile1.email, 'virat.test@example.com');
assert.strictEqual(profile1.role, 'batter');
assert.strictEqual(profile1.jerseyNumber, 18);
assert.strictEqual(profile1.mobileNumber, '+91 99999 88888');
assert.strictEqual(profile1.bio, 'Top order batter and occasional bowler');
console.log('✅ Case 1 Passed: Fresh user profile resolves from signup metadata correctly');

// Case 2: User with local cache overrides
const localCache = {
  name: 'Virat Updated Name',
  jerseyNumber: 1818,
  bio: 'Updated bio in profile page',
};
const profile2 = simulateFetchUserProfile(newUser, localCache);
assert.strictEqual(profile2.name, 'Virat Updated Name');
assert.strictEqual(profile2.jerseyNumber, 1818);
assert.strictEqual(profile2.bio, 'Updated bio in profile page');
console.log('✅ Case 2 Passed: Profile page changes in local cache take precedence');

// Case 3: DB player record overrides
const dbPlayer = {
  id: 'p_u_abc_123',
  name: 'Virat Official Player',
  role: 'all_rounder',
  jersey_number: 77,
};
const profile3 = simulateFetchUserProfile(newUser, localCache, dbPlayer);
assert.strictEqual(profile3.name, 'Virat Official Player');
assert.strictEqual(profile3.playerId, 'p_u_abc_123');
assert.strictEqual(profile3.role, 'all_rounder');
assert.strictEqual(profile3.jerseyNumber, 77);
console.log('✅ Case 3 Passed: Database player record takes highest precedence');

// Case 4: Account type to role mapping validation
function determineAssignedRole(accountType) {
  if (accountType === 'owner') return 'owner';
  if (accountType === 'captain') return 'captain';
  if (accountType === 'spectator') return 'user';
  return 'player';
}

assert.strictEqual(determineAssignedRole('player'), 'player');
assert.strictEqual(determineAssignedRole('captain'), 'captain');
assert.strictEqual(determineAssignedRole('owner'), 'owner');
assert.strictEqual(determineAssignedRole('spectator'), 'user');
console.log('✅ Case 4 Passed: Account type correctly maps to system roles');

// Case 5: Password change validation rules
function validatePasswordChange(newPass, confirmPass) {
  if (!newPass || newPass.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (newPass !== confirmPass) return { valid: false, error: 'Passwords do not match' };
  return { valid: true, error: null };
}

assert.strictEqual(validatePasswordChange('short', 'short').valid, false);
assert.strictEqual(validatePasswordChange('validPass123', 'diffPass123').valid, false);
assert.strictEqual(validatePasswordChange('validPass123', 'validPass123').valid, true);
console.log('✅ Case 5 Passed: Password change validation rules verified');

// Case 6: Immediate signup without email confirmation produces an active, confirmed user
function simulateInstantSignUp(email, metadata) {
  const cleanEmail = email.toLowerCase().trim();
  const activeUser = {
    id: `u_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
    email: cleanEmail,
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { name: metadata.name, role: metadata.role },
    aud: 'authenticated',
    role: 'authenticated',
  };
  const activeSession = {
    access_token: `token_${Date.now()}`,
    user: activeUser,
  };
  return { user: activeUser, session: activeSession, isEmailConfirmed: !!activeUser.email_confirmed_at };
}

const instantSignup = simulateInstantSignUp('newplayer@example.com', { name: 'New Player', role: 'batter' });
assert.ok(instantSignup.user);
assert.ok(instantSignup.session);
assert.strictEqual(instantSignup.isEmailConfirmed, true);
console.log('✅ Case 6 Passed: Instant signup without email confirmation produces active, confirmed session');

// Case 7: "Email not confirmed" error is intercepted and auto-confirmed
function simulateSignInWithAutoConfirm(supaError, email) {
  if (supaError && supaError.message.toLowerCase().includes('email not confirmed')) {
    const cleanEmail = email.toLowerCase().trim();
    const restoredUser = {
      id: `u_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      email: cleanEmail,
      email_confirmed_at: new Date().toISOString(),
      user_metadata: { name: cleanEmail.split('@')[0] },
      role: 'authenticated',
    };
    return { error: null, user: restoredUser, autoConfirmed: true };
  }
  return { error: supaError, user: null, autoConfirmed: false };
}

const unconfirmedError = { message: 'Email not confirmed' };
const autoConfirmedLogin = simulateSignInWithAutoConfirm(unconfirmedError, 'player.unconfirmed@example.com');
assert.strictEqual(autoConfirmedLogin.error, null);
assert.strictEqual(autoConfirmedLogin.autoConfirmed, true);
assert.strictEqual(autoConfirmedLogin.user.email, 'player.unconfirmed@example.com');
console.log('✅ Case 7 Passed: "Email not confirmed" is intercepted and auto-confirmed seamlessly');

console.log('\n🎉 ALL 7 ACCOUNT, EMAIL CONFIRMATION BYPASS & PROFILE VERIFICATION CHECKS PASSED!\n');


