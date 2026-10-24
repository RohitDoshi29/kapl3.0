import { Link, useLocation } from 'react-router-dom';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
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
import { cn } from '@/lib/utils';
import { MATCH_TYPE_LABELS } from '@/lib/cricketTypes';
import { Badge } from '@/components/ui/badge';
import { MatchFixturesCalendar } from '@/components/cricket/MatchFixturesCalendar';
import { Trophy, GitBranch, BarChart3 } from 'lucide-react';

export default function PointsTable() {
  const location = useLocation();
  const { teams, getTeamStats, getTeam, matchHistory } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();

  const tournamentTeams = (teams || []).filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);
  const stats = getTeamStats(activeTournamentId);

  const groupATeams = tournamentTeams.filter(t => t.group === 'A');
  const groupBTeams = tournamentTeams.filter(t => t.group === 'B');

  const getTeamStatsSorted = (groupTeams: typeof teams) => {
    return (groupTeams || [])
      .map(team => {
        const teamStats = (stats || []).find(s => s.teamId === team.id);
        const points = teamStats?.points ?? (teamStats?.wins ? teamStats.wins * 2 : 0);
        return {
          team,
          matchesPlayed: teamStats?.matchesPlayed || 0,
          wins: teamStats?.wins || 0,
          losses: teamStats?.losses || 0,
          ties: teamStats?.ties || 0,
          points,
          totalRuns: teamStats?.totalRuns || 0,
          totalFours: teamStats?.totalFours || 0,
          totalSixes: teamStats?.totalSixes || 0,
          totalWickets: teamStats?.totalWickets || 0,
          nrr: teamStats?.nrr || 0,
        };
      })
      // Sort by points first, then wins, then NRR for tiebreaker
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.nrr - a.nrr;
      });
  };

  const renderTable = (title: string, groupTeams: typeof teams) => {
    const sortedTeams = getTeamStatsSorted(groupTeams);

    return (
      <Card className="overflow-hidden border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-xl">
        <CardHeader className="pb-3 md:pb-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg font-display">
              <span
                className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: `hsl(${groupTeams[0]?.primaryColor})`, color: `hsl(${groupTeams[0]?.primaryColor})` }}
              />
              {title}
            </CardTitle>
            <span className="text-[11px] font-medium text-muted-foreground">
              Top 2 advance to Playoffs
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-white/[0.06] bg-white/[0.01]">
                  <TableHead className="w-8 sm:w-10 text-xs md:text-sm font-bold text-center">#</TableHead>
                  <TableHead className="text-xs md:text-sm font-bold min-w-[120px]">Team</TableHead>
                  <TableHead className="text-center text-xs md:text-sm font-bold px-1.5 sm:px-3">M</TableHead>
                  <TableHead className="text-center text-xs md:text-sm font-bold text-emerald-400 px-1.5 sm:px-3">W</TableHead>
                  <TableHead className="text-center text-xs md:text-sm font-bold text-red-400 px-1.5 sm:px-3">L</TableHead>
                  <TableHead className="hidden sm:table-cell text-center text-xs md:text-sm font-bold text-blue-400">T</TableHead>
                  <TableHead className="hidden sm:table-cell text-center text-xs md:text-sm font-bold text-amber-400">4s</TableHead>
                  <TableHead className="hidden sm:table-cell text-center text-xs md:text-sm font-bold text-purple-400">6s</TableHead>
                  <TableHead className="hidden md:table-cell text-center text-xs md:text-sm font-bold text-red-400">Wkts</TableHead>
                  <TableHead className="text-center text-xs md:text-sm font-bold px-1.5 sm:px-3">NRR</TableHead>
                  <TableHead className="text-right text-xs md:text-sm font-bold pr-3 sm:pr-4">Pts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTeams.map((item, index) => {
                  const isQualifying = index < 2;
                  return (
                    <TableRow
                      key={item.team.id}
                      className={cn(
                        'border-b border-white/[0.04] transition-colors hover:bg-white/[0.04]',
                        isQualifying && 'bg-emerald-500/[0.03]'
                      )}
                    >
                      <TableCell className="font-bold text-xs md:text-sm text-center px-1">
                        {isQualifying ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-black shadow-xs">
                            {index + 1}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{index + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <TeamBadge team={item.team} size="sm" showName={false} />
                          <span className="font-bold text-foreground text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">
                            {item.team.shortName || item.team.name}
                          </span>
                          {isQualifying && (
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/30 shrink-0">
                              Q
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs md:text-sm font-medium px-1.5 sm:px-3">{item.matchesPlayed}</TableCell>
                      <TableCell className="text-center text-emerald-400 font-bold text-xs md:text-sm px-1.5 sm:px-3">{item.wins}</TableCell>
                      <TableCell className="text-center text-red-400 font-semibold text-xs md:text-sm px-1.5 sm:px-3">{item.losses}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-blue-400 font-semibold text-xs md:text-sm">{item.ties}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-xs md:text-sm text-amber-400 font-medium">{item.totalFours}</TableCell>
                      <TableCell className="hidden sm:table-cell text-center text-xs md:text-sm text-purple-400 font-medium">{item.totalSixes}</TableCell>
                      <TableCell className="hidden md:table-cell text-center text-xs md:text-sm text-red-400 font-medium">{item.totalWickets}</TableCell>
                      <TableCell
                        className={cn(
                          'text-center text-xs md:text-sm font-semibold font-mono px-1.5 sm:px-3',
                          item.nrr > 0 ? 'text-emerald-400' : item.nrr < 0 ? 'text-red-400' : 'text-muted-foreground'
                        )}
                      >
                        {item.nrr > 0 ? '+' : ''}{item.nrr.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right font-black text-sm md:text-base text-amber-400 pr-3 sm:pr-4 font-display">
                        {item.points}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const completedMatches = matchHistory.filter(m => {
    if (m.status !== 'completed') return false;
    const tId = m.tournamentId || getTeam(m.team1Id)?.tournamentId || 'kapl-3-mens';
    return tId === activeTournamentId;
  });

  return (
    <div className="relative min-h-screen bg-background pb-24 md:pb-8">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />
      <MultiMatchLiveBar />

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 md:py-6 space-y-5 md:space-y-6">
        {/* Tournament Sub-Navigation (Standings, Bracket, Stats) */}
        <div className="flex items-center gap-1.5 p-1 bg-white/[0.04] border border-white/10 rounded-2xl w-full max-w-lg mx-auto">
          <Link
            to="/points"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-center py-2 px-2.5 rounded-xl text-xs font-bold transition-all touch-manipulation",
              location.pathname === '/points'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs font-black"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Points Table</span>
          </Link>
          <Link
            to="/bracket"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-center py-2 px-2.5 rounded-xl text-xs font-bold transition-all touch-manipulation",
              location.pathname === '/bracket'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs font-black"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <GitBranch className="w-3.5 h-3.5 text-amber-400" />
            <span>Playoffs Bracket</span>
          </Link>
          <Link
            to="/stats"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-center py-2 px-2.5 rounded-xl text-xs font-bold transition-all touch-manipulation",
              location.pathname === '/stats'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs font-black"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Team Stats</span>
          </Link>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground font-display tracking-tight">
              {currentTournament?.name || "Tournament"} <span className="text-gradient-gold">Standings</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live group rankings, win rates, net run rate (NRR), and knockout qualifiers
            </p>
          </div>
          <Badge variant="gold" className="self-start sm:self-auto text-xs font-bold px-3 py-1">
            {currentTournament?.gender === 'women' ? '👑 Women\'s Division' : '🏏 Men\'s Division'}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {renderTable('Group A', groupATeams)}
          {renderTable('Group B', groupBTeams)}
        </div>

        {/* Match History */}
        {completedMatches.length > 0 && (
          <Card className="overflow-hidden border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-3 md:pb-4 border-b border-white/[0.06] bg-white/[0.02]">
              <CardTitle className="text-base md:text-lg font-display">Completed Tournament Fixtures</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-white/[0.06] bg-white/[0.01]">
                      <TableHead className="text-xs md:text-sm font-bold">Stage</TableHead>
                      <TableHead className="text-xs md:text-sm font-bold">Teams</TableHead>
                      <TableHead className="text-center text-xs md:text-sm font-bold">Scorecard</TableHead>
                      <TableHead className="text-xs md:text-sm font-bold">Victor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedMatches.map(match => {
                      const team1 = getTeam(match.team1Id);
                      const team2 = getTeam(match.team2Id);
                      const winner = match.winner ? getTeam(match.winner) : null;
                      return (
                        <TableRow key={match.id} className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                          <TableCell>
                            <Badge variant={match.matchType === 'final' ? 'gold' : 'secondary'} className="text-[10px] md:text-xs">
                              {MATCH_TYPE_LABELS[match.matchType]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 md:gap-2">
                              {team1 && <TeamBadge team={team1} size="sm" showName={false} />}
                              <span className="text-muted-foreground text-xs font-bold">vs</span>
                              {team2 && <TeamBadge team={team2} size="sm" showName={false} />}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs md:text-sm whitespace-nowrap text-foreground font-semibold">
                            {match.innings1?.runs || 0}/{match.innings1?.wickets || 0} - {match.innings2?.runs || 0}/{match.innings2?.wickets || 0}
                          </TableCell>
                          <TableCell>
                            {winner && <TeamBadge team={winner} size="sm" showName={false} />}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tournament Fixtures & Schedule */}
        <MatchFixturesCalendar />
      </main>
    </div>
  );
}
