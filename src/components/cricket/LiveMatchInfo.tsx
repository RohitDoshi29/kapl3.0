import { Team, Innings, Match } from '@/lib/cricketTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, User, CircleDot, Trophy, Users } from 'lucide-react';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WhatsAppMatchCardModal } from './WhatsAppMatchCardModal';

interface LiveMatchInfoProps {
  match: Match;
  battingTeam: Team;
  bowlingTeam: Team;
  currentInnings: Innings;
  team1: Team;
  team2: Team;
  className?: string;
}

export function LiveMatchInfo({ match, battingTeam, bowlingTeam, currentInnings, team1, team2, className }: LiveMatchInfoProps) {
  // Calculate current run rate
  const totalBalls = currentInnings.currentOver * 6 + currentInnings.currentBall;
  const currentRunRate = totalBalls > 0 ? (currentInnings.runs / totalBalls * 6).toFixed(2) : '0.00';
  
  // Calculate required run rate for 2nd innings
  const target = match.currentInnings === 2 && match.innings1 ? match.innings1.runs + 1 : null;
  const runsNeeded = target ? target - currentInnings.runs : null;
  const ballsRemaining = (MATCH_CONSTANTS.MAX_OVERS * 6) - totalBalls;
  const requiredRunRate = runsNeeded && ballsRemaining > 0 ? (runsNeeded / ballsRemaining * 6).toFixed(2) : null;
  const wicketsRemaining = MATCH_CONSTANTS.MAX_WICKETS - currentInnings.wickets;

  // Get current batsmen
  const currentBatsman = battingTeam.players.find(p => p.id === currentInnings.currentBatsmanId);
  const nonStriker = battingTeam.players.find(p => p.id === currentInnings.nonStrikerBatsmanId);
  const currentBowler = bowlingTeam.players.find(p => p.id === currentInnings.currentBowlerId);

  // Get batsmen stats
  const strikerStats = currentInnings.batterStats[currentInnings.currentBatsmanId || ''];
  const nonStrikerStats = currentInnings.batterStats[currentInnings.nonStrikerBatsmanId || ''];
  const bowlerStats = currentInnings.bowlerStats[currentInnings.currentBowlerId || ''];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Match Title - Teams Playing */}
      <Card className="bg-gradient-to-r from-primary/5 via-transparent to-accent/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="font-bold text-lg">{team1.name}</span>
            </div>
            <Badge variant="outline" className="text-xs font-normal">vs</Badge>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">{team2.name}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Match Info Bar */}
      <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {/* Current Run Rate */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                <TrendingUp className="w-3 h-3" />
                CRR
              </div>
              <div className="text-xl font-bold text-primary">{currentRunRate}</div>
            </div>

            {/* Required Run Rate (2nd innings only) */}
            {requiredRunRate && (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                  <Target className="w-3 h-3" />
                  RRR
                </div>
                <div className={cn(
                  "text-xl font-bold",
                  parseFloat(requiredRunRate) > parseFloat(currentRunRate) * 1.5 ? "text-destructive" : "text-primary"
                )}>
                  {requiredRunRate}
                </div>
              </div>
            )}

            {/* Target Info (2nd innings) */}
            {target && runsNeeded !== null && (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                  <Target className="w-3 h-3" />
                  Need
                </div>
                <div className="text-xl font-bold text-foreground">
                  {runsNeeded > 0 ? runsNeeded : 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    from {ballsRemaining}
                  </span>
                </div>
              </div>
            )}

            {/* Wickets Remaining (2nd innings) */}
            {match.currentInnings === 2 && (
              <div className="space-y-1">
                <div className="text-muted-foreground text-xs">Wickets Left</div>
                <div className="text-xl font-bold text-foreground">{wicketsRemaining}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Batsmen & Bowler Info */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Batting Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <CircleDot className="w-3 h-3 mr-1" />
                Batting
              </Badge>
              <span className="text-sm text-muted-foreground ml-auto">{battingTeam.name}</span>
            </div>
            
            <div className="space-y-3">
              {/* Striker */}
              {currentBatsman ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold">*</span>
                    <span className="font-medium">{currentBatsman.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold">{strikerStats?.runs || 0}</span>
                    <span className="text-muted-foreground">({strikerStats?.ballsFaced || 0})</span>
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      <span>{strikerStats?.fours || 0}×4</span>
                      <span>{strikerStats?.sixes || 0}×6</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2 text-center text-muted-foreground">Select striker</div>
              )}

              {/* Non-Striker */}
              {nonStriker ? (
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">†</span>
                    <span className="font-medium">{nonStriker.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold">{nonStrikerStats?.runs || 0}</span>
                    <span className="text-muted-foreground">({nonStrikerStats?.ballsFaced || 0})</span>
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      <span>{nonStrikerStats?.fours || 0}×4</span>
                      <span>{nonStrikerStats?.sixes || 0}×6</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-2 text-center text-muted-foreground">Select non-striker</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bowling Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                <User className="w-3 h-3 mr-1" />
                Bowling
              </Badge>
              <span className="text-sm text-muted-foreground ml-auto">{bowlingTeam.name}</span>
            </div>
            
            {currentBowler ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="font-medium">{currentBowler.name}</div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="font-bold">{bowlerStats?.overs || 0}.{bowlerStats?.balls || 0}</div>
                    <div className="text-xs text-muted-foreground">Overs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{bowlerStats?.runs || 0}</div>
                    <div className="text-xs text-muted-foreground">Runs</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-primary">{bowlerStats?.wickets || 0}</div>
                    <div className="text-xs text-muted-foreground">Wkts</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">
                      {bowlerStats && (bowlerStats.overs * 6 + bowlerStats.balls) > 0 
                        ? ((bowlerStats.runs / (bowlerStats.overs * 6 + bowlerStats.balls)) * 6).toFixed(1) 
                        : '0.0'}
                    </div>
                    <div className="text-xs text-muted-foreground">Econ</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 text-center text-muted-foreground">Bowler not selected</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Batting Scorecard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CircleDot className="w-4 h-4" />
            {battingTeam.name} - Batting Scorecard
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Batsman</TableHead>
                  <TableHead className="text-center text-xs">R</TableHead>
                  <TableHead className="text-center text-xs">B</TableHead>
                  <TableHead className="text-center text-xs">4s</TableHead>
                  <TableHead className="text-center text-xs">6s</TableHead>
                  <TableHead className="text-center text-xs">SR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentInnings.battingOrder.map((playerId) => {
                  const player = battingTeam.players.find(p => p.id === playerId);
                  const stats = currentInnings.batterStats[playerId];
                  if (!player || !stats) return null;
                  
                  const strikeRate = stats.ballsFaced > 0 
                    ? ((stats.runs / stats.ballsFaced) * 100).toFixed(1) 
                    : '0.0';
                  const isStriker = playerId === currentInnings.currentBatsmanId;
                  const isNonStriker = playerId === currentInnings.nonStrikerBatsmanId;
                  
                  return (
                    <TableRow key={playerId} className={isStriker ? 'bg-primary/10' : ''}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">
                        {player.name}
                        {isStriker && <span className="text-primary ml-1">*</span>}
                        {isNonStriker && <span className="text-muted-foreground ml-1">†</span>}
                        {stats.isOut && <span className="text-destructive ml-1 text-xs">({stats.dismissalType || 'out'})</span>}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">{stats.runs}</TableCell>
                      <TableCell className="text-center text-xs">{stats.ballsFaced}</TableCell>
                      <TableCell className="text-center text-xs">{stats.fours}</TableCell>
                      <TableCell className="text-center text-xs">{stats.sixes}</TableCell>
                      <TableCell className="text-center text-xs">{strikeRate}</TableCell>
                    </TableRow>
                  );
                })}
                {currentInnings.battingOrder.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-xs">
                      Yet to bat
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Full Bowling Scorecard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4" />
            {bowlingTeam.name} - Bowling Figures
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-4 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Bowler</TableHead>
                  <TableHead className="text-center text-xs">O</TableHead>
                  <TableHead className="text-center text-xs">R</TableHead>
                  <TableHead className="text-center text-xs">W</TableHead>
                  <TableHead className="text-center text-xs">Econ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(currentInnings.bowlerStats).map(([playerId, stats]) => {
                  const player = bowlingTeam.players.find(p => p.id === playerId);
                  if (!player) return null;
                  
                  const totalOvers = stats.overs + (stats.balls / 6);
                  const economy = totalOvers > 0 ? (stats.runs / totalOvers).toFixed(2) : '0.00';
                  const isBowling = playerId === currentInnings.currentBowlerId;
                  
                  return (
                    <TableRow key={playerId} className={isBowling ? 'bg-primary/10' : ''}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">
                        {player.name}
                        {isBowling && <span className="text-primary ml-1">*</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs">{stats.overs}.{stats.balls}</TableCell>
                      <TableCell className="text-center text-xs">{stats.runs}</TableCell>
                      <TableCell className="text-center font-bold text-xs">{stats.wickets}</TableCell>
                      <TableCell className="text-center text-xs">{economy}</TableCell>
                    </TableRow>
                  );
                })}
                {Object.keys(currentInnings.bowlerStats).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-xs">
                      Yet to bowl
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Component to show last match result when no live match
interface LastMatchResultProps {
  match: Match;
  team1: Team;
  team2: Team;
  winnerTeam: Team | null;
}

export function LastMatchResult({ match, team1, team2, winnerTeam }: LastMatchResultProps) {
  return (
    <Card className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 border-primary/20">
      <CardContent className="p-6">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Trophy className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Last Match Result</span>
          </div>
          
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="font-bold text-lg">{team1.name}</div>
              <div className="text-2xl font-bold text-primary">
                {match.innings1?.runs}/{match.innings1?.wickets}
              </div>
              <div className="text-xs text-muted-foreground">
                ({(match.innings1 as any)?.currentOver || 0}.{(match.innings1 as any)?.currentBall || 0} ov)
              </div>
            </div>
            
            <Badge variant="outline" className="text-lg px-4 py-1">vs</Badge>
            
            <div className="text-center">
              <div className="font-bold text-lg">{team2.name}</div>
              <div className="text-2xl font-bold text-primary">
                {match.innings2?.runs || 0}/{match.innings2?.wickets || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                ({(match.innings2 as any)?.currentOver || 0}.{(match.innings2 as any)?.currentBall || 0} ov)
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-center gap-2 pt-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            <span className="font-bold text-xl text-primary font-display">
              {winnerTeam ? `${winnerTeam.name} Won!` : "Match Tied!"}
            </span>
            <Trophy className="w-6 h-6 text-yellow-500" />
          </div>

          <div className="pt-2 flex justify-center">
            <WhatsAppMatchCardModal match={match} team1={team1} team2={team2} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
