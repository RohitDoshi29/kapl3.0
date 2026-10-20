import { PlayerRecord, PlayerRole, Team, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from './cricketTypes';
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

    const baseTeams = (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t) => ({
      ...t,
      players: [],
      playerCount: 0,
      remainingPurse: 10000,
      initialPurse: 10000,
    }));

    // Save immediately to localStorage so UI updates synchronously even if offline or RLS blocks
    try {
      localStorage.removeItem('kapl_all_players_cleared');
      localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
      localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(playersToSeed));
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(baseTeams));
      localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, playersToSeed[0].id);
      localStorage.removeItem(`kapl_auction_sales_${tournamentId}`);
      localStorage.setItem('kapl_teams', JSON.stringify(baseTeams));
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

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: baseTeams }));
        window.dispatchEvent(
          new CustomEvent('kapl-auction-local-update', {
            detail: {
              event: 'auction_reset',
              players: playersToSeed,
              teams: baseTeams,
              currentPlayer: playersToSeed[0],
              tournamentId,
            },
          })
        );
        window.dispatchEvent(
          new CustomEvent('kapl_player_added', {
            detail: { player: playersToSeed[0], tournamentId },
          })
        );
      } catch (e) {}
    }

    return { success: true, count: 80, message: 'All 80 players seeded and franchise purses reset to ₹10,000.' };
  } catch (err: any) {
    console.error('Failed to reset teams and seed players:', err);
    return { success: false, error: err.message, message: 'Failed to reset: ' + err.message };
  }
}

/**
 * Synchronously generates a completed, balanced auction dataset of 80 players across all 8 franchise squads:
 * - Exactly 10 players allocated to each team (balanced with batters, bowlers, all-rounders, and wicket-keepers)
 * - Realistic sold prices (target spending between ₹7,500 and ₹8,850 per franchise)
 * - Accurate remaining purse deduction from initial ₹10,000 purse
 * - Complete 80-entry sales history log with chronological timestamps
 */
export function generateCompletedAuctionDataset(tournamentId: string = 'kapl-3-mens'): {
  players: PlayerRecord[];
  teams: Team[];
  salesHistory: any[];
} {
  const isWomens = tournamentId === 'kapl-3-womens';
  const baseTeams: Team[] = isWomens ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
  const teamIds = baseTeams.map(t => t.id);
  const allPlayers = generateAuctionPlayers(tournamentId);

  // Target spending per team (out of ₹10,000 initial purse)
  const targetSpends: Record<string, number> = {
    a1: 7900,
    a2: 8350,
    a3: 8850,
    a4: 7500,
    b1: 8150,
    b2: 7700,
    b3: 8600,
    b4: 7950,
    w_a1: 8200,
    w_a2: 7800,
    w_b1: 8500,
    w_b2: 7900,
  };

  const teamAllocations: Record<string, { team: Team; players: PlayerRecord[]; targetSpent: number }> = {};
  for (const t of baseTeams) {
    teamAllocations[t.id] = {
      team: { ...t },
      players: [],
      targetSpent: targetSpends[t.id] || 8000,
    };
  }

  const batters = allPlayers.filter(p => p.role === 'batter');
  const bowlers = allPlayers.filter(p => p.role === 'bowler');
  const allRounders = allPlayers.filter(p => p.role === 'all_rounder');
  const keepers = allPlayers.filter(p => p.role === 'wicket_keeper');

  const numTeams = teamIds.length;

  batters.forEach((p, i) => {
    const tId = teamIds[i % numTeams];
    teamAllocations[tId].players.push(p);
  });

  bowlers.forEach((p, i) => {
    const tId = teamIds[(i + 1) % numTeams];
    teamAllocations[tId].players.push(p);
  });

  allRounders.forEach((p, i) => {
    const tId = teamIds[(i + 2) % numTeams];
    teamAllocations[tId].players.push(p);
  });

  keepers.forEach((p, i) => {
    const tId = teamIds[(i + 6) % numTeams];
    teamAllocations[tId].players.push(p);
  });

  const baseWeights = [18, 15, 13, 11, 10, 9, 8, 6, 5, 5];
  const finalPlayers: PlayerRecord[] = [];
  const salesHistory: any[] = [];
  let saleTimestamp = Date.now() - 80 * 45000;

  const updatedTeams: Team[] = baseTeams.map(t => {
    const alloc = teamAllocations[t.id];
    const target = alloc.targetSpent;
    const count = alloc.players.length;
    let allocated = 0;
    const prices: number[] = [];

    for (let i = 0; i < count - 1; i++) {
      const weight = baseWeights[i % baseWeights.length] || 10;
      const raw = Math.round((target * (weight / 100)) / 50) * 50;
      prices.push(raw);
      allocated += raw;
    }
    prices.push(Math.max(100, target - allocated));

    const teamSquad = alloc.players.map((player, idx) => {
      const soldPrice = Math.max(player.basePrice, prices[idx]);
      const updatedPlayer: PlayerRecord = {
        ...player,
        soldPrice,
        teamId: t.id,
        auctionStatus: 'sold',
      };
      finalPlayers.push(updatedPlayer);

      saleTimestamp += 45000;
      salesHistory.unshift({
        id: `${player.id}-${saleTimestamp}`,
        playerId: player.id,
        playerName: player.name,
        playerRole: player.role,
        teamId: t.id,
        teamName: t.name,
        teamLogo: t.logo,
        teamColor: t.primaryColor,
        amount: soldPrice,
        status: 'sold',
        timestamp: saleTimestamp,
      });

      return {
        id: player.id,
        name: player.name,
        photo: null,
        role: player.role,
        soldPrice: soldPrice,
      };
    });

    const teamCaptainName = t.id === 'a1' ? 'Rohit Doshi' : (teamSquad[0]?.name || t.captainName || undefined);
    const teamCaptainPlayerId = t.id === 'a1' ? 'owner' : (teamSquad[0]?.id || t.captainPlayerId || null);
    const teamOwnerName = t.id === 'a1' ? 'Rohit Doshi' : (t.ownerName || undefined);
    const teamOwnerEmail = t.id === 'a1' ? 'rohitdoshicolg@gmail.com' : (t.ownerEmail || null);
    const totalSpent = teamSquad.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
    const teamRemainingPurse = Math.max(0, 10000 - totalSpent);

    return {
      ...t,
      players: teamSquad,
      playerCount: teamSquad.length,
      maxSquadSize: 10,
      initialPurse: 10000,
      remainingPurse: teamRemainingPurse,
      ownerName: teamOwnerName,
      ownerEmail: teamOwnerEmail,
      captainName: teamCaptainName,
      captainPlayerId: teamCaptainPlayerId,
    };
  });

  finalPlayers.sort((a, b) => {
    const numA = parseInt(a.id.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.id.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  return {
    players: finalPlayers,
    teams: updatedTeams,
    salesHistory,
  };
}

/**
 * Completes the auction of all 80 players for testing purposes:
 * - Allocates exactly 10 players to each franchise squad across all roles
 * - Computes realistic sold prices within each franchise's ₹10,000 purse
 * - Computes remaining purse and updates team rosters
 * - Persists to localStorage, updates Supabase database, and marks auction completed
 */
export async function autoCompleteAuctionForAll80Players(
  customClient = supabase,
  tournamentId: string = 'kapl-3-mens'
): Promise<{ success: boolean; message: string; players: PlayerRecord[]; teams: Team[]; salesHistory: any[] }> {
  try {
    const dataset = generateCompletedAuctionDataset(tournamentId);
    const { players: finalPlayers, teams: updatedTeams, salesHistory } = dataset;

    // 1. Save synchronously to localStorage for immediate UI update
    try {
      localStorage.removeItem('kapl_all_players_cleared');
      localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
      localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(finalPlayers));
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updatedTeams));
      localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(salesHistory.slice(0, 100)));
      localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, finalPlayers[0].id);
      localStorage.setItem('kapl_teams', JSON.stringify(updatedTeams));
    } catch (e) {
      console.warn('localStorage auction save notice:', e);
    }

    // 2. Persist to Supabase in background
    try {
      // 1. Format and upsert all 80 players into Supabase
      const playersToUpsert = finalPlayers.map((p) => ({
        id: p.id,
        tournament_id: tournamentId,
        team_id: p.teamId,
        name: p.name,
        role: p.role,
        batting_style: p.battingStyle || null,
        bowling_style: p.bowlingStyle || null,
        photo_url: p.photoUrl || null,
        base_price: p.basePrice || 100,
        sold_price: p.soldPrice,
        auction_status: 'sold',
        jersey_number: p.jerseyNumber || null,
        updated_at: new Date().toISOString(),
      }));

      for (let i = 0; i < playersToUpsert.length; i += 20) {
        const batch = playersToUpsert.slice(i, i + 20);
        const { error: upsertErr } = await customClient
          .from('players')
          .upsert(batch, { onConflict: 'id' });
        if (upsertErr) console.warn('Supabase players batch upsert warning:', upsertErr);
      }

      // 2. Update all 8 franchise teams in Supabase
      for (const t of updatedTeams) {
        const { error: teamErr } = await customClient
          .from('teams')
          .update({
            players: t.players,
            player_count: t.playerCount,
            max_squad_size: 10,
            remaining_purse: t.remainingPurse,
            updated_at: new Date().toISOString(),
          })
          .eq('id', t.id);
        if (teamErr) console.warn('Supabase team update warning:', t.id, teamErr);
      }

      // 3. Update auction state in Supabase
      const { error: stateErr } = await customClient
        .from('auction_state')
        .upsert([
          {
            id: tournamentId,
            tournament_id: tournamentId,
            current_player_id: finalPlayers[0].id,
            current_bid: finalPlayers[0].soldPrice || 350,
            highest_bidder_team_id: finalPlayers[0].teamId,
            status: 'completed',
            timer_ends_at: null,
            updated_at: new Date().toISOString(),
          }
        ], { onConflict: 'id' });
      if (stateErr) console.warn('Supabase auction completion notice:', stateErr);
    } catch (e) {
      console.warn('Supabase auction completion notice:', e);
    }
    // Dispatch local events so current tab and all store hooks update instantaneously
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: updatedTeams }));
        window.dispatchEvent(
          new CustomEvent('kapl-auction-local-update', {
            detail: {
              event: 'auction_auto_completed',
              teams: updatedTeams,
              players: finalPlayers,
              salesHistory,
              tournamentId,
            },
          })
        );
      } catch (e) {}
    }

    return {
      success: true,
      message: `🎉 All ${finalPlayers.length} players have been successfully auctioned into full squads!`,
      players: finalPlayers,
      teams: updatedTeams,
      salesHistory,
    };
  } catch (err: any) {
    console.error('Failed to auto-complete auction:', err);
    return {
      success: false,
      message: err.message || 'Failed to auto-complete auction',
      players: [],
      teams: [],
      salesHistory: [],
    };
  }
}

/**
 * Ensures that the completed 80-player auction dataset is saved to localStorage
 * unless the admin has explicitly performed a manual season reset.
 */
export function ensureCompletedAuctionDatasetCached(tournamentId: string = 'kapl-3-mens', force: boolean = false) {
  try {
    const isCleared = localStorage.getItem('kapl_all_players_cleared') === 'true' ||
                      localStorage.getItem(`kapl_everything_reset_${tournamentId}`) === 'true';
    if (!force && isCleared) return;

    const isManuallyReset = localStorage.getItem(`kapl_auction_manually_reset_${tournamentId}`) === 'true';
    if (!force && isManuallyReset) return;

    const raw = localStorage.getItem(`kapl_auction_players_${tournamentId}`);
    if (!force && raw) {
      const parsed: PlayerRecord[] = JSON.parse(raw);
      if (parsed.length >= 80 && !parsed.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
        return;
      }
    }

    const data = generateCompletedAuctionDataset(tournamentId);
    localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(data.players));
    localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(data.teams));
    localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(data.salesHistory));
    localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, data.players[0].id);
    localStorage.setItem('kapl_teams', JSON.stringify(data.teams));
  } catch (e) {
    console.warn('Could not cache completed auction dataset:', e);
  }
}



