import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCricketStore } from '@/hooks/useCricketStore';
import { PlayerRecord, PlayerRole, Team, Match, MatchType, MATCH_TYPE_LABELS, Innings } from '@/lib/cricketTypes';
import { MOCK_AUCTION_PLAYERS, generateAuctionPlayers } from '@/lib/mockPlayersData';

export interface PlayerCareerBatting {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highestScore: number;
  notOuts: number;
  strikeRate: number;
  average: number;
  thirties: number;
  fifties: number;
  ducks: number;
  dots: number;
}

export interface PlayerCareerBowling {
  overs: number;
  ballsBowled: number;
  maidens: number;
  runsGiven: number;
  wickets: number;
  economy: number;
  bowlingAverage: number;
  strikeRate: number;
  bestBowling: { wickets: number; runs: number };
  wides: number;
  noBalls: number;
  threeWicketHauls: number;
}

export interface PlayerMatchLog {
  matchId: string;
  date: string;
  matchType: MatchType;
  matchTypeLabel: string;
  playerTeam?: Team | null;
  opponentTeam?: Team | null;
  isLive?: boolean;
  status: string;
  resultLabel: string;
  // Batting
  didBat: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalType?: string;
  dismissalDescription?: string;
  dismissalFielderName?: string;
  // Bowling
  didBowl: boolean;
  overs: number;
  ballsInOver: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  maidens: number;
  wides: number;
  noBalls: number;
}

export interface RadarMetric {
  subject: string;
  value: number;
  fullMark: number;
}

export function usePlayerStats(playerId: string | undefined, tournamentIdFilter?: string) {
  const { teams, matchHistory, matchState, getTeam } = useCricketStore();
  const [dbPlayer, setDbPlayer] = useState<PlayerRecord | null>(() => {
    return MOCK_AUCTION_PLAYERS.find(p => p.id === playerId) || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !MOCK_AUCTION_PLAYERS.some(p => p.id === playerId));

  // Fetch player record from database (or find in teams)
  useEffect(() => {
    if (!playerId) {
      setDbPlayer(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchPlayer = async () => {
      try {
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', playerId)
          .maybeSingle();

        if (error) {
          console.warn('Error fetching player by id:', error);
        }

        if (data && isMounted) {
          setDbPlayer({
            id: data.id,
            tournamentId: data.tournament_id || 'kapl-3-mens',
            teamId: data.team_id,
            name: data.name,
            role: (data.role as PlayerRole) || 'all_rounder',
            battingStyle: data.batting_style || 'Right-hand bat',
            bowlingStyle: data.bowling_style || 'Right-arm medium',
            photoUrl: data.photo_url,
            basePrice: Number(data.base_price || 100),
            soldPrice: data.sold_price ? Number(data.sold_price) : null,
            auctionStatus: (data.auction_status as any) || 'pending',
            jerseyNumber: data.jersey_number,
            mobileNumber: data.mobile_number,
          });
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Network error loading player from DB:', err);
      }

      // Fallback: search in teams or mock auction players
      if (isMounted) {
        let foundRecord: PlayerRecord | null = null;
        for (const t of teams) {
          const found = t.players?.find(p => p.id === playerId);
          if (found) {
            foundRecord = {
              id: found.id,
              tournamentId: t.tournamentId || 'kapl-3-mens',
              teamId: t.id,
              name: found.name,
              role: found.role || 'all_rounder',
              battingStyle: found.battingStyle || 'Right-hand bat',
              bowlingStyle: found.bowlingStyle || 'Right-arm medium',
              photoUrl: found.photo,
              basePrice: found.basePrice || 100,
              soldPrice: found.soldPrice || null,
              auctionStatus: found.auctionStatus || (found.soldPrice ? 'sold' : 'pending'),
              jerseyNumber: null,
            };
            break;
          }
        }
        if (!foundRecord) {
          foundRecord = MOCK_AUCTION_PLAYERS.find(p => p.id === playerId) || null;
        }
        if (foundRecord) {
          setDbPlayer(foundRecord);
        }
        setIsLoading(false);
      }
    };

    fetchPlayer();

    return () => {
      isMounted = false;
    };
  }, [playerId, teams]);

  // Resolve team
  const playerTeam = useMemo(() => {
    if (!dbPlayer) return null;
    if (dbPlayer.teamId) {
      return getTeam(dbPlayer.teamId) || teams.find(t => t.id === dbPlayer.teamId) || null;
    }
    return teams.find(t => t.players?.some(p => p.id === dbPlayer.id)) || null;
  }, [dbPlayer, teams, getTeam]);

  // Aggregate stats across matches
  const { battingStats, bowlingStats, matchLogs, radarData } = useMemo(() => {
    const defaultBatting: PlayerCareerBatting = {
      matches: 0,
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      highestScore: 0,
      notOuts: 0,
      strikeRate: 0,
      average: 0,
      thirties: 0,
      fifties: 0,
      ducks: 0,
      dots: 0,
    };

    const defaultBowling: PlayerCareerBowling = {
      overs: 0,
      ballsBowled: 0,
      maidens: 0,
      runsGiven: 0,
      wickets: 0,
      economy: 0,
      bowlingAverage: 0,
      strikeRate: 0,
      bestBowling: { wickets: 0, runs: 0 },
      wides: 0,
      noBalls: 0,
      threeWicketHauls: 0,
    };

    if (!playerId) {
      return {
        battingStats: defaultBatting,
        bowlingStats: defaultBowling,
        matchLogs: [] as PlayerMatchLog[],
        radarData: [] as RadarMetric[],
      };
    }

    // Combine completed matches and current live match if applicable
    const allMatches: { match: Match; isLive: boolean }[] = [];
    if (matchState.currentMatch && matchState.currentMatch.status === 'live') {
      allMatches.push({ match: matchState.currentMatch, isLive: true });
    }
    matchHistory.forEach(m => {
      allMatches.push({ match: m, isLive: false });
    });

    const batting = { ...defaultBatting };
    const bowling = { ...defaultBowling };
    const logs: PlayerMatchLog[] = [];
    const participatedMatchIds = new Set<string>();

    allMatches.forEach(({ match, isLive }) => {
      // Filter tournament if requested
      if (tournamentIdFilter && (match.tournamentId || 'kapl-3-mens') !== tournamentIdFilter) {
        return;
      }

      const team1 = getTeam(match.team1Id);
      const team2 = getTeam(match.team2Id);

      // Determine which team this player was on
      const isTeam1 = team1?.players?.some(p => p.id === playerId);
      const isTeam2 = team2?.players?.some(p => p.id === playerId);
      if (!isTeam1 && !isTeam2 && !(match as any).playingPlayers?.[match.team1Id]?.includes(playerId) && !(match as any).playingPlayers?.[match.team2Id]?.includes(playerId)) {
        // Player not in this match
        return;
      }

      const myTeam = isTeam1 ? team1 : team2;
      const oppTeam = isTeam1 ? team2 : team1;

      participatedMatchIds.add(match.id);

      // Check innings for batting & bowling
      const inningsList: (Innings | null)[] = [match.innings1, match.innings2];

      let matchBatted = false;
      let matchRuns = 0;
      let matchBalls = 0;
      let matchFours = 0;
      let matchSixes = 0;
      let matchIsOut = false;
      let matchDismissalType = '';
      let matchDismissalDesc = '';
      let matchFielderName = '';

      let matchBowled = false;
      let matchBowlerOvers = 0;
      let matchBowlerBalls = 0;
      let matchRunsGiven = 0;
      let matchWickets = 0;
      let matchWides = 0;
      let matchNoBalls = 0;
      let matchMaidens = 0;

      inningsList.forEach(inn => {
        if (!inn) return;

        // Check if player batted
        if (inn.batterStats && inn.batterStats[playerId]) {
          const bs = inn.batterStats[playerId];
          matchBatted = true;
          matchRuns = bs.runs || 0;
          matchBalls = bs.ballsFaced || 0;
          matchFours = bs.fours || 0;
          matchSixes = bs.sixes || 0;
          matchIsOut = Boolean(bs.isOut);
          matchDismissalType = bs.dismissalType || '';
          matchDismissalDesc = bs.dismissalDescription || '';
          if (bs.dismissalFielderId) {
            const fielder = oppTeam?.players?.find(p => p.id === bs.dismissalFielderId);
            matchFielderName = fielder ? fielder.name : '';
          }
        }

        // Check if player bowled
        if (inn.bowlerStats && inn.bowlerStats[playerId]) {
          const bw = inn.bowlerStats[playerId];
          matchBowled = true;
          matchBowlerOvers = bw.overs || 0;
          matchBowlerBalls = bw.balls || 0;
          matchRunsGiven = bw.runs || 0;
          matchWickets = bw.wickets || 0;
          matchWides = bw.wides || 0;
          matchNoBalls = bw.noBalls || 0;

          // Check maiden: if bowled at least 6 balls in over and 0 runs conceded in that over
          const playerOvers = inn.overs.filter(o => o.bowlerId === playerId);
          playerOvers.forEach(o => {
            const legalBalls = o.balls.filter(b => !b.isWide && !b.isNoBall);
            const overRuns = o.balls.reduce((acc, b) => acc + b.runs, 0);
            if (legalBalls.length >= 6 && overRuns === 0) {
              matchMaidens += 1;
            }
          });
        }
      });

      // Update career totals
      if (matchBatted) {
        batting.innings += 1;
        batting.runs += matchRuns;
        batting.balls += matchBalls;
        batting.fours += matchFours;
        batting.sixes += matchSixes;
        if (!matchIsOut) {
          batting.notOuts += 1;
        } else {
          if (matchRuns === 0) batting.ducks += 1;
        }
        if (matchRuns > batting.highestScore) {
          batting.highestScore = matchRuns;
        }
        if (matchRuns >= 50) {
          batting.fifties += 1;
        } else if (matchRuns >= 30) {
          batting.thirties += 1;
        }
      }

      if (matchBowled) {
        const legalBalls = matchBowlerOvers * 6 + matchBowlerBalls;
        bowling.ballsBowled += legalBalls;
        bowling.runsGiven += matchRunsGiven;
        bowling.wickets += matchWickets;
        bowling.wides += matchWides;
        bowling.noBalls += matchNoBalls;
        bowling.maidens += matchMaidens;

        if (matchWickets >= 3) {
          bowling.threeWicketHauls += 1;
        }

        // Check best bowling figures
        if (
          matchWickets > bowling.bestBowling.wickets ||
          (matchWickets === bowling.bestBowling.wickets && matchRunsGiven < bowling.bestBowling.runs)
        ) {
          bowling.bestBowling = { wickets: matchWickets, runs: matchRunsGiven };
        }
      }

      // Determine match result label
      let resultLabel = 'In Progress';
      if (match.status === 'completed') {
        if (match.winner === myTeam?.id) {
          resultLabel = 'Won';
        } else if (match.winner) {
          resultLabel = 'Lost';
        } else {
          resultLabel = 'Tied';
        }
      }

      // Push match log
      logs.push({
        matchId: match.id,
        date: (match as any).created_at || (match as any).createdAt || 'Season 2026',
        matchType: match.matchType || 'group',
        matchTypeLabel: MATCH_TYPE_LABELS[match.matchType || 'group'] || 'Match',
        playerTeam: myTeam,
        opponentTeam: oppTeam,
        isLive,
        status: match.status,
        resultLabel,
        // Batting
        didBat: matchBatted,
        runs: matchRuns,
        balls: matchBalls,
        fours: matchFours,
        sixes: matchSixes,
        strikeRate: matchBalls > 0 ? Number(((matchRuns / matchBalls) * 100).toFixed(1)) : 0,
        isOut: matchIsOut,
        dismissalType: matchDismissalType,
        dismissalDescription: matchDismissalDesc,
        dismissalFielderName: matchFielderName,
        // Bowling
        didBowl: matchBowled,
        overs: matchBowlerOvers,
        ballsInOver: matchBowlerBalls,
        runsConceded: matchRunsGiven,
        wickets: matchWickets,
        economy: (matchBowlerOvers + matchBowlerBalls / 6) > 0
          ? Number((matchRunsGiven / (matchBowlerOvers + matchBowlerBalls / 6)).toFixed(2))
          : 0,
        maidens: matchMaidens,
        wides: matchWides,
        noBalls: matchNoBalls,
      });
    });

    // Finalize Batting Career Metrics
    batting.matches = participatedMatchIds.size;
    batting.strikeRate = batting.balls > 0 ? Number(((batting.runs / batting.balls) * 100).toFixed(1)) : 0;
    const timesOut = batting.innings - batting.notOuts;
    batting.average = timesOut > 0 ? Number((batting.runs / timesOut).toFixed(1)) : batting.runs;

    // Finalize Bowling Career Metrics
    const totalOversDecimal = Math.floor(bowling.ballsBowled / 6) + (bowling.ballsBowled % 6) / 10;
    const totalOversForMath = bowling.ballsBowled / 6;
    bowling.overs = totalOversDecimal;
    bowling.economy = totalOversForMath > 0 ? Number((bowling.runsGiven / totalOversForMath).toFixed(2)) : 0;
    bowling.bowlingAverage = bowling.wickets > 0 ? Number((bowling.runsGiven / bowling.wickets).toFixed(1)) : 0;
    bowling.strikeRate = bowling.wickets > 0 ? Number((bowling.ballsBowled / bowling.wickets).toFixed(1)) : 0;

    // Generate Performance Radar Chart data (Normalized 0 to 100)
    // 1. Scoring Power: Sixes & Fours frequency
    const boundaryRuns = batting.fours * 4 + batting.sixes * 6;
    const powerScore = batting.runs > 0 ? Math.min(100, Math.round((boundaryRuns / batting.runs) * 100 + batting.sixes * 8)) : 30;

    // 2. Scoring Rate: Strike Rate benchmarked against 180 SR = 100
    const srScore = batting.balls > 0 ? Math.min(100, Math.max(20, Math.round((batting.strikeRate / 180) * 100))) : 35;

    // 3. Batting Stability: Average & notOuts
    const stabilityScore = batting.innings > 0 ? Math.min(100, Math.round(batting.average * 2.5 + batting.notOuts * 15)) : 25;

    // 4. Wicket Threat: Wickets per match / balls per wicket
    const wicketScore = bowling.ballsBowled > 0
      ? Math.min(100, Math.round((bowling.wickets / Math.max(1, batting.matches)) * 40 + bowling.wickets * 12))
      : 20;

    // 5. Bowling Economy: Sub 6.0 = 100, 8.0 = 75, 10.0 = 50, 12.0 = 30
    const economyScore = bowling.ballsBowled > 0
      ? Math.min(100, Math.max(15, Math.round(100 - (bowling.economy - 4) * 10)))
      : 30;

    // 6. Match Impact: Composite total impact
    const impactScore = Math.min(
      100,
      Math.max(
        25,
        Math.round(
          batting.runs * 1.5 +
          bowling.wickets * 18 +
          batting.fifties * 25 +
          batting.thirties * 12 +
          bowling.maidens * 15 +
          (participatedMatchIds.size > 0 ? 20 : 0)
        )
      )
    );

    const radar: RadarMetric[] = [
      { subject: 'Scoring Power', value: powerScore, fullMark: 100 },
      { subject: 'Strike Rate', value: srScore, fullMark: 100 },
      { subject: 'Consistency', value: stabilityScore, fullMark: 100 },
      { subject: 'Wicket Threat', value: wicketScore, fullMark: 100 },
      { subject: 'Economy', value: economyScore, fullMark: 100 },
      { subject: 'Match Impact', value: impactScore, fullMark: 100 },
    ];

    return {
      battingStats: batting,
      bowlingStats: bowling,
      matchLogs: logs,
      radarData: radar,
    };
  }, [playerId, matchHistory, matchState.currentMatch, getTeam, tournamentIdFilter]);

  return {
    player: dbPlayer,
    team: playerTeam,
    battingStats,
    bowlingStats,
    matchLogs,
    radarData,
    isLoading,
  };
}

export interface PlayerDirectoryItem {
  id: string;
  name: string;
  tournamentId: string;
  teamId?: string | null;
  teamName?: string | null;
  teamLogo?: string | null;
  teamColor?: string | null;
  role: PlayerRole;
  battingStyle?: string;
  bowlingStyle?: string;
  photoUrl?: string | null;
  basePrice: number;
  soldPrice?: number | null;
  auctionStatus: 'pending' | 'sold' | 'unsold';
  jerseyNumber?: number | null;
  mobileNumber?: string | null;
  // Aggregated cricket performance
  matchesPlayed: number;
  runs: number;
  ballsFaced: number;
  strikeRate: number;
  battingAverage: number;
  highestScore: number;
  fours: number;
  sixes: number;
  wickets: number;
  overs: number;
  runsConceded: number;
  economy: number;
  bestBowling: string;
}

export function usePlayersDirectory(tournamentIdFilter?: string) {
  const { teams, matchHistory, matchState, getTeam } = useCricketStore();

  // Initialize immediately with the 80 mock players so the directory is NEVER blank or stuck loading
  const [rawPlayers, setRawPlayers] = useState<PlayerRecord[]>(() => {
    const tid = (!tournamentIdFilter || tournamentIdFilter === 'all') ? 'kapl-3-mens' : tournamentIdFilter;
    try {
      const raw = localStorage.getItem(`kapl_auction_players_${tid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.length === 80 && !parsed.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
          return parsed;
        }
      }
    } catch {}
    return generateAuctionPlayers(tid);
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync with Supabase in background without resetting UI state
  useEffect(() => {
    let isMounted = true;

    async function loadDbPlayers() {
      try {
        let query = supabase.from('players').select('*');
        if (tournamentIdFilter && tournamentIdFilter !== 'all') {
          query = query.eq('tournament_id', tournamentIdFilter);
        }
        const { data: dbData, error } = await query.order('name');
        if (error) {
          console.warn('Error loading players for directory from DB:', error);
          return;
        }

        const isLegacyDbData = Boolean(dbData && dbData.length > 0 && dbData.some((p) => /^[ab][1-4]-/.test(p.id)));

        let loaded: PlayerRecord[] = [];
        if (dbData && dbData.length > 0 && !isLegacyDbData) {
          loaded = dbData.map((p) => ({
            id: p.id,
            tournamentId: p.tournament_id || 'kapl-3-mens',
            teamId: p.team_id,
            name: p.name,
            role: (p.role as PlayerRole) || 'all_rounder',
            battingStyle: p.batting_style || 'Right-hand bat',
            bowlingStyle: p.bowling_style || 'Right-arm medium',
            photoUrl: p.photo_url,
            basePrice: Number(p.base_price || 100),
            soldPrice: p.sold_price ? Number(p.sold_price) : null,
            auctionStatus: (p.auction_status as any) || 'pending',
            jerseyNumber: p.jersey_number,
            mobileNumber: p.mobile_number,
          }));
        } else {
          const tid = (!tournamentIdFilter || tournamentIdFilter === 'all') ? 'kapl-3-mens' : tournamentIdFilter;
          try {
            const raw = localStorage.getItem(`kapl_auction_players_${tid}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed.length === 80 && !parsed.some((p: any) => /^[ab][1-4]-/.test(p.id))) {
                loaded = parsed;
              }
            }
          } catch {}
          if (loaded.length === 0) {
            loaded = generateAuctionPlayers(tid);
          }
        }

        if (isMounted && loaded.length > 0) {
          setRawPlayers(loaded);
        }
      } catch (err) {
        console.error('Failed to load players directory:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDbPlayers();

    return () => {
      isMounted = false;
    };
  }, [tournamentIdFilter]);

  // Reactive player directory aggregation (instantly recomputes when match state or teams change)
  const players = useMemo<PlayerDirectoryItem[]>(() => {
    const playerMap = new Map<string, PlayerRecord>();
    rawPlayers.forEach(p => playerMap.set(p.id, p));

    // Supplement from teams store (e.g. women's league or unpersisted teams)
    teams.forEach(team => {
      if (tournamentIdFilter && tournamentIdFilter !== 'all' && (team.tournamentId || 'kapl-3-mens') !== tournamentIdFilter) {
        return;
      }
      (team.players || []).forEach(p => {
        if (!playerMap.has(p.id)) {
          playerMap.set(p.id, {
            id: p.id,
            tournamentId: team.tournamentId || 'kapl-3-mens',
            teamId: team.id,
            name: p.name,
            role: p.role || 'all_rounder',
            battingStyle: p.battingStyle || 'Right-hand bat',
            bowlingStyle: p.bowlingStyle || 'Right-arm medium',
            photoUrl: p.photo,
            basePrice: p.basePrice || 100,
            soldPrice: p.soldPrice || null,
            auctionStatus: p.auctionStatus || (p.soldPrice ? 'sold' : 'pending'),
            jerseyNumber: null,
          });
        }
      });
    });

    // Aggregate match stats across all completed and live matches
    const allMatches: Match[] = [];
    if (matchState.currentMatch && (matchState.currentMatch as any)?.id !== '1792091739936') {
      allMatches.push(matchState.currentMatch);
    }
    matchHistory.forEach(m => allMatches.push(m));

    interface StatAccumulator {
      matchIds: Set<string>;
      runs: number;
      ballsFaced: number;
      timesOut: number;
      highestScore: number;
      fours: number;
      sixes: number;
      ballsBowled: number;
      runsConceded: number;
      wickets: number;
      bestWickets: number;
      bestRuns: number;
    }

    const statsAccum = new Map<string, StatAccumulator>();
    const getAccum = (id: string): StatAccumulator => {
      let acc = statsAccum.get(id);
      if (!acc) {
        acc = {
          matchIds: new Set(),
          runs: 0,
          ballsFaced: 0,
          timesOut: 0,
          highestScore: 0,
          fours: 0,
          sixes: 0,
          ballsBowled: 0,
          runsConceded: 0,
          wickets: 0,
          bestWickets: 0,
          bestRuns: 999,
        };
        statsAccum.set(id, acc);
      }
      return acc;
    };

    allMatches.forEach(match => {
      const inningsList = [match.innings1, match.innings2].filter(Boolean) as Innings[];
      inningsList.forEach(innings => {
        // Batsmen
        const batterStats = innings.batterStats || {};
        Object.values(batterStats).forEach(b => {
          if (!b?.id) return;
          const acc = getAccum(b.id);
          acc.matchIds.add(match.id);
          acc.runs += b.runs || 0;
          acc.ballsFaced += b.balls || 0;
          acc.fours += b.fours || 0;
          acc.sixes += b.sixes || 0;
          if (b.runs > acc.highestScore) {
            acc.highestScore = b.runs;
          }
          if (b.isOut) {
            acc.timesOut += 1;
          }
        });

        // Bowlers
        const bowlerStats = innings.bowlerStats || {};
        Object.values(bowlerStats).forEach(bowler => {
          if (!bowler?.id) return;
          const acc = getAccum(bowler.id);
          acc.matchIds.add(match.id);
          const balls = (bowler.overs || 0) * 6 + (bowler.balls || 0);
          acc.ballsBowled += balls;
          acc.runsConceded += bowler.runsConceded || 0;
          acc.wickets += bowler.wickets || 0;

          if (
            bowler.wickets > acc.bestWickets ||
            (bowler.wickets === acc.bestWickets && bowler.runsConceded < acc.bestRuns)
          ) {
            acc.bestWickets = bowler.wickets;
            acc.bestRuns = bowler.runsConceded;
          }
        });
      });
    });

    return Array.from(playerMap.values()).map(p => {
      const acc = statsAccum.get(p.id);
      const assignedTeam = p.teamId
        ? getTeam(p.teamId) || teams.find(t => t.id === p.teamId)
        : teams.find(t => t.players?.some(pl => pl.id === p.id));

      const runs = acc?.runs || 0;
      const balls = acc?.ballsFaced || 0;
      const timesOut = acc?.timesOut || 0;
      const strikeRate = balls > 0 ? Number(((runs / balls) * 100).toFixed(1)) : 0;
      const battingAverage = timesOut > 0 ? Number((runs / timesOut).toFixed(1)) : runs;
      const ballsBowled = acc?.ballsBowled || 0;
      const overs = Math.floor(ballsBowled / 6) + (ballsBowled % 6) / 10;
      const runsConceded = acc?.runsConceded || 0;
      const wickets = acc?.wickets || 0;
      const economy = ballsBowled > 0 ? Number(((runsConceded / ballsBowled) * 6).toFixed(2)) : 0;
      const bestBowling = acc && acc.bestWickets > 0 ? `${acc.bestWickets}/${acc.bestRuns}` : '-';

      return {
        id: p.id,
        name: p.name,
        tournamentId: p.tournamentId,
        teamId: assignedTeam?.id || p.teamId || null,
        teamName: assignedTeam?.name || null,
        teamLogo: assignedTeam?.logo || null,
        teamColor: assignedTeam?.primaryColor || null,
        role: p.role,
        battingStyle: p.battingStyle,
        bowlingStyle: p.bowlingStyle,
        photoUrl: p.photoUrl,
        basePrice: p.basePrice,
        soldPrice: p.soldPrice,
        auctionStatus: p.auctionStatus,
        jerseyNumber: p.jerseyNumber,
        mobileNumber: p.mobileNumber,
        matchesPlayed: acc?.matchIds.size || 0,
        runs,
        ballsFaced: balls,
        strikeRate,
        battingAverage,
        highestScore: acc?.highestScore || 0,
        fours: acc?.fours || 0,
        sixes: acc?.sixes || 0,
        wickets,
        overs,
        runsConceded,
        economy,
        bestBowling,
      };
    });
  }, [rawPlayers, teams, matchHistory, matchState.currentMatch, getTeam, tournamentIdFilter]);

  return {
    players,
    isLoading,
  };
}

