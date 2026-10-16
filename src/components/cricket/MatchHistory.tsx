import { Match, Team, MATCH_TYPE_LABELS } from '@/lib/cricketTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchHistoryProps {
  matchHistory: Match[];
  getTeam: (id: string) => Team | undefined;
  className?: string;
  limit?: number;
}

export function MatchHistory({ matchHistory, getTeam, className, limit = 10 }: MatchHistoryProps) {
  const completedMatches = matchHistory
    .filter(m => m.status === 'completed')
    .slice(-limit)
    .reverse();

  if (completedMatches.length === 0) {
    return null;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5" />
          Recent Matches
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 md:p-4 pt-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Match</TableHead>
                <TableHead className="text-center text-xs">Score</TableHead>
                <TableHead className="text-center text-xs">Winner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedMatches.map((m) => {
                const t1 = getTeam(m.team1Id);
                const t2 = getTeam(m.team2Id);
                const winnerTeam = m.winner ? getTeam(m.winner) : null;
                const isTie = m.innings1?.runs === m.innings2?.runs;
                
                return (
                  <TableRow key={m.id}>
                    <TableCell className="py-2">
                      <div className="space-y-1">
                        <div className="font-medium text-xs md:text-sm">
                          {t1?.name} vs {t2?.name}
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {MATCH_TYPE_LABELS[m.matchType]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <div className="space-y-1">
                        <div className="text-xs md:text-sm font-medium">
                          {m.innings1?.runs}/{m.innings1?.wickets}
                        </div>
                        <div className="text-xs md:text-sm text-muted-foreground">
                          {m.innings2?.runs}/{m.innings2?.wickets}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {isTie ? (
                        <Badge variant="secondary" className="text-xs">Tie</Badge>
                      ) : winnerTeam ? (
                        <div className="flex items-center justify-center gap-1">
                          <Trophy className="w-3 h-3 text-primary" />
                          <span className="text-xs md:text-sm font-medium text-primary">
                            {winnerTeam.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
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
}
