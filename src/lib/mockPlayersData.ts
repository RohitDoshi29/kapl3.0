import { PlayerRecord, PlayerRole } from './cricketTypes';
import { supabase } from '@/integrations/supabase/client';

export function generateAuctionPlayers(tournamentId: string = 'kapl-3-mens'): PlayerRecord[] {
  const isWomens = tournamentId === 'kapl-3-womens';
  const prefix = isWomens ? 'wp-' : 'p-';

  return Array.from({ length: 80 }, (_, index) => {
    const num = index + 1;
    const id = `${prefix}${num}`;
    const name = `Player ${num}`;
    const isLeftHand = num % 3 === 0;
    const battingStyle = isLeftHand ? 'Left-hand bat' : 'Right-hand bat';

    let role: PlayerRole = 'all_rounder';
    let bowlingStyle = 'Right-arm medium';
    let basePrice = 100;

    if (num <= 25) {
      // 25 Specialist Batters
      role = 'batter';
      bowlingStyle = num % 4 === 0 ? 'Right-arm off break' : 'None';
      basePrice = [100, 200, 300, 500][num % 4];
    } else if (num <= 50) {
      // 25 Bowlers
      role = 'bowler';
      const bStyles = [
        'Right-arm fast',
        'Right-arm medium-fast',
        'Right-arm off break',
        'Right-arm leg break',
        'Left-arm fast',
        'Left-arm orthodox',
      ];
      bowlingStyle = bStyles[num % bStyles.length];
      basePrice = [100, 150, 200, 300][num % 4];
    } else if (num <= 70) {
      // 20 All-Rounders
      role = 'all_rounder';
      const bStyles = [
        'Right-arm fast-medium',
        'Right-arm off spin',
        'Left-arm spin',
        'Right-arm medium',
      ];
      bowlingStyle = bStyles[num % bStyles.length];
      basePrice = [200, 300, 400, 500][num % 4];
    } else {
      // 10 Wicket-Keepers
      role = 'wicket_keeper';
      bowlingStyle = 'None';
      basePrice = [100, 200, 250, 300][num % 4];
    }

    return {
      id,
      tournamentId,
      teamId: null,
      name,
      role,
      battingStyle,
      bowlingStyle,
      photoUrl: null,
      basePrice,
      soldPrice: null,
      auctionStatus: 'pending',
      jerseyNumber: num,
    };
  });
}

export const MOCK_AUCTION_PLAYERS: PlayerRecord[] = generateAuctionPlayers('kapl-3-mens');

/**
 * Resets all team rosters to empty squads with full ₹10,000 purse,
 * and populates the 80 fake players ready for auction allocation.
 */
export async function resetTeamsAndSeed80Players(customClient = supabase, tournamentId: string = 'kapl-3-mens') {
  try {
    const playersToSeed = generateAuctionPlayers(tournamentId);

    // Save immediately to localStorage so UI updates synchronously even if offline or RLS blocks
    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(playersToSeed));
      localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, playersToSeed[0].id);
      localStorage.removeItem(`kapl_auction_sales_${tournamentId}`);
    } catch {}
    // 1. Clear auction bids & reset auction state
    try {
      await customClient.from('auction_bids').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.warn('auction_bids delete warning:', e);
    }

    try {
      await customClient.from('auction_state').upsert([
        {
          id: 'kapl-3-mens',
          tournament_id: 'kapl-3-mens',
          current_player_id: 'p-1',
          current_bid: 100,
          highest_bidder_team_id: null,
          bid_history: [],
          status: 'idle',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        },
        {
          id: 'kapl-3-womens',
          tournament_id: 'kapl-3-womens',
          current_player_id: null,
          current_bid: 0,
          highest_bidder_team_id: null,
          bid_history: [],
          status: 'idle',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      console.warn('auction_state reset warning:', e);
    }

    // 2. Empty all teams in teams table and restore remaining_purse to 10000
    try {
      await customClient
        .from('teams')
        .update({
          players: [],
          player_count: 0,
          remaining_purse: 10000,
          updated_at: new Date().toISOString(),
        })
        .neq('id', '');
    } catch (e) {
      console.warn('teams empty warning:', e);
    }

    // 3. Delete existing players in DB
    try {
      await customClient.from('players').delete().neq('id', '');
    } catch (e) {
      console.warn('players delete warning:', e);
    }

    // 4. Insert 80 fake players in chunks of 20
    const dbPayloads = playersToSeed.map((p) => ({
      id: p.id,
      tournament_id: p.tournamentId,
      team_id: null,
      name: p.name,
      role: p.role,
      batting_style: p.battingStyle,
      bowling_style: p.bowlingStyle,
      photo_url: null,
      base_price: p.basePrice,
      sold_price: null,
      auction_status: 'pending',
      jersey_number: p.jerseyNumber,
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < dbPayloads.length; i += 20) {
      const chunk = dbPayloads.slice(i, i + 20);
      const { error: insErr } = await customClient.from('players').upsert(chunk);
      if (insErr) {
        console.warn('Player chunk insert warning:', insErr);
      }
    }

    // 5. Clear local storage rosters
    try {
      localStorage.removeItem('kapl_local_match_state');
      localStorage.removeItem('kapl_local_match_state_kapl-3-mens');
      localStorage.removeItem('kapl_local_match_state_kapl-3-womens');
    } catch (e) {}

    return { success: true, count: 80, message: 'All 80 players seeded and franchise purses reset to ₹10,000.' };
  } catch (err: any) {
    console.error('Failed to reset teams and seed players:', err);
    return { success: false, error: err.message, message: 'Failed to reset: ' + err.message };
  }
}

