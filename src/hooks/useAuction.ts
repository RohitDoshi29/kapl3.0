import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PlayerRecord, Team, AuctionState, BidHistoryEntry, PlayerRole, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from '@/lib/cricketTypes';
import { generateAuctionPlayers, resetTeamsAndSeed80Players, autoCompleteAuctionForAll80Players } from '@/lib/mockPlayersData';
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
let sharedSharedTabSync: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    sharedAuctionTabSync = new BroadcastChannel('kapl_auction_tab_sync');
    sharedSharedTabSync = new BroadcastChannel('kapl-shared-tab-channel');
  } catch {}
}

export function useAuction(initialTournamentId: string = 'kapl-3-mens') {
  const { user, userRole, isAdmin } = useAuth();
  const [tournamentId, setTournamentId] = useState<string>(initialTournamentId);
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);

  // Initialize pool: loads clean cached players or empty array
  const [playerPool, setPlayerPool] = useState<PlayerRecord[]>(() => {
    try {
      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${initialTournamentId}`) === 'true'
      );
      let regList: PlayerRecord[] = [];
      try {
        const regRaw = localStorage.getItem('kapl_registered_players');
        if (regRaw) {
          regList = JSON.parse(regRaw);
        }
      } catch {}

      if (isCleared && regList.length === 0) {
        return [];
      }

      let baseList: PlayerRecord[] = [];
      const isReset = localStorage.getItem(`kapl_auction_manually_reset_${initialTournamentId}`) === 'true';
      const raw = localStorage.getItem(`kapl_auction_players_${initialTournamentId}`);
      if (raw) {
        const parsed: PlayerRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed) && !parsed.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
          baseList = parsed;
        }
      } else if (isReset) {
        baseList = generateAuctionPlayers(initialTournamentId);
      }

      // Merge registered players immediately
      if (regList.length > 0) {
        regList.forEach((reg) => {
          if (!reg.tournamentId || reg.tournamentId === initialTournamentId) {
            const idx = baseList.findIndex((p) => p.id === reg.id || (p.userId && reg.userId && p.userId === reg.userId));
            if (idx >= 0) {
              baseList[idx] = { ...baseList[idx], ...reg };
            } else {
              baseList.push(reg);
            }
          }
        });
      }

      return baseList;
    } catch {}
    return [];
  });

  const [currentPlayer, setCurrentPlayer] = useState<PlayerRecord | null>(() => {
    try {
      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${initialTournamentId}`) === 'true'
      );
      let regList: PlayerRecord[] = [];
      try {
        const regRaw = localStorage.getItem('kapl_registered_players');
        if (regRaw) {
          regList = JSON.parse(regRaw);
        }
      } catch {}

      if (isCleared && regList.length === 0) {
        return null;
      }

      const activeId = localStorage.getItem(`kapl_auction_active_player_${initialTournamentId}`);
      const raw = localStorage.getItem(`kapl_auction_players_${initialTournamentId}`);
      let list: PlayerRecord[] = [];
      if (raw) {
        const parsed: PlayerRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((p: any) => p && !/^[ab][1-4]-/.test(p.id));
        }
      }
      if (regList.length > 0) {
        regList.forEach((reg) => {
          if (!reg.tournamentId || reg.tournamentId === initialTournamentId) {
            const idx = list.findIndex((p) => p.id === reg.id || (p.userId && reg.userId && p.userId === reg.userId));
            if (idx >= 0) list[idx] = { ...list[idx], ...reg };
            else list.push(reg);
          }
        });
      }

      if (activeId) {
        const found = list.find((p: any) => p.id === activeId);
        if (found) return found;
      }
      if (list.length > 0) {
        return list.find((p) => p.auctionStatus === 'pending') || list[0];
      }
    } catch {}
    return null;
  });

  const [teams, setTeams] = useState<Team[]>(() => {
    const fallback = initialTournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS;
    try {
      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${initialTournamentId}`) === 'true'
      );
      const isReset = localStorage.getItem(`kapl_auction_manually_reset_${initialTournamentId}`) === 'true';
      if (isCleared || isReset) {
        return fallback.map(t => ({ ...t, initialPurse: 10000, remainingPurse: 10000, players: [], playerCount: 0 }));
      }
      const raw = localStorage.getItem(`kapl_auction_teams_${initialTournamentId}`);
      if (raw) {
        const parsed: Team[] = JSON.parse(raw);
        if (parsed && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return fallback.map(t => ({ ...t, initialPurse: 10000, remainingPurse: 10000, players: [], playerCount: 0 }));
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlayerRole | 'all'>('all');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [salesHistory, setSalesHistory] = useState<AuctionSaleLog[]>(() => {
    try {
      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${initialTournamentId}`) === 'true'
      );
      const isReset = localStorage.getItem(`kapl_auction_manually_reset_${initialTournamentId}`) === 'true';
      if (isCleared || isReset) return [];
      const raw = localStorage.getItem(`kapl_auction_sales_${initialTournamentId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance celebration countdown state & refs
  const [autoAdvanceCountdown, setAutoAdvanceCountdown] = useState<number | null>(null);
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState<boolean>(true);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cancelAutoAdvance = useCallback(() => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
    setAutoAdvanceCountdown(null);
  }, []);

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

      // 2. Fetch all players for this tournament (public safe columns)
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('id, name, photo_url, role, batting_style, bowling_style, tournament_id, team_id, jersey_number, base_price, sold_price, auction_status')
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
        mobileNumber: (p as any).mobile_number || null,
      }));

      // Strip any legacy dummy template players (a1-p1 to b4-p10) from remote DB
      mappedPlayers = mappedPlayers.filter((p) => p && !/^[ab][1-4]-/.test(p.id));

      const isCleared = typeof window !== 'undefined' && (
        localStorage.getItem('kapl_all_players_cleared') === 'true' ||
        localStorage.getItem(`kapl_everything_reset_${tournamentId}`) === 'true'
      );

      let regList: PlayerRecord[] = [];
      try {
        const regRaw = localStorage.getItem('kapl_registered_players');
        if (regRaw) {
          regList = JSON.parse(regRaw);
        }
      } catch {}

      if (mappedPlayers.length > 0 || regList.length > 0) {
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
        } catch {}
      } else if (isCleared) {
        setPlayerPool([]);
        setCurrentPlayer(null);
        setAuctionState({
          id: tournamentId,
          tournamentId,
          currentPlayerId: null,
          currentBid: 100,
          highestBidderTeamId: null,
          bidHistory: [],
          status: 'idle',
          timerEndsAt: null,
          updatedAt: new Date().toISOString(),
        });
        setTeams((tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).map((t) => ({
          ...t,
          initialPurse: 10000,
          remainingPurse: 10000,
          players: [],
          playerCount: 0,
        })));
        setSalesHistory([]);
        setIsLoading(false);
        return;
      }

      if (mappedPlayers.length === 0) {
        let cachedPlayers: PlayerRecord[] = [];
        try {
          const raw = localStorage.getItem(`kapl_auction_players_${tournamentId}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              cachedPlayers = parsed.filter((p: any) => p && !/^[ab][1-4]-/.test(p.id));
            }
          }
        } catch {}

        const isReset = localStorage.getItem(`kapl_auction_manually_reset_${tournamentId}`) === 'true';

        if (cachedPlayers.length > 0) {
          mappedPlayers = cachedPlayers;
        } else if (isReset) {
          mappedPlayers = generateAuctionPlayers(tournamentId);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
          } catch {}
        } else {
          mappedPlayers = [];
        }
      } else {
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
        } catch {}
      }

      // Merge user-registered players from kapl_registered_players into mappedPlayers
      try {
        const regRaw = localStorage.getItem('kapl_registered_players');
        if (regRaw) {
          const registeredList: PlayerRecord[] = JSON.parse(regRaw);
          registeredList.forEach((reg) => {
            if (!reg.tournamentId || reg.tournamentId === tournamentId) {
              const existingIdx = mappedPlayers.findIndex((p) => p.id === reg.id || (p.userId && reg.userId && p.userId === reg.userId));
              if (existingIdx >= 0) {
                mappedPlayers[existingIdx] = { ...mappedPlayers[existingIdx], ...reg };
              } else {
                mappedPlayers.push(reg);
              }
            }
          });
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(mappedPlayers));
        }
      } catch {}

      if (mappedPlayers.length >= 80 && mappedPlayers.every((p) => p.auctionStatus === 'sold')) {
        setAuctionState((prev) => ({
          id: tournamentId,
          tournamentId,
          currentPlayerId: mappedPlayers[mappedPlayers.length - 1]?.id || null,
          currentBid: mappedPlayers[mappedPlayers.length - 1]?.soldPrice || 350,
          highestBidderTeamId: mappedPlayers[mappedPlayers.length - 1]?.teamId || null,
          bidHistory: [],
          timerEndsAt: null,
          updatedAt: new Date().toISOString(),
          ...(prev || {}),
          status: 'completed',
        }));
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
            targetActivePlayerId = mappedPlayers[mappedPlayers.length - 1]?.id || mappedPlayers[0]?.id || null;
          }
        } catch {
          targetActivePlayerId = mappedPlayers[mappedPlayers.length - 1]?.id || mappedPlayers[0]?.id || null;
        }
      }

      // Set current player from DB/cache or default to player
      if (targetActivePlayerId) {
        const found = mappedPlayers.find((p) => p.id === targetActivePlayerId);
        if (found) {
          setCurrentPlayer(found);
        } else if (mappedPlayers.length > 0) {
          setCurrentPlayer(mappedPlayers[mappedPlayers.length - 1]);
        }
      } else if (!currentPlayer && mappedPlayers.length > 0) {
        setCurrentPlayer(mappedPlayers[mappedPlayers.length - 1]);
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

      const cachedTeamsMap: Record<string, Team> = {};
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

          // Squad derivation: DB / Real-time pool takes strict precedence over local cache
          let teamPlayers: any[] = [];
          if (soldFromPool.length > 0) {
            teamPlayers = soldFromPool.map((p) => ({
              id: p.id,
              name: p.name,
              photo: p.photoUrl,
              role: p.role,
              soldPrice: p.soldPrice || p.basePrice || 0,
            }));
          } else if (Array.isArray(t.players) && t.players.length > 0 && !t.players.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
            teamPlayers = t.players;
          } else if (localCached && Array.isArray(localCached.players) && localCached.players.length > 0 && !localCached.players.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
            teamPlayers = localCached.players;
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
            ownerName: meta.ownerName || t.owner_name || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === t.id)?.ownerName || (t.id === 'a1' ? 'Rohit Doshi' : undefined),
            ownerEmail: meta.ownerEmail || t.owner_email || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === t.id)?.ownerEmail || (t.id === 'a1' ? 'rohitdoshicolg@gmail.com' : null),
            ownerUserId: meta.ownerUserId || t.owner_user_id || null,
            captainName: meta.captainName || t.captain_name || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === t.id)?.captainName || (t.id === 'a1' ? 'Rohit Doshi' : (teamPlayers[0]?.name || undefined)),
            captainPlayerId: meta.captainPlayerId || t.captain_player_id || (tournamentId === 'kapl-3-womens' ? DEFAULT_WOMENS_TEAMS : DEFAULT_TEAMS).find(d => d.id === t.id)?.captainPlayerId || (t.id === 'a1' ? 'owner' : (teamPlayers[0]?.id || null)),
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
          if (localCached && Array.isArray(localCached.players) && localCached.players.length > 0 && !localCached.players.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
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
            ownerName: meta.ownerName || t.ownerName || (t.id === 'a1' ? 'Rohit Doshi' : undefined),
            ownerEmail: meta.ownerEmail || t.ownerEmail || (t.id === 'a1' ? 'rohitdoshicolg@gmail.com' : null),
            ownerUserId: meta.ownerUserId || t.ownerUserId,
            captainName: meta.captainName || t.captainName || (t.id === 'a1' ? 'Rohit Doshi' : (teamPlayers[0]?.name || undefined)),
            captainPlayerId: meta.captainPlayerId || t.captainPlayerId || (t.id === 'a1' ? 'owner' : (teamPlayers[0]?.id || null)),
          };
        });
        setTeams(mappedTeams);
        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(mappedTeams));
        } catch {}
      }

      // 4. Load sales history from DB with fallback to localStorage
      try {
        const { data: bidsData } = await supabase
          .from('auction_bids')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('created_at', { ascending: false });

        if (bidsData && bidsData.length > 0) {
          const loadedHistory: AuctionSaleLog[] = bidsData.map((b) => {
            const player = mappedPlayers.find((p) => p.id === b.player_id);
            const team = (teamsData || []).find((t: any) => t.id === b.team_id);
            return {
              id: b.id,
              playerId: b.player_id,
              playerName: player?.name || 'Player',
              playerRole: (player?.role as any) || 'all_rounder',
              teamId: b.team_id,
              teamName: team?.name || 'Team',
              teamLogo: team?.logo || null,
              teamColor: team?.primary_color || '0 0% 50%',
              amount: Number(b.bid_amount),
              status: 'sold',
              timestamp: new Date(b.created_at).getTime(),
            };
          });
          setSalesHistory(loadedHistory);
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(loadedHistory));
          } catch {}
        } else {
          // Reconstruct from sold players in DB
          const soldFromDb = mappedPlayers.filter((p) => p.auctionStatus === 'sold' && p.teamId);
          if (soldFromDb.length > 0) {
            const reconstructed: AuctionSaleLog[] = soldFromDb.map((p) => {
              const team = (teamsData || []).find((t: any) => t.id === p.teamId);
              return {
                id: `sale_${p.id}`,
                playerId: p.id,
                playerName: p.name,
                playerRole: p.role,
                teamId: p.teamId!,
                teamName: team?.name || 'Team',
                teamLogo: team?.logo || null,
                teamColor: team?.primary_color || '0 0% 50%',
                amount: p.soldPrice || p.basePrice || 100,
                status: 'sold',
                timestamp: Date.now(),
              };
            });
            setSalesHistory(reconstructed);
          } else {
            let loadedSales: AuctionSaleLog[] = [];
            try {
              const rawSales = localStorage.getItem(`kapl_auction_sales_${tournamentId}`);
              if (rawSales) loadedSales = JSON.parse(rawSales);
            } catch {}
            setSalesHistory(loadedSales);
          }
        }
      } catch (histErr) {
        console.warn('Error loading auction history from DB, falling back to local cache:', histErr);
        let loadedSales: AuctionSaleLog[] = [];
        try {
          const rawSales = localStorage.getItem(`kapl_auction_sales_${tournamentId}`);
          if (rawSales) loadedSales = JSON.parse(rawSales);
        } catch {}
        setSalesHistory(loadedSales);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Error fetching auction data:', err);
      setIsLoading(false);
    }
  }, [tournamentId, currentPlayer]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Network recovery: automatically re-synchronize when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      toast.success('🌐 Connection restored! Re-synchronizing live auction...');
      fetchData();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
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
            localStorage.setItem('kapl_teams', JSON.stringify(updated));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: updated }));
            }
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
            localStorage.setItem('kapl_teams', JSON.stringify(updated));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: updated }));
            }
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
        const resetPlayers: PlayerRecord[] = Array.isArray(envelope.players) ? envelope.players : generateAuctionPlayers(tournamentId);
        const resetCurrent = envelope.currentPlayer || resetPlayers[0] || null;

        setTeams(resetTeams);
        setPlayerPool(resetPlayers);
        setCurrentPlayer(resetCurrent);
        setSelectedCategory('all');
        setSalesHistory([]);

        try {
          localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(resetTeams));
          localStorage.setItem('kapl_teams', JSON.stringify(resetTeams));
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(resetPlayers));
          if (resetCurrent) {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, resetCurrent.id);
          } else {
            localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
          }
          localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: resetTeams }));
          }
        } catch {}

        toast.info('🔄 Auction Season has been reset by Admin. All franchise purses restored to ₹10,000.');
      } else if (event === 'auction_unsold_round_start') {
        setPlayerPool((prev) =>
          prev.map((p) => (p.auctionStatus === 'unsold' ? { ...p, auctionStatus: 'pending' as const } : p))
        );
        if (envelope.firstPlayer) {
          setCurrentPlayer(envelope.firstPlayer);
          setSelectedCategory(envelope.firstPlayer.role || 'all_rounder');
        }
        setSalesHistory((prev) => prev.filter((l) => l.status !== 'unsold'));
        toast.info('⚡ Accelerated Round Started! All unsold players are back on the podium.');
      } else if (event === 'auction_auto_completed') {
        const lastPlayer = envelope.players?.[envelope.players.length - 1];
        if (envelope.teams) {
          setTeams(envelope.teams);
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(envelope.teams));
            localStorage.setItem('kapl_teams', JSON.stringify(envelope.teams));
          } catch {}
        }
        if (envelope.players) {
          setPlayerPool(envelope.players);
          if (lastPlayer) {
            setCurrentPlayer(lastPlayer);
          }
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(envelope.players));
            if (lastPlayer) {
              localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, lastPlayer.id);
            }
          } catch {}
        }
        if (envelope.salesHistory) {
          setSalesHistory(envelope.salesHistory);
          try {
            localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(envelope.salesHistory));
          } catch {}
        }
        try {
          localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);
        } catch {}

        setAuctionState({
          id: tournamentId,
          tournamentId,
          currentPlayerId: lastPlayer?.id || null,
          currentBid: lastPlayer?.soldPrice || 350,
          highestBidderTeamId: lastPlayer?.teamId || null,
          bidHistory: [],
          status: 'completed',
          timerEndsAt: null,
          updatedAt: new Date().toISOString(),
        });

        if (typeof window !== 'undefined') {
          if (envelope.teams) {
            window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: envelope.teams }));
          }
          window.dispatchEvent(new CustomEvent('kapl-auction-local-update', { detail: envelope }));
        }

        playAuctionGavel();
        triggerQuickBurst();
        toast.success('🏆 Auction Completed! All 80 players drafted into full franchise squads!');
      } else if (event === 'auction_player_added' && envelope.player) {
        const addedPlayer: PlayerRecord = envelope.player;
        try {
          localStorage.removeItem('kapl_all_players_cleared');
          localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
        } catch {}

        setPlayerPool((prev) => {
          const exists = prev.some((p) => p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId));
          const updated = exists
            ? prev.map((p) => (p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId)) ? { ...p, ...addedPlayer } : p)
            : [...prev, addedPlayer];
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        // Spotlight player on stage ready for live bidding if stage is empty or player matches
        setCurrentPlayer((current) => {
          if (!current || current.auctionStatus === 'sold' || current.auctionStatus === 'unsold' || current.id === addedPlayer.id) {
            try {
              localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, addedPlayer.id);
            } catch {}
            return addedPlayer;
          }
          return current;
        });

        toast.info(`🏏 New candidate registered: ${addedPlayer.name}! Added to live auction queue.`);
      } else if (event === 'auction_player_removed' && envelope.playerId) {
        const removedId = envelope.playerId;
        setPlayerPool((prev) => {
          const updated = prev.filter((p) => p.id !== removedId);
          try {
            localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });

        setCurrentPlayer((current) => {
          if (current?.id === removedId) {
            try {
              localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
            } catch {}
            return null;
          }
          return current;
        });

        setTeams((prevTeams) => {
          const updated = prevTeams.map((t) => {
            const hasPlayer = (t.players || []).some((p) => p.id === removedId);
            if (!hasPlayer) return t;
            const targetPlayer = (t.players || []).find((p) => p.id === removedId);
            const refund = targetPlayer?.soldPrice || 0;
            return {
              ...t,
              players: (t.players || []).filter((p) => p.id !== removedId),
              playerCount: Math.max(0, (t.playerCount || 1) - 1),
              remainingPurse: (t.remainingPurse ?? 10000) + refund,
            };
          });
          try {
            localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
            localStorage.setItem('kapl_teams', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        toast.info('Candidate removed from auction queue.');
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
    if (sharedSharedTabSync) {
      sharedSharedTabSync.addEventListener('message', handleTabMessage);
    }

    // Local DOM event listener
    const handleLocalEvent = (e: any) => {
      if (e.detail) handleSyncPayload(e.detail);
    };
    window.addEventListener('kapl-auction-local-update', handleLocalEvent);

    // Local window event for newly registered player or reset
    const handlePlayerAdded = (e: any) => {
      const { player: addedPlayer, tournamentId: targetTournamentId } = e.detail || {};
      if (addedPlayer === null) {
        setPlayerPool([]);
        setCurrentPlayer(null);
        return;
      }
      if (!addedPlayer || (targetTournamentId && targetTournamentId !== tournamentId)) return;
      try {
        localStorage.removeItem('kapl_all_players_cleared');
        localStorage.removeItem(`kapl_everything_reset_${tournamentId}`);
      } catch {}

      setPlayerPool((prev) => {
        const exists = prev.some((p) => p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId));
        const updated = exists
          ? prev.map((p) => (p.id === addedPlayer.id || (p.userId && addedPlayer.userId && p.userId === addedPlayer.userId)) ? { ...p, ...addedPlayer } : p)
          : [...prev, addedPlayer];
        try {
          localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
        } catch {}
        return updated;
      });

      setCurrentPlayer((current) => {
        if (!current || current.auctionStatus === 'sold' || current.auctionStatus === 'unsold' || current.id === addedPlayer.id) {
          try {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, addedPlayer.id);
          } catch {}
          return addedPlayer;
        }
        return current;
      });
    };
    window.addEventListener('kapl_player_added', handlePlayerAdded);

    const handlePlayerRemoved = (e: any) => {
      const { playerId, tournamentId: targetTournamentId } = e.detail || {};
      if (playerId && (!targetTournamentId || targetTournamentId === tournamentId || targetTournamentId === 'all')) {
        handleSyncPayload({ event: 'auction_player_removed', playerId, tournamentId });
      }
    };
    window.addEventListener('kapl_player_removed', handlePlayerRemoved);

    return () => {
      supabase.removeChannel(channel);
      sharedAuctionBroadcastChannel = null;
      if (sharedAuctionTabSync) {
        sharedAuctionTabSync.removeEventListener('message', handleTabMessage);
      }
      if (sharedSharedTabSync) {
        sharedSharedTabSync.removeEventListener('message', handleTabMessage);
      }
      window.removeEventListener('kapl-auction-local-update', handleLocalEvent);
      window.removeEventListener('kapl_player_added', handlePlayerAdded);
      window.removeEventListener('kapl_player_removed', handlePlayerRemoved);
    };
  }, [tournamentId, fetchData]);

  // Broadcast helper
  const broadcastAuctionEvent = useCallback((event: string, data: any) => {
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
  }, [tournamentId]);

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
    cancelAutoAdvance();
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
      const { error } = await supabase
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

      if (error) {
        console.error('Failed to update spotlight in auction_state:', error);
        toast.error('Spotlight sync notice: ' + error.message);
      } else {
        toast.info(`⚡ Now in Spotlight: ${player.name} (${player.role.replace('_', ' ')})`);
      }
    } catch (err: any) {
      console.error('DB update exception for spotlight player:', err);
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
    const targetPlayer = (playerPool || []).find((p) => p.id === playerId) || currentPlayer;
    if (!targetPlayer) {
      toast.error('No player selected');
      return;
    }

    if (targetPlayer.auctionStatus === 'sold') {
      toast.warning(`⚠️ ${targetPlayer.name} is already marked SOLD! Please revert the status first if you wish to re-auction.`);
      return;
    }

    const targetTeam = (teams || []).find((t) => t.id === teamId);
    if (!targetTeam) {
      toast.error('Please select a valid franchise team');
      return;
    }

    const currentSquadCount = (targetTeam.players || []).filter((p: any) => p.id !== targetPlayer.id).length;
    const maxSquad = targetTeam.maxSquadSize || 10;
    if (currentSquadCount >= maxSquad) {
      toast.error(`⛔ ${targetTeam.name} has already reached the maximum squad limit of ${maxSquad} players!`);
      return;
    }

    const availablePurse = targetTeam.remainingPurse !== undefined && targetTeam.remainingPurse !== null
      ? targetTeam.remainingPurse
      : (targetTeam.initialPurse || 10000);

    if (soldPrice > availablePurse) {
      toast.error(`⛔ Insufficient purse! ${targetTeam.name} only has ₹${availablePurse.toLocaleString('en-IN')} available.`);
      return;
    }

    // 1. Persist to Supabase atomically via RPC first (ensures DB confirmation before UI changes)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('sell_player_to_team', {
        p_tournament_id: tournamentId,
        p_player_id: targetPlayer.id,
        p_team_id: targetTeam.id,
        p_sold_price: soldPrice,
        p_bidder_user_id: user?.id || null,
      });

      if (rpcError) {
        console.error('Auction sale failed via RPC:', rpcError);
        toast.error(`❌ Auction sale failed: ${rpcError.message}`);
        return;
      }
    } catch (rpcErr: any) {
      console.error('Auction sale RPC invocation error:', rpcErr);
      toast.error(`❌ Auction sale failed: ${rpcErr?.message || 'Network error'}`);
      return;
    }

    // 2. Database confirmed sale atomically. Now update UI state, localStorage, and broadcast.
    const newRemainingPurse = Math.max(0, availablePurse - soldPrice);
    const updatedPlayersJson = [
      ...(targetTeam.players || []).filter((p) => p.id !== targetPlayer.id),
      { id: targetPlayer.id, name: targetPlayer.name, photo: targetPlayer.photoUrl, role: targetPlayer.role, soldPrice },
    ];

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

    // Auto-advance to next pending player with 3.5s celebration window
    const remainingPending = updatedPool.filter((p) => (selectedCategory === 'all' || p.role === selectedCategory) && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
    if (remainingPending.length > 0 && isAutoAdvanceEnabled) {
      cancelAutoAdvance();
      let secondsLeft = 3;
      setAutoAdvanceCountdown(secondsLeft);
      autoAdvanceIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
        } else {
          setAutoAdvanceCountdown(secondsLeft);
        }
      }, 1000);

      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvanceCountdown(null);
        spotlightPlayer(remainingPending[0]);
      }, 3500);
    }
  };

  // ADMIN ACTION: Decide UNSOLD
  const adminDecideUnsold = async (playerId: string) => {
    const targetPlayer = (playerPool || []).find((p) => p.id === playerId) || currentPlayer;
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

    // Auto-advance to next pending player with 3.5s window
    const remainingPending = updatedPool.filter((p) => (selectedCategory === 'all' || p.role === selectedCategory) && p.auctionStatus === 'pending' && p.id !== targetPlayer.id);
    if (remainingPending.length > 0 && isAutoAdvanceEnabled) {
      cancelAutoAdvance();
      let secondsLeft = 3;
      setAutoAdvanceCountdown(secondsLeft);
      autoAdvanceIntervalRef.current = setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          if (autoAdvanceIntervalRef.current) clearInterval(autoAdvanceIntervalRef.current);
        } else {
          setAutoAdvanceCountdown(secondsLeft);
        }
      }, 1000);

      autoAdvanceTimerRef.current = setTimeout(() => {
        setAutoAdvanceCountdown(null);
        spotlightPlayer(remainingPending[0]);
      }, 3500);
    }

    try {
      const { error: pErr } = await supabase
        .from('players')
        .update({
          auction_status: 'unsold',
          team_id: null,
          sold_price: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetPlayer.id);
      if (pErr) console.error('Failed to update player status to unsold:', pErr);

      const stateId = auctionState?.id || tournamentId;
      const { error: sErr } = await supabase
        .from('auction_state')
        .upsert({
          id: stateId,
          tournament_id: tournamentId,
          current_player_id: targetPlayer.id,
          status: 'unsold',
          timer_ends_at: null,
          updated_at: new Date().toISOString(),
        });
      if (sErr) console.error('Failed to update auction_state to unsold:', sErr);
    } catch (err: any) {
      console.error('DB persistence error for unsold player:', err?.message || err);
    }
  };

  // ADMIN ACTION: Revert / Re-auction a player
  const revertPlayerStatus = async (playerId: string) => {
    const targetPlayer = (playerPool || []).find((p) => p.id === playerId);
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
        const team = (teams || []).find((t) => t.id === previousTeamId);
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

  // ADMIN ACTION: Start Accelerated Round (Re-auction all unsold players)
  const startAcceleratedUnsoldRound = async () => {
    cancelAutoAdvance();
    const unsoldPlayers = playerPool.filter((p) => p.auctionStatus === 'unsold');
    if (unsoldPlayers.length === 0) {
      toast.info('No unsold players available to re-auction.');
      return;
    }

    const updatedPool = playerPool.map((p) => (p.auctionStatus === 'unsold' ? { ...p, auctionStatus: 'pending' as const } : p));
    setPlayerPool(updatedPool);
    setSalesHistory((prev) => prev.filter((l) => l.status !== 'unsold'));

    try {
      localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updatedPool));
      localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify(salesHistory.filter((l) => l.status !== 'unsold')));
    } catch {}

    spotlightPlayer(unsoldPlayers[0]);

    broadcastAuctionEvent('auction_unsold_round_start', {
      unsoldIds: unsoldPlayers.map((p) => p.id),
      firstPlayer: unsoldPlayers[0],
    });

    toast.success(`⚡ Accelerated Round Started! ${unsoldPlayers.length} unsold players are back on the podium.`);

    try {
      await supabase
        .from('players')
        .update({ auction_status: 'pending', updated_at: new Date().toISOString() })
        .in('id', unsoldPlayers.map((p) => p.id));
    } catch (err: any) {
      console.warn('DB update for accelerated round:', err);
    }
  };

  const removePlayerFromAuction = useCallback(async (playerId: string) => {
    // 1. Remove from local pool & stage
    setPlayerPool((prev) => {
      const updated = prev.filter((p) => p.id !== playerId);
      try {
        localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setCurrentPlayer((current) => {
      if (current?.id === playerId) {
        try {
          localStorage.removeItem(`kapl_auction_active_player_${tournamentId}`);
        } catch {}
        return null;
      }
      return current;
    });

    // 2. Remove from kapl_registered_players
    try {
      const regRaw = localStorage.getItem('kapl_registered_players');
      if (regRaw) {
        const parsed: PlayerRecord[] = JSON.parse(regRaw);
        localStorage.setItem('kapl_registered_players', JSON.stringify(parsed.filter((p) => p.id !== playerId)));
      }
    } catch {}

    // 3. Refund team if drafted
    setTeams((prevTeams) => {
      const updated = prevTeams.map((t) => {
        const hasPlayer = (t.players || []).some((p) => p.id === playerId);
        if (!hasPlayer) return t;
        const targetPlayer = (t.players || []).find((p) => p.id === playerId);
        const refund = targetPlayer?.soldPrice || 0;
        return {
          ...t,
          players: (t.players || []).filter((p) => p.id !== playerId),
          playerCount: Math.max(0, (t.playerCount || 1) - 1),
          remainingPurse: (t.remainingPurse ?? 10000) + refund,
        };
      });
      try {
        localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(updated));
        localStorage.setItem('kapl_teams', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // 4. Broadcast event across tabs & Supabase
    broadcastAuctionEvent('auction_player_removed', { playerId, tournamentId });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kapl_player_removed', { detail: { playerId, tournamentId } }));
      window.dispatchEvent(new CustomEvent('kapl-auction-local-update', { detail: { event: 'auction_player_removed', playerId, tournamentId } }));
    }

    // 5. Delete from database
    try {
      await supabase.rpc('delete_player_by_id', { p_id: playerId });
      await supabase.from('players').delete().eq('id', playerId);
    } catch (e) {
      console.warn('DB player delete error in auction:', e);
    }
    toast.success('Player permanently deleted from auction and tournament');
  }, [tournamentId, broadcastAuctionEvent]);

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
    removePlayerFromAuction,
    startAcceleratedUnsoldRound,
    autoAdvanceCountdown,
    cancelAutoAdvance,
    isAutoAdvanceEnabled,
    setIsAutoAdvanceEnabled,
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
        localStorage.setItem(`kapl_auction_manually_reset_${tournamentId}`, 'true');
        localStorage.setItem(`kapl_auction_players_${tournamentId}`, JSON.stringify(freshPlayers));
        localStorage.setItem(`kapl_auction_teams_${tournamentId}`, JSON.stringify(freshTeams));
        localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, freshPlayers[0].id);
        localStorage.setItem(`kapl_auction_sales_${tournamentId}`, JSON.stringify([]));
        localStorage.setItem('kapl_teams', JSON.stringify(freshTeams));
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
    autoCompleteAuction: async () => {
      try {
        localStorage.removeItem(`kapl_auction_manually_reset_${tournamentId}`);
      } catch {}
      const res = await autoCompleteAuctionForAll80Players(supabase, tournamentId);
      if (res.success) {
        setTeams(res.teams);
        setPlayerPool(res.players);
        setSalesHistory(res.salesHistory);
        const lastPlayer = res.players[res.players.length - 1];
        if (lastPlayer) {
          setCurrentPlayer(lastPlayer);
          try {
            localStorage.setItem(`kapl_auction_active_player_${tournamentId}`, lastPlayer.id);
          } catch {}
        }
        setAuctionState({
          id: tournamentId,
          tournamentId,
          currentPlayerId: lastPlayer?.id || null,
          currentBid: lastPlayer?.soldPrice || 350,
          highestBidderTeamId: lastPlayer?.teamId || null,
          bidHistory: [],
          status: 'completed',
          timerEndsAt: null,
          updatedAt: new Date().toISOString(),
        });
        playAuctionGavel();
        triggerQuickBurst();

        broadcastAuctionEvent('auction_auto_completed', {
          teams: res.teams,
          players: res.players,
          salesHistory: res.salesHistory,
          auctionState: { status: 'completed', tournamentId },
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kapl-teams-updated', { detail: res.teams }));
        }
      }
      return res;
    },
    refreshData: fetchData,
  };
}
