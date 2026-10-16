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

export default function PointsTable() {
  const { teams, getTeamStats, getTeam, matchHistory } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();

  const tournamentTeams = teams.filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);
  const stats = getTeamStats(activeTournamentId);

  const groupATeams = tournamentTeams.filter(t => t.group === 'A');
  const groupBTeams = tournamentTeams.filter(t => t.group === 'B');

  const getTeamStatsSorted = (groupTeams: typeof teams) => {
    return groupTeams
      .map(team => {
        const teamStats = stats.find(s => s.teamId === team.id);
        return {
          team,
          matchesPlayed: teamStats?.matchesPlayed || 0,
          wins: teamStats?.wins || 0,
          losses: teamStats?.losses || 0,
          totalRuns: teamStats?.totalRuns || 0,
          totalFours: teamStats?.totalFours || 0,
          totalSixes: teamStats?.totalSixes || 0,
          totalWickets: teamStats?.totalWickets || 0,
          nrr: teamStats?.nrr || 0,
        };
      })
      // Sort by wins first, then NRR for tiebreaker
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.nrr - a.nrr;
      });
  };

  const renderTable = (title: string, groupTeams: typeof teams) => {
    const sortedTeams = getTeamStatsSorted(groupTeams);

    return (
      <Card>
        <CardHeader className="pb-3 md:pb-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <span
              className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full"
              style={{ backgroundColor: `hsl(${groupTeams[0]?.primaryColor})` }}
            />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 md:w-12 text-xs md:text-sm">#</TableHead>
                  <TableHead className="text-xs md:text-sm">Team</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">M</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">W</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">L</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">4s</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">6s</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Wkts</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">NRR</TableHead>
                  <TableHead className="text-right text-xs md:text-sm">Runs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTeams.map((item, index) => (
                  <TableRow key={item.team.id}>
                    <TableCell className="font-bold text-xs md:text-sm">{index + 1}</TableCell>
                    <TableCell>
                      <TeamBadge team={item.team} size="sm" showName={false} className="md:hidden" />
                      <TeamBadge team={item.team} size="sm" className="hidden md:flex" />
                    </TableCell>
                    <TableCell className="text-center text-xs md:text-sm">{item.matchesPlayed}</TableCell>
                    <TableCell className="text-center text-green-600 font-semibold text-xs md:text-sm">{item.wins}</TableCell>
                    <TableCell className="text-center text-destructive font-semibold text-xs md:text-sm">{item.losses}</TableCell>
                    <TableCell className="text-center text-xs md:text-sm text-amber-600 font-medium">{item.totalFours}</TableCell>
                    <TableCell className="text-center text-xs md:text-sm text-purple-600 font-medium">{item.totalSixes}</TableCell>
                    <TableCell className="text-center text-xs md:text-sm text-red-600 font-medium">{item.totalWickets}</TableCell>
                    <TableCell
                      className={cn(
                        'text-center text-xs md:text-sm font-semibold',
                        item.nrr > 0 ? 'text-green-600' : item.nrr < 0 ? 'text-destructive' : ''
                      )}
                    >
                      {item.nrr > 0 ? '+' : ''}{item.nrr.toFixed(3)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-bold text-sm md:text-lg',
                        item.totalRuns < 0 && 'text-destructive'
                      )}
                    >
                      {item.totalRuns}
                    </TableCell>
                  </TableRow>
                ))}
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
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <Navigation />
      <Header />
      <MultiMatchLiveBar />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
            {currentTournament?.name || "Tournament"} Standings
          </h1>
          <Badge variant="outline" className="text-xs font-semibold">
            {currentTournament?.gender === 'women' ? '👑 Women\'s Division' : '🏏 Men\'s Division'}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {renderTable('Group A', groupATeams)}
          {renderTable('Group B', groupBTeams)}
        </div>

        {/* Match History */}
        {completedMatches.length > 0 && (
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-base md:text-lg">Match History</CardTitle>
            </CardHeader>
            <CardContent className="p-2 md:p-6 pt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs md:text-sm">Type</TableHead>
                      <TableHead className="text-xs md:text-sm">Teams</TableHead>
                      <TableHead className="text-center text-xs md:text-sm">Score</TableHead>
                      <TableHead className="text-xs md:text-sm">Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedMatches.map(match => {
                      const team1 = getTeam(match.team1Id);
                      const team2 = getTeam(match.team2Id);
                      const winner = match.winner ? getTeam(match.winner) : null;
                      return (
                        <TableRow key={match.id}>
                          <TableCell>
                            <Badge variant={match.matchType === 'final' ? 'default' : 'secondary'} className="text-[10px] md:text-xs">
                              {MATCH_TYPE_LABELS[match.matchType]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 md:gap-2">
                              {team1 && <TeamBadge team={team1} size="sm" showName={false} />}
                              <span className="text-muted-foreground text-xs">vs</span>
                              {team2 && <TeamBadge team={team2} size="sm" showName={false} />}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs md:text-sm whitespace-nowrap">
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
      </main>
    </div>
  );
}
