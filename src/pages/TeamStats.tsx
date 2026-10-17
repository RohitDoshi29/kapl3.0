import { useState } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Innings, PlayerStats, BowlerStats } from '@/lib/cricketTypes';
import { Users, TrendingUp, Target } from 'lucide-react';
import { TournamentHonors } from '@/components/cricket/TournamentHonors';
import { TournamentSwitcher } from '@/components/cricket/TournamentSwitcher';


interface AggregatedPlayerStats {
  playerId: string;
  playerName: string;
  playerPhoto: string | null;
  teamId: string;
  teamName: string;
  matchesPlayed: number;
  // Batting
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  timesOut: number;
  highestScore: number;
  // Bowling
  overs: number;
  balls: number;
  runsConceded: number;
  wickets: number;
  wides: number;
  noBalls: number;
  bestBowling: { wickets: number; runs: number };
}

export default function TeamStats() {
  const { teams, matchHistory, getTeam } = useCricketStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');

  // Aggregate player stats from all matches
  const aggregatedStats: Map<string, AggregatedPlayerStats> = new Map();

  matchHistory
    .filter(m => m.status === 'completed')
    .forEach(match => {
      const team1 = getTeam(match.team1Id);
      const team2 = getTeam(match.team2Id);
      const innings1 = match.innings1 as Innings | null;
      const innings2 = match.innings2 as Innings | null;

      // Process innings1 (team1 batting)
      if (innings1 && team1) {
        // Batting stats
        Object.entries(innings1.batterStats || {}).forEach(([playerId, stats]) => {
          const player = team1.players.find(p => p.id === playerId);
          if (!player) return;

          const existing = aggregatedStats.get(playerId) || createEmptyStats(playerId, player.name, player.photo, team1.id, team1.name);
          existing.runs += stats.runs;
          existing.ballsFaced += stats.ballsFaced;
          existing.fours += stats.fours;
          existing.sixes += stats.sixes;
          if (stats.isOut) existing.timesOut += 1;
          existing.highestScore = Math.max(existing.highestScore, stats.runs);
          existing.matchesPlayed += 1;
          aggregatedStats.set(playerId, existing);
        });
      }

      // Process innings2 (team2 batting)
      if (innings2 && team2) {
        Object.entries(innings2.batterStats || {}).forEach(([playerId, stats]) => {
          const player = team2.players.find(p => p.id === playerId);
          if (!player) return;

          const existing = aggregatedStats.get(playerId) || createEmptyStats(playerId, player.name, player.photo, team2.id, team2.name);
          existing.runs += stats.runs;
          existing.ballsFaced += stats.ballsFaced;
          existing.fours += stats.fours;
          existing.sixes += stats.sixes;
          if (stats.isOut) existing.timesOut += 1;
          existing.highestScore = Math.max(existing.highestScore, stats.runs);
          existing.matchesPlayed += 1;
          aggregatedStats.set(playerId, existing);
        });
      }

      // Process bowling from innings1 (team2 bowled)
      if (innings1 && team2) {
        Object.entries(innings1.bowlerStats || {}).forEach(([playerId, stats]) => {
          const player = team2.players.find(p => p.id === playerId);
          if (!player) return;

          const existing = aggregatedStats.get(playerId) || createEmptyStats(playerId, player.name, player.photo, team2.id, team2.name);
          existing.overs += stats.overs;
          existing.balls += stats.balls;
          existing.runsConceded += stats.runs;
          existing.wickets += stats.wickets;
          existing.wides += stats.wides;
          existing.noBalls += stats.noBalls;
          if (stats.wickets > existing.bestBowling.wickets ||
            (stats.wickets === existing.bestBowling.wickets && stats.runs < existing.bestBowling.runs)) {
            existing.bestBowling = { wickets: stats.wickets, runs: stats.runs };
          }
          aggregatedStats.set(playerId, existing);
        });
      }

      // Process bowling from innings2 (team1 bowled)
      if (innings2 && team1) {
        Object.entries(innings2.bowlerStats || {}).forEach(([playerId, stats]) => {
          const player = team1.players.find(p => p.id === playerId);
          if (!player) return;

          const existing = aggregatedStats.get(playerId) || createEmptyStats(playerId, player.name, player.photo, team1.id, team1.name);
          existing.overs += stats.overs;
          existing.balls += stats.balls;
          existing.runsConceded += stats.runs;
          existing.wickets += stats.wickets;
          existing.wides += stats.wides;
          existing.noBalls += stats.noBalls;
          if (stats.wickets > existing.bestBowling.wickets ||
            (stats.wickets === existing.bestBowling.wickets && stats.runs < existing.bestBowling.runs)) {
            existing.bestBowling = { wickets: stats.wickets, runs: stats.runs };
          }
          aggregatedStats.set(playerId, existing);
        });
      }
    });

  function createEmptyStats(
    playerId: string,
    playerName: string,
    playerPhoto: string | null,
    teamId: string,
    teamName: string
  ): AggregatedPlayerStats {
    return {
      playerId,
      playerName,
      playerPhoto,
      teamId,
      teamName,
      matchesPlayed: 0,
      runs: 0,
      ballsFaced: 0,
      fours: 0,
      sixes: 0,
      timesOut: 0,
      highestScore: 0,
      overs: 0,
      balls: 0,
      runsConceded: 0,
      wickets: 0,
      wides: 0,
      noBalls: 0,
      bestBowling: { wickets: 0, runs: 0 },
    };
  }

  const allPlayers = Array.from(aggregatedStats.values()).filter(p => p.matchesPlayed > 0);
  const filteredPlayers = selectedTeamId === 'all'
    ? allPlayers
    : allPlayers.filter(p => p.teamId === selectedTeamId);

  const battingLeaders = [...filteredPlayers].sort((a, b) => b.runs - a.runs).slice(0, 10);
  const bowlingLeaders = [...filteredPlayers].filter(p => p.wickets > 0 || p.overs > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 10);

  const formatOvers = (overs: number, balls: number) => `${overs}.${balls}`;
  const getStrikeRate = (runs: number, balls: number) => balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0';
  const getBattingAvg = (runs: number, timesOut: number) => timesOut > 0 ? (runs / timesOut).toFixed(2) : runs.toFixed(2);
  const getEconomy = (runs: number, overs: number, balls: number) => {
    const totalOvers = overs + balls / 6;
    return totalOvers > 0 ? (runs / totalOvers).toFixed(2) : '0.00';
  };

  return (
    <div className="relative min-h-screen bg-background pb-20 md:pb-8">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />

      <main className="relative z-10 container mx-auto px-4 py-6 space-y-6">
        {/* Tournament Honors: Orange Cap, Purple Cap & Maximum Sixes */}
        <TournamentHonors />

        {/* Team Filter */}
        <Card className="border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-xl">
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-white/[0.06] bg-white/[0.01]">
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <Users className="w-5 h-5 text-amber-400" />
              Tournament <span className="text-gradient-gold">Leaderboard</span>
            </CardTitle>
            <TournamentSwitcher size="sm" />
          </CardHeader>
          <CardContent className="pt-4">
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger className="w-full md:w-64 bg-white/[0.04] border-white/10 rounded-xl">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {allPlayers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No player statistics available yet. Complete some matches to see stats.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Batting Leaders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <TrendingUp className="w-5 h-5" />
                  Batting Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 md:p-6 pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">Player</TableHead>
                        <TableHead className="text-xs md:text-sm">Team</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">M</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">Runs</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">Balls</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">HS</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">4s</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">6s</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">Avg</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">SR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {battingLeaders.map((player, index) => {
                        const team = getTeam(player.teamId);
                        return (
                          <TableRow key={player.playerId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6 md:w-8 md:h-8">
                                  <AvatarImage src={player.playerPhoto || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {player.playerName.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-xs md:text-sm">{player.playerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {team && <TeamBadge team={team} size="sm" showName={false} />}
                            </TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{player.matchesPlayed}</TableCell>
                            <TableCell className="text-center font-bold text-xs md:text-sm">{player.runs}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{player.ballsFaced}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{player.highestScore}</TableCell>
                            <TableCell className="text-center text-amber-600 text-xs md:text-sm">{player.fours}</TableCell>
                            <TableCell className="text-center text-purple-600 text-xs md:text-sm">{player.sixes}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{getBattingAvg(player.runs, player.timesOut)}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{getStrikeRate(player.runs, player.ballsFaced)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Bowling Leaders */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                  <Target className="w-5 h-5" />
                  Bowling Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2 md:p-6 pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm">Player</TableHead>
                        <TableHead className="text-xs md:text-sm">Team</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">O</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">R</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">W</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">BB</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">Wd</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">NB</TableHead>
                        <TableHead className="text-center text-xs md:text-sm">Econ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bowlingLeaders.map((player) => {
                        const team = getTeam(player.teamId);
                        return (
                          <TableRow key={player.playerId}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-6 h-6 md:w-8 md:h-8">
                                  <AvatarImage src={player.playerPhoto || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {player.playerName.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-xs md:text-sm">{player.playerName}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {team && <TeamBadge team={team} size="sm" showName={false} />}
                            </TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{formatOvers(player.overs, player.balls)}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{player.runsConceded}</TableCell>
                            <TableCell className="text-center font-bold text-xs md:text-sm">{player.wickets}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">
                              {player.bestBowling.wickets}/{player.bestBowling.runs}
                            </TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{player.wides}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">{player.noBalls}</TableCell>
                            <TableCell className="text-center text-xs md:text-sm">
                              {getEconomy(player.runsConceded, player.overs, player.balls)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {bowlingLeaders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No bowling statistics available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
