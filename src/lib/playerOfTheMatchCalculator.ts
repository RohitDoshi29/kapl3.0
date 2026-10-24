import { Match, Team, Player, Innings } from './cricketTypes';

export interface PlayerPerformance {
  player: Player;
  team: Team;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  wickets: number;
  bowlingRuns: number;
  overs: number;
  balls: number;
  maidens: number;
  economy: number;
  catches: number;
  runOuts: number;
  stumpings: number;
  impactPoints: number;
  summary: string;
  battingSummary?: string;
  bowlingSummary?: string;
  fieldingSummary?: string;
  suggestedReason: string;
  isWinningTeam: boolean;
}

export interface MatchPerformancesResult {
  recommendedCandidate: PlayerPerformance | null;
  candidates: PlayerPerformance[];
  bestBatter: PlayerPerformance | null;
  bestBowler: PlayerPerformance | null;
  mostSixes: PlayerPerformance | null;
  allSquadPlayers: { player: Player; team: Team }[];
}

/**
 * Calculates comprehensive match performances and algorithmic Player of the Match recommendations
 */
export function calculateMatchPerformances(
  match: Match | null,
  team1: Team | undefined,
  team2: Team | undefined
): MatchPerformancesResult {
  if (!match || !team1 || !team2) {
    return {
      recommendedCandidate: null,
      candidates: [],
      bestBatter: null,
      bestBowler: null,
      mostSixes: null,
      allSquadPlayers: [],
    };
  }

  const allPlayersMap = new Map<string, { player: Player; team: Team }>();
  (team1.players || []).forEach(p => allPlayersMap.set(p.id, { player: p, team: team1 }));
  (team2.players || []).forEach(p => allPlayersMap.set(p.id, { player: p, team: team2 }));

  const inningsList: Innings[] = [];
  if (match.innings1) inningsList.push(match.innings1);
  if (match.innings2) inningsList.push(match.innings2);
  if (match.superOver?.innings1) inningsList.push(match.superOver.innings1);
  if (match.superOver?.innings2) inningsList.push(match.superOver.innings2);

  // Map to accumulate stats per playerId
  const statsMap = new Map<string, {
    runs: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
    isOut: boolean;
    wickets: number;
    bowlingRuns: number;
    overs: number;
    balls: number;
    maidens: number;
    catches: number;
    runOuts: number;
    stumpings: number;
    participated: boolean;
  }>();

  // Initialize all players
  allPlayersMap.forEach((_, id) => {
    statsMap.set(id, {
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      isOut: false,
      wickets: 0,
      bowlingRuns: 0,
      overs: 0,
      balls: 0,
      maidens: 0,
      catches: 0,
      runOuts: 0,
      stumpings: 0,
      participated: false,
    });
  });

  // Accumulate batting & bowling stats
  inningsList.forEach(innings => {
    // Batting
    Object.entries(innings.batterStats || {}).forEach(([playerId, stats]) => {
      let current = statsMap.get(playerId);
      if (!current) {
        current = {
          runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
          wickets: 0, bowlingRuns: 0, overs: 0, balls: 0, maidens: 0,
          catches: 0, runOuts: 0, stumpings: 0, participated: true,
        };
        statsMap.set(playerId, current);
      }
      current.participated = true;
      current.runs += (stats.runs || 0);
      current.ballsFaced += (stats.ballsFaced || 0);
      current.fours += (stats.fours || 0);
      current.sixes += (stats.sixes || 0);
      if (stats.isOut) current.isOut = true;
    });

    // Bowling
    Object.entries(innings.bowlerStats || {}).forEach(([playerId, stats]) => {
      let current = statsMap.get(playerId);
      if (!current) {
        current = {
          runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
          wickets: 0, bowlingRuns: 0, overs: 0, balls: 0, maidens: 0,
          catches: 0, runOuts: 0, stumpings: 0, participated: true,
        };
        statsMap.set(playerId, current);
      }
      current.participated = true;
      current.wickets += (stats.wickets || 0);
      current.bowlingRuns += (stats.runs || 0);
      current.overs += (stats.overs || 0);
      current.balls += (stats.balls || 0);

      let maidens = stats.maidens;
      if (maidens === undefined) {
        const playerOvers = (innings.overs || []).filter(o => o.bowlerId === playerId);
        maidens = playerOvers.filter(o => {
          const legalBalls = (o.balls || []).filter(b => !b.isWide && !b.isNoBall);
          const overRuns = (o.balls || []).reduce((acc, b) => acc + (b.runs || 0), 0);
          return legalBalls.length >= 6 && overRuns === 0;
        }).length;
      }
      current.maidens += (maidens || 0);
    });

    // Fielding events from overs
    (innings.overs || []).forEach(over => {
      (over.balls || []).forEach(ball => {
        if (ball.wicketDetails?.fielderId) {
          const fielderId = ball.wicketDetails.fielderId;
          let current = statsMap.get(fielderId);
          if (!current) {
            current = {
              runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
              wickets: 0, bowlingRuns: 0, overs: 0, balls: 0, maidens: 0,
              catches: 0, runOuts: 0, stumpings: 0, participated: true,
            };
            statsMap.set(fielderId, current);
          }
          current.participated = true;
          if (ball.wicketDetails.type === 'caught') current.catches++;
          else if (ball.wicketDetails.type === 'run_out') current.runOuts++;
          else if (ball.wicketDetails.type === 'stumped') current.stumpings++;
        }
      });
    });
  });

  const performances: PlayerPerformance[] = [];

  statsMap.forEach((raw, playerId) => {
    const playerRecord = allPlayersMap.get(playerId);
    if (!playerRecord) return;
    const { player, team } = playerRecord;

    // Normalize overs and balls
    const totalBowlingBalls = raw.overs * 6 + raw.balls;
    const normalizedOvers = Math.floor(totalBowlingBalls / 6);
    const normalizedBalls = totalBowlingBalls % 6;
    const totalOversDecimal = totalBowlingBalls / 6;
    const economy = totalOversDecimal > 0 ? raw.bowlingRuns / totalOversDecimal : 0;
    const strikeRate = raw.ballsFaced > 0 ? (raw.runs / raw.ballsFaced) * 100 : 0;

    const isWinningTeam = Boolean(match.winner && team.id === match.winner);

    // Compute Impact Points
    let impact = 0;

    // 1. Batting Impact
    if (raw.runs > 0 || raw.ballsFaced > 0) {
      impact += raw.runs * 1;
      impact += raw.fours * 1;
      impact += raw.sixes * 2.5;

      if (raw.runs >= 15 && strikeRate >= 180) impact += 12;
      else if (raw.runs >= 15 && strikeRate >= 140) impact += 6;

      if (raw.runs >= 50) impact += 30;
      else if (raw.runs >= 30) impact += 15;
      else if (raw.runs >= 20) impact += 8;

      if (!raw.isOut && raw.runs >= 15) impact += 6;
    }

    // 2. Bowling Impact
    if (raw.wickets > 0 || totalBowlingBalls > 0) {
      impact += raw.wickets * 25;
      if (raw.wickets >= 3) impact += 25;
      else if (raw.wickets >= 2) impact += 12;

      if (totalBowlingBalls >= 6) {
        if (economy <= 5.0) impact += 15;
        else if (economy <= 7.0) impact += 8;
        else if (economy > 12.0) impact -= 5;
      }
      impact += raw.maidens * 15;
    }

    // 3. Fielding Impact
    impact += raw.catches * 10;
    impact += raw.runOuts * 15;
    impact += raw.stumpings * 15;

    // 4. Winning Team Boost
    if (isWinningTeam && (raw.runs >= 15 || raw.wickets >= 1 || impact >= 25)) {
      impact += 15;
    }

    // Summary formatting
    const parts: string[] = [];
    let battingSummary: string | undefined;
    let bowlingSummary: string | undefined;
    let fieldingSummary: string | undefined;

    if (raw.runs > 0 || raw.ballsFaced > 0) {
      battingSummary = `${raw.runs}${raw.isOut ? '' : '*'}(${raw.ballsFaced}b${raw.sixes > 0 ? `, ${raw.sixes}x6` : ''}${raw.fours > 0 ? `, ${raw.fours}x4` : ''})`;
      parts.push(battingSummary);
    }
    if (raw.wickets > 0 || totalBowlingBalls > 0) {
      bowlingSummary = `${raw.wickets}/${raw.bowlingRuns} (${normalizedOvers}.${normalizedBalls} ov)`;
      parts.push(bowlingSummary);
    }
    const fieldParts: string[] = [];
    if (raw.catches > 0) fieldParts.push(`${raw.catches} ct`);
    if (raw.runOuts > 0) fieldParts.push(`${raw.runOuts} ro`);
    if (raw.stumpings > 0) fieldParts.push(`${raw.stumpings} st`);
    if (fieldParts.length > 0) {
      fieldingSummary = fieldParts.join(', ');
      parts.push(fieldingSummary);
    }

    const summary = parts.length > 0 ? parts.join(' & ') : 'Squad Member';

    // Citation Generation
    let suggestedReason = '';
    if (raw.runs >= 20 && raw.wickets >= 2) {
      suggestedReason = `Sensational all-round match-winning display with ${raw.runs}${raw.isOut ? '' : '*'} runs and ${raw.wickets}/${raw.bowlingRuns} bowling figures.`;
    } else if (raw.runs >= 30) {
      suggestedReason = `Match-winning batting masterclass smashing ${raw.runs}${raw.isOut ? '' : '*'} off ${raw.ballsFaced} balls (SR: ${strikeRate.toFixed(1)}).`;
    } else if (raw.wickets >= 3) {
      suggestedReason = `Devastating bowling spell taking ${raw.wickets} wickets for ${raw.bowlingRuns} runs (Econ: ${economy.toFixed(2)}).`;
    } else if (raw.wickets >= 2) {
      suggestedReason = `Decisive bowling spell claiming ${raw.wickets}/${raw.bowlingRuns} to break the opposition momentum.`;
    } else if (raw.runs >= 20) {
      suggestedReason = `Crucial match contribution scoring ${raw.runs}${raw.isOut ? '' : '*'} off ${raw.ballsFaced} balls under pressure.`;
    } else if (raw.catches >= 2 || raw.runOuts >= 1) {
      suggestedReason = `Outstanding fielding performance creating game-changing breakthroughs.`;
    } else {
      suggestedReason = `Valuable performance (${summary}) contributing to ${team.name}.`;
    }

    performances.push({
      player,
      team,
      runs: raw.runs,
      ballsFaced: raw.ballsFaced,
      fours: raw.fours,
      sixes: raw.sixes,
      strikeRate,
      isOut: raw.isOut,
      wickets: raw.wickets,
      bowlingRuns: raw.bowlingRuns,
      overs: normalizedOvers,
      balls: normalizedBalls,
      maidens: raw.maidens,
      economy,
      catches: raw.catches,
      runOuts: raw.runOuts,
      stumpings: raw.stumpings,
      impactPoints: Math.round(impact * 10) / 10,
      summary,
      battingSummary,
      bowlingSummary,
      fieldingSummary,
      suggestedReason,
      isWinningTeam,
    });
  });

  // Sort candidates by impact points descending
  const sortedCandidates = [...performances].sort((a, b) => b.impactPoints - a.impactPoints);

  // Best Batter: max runs, tiebreak strikeRate
  const batters = performances
    .filter(p => p.runs > 0 || p.ballsFaced > 0)
    .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate);
  const bestBatter = batters.length > 0 ? batters[0] : null;

  // Best Bowler: max wickets, tiebreak economy
  const bowlers = performances
    .filter(p => p.wickets > 0 || p.overs > 0 || p.balls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
  const bestBowler = bowlers.length > 0 ? bowlers[0] : null;

  // Maximum Sixes King
  const sixHitters = performances
    .filter(p => p.sixes > 0)
    .sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
  const mostSixes = sixHitters.length > 0 ? sixHitters[0] : null;

  // Recommended Candidate
  const recommendedCandidate = sortedCandidates.length > 0 && sortedCandidates[0].impactPoints > 0
    ? sortedCandidates[0]
    : null;

  const allSquadPlayers: { player: Player; team: Team }[] = [];
  (team1.players || []).forEach(p => allSquadPlayers.push({ player: p, team: team1 }));
  (team2.players || []).forEach(p => allSquadPlayers.push({ player: p, team: team2 }));

  return {
    recommendedCandidate,
    candidates: sortedCandidates.filter(p => p.impactPoints > 0),
    bestBatter,
    bestBowler,
    mostSixes,
    allSquadPlayers,
  };
}

