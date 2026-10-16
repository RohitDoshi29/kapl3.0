import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Match, MatchState, Innings, Ball, Player } from '@/lib/cricketTypes';
import type { Json } from '@/integrations/supabase/types';

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
});

export function useSecondaryScorer() {
  const [matchState, setMatchState] = useState<MatchState>({ currentMatch: null, lastAction: null });
  const [isLoaded, setIsLoaded] = useState(false);

  // Load secondary match state from database
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: stateData, error: stateError } = await supabase
          .from('secondary_match_state')
          .select('*')
          .eq('id', 'current')
          .single();
        
        if (stateError && stateError.code !== 'PGRST116') throw stateError;
        if (stateData) {
          setMatchState({
            currentMatch: stateData.current_match as unknown as Match | null,
            lastAction: stateData.last_action as unknown as MatchState['lastAction'],
          });
        }

        setIsLoaded(true);
      } catch (error) {
        console.error('Error loading secondary match state:', error);
        setIsLoaded(true);
      }
    };

    loadData();
  }, []);

  // Subscribe to realtime updates for secondary match state
  useEffect(() => {
    const channel = supabase
      .channel('secondary-scorer-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'secondary_match_state' },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newState = payload.new as any;
            setMatchState({
              currentMatch: newState.current_match as unknown as Match | null,
              lastAction: newState.last_action as unknown as MatchState['lastAction'],
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveMatchState = useCallback(async (newState: MatchState) => {
    // Try to upsert the match state
    const { error } = await supabase
      .from('secondary_match_state')
      .upsert({
        id: 'current',
        current_match: JSON.parse(JSON.stringify(newState.currentMatch)) as Json,
        last_action: JSON.parse(JSON.stringify(newState.lastAction)) as Json,
      });

    if (error) {
      console.error('Error saving secondary match state:', error);
    }
  }, []);

  const syncWithPrimaryMatch = useCallback(async (primaryMatch: Match | null) => {
    if (!primaryMatch) {
      const newState = { currentMatch: null, lastAction: null };
      setMatchState(newState);
      await saveMatchState(newState);
      return;
    }

    // Create a new match state for secondary scorer based on primary match setup
    const secondaryMatch: Match = {
      id: primaryMatch.id,
      group: primaryMatch.group,
      team1Id: primaryMatch.team1Id,
      team2Id: primaryMatch.team2Id,
      innings1: createInnings(primaryMatch.team1Id, primaryMatch.team2Id),
      innings2: null,
      currentInnings: 1,
      status: 'live',
      winner: null,
      matchType: primaryMatch.matchType,
    };

    const newState = { currentMatch: secondaryMatch, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [saveMatchState]);

  const addBall = useCallback(async (runs: number, isWicket = false, isWide = false, isNoBall = false, noStrikeChange = false) => {
    if (!matchState.currentMatch) return;
    
    const match = { ...matchState.currentMatch };
    const innings = match.currentInnings === 1 ? { ...match.innings1! } : { ...match.innings2! };
    const overs = [...innings.overs];
    const currentOverIndex = overs.length - 1;
    const currentOver = { ...overs[currentOverIndex], balls: [...overs[currentOverIndex].balls] };

    const ball: Ball = {
      id: Date.now().toString(),
      runs,
      isWicket,
      isWide,
      isNoBall,
      isExtra: isWide || isNoBall,
      batsmanId: innings.currentBatsmanId,
      bowlerId: innings.currentBowlerId,
    };

    currentOver.balls.push(ball);
    innings.runs += runs;
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
      stats.runs += isNoBall ? 0 : runs;
      stats.ballsFaced += 1;
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
          overs: 0,
          balls: 0,
          runs: 0,
          wickets: 0,
          wides: 0,
          noBalls: 0,
        };
      }
      const stats = { ...bowlerStats[innings.currentBowlerId] };
      stats.runs += runs;
      if (isWicket) stats.wickets += 1;
      if (isWide) stats.wides += 1;
      if (isNoBall) stats.noBalls += 1;
      
      if (!isWide && !isNoBall) {
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
    if (!noStrikeChange && runs % 2 === 1 && innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
      const temp = innings.currentBatsmanId;
      innings.currentBatsmanId = innings.nonStrikerBatsmanId;
      innings.nonStrikerBatsmanId = temp;
    }

    if (!isWide && !isNoBall) {
      innings.currentBall += 1;
      if (innings.currentBall >= 6) {
        innings.currentBall = 0;
        innings.currentOver += 1;
        overs.push({ number: innings.currentOver + 1, balls: [], bowlerId: undefined });
        
        // Rotate strike at end of over
        if (innings.currentBatsmanId && innings.nonStrikerBatsmanId) {
          const temp = innings.currentBatsmanId;
          innings.currentBatsmanId = innings.nonStrikerBatsmanId;
          innings.nonStrikerBatsmanId = temp;
        }
        
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
    
    const overs = [...innings.overs];
    if (overs.length > 0) {
      overs[overs.length - 1] = { ...overs[overs.length - 1], bowlerId: playerId };
      innings.overs = overs;
    }
    
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

  const endMatch = useCallback(async () => {
    const newState = { currentMatch: null, lastAction: null };
    setMatchState(newState);
    await saveMatchState(newState);
  }, [saveMatchState]);

  return {
    matchState,
    isLoaded,
    syncWithPrimaryMatch,
    addBall,
    selectBatsman,
    selectBowler,
    undoLastBall,
    switchBattingTeam,
    swapStrike,
    endMatch,
  };
}
