import * as XLSX from 'xlsx';
import { Match, Team, Innings, Ball } from '@/lib/cricketTypes';

export function exportMatchToExcel(match: Match, team1: Team, team2: Team) {
  const workbook = XLSX.utils.book_new();

  // Match Summary Sheet
  const summaryData = [
    ['MATCH SCORECARD'],
    [''],
    ['Match Details'],
    ['Teams', `${team1.name} vs ${team2.name}`],
    ['Match Type', match.matchType.toUpperCase()],
    ['Winner', match.winner === team1.id ? team1.name : match.winner === team2.id ? team2.name : 'Tie'],
    [''],
    ['Score Summary'],
    ['1st Innings', team1.name, `${match.innings1?.runs || 0}/${match.innings1?.wickets || 0}`, `(${match.innings1?.currentOver || 0}.${match.innings1?.currentBall || 0} overs)`],
    ['2nd Innings', team2.name, `${match.innings2?.runs || 0}/${match.innings2?.wickets || 0}`, `(${match.innings2?.currentOver || 0}.${match.innings2?.currentBall || 0} overs)`],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // 1st Innings Batting & Bowling
  if (match.innings1) {
    createBattingSheet(workbook, match.innings1, team1, '1st Inn Batting');
    createBowlingSheet(workbook, match.innings1, team2, '1st Inn Bowling');
  }

  // 2nd Innings Batting & Bowling
  if (match.innings2) {
    createBattingSheet(workbook, match.innings2, team2, '2nd Inn Batting');
    createBowlingSheet(workbook, match.innings2, team1, '2nd Inn Bowling');
  }

  // Detailed Over by Over with ball-by-ball
  createDetailedOverSheet(workbook, match, team1, team2);

  // Player Performance Summary
  createPlayerSummarySheet(workbook, match, team1, team2);

  // Download
  const fileName = `${team1.name}_vs_${team2.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

function createBattingSheet(workbook: XLSX.WorkBook, innings: Innings, battingTeam: Team, sheetName: string) {
  const data: (string | number)[][] = [];

  data.push(['BATTING SCORECARD - ' + battingTeam.name]);
  data.push(['']);
  data.push(['Batsman', 'Runs', 'Balls', '4s', '6s', 'Strike Rate', 'Status']);

  let totalRuns = 0;
  let totalBalls = 0;
  let totalFours = 0;
  let totalSixes = 0;

  innings.battingOrder.forEach((playerId) => {
    const player = battingTeam.players.find(p => p.id === playerId);
    const stats = innings.batterStats[playerId];
    if (player && stats) {
      const sr = stats.ballsFaced > 0 ? ((stats.runs / stats.ballsFaced) * 100).toFixed(1) : '0.0';
      data.push([
        player.name,
        stats.runs,
        stats.ballsFaced,
        stats.fours,
        stats.sixes,
        sr,
        stats.isOut ? 'OUT' : 'NOT OUT'
      ]);
      totalRuns += stats.runs;
      totalBalls += stats.ballsFaced;
      totalFours += stats.fours;
      totalSixes += stats.sixes;
    }
  });

  data.push(['']);
  data.push(['TOTAL', totalRuns, totalBalls, totalFours, totalSixes, '', `${innings.wickets} wickets`]);
  data.push(['']);
  data.push(['Total Score', `${innings.runs}/${innings.wickets} (${innings.currentOver}.${innings.currentBall} ov)`]);
  data.push(['Total Score', `${innings.runs}/${innings.wickets} (${innings.currentOver}.${innings.currentBall} ov)`]);

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

function createBowlingSheet(workbook: XLSX.WorkBook, innings: Innings, bowlingTeam: Team, sheetName: string) {
  const data: (string | number)[][] = [];

  data.push(['BOWLING FIGURES - ' + bowlingTeam.name]);
  data.push(['']);
  data.push(['Bowler', 'Overs', 'Runs', 'Wickets', 'Wides', 'No Balls', 'Economy', 'Avg']);

  Object.entries(innings.bowlerStats).forEach(([playerId, stats]) => {
    const player = bowlingTeam.players.find(p => p.id === playerId);
    if (player) {
      const totalOvers = stats.overs + (stats.balls / 6);
      const economy = totalOvers > 0 ? (stats.runs / totalOvers).toFixed(2) : '0.00';
      const avg = stats.wickets > 0 ? (stats.runs / stats.wickets).toFixed(2) : '-';
      data.push([
        player.name,
        `${stats.overs}.${stats.balls}`,
        stats.runs,
        stats.wickets,
        stats.wides || 0,
        stats.noBalls || 0,
        economy,
        avg
      ]);
    }
  });

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
}

function createDetailedOverSheet(workbook: XLSX.WorkBook, match: Match, team1: Team, team2: Team) {
  const data: (string | number)[][] = [];

  const getBallLabel = (ball: Ball): string => {
    if (ball.isWicket) return 'W';
    if (ball.isWide) return `Wd+${ball.runs}`;
    if (ball.isNoBall) return `Nb+${ball.runs}`;
    return ball.runs.toString();
  };

  const processInnings = (innings: Innings | null, battingTeam: Team, bowlingTeam: Team, inningsNum: number) => {
    if (!innings) return;

    data.push([`${inningsNum === 1 ? '1ST' : '2ND'} INNINGS - ${battingTeam.name} BATTING`]);
    data.push(['']);
    data.push(['Over', 'Bowler', 'Ball', 'Batsman', 'Runs', 'Type', 'Score After', 'Commentary']);

    let runningScore = 0;
    let runningWickets = 0;

    innings.overs.forEach((over) => {
      const bowler = over.bowlerId ? bowlingTeam.players.find(p => p.id === over.bowlerId) : null;

      over.balls.forEach((ball, ballIdx) => {
        const batsman = ball.batsmanId ? battingTeam.players.find(p => p.id === ball.batsmanId) : null;
        
        runningScore += ball.runs;
        if (ball.isWicket) runningWickets++;

        let ballType = 'Normal';
        if (ball.isWicket) ballType = 'WICKET';
        else if (ball.isWide) ballType = 'Wide';
        else if (ball.isNoBall) ballType = 'No Ball';
        else if (ball.runs === 4) ballType = 'FOUR';
        else if (ball.runs === 6) ballType = 'SIX';

        let commentary = '';
        if (ball.isWicket) commentary = `${batsman?.name || 'Batsman'} OUT!`;
        else if (ball.runs === 6) commentary = `SIX by ${batsman?.name || 'Batsman'}!`;
        else if (ball.runs === 4) commentary = `FOUR by ${batsman?.name || 'Batsman'}!`;
        else if (ball.runs === 0) commentary = 'Dot ball';
        else commentary = `${ball.runs} run${ball.runs > 1 ? 's' : ''}`;

        data.push([
          over.number + 1,
          bowler?.name || 'Unknown',
          `${over.number}.${ballIdx + 1}`,
          batsman?.name || 'Unknown',
          getBallLabel(ball),
          ballType,
          `${runningScore}/${runningWickets}`,
          commentary
        ]);
      });

      // Over summary row
      const overRuns = over.balls.reduce((sum, ball) => sum + ball.runs, 0);
      const wicketsInOver = over.balls.filter(b => b.isWicket).length;
      data.push(['', '', '', `--- End of Over ${over.number + 1} ---`, '', '', `${overRuns} runs, ${wicketsInOver} wkt`, '']);
    });

    data.push(['']);
    data.push(['INNINGS TOTAL', '', '', '', innings.runs, '', `${innings.wickets} wickets`, `${innings.currentOver}.${innings.currentBall} overs`]);
    data.push(['']);
    data.push(['']);
  };

  processInnings(match.innings1, team1, team2, 1);
  processInnings(match.innings2, team2, team1, 2);

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 8 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Ball by Ball');
}

function createPlayerSummarySheet(workbook: XLSX.WorkBook, match: Match, team1: Team, team2: Team) {
  const data: (string | number)[][] = [];

  data.push(['PLAYER PERFORMANCE SUMMARY']);
  data.push(['']);

  const processTeam = (team: Team, battingInnings: Innings | null, bowlingInnings: Innings | null) => {
    data.push([`${team.name.toUpperCase()}`]);
    data.push(['Player', 'Bat Runs', 'Bat Balls', 'Bat SR', '4s', '6s', 'Bowl Overs', 'Bowl Runs', 'Wickets', 'Economy', 'Role']);

    team.players.forEach(player => {
      const batStats = battingInnings?.batterStats[player.id];
      const bowlStats = bowlingInnings?.bowlerStats[player.id];

      const batRuns = batStats?.runs || 0;
      const batBalls = batStats?.ballsFaced || 0;
      const batSR = batBalls > 0 ? ((batRuns / batBalls) * 100).toFixed(1) : '-';
      const fours = batStats?.fours || 0;
      const sixes = batStats?.sixes || 0;

      const bowlOvers = bowlStats ? `${bowlStats.overs}.${bowlStats.balls}` : '-';
      const bowlRuns = bowlStats?.runs || 0;
      const wickets = bowlStats?.wickets || 0;
      const totalOvers = bowlStats ? bowlStats.overs + (bowlStats.balls / 6) : 0;
      const economy = totalOvers > 0 ? (bowlRuns / totalOvers).toFixed(2) : '-';

      let role = '';
      if (batStats && bowlStats) role = 'All-rounder';
      else if (batStats) role = 'Batsman';
      else if (bowlStats) role = 'Bowler';

      if (batStats || bowlStats) {
        data.push([
          player.name,
          batRuns,
          batBalls,
          batSR,
          fours,
          sixes,
          bowlOvers,
          bowlRuns || '-',
          wickets || '-',
          economy,
          role
        ]);
      }
    });

    data.push(['']);
  };

  processTeam(team1, match.innings1, match.innings2);
  processTeam(team2, match.innings2, match.innings1);

  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 5 }, { wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Player Summary');
}
