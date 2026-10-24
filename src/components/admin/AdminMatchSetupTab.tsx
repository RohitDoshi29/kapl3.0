import { useState } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { TournamentSwitcher } from '@/components/cricket/TournamentSwitcher';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { PlayCircle, AlertCircle, Trophy, Users, UserCheck, Trash2 } from 'lucide-react';
import { MatchType, MATCH_TYPE_LABELS, MatchFixture } from '@/lib/cricketTypes';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import { Badge } from '@/components/ui/badge';
import { MatchFixturesCalendar } from '@/components/cricket/MatchFixturesCalendar';
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

interface AdminMatchSetupTabProps {
  onNavigateToScorer: () => void;
}

export default function AdminMatchSetupTab({ onNavigateToScorer }: AdminMatchSetupTabProps) {
  const { activeTournamentId, currentTournament } = useTournament();
  const { getTeamsByGroup, getTeam, startMatch, abandonMatch, matchState, teams } = useCricketStore(activeTournamentId);
  const [selectedGroup, setSelectedGroup] = useState<'A' | 'B'>('A');
  const [team1Id, setTeam1Id] = useState<string>('');
  const [team2Id, setTeam2Id] = useState<string>('');
  const [tossWinner, setTossWinner] = useState<'team1' | 'team2' | ''>('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | ''>('');
  const [matchType, setMatchType] = useState<'group' | 'knockout'>('group');
  const [knockoutType, setKnockoutType] = useState<'semi_final_1' | 'semi_final_2' | 'final'>('semi_final_1');
  const [knockoutTeam1Id, setKnockoutTeam1Id] = useState<string>('');
  const [knockoutTeam2Id, setKnockoutTeam2Id] = useState<string>('');
  const [knockoutTossWinner, setKnockoutTossWinner] = useState<'team1' | 'team2' | ''>('');
  const [knockoutTossDecision, setKnockoutTossDecision] = useState<'bat' | 'bowl' | ''>('');
  
  // Playing 7 selection
  const [team1PlayingPlayers, setTeam1PlayingPlayers] = useState<string[]>([]);
  const [team2PlayingPlayers, setTeam2PlayingPlayers] = useState<string[]>([]);
  const [knockoutTeam1PlayingPlayers, setKnockoutTeam1PlayingPlayers] = useState<string[]>([]);
  const [knockoutTeam2PlayingPlayers, setKnockoutTeam2PlayingPlayers] = useState<string[]>([]);

  const groupTeams = getTeamsByGroup(selectedGroup, activeTournamentId);
  const tournamentTeams = teams.filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);
  const team1 = team1Id ? getTeam(team1Id) : null;
  const team2 = team2Id ? getTeam(team2Id) : null;
  const knockoutTeam1 = knockoutTeam1Id ? getTeam(knockoutTeam1Id) : null;
  const knockoutTeam2 = knockoutTeam2Id ? getTeam(knockoutTeam2Id) : null;

  const handleSelectFixture = (fixture: MatchFixture) => {
    const t1 = getTeam(fixture.team1Id);
    const t2 = getTeam(fixture.team2Id);

    if (fixture.matchType === 'group') {
      setMatchType('group');
      if (fixture.group) setSelectedGroup(fixture.group);
      setTeam1Id(fixture.team1Id);
      setTeam2Id(fixture.team2Id);
      setTossWinner('');
      setTossDecision('');
      if (t1) setTeam1PlayingPlayers(t1.players.slice(0, MATCH_CONSTANTS.PLAYING_PLAYERS).map(p => p.id));
      if (t2) setTeam2PlayingPlayers(t2.players.slice(0, MATCH_CONSTANTS.PLAYING_PLAYERS).map(p => p.id));
    } else {
      setMatchType('knockout');
      setKnockoutType(fixture.matchType as 'semi_final_1' | 'semi_final_2' | 'final');
      setKnockoutTeam1Id(fixture.team1Id);
      setKnockoutTeam2Id(fixture.team2Id);
      setKnockoutTossWinner('');
      setKnockoutTossDecision('');
      if (t1) setKnockoutTeam1PlayingPlayers(t1.players.slice(0, MATCH_CONSTANTS.PLAYING_PLAYERS).map(p => p.id));
      if (t2) setKnockoutTeam2PlayingPlayers(t2.players.slice(0, MATCH_CONSTANTS.PLAYING_PLAYERS).map(p => p.id));
    }

    toast.success(`Loaded fixture: ${t1?.name || fixture.team1Id} vs ${t2?.name || fixture.team2Id}`);
    const elem = document.getElementById('match-setup-form');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleGroupChange = (group: 'A' | 'B') => {
    setSelectedGroup(group);
    setTeam1Id('');
    setTeam2Id('');
    setTossWinner('');
    setTossDecision('');
    setTeam1PlayingPlayers([]);
    setTeam2PlayingPlayers([]);
  };

  const handleTeam1Change = (id: string) => {
    setTeam1Id(id);
    setTossWinner('');
    setTossDecision('');
    setTeam1PlayingPlayers([]);
  };

  const handleTeam2Change = (id: string) => {
    setTeam2Id(id);
    setTossWinner('');
    setTossDecision('');
    setTeam2PlayingPlayers([]);
  };

  const togglePlayer = (playerId: string, teamSide: 'team1' | 'team2', isKnockout: boolean) => {
    if (isKnockout) {
      if (teamSide === 'team1') {
        setKnockoutTeam1PlayingPlayers(prev => {
          if (prev.includes(playerId)) {
            return prev.filter(id => id !== playerId);
          }
          if (prev.length >= MATCH_CONSTANTS.PLAYING_PLAYERS) {
            toast.error(`Maximum ${MATCH_CONSTANTS.PLAYING_PLAYERS} players allowed`);
            return prev;
          }
          return [...prev, playerId];
        });
      } else {
        setKnockoutTeam2PlayingPlayers(prev => {
          if (prev.includes(playerId)) {
            return prev.filter(id => id !== playerId);
          }
          if (prev.length >= MATCH_CONSTANTS.PLAYING_PLAYERS) {
            toast.error(`Maximum ${MATCH_CONSTANTS.PLAYING_PLAYERS} players allowed`);
            return prev;
          }
          return [...prev, playerId];
        });
      }
    } else {
      if (teamSide === 'team1') {
        setTeam1PlayingPlayers(prev => {
          if (prev.includes(playerId)) {
            return prev.filter(id => id !== playerId);
          }
          if (prev.length >= MATCH_CONSTANTS.PLAYING_PLAYERS) {
            toast.error(`Maximum ${MATCH_CONSTANTS.PLAYING_PLAYERS} players allowed`);
            return prev;
          }
          return [...prev, playerId];
        });
      } else {
        setTeam2PlayingPlayers(prev => {
          if (prev.includes(playerId)) {
            return prev.filter(id => id !== playerId);
          }
          if (prev.length >= MATCH_CONSTANTS.PLAYING_PLAYERS) {
            toast.error(`Maximum ${MATCH_CONSTANTS.PLAYING_PLAYERS} players allowed`);
            return prev;
          }
          return [...prev, playerId];
        });
      }
    }
  };

  // Determine batting order based on toss
  const getBattingOrder = (t1Id: string, t2Id: string, winner: 'team1' | 'team2', decision: 'bat' | 'bowl') => {
    const battingFirst = decision === 'bat' ? winner : (winner === 'team1' ? 'team2' : 'team1');
    if (battingFirst === 'team1') {
      return { battingTeamId: t1Id, bowlingTeamId: t2Id };
    }
    return { battingTeamId: t2Id, bowlingTeamId: t1Id };
  };

  const handleStartGroupMatch = async () => {
    if (!team1Id || !team2Id) {
      toast.error('Please select both teams');
      return;
    }
    if (team1Id === team2Id) {
      toast.error('Please select different teams');
      return;
    }
    if (!tossWinner || !tossDecision) {
      toast.error('Please complete toss details');
      return;
    }
    if (team1PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS) {
      toast.error(`Please select exactly ${MATCH_CONSTANTS.PLAYING_PLAYERS} players for ${team1?.name}`);
      return;
    }
    if (team2PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS) {
      toast.error(`Please select exactly ${MATCH_CONSTANTS.PLAYING_PLAYERS} players for ${team2?.name}`);
      return;
    }
    const { battingTeamId, bowlingTeamId } = getBattingOrder(team1Id, team2Id, tossWinner, tossDecision);
    const playingPlayers = {
      [team1Id]: team1PlayingPlayers,
      [team2Id]: team2PlayingPlayers,
    };
    await startMatch(selectedGroup, battingTeamId, bowlingTeamId, 'group', playingPlayers, activeTournamentId);
    toast.success('Group match started!');
    onNavigateToScorer();
  };

  const handleStartKnockoutMatch = async () => {
    if (!knockoutTeam1Id || !knockoutTeam2Id) {
      toast.error('Please select both teams');
      return;
    }
    if (knockoutTeam1Id === knockoutTeam2Id) {
      toast.error('Please select different teams');
      return;
    }
    if (!knockoutTossWinner || !knockoutTossDecision) {
      toast.error('Please complete toss details');
      return;
    }
    if (knockoutTeam1PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS) {
      toast.error(`Please select exactly ${MATCH_CONSTANTS.PLAYING_PLAYERS} players for ${knockoutTeam1?.name}`);
      return;
    }
    if (knockoutTeam2PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS) {
      toast.error(`Please select exactly ${MATCH_CONSTANTS.PLAYING_PLAYERS} players for ${knockoutTeam2?.name}`);
      return;
    }
    const { battingTeamId, bowlingTeamId } = getBattingOrder(knockoutTeam1Id, knockoutTeam2Id, knockoutTossWinner, knockoutTossDecision);
    const playingPlayers = {
      [knockoutTeam1Id]: knockoutTeam1PlayingPlayers,
      [knockoutTeam2Id]: knockoutTeam2PlayingPlayers,
    };
    // Use 'A' as default group for knockout matches
    await startMatch('A', battingTeamId, bowlingTeamId, knockoutType, playingPlayers, activeTournamentId);
    toast.success(`${MATCH_TYPE_LABELS[knockoutType]} started!`);
    onNavigateToScorer();
  };

  const hasActiveMatch = !!matchState.currentMatch;

  const renderPlayerSelection = (team: typeof team1, selectedPlayers: string[], teamSide: 'team1' | 'team2', isKnockout: boolean) => {
    if (!team) return null;
    
    return (
      <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <Label className="text-sm font-medium">{team.name} - Playing {MATCH_CONSTANTS.PLAYING_PLAYERS}</Label>
          </div>
          <Badge variant={selectedPlayers.length === MATCH_CONSTANTS.PLAYING_PLAYERS ? "default" : "destructive"}>
            {selectedPlayers.length}/{MATCH_CONSTANTS.PLAYING_PLAYERS}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {team.players.map((player) => (
            <div key={player.id} className="flex items-center space-x-2">
              <Checkbox
                id={`${isKnockout ? 'ko-' : ''}${teamSide}-${player.id}`}
                checked={selectedPlayers.includes(player.id)}
                onCheckedChange={() => togglePlayer(player.id, teamSide, isKnockout)}
              />
              <label
                htmlFor={`${isKnockout ? 'ko-' : ''}${teamSide}-${player.id}`}
                className="text-sm cursor-pointer"
              >
                {player.name}
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (hasActiveMatch) {
    const activeMatch = matchState.currentMatch!;
    const activeTeam1 = getTeam(activeMatch.team1Id);
    const activeTeam2 = getTeam(activeMatch.team2Id);

    return (
      <div className="max-w-md mx-auto space-y-4">
        {/* Tournament Division Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-card/80 border border-white/10 rounded-2xl p-2.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tournament Division:</span>
            <Badge variant="gold" className="text-xs font-bold">
              {currentTournament?.name || 'KAPL 3.0'}
            </Badge>
          </div>
          <TournamentSwitcher size="sm" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-500">
              <AlertCircle className="w-5 h-5" />
              Match In Progress ({currentTournament?.name || 'KAPL 3.0'})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              There's already an active match. End the current match before starting a new one.
            </p>
            <div className="text-center text-sm text-muted-foreground mb-2">
              {MATCH_TYPE_LABELS[activeMatch.matchType || 'group']}
            </div>
            <div className="text-center text-xs text-muted-foreground">
              {MATCH_CONSTANTS.MAX_OVERS} Overs | {MATCH_CONSTANTS.MAX_WICKETS} Wickets Max
            </div>
            <div className="flex items-center justify-center gap-4 py-4">
              {activeTeam1 && <TeamBadge team={activeTeam1} size="md" />}
              <span className="text-xl font-bold">vs</span>
              {activeTeam2 && <TeamBadge team={activeTeam2} size="md" />}
            </div>
            <div className="grid gap-2">
              <Button className="w-full" onClick={onNavigateToScorer}>
                Go to Scorer
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2 font-bold">
                    <Trash2 className="w-4 h-4" />
                    Discard / Remove This Match
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Discard Match in Progress?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately remove this match ({activeTeam1?.name || 'Team 1'} vs {activeTeam2?.name || 'Team 2'}) without saving it to points table or match history. You can then start a fresh match immediately.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        await abandonMatch();
                        toast.success('Match in progress has been removed');
                      }}
                      className="bg-destructive hover:bg-destructive/90 text-white font-bold"
                    >
                      Yes, Discard Match
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tournament Division Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-card/80 border border-white/10 rounded-2xl p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tournament Division:</span>
          <Badge variant="gold" className="text-xs font-bold">
            {currentTournament?.name || 'KAPL 3.0'}
          </Badge>
        </div>
        <TournamentSwitcher size="sm" />
      </div>

      {/* Tournament Fixtures & Quick Launcher */}
      <MatchFixturesCalendar onSelectFixtureForScoring={handleSelectFixture} isAdminView={true} />

      <Card id="match-setup-form" className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>New Match Setup</span>
            <Badge variant="outline">{MATCH_CONSTANTS.MAX_OVERS} Overs | {MATCH_CONSTANTS.MAX_WICKETS} Wickets</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={matchType} onValueChange={(v) => setMatchType(v as 'group' | 'knockout')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="group" className="gap-2">
                <Users className="w-4 h-4" />
                Group Stage
              </TabsTrigger>
              <TabsTrigger value="knockout" className="gap-2">
                <Trophy className="w-4 h-4" />
                Knockout
              </TabsTrigger>
            </TabsList>

            {/* Group Stage Tab */}
            <TabsContent value="group" className="space-y-4 mt-6">
              {/* Group Selection */}
              <div className="space-y-2">
                <Label>Select Group</Label>
                <Select value={selectedGroup} onValueChange={(v) => handleGroupChange(v as 'A' | 'B')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Group A</SelectItem>
                    <SelectItem value="B">Group B</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Team 1 */}
              <div className="space-y-2">
                <Label>Team 1</Label>
                <Select value={team1Id} onValueChange={handleTeam1Change}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id} disabled={team.id === team2Id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `hsl(${team.primaryColor})` }}
                          />
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team 1 Player Selection */}
              {team1 && renderPlayerSelection(team1, team1PlayingPlayers, 'team1', false)}

              {/* Team 2 */}
              <div className="space-y-2">
                <Label>Team 2</Label>
                <Select value={team2Id} onValueChange={handleTeam2Change}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id} disabled={team.id === team1Id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `hsl(${team.primaryColor})` }}
                          />
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Team 2 Player Selection */}
              {team2 && renderPlayerSelection(team2, team2PlayingPlayers, 'team2', false)}

              {/* Toss Section */}
              {team1 && team2 && (
                <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium text-center">Toss Details</p>
                  <div className="space-y-2">
                    <Label>Who won the toss?</Label>
                    <Select value={tossWinner} onValueChange={(v) => setTossWinner(v as 'team1' | 'team2')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select toss winner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${team1.primaryColor})` }} />
                            {team1.name}
                          </div>
                        </SelectItem>
                        <SelectItem value="team2">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${team2.primaryColor})` }} />
                            {team2.name}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tossWinner && (
                    <div className="space-y-2">
                      <Label>{tossWinner === 'team1' ? team1.name : team2.name} elected to?</Label>
                      <Select value={tossDecision} onValueChange={(v) => setTossDecision(v as 'bat' | 'bowl')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select decision" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bat">Bat First</SelectItem>
                          <SelectItem value="bowl">Bowl First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {tossWinner && tossDecision && (
                    <p className="text-sm text-center text-muted-foreground">
                      {tossDecision === 'bat' 
                        ? (tossWinner === 'team1' ? team1.name : team2.name) 
                        : (tossWinner === 'team1' ? team2.name : team1.name)
                      } will bat first
                    </p>
                  )}
                </div>
              )}

              {/* Preview */}
              {team1 && team2 && (
                <div className="py-4 border-t">
                  <p className="text-sm text-muted-foreground mb-3 text-center">Match Preview</p>
                  <div className="flex items-center justify-center gap-4">
                    <TeamBadge team={team1} size="md" />
                    <span className="text-xl font-bold text-primary">vs</span>
                    <TeamBadge team={team2} size="md" />
                  </div>
                </div>
              )}

              <Button
                className="w-full h-12 gap-2"
                onClick={handleStartGroupMatch}
                disabled={
                  !team1Id || 
                  !team2Id || 
                  team1Id === team2Id || 
                  !tossWinner || 
                  !tossDecision ||
                  team1PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS ||
                  team2PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS
                }
              >
                <PlayCircle className="w-5 h-5" />
                Start Group Match
              </Button>
            </TabsContent>

            {/* Knockout Tab */}
            <TabsContent value="knockout" className="space-y-4 mt-6">
              {/* Match Type Selection */}
              <div className="space-y-2">
                <Label>Match Type</Label>
                <Select value={knockoutType} onValueChange={(v) => setKnockoutType(v as 'semi_final_1' | 'semi_final_2' | 'final')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semi_final_1">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        Semi Final 1
                      </div>
                    </SelectItem>
                    <SelectItem value="semi_final_2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        Semi Final 2
                      </div>
                    </SelectItem>
                    <SelectItem value="final">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        Final
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Team 1 (from active tournament teams) */}
              <div className="space-y-2">
                <Label>Team 1</Label>
                <Select value={knockoutTeam1Id} onValueChange={(v) => { setKnockoutTeam1Id(v); setKnockoutTossWinner(''); setKnockoutTossDecision(''); setKnockoutTeam1PlayingPlayers([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournamentTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id} disabled={team.id === knockoutTeam2Id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `hsl(${team.primaryColor})` }}
                          />
                          {team.name}
                          <span className="text-xs text-muted-foreground">(Group {team.group})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Knockout Team 1 Player Selection */}
              {knockoutTeam1 && renderPlayerSelection(knockoutTeam1, knockoutTeam1PlayingPlayers, 'team1', true)}

              {/* Team 2 */}
              <div className="space-y-2">
                <Label>Team 2</Label>
                <Select value={knockoutTeam2Id} onValueChange={(v) => { setKnockoutTeam2Id(v); setKnockoutTossWinner(''); setKnockoutTossDecision(''); setKnockoutTeam2PlayingPlayers([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournamentTeams.map((team) => (
                      <SelectItem key={team.id} value={team.id} disabled={team.id === knockoutTeam1Id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: `hsl(${team.primaryColor})` }}
                          />
                          {team.name}
                          <span className="text-xs text-muted-foreground">(Group {team.group})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Knockout Team 2 Player Selection */}
              {knockoutTeam2 && renderPlayerSelection(knockoutTeam2, knockoutTeam2PlayingPlayers, 'team2', true)}

              {/* Toss Section for Knockout */}
              {knockoutTeam1 && knockoutTeam2 && (
                <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium text-center">Toss Details</p>
                  <div className="space-y-2">
                    <Label>Who won the toss?</Label>
                    <Select value={knockoutTossWinner} onValueChange={(v) => setKnockoutTossWinner(v as 'team1' | 'team2')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select toss winner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${knockoutTeam1.primaryColor})` }} />
                            {knockoutTeam1.name}
                          </div>
                        </SelectItem>
                        <SelectItem value="team2">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `hsl(${knockoutTeam2.primaryColor})` }} />
                            {knockoutTeam2.name}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {knockoutTossWinner && (
                    <div className="space-y-2">
                      <Label>{knockoutTossWinner === 'team1' ? knockoutTeam1.name : knockoutTeam2.name} elected to?</Label>
                      <Select value={knockoutTossDecision} onValueChange={(v) => setKnockoutTossDecision(v as 'bat' | 'bowl')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select decision" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bat">Bat First</SelectItem>
                          <SelectItem value="bowl">Bowl First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {knockoutTossWinner && knockoutTossDecision && (
                    <p className="text-sm text-center text-muted-foreground">
                      {knockoutTossDecision === 'bat' 
                        ? (knockoutTossWinner === 'team1' ? knockoutTeam1.name : knockoutTeam2.name) 
                        : (knockoutTossWinner === 'team1' ? knockoutTeam2.name : knockoutTeam1.name)
                      } will bat first
                    </p>
                  )}
                </div>
              )}

              {/* Preview */}
              {knockoutTeam1 && knockoutTeam2 && (
                <div className="py-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1 text-center">
                    {MATCH_TYPE_LABELS[knockoutType]}
                  </p>
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <TeamBadge team={knockoutTeam1} size="md" />
                    <span className="text-xl font-bold text-primary">vs</span>
                    <TeamBadge team={knockoutTeam2} size="md" />
                  </div>
                </div>
              )}

              <Button
                className="w-full h-12 gap-2"
                onClick={handleStartKnockoutMatch}
                disabled={
                  !knockoutTeam1Id || 
                  !knockoutTeam2Id || 
                  knockoutTeam1Id === knockoutTeam2Id || 
                  !knockoutTossWinner || 
                  !knockoutTossDecision ||
                  knockoutTeam1PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS ||
                  knockoutTeam2PlayingPlayers.length !== MATCH_CONSTANTS.PLAYING_PLAYERS
                }
              >
                <Trophy className="w-5 h-5" />
                Start {MATCH_TYPE_LABELS[knockoutType]}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
