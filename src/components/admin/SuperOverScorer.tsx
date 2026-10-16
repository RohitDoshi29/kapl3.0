import { useCricketStore } from '@/hooks/useCricketStore';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Target, User, RefreshCw, Flag, Trophy, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import { CricketAnimation, useCricketAnimation } from '@/components/cricket/CricketAnimations';

interface SuperOverScorerProps {
  onEndMatch: () => void;
}

export default function SuperOverScorer({ onEndMatch }: SuperOverScorerProps) {
  const { 
    matchState, 
    getTeam, 
    getPlayingPlayers,
    addSuperOverBall,
    selectSuperOverBatsman,
    selectSuperOverBowler,
    switchSuperOverInnings,
    endSuperOver,
    endMatch,
  } = useCricketStore();
  
  const { animation, triggerFour, triggerSix, triggerWicket, triggerWinner, clearAnimation } = useCricketAnimation();
  
  const match = matchState.currentMatch;
  const superOver = match?.superOver;
  
  if (!match || !superOver) return null;
  
  const team1 = getTeam(match.team1Id);
  const team2 = getTeam(match.team2Id);
  
  const currentInnings = superOver.currentInnings === 1 ? superOver.innings1 : superOver.innings2;
  const battingTeam = superOver.currentInnings === 1 ? team1 : team2;
  const bowlingTeam = superOver.currentInnings === 1 ? team2 : team1;
  
  const battingPlayingPlayers = battingTeam ? getPlayingPlayers(battingTeam.id) : [];
  const bowlingPlayingPlayers = bowlingTeam ? getPlayingPlayers(bowlingTeam.id) : [];
  
  const getFilteredPlayers = (team: typeof battingTeam, playerIds: string[]) => {
    if (!team) return [];
    if (playerIds.length === 0) return team.players;
    return team.players.filter(p => playerIds.includes(p.id));
  };
  
  const target = superOver.currentInnings === 2 && superOver.innings1 ? superOver.innings1.runs + 1 : null;
  const runsNeeded = target && currentInnings ? target - currentInnings.runs : null;
  
  const isInningsComplete = currentInnings && (
    currentInnings.currentOver >= MATCH_CONSTANTS.SUPER_OVER_OVERS ||
    currentInnings.wickets >= MATCH_CONSTANTS.SUPER_OVER_WICKETS
  );
  
  const currentBatsman = battingTeam?.players.find(p => p.id === currentInnings?.currentBatsmanId);
  const nonStriker = battingTeam?.players.find(p => p.id === currentInnings?.nonStrikerBatsmanId);
  const currentBowler = bowlingTeam?.players.find(p => p.id === currentInnings?.currentBowlerId);
  
  const handleAddBall = (runs: number, isWicket = false, isWide = false, isNoBall = false) => {
    if (!currentInnings?.currentBatsmanId || !currentInnings?.currentBowlerId) {
      toast.error('Please select batsman and bowler first');
      return;
    }
    if (isInningsComplete) {
      toast.error('Innings complete! Switch innings or end super over.');
      return;
    }
    
    addSuperOverBall(runs, isWicket, isWide, isNoBall);
    if (isWicket) {
      triggerWicket();
    } else if (runs === 6) {
      triggerSix();
    } else if (runs === 4) {
      triggerFour();
    }
  };
  
  const handleEndSuperOver = async () => {
    await endSuperOver();
    
    // Determine winner
    const so1Runs = superOver.innings1?.runs || 0;
    const so2Runs = superOver.innings2?.runs || 0;
    
    if (so1Runs > so2Runs) {
      triggerWinner(team1?.name || 'Team 1');
    } else if (so2Runs > so1Runs) {
      triggerWinner(team2?.name || 'Team 2');
    } else {
      toast.info('Super Over also tied!');
    }
    
    // End match after animation
    setTimeout(() => {
      endMatch();
    }, 4500);
  };

  if (!team1 || !team2 || !currentInnings || !battingTeam || !bowlingTeam) {
    return null;
  }

  return (
    <>
      <CricketAnimation
        type={animation.type}
        teamName={animation.teamName}
        onComplete={clearAnimation}
      />
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Super Over Header */}
        <Card className="bg-gradient-to-r from-primary/20 to-accent/20 border-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-3">
              <Zap className="w-6 h-6 text-primary animate-pulse" />
              <span className="text-xl font-bold text-primary">SUPER OVER</span>
              <Zap className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <div className="text-center text-sm text-muted-foreground mt-2">
              {MATCH_CONSTANTS.SUPER_OVER_OVERS} over | {MATCH_CONSTANTS.SUPER_OVER_WICKETS} wickets each
            </div>
          </CardContent>
        </Card>
        
        {/* Super Over Score Display */}
        <div className="grid grid-cols-2 gap-4">
          <Card className={superOver.currentInnings === 1 ? 'ring-2 ring-primary' : ''}>
            <CardContent className="p-4 text-center">
              <TeamBadge team={team1} size="sm" />
              <div className="text-3xl font-bold mt-2">
                {superOver.innings1?.runs || 0}/{superOver.innings1?.wickets || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                ({superOver.innings1?.currentOver || 0}.{superOver.innings1?.currentBall || 0} ov)
              </div>
              {superOver.currentInnings === 1 && (
                <Badge className="mt-2">Batting</Badge>
              )}
            </CardContent>
          </Card>
          
          <Card className={superOver.currentInnings === 2 ? 'ring-2 ring-primary' : ''}>
            <CardContent className="p-4 text-center">
              <TeamBadge team={team2} size="sm" />
              <div className="text-3xl font-bold mt-2">
                {superOver.innings2?.runs || 0}/{superOver.innings2?.wickets || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                ({superOver.innings2?.currentOver || 0}.{superOver.innings2?.currentBall || 0} ov)
              </div>
              {superOver.currentInnings === 2 && (
                <Badge className="mt-2">Batting</Badge>
              )}
              {superOver.currentInnings === 1 && !superOver.innings2 && (
                <div className="text-xs text-muted-foreground mt-2">Yet to bat</div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Target Display */}
        {target && (
          <Card className="bg-primary/10">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <span className="font-bold">Target: {target}</span>
                <span className="text-muted-foreground">
                  (Need {runsNeeded && runsNeeded > 0 ? runsNeeded : 0} from {6 - (currentInnings?.currentBall || 0)} balls)
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Batsman & Bowler Selection */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Batting - {battingTeam.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Striker</label>
                <Select
                  value={currentInnings.currentBatsmanId || ''}
                  onValueChange={(value) => selectSuperOverBatsman(value, true)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select striker" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredPlayers(battingTeam, battingPlayingPlayers).map((player) => {
                      const stats = currentInnings.batterStats[player.id];
                      const isOut = stats?.isOut;
                      const isNonStriker = player.id === currentInnings.nonStrikerBatsmanId;
                      return (
                        <SelectItem 
                          key={player.id} 
                          value={player.id}
                          disabled={isOut || isNonStriker}
                        >
                          {player.name} {isOut ? '(OUT)' : isNonStriker ? '(Non-striker)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Non-Striker</label>
                <Select
                  value={currentInnings.nonStrikerBatsmanId || ''}
                  onValueChange={(value) => selectSuperOverBatsman(value, false)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select non-striker" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredPlayers(battingTeam, battingPlayingPlayers).map((player) => {
                      const stats = currentInnings.batterStats[player.id];
                      const isOut = stats?.isOut;
                      const isStriker = player.id === currentInnings.currentBatsmanId;
                      return (
                        <SelectItem 
                          key={player.id} 
                          value={player.id}
                          disabled={isOut || isStriker}
                        >
                          {player.name} {isOut ? '(OUT)' : isStriker ? '(Striker)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5" />
                Bowling - {bowlingTeam.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Bowler</label>
                <Select
                  value={currentInnings.currentBowlerId || ''}
                  onValueChange={(value) => selectSuperOverBowler(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bowler" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredPlayers(bowlingTeam, bowlingPlayingPlayers).map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Scoring Buttons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Super Over Scoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Runs */}
            <div className="grid grid-cols-7 gap-2">
              {[-2, -1, 0, 1, 2, 3].map((runs) => (
                <Button
                  key={runs}
                  variant="outline"
                  className="h-12 text-lg font-bold"
                  onClick={() => handleAddBall(runs)}
                  disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId || isInningsComplete}
                >
                  {runs}
                </Button>
              ))}
              <Button
                className="h-12 text-lg font-bold bg-cricket-four hover:bg-cricket-four/90"
                onClick={() => handleAddBall(4)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId || isInningsComplete}
              >
                4
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <Button
                className="h-12 text-lg font-bold bg-cricket-six hover:bg-cricket-six/90"
                onClick={() => handleAddBall(6)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId || isInningsComplete}
              >
                6
              </Button>
              <Button
                className="h-12 font-bold bg-cricket-extra text-black hover:bg-cricket-extra/90"
                onClick={() => handleAddBall(1, false, true, false)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId || isInningsComplete}
              >
                Wide
              </Button>
              <Button
                className="h-12 font-bold bg-cricket-extra text-black hover:bg-cricket-extra/90"
                onClick={() => handleAddBall(1, false, false, true)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId || isInningsComplete}
              >
                No Ball
              </Button>
            </div>
            
            <Button
              variant="destructive"
              className="w-full h-14 text-xl font-bold"
              onClick={() => handleAddBall(0, true)}
              disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId || isInningsComplete}
            >
              WICKET
            </Button>
          </CardContent>
        </Card>
        
        {/* Ball Display */}
        {currentInnings.overs[0]?.balls && currentInnings.overs[0].balls.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2 flex-wrap justify-center">
                {currentInnings.overs[0].balls.map((ball, index) => {
                  const getBallDisplay = () => {
                    if (ball.isWicket) return 'W';
                    if (ball.isWide) return `${ball.runs}Wd`;
                    if (ball.isNoBall) return `${ball.runs}Nb`;
                    return ball.runs.toString();
                  };
                  const getBallClass = () => {
                    if (ball.isWicket) return 'bg-destructive text-destructive-foreground';
                    if (ball.runs >= 4) return 'bg-cricket-four text-white';
                    if (ball.runs === 6) return 'bg-cricket-six text-white';
                    return 'bg-muted';
                  };
                  return (
                    <div
                      key={ball.id}
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getBallClass()}`}
                    >
                      {getBallDisplay()}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Actions */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {superOver.currentInnings === 1 && isInningsComplete && (
              <Button
                variant="secondary"
                className="w-full h-12 gap-2"
                onClick={switchSuperOverInnings}
              >
                <RefreshCw className="w-5 h-5" />
                Switch to Team 2 Batting
              </Button>
            )}
            
            {(superOver.currentInnings === 2 && (isInningsComplete || superOver.completed)) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-accent">
                    <Trophy className="w-5 h-5" />
                    End Super Over & Declare Winner
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End Super Over?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {team1?.name}: {superOver.innings1?.runs || 0}/{superOver.innings1?.wickets || 0}
                      <br />
                      {team2?.name}: {superOver.innings2?.runs || 0}/{superOver.innings2?.wickets || 0}
                      <br /><br />
                      {(superOver.innings1?.runs || 0) > (superOver.innings2?.runs || 0) 
                        ? `${team1?.name} wins!` 
                        : (superOver.innings2?.runs || 0) > (superOver.innings1?.runs || 0)
                        ? `${team2?.name} wins!`
                        : 'Still tied!'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEndSuperOver}>
                      End Match
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}