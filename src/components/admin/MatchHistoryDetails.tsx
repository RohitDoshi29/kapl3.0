import { Match, Team, Innings } from '@/lib/cricketTypes';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportMatchToExcel } from '@/lib/exportMatchToExcel';

interface MatchHistoryDetailsProps {
  match: Match | null;
  getTeam: (id: string) => Team | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MatchHistoryDetails({ match, getTeam, open, onOpenChange }: MatchHistoryDetailsProps) {
  if (!match) return null;

  const team1 = getTeam(match.team1Id);
  const team2 = getTeam(match.team2Id);
  const winnerTeam = match.winner ? getTeam(match.winner) : null;

  const renderInningsDetails = (innings: Innings | null, battingTeam: Team | undefined, bowlingTeam: Team | undefined) => {
    if (!innings || !battingTeam || !bowlingTeam) {
      return <p className="text-center text-muted-foreground py-4">No innings data</p>;
    }

    return (
      <div className="space-y-4">
        {/* Summary */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="font-semibold">{battingTeam.name}</span>
          <span className="text-2xl font-bold">{innings.runs}/{innings.wickets}</span>
          <span className="text-muted-foreground">({innings.currentOver}.{innings.currentBall} ov)</span>
        </div>

        {/* Batting Scorecard */}
        <div>
          <h4 className="font-semibold mb-2">Batting</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batsman</TableHead>
                <TableHead className="text-center">R</TableHead>
                <TableHead className="text-center">B</TableHead>
                <TableHead className="text-center">4s</TableHead>
                <TableHead className="text-center">6s</TableHead>
                <TableHead className="text-center">SR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {innings.battingOrder.map((playerId) => {
                const player = battingTeam.players.find(p => p.id === playerId);
                const stats = innings.batterStats[playerId];
                if (!player || !stats) return null;
                
                const strikeRate = stats.ballsFaced > 0 
                  ? ((stats.runs / stats.ballsFaced) * 100).toFixed(1) 
                  : '0.0';
                
                return (
                  <TableRow key={playerId}>
                    <TableCell className="font-medium">
                      {player.name}
                      {stats.isOut && <span className="text-destructive ml-1">(OUT)</span>}
                    </TableCell>
                    <TableCell className="text-center font-bold">{stats.runs}</TableCell>
                    <TableCell className="text-center">{stats.ballsFaced}</TableCell>
                    <TableCell className="text-center">{stats.fours}</TableCell>
                    <TableCell className="text-center">{stats.sixes}</TableCell>
                    <TableCell className="text-center">{strikeRate}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Bowling Figures */}
        <div>
          <h4 className="font-semibold mb-2">Bowling</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bowler</TableHead>
                <TableHead className="text-center">O</TableHead>
                <TableHead className="text-center">R</TableHead>
                <TableHead className="text-center">W</TableHead>
                <TableHead className="text-center">Econ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(innings.bowlerStats).map(([playerId, stats]) => {
                const player = bowlingTeam.players.find(p => p.id === playerId);
                if (!player) return null;
                
                const totalOvers = stats.overs + (stats.balls / 6);
                const economy = totalOvers > 0 ? (stats.runs / totalOvers).toFixed(2) : '0.00';
                
                return (
                  <TableRow key={playerId}>
                    <TableCell className="font-medium">{player.name}</TableCell>
                    <TableCell className="text-center">{stats.overs}.{stats.balls}</TableCell>
                    <TableCell className="text-center">{stats.runs}</TableCell>
                    <TableCell className="text-center font-bold">{stats.wickets}</TableCell>
                    <TableCell className="text-center">{economy}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Over-by-over details */}
        <div>
          <h4 className="font-semibold mb-2">Over by Over</h4>
          <div className="space-y-2">
            {innings.overs.map((over, idx) => {
              const bowler = over.bowlerId ? bowlingTeam.players.find(p => p.id === over.bowlerId) : null;
              const overRuns = over.balls.reduce((sum, ball) => sum + ball.runs, 0);
              const wicketsInOver = over.balls.filter(b => b.isWicket).length;
              
              return (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Over {over.number + 1}</span>
                    <span className="text-sm text-muted-foreground">
                      Bowler: {bowler?.name || 'Unknown'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{overRuns} runs</Badge>
                      {wicketsInOver > 0 && (
                        <Badge variant="destructive">{wicketsInOver} W</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {over.balls.map((ball, ballIdx) => {
                      let bgClass = 'bg-muted';
                      let textClass = '';
                      
                      if (ball.isWicket) {
                        bgClass = 'bg-destructive';
                        textClass = 'text-destructive-foreground';
                      } else if (ball.runs === 4) {
                        bgClass = 'bg-cricket-four';
                        textClass = 'text-white';
                      } else if (ball.runs === 6) {
                        bgClass = 'bg-cricket-six';
                        textClass = 'text-white';
                      } else if (ball.isWide || ball.isNoBall) {
                        bgClass = 'bg-cricket-extra';
                        textClass = 'text-black';
                      } else if (ball.runs < 0) {
                        bgClass = 'bg-destructive/50';
                        textClass = 'text-destructive-foreground';
                      }
                      
                      let label = ball.runs.toString();
                      if (ball.isWicket) label = 'W';
                      else if (ball.isWide) label = 'Wd';
                      else if (ball.isNoBall) label = 'Nb';
                      
                      return (
                        <span
                          key={ballIdx}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${bgClass} ${textClass}`}
                        >
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {innings.overs.length === 0 && (
              <p className="text-center text-muted-foreground py-2">No overs bowled</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleExport = () => {
    if (team1 && team2) {
      exportMatchToExcel(match, team1, team2);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{team1?.name} vs {team2?.name}</span>
            <div className="flex items-center gap-2">
              {winnerTeam && (
                <Badge className="bg-primary">{winnerTeam.name} Won</Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
                <Download className="w-4 h-4" />
                Excel
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[65vh]">
          <Tabs defaultValue="innings1" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="innings1">
                1st Innings ({match.innings1?.runs || 0}/{match.innings1?.wickets || 0})
              </TabsTrigger>
              <TabsTrigger value="innings2">
                2nd Innings ({match.innings2?.runs || 0}/{match.innings2?.wickets || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="innings1" className="mt-4">
              {renderInningsDetails(match.innings1, team1, team2)}
            </TabsContent>
            
            <TabsContent value="innings2" className="mt-4">
              {renderInningsDetails(match.innings2, team2, team1)}
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
