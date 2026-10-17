import { useState } from 'react';
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
import { Undo2, RefreshCw, Flag, PlayCircle, Target, User, ArrowLeftRight, History, Eye, RotateCcw, Wifi, WifiOff, Zap, ShieldAlert } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Match, Ball, DismissalType } from '@/lib/cricketTypes';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import MatchHistoryDetails from './MatchHistoryDetails';
import { CricketAnimation, useCricketAnimation } from '@/components/cricket/CricketAnimations';
import { OverTable } from '@/components/cricket/OverTable';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PlayerReplacementDialog } from './PlayerReplacementDialog';
import SuperOverScorer from './SuperOverScorer';
import { NoBallModal } from './NoBallModal';
import { DismissalModal } from './DismissalModal';
import { OverTransitionDialog } from './OverTransitionDialog';
import { BallAuditModal } from './BallAuditModal';

interface AdminScorerTabProps {
  onNavigateToSetup: () => void;
}

export default function AdminScorerTab({ onNavigateToSetup }: AdminScorerTabProps) {
  const {
    matchState,
    matchHistory,
    getTeam,
    addBall,
    addNoBall,
    addDismissal,
    addRunOut,
    editBall,
    deleteBall,
    undoLastBall,
    undoToBall,
    switchBattingTeam,
    swapStrike,
    endMatch,
    selectBatsman,
    selectBowler,
    getPlayingPlayers,
    replacePlayer,
    startSuperOver,
    isOnline,
    pendingOfflineChanges,
    isSyncing,
    syncOfflineQueue,
  } = useCricketStore();
  const match = matchState.currentMatch;
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { animation, triggerFour, triggerSix, triggerWicket, triggerWinner, clearAnimation } = useCricketAnimation();
  const [runOutDialogOpen, setRunOutDialogOpen] = useState(false);
  const [noBallModalOpen, setNoBallModalOpen] = useState(false);
  const [dismissalModalOpen, setDismissalModalOpen] = useState(false);
  const [overTransitionOpen, setOverTransitionOpen] = useState(false);
  const [ballAuditModalOpen, setBallAuditModalOpen] = useState(false);
  const [auditTarget, setAuditTarget] = useState<{
    overIndex: number;
    ballIndex: number;
    ball: Ball | null;
  } | null>(null);

  const team1 = match ? getTeam(match.team1Id) : null;
  const team2 = match ? getTeam(match.team2Id) : null;
  const currentInnings = match?.currentInnings === 1 ? match.innings1 : match?.innings2;
  const battingTeam = match?.currentInnings === 1 ? team1 : team2;
  const bowlingTeam = match?.currentInnings === 1 ? team2 : team1;
  
  // Target for 2nd innings
  const target = match?.currentInnings === 2 && match.innings1 ? match.innings1.runs + 1 : null;
  const runsNeeded = target && currentInnings ? target - currentInnings.runs : null;

  // Check limits
  const isInningsComplete = currentInnings && (
    currentInnings.wickets >= MATCH_CONSTANTS.MAX_WICKETS ||
    currentInnings.currentOver >= MATCH_CONSTANTS.MAX_OVERS
  );

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
    if (isInningsComplete) {
      toast.error('Innings complete! Switch innings or end match.');
      return;
    }

    const willCompleteOver = !isWide && !isNoBall && (currentInnings.currentBall === 5);
    const completedOverNumber = currentInnings.currentOver + 1;
    
    addBall(runs, isWicket, isWide, isNoBall, noStrikeChange);
    if (isWicket) {
      triggerWicket();
    } else if (runs === 6) {
      triggerSix();
    } else if (runs === 4) {
      triggerFour();
    }

    if (willCompleteOver && completedOverNumber < MATCH_CONSTANTS.MAX_OVERS) {
      setTimeout(() => {
        setOverTransitionOpen(true);
      }, 500);
    }
  };

  const handleNoBallConfirm = (batRuns: number, isBye: boolean, boundaryDeclared: boolean) => {
    if (!currentInnings?.currentBatsmanId || !currentInnings?.currentBowlerId) {
      toast.error('Please select batsman and bowler first');
      return;
    }
    addNoBall(batRuns, isBye, boundaryDeclared);
    if (batRuns === 6) triggerSix();
    else if (batRuns === 4) triggerFour();
    toast.warning('No Ball recorded! FREE HIT awarded for the next delivery.');
  };

  const handleDismissalConfirm = (payload: {
    type: DismissalType;
    outBatsmanId: string;
    fielderId?: string;
    fielderName?: string;
    runsCompleted?: number;
    nextBatsmanId?: string;
  }) => {
    if (!currentInnings?.currentBatsmanId || !currentInnings?.currentBowlerId) {
      toast.error('Please select batsman and bowler first');
      return;
    }

    const willCompleteOver = currentInnings.currentBall === 5;
    const completedOverNumber = currentInnings.currentOver + 1;

    addDismissal(payload);
    triggerWicket();

    if (payload.nextBatsmanId) {
      const nextPlayer = battingTeam?.players.find(p => p.id === payload.nextBatsmanId);
      if (nextPlayer) {
        toast.success(`${nextPlayer.name} is now batting`);
      }
    }

    if (willCompleteOver && completedOverNumber < MATCH_CONSTANTS.MAX_OVERS) {
      setTimeout(() => {
        setOverTransitionOpen(true);
      }, 500);
    }
  };

  const handleNextBowlerSelect = (bowlerId: string) => {
    selectBowler(bowlerId);
    const b = bowlingTeam?.players.find(p => p.id === bowlerId);
    toast.success(`${b?.name || 'Bowler'} selected for new over`);
  };

  const handleRunOut = (batsmanId: string, runs: number) => {
    if (!currentInnings?.currentBatsmanId || !currentInnings?.currentBowlerId) {
      toast.error('Please select batsman and bowler first');
      return;
    }
    addRunOut(batsmanId, runs);
    triggerWicket();
  };

  const handleUndo = () => {
    undoLastBall();
    toast.info('Last ball undone');
  };

  const handleSwitchInnings = () => {
    switchBattingTeam();
    toast.success('Innings switched!');
  };

  const handleEndMatch = () => {
    // Determine winner before ending match
    const innings1 = match?.innings1;
    const innings2 = match?.innings2;
    let winnerName = 'Match';
    
    if (innings1 && innings2) {
      if (innings1.runs > innings2.runs) {
        winnerName = team1?.name || 'Team 1';
      } else if (innings2.runs > innings1.runs) {
        winnerName = team2?.name || 'Team 2';
      } else {
        winnerName = 'It\'s a Tie!';
      }
    } else if (innings1 && match?.currentInnings === 1) {
      winnerName = team1?.name || 'Team 1';
    }
    
    endMatch();
    triggerWinner(winnerName);
  };

  const canUndo = !!matchState.lastAction;

  // Get current batsman and bowler info
  const currentBatsman = battingTeam?.players.find(p => p.id === currentInnings?.currentBatsmanId);
  const nonStriker = battingTeam?.players.find(p => p.id === currentInnings?.nonStrikerBatsmanId);
  const currentBowler = bowlingTeam?.players.find(p => p.id === currentInnings?.currentBowlerId);

  // Get available players for selection (not out batsmen)
  const availableBatsmen = battingTeam?.players.filter(p => {
    const stats = currentInnings?.batterStats[p.id];
    return !stats?.isOut && p.id !== currentInnings?.currentBatsmanId && p.id !== currentInnings?.nonStrikerBatsmanId;
  }) || [];

  const availableBowlers = bowlingTeam?.players || [];

  // Show Super Over Scorer if match is in super_over status
  if (match?.status === 'super_over') {
    return (
      <SuperOverScorer onEndMatch={() => {
        endMatch();
      }} />
    );
  }

  // Show tie options if match is tied
  if (match?.isTied && match?.innings1 && match?.innings2) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Match Tied!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">
                {team1?.name}: {match.innings1.runs}/{match.innings1.wickets}
              </div>
              <div className="text-lg font-medium mb-4">
                {team2?.name}: {match.innings2.runs}/{match.innings2.wickets}
              </div>
              <p className="text-muted-foreground mb-6">
                Both teams scored {match.innings1.runs} runs. What would you like to do?
              </p>
            </div>
            
            <div className="grid gap-3">
              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2 bg-gradient-to-r from-primary to-accent"
                onClick={() => startSuperOver()}
              >
                <span className="text-xl">⚡</span>
                Start Super Over
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="lg" className="w-full h-12">
                    End as Tie (No Winner)
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>End Match as Tie?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will end the match without a winner. Points will be shared between both teams.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => endMatch(true)}>
                      End as Tie
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!match || !team1 || !team2 || !currentInnings || !battingTeam || !bowlingTeam) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center py-16 space-y-6">
          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <PlayCircle className="w-12 h-12 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-2">No Active Match</h2>
            <p className="text-muted-foreground mb-6">Start a new match to begin scoring</p>
            <Button size="lg" className="gap-2" onClick={onNavigateToSetup}>
              <PlayCircle className="w-5 h-5" />
              Setup New Match
            </Button>
          </div>
        </div>

        {/* Match History - Always visible */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Match History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {matchHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No completed matches yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-center">Winner</TableHead>
                    <TableHead className="text-center">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchHistory.filter(m => m.status === 'completed').slice(-5).reverse().map((m) => {
                    const t1 = getTeam(m.team1Id);
                    const t2 = getTeam(m.team2Id);
                    const winnerTeam = m.winner ? getTeam(m.winner) : null;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {t1?.name} vs {t2?.name}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {m.innings1?.runs}/{m.innings1?.wickets} - {m.innings2?.runs}/{m.innings2?.wickets}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-primary font-medium">{winnerTeam?.name || 'Tie'}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedMatch(m);
                              setDetailsOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <MatchHistoryDetails
          match={selectedMatch}
          getTeam={getTeam}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </div>
    );
  }

  return (
    <>
      <CricketAnimation
        type={animation.type}
        teamName={animation.teamName}
        onComplete={clearAnimation}
      />
      <div className="max-w-4xl mx-auto space-y-4">
      {/* Resilient Offline Status Banner */}
      <div className="flex items-center justify-between bg-card border rounded-2xl px-4 py-2 shadow-sm text-xs">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-500 font-extrabold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="w-4 h-4" />
              Live Cloud Sync Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-500 font-extrabold">
              <WifiOff className="w-4 h-4" />
              Offline Mode (Scoring Saved Locally)
            </span>
          )}
          {pendingOfflineChanges > 0 && (
            <Badge variant="secondary" className="text-[11px] bg-amber-500/15 text-amber-600 font-bold border border-amber-500/30">
              {pendingOfflineChanges} queued
            </Badge>
          )}
        </div>

        {pendingOfflineChanges > 0 && isOnline && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5 font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            disabled={isSyncing}
            onClick={() => syncOfflineQueue()}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Cloud Now'}
          </Button>
        )}
      </div>

      {/* Current Score with Target */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TeamBadge team={battingTeam} size="md" />
              <Badge variant="outline" className="text-xs">
                {MATCH_CONSTANTS.MAX_OVERS} ov | {MATCH_CONSTANTS.MAX_WICKETS} wkts
              </Badge>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">
                {currentInnings.runs}/{currentInnings.wickets}
              </div>
              <div className="text-muted-foreground">
                ({currentInnings.currentOver}.{currentInnings.currentBall} ov)
              </div>
              {isInningsComplete && (
                <Badge variant="destructive" className="mt-1">Innings Complete</Badge>
              )}
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
        {/* Batting Card */}
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

        {/* Bowling Card */}
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

      {/* Free Hit Status Alert */}
      {currentInnings.isFreeHit && (
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border-2 border-amber-500/60 rounded-2xl p-3 text-amber-400 animate-pulse shadow-md">
          <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider text-amber-300">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-bounce" />
            <span>⚡ FREE HIT ACTIVE FOR NEXT DELIVERY</span>
          </div>
          <Badge className="bg-amber-400 text-black font-extrabold text-xs">
            Run Out Only
          </Badge>
        </div>
      )}

      {/* Scoring Buttons */}
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-base md:text-lg">Scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4">
          {/* Negative Runs */}
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2 uppercase tracking-wider">Penalty Runs</p>
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              {[-2, -1].map((runs) => (
                <Button
                  key={runs}
                  variant="destructive"
                  className="h-11 md:h-14 text-lg md:text-xl font-black rounded-xl shadow-sm hover:shadow-rose-500/20 active:scale-95 transition-all"
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
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2 uppercase tracking-wider">Runs</p>
            <div className="grid grid-cols-5 gap-1.5 md:gap-2">
              {[0, 1, 2, 3].map((runs) => (
                <Button
                  key={runs}
                  variant="outline"
                  className="h-11 md:h-14 text-lg md:text-xl font-black rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/[0.1] active:scale-95 transition-all"
                  onClick={() => handleAddBall(runs)}
                  disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
                >
                  {runs}
                </Button>
              ))}
              <Button
                variant="outline"
                className="h-11 md:h-14 text-sm md:text-lg font-black rounded-xl border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-slate-950 active:scale-95 transition-all shadow-sm shadow-amber-500/10"
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
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2 uppercase tracking-wider">Boundaries</p>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <Button
                className="h-12 md:h-16 text-xl md:text-2xl font-black rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 border-0 active:scale-95 transition-all"
                onClick={() => handleAddBall(4)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                FOUR (4)
              </Button>
              <Button
                className="h-12 md:h-16 text-xl md:text-2xl font-black rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-green-600 hover:from-emerald-500 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/25 border-0 active:scale-95 transition-all"
                onClick={() => handleAddBall(6)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                SIX (6)
              </Button>
            </div>
          </div>

          {/* Extras */}
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2 uppercase tracking-wider">Extras</p>
            <div className="grid grid-cols-2 gap-1.5 md:gap-2">
              <Button
                className="h-11 md:h-13 text-sm md:text-base font-bold rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 shadow-sm active:scale-95 transition-all"
                onClick={() => handleAddBall(1, false, true, false)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                Wide (+1)
              </Button>
              <Button
                className="h-11 md:h-13 text-sm md:text-base font-bold rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-slate-950 shadow-sm active:scale-95 transition-all"
                onClick={() => setNoBallModalOpen(true)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                No Ball (Modal)
              </Button>
            </div>
          </div>

          {/* Wickets */}
          <div>
            <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2 uppercase tracking-wider">Wickets & Dismissals</p>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <Button
                variant="destructive"
                className="h-13 md:h-16 text-base md:text-lg font-black rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-pink-600 hover:from-rose-500 hover:to-red-500 text-white shadow-xl shadow-rose-600/30 border-0 active:scale-95 transition-all"
                onClick={() => setDismissalModalOpen(true)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                WICKET / OUT
              </Button>
              <Button
                variant="destructive"
                className="h-13 md:h-16 text-base md:text-lg font-black rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-xl shadow-orange-600/30 border-0 active:scale-95 transition-all"
                onClick={() => setDismissalModalOpen(true)}
                disabled={!currentInnings.currentBatsmanId || !currentInnings.currentBowlerId}
              >
                RUN OUT
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Over-by-Over Breakdown with Ball Audit */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              <span>Over Breakdown (Click any ball to edit/delete)</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Interactive Audit
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6 pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 md:w-20 text-xs md:text-sm">Over</TableHead>
                  <TableHead className="text-xs md:text-sm">Ball by Ball (Tap ball to edit/delete)</TableHead>
                  <TableHead className="w-12 md:w-20 text-right text-xs md:text-sm">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentInnings.overs.map((over, overIndex) => (
                  <TableRow key={overIndex}>
                    <TableCell className="font-medium text-xs md:text-sm">{over.number}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5 md:gap-2 flex-wrap">
                        {over.balls.map((ball, ballIndex) => {
                          const getBallDisplay = () => {
                            if (ball.isWicket) return 'W';
                            if (ball.isWide) return `${ball.runs}Wd`;
                            if (ball.isNoBall) return `${ball.runs}Nb`;
                            return ball.runs.toString();
                          };
                          const getBallClass = () => {
                            if (ball.isWicket) return 'bg-destructive/20 text-destructive font-black border border-destructive/40';
                            if (ball.runs === 4) return 'bg-cricket-four/20 text-cricket-four font-black border border-cricket-four/40';
                            if (ball.runs === 6) return 'bg-cricket-six/20 text-cricket-six font-black border border-cricket-six/40';
                            if (ball.isWide || ball.isNoBall) return 'bg-amber-500/20 text-amber-500 font-bold border border-amber-500/40';
                            return 'bg-muted text-foreground hover:bg-primary/20';
                          };
                          return (
                            <button
                              key={ball.id}
                              type="button"
                              title="Click to edit, delete, or audit this ball"
                              className={cn(
                                'inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full text-xs md:text-sm cursor-pointer hover:ring-2 hover:ring-primary transition-all font-bold shadow-sm',
                                getBallClass()
                              )}
                              onClick={() => {
                                setAuditTarget({
                                  overIndex,
                                  ballIndex,
                                  ball,
                                });
                                setBallAuditModalOpen(true);
                              }}
                            >
                              {getBallDisplay()}
                            </button>
                          );
                        })}
                        {over.balls.length === 0 && (
                          <span className="text-muted-foreground text-xs md:text-sm">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs md:text-sm">
                      {over.balls.reduce((sum, ball) => sum + ball.runs, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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

          {/* Player Replacement */}
          <PlayerReplacementDialog
            battingTeam={battingTeam}
            bowlingTeam={bowlingTeam}
            currentInnings={currentInnings}
            battingPlayingPlayers={battingPlayingPlayers}
            bowlingPlayingPlayers={bowlingPlayingPlayers}
            onReplace={replacePlayer}
          />

          {match.currentInnings === 1 && (
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

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full h-12 gap-2">
                <Flag className="w-5 h-5" />
                End Match
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End Match?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will finalize the match result and add it to the points table.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndMatch}>
                  End Match
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Match History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Match History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {matchHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No completed matches yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Match</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Winner</TableHead>
                  <TableHead className="text-center">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matchHistory.filter(m => m.status === 'completed').slice(-5).reverse().map((m) => {
                  const t1 = getTeam(m.team1Id);
                  const t2 = getTeam(m.team2Id);
                  const winnerTeam = m.winner ? getTeam(m.winner) : null;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {t1?.name} vs {t2?.name}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {m.innings1?.runs}/{m.innings1?.wickets} - {m.innings2?.runs}/{m.innings2?.wickets}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-primary font-medium">{winnerTeam?.name || 'Tie'}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedMatch(m);
                            setDetailsOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MatchHistoryDetails
        match={selectedMatch}
        getTeam={getTeam}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      {/* Modernized Scoring Engine Modals */}
      <NoBallModal
        open={noBallModalOpen}
        onOpenChange={setNoBallModalOpen}
        strikerName={currentBatsman?.name}
        onConfirm={handleNoBallConfirm}
      />

      <DismissalModal
        open={dismissalModalOpen}
        onOpenChange={setDismissalModalOpen}
        striker={currentBatsman}
        nonStriker={nonStriker}
        bowler={currentBowler}
        bowlingTeamPlayers={bowlingTeam.players}
        availableNextBatsmen={availableBatsmen}
        onConfirm={handleDismissalConfirm}
      />

      <OverTransitionDialog
        open={overTransitionOpen}
        onOpenChange={setOverTransitionOpen}
        overNumber={currentInnings.currentOver}
        totalRuns={currentInnings.runs}
        totalWickets={currentInnings.wickets}
        bowlingTeamPlayers={bowlingTeam.players}
        bowlerStats={currentInnings.bowlerStats}
        lastBowlerId={(match as any).lastOverBowlerId || (currentInnings.overs.length > 1 ? currentInnings.overs[currentInnings.overs.length - 2]?.bowlerId : null)}
        onSelectNextBowler={handleNextBowlerSelect}
      />

      <BallAuditModal
        open={ballAuditModalOpen}
        onOpenChange={setBallAuditModalOpen}
        overIndex={auditTarget?.overIndex ?? 0}
        ballIndex={auditTarget?.ballIndex ?? 0}
        ball={auditTarget?.ball ?? null}
        batsmanName={auditTarget?.ball?.batsmanId ? battingTeam.players.find(p => p.id === auditTarget.ball?.batsmanId)?.name : 'Batsman'}
        bowlerName={auditTarget?.ball?.bowlerId ? bowlingTeam.players.find(p => p.id === auditTarget.ball?.bowlerId)?.name : 'Bowler'}
        onEditBall={(oIdx, bIdx, updated) => editBall(oIdx, bIdx, updated)}
        onDeleteBall={(oIdx, bIdx) => deleteBall(oIdx, bIdx)}
        onUndoToBall={(oIdx, bIdx) => undoToBall(oIdx, bIdx)}
      />
    </div>
    </>
  );
}
