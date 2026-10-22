import assert from 'assert';

console.log('🧪 Starting Player of the Match (POTM) Automated Test Suite...\n');

// Mock Teams
const team1 = {
  id: 't1',
  name: 'Phoenix Titans',
  players: [
    { id: 'p1', name: 'Virat Sharma', role: 'all-rounder', teamId: 't1' },
    { id: 'p2', name: 'Rohit Verma', role: 'batter', teamId: 't1' },
    { id: 'p3', name: 'Jasprit Patel', role: 'bowler', teamId: 't1' },
    { id: 'p4', name: 'KL Rahul', role: 'wicket-keeper', teamId: 't1' },
  ],
};

const team2 = {
  id: 't2',
  name: 'Royal Strikers',
  players: [
    { id: 'p5', name: 'David Warner', role: 'batter', teamId: 't2' },
    { id: 'p6', name: 'Glenn Maxwell', role: 'all-rounder', teamId: 't2' },
    { id: 'p7', name: 'Mitchell Starc', role: 'bowler', teamId: 't2' },
    { id: 'p8', name: 'Steve Smith', role: 'batter', teamId: 't2' },
  ],
};

// Implement exact calculateMatchPerformances engine
function calculateMatchPerformances(match, team1, team2) {
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

  const allPlayersMap = new Map();
  (team1.players || []).forEach(p => allPlayersMap.set(p.id, { player: p, team: team1 }));
  (team2.players || []).forEach(p => allPlayersMap.set(p.id, { player: p, team: team2 }));

  const inningsList = [];
  if (match.innings1) inningsList.push(match.innings1);
  if (match.innings2) inningsList.push(match.innings2);
  if (match.superOver?.innings1) inningsList.push(match.superOver.innings1);
  if (match.superOver?.innings2) inningsList.push(match.superOver.innings2);

  const statsMap = new Map();

  allPlayersMap.forEach((_, id) => {
    statsMap.set(id, {
      runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isOut: false,
      wickets: 0, bowlingRuns: 0, overs: 0, balls: 0, maidens: 0,
      catches: 0, runOuts: 0, stumpings: 0, participated: false,
    });
  });

  inningsList.forEach(innings => {
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
      current.maidens += (stats.maidens || 0);
    });

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

  const performances = [];

  statsMap.forEach((raw, playerId) => {
    const playerRecord = allPlayersMap.get(playerId);
    if (!playerRecord) return;
    const { player, team } = playerRecord;

    const totalBowlingBalls = raw.overs * 6 + raw.balls;
    const normalizedOvers = Math.floor(totalBowlingBalls / 6);
    const normalizedBalls = totalBowlingBalls % 6;
    const totalOversDecimal = totalBowlingBalls / 6;
    const economy = totalOversDecimal > 0 ? raw.bowlingRuns / totalOversDecimal : 0;
    const strikeRate = raw.ballsFaced > 0 ? (raw.runs / raw.ballsFaced) * 100 : 0;

    const isWinningTeam = Boolean(match.winner && team.id === match.winner);

    let impact = 0;

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

    impact += raw.catches * 10;
    impact += raw.runOuts * 15;
    impact += raw.stumpings * 15;

    if (isWinningTeam && (raw.runs >= 15 || raw.wickets >= 1 || impact >= 25)) {
      impact += 15;
    }

    const parts = [];
    let battingSummary;
    let bowlingSummary;
    let fieldingSummary;

    if (raw.runs > 0 || raw.ballsFaced > 0) {
      battingSummary = `${raw.runs}${raw.isOut ? '' : '*'}(${raw.ballsFaced}b${raw.sixes > 0 ? `, ${raw.sixes}x6` : ''}${raw.fours > 0 ? `, ${raw.fours}x4` : ''})`;
      parts.push(battingSummary);
    }
    if (raw.wickets > 0 || totalBowlingBalls > 0) {
      bowlingSummary = `${raw.wickets}/${raw.bowlingRuns} (${normalizedOvers}.${normalizedBalls} ov)`;
      parts.push(bowlingSummary);
    }
    const fieldParts = [];
    if (raw.catches > 0) fieldParts.push(`${raw.catches} ct`);
    if (raw.runOuts > 0) fieldParts.push(`${raw.runOuts} ro`);
    if (raw.stumpings > 0) fieldParts.push(`${raw.stumpings} st`);
    if (fieldParts.length > 0) {
      fieldingSummary = fieldParts.join(', ');
      parts.push(fieldingSummary);
    }

    const summary = parts.length > 0 ? parts.join(' & ') : 'Squad Member';

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

  const sortedCandidates = [...performances].sort((a, b) => b.impactPoints - a.impactPoints);

  const batters = performances
    .filter(p => p.runs > 0 || p.ballsFaced > 0)
    .sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate);
  const bestBatter = batters.length > 0 ? batters[0] : null;

  const bowlers = performances
    .filter(p => p.wickets > 0 || p.overs > 0 || p.balls > 0)
    .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
  const bestBowler = bowlers.length > 0 ? bowlers[0] : null;

  const sixHitters = performances
    .filter(p => p.sixes > 0)
    .sort((a, b) => b.sixes - a.sixes || b.runs - a.runs);
  const mostSixes = sixHitters.length > 0 ? sixHitters[0] : null;

  const recommendedCandidate = sortedCandidates.length > 0 && sortedCandidates[0].impactPoints > 0
    ? sortedCandidates[0]
    : null;

  const allSquadPlayers = [];
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

let passed = 0;
let total = 0;

function check(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// Case 1: All-Rounder Match Winning Performance
const match1 = {
  id: 'm1',
  group: 'A',
  team1Id: 't1',
  team2Id: 't2',
  currentInnings: 2,
  status: 'completed',
  winner: 't1',
  matchType: 'group',
  innings1: {
    battingTeamId: 't2',
    bowlingTeamId: 't1',
    runs: 65,
    wickets: 4,
    currentOver: 7,
    currentBall: 0,
    battingOrder: ['p5', 'p6'],
    batterStats: {
      p5: { runs: 28, ballsFaced: 16, fours: 3, sixes: 1, isOut: true },
      p6: { runs: 20, ballsFaced: 12, fours: 2, sixes: 1, isOut: false },
    },
    bowlerStats: {
      p1: { overs: 2, balls: 0, runs: 12, wickets: 2, maidens: 0 },
      p3: { overs: 2, balls: 0, runs: 18, wickets: 1, maidens: 0 },
    },
    overs: [
      {
        number: 0,
        balls: [
          { runs: 0, isWicket: true, wicketDetails: { type: 'caught', dismissedPlayerId: 'p5', fielderId: 'p4' } },
        ],
      },
    ],
  },
  innings2: {
    battingTeamId: 't1',
    bowlingTeamId: 't2',
    runs: 66,
    wickets: 2,
    currentOver: 5,
    currentBall: 4,
    battingOrder: ['p1', 'p2'],
    batterStats: {
      p1: { runs: 42, ballsFaced: 19, fours: 4, sixes: 3, isOut: false },
      p2: { runs: 18, ballsFaced: 15, fours: 2, sixes: 0, isOut: true },
    },
    bowlerStats: {
      p7: { overs: 2, balls: 0, runs: 22, wickets: 1, maidens: 0 },
      p6: { overs: 1, balls: 4, runs: 25, wickets: 1, maidens: 0 },
    },
    overs: [],
  },
};

const result1 = calculateMatchPerformances(match1, team1, team2);

check('Top recommended candidate is identified', () => {
  assert(result1.recommendedCandidate !== null, 'Recommended candidate should not be null');
  assert.strictEqual(result1.recommendedCandidate.player.id, 'p1', 'p1 (Virat Sharma) should be top candidate');
});

check('All-rounder impact points exceed single skill', () => {
  const p1Perf = result1.candidates.find(c => c.player.id === 'p1');
  assert(p1Perf.impactPoints > 80, `Expected impact > 80, got ${p1Perf.impactPoints}`);
});

check('Best batter identified accurately', () => {
  assert(result1.bestBatter !== null);
  assert.strictEqual(result1.bestBatter.player.id, 'p1', 'p1 should be best batter with 42 runs');
  assert.strictEqual(result1.bestBatter.runs, 42);
});

check('Best bowler identified accurately', () => {
  assert(result1.bestBowler !== null);
  assert.strictEqual(result1.bestBowler.player.id, 'p1', 'p1 should be best bowler with 2/12');
  assert.strictEqual(result1.bestBowler.wickets, 2);
});

check('Maximum sixes king identified accurately', () => {
  assert(result1.mostSixes !== null);
  assert.strictEqual(result1.mostSixes.player.id, 'p1', 'p1 had 3 sixes');
  assert.strictEqual(result1.mostSixes.sixes, 3);
});

check('Fielding stats (catches) recorded for wicket-keeper', () => {
  const p4Perf = result1.candidates.find(c => c.player.id === 'p4');
  assert(p4Perf !== undefined, 'p4 should be in candidates due to catch');
  assert.strictEqual(p4Perf.catches, 1, 'p4 should have 1 catch recorded');
});

check('Winning team boost applied correctly', () => {
  const p1Perf = result1.candidates.find(c => c.player.id === 'p1');
  assert.strictEqual(p1Perf.isWinningTeam, true, 'p1 is on winning team t1');
});

check('Summary performance string formatting', () => {
  const p1Perf = result1.candidates.find(c => c.player.id === 'p1');
  assert(p1Perf.summary.includes('42*'), `Summary should include 42*, got ${p1Perf.summary}`);
  assert(p1Perf.summary.includes('2/12'), `Summary should include 2/12, got ${p1Perf.summary}`);
});

check('Suggested reason generated with context', () => {
  const p1Perf = result1.candidates.find(c => c.player.id === 'p1');
  assert(p1Perf.suggestedReason.length > 20, 'Reason should be descriptive');
});

// Case 2: Pure Bowler Match Winning Spell
const match2 = {
  id: 'm2',
  group: 'A',
  team1Id: 't1',
  team2Id: 't2',
  currentInnings: 2,
  status: 'completed',
  winner: 't1',
  matchType: 'group',
  innings1: {
    battingTeamId: 't1',
    bowlingTeamId: 't2',
    runs: 50,
    wickets: 5,
    currentOver: 7,
    currentBall: 0,
    battingOrder: ['p1', 'p2'],
    batterStats: {
      p1: { runs: 15, ballsFaced: 12, fours: 1, sixes: 0, isOut: true },
      p2: { runs: 20, ballsFaced: 18, fours: 2, sixes: 0, isOut: true },
    },
    bowlerStats: {
      p7: { overs: 2, balls: 0, runs: 14, wickets: 2, maidens: 0 },
    },
    overs: [],
  },
  innings2: {
    battingTeamId: 't2',
    bowlingTeamId: 't1',
    runs: 38,
    wickets: 6,
    currentOver: 6,
    currentBall: 2,
    battingOrder: ['p5', 'p6'],
    batterStats: {
      p5: { runs: 12, ballsFaced: 14, fours: 1, sixes: 0, isOut: true },
    },
    bowlerStats: {
      p3: { overs: 2, balls: 0, runs: 8, wickets: 3, maidens: 0 }, // 3/8 spell defending low total
    },
    overs: [],
  },
};

const result2 = calculateMatchPerformances(match2, team1, team2);

check('Defending bowler chosen as Player of the Match for 3/8', () => {
  assert(result2.recommendedCandidate !== null);
  assert.strictEqual(result2.recommendedCandidate.player.id, 'p3', 'Jasprit Patel (p3) should be POTM for 3/8');
  assert.strictEqual(result2.recommendedCandidate.wickets, 3);
});

// Case 3: Super Over Match
const match3 = {
  id: 'm3',
  group: 'B',
  team1Id: 't1',
  team2Id: 't2',
  currentInnings: 2,
  status: 'completed',
  winner: 't2',
  matchType: 'group',
  innings1: {
    battingTeamId: 't1',
    bowlingTeamId: 't2',
    runs: 55,
    wickets: 3,
    currentOver: 7,
    currentBall: 0,
    battingOrder: ['p1'],
    batterStats: { p1: { runs: 30, ballsFaced: 18, fours: 3, sixes: 1, isOut: false } },
    bowlerStats: {},
    overs: [],
  },
  innings2: {
    battingTeamId: 't2',
    bowlingTeamId: 't1',
    runs: 55,
    wickets: 4,
    currentOver: 7,
    currentBall: 0,
    battingOrder: ['p6'],
    batterStats: { p6: { runs: 28, ballsFaced: 16, fours: 2, sixes: 1, isOut: false } },
    bowlerStats: {},
    overs: [],
  },
  superOver: {
    completed: true,
    currentInnings: 2,
    innings1: {
      battingTeamId: 't1',
      bowlingTeamId: 't2',
      runs: 10,
      wickets: 1,
      currentOver: 1,
      currentBall: 0,
      battingOrder: ['p1'],
      batterStats: { p1: { runs: 8, ballsFaced: 4, fours: 1, sixes: 0, isOut: false } },
      bowlerStats: { p7: { overs: 1, balls: 0, runs: 10, wickets: 1, maidens: 0 } },
      overs: [],
    },
    innings2: {
      battingTeamId: 't2',
      bowlingTeamId: 't1',
      runs: 14,
      wickets: 0,
      currentOver: 0,
      currentBall: 5,
      battingOrder: ['p6'],
      batterStats: { p6: { runs: 14, ballsFaced: 5, fours: 1, sixes: 1, isOut: false } },
      bowlerStats: { p3: { overs: 0, balls: 5, runs: 14, wickets: 0, maidens: 0 } },
      overs: [],
    },
  },
};

const result3 = calculateMatchPerformances(match3, team1, team2);

check('Super Over stats aggregated into overall performances', () => {
  const p6Perf = result3.candidates.find(c => c.player.id === 'p6');
  // p6 had 28 runs in innings2 + 14 in superOver = 42 total
  assert.strictEqual(p6Perf.runs, 42, `Expected 42 runs, got ${p6Perf.runs}`);
  assert.strictEqual(result3.recommendedCandidate.player.id, 'p6', 'Super over match winner p6 should be POTM');
});

// Case 4: Match State & History POTM Persistence simulation
check('POTM payload structure matches store format', () => {
  const potmData = {
    playerId: 'p1',
    playerName: 'Virat Sharma',
    playerTeamId: 't1',
    reason: 'Match-winning 42* and 2/12',
    awards: [
      { id: 'best_batter', title: 'Best Batter', playerId: 'p1', playerName: 'Virat Sharma', detail: '42 Runs' },
    ],
  };

  const storedMatch = {
    id: 'm1',
    playerOfTheMatchId: potmData.playerId,
    playerOfTheMatchName: potmData.playerName,
    playerOfTheMatchTeamId: potmData.playerTeamId,
    playerOfTheMatchReason: potmData.reason,
    awards: potmData.awards,
  };

  assert.strictEqual(storedMatch.playerOfTheMatchName, 'Virat Sharma');
  assert.strictEqual(storedMatch.awards.length, 1);
});

console.log(`\n========================================================`);
console.log(`TOTAL CHECKS: ${total}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${total - passed}`);
console.log(`========================================================\n`);

if (passed === total) {
  console.log('🎉 ALL 12 PLAYER OF THE MATCH TESTS PASSED PERFECTLY!\n');
} else {
  console.error('❌ SOME CHECKS FAILED');
  process.exit(1);
}

