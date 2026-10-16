import { useState, useEffect } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useSecondaryScorer } from '@/hooks/useSecondaryScorer';
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
import { Undo2, RefreshCw, Target, User, ArrowLeftRight, PlayCircle, Eye, EyeOff } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import { ScoreDiscrepancyAlert } from './ScoreDiscrepancyAlert';

export default function SecondaryScorerTab() {
  const { matchState: primaryMatchState, getTeam, getPlayingPlayers } = useCricketStore();
  const { 
    matchState: secondaryMatchState, 
    syncWithPrimaryMatch,
    addBall, 
    selectBatsman, 
    selectBowler, 
    undoLastBall, 
    switchBattingTeam, 
    swapStrike 
  } = useSecondaryScorer();

  const primaryMatch = primaryMatchState.currentMatch;
  const secondaryMatch = secondaryMatchState.currentMatch;

  // Sync with primary match when it changes (new match started)
  useEffect(() => {
    if (primaryMatch && (!secondaryMatch || secondaryMatch.id !== primaryMatch.id)) {
      syncWithPrimaryMatch(primaryMatch);
    } else if (!primaryMatch && secondaryMatch) {
      // Primary match ended, clear secondary
      syncWithPrimaryMatch(null);
    }
  }, [primaryMatch?.id, secondaryMatch?.id, syncWithPrimaryMatch]);

  const team1 = secondaryMatch ? getTeam(secondaryMatch.team1Id) : null;
  const team2 = secondaryMatch ? getTeam(secondaryMatch.team2Id) : null;
  const currentInnings = secondaryMatch?.currentInnings === 1 ? secondaryMatch.innings1 : secondaryMatch?.innings2;
  const battingTeam = secondaryMatch?.currentInnings === 1 ? team1 : team2;
  const bowlingTeam = secondaryMatch?.currentInnings === 1 ? team2 : team1;
  
  const target = secondaryMatch?.currentInnings === 2 && secondaryMatch.innings1 ? secondaryMatch.innings1.runs + 1 : null;
  const runsNeeded = target && currentInnings ? target - currentInnings.runs : null;

  // Get playing players for selection
  const battingPlayingPlayers = battingTeam ? getPlayingPlayers(battingTeam.id) : [];
  const bowlingPlayingPlayers = bowlingTeam ? getPlayingPlayers(bowlingTeam.id) : [];

  // Filter players to only show playing 7
  const getFilteredPlayers = (team: typeof battingTeam, playerIds: string[]) => {
    if (!team) return [];
    if (playerIds.length === 0) return team.players; // Fallback to all players
    return team.players.filter(p => playerIds.includes(p.id));
  };

  const handleAddBall = (runs: number, isWicket = false, isWide = false, isNoBall = false, noStrikeChange = false) => {
    if (!currentInnings?.currentBatsmanId || !currentInnings?.currentBowlerId) {
      toast.error('Please select batsman and bowler first');
      return;
    }
    addBall(runs, isWicket, isWide, isNoBall, noStrikeChange);
  };

  const handleUndo = () => {
    undoLastBall();
    toast.info('Last ball undone');
  };

  const handleSwitchInnings = () => {
    switchBattingTeam();
    toast.success('Innings switched!');
  };

  const canUndo = !!secondaryMatchState.lastAction;

  if (!primaryMatch) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16 space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <PlayCircle className="w-12 h-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">No Active Match</h2>
            <p className="text-muted-foreground">
              Wait for the primary scorer to start a match
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!secondaryMatch || !team1 || !team2 || !currentInnings || !battingTeam || !bowlingTeam) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Loading secondary scorer data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Score Discrepancy Alert */}
      <ScoreDiscrepancyAlert />
      
      {/* Header Badge */}
      <Card className="bg-secondary/50 border-secondary">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <EyeOff className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Secondary Scorer</span>
              <Badge variant="outline">Private</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Your scores are not visible to the public
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current Score with Target */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <TeamBadge team={battingTeam} size="md" />
            <div className="text-right">
              <div className="text-4xl font-bold">
                {currentInnings.runs}/{currentInnings.wickets}
              </div>
              <div className="text-muted-foreground">
                ({currentInnings.currentOver}.{currentInnings.currentBall} ov)
              </div>
              {target && (
                <div className="flex items-center justify-end gap-1 mt-1 text-sm">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="font-medium">Target: {target}</span>
                  <span className="text-muted-foreground">
                    (Need {runsNeeded} runs)
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Batsman & Bowler Selection */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Batting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Striker</label>
              <Select
                value={currentInnings.currentBatsmanId || ''}
                onValueChange={(value) => selectBatsman(value, true)}
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
                onValueChange={(value) => selectBatsman(value, false)}
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
              Bowling
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Current Bowler</label>
              <Select
                value={currentInnings.currentBowlerId || ''}
                onValueChange={(value) => selectBowler(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bowler" />
                </SelectTrigger>
                <SelectContent>
                  {getFilteredPlayers(bowlingTeam, bowlingPlayingPlayers).map((player) => {
                    const stats = currentInnings.bowlerStats[player.id];
                    const hasCompletedMaxOvers = stats && stats.overs >= MATCH_CONSTANTS.MAX_OVERS_PER_BOWLER;
                    return (
                      <SelectItem 
                        key={player.id} 
                        value={player.id}
                        disabled={hasCompletedMaxOvers}
                      >
                        {player.name} {stats ? `(${stats.overs}.${stats.balls}-${stats.runs}-${stats.wickets})` : ''} 
                        {hasCompletedMaxOvers && '(Max Overs)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Max {MATCH_CONSTANTS.MAX_OVERS_PER_BOWLER} overs per bowler
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batting Stats Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg">Batting Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Batsman</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">R</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">B</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">4s</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">6s</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">SR</TableHead>
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
                      <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                        {player.name}
                        {isStriker && <span className="text-primary ml-1">*</span>}
                        {isNonStriker && <span className="text-muted-foreground ml-1">†</span>}
                        {stats.isOut && <span className="text-destructive ml-1">(OUT)</span>}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs md:text-sm">{stats.runs}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.ballsFaced}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.fours}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.sixes}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{strikeRate}</TableCell>
                    </TableRow>
                  );
                })}
                {currentInnings.battingOrder.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-xs md:text-sm">
                      Select batsmen to start
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Bowling Stats Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg">Bowling Figures</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs md:text-sm">Bowler</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">O</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">R</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">W</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">WD</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">NB</TableHead>
                  <TableHead className="text-center text-xs md:text-sm">Econ</TableHead>
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
                      <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                        {player.name}
                        {isBowling && <span className="text-primary ml-1">*</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.overs}.{stats.balls}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.runs}</TableCell>
                      <TableCell className="text-center font-bold text-xs md:text-sm">{stats.wickets}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.wides}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{stats.noBalls}</TableCell>
                      <TableCell className="text-center text-xs md:text-sm">{economy}</TableCell>
                    </TableRow>
                  );
                })}
                {Object.keys(currentInnings.bowlerStats).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground text-xs md:text-sm">
                      Select a bowler to start
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Buttons */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          {/* Penalty Runs */}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1.5 md:mb-2">Penalty Runs</p>
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              {[-2, -1].map((runs) => (
                <Button
                  key={runs}
                  variant="destructive"
                  className="h-11 md:h-14 text-lg md:text-xl font-bold"
                  onClick={() => handleAddBall(runs)}
                  disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
                >
                  {runs}
                </Button>
              ))}
            </div>
          </div>

          {/* Runs */}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1.5 md:mb-2">Runs</p>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {[0, 1, 2, 3].map((runs) => (
                <Button
                  key={runs}
                  variant="outline"
                  className="h-11 md:h-14 text-lg md:text-xl font-bold"
                  onClick={() => handleAddBall(runs)}
                  disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
                >
                  {runs}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-11 md:h-14 text-sm md:text-lg font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                onClick={() => handleAddBall(1, false, false, false, true)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
                title="1 Run Declared (No Strike Change)"
              >
                1D
              </Button>
            </div>
          </div>

          {/* Boundaries */}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1.5 md:mb-2">Boundaries</p>
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              <Button
                className="h-11 md:h-14 text-lg md:text-xl font-bold bg-cricket-four hover:bg-cricket-four/90"
                onClick={() => handleAddBall(4)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                4
              </Button>
              <Button
                className="h-11 md:h-14 text-lg md:text-xl font-bold bg-cricket-six hover:bg-cricket-six/90"
                onClick={() => handleAddBall(6)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                6
              </Button>
            </div>
          </div>

          {/* Extras */}
          <div>
            <p className="text-xs md:text-sm text-muted-foreground mb-1.5 md:mb-2">Extras</p>
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              <Button
                className="h-10 md:h-12 text-sm md:text-base font-bold bg-cricket-extra text-black hover:bg-cricket-extra/90"
                onClick={() => handleAddBall(1, false, true, false)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                Wide
              </Button>
              <Button
                className="h-10 md:h-12 text-sm md:text-base font-bold bg-cricket-extra text-black hover:bg-cricket-extra/90"
                onClick={() => handleAddBall(1, false, false, true)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                No Ball
              </Button>
            </div>
          </div>

          {/* Wicket */}
          <Button
            variant="destructive"
            className="w-full h-12 md:h-16 text-xl md:text-2xl font-bold"
            onClick={() => handleAddBall(0, true)}
            disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
          >
            WICKET
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Match Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-12 gap-2"
            onClick={() => {
              swapStrike();
              toast.info('Strike rotated');
            }}
            disabled={!currentInnings.currentBatsmanId || !currentInnings.nonStrikerBatsmanId}
          >
            <ArrowLeftRight className="w-5 h-5" />
            Change Strike
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 gap-2"
            onClick={handleUndo}
            disabled={!canUndo}
          >
            <Undo2 className="w-5 h-5" />
            Undo Last Ball
          </Button>

          {secondaryMatch.currentInnings === 1 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="secondary" className="w-full h-12 gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Switch to Innings 2
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Switch Innings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will end the current innings and start innings 2 with {team2?.name} batting.
                    Target for {team2?.name}: {(currentInnings?.runs || 0) + 1} runs
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSwitchInnings}>
                    Switch Innings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
