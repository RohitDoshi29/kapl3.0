import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlayerRecord, Team, AuctionState, BidHistoryEntry, PlayerRole, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from '@/lib/cricketTypes';
import { MOCK_AUCTION_PLAYERS, generateAuctionPlayers, resetTeamsAndSeed80Players } from '@/lib/mockPlayersData';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { playAuctionGavel } from '@/lib/soundEffects';
import { triggerQuickBurst } from '@/lib/confetti';

export const AUCTION_CATEGORIES: { id: PlayerRole | 'all'; label: string; icon: string; description: string }[] = [
  { id: 'all', label: 'All Players', icon: '🌟', description: 'Complete roster of 80 tournament players' },
  { id: 'batter', label: 'Batters', icon: '🏏', description: 'Top and middle order run-scorers (25)' },
  { id: 'bowler', label: 'Bowlers', icon: '⚡', description: 'Pace spearheads and strike spinners (25)' },
  { id: 'all_rounder', label: 'All-Rounders', icon: '👑', description: 'Impact players with both bat and ball (20)' },
  { id: 'wicket_keeper', label: 'Wicket-Keepers', icon: '🧤', description: 'Specialist keepers and finishers (10)' },
];

export interface AuctionSaleLog {
  id: string;
  playerId: string;
  playerName: string;
  playerRole: PlayerRole;
  teamId?: string | null;
  teamName?: string | null;
  teamLogo?: string | null;
  teamColor?: string | null;
  amount: number;
  status: 'sold' | 'unsold';
  timestamp: number;
}

let sharedAuctionBroadcastChannel: any = null;
let sharedAuctionTabSync: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    sharedAuctionTabSync = new BroadcastChannel('kapl_auction_tab_sync');
  } catch {}
}

export function useAuction(initialTournamentId: string = 'kapl-3-mens') {
  const { user, userRole, isAdmin } = useAuth();
  const [tournamentId, setTournamentId] = useState<string>(initialTournamentId);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);

  // Initialize pool immediately with 80 clean players so UI is NEVER empty or stuck loading
  const [playerPool, setPlayerPool] = useState<PlayerRecord[]>(() => {
    try {
      const raw = localStorage.getItem(`kapl_auction_players_${initialTournamentId}`);
      if (raw) {
        const parsed: PlayerRecord[] = JSON.parse(raw);
        const hasLegacy = parsed.some((p: any) => /^[ab][1-4]-/.test(p.id));
        const allSameRole = parsed.length > 1 && parsed.every((p: any) => p.role === 'all_rounder' && p.auctionStatus === 'sold');
        if (parsed.length === 80 && !hasLegacy && !allSameRole) {
          return parsed;
        }
      }
    } catch {}
    const fresh = generateAuctionPlayers(initialTournamentId);
    try {
      localStorage.setItem(`kapl_auction_players_${initialTournamentId}`, JSON.stringify(fresh));
    } catch {}
    return fresh;
  });

  const [currentPlayer, setCurrentPlayer] = useState<PlayerRecord | null>(() => {
    try {
      const activeId = localStorage.getItem(`kapl_auction_active_player_${initialTournamentId}`);
      const raw = localStorage.getItem(`kapl_auction_players_${initialTournamentId}`);
      if (raw) {
        const parsed: PlayerRecord[] = JSON.parse(raw);
        if (activeId) {
          const found = parsed.find((p: any) => p.id === activeId);
          if (found && !/^[ab][1-4]-/.test(found.id)) return found;
        }
        if (parsed.length > 0 && !/^[ab][1-4]-/.test(parsed[0].id)) return parsed[0];
      }
    } catch {}
    return generateAuctionPlayers(initialTournamentId)[0];
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    const fallback = initialTournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
    try {
      const raw = localStorage.getItem(`kapl_auction_teams_${initialTournamentId}`);
      if (raw) {
        const parsed: Team[] = JSON.parse(raw);
        if (parsed && parsed.length > 0) return parsed;
      }
    } catch {}
    return fallback;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlayerRole | 'all'>('all');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [salesHistory, setSalesHistory] = useState<AuctionSaleLog[]>(() => {
    try {
      const raw = localStorage.getItem(`kapl_auction_sales_${initialTournamentId}`);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
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

      let mappedPlayers: PlayerRecord[] = (allPlayers || []).map((p: any) => ({
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

      // Check if DB holds legacy pre-auction records (a1-p1 to b4-p10) or is uninitialized or all sold all-rounders
      const hasLegacyDbData =
        mappedPlayers.length === 0 ||
        mappedPlayers.some((p) => /^[ab][1-4]-/.test(p.id)) ||
        (mappedPlayers.length > 1 && mappedPlayers.every((p) => p.role === 'all_rounder' && p.auctionStatus === 'sold'));

      if (hasLegacyDbData) {
        let cachedPlayers: PlayerRecord[] = [];
        try {
          const raw = localStorage.getItem(`kapl_auction_players_${tournamentId}`);
          if (raw) cachedPlayers = JSON.parse(raw);
        } catch {}

        const cachedIsClean =
          cachedPlayers.length === 80 &&
          !cachedPlayers.some((p) => /^[ab][1-4]-/.test(p.id)) &&
          !cachedPlayers.every((p) => p.role === 'all_rounder');

        if (cachedIsClean) {
          mappedPlayers = cachedPlayers;
        } else {
          mappedPlayers = generateAuctionPlayers(tournamentId);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
          } catch {}
        }
      } else {
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
        } catch {}
      }

      setPlayerPool(mappedPlayers);

      // Check local cached active player ID if DB is empty or points to legacy player
      let targetActivePlayerId = activePlayerId;
      if (!targetActivePlayerId || /^[ab][1-4]-/.test(targetActivePlayerId) || !mappedPlayers.some((p) => p.id === targetActivePlayerId)) {
        try {
          const localActive = localStorage.getItem(`kapl_auction_active_player_${tournamentId}`);
          if (localActive && mappedPlayers.some((p) => p.id === localActive)) {
            targetActivePlayerId = localActive;
          } else {
            targetActivePlayerId = mappedPlayers[0]?.id || null;
          }
        } catch {
          targetActivePlayerId = mappedPlayers[0]?.id || null;
        }
      }

      // Set current player from DB/cache or default to first player
      if (targetActivePlayerId) {
        const found = mappedPlayers.find((p) => p.id === targetActivePlayerId);
        if (found) {
          setCurrentPlayer(found);
        } else if (mappedPlayers.length > 0) {
          setCurrentPlayer(mappedPlayers[0]);
        }
      } else if (!currentPlayer && mappedPlayers.length > 0) {
        setCurrentPlayer(mappedPlayers[0]);
      }

      // 3. Fetch teams for this tournament
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('name');

      if (teamsError) throw teamsError;

      let metaMap: Record<string, any> = {};
      try {
        metaMap = JSON.parse(localStorage.getItem('kapl_team_metadata') || '{}');
      } catch {}

      let cachedTeamsMap: Record<string, Team> = {};
      try {
        const raw = localStorage.getItem(`kapl_auction_teams_${tournamentId}`);
        if (raw) {
          const parsed: Team[] = JSON.parse(raw);
          parsed.forEach(t => { cachedTeamsMap[t.id] = t; });
        }
      } catch {}

      if (teamsData && teamsData.length > 0) {
        const mappedTeams: Team[] = teamsData.map((t: any) => {
          const meta = metaMap[t.id] || {};
          const localCached = cachedTeamsMap[t.id];

          // Determine sold players for this team from the auction player pool
          const soldFromPool = mappedPlayers.filter(
            (p) => p.teamId === t.id && p.auctionStatus === 'sold'
          );

          // Squad derivation:
          let teamPlayers: any[] = [];
          if (localCached && Array.isArray(localCached.players) && !localCached.players.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
            teamPlayers = localCached.players;
          } else if (soldFromPool.length > 0) {
            teamPlayers = soldFromPool.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photoUrl,
              role: p.role,
              soldPrice: p.soldPrice || p.basePrice || 0,
            }));
          } else if (Array.isArray(t.players) && t.players.length > 0 && !t.players.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
            teamPlayers = t.players;
          }

          const initialPurse = Number(t.initial_purse || 10000);
          // Ground truth calculation: remaining purse = initialPurse - sum of sold prices in squad
          const totalSpent = teamPlayers.reduce((sum: number, p: any) => sum + (Number(p.soldPrice) || 0), 0);
          const currentPurse = Math.max(0, initialPurse - totalSpent);

          return {
            id: t.id,
            name: t.name,
            group: t.group as any,
            logo: t.logo,
            primaryColor: t.primary_color,
            players: teamPlayers,
            playerCount: teamPlayers.length,
            tournamentId: t.tournament_id,
            initialPurse: initialPurse,
            remainingPurse: currentPurse,
            maxSquadSize: t.max_squad_size || 10,
            captainUserId: t.captain_user_id || meta.captainUserId || null,
            ownerName: meta.ownerName || t.owner_name || undefined,
            ownerEmail: meta.ownerEmail || t.owner_email || null,
            ownerUserId: meta.ownerUserId || t.owner_user_id || null,
            captainName: meta.captainName || t.captain_name || undefined,
            captainPlayerId: meta.captainPlayerId || t.captain_player_id || null,
          };
        });

        setTeams(mappedTeams);
        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(mappedTeams));
        } catch {}
      } else {
        const fallback = tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
        const mappedTeams: Team[] = fallback.map((t) => {
          const meta = metaMap[t.id] || {};
          const localCached = cachedTeamsMap[t.id];
          const soldFromPool = mappedPlayers.filter(
            (p) => p.teamId === t.id && p.auctionStatus === 'sold'
          );

          let teamPlayers: any[] = [];
          if (localCached && Array.isArray(localCached.players) && !localCached.players.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
            teamPlayers = localCached.players;
          } else if (soldFromPool.length > 0) {
            teamPlayers = soldFromPool.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photoUrl,
              role: p.role,
              soldPrice: p.soldPrice || p.basePrice || 0,
            }));
          }

          const initialPurse = t.initialPurse || 10000;
          const totalSpent = teamPlayers.reduce((sum: number, p: any) => sum + (Number(p.soldPrice) || 0), 0);
          const currentPurse = Math.max(0, initialPurse - totalSpent);

          return {
            ...t,
            initialPurse,
            remainingPurse: currentPurse,
            players: teamPlayers,
            playerCount: teamPlayers.length,
            ownerName: meta.ownerName || t.ownerName,
            ownerEmail: meta.ownerEmail || t.ownerEmail,
            ownerUserId: meta.ownerUserId || t.ownerUserId,
            captainName: meta.captainName || t.captainName,
            captainPlayerId: meta.captainPlayerId || t.captainPlayerId,
          };
        });
        setTeams(mappedTeams);
        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(mappedTeams));
        } catch {}
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

  // Realtime Subscriptions with sub-50ms Broadcast Sync across all viewers and devices
  useEffect(() => {
    const handleSyncPayload = (envelope: any) => {
      if (!envelope || (envelope.tournamentId && envelope.tournamentId !== tournamentId)) return;
      const { event, log, targetPlayerId, player, newRemainingPurse } = envelope;

      if (event === 'auction_spotlight' && player) {
        setCurrentPlayer(player);
        setSelectedCategory(player.role || 'all_rounder');
        try {
          localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, player.id);
        } catch {}
      } else if (event === 'auction_sold' && log) {
        setSalesHistory(prev => {
          const updated = [log, ...prev.filter(l => l.playerId !== log.playerId)];
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated.slice(0, 100)));
          } catch {}
          return updated;
        });

        setPlayerPool(prev => {
          const updated = prev.map(p => p.id === log.playerId ? { ...p, auctionStatus: 'sold' as const, teamId: log.teamId, soldPrice: log.amount } : p);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setTeams(prev => {
          const updated = prev.map(t => {
            if (t.id === log.teamId) {
              const currentSquad = t.players || [];
              const updatedSquad = [
                ...currentSquad.filter((p: any) => p.id !== log.playerId),
                { id: log.playerId, name: log.playerName, role: log.playerRole, soldPrice: log.amount }
              ];
              const updatedPurse = newRemainingPurse ?? Math.max(0, (t.remainingPurse ?? 10000) - log.amount);
              return {
                ...t,
                remainingPurse: updatedPurse,
                players: updatedSquad,
                playerCount: updatedSquad.length,
              };
            }
            return t;
          });
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setCurrentPlayer(prev => prev && prev.id === log.playerId ? { ...prev, auctionStatus: 'sold', teamId: log.teamId, soldPrice: log.amount } : prev);
        playAuctionGavel();
        triggerQuickBurst();
        toast.success(`🎉 SOLD! ${log.playerName} bought by ${log.teamName} for ₹${log.amount.toLocaleString('en-IN')}!`, { duration: 6000 });
      } else if (event === 'auction_unsold') {
        setPlayerPool(prev => {
          const updated = prev.map(p => p.id === targetPlayerId ? { ...p, auctionStatus: 'unsold' as const, teamId: null, soldPrice: null } : p);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setCurrentPlayer(prev => prev && prev.id === targetPlayerId ? { ...prev, auctionStatus: 'unsold', teamId: null, soldPrice: null } : prev);
        toast.warning(`❌ Player marked UNSOLD.`);
      } else if (event === 'auction_revert') {
        setPlayerPool(prev => {
          const updated = prev.map(p => p.id === targetPlayerId ? { ...p, auctionStatus: 'pending' as const, teamId: null, soldPrice: null } : p);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
        setCurrentPlayer(prev => prev && prev.id === targetPlayerId ? { ...prev, auctionStatus: 'pending', teamId: null, soldPrice: null } : prev);

        setTeams(prev => {
          const updated = prev.map(t => {
            const hadPlayer = (t.players || []).some((p: any) => p.id === targetPlayerId);
            if (hadPlayer) {
              const refundedPlayer = (t.players || []).find((p: any) => p.id === targetPlayerId);
              const remainingSquad = (t.players || []).filter((p: any) => p.id !== targetPlayerId);
              return {
                ...t,
                remainingPurse: (t.remainingPurse ?? 10000) + (refundedPlayer?.soldPrice || 0),
                players: remainingSquad,
                playerCount: remainingSquad.length,
              };
            }
            return t;
          });
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setSalesHistory(prev => {
          const updated = prev.filter(l => l.playerId !== targetPlayerId);
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        toast.info(`Player status reverted to Pending.`);
      } else if (event === 'auction_reset') {
        const resetTeams: Team[] = envelope.teams || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t: Team) => ({
          ...t,
          initialPurse: 10000,
          remainingPurse: 10000,
          players: [],
          playerCount: 0,
        }));
        const resetPlayers: PlayerRecord[] = envelope.players || generateAuctionPlayers(tournamentId);
        const resetCurrent = envelope.currentPlayer || resetPlayers[0];

        setTeams(resetTeams);
        setPlayerPool(resetPlayers);
        setCurrentPlayer(resetCurrent);
        setSelectedCategory('all');
        setSalesHistory([]);

        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(resetTeams));
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(resetPlayers));
          localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, resetCurrent.id);
          localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
        } catch {}

        toast.info('🔄 Auction Season has been reset by Admin. All franchise purses restored to ₹10,000.');
      }
    };

    const channel = supabase
      .channel(`auction-room-${tournamentId}`, {
        config: { broadcast: { self: true } },
      })
      .on('broadcast', { event: 'auction_sync' }, (msg) => {
        if (msg?.payload) handleSyncPayload(msg.payload);
      })
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

    sharedAuctionBroadcastChannel = channel;

    // Cross-tab broadcast channel listener
    const handleTabMessage = (e: MessageEvent) => {
      if (e.data) handleSyncPayload(e.data);
    };
    if (sharedAuctionTabSync) {
      sharedAuctionTabSync.addEventListener('message', handleTabMessage);
    }

    // Local DOM event listener
    const handleLocalEvent = (e: any) => {
      if (e.detail) handleSyncPayload(e.detail);
    };
    window.addEventListener('kapl-auction-local-update', handleLocalEvent);

    return () => {
      supabase.removeChannel(channel);
      sharedAuctionBroadcastChannel = null;
      if (sharedAuctionTabSync) {
        sharedAuctionTabSync.removeEventListener('message', handleTabMessage);
      }
      window.removeEventListener('kapl-auction-local-update', handleLocalEvent);
    };
  }, [tournamentId, fetchData]);

  // Broadcast helper
  const broadcastAuctionEvent = (event: string, data: any) => {
    const envelope = { event, ...data, tournamentId };
    if (sharedAuctionBroadcastChannel) {
      sharedAuctionBroadcastChannel
        .send({ type: 'broadcast', event: 'auction_sync', payload: envelope })
        .catch(() => {});
    }
    try {
      sharedAuctionTabSync?.postMessage(envelope);
    } catch {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kapl-auction-local-update', { detail: envelope }));
    }
  };

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
      localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, player.id);
    } catch {}

    // Broadcast immediately so every viewer's screen updates in <30ms
    broadcastAuctionEvent('auction_spotlight', {
      player,
      playerId: player.id,
    });

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

      toast.info(`⚡ Now in Spotlight: ${player.name} (${player.role.replace('_', ' ')})`);
    } catch (err: any) {
      console.warn('DB update for spotlight player:', err);
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

    const newRemainingPurse = Math.max(0, targetTeam.remainingPurse - soldPrice);
    const updatedPlayersJson = [
      ...(targetTeam.players || []).filter((p) => p.id !== targetPlayer.id),
      { id: targetPlayer.id, name: targetPlayer.name, photo: targetPlayer.photoUrl, role: targetPlayer.role, soldPrice },
    ];

    // Optimistic local state update
    const updatedPool = playerPool.map(p => p.id === targetPlayer.id ? { ...p, auctionStatus: 'sold' as const, teamId: targetTeam.id, soldPrice } : p);
    const updatedTeams = teams.map(t => t.id === targetTeam.id ? { ...t, remainingPurse: newRemainingPurse, players: updatedPlayersJson, playerCount: updatedPlayersJson.length } : t);
    
    setPlayerPool(updatedPool);
    setTeams(updatedTeams);
    setCurrentPlayer(prev => prev && prev.id === targetPlayer.id ? { ...prev, auctionStatus: 'sold', teamId: targetTeam.id, soldPrice } : prev);

    // Persist to localStorage
    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updatedTeams));
    } catch {}

    const saleLog: AuctionSaleLog = {
      id: `${targetPlayer.id}-${Date.now()}`,
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerRole: targetPlayer.role,
      teamId: targetTeam.id,
      teamName: targetTeam.name,
      teamLogo: targetTeam.logo,
      teamColor: targetTeam.primaryColor,
      amount: soldPrice,
      status: 'sold',
      timestamp: Date.now(),
    };

    setSalesHistory(prev => {
      const updated = [saleLog, ...prev.filter(l => l.playerId !== targetPlayer.id)];
      try {
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated.slice(0, 100)));
      } catch {}
      return updated;
    });

    // Broadcast across all devices & anonymous viewers
    broadcastAuctionEvent('auction_sold', {
      log: saleLog,
      targetPlayerId: targetPlayer.id,
      targetTeamId: targetTeam.id,
      soldPrice,
      newRemainingPurse,
    });

    toast.success(`🎉 SOLD! ${targetPlayer.name} assigned to ${targetTeam.name} for ₹${soldPrice.toLocaleString('en-IN')}!`);
    playAuctionGavel();
    triggerQuickBurst();

    // Auto-advance to next pending player after 1 second
    const remainingPending = updatedPool.filter((p) => (selectedCategory === 'all' || p.role === selectedCategory) && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
    if (remainingPending.length > 0) {
      setTimeout(() => spotlightPlayer(remainingPending[0]), 1000);
    }

    // Persist to Supabase in background
    try {
      await supabase
        .from('players')
        .update({
          team_id: targetTeam.id,
          sold_price: soldPrice,
          auction_status: 'sold',
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPlayer.id);

      await supabase
        .from('teams')
        .update({
          remaining_purse: newRemainingPurse,
          players: updatedPlayersJson as any,
          player_count: updatedPlayersJson.length,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetTeam.id);

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

      await supabase.from('auction_bids').insert({
        tournament_id: tournamentId,
        player_id: targetPlayer.id,
        team_id: targetTeam.id,
        bid_amount: soldPrice,
        bidder_user_id: user?.id,
      });
    } catch (err: any) {
      console.warn('DB persistence notice for sold player:', err.message);
    }
  };

  // ADMIN ACTION: Decide UNSOLD
  const adminDecideUnsold = async (playerId: string) => {
    const targetPlayer = playerPool.find((p) => p.id === playerId) || currentPlayer;
    if (!targetPlayer) return;

    const updatedPool = playerPool.map(p => p.id === targetPlayer.id ? { ...p, auctionStatus: 'unsold' as const, teamId: null, soldPrice: null } : p);
    setPlayerPool(updatedPool);
    setCurrentPlayer(prev => prev && prev.id === targetPlayer.id ? { ...prev, auctionStatus: 'unsold', teamId: null, soldPrice: null } : prev);

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
    } catch {}

    const unsoldLog: AuctionSaleLog = {
      id: `${targetPlayer.id}-${Date.now()}`,
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      playerRole: targetPlayer.role,
      amount: targetPlayer.basePrice,
      status: 'unsold',
      timestamp: Date.now(),
    };

    setSalesHistory(prev => {
      const updated = [unsoldLog, ...prev.filter(l => l.playerId !== targetPlayer.id)];
      try {
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(updated.slice(0, 100)));
      } catch {}
      return updated;
    });

    broadcastAuctionEvent('auction_unsold', {
      targetPlayerId: targetPlayer.id,
      log: unsoldLog,
    });

    toast.warning(`❌ ${targetPlayer.name} marked UNSOLD.`);

    // Auto-advance to next pending player
    const remainingPending = updatedPool.filter((p) => (selectedCategory === 'all' || p.role === selectedCategory) && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
    if (remainingPending.length > 0) {
      setTimeout(() => spotlightPlayer(remainingPending[0]), 1000);
    }

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
    } catch (err: any) {
      console.warn('DB persistence notice for unsold player:', err.message);
    }
  };

  // ADMIN ACTION: Revert / Re-auction a player
  const revertPlayerStatus = async (playerId: string) => {
    const targetPlayer = playerPool.find((p) => p.id === playerId);
    if (!targetPlayer) return;

    const previousTeamId = targetPlayer.teamId;
    const previousPrice = targetPlayer.soldPrice || 0;

    const updatedPool = playerPool.map(p => p.id === targetPlayer.id ? { ...p, auctionStatus: 'pending' as const, teamId: null, soldPrice: null } : p);
    let updatedTeams = [...teams];

    if (previousTeamId) {
      updatedTeams = teams.map(t => {
        if (t.id === previousTeamId) {
          const refundedPurse = t.remainingPurse + previousPrice;
          const remainingSquad = (t.players || []).filter(p => p.id !== targetPlayer.id);
          return { ...t, remainingPurse: refundedPurse, players: remainingSquad, playerCount: remainingSquad.length };
        }
        return t;
      });
    }

    setPlayerPool(updatedPool);
    setTeams(updatedTeams);
    setCurrentPlayer(prev => prev && prev.id === targetPlayer.id ? { ...prev, auctionStatus: 'pending', teamId: null, soldPrice: null } : prev);
    setSalesHistory(prev => prev.filter(l => l.playerId !== targetPlayer.id));

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
      localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updatedTeams));
      localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(salesHistory.filter(l => l.playerId !== targetPlayer.id)));
    } catch {}

    broadcastAuctionEvent('auction_revert', {
      targetPlayerId: targetPlayer.id,
    });

    toast.info(`${targetPlayer.name} has been reset to Pending.`);

    try {
      if (previousTeamId) {
        const team = teams.find((t) => t.id === previousTeamId);
        if (team) {
          const refundedPurse = team.remainingPurse + previousPrice;
          const remainingSquad = (team.players || []).filter((p) => p.id !== targetPlayer.id);
          await supabase
            .from('teams')
            .update({
              remaining_purse: refundedPurse,
              players: remainingSquad as any,
              player_count: remainingSquad.length,
            })
            .eq('id', team.id);
        }
      }

      await supabase
        .from('players')
        .update({
          auction_status: 'pending',
          team_id: null,
          sold_price: null,
        })
        .eq('id', targetPlayer.id);
    } catch (err: any) {
      console.warn('DB persistence notice for revert player:', err.message);
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
    salesHistory,
    initializeAuctionData: async () => {
      const freshPlayers = generateAuctionPlayers(tournamentId);
      const baseTeams = teams.length > 0 ? teams : (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS);
      const freshTeams: Team[] = baseTeams.map((t) => ({
        ...t,
        initialPurse: 10000,
        remainingPurse: 10000,
        players: [],
        playerCount: 0,
      }));

      setPlayerPool(freshPlayers);
      setTeams(freshTeams);
      setCurrentPlayer(freshPlayers[0]);
      setSelectedCategory('all');
      setSalesHistory([]);

      try {
        localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(freshPlayers));
        localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(freshTeams));
        localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, freshPlayers[0].id);
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
      } catch {}

      broadcastAuctionEvent('auction_reset', {
        teams: freshTeams,
        players: freshPlayers,
        currentPlayer: freshPlayers[0],
      });

      try {
        await resetTeamsAndSeed80Players(supabase, tournamentId);
      } catch (err: any) {
        console.warn('DB reset background notice:', err);
      }

      return {
        success: true,
        count: freshPlayers.length,
        message: 'Season reset successfully! All franchise purses restored to ₹10,000 with 80 players ready.',
      };
    },
    refreshData: fetchData,
  };
}
