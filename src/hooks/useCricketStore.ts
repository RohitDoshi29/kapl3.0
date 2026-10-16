import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Team, Match, MatchState, TeamStats, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS, Ball, Over, Player, Innings, MatchType, SuperOver, DismissalType, WicketDetails } from '@/lib/cricketTypes';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

// LocalStorage metadata helpers to persist Owner & Captain roles
const getStoredTeamMeta = (teamId: string) => {
  try {
    const raw = localStorage.getItem(`kapl_team_meta_${teamId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredTeamMeta = (teamId: string, meta: {
  ownerName?: string;
  ownerEmail?: string | null;
  ownerUserId?: string | null;
  captainName?: string;
  captainPlayerId?: string | null;
  captainUserId?: string | null;
}) => {
  try {
    localStorage.setItem(`kapl_team_meta_${teamId}`, JSON.stringify(meta));
  } catch (e) {
    console.warn('Failed to save team meta to localStorage:', e);
  }
};

// Helper to convert DB team to app Team
const dbToTeam = (dbTeam: any): Team => {
  const meta = getStoredTeamMeta(dbTeam.id);
  return {
    id: dbTeam.id,
    name: dbTeam.name,
    group: dbTeam.group as 'A' | 'B',
    logo: dbTeam.logo,
    primaryColor: dbTeam.primary_color,
    players: dbTeam.players as Player[],
    playerCount: dbTeam.player_count || 10,
    tournamentId: dbTeam.tournament_id || 'kapl-3-mens',
    initialPurse: dbTeam.initial_purse ? Number(dbTeam.initial_purse) : 10000,
    remainingPurse: dbTeam.remaining_purse !== undefined && dbTeam.remaining_purse !== null ? Number(dbTeam.remaining_purse) : 10000,
    maxSquadSize: dbTeam.max_squad_size || 10,
    captainUserId: dbTeam.captain_user_id || meta.captainUserId || null,
    ownerName: meta.ownerName || dbTeam.owner_name || undefined,
    ownerEmail: meta.ownerEmail || dbTeam.owner_email || null,
    ownerUserId: meta.ownerUserId || dbTeam.owner_user_id || null,
    captainName: meta.captainName || dbTeam.captain_name || undefined,
    captainPlayerId: meta.captainPlayerId || dbTeam.captain_player_id || null,
  };
};

// Helper to convert app Team to DB format
const teamToDb = (team: Team) => ({
  id: team.id,
  name: team.name,
  group: team.group,
  logo: team.logo,
  primary_color: team.primaryColor,
  players: JSON.parse(JSON.stringify(team.players)) as Json,
  player_count: team.playerCount || 10,
  tournament_id: team.tournamentId || 'kapl-3-mens',
  initial_purse: team.initialPurse || 10000,
  remaining_purse: team.remainingPurse ?? 10000,
  max_squad_size: team.maxSquadSize || 10,
  captain_user_id: team.captainUserId || null,
});

// Helper to create a new innings
const createInnings = (battingTeamId: string, bowlingTeamId: string): Innings => ({
  battingTeamId,
  bowlingTeamId,
  runs: 0,
  wickets: 0,
  overs: [{ number: 1, balls: [] }],
  currentOver: 0,
  currentBall: 0,
  currentBatsmanId: undefined,
  currentBowlerId: undefined,
  nonStrikerBatsmanId: undefined,
  batterStats: {},
  bowlerStats: {},
  battingOrder: [],
  isFreeHit: false,
});

// Helper to recalculate all stats of an innings deterministically from its overs and balls
const recalculateInnings = (rawInnings: Innings): Innings => {
  const innings: Innings = {
    ...rawInnings,
    runs: 0,
    wickets: 0,
    batterStats: {},
    bowlerStats: {},
  };

  // Preserve player entries in stats with clean initial 0 values
  Object.keys(rawInnings.batterStats || {}).forEach(id => {
    innings.batterStats[id] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
  });
  Object.keys(rawInnings.bowlerStats || {}).forEach(id => {
    innings.bowlerStats[id] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
  });

  let totalRuns = 0;
  let totalWickets = 0;
  let isFreeHit = false;

  innings.overs.forEach(over => {
    over.balls.forEach(ball => {
      totalRuns += ball.runs;
      if (ball.isWicket) totalWickets += 1;

      // Batter stats
      const batId = ball.batsmanId;
      if (batId && !ball.isWide) {
        if (!innings.batterStats[batId]) {
          innings.batterStats[batId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
        }
        const bStat = innings.batterStats[batId];
        const batRuns = ball.runsOffBat ?? (ball.isNoBall ? Math.max(0, ball.runs - 1) : (ball.extraType === 'bye' || ball.extraType === 'leg_bye' ? 0 : ball.runs));
        bStat.runs += batRuns;
        if (!ball.isNoBall) {
          bStat.ballsFaced += 1;
        }
        if (batRuns === 4) bStat.fours += 1;
        if (batRuns === 6) bStat.sixes += 1;
      }

      // Wicket attribution
      if (ball.isWicket && ball.wicketDetails) {
        const outId = ball.wicketDetails.dismissedPlayerId || ball.batsmanId;
        if (outId) {
          if (!innings.batterStats[outId]) {
            innings.batterStats[outId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
          }
          const outStat = innings.batterStats[outId];
          outStat.isOut = true;
          outStat.dismissalType = ball.wicketDetails.type;
          outStat.dismissalDescription = ball.wicketDetails.description;
          outStat.dismissalFielderId = ball.wicketDetails.fielderId;
        }
      }

      // Bowler stats
      const bowlId = ball.bowlerId || over.bowlerId;
      if (bowlId) {
        if (!innings.bowlerStats[bowlId]) {
          innings.bowlerStats[bowlId] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
        }
        const bwStat = innings.bowlerStats[bowlId];
        bwStat.runs += ball.runs;
        if (ball.isWicket && ball.wicketDetails?.type !== 'run_out' && ball.wicketDetails?.type !== 'retired') {
          bwStat.wickets += 1;
        }
        if (ball.isWide) bwStat.wides += 1;
        if (ball.isNoBall) bwStat.noBalls += 1;

        if (!ball.isWide && !ball.isNoBall) {
          bwStat.balls += 1;
          if (bwStat.balls >= 6) {
            bwStat.overs += 1;
            bwStat.balls = 0;
          }
        }
      }

      // Free Hit state machine
      if (ball.isNoBall) {
        isFreeHit = true;
      } else if (!ball.isWide) {
        isFreeHit = false;
      }
    });
  });

  const lastOver = innings.overs[innings.overs.length - 1];
  const legalBallsInCurrentOver = lastOver
    ? lastOver.balls.filter(b => !b.isWide && !b.isNoBall).length
    : 0;

  innings.runs = totalRuns;
  innings.wickets = totalWickets;
  innings.currentOver = Math.max(0, innings.overs.length - 1);
  innings.currentBall = legalBallsInCurrentOver;
  innings.isFreeHit = isFreeHit;

  return innings;
};

export function useCricketStore() {
  const [teams, setTeams] = useState<Team[]>(() => [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS]);
  const [matchState, setMatchState] = useState<MatchState>(() => {
    try {
      const cached = localStorage.getItem('kapl_local_match_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          currentMatch: parsed.current_match || null,
          lastAction: parsed.last_action || null,
        };
      }
    } catch (e) {}
    return { currentMatch: null, lastAction: null };
  });
  const [matchHistory, setMatchHistory] = useState<Match[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playingPlayers, setPlayingPlayers] = useState<Record<string, string[]>>({});
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingOfflineChanges, setPendingOfflineChanges] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Safety timer so isLoaded never hangs
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Monitor online/offline events for resilient scoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet restored. Syncing data...');
      syncOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Offline mode: Scoring is saved locally and will auto-sync when online.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    try {
      if (localStorage.getItem('kapl_offline_sync_pending') === 'true') {
        setPendingOfflineChanges(1);
      }
    } catch (e) {}

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load data from database
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        // Load teams
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .order('id');
        
        if (teamsError) throw teamsError;
        let loadedTeams: Team[] = [];
        if (teamsData && teamsData.length > 0) {
          loadedTeams = teamsData.map(dbToTeam);
          // If no women's teams exist in DB, append DEFAULT_WOMENS_TEAMS so both tournaments work seamlessly
          const hasWomensTeams = loadedTeams.some(t => t.tournamentId === 'kapl-3-womens');
          if (!hasWomensTeams) {
            loadedTeams = [...loadedTeams, ...DEFAULT_WOMENS_TEAMS];
          }
        } else {
          loadedTeams = [...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS];
        }
        if (isMounted) setTeams(loadedTeams);

        // Load match state
        const { data: stateData, error: stateError } = await supabase
          .from('match_state')
          .select('*')
          .eq('id', 'current')
          .maybeSingle();
        
        if (stateError) throw stateError;
        if (stateData && isMounted) {
          const currentMatch = stateData.current_match as unknown as Match | null;
          setMatchState({
            currentMatch,
            lastAction: stateData.last_action as unknown as MatchState['lastAction'],
          });
          // Extract playing players from match if available
          if (currentMatch && (currentMatch as any).playingPlayers) {
            setPlayingPlayers((currentMatch as any).playingPlayers);
          }
        }

        // Load match history
        const { data: historyData, error: historyError } = await supabase
          .from('match_history')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (historyError) throw historyError;
        if (historyData && isMounted) {
          setMatchHistory(historyData.map((h: any) => ({
            id: h.id,
            tournamentId: h.tournament_id || 'kapl-3-mens',
            group: h.group as 'A' | 'B',
            team1Id: h.team1_id,
            team2Id: h.team2_id,
            innings1: h.innings1,
            innings2: h.innings2,
            currentInnings: h.current_innings as 1 | 2,
            status: h.status as 'setup' | 'live' | 'completed',
            winner: h.winner,
            matchType: (h.match_type || 'group') as MatchType,
          })));
        }

        if (isMounted) setIsLoaded(true);
      } catch (error) {
        console.error('Error loading data, continuing with cached/default data:', error);
        if (isMounted) setIsLoaded(true);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to realtime updates (Optimized for 100+ concurrent users with Broadcast Channels)
  useEffect(() => {
    const channel = supabase
      .channel('cricket-updates')
      // High-concurrency broadcast listener: receives ball-by-ball updates directly in < 50ms without DB queries
      .on(
        'broadcast',
        { event: 'live_score_delta' },
        (envelope) => {
          if (envelope?.payload) {
            const { currentMatch, lastAction } = envelope.payload;
            if (currentMatch) {
              setMatchState({ currentMatch, lastAction });
              if (currentMatch.playingPlayers) {
                setPlayingPlayers(currentMatch.playingPlayers);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'teams' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const updatedTeam = dbToTeam(payload.new);
            setTeams(prev => {
              const exists = prev.find(t => t.id === updatedTeam.id);
              if (exists) {
                return prev.map(t => t.id === updatedTeam.id ? updatedTeam : t);
              }
              return [...prev, updatedTeam];
            });
          } else if (payload.eventType === 'DELETE') {
            setTeams(prev => prev.filter(t => t.id !== (payload.old as any).id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_state' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newState = payload.new as any;
            const currentMatch = newState.current_match as unknown as Match | null;
            setMatchState({
              currentMatch,
              lastAction: newState.last_action as unknown as MatchState['lastAction'],
            });
            if (currentMatch && (currentMatch as any).playingPlayers) {
              setPlayingPlayers((currentMatch as any).playingPlayers);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_history' },
        async (payload) => {
          // Selective caching: only reload match history when status completes or on insert/delete
          // Avoids redundant queries during active ball-by-ball scoring
          const newStatus = (payload.new as any)?.status;
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || newStatus === 'completed') {
            const { data } = await supabase
              .from('match_history')
              .select('*')
              .order('created_at', { ascending: true });
            
            if (data) {
              setMatchHistory(data.map((h: any) => ({
                id: h.id,
                group: h.group as 'A' | 'B',
                team1Id: h.team1_id,
                team2Id: h.team2_id,
                innings1: h.innings1,
                innings2: h.innings2,
                currentInnings: h.current_innings as 1 | 2,
                status: h.status as 'setup' | 'live' | 'completed',
                winner: h.winner,
                matchType: (h.match_type || 'group') as MatchType,
              })));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateTeam = useCallback(async (teamId: string, updates: Partial<Team>) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const updatedTeam = { ...team, ...updates };
    saveStoredTeamMeta(teamId, {
      ownerName: updatedTeam.ownerName,
      ownerEmail: updatedTeam.ownerEmail,
      ownerUserId: updatedTeam.ownerUserId,
      captainName: updatedTeam.captainName,
      captainPlayerId: updatedTeam.captainPlayerId,
      captainUserId: updatedTeam.captainUserId,
    });

    if (!updatedTeam.players) {
      updatedTeam.players = Array.from({ length: 10 }, (_, i) => ({
        id: `${teamId}-p${i + 1}`,
        name: `Player ${i + 1}`,
        photo: null,
      }));
    }

    // Optimistic update
    setTeams(prev => prev.map(t => t.id === teamId ? updatedTeam : t));

    // Save to database
    const { error } = await supabase
      .from('teams')
      .update(teamToDb(updatedTeam))
      .eq('id', teamId);

    if (error) {
      console.error('Error updating team:', error);
      // Revert on error
      setTeams(prev => prev.map(t => t.id === teamId ? team : t));
    }
  }, [teams]);

  const getTeam = useCallback((teamId: string) => {
    return teams.find(t => t.id === teamId);
  }, [teams]);

  const getTeamsByGroup = useCallback((group: 'A' | 'B', tournamentId?: string) => {
    return teams.filter(t => t.group === group && (!tournamentId || (t.tournamentId || 'kapl-3-mens') === tournamentId));
  }, [teams]);

  const getTeamsByTournament = useCallback((tournamentId: string) => {
    return teams.filter(t => (t.tournamentId || 'kapl-3-mens') === tournamentId);
  }, [teams]);

  const getPlayingPlayers = useCallback((teamId: string) => {
    return playingPlayers[teamId] || [];
  }, [playingPlayers]);

  const syncOfflineQueue = useCallback(async () => {
    try {
      const raw = localStorage.getItem('kapl_local_match_state');
      if (!raw) return;
      setIsSyncing(true);
      const stateData = JSON.parse(raw);
      const { error } = await supabase
        .from('match_state')
        .update({
          current_match: stateData.current_match,
          last_action: stateData.last_action,
        })
        .eq('id', 'current');

      if (!error) {
        localStorage.removeItem('kapl_offline_sync_pending');
        setPendingOfflineChanges(0);
        toast.success('Synced scores successfully with cloud');
      } else {
        console.warn('Sync failed, will retry:', error);
      }
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const saveMatchState = useCallback(async (newState: MatchState) => {
    const matchWithPlayers = newState.currentMatch ? {
      ...newState.currentMatch,
      playingPlayers,
    } : null;

    const payload = {
      current_match: JSON.parse(JSON.stringify(matchWithPlayers)) as Json,
      last_action: JSON.parse(JSON.stringify(newState.lastAction)) as Json,
    };

    // Always cache in localStorage first for resilience
    try {
      localStorage.setItem('kapl_local_match_state', JSON.stringify(payload));
    } catch (e) {}

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        localStorage.setItem('kapl_offline_sync_pending', 'true');
        setPendingOfflineChanges(prev => prev + 1);
      } catch (e) {}
      return;
    }

    try {
      const { error } = await supabase
        .from('match_state')
        .update(payload)
        .eq('id', 'current');

      if (error) {
        console.warn('Supabase update failed, queued locally:', error);
        localStorage.setItem('kapl_offline_sync_pending', 'true');
        setPendingOfflineChanges(prev => prev + 1);
      } else {
        localStorage.removeItem('kapl_offline_sync_pending');
        setPendingOfflineChanges(0);

        // High-concurrency realtime broadcast: transmit delta directly to edge channel
        const broadcastChannel = supabase.channel('cricket-updates');
        broadcastChannel.send({
          type: 'broadcast',
          event: 'live_score_delta',
          payload: {
            currentMatch: matchWithPlayers,
            lastAction: newState.lastAction,
            timestamp: Date.now(),
          },
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Network error saving match state, queued locally:', err);
      try {
        localStorage.setItem('kapl_offline_sync_pending', 'true');
        setPendingOfflineChanges(prev => prev + 1);
      } catch (e) {}
    }
  }, [playingPlayers]);

  const startMatch = useCallback(async (
    group: 'A' | 'B', 
    team1Id: string, 
    team2Id: string, 
    matchType: MatchType = 'group',
    selectedPlayingPlayers?: Record<string, string[]>,
    tournamentId?: string
  ) => {
    const t1 = teams.find(t => t.id === team1Id);
    const resolvedTournamentId = tournamentId || t1?.tournamentId || 'kapl-3-mens';

    const newMatch: Match = {
      id: Date.now().toString(),
      tournamentId: resolvedTournamentId,
      group,
      team1Id,
      team2Id,
      innings1: createInnings(team1Id, team2Id),
      innings2: null,
      currentInnings: 1,
      status: 'live',
      winner: null,
      matchType,
    };
    
    if (selectedPlayingPlayers) {
      setPlayingPlayers(selectedPlayingPlayers);
    }
    
    const matchWithPlayers = {
      ...newMatch,
      playingPlayers: selectedPlayingPlayers || {},
    };
    
    const newState = { currentMatch: newMatch, lastAction: null };
    setMatchState(newState);
    
    const { error } = await supabase
      .from('match_state')
      .update({
        current_match: JSON.parse(JSON.stringify(matchWithPlayers)) as Json,
        last_action: null,
      })
      .eq('id', 'current');

    // Reset secondary scorer state so it cannot carry over a previous match
    await supabase
      .from('secondary_match_state')
      .upsert({
        id: 'current',
        current_match: null,
        last_action: null,
      });

    if (error) {
      console.error('Error saving match state:', error);
    }
  }, []);

  const getCurrentInnings = useCallback(() => {
    const match = matchState.currentMatch;
    if (!match) return null;
    return match.currentInnings === 1 ? match.innings1 : match.innings2;
  }, [matchState.currentMatch]);

  const addBall = useCallback(async (
    runs: number,
    isWicket = false,
    isWide = false,
    isNoBall = false,
    noStrikeChange = false,
    ballOptions?: {
      runsOffBat?: number;
      isBye?: boolean;
      extraType?: 'wide' | 'no_ball' | 'bye' | 'leg_bye' | null;
      wicketDetails?: WicketDetails;
    }
  ) => {
    if (!matchState.currentMatch) return;

    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    // Check wicket limit
    if (isWicket && innings.wickets >= MATCH_CONSTANTS.MAX_WICKETS) {
      return; // Max wickets reached
    }

    const wasFreeHit = innings.isFreeHit === true;
    const isLegalBall = !isWide && !isNoBall;
    const totalRuns = isNoBall
      ? 1 + (ballOptions?.runsOffBat ?? (runs > 1 ? runs - 1 : 0))
      : runs;

    const ball: Ball = {
      id: Date.now().toString(),
      runs: totalRuns,
      isWicket,
      isWide,
      isNoBall,
      isExtra: isWide || isNoBall,
      extraType: isWide ? 'wide' : isNoBall ? 'no_ball' : ballOptions?.extraType || null,
      runsOffBat: ballOptions?.runsOffBat ?? (isNoBall ? (totalRuns > 1 ? totalRuns - 1 : 0) : (!isWide ? runs : 0)),
      extraRuns: isWide ? runs : isNoBall ? 1 : 0,
      isFreeHit: wasFreeHit,
      wicketDetails: ballOptions?.wicketDetails,
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += totalRuns;
    if (isWicket) innings.wickets += 1;

    // Update batter stats
    if (innings.currentBatsmanId && !isWide) {
      const batterStats = { ...innings.batterStats };
      if (!batterStats[innings.currentBatsmanId]) {
        batterStats[innings.currentBatsmanId] = {
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        };
      }
      const stats = { ...batterStats[innings.currentBatsmanId] };
      const runsToCredit = ball.runsOffBat ?? 0;
      stats.runs += runsToCredit;
      if (!isNoBall) {
        stats.ballsFaced += 1;
      }
      if (runsToCredit === 4) stats.fours += 1;
      if (runsToCredit === 6) stats.sixes += 1;
      if (isWicket) {
        stats.isOut = true;
        stats.dismissalType = ballOptions?.wicketDetails?.type || 'out';
        stats.dismissalDescription = ballOptions?.wicketDetails?.description;
      }
      batterStats[innings.currentBatsmanId] = stats;
      innings.batterStats = batterStats;
    }

    // Update bowler stats
    if (innings.currentBowlerId) {
      const bowlerStats = { ...innings.bowlerStats };
      if (!bowlerStats[innings.currentBowlerId]) {
        bowlerStats[innings.currentBowlerId] = {
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        };
      }
      const stats = { ...bowlerStats[innings.currentBowlerId] };
      stats.runs += totalRuns;
      if (isWicket && ballOptions?.wicketDetails?.type !== 'run_out' && ballOptions?.wicketDetails?.type !== 'retired') {
        stats.wickets += 1;
      }
      if (isWide) stats.wides += 1;
      if (isNoBall) stats.noBalls += 1;

      if (isLegalBall) {
        stats.balls += 1;
        if (stats.balls >= 6) {
          stats.overs += 1;
          stats.balls = 0;
        }
      }
      bowlerStats[innings.currentBowlerId] = stats;
      innings.bowlerStats = bowlerStats;
    }

    // Free Hit state machine
    if (isNoBall) {
      innings.isFreeHit = true;
    } else if (isLegalBall) {
      innings.isFreeHit = false;
    }

    // Rotate strike on odd runs unless noStrikeChange is set
    const runningRuns = isNoBall ? (ballOptions?.runsOffBat ?? 0) : totalRuns;
    if (!noStrikeChange && runningRuns % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    if (isLegalBall) {
      innings.currentBall += 1;
      if (innings.currentBall >= 6) {
        innings.currentBall = 0;
        innings.currentOver += 1;

        if (innings.currentOver < MATCH_CONSTANTS.MAX_OVERS) {
          overs.push({ number: innings.currentOver + 1, balls: [], bowlerId: undefined });
        }

        // Rotate strike at end of over
        if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
          const temp = innings.currentBatsmanId;
          innings.currentBatsmanId = innings.nonStrikerBatsmanId;
          innings.nonStrikerBatsmanId = temp;
        }

        // Remember which bowler finished this over so they cannot bowl back-to-back
        (match as any).lastOverBowlerId = innings.currentBowlerId;
        innings.currentBowlerId = undefined;
      }
    }

    overs[currentOverIndex] = currentOver;
    innings.overs = overs;

    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'addBall', previousState: matchState.currentMatch },
    };

    setMatchState(newState);
    await saveMatchState(newState);

    // Check if 2nd innings target reached
    if (match.currentInnings === 2 && match.innings1) {
      const target = match.innings1.runs + 1;
      if (innings.runs >= target) {
        toast.success('Target reached! Match will be ended.');
      }
    }
  }, [matchState, saveMatchState]);

  const addNoBall = useCallback(async (
    batRuns: number = 0,
    isBye: boolean = false,
    boundaryDeclared: boolean = false
  ) => {
    return addBall(batRuns + 1, false, false, true, boundaryDeclared, {
      runsOffBat: isBye ? 0 : batRuns,
      isBye,
      extraType: isBye ? 'bye' : 'no_ball',
    });
  }, [addBall]);

  const addDismissal = useCallback(async (params: {
    type: DismissalType;
    outBatsmanId: string;
    fielderId?: string;
    fielderName?: string;
    runsCompleted?: number;
    nextBatsmanId?: string;
  }) => {
    if (!matchState.currentMatch) return;
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    if (innings.wickets >= MATCH_CONSTANTS.MAX_WICKETS) {
      toast.error('Maximum wickets reached for this innings');
      return;
    }

    const runs = params.runsCompleted || 0;
    const bowlingTeam = getTeam(innings.bowlingTeamId);
    const bowler = bowlingTeam?.players.find(p => p.id === innings.currentBowlerId);
    const bowlerName = bowler?.name || 'Bowler';

    let description = '';
    switch (params.type) {
      case 'bowled':
        description = `b ${bowlerName}`;
        break;
      case 'caught':
        description = params.fielderId && params.fielderId === innings.currentBowlerId
          ? `c & b ${bowlerName}`
          : `c ${params.fielderName || 'Fielder'} b ${bowlerName}`;
        break;
      case 'lbw':
        description = `lbw b ${bowlerName}`;
        break;
      case 'stumped':
        description = `st ${params.fielderName || 'Keeper'} b ${bowlerName}`;
        break;
      case 'run_out':
        description = params.fielderName ? `run out (${params.fielderName})` : 'run out';
        break;
      case 'hit_wicket':
        description = `hit wicket b ${bowlerName}`;
        break;
      case 'retired':
        description = 'retired out';
        break;
    }

    const ball: Ball = {
      id: Date.now().toString(),
      runs: runs,
      isWicket: true,
      isWide: false,
      isNoBall: false,
      isExtra: false,
      isFreeHit: innings.isFreeHit,
      wicketDetails: {
        type: params.type,
        dismissedPlayerId: params.outBatsmanId,
        fielderId: params.fielderId,
        fielderName: params.fielderName,
        runsCompleted: runs,
        description,
      },
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += runs;
    innings.wickets += 1;
    innings.isFreeHit = false;

    // Out batsman stats
    const bStats = { ...innings.batterStats };
    if (!bStats[params.outBatsmanId]) {
      bStats[params.outBatsmanId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
    }
    const outStats = { ...bStats[params.outBatsmanId] };
    outStats.isOut = true;
    outStats.dismissalType = params.type;
    outStats.dismissalDescription = description;
    outStats.dismissalFielderId = params.fielderId;
    outStats.dismissalBowlerId = innings.currentBowlerId;
    bStats[params.outBatsmanId] = outStats;

    // Striker stats for facing the ball
    if (innings.currentBatsmanId && innings.currentBatsmanId !== params.outBatsmanId) {
      if (!bStats[innings.currentBatsmanId]) {
        bStats[innings.currentBatsmanId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
      }
      const sStats = { ...bStats[innings.currentBatsmanId] };
      sStats.runs += runs;
      sStats.ballsFaced += 1;
      bStats[innings.currentBatsmanId] = sStats;
    } else if (innings.currentBatsmanId === params.outBatsmanId) {
      outStats.ballsFaced += 1;
      outStats.runs += runs;
    }
    innings.batterStats = bStats;

    // Bowler stats
    if (innings.currentBowlerId) {
      const bwStats = { ...innings.bowlerStats };
      if (!bwStats[innings.currentBowlerId]) {
        bwStats[innings.currentBowlerId] = { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 };
      }
      const stats = { ...bwStats[innings.currentBowlerId] };
      stats.runs += runs;
      if (params.type !== 'run_out' && params.type !== 'retired') {
        stats.wickets += 1;
      }
      stats.balls += 1;
      if (stats.balls >= 6) {
        stats.overs += 1;
        stats.balls = 0;
      }
      bwStats[innings.currentBowlerId] = stats;
      innings.bowlerStats = bwStats;
    }

    // Set next batsman or clear dismissed position
    if (innings.currentBatsmanId === params.outBatsmanId) {
      innings.currentBatsmanId = params.nextBatsmanId || undefined;
    }
    if (innings.nonStrikerBatsmanId === params.outBatsmanId) {
      innings.nonStrikerBatsmanId = params.nextBatsmanId || undefined;
    }

    if (params.nextBatsmanId) {
      if (!innings.batterStats[params.nextBatsmanId]) {
        innings.batterStats[params.nextBatsmanId] = { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false };
      }
      if (!innings.battingOrder.includes(params.nextBatsmanId)) {
        innings.battingOrder.push(params.nextBatsmanId);
      }
    }

    // Strike rotation if completed runs was odd
    if (runs % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    // Legal ball counter and over completion
    innings.currentBall += 1;
    if (innings.currentBall >= 6) {
      innings.currentBall = 0;
      innings.currentOver += 1;

      if (innings.currentOver < MATCH_CONSTANTS.MAX_OVERS) {
        overs.push({ number: innings.currentOver + 1, balls: [], bowlerId: undefined });
      }

      if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
        const temp = innings.currentBatsmanId;
        innings.currentBatsmanId = innings.nonStrikerBatsmanId;
        innings.nonStrikerBatsmanId = temp;
      }

      (match as any).lastOverBowlerId = innings.currentBowlerId;
      innings.currentBowlerId = undefined;
    }

    overs[currentOverIndex] = currentOver;
    innings.overs = overs;

    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'dismissal', previousState: matchState.currentMatch },
    };

    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState, getTeam]);

  // Backward compatible addRunOut
  const addRunOut = useCallback(async (outBatsmanId: string, runs: number = 0) => {
    return addDismissal({
      type: 'run_out',
      outBatsmanId,
      runsCompleted: runs,
    });
  }, [addDismissal]);

  const editBall = useCallback(async (overIndex: number, ballIndex: number, updatedBall: Partial<Ball>) => {
    if (!matchState.currentMatch) return;
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    if (!innings.overs[overIndex] || !innings.overs[overIndex].balls[ballIndex]) return;

    innings.overs[overIndex].balls[ballIndex] = {
      ...innings.overs[overIndex].balls[ballIndex],
      ...updatedBall,
    };

    const recalculated = recalculateInnings(innings);
    if (match.currentInnings === 1) {
      match.innings1 = recalculated;
    } else {
      match.innings2 = recalculated;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'editBall', previousState: matchState.currentMatch },
    };
    setMatchState(newState);
    await saveMatchState(newState);
    toast.success('Ball updated and scorecard recalculated');
  }, [matchState, saveMatchState]);

  const deleteBall = useCallback(async (overIndex: number, ballIndex: number) => {
    if (!matchState.currentMatch) return;
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    if (!innings.overs[overIndex] || !innings.overs[overIndex].balls[ballIndex]) return;

    innings.overs[overIndex].balls.splice(ballIndex, 1);

    const recalculated = recalculateInnings(innings);
    if (match.currentInnings === 1) {
      match.innings1 = recalculated;
    } else {
      match.innings2 = recalculated;
    }

    const newState = {
      currentMatch: match,
      lastAction: { type: 'deleteBall', previousState: matchState.currentMatch },
    };
    setMatchState(newState);
    await saveMatchState(newState);
    toast.success('Ball deleted and scorecard recalculated');
  }, [matchState, saveMatchState]);

  const selectBatsman = useCallback(async (playerId: string, isStriker: boolean) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    if (isStriker) {
      innings.currentBatsmanId = playerId;
    } else {
      innings.nonStrikerBatsmanId = playerId;
    }
    
    // Initialize batter stats if not exists
    if (!innings.batterStats[playerId]) {
      innings.batterStats = {
        ...innings.batterStats,
        [playerId]: {
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        },
      };
    }
    
    // Add to batting order if not already there
    if (!innings.battingOrder.includes(playerId)) {
      innings.battingOrder = [...innings.battingOrder, playerId];
    }
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const selectBowler = useCallback(async (playerId: string) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    innings.currentBowlerId = playerId;
    
    // Set bowler for current over
    const overs = [...innings.overs];
    if (overs.length > 0) {
      overs[overs.length - 1] = { ...overs[overs.length - 1], bowlerId: playerId };
      innings.overs = overs;
    }
    
    // Initialize bowler stats if not exists
    if (!innings.bowlerStats[playerId]) {
      innings.bowlerStats = {
        ...innings.bowlerStats,
        [playerId]: {
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        },
      };
    }
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const undoLastBall = useCallback(async () => {
    if (!matchState.lastAction?.previousState) return;
    
    const newState = {
      currentMatch: matchState.lastAction.previousState,
      lastAction: null,
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // Undo multiple balls by restoring to a specific state
  const undoToBall = useCallback(async (overIndex: number, ballIndex: number) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    // Get total balls to undo
    const overs = [...innings.overs];
    let ballsToRemove: Ball[] = [];
    
    // Collect balls to remove (from end back to specified position)
    for (let i = overs.length - 1; i >= overIndex; i--) {
      const over = overs[i];
      const startBall = i === overIndex ? ballIndex + 1 : 0;
      for (let j = over.balls.length - 1; j >= startBall; j--) {
        ballsToRemove.push(over.balls[j]);
      }
    }
    
    // Revert stats for each ball
    ballsToRemove.forEach(ball => {
      // Revert innings stats
      innings.runs -= ball.runs;
      if (ball.isWicket) innings.wickets -= 1;
      
      // Revert batter stats
      if (ball.batsmanId && !ball.isWide && innings.batterStats[ball.batsmanId]) {
        const stats = { ...innings.batterStats[ball.batsmanId] };
        // For no-ball, batter runs = total - 1
        const batterRuns = ball.isNoBall ? ball.runs - 1 : ball.runs;
        stats.runs -= batterRuns;
        stats.ballsFaced -= 1;
        if (batterRuns === 4 && !ball.isWide && !ball.isNoBall) stats.fours -= 1;
        if (batterRuns === 6 && !ball.isWide && !ball.isNoBall) stats.sixes -= 1;
        if (ball.isWicket) {
          stats.isOut = false;
          stats.dismissalType = undefined;
        }
        innings.batterStats[ball.batsmanId] = stats;
      }
      
      // Revert bowler stats
      if (ball.bowlerId && innings.bowlerStats[ball.bowlerId]) {
        const stats = { ...innings.bowlerStats[ball.bowlerId] };
        stats.runs -= ball.runs;
        if (ball.isWicket) stats.wickets -= 1;
        if (ball.isWide) stats.wides -= 1;
        if (ball.isNoBall) stats.noBalls -= 1;
        
        if (!ball.isWide && !ball.isNoBall) {
          if (stats.balls === 0 && stats.overs > 0) {
            stats.overs -= 1;
            stats.balls = 5;
          } else {
            stats.balls -= 1;
          }
        }
        innings.bowlerStats[ball.bowlerId] = stats;
      }
    });
    
    // Remove balls from overs
    for (let i = overs.length - 1; i >= overIndex; i--) {
      if (i === overIndex) {
        overs[i] = { ...overs[i], balls: overs[i].balls.slice(0, ballIndex + 1) };
      } else if (i > overIndex) {
        // Remove entire over if it's after the target
        overs.splice(i, 1);
      }
    }
    
    // Recalculate current over/ball
    const lastOver = overs[overs.length - 1];
    const legalBalls = lastOver.balls.filter(b => !b.isWide && !b.isNoBall).length;
    innings.currentOver = overs.length - 1;
    innings.currentBall = legalBalls;
    innings.overs = overs;
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = {
      currentMatch: match,
      lastAction: null,
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const switchBattingTeam = useCallback(async () => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    
    if (match.currentInnings === 1 && match.innings1) {
      match.innings2 = createInnings(match.team2Id, match.team1Id);
      match.currentInnings = 2;
    }
    
    const newState = {
      currentMatch: match,
      lastAction: { type: 'switchInnings', previousState: matchState.currentMatch },
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const swapStrike = useCallback(async () => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
      
      if (match.currentInnings === 1) {
        match.innings1 = innings;
      } else {
        match.innings2 = innings;
      }
      
      const newState = { currentMatch: match, lastAction: null };
      setMatchState(newState);
      await saveMatchState(newState);
    }
  }, [matchState, saveMatchState]);

  // Replace a player who retired/injured mid-match
  const replacePlayer = useCallback(async (oldPlayerId: string, newPlayerId: string, teamId: string) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    
    // Check if the player is currently batting or bowling
    const isBatting = innings.battingTeamId === teamId;
    
    if (isBatting) {
      // Transfer batting stats to new player
      if (innings.batterStats[oldPlayerId]) {
        const oldStats = { ...innings.batterStats[oldPlayerId] };
        // Mark old player as retired
        oldStats.isOut = true;
        oldStats.dismissalType = 'retired';
        innings.batterStats[oldPlayerId] = oldStats;
      }
      
      // If old player was striking or non-striking, replace with new player
      if (innings.currentBatsmanId === oldPlayerId) {
        innings.currentBatsmanId = newPlayerId;
      }
      if (innings.nonStrikerBatsmanId === oldPlayerId) {
        innings.nonStrikerBatsmanId = newPlayerId;
      }
      
      // Initialize new player stats
      if (!innings.batterStats[newPlayerId]) {
        innings.batterStats[newPlayerId] = {
          runs: 0,
          ballsFaced: 0,
          fours: 0,
          sixes: 0,
          isOut: false,
        };
      }
      
      // Add to batting order if not already there
      if (!innings.battingOrder.includes(newPlayerId)) {
        innings.battingOrder = [...innings.battingOrder, newPlayerId];
      }
    } else {
      // For bowler replacement
      if (innings.currentBowlerId === oldPlayerId) {
        innings.currentBowlerId = newPlayerId;
      }
      
      // Note: We don't transfer bowler stats - the new bowler starts fresh
      if (!innings.bowlerStats[newPlayerId]) {
        innings.bowlerStats[newPlayerId] = {
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        };
      }
    }
    
    if (match.currentInnings === 1) {
      match.innings1 = innings;
    } else {
      match.innings2 = innings;
    }
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    
    toast.success('Player replaced successfully');
  }, [matchState, saveMatchState]);

  const endMatch = useCallback(async (forceTie: boolean = false) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    
    const team1Runs = match.innings1?.runs || 0;
    const team2Runs = match.innings2?.runs || 0;
    
    // Check for tie (unless forceTie is true, which means end as tie without super over)
    const isTied = team1Runs === team2Runs && team2Runs > 0;
    
    if (isTied && !forceTie && !match.superOver) {
      // Mark match as tied - prompt for super over
      match.isTied = true;
      const newState = { currentMatch: match, lastAction: null };
      setMatchState(newState);
      await saveMatchState(newState);
      toast.info('Match tied! Start a Super Over or end as tie.');
      return;
    }
    
    // If ending super over, determine winner from super over
    if (match.superOver?.completed) {
      const so1Runs = match.superOver.innings1?.runs || 0;
      const so2Runs = match.superOver.innings2?.runs || 0;
      match.winner = so1Runs > so2Runs ? match.team1Id : so2Runs > so1Runs ? match.team2Id : null;
    } else {
      match.winner = team1Runs > team2Runs ? match.team1Id : team2Runs > team1Runs ? match.team2Id : null;
    }
    
    match.status = 'completed';
    
    // Save to match history
    const { error } = await supabase
      .from('match_history')
      .insert({
        id: match.id,
        tournament_id: match.tournamentId || 'kapl-3-mens',
        group: match.group,
        team1_id: match.team1Id,
        team2_id: match.team2Id,
        innings1: JSON.parse(JSON.stringify(match.innings1)) as Json,
        innings2: JSON.parse(JSON.stringify(match.innings2)) as Json,
        current_innings: match.currentInnings,
        status: match.status,
        winner: match.winner,
        match_type: match.matchType,
      });

    if (error) {
      console.error('Error saving match to history:', error);
      return;
    }

    // Clear current match
    const newState = { currentMatch: null, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    setPlayingPlayers({});
    
    // Update local history
    setMatchHistory(prev => [...prev, match]);
  }, [matchState, saveMatchState]);

  // Start a super over
  const startSuperOver = useCallback(async () => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    
    // Initialize super over
    match.superOver = {
      innings1: createInnings(match.team1Id, match.team2Id),
      innings2: null,
      currentInnings: 1,
      completed: false,
    };
    match.status = 'super_over';
    match.isTied = false;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    
    toast.success('Super Over started! Team 1 batting first.');
  }, [matchState, saveMatchState]);

  // Switch super over innings
  const switchSuperOverInnings = useCallback(async () => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    
    if (superOver.currentInnings === 1) {
      superOver.innings2 = createInnings(match.team2Id, match.team1Id);
      superOver.currentInnings = 2;
    }
    
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    
    toast.success('Super Over innings switched! Team 2 batting.');
  }, [matchState, saveMatchState]);

  // Add ball in super over
  const addSuperOverBall = useCallback(async (runs: number, isWicket = false, isWide = false, isNoBall = false) => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    const innings = superOver.currentInnings === 1 ? { ...superOver.innings1! } : { ...superOver.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    // Check wicket limit for super over (2 wickets)
    if (isWicket && innings.wickets >= MATCH_CONSTANTS.SUPER_OVER_WICKETS) {
      return;
    }

    const totalRuns = isNoBall ? runs + 1 : runs;
    const isLegalBall = !isWide && !isNoBall;

    const ball: Ball = {
      id: Date.now().toString(),
      runs: totalRuns,
      isWicket,
      isWide,
      isNoBall,
      isExtra: isWide || isNoBall,
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += totalRuns;
    if (isWicket) innings.wickets += 1;

    // Update batter stats
    if (innings.currentBatsmanId && !isWide) {
      const batterStats = { ...innings.batterStats };
      if (!batterStats[innings.currentBatsmanId]) {
        batterStats[innings.currentBatsmanId] = {
          runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
        };
      }
      const stats = { ...batterStats[innings.currentBatsmanId] };
      stats.runs += runs;
      if (isLegalBall) stats.ballsFaced += 1;
      if (runs === 4 && !isWide && !isNoBall) stats.fours += 1;
      if (runs === 6 && !isWide && !isNoBall) stats.sixes += 1;
      if (isWicket) {
        stats.isOut = true;
        stats.dismissalType = 'out';
      }
      batterStats[innings.currentBatsmanId] = stats;
      innings.batterStats = batterStats;
    }

    // Update bowler stats
    if (innings.currentBowlerId) {
      const bowlerStats = { ...innings.bowlerStats };
      if (!bowlerStats[innings.currentBowlerId]) {
        bowlerStats[innings.currentBowlerId] = {
          overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0,
        };
      }
      const stats = { ...bowlerStats[innings.currentBowlerId] };
      stats.runs += totalRuns;
      if (isWicket) stats.wickets += 1;
      if (isWide) stats.wides += 1;
      if (isNoBall) stats.noBalls += 1;
      if (isLegalBall) {
        stats.balls += 1;
        if (stats.balls >= 6) {
          stats.overs += 1;
          stats.balls = 0;
        }
      }
      bowlerStats[innings.currentBowlerId] = stats;
      innings.bowlerStats = bowlerStats;
    }

    // Rotate strike on odd runs
    if (totalRuns % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    if (isLegalBall) {
      innings.currentBall += 1;
      if (innings.currentBall >= 6) {
        innings.currentBall = 0;
        innings.currentOver += 1;
      }
    }

    overs[currentOverIndex] = currentOver;
    innings.overs = overs;

    if (superOver.currentInnings === 1) {
      superOver.innings1 = innings;
    } else {
      superOver.innings2 = innings;
    }

    // Check if super over innings complete (1 over or all wickets)
    const isInningsComplete = innings.currentOver >= MATCH_CONSTANTS.SUPER_OVER_OVERS || 
                              innings.wickets >= MATCH_CONSTANTS.SUPER_OVER_WICKETS;
    
    // Check if 2nd innings chased target
    if (superOver.currentInnings === 2 && superOver.innings1) {
      const target = superOver.innings1.runs + 1;
      if (innings.runs >= target) {
        superOver.completed = true;
        toast.success('Target reached in Super Over!');
      }
    }

    match.superOver = superOver;
    
    const newState = {
      currentMatch: match,
      lastAction: { type: 'addSuperOverBall', previousState: matchState.currentMatch },
    };
    
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // Select batsman for super over
  const selectSuperOverBatsman = useCallback(async (playerId: string, isStriker: boolean) => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    const innings = superOver.currentInnings === 1 ? { ...superOver.innings1! } : { ...superOver.innings2! };
    
    if (isStriker) {
      innings.currentBatsmanId = playerId;
    } else {
      innings.nonStrikerBatsmanId = playerId;
    }
    
    if (!innings.batterStats[playerId]) {
      innings.batterStats = {
        ...innings.batterStats,
        [playerId]: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false },
      };
    }
    
    if (!innings.battingOrder.includes(playerId)) {
      innings.battingOrder = [...innings.battingOrder, playerId];
    }
    
    if (superOver.currentInnings === 1) {
      superOver.innings1 = innings;
    } else {
      superOver.innings2 = innings;
    }
    
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // Select bowler for super over
  const selectSuperOverBowler = useCallback(async (playerId: string) => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    const innings = superOver.currentInnings === 1 ? { ...superOver.innings1! } : { ...superOver.innings2! };
    
    innings.currentBowlerId = playerId;
    
    if (!innings.bowlerStats[playerId]) {
      innings.bowlerStats = {
        ...innings.bowlerStats,
        [playerId]: { overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noBalls: 0 },
      };
    }
    
    if (superOver.currentInnings === 1) {
      superOver.innings1 = innings;
    } else {
      superOver.innings2 = innings;
    }
    
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  // End super over (mark as completed)
  const endSuperOver = useCallback(async () => {
    if (!matchState.currentMatch?.superOver) return;
    
    const match = { ...matchState.currentMatch };
    const superOver = { ...match.superOver! };
    superOver.completed = true;
    match.superOver = superOver;
    
    const newState = { currentMatch: match, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [matchState, saveMatchState]);

  const getTeamStats = useCallback((tournamentId?: string): TeamStats[] => {
    const stats: Map<string, TeamStats> = new Map();
    
    const targetTeams = tournamentId
      ? teams.filter(t => (t.tournamentId || 'kapl-3-mens') === tournamentId)
      : teams;

    targetTeams.forEach(team => {
      stats.set(team.id, { 
        teamId: team.id, 
        matchesPlayed: 0, 
        wins: 0, 
        losses: 0, 
        totalRuns: 0,
        totalFours: 0,
        totalSixes: 0,
        totalWickets: 0,
        runsScored: 0,
        oversPlayed: 0,
        runsConceded: 0,
        oversBowled: 0,
        nrr: 0,
      });
    });

    // Helper to count boundaries from innings batter stats
    const countBoundaries = (innings: Innings | null) => {
      if (!innings?.batterStats) return { fours: 0, sixes: 0 };
      let fours = 0;
      let sixes = 0;
      Object.values(innings.batterStats).forEach(stats => {
        fours += stats.fours || 0;
        sixes += stats.sixes || 0;
      });
      return { fours, sixes };
    };

    // Helper to count wickets from innings bowler stats
    const countWickets = (innings: Innings | null) => {
      if (!innings?.bowlerStats) return 0;
      return Object.values(innings.bowlerStats).reduce((total, stats) => total + (stats.wickets || 0), 0);
    };

    // Helper to calculate overs in decimal format
    const getOversDecimal = (innings: Innings | null) => {
      if (!innings) return 0;
      return innings.currentOver + (innings.currentBall / 6);
    };

    matchHistory.forEach(match => {
      if (tournamentId) {
        const matchTourn = match.tournamentId || 'kapl-3-mens';
        if (matchTourn !== tournamentId && !stats.has(match.team1Id)) {
          return;
        }
      }

      if (match.status === 'completed') {
        const team1Stats = stats.get(match.team1Id);
        const team2Stats = stats.get(match.team2Id);
        
        const innings1 = match.innings1 as Innings | null;
        const innings2 = match.innings2 as Innings | null;
        
        // Team 1 batting stats from innings1, bowling stats from innings2
        const team1Batting = countBoundaries(innings1);
        const team1Bowling = countWickets(innings2);
        const team1OversPlayed = getOversDecimal(innings1);
        const team1OversBowled = getOversDecimal(innings2);
        
        // Team 2 batting stats from innings2, bowling stats from innings1
        const team2Batting = countBoundaries(innings2);
        const team2Bowling = countWickets(innings1);
        const team2OversPlayed = getOversDecimal(innings2);
        const team2OversBowled = getOversDecimal(innings1);
        
        if (team1Stats) {
          team1Stats.matchesPlayed += 1;
          team1Stats.totalRuns += innings1?.runs || 0;
          team1Stats.totalFours += team1Batting.fours;
          team1Stats.totalSixes += team1Batting.sixes;
          team1Stats.totalWickets += team1Bowling;
          team1Stats.runsScored += innings1?.runs || 0;
          team1Stats.oversPlayed += team1OversPlayed;
          team1Stats.runsConceded += innings2?.runs || 0;
          team1Stats.oversBowled += team1OversBowled;
          if (match.winner === match.team1Id) {
            team1Stats.wins += 1;
          } else if (match.winner) {
            team1Stats.losses += 1;
          }
        }
        if (team2Stats) {
          team2Stats.matchesPlayed += 1;
          team2Stats.totalRuns += innings2?.runs || 0;
          team2Stats.totalFours += team2Batting.fours;
          team2Stats.totalSixes += team2Batting.sixes;
          team2Stats.totalWickets += team2Bowling;
          team2Stats.runsScored += innings2?.runs || 0;
          team2Stats.oversPlayed += team2OversPlayed;
          team2Stats.runsConceded += innings1?.runs || 0;
          team2Stats.oversBowled += team1OversPlayed;
          if (match.winner === match.team2Id) {
            team2Stats.wins += 1;
          } else if (match.winner) {
            team2Stats.losses += 1;
          }
        }
      }
    });

    // Calculate NRR for each team
    stats.forEach((teamStats) => {
      if (teamStats.oversPlayed > 0 && teamStats.oversBowled > 0) {
        const runRate = teamStats.runsScored / teamStats.oversPlayed;
        const concededRate = teamStats.runsConceded / teamStats.oversBowled;
        teamStats.nrr = runRate - concededRate;
      }
    });

    return Array.from(stats.values());
  }, [teams, matchHistory]);

  const formatOvers = useCallback((over: number, ball: number) => {
    return `${over}.${ball}`;
  }, []);

  const resetSeason = useCallback(async () => {
    // Delete all match history
    const { error: historyError } = await supabase
      .from('match_history')
      .delete()
      .neq('id', '');

    if (historyError) {
      console.error('Error resetting match history:', historyError);
      return;
    }

    // Clear match state
    const newState = { currentMatch: null, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
    setMatchHistory([]);
    setPlayingPlayers({});
  }, [saveMatchState]);

  const resetEverything = useCallback(async () => {
    // Reset season first
    await resetSeason();

    // Reset teams to defaults
    for (const defaultTeam of DEFAULT_TEAMS) {
      const { error } = await supabase
        .from('teams')
        .update(teamToDb(defaultTeam))
        .eq('id', defaultTeam.id);

      if (error) {
        console.error('Error resetting team:', error);
      }
    }

    setTeams([...DEFAULT_TEAMS, ...DEFAULT_WOMENS_TEAMS]);
  }, [resetSeason]);

  return {
    teams,
    matchState,
    matchHistory,
    isLoaded,
    playingPlayers,
    updateTeam,
    getTeam,
    getTeamsByGroup,
    getTeamsByTournament,
    getPlayingPlayers,
    startMatch,
    getCurrentInnings,
    addBall,
    addNoBall,
    addDismissal,
    addRunOut,
    editBall,
    deleteBall,
    selectBatsman,
    selectBowler,
    undoLastBall,
    undoToBall,
    switchBattingTeam,
    swapStrike,
    endMatch,
    replacePlayer,
    getTeamStats,
    formatOvers,
    resetSeason,
    resetEverything,
    // Offline resilience
    isOnline,
    pendingOfflineChanges,
    isSyncing,
    syncOfflineQueue,
    // Super Over functions
    startSuperOver,
    switchSuperOverInnings,
    addSuperOverBall,
    selectSuperOverBatsman,
    selectSuperOverBowler,
    endSuperOver,
  };
}
