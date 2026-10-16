import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlayerRecord, Team, AuctionState, BidHistoryEntry, PlayerRole, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from '@/lib/cricketTypes';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { playAuctionGavel } from '@/lib/soundEffects';
import { triggerQuickBurst } from '@/lib/confetti';

export const AUCTION_CATEGORIES: { id: PlayerRole; label: string; icon: string; description: string }[] = [
  { id: 'all_rounder', label: 'All-Rounders', icon: '👑', description: 'Impact players with both bat and ball' },
  { id: 'batter', label: 'Batters', icon: '🏏', description: 'Top and middle order run-scorers' },
  { id: 'bowler', label: 'Bowlers', icon: '⚡', description: 'Pace spearheads and strike spinners' },
  { id: 'wicket_keeper', label: 'Wicket-Keepers', icon: '🧤', description: 'Specialist keepers and finishers' },
];

export function useAuction(initialTournamentId: string = 'kapl-3-mens') {
  const { user, userRole, isAdmin } = useAuth();
  const [tournamentId, setTournamentId] = useState<string>(initialTournamentId);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<PlayerRecord | null>(null);
  const [playerPool, setPlayerPool] = useState<PlayerRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<PlayerRole>('all_rounder');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTournamentId(initialTournamentId);
  }, [initialTournamentId]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch auction state for this tournament
      const { data: stateData, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('tournament_id', tournamentId)
        .maybeSingle();

      if (stateError) throw stateError;

      let activePlayerId: string | null = null;

      if (stateData) {
        const state: AuctionState = {
          id: stateData.id,
          tournamentId: stateData.tournament_id,
          currentPlayerId: stateData.current_player_id,
          currentBid: Number(stateData.current_bid || 0),
          highestBidderTeamId: stateData.highest_bidder_team_id,
          bidHistory: (stateData.bid_history as unknown as BidHistoryEntry[]) || [],
          status: stateData.status as any,
          timerEndsAt: stateData.timer_ends_at,
          updatedAt: stateData.updated_at,
        };
        setAuctionState(state);
        activePlayerId = state.currentPlayerId || null;
      }

      // 2. Fetch all players for this tournament
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (playersError) throw playersError;

      const mappedPlayers: PlayerRecord[] = (allPlayers || []).map((p: any) => ({
        id: p.id,
        tournamentId: p.tournament_id || tournamentId,
        teamId: p.team_id,
        name: p.name,
        role: (p.role as PlayerRole) || 'all_rounder',
        battingStyle: p.batting_style || undefined,
        bowlingStyle: p.bowling_style || undefined,
        photoUrl: p.photo_url,
        basePrice: Number(p.base_price || 100),
        soldPrice: p.sold_price ? Number(p.sold_price) : null,
        auctionStatus: p.auction_status || 'pending',
        jerseyNumber: p.jersey_number,
        mobileNumber: p.mobile_number,
      }));

      setPlayerPool(mappedPlayers);

      // Set current player from DB or pick first pending player in selected category if none active
      if (activePlayerId) {
        const found = mappedPlayers.find((p) => p.id === activePlayerId);
        if (found) setCurrentPlayer(found);
      } else if (!currentPlayer && mappedPlayers.length > 0) {
        // default to first player
        setCurrentPlayer(mappedPlayers[0]);
      }

      // 3. Fetch teams for this tournament
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (teamsError) throw teamsError;

      if (teamsData && teamsData.length > 0) {
        setTeams(
          teamsData.map((t: any) => ({
            id: t.id,
            name: t.name,
            group: t.group as any,
            logo: t.logo,
            primaryColor: t.primary_color,
            players: (t.players as any[]) || [],
            playerCount: t.player_count || 10,
            tournamentId: t.tournament_id,
            initialPurse: Number(t.initial_purse || 10000),
            remainingPurse: Number(t.remaining_purse || 10000),
            maxSquadSize: t.max_squad_size || 10,
            captainUserId: t.captain_user_id,
          }))
        );
      } else {
        const fallback = tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
        setTeams(fallback);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching auction data:', err);
      setIsLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime Subscriptions
  useEffect(() => {
    const channel = supabase
      .channel(`auction-room-${tournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_state', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams', filter: `tournament_id=eq.${tournamentId}` },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, fetchData]);

  // Countdown timer handler
  useEffect(() => {
    if (!auctionState?.timerEndsAt || auctionState.status === 'idle' || auctionState.status === 'sold' || auctionState.status === 'unsold') {
      setTimeLeft(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimer = () => {
      const end = new Date(auctionState.timerEndsAt!).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((end - now) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auctionState?.timerEndsAt, auctionState?.status]);

  // Spotlight a specific player on the auction podium (broadcast to all users)
  const spotlightPlayer = async (player: PlayerRecord) => {
    setCurrentPlayer(player);
    setSelectedCategory(player.role);

    try {
      const stateId = auctionState?.id || tournamentId;
      await supabase
        .from('auction_state')
        .upsert({
          id: stateId,
          tournament_id: tournamentId,
          current_player_id: player.id,
          current_bid: player.soldPrice || player.basePrice,
          highest_bidder_team_id: player.teamId || null,
          status: player.auctionStatus === 'sold' ? 'sold' : player.auctionStatus === 'unsold' ? 'unsold' : 'idle',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        });

      toast.info(`Spotlight: ${player.name} (${player.role.replace('_', ' ')})`);
    } catch (err: any) {
      console.error('Error spotlighting player:', err);
    }
  };

  // Navigate to Next Player in Category
  const nextPlayer = (direction: 'next' | 'prev' = 'next') => {
    const categoryPlayers = playerPool.filter((p) => p.role === selectedCategory);
    if (categoryPlayers.length === 0) return;

    const currentIndex = categoryPlayers.findIndex((p) => p.id === currentPlayer?.id);
    let targetIndex = 0;

    if (direction === 'next') {
      targetIndex = currentIndex >= 0 && currentIndex < categoryPlayers.length - 1 ? currentIndex + 1 : 0;
    } else {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : categoryPlayers.length - 1;
    }

    const targetPlayer = categoryPlayers[targetIndex];
    if (targetPlayer) {
      spotlightPlayer(targetPlayer);
    }
  };

  // ADMIN ACTION: Decide SOLD (Select Team & Price)
  const adminDecideSold = async (playerId: string, teamId: string, soldPrice: number) => {
    const targetPlayer = playerPool.find((p) => p.id === playerId) || currentPlayer;
    if (!targetPlayer) {
      toast.error('No player selected');
      return;
    }

    const targetTeam = teams.find((t) => t.id === teamId);
    if (!targetTeam) {
      toast.error('Please select a valid team');
      return;
    }

    if (targetTeam.remainingPurse < soldPrice) {
      toast.warning(`${targetTeam.name} has only ₹${targetTeam.remainingPurse} remaining in purse! Proceeding as admin decision.`);
    }

    try {
      // 1. Update player status in Supabase
      const { error: playerErr } = await supabase
        .from('players')
        .update({
          team_id: targetTeam.id,
          sold_price: soldPrice,
          auction_status: 'sold',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPlayer.id);

      if (playerErr) throw playerErr;

      // 2. Deduct team purse & append to team roster
      const newRemainingPurse = Math.max(0, targetTeam.remainingPurse - soldPrice);
      const updatedPlayersJson = [
        ...(targetTeam.players || []).filter((p) => p.id !== targetPlayer.id),
        { id: targetPlayer.id, name: targetPlayer.name, photo: targetPlayer.photoUrl },
      ];

      const { error: teamErr } = await supabase
        .from('teams')
        .update({
          remaining_purse: newRemainingPurse,
          players: updatedPlayersJson as any,
          player_count: updatedPlayersJson.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetTeam.id);

      if (teamErr) throw teamErr;

      // 3. Update auction_state
      const stateId = auctionState?.id || tournamentId;
      await supabase
        .from('auction_state')
        .upsert({
          id: stateId,
          tournament_id: tournamentId,
          current_player_id: targetPlayer.id,
          current_bid: soldPrice,
          highest_bidder_team_id: targetTeam.id,
          status: 'sold',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        });

      // 4. Log bid
      await supabase.from('auction_bids').insert({
        tournament_id: tournamentId,
        player_id: targetPlayer.id,
        team_id: targetTeam.id,
        bid_amount: soldPrice,
        bidder_user_id: user?.id,
      });

      toast.success(`🎉 SOLD! ${targetPlayer.name} assigned to ${targetTeam.name} for ₹${soldPrice.toLocaleString('en-IN')}!`);
      playAuctionGavel();
      triggerQuickBurst();

      // Auto-advance to next pending player in category
      const remainingPending = playerPool.filter((p) => p.role === selectedCategory && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
      if (remainingPending.length > 0) {
        setTimeout(() => spotlightPlayer(remainingPending[0]), 800);
      } else {
        await fetchData();
      }
    } catch (err: any) {
      toast.error(`Failed to record sale: ${err.message}`);
    }
  };

  // ADMIN ACTION: Decide UNSOLD
  const adminDecideUnsold = async (playerId: string) => {
    const targetPlayer = playerPool.find((p) => p.id === playerId) || currentPlayer;
    if (!targetPlayer) return;

    try {
      await supabase
        .from('players')
        .update({
          auction_status: 'unsold',
          team_id: null,
          sold_price: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPlayer.id);

      const stateId = auctionState?.id || tournamentId;
      await supabase
        .from('auction_state')
        .upsert({
          id: stateId,
          tournament_id: tournamentId,
          current_player_id: targetPlayer.id,
          status: 'unsold',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        });

      toast.info(`${targetPlayer.name} marked UNSOLD.`);

      // Auto-advance to next pending player in category
      const remainingPending = playerPool.filter((p) => p.role === selectedCategory && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
      if (remainingPending.length > 0) {
        setTimeout(() => spotlightPlayer(remainingPending[0]), 800);
      } else {
        await fetchData();
      }
    } catch (err: any) {
      toast.error(`Error marking unsold: ${err.message}`);
    }
  };

  // ADMIN ACTION: Revert / Re-auction a player
  const revertPlayerStatus = async (playerId: string) => {
    const targetPlayer = playerPool.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    try {
      // If player was sold, refund team purse and remove from roster
      if (targetPlayer.auctionStatus === 'sold' && targetPlayer.teamId && targetPlayer.soldPrice) {
        const team = teams.find((t) => t.id === targetPlayer.teamId);
        if (team) {
          const refundedPurse = team.remainingPurse + targetPlayer.soldPrice;
          const updatedPlayers = (team.players || []).filter((p) => p.id !== targetPlayer.id);

          await supabase
            .from('teams')
            .update({
              remaining_purse: refundedPurse,
              players: updatedPlayers as any,
              player_count: updatedPlayers.length,
            })
            .eq('id', team.id);
        }
      }

      // Reset player
      await supabase
        .from('players')
        .update({
          auction_status: 'pending',
          team_id: null,
          sold_price: null,
        })
        .eq('id', targetPlayer.id);

      toast.success(`${targetPlayer.name} has been reset to Pending.`);
      await fetchData();
    } catch (err: any) {
      toast.error(`Failed to revert player: ${err.message}`);
    }
  };

  return {
    tournamentId,
    setTournamentId,
    auctionState,
    currentPlayer,
    setCurrentPlayer,
    playerPool,
    teams,
    isLoading,
    isAdmin,
    selectedCategory,
    setSelectedCategory,
    spotlightPlayer,
    nextPlayer,
    adminDecideSold,
    adminDecideUnsold,
    revertPlayerStatus,
    refreshData: fetchData,
  };
}
