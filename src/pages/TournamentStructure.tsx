import { useEffect, useState } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal } from 'lucide-react';

interface TournamentState {
  qualified_a1: string | null;
  qualified_a2: string | null;
  qualified_b1: string | null;
  qualified_b2: string | null;
  sf1_winner: string | null;
  sf2_winner: string | null;
  final_winner: string | null;
}

export default function TournamentStructure() {
  const { teams, getTeamStats } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();
  const stats = getTeamStats(activeTournamentId);
  const [tournamentState, setTournamentState] = useState<TournamentState | null>(null);

  const tournamentTeams = teams.filter(t => (t.tournamentId || 'kapl-3-mens') === activeTournamentId);

  useEffect(() => {
    const fetchTournamentState = async () => {
      let { data } = await supabase
        .from('tournament_state')
        .select('*')
        .eq('id', activeTournamentId)
        .maybeSingle();
      
      if (!data) {
        // Fallback to 'current' for backwards compatibility
        const { data: legacyData } = await supabase
          .from('tournament_state')
          .select('*')
          .eq('id', 'current')
          .maybeSingle();
        data = legacyData;
      }

      if (data) {
        setTournamentState(data as TournamentState);
      } else {
        setTournamentState(null);
      }
    };

    fetchTournamentState();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`tournament-state-${activeTournamentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournament_state' },
        (payload) => {
          const rec = payload.new as any;
          if (rec.id === activeTournamentId || rec.id === 'current') {
            setTournamentState(rec as TournamentState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTournamentId]);

  const getGroupRankings = (group: 'A' | 'B') => {
    const groupTeams = tournamentTeams.filter(t => t.group === group);
    return groupTeams
      .map(team => ({
        team,
        totalRuns: stats.find(s => s.teamId === team.id)?.totalRuns || 0,
      }))
      .sort((a, b) => b.totalRuns - a.totalRuns);
  };

  const groupARankings = getGroupRankings('A');
  const groupBRankings = getGroupRankings('B');

  // Get teams from tournament state (admin selected) or fallback to rankings
  const getTeamById = (id: string | null) => {
    if (!id) return null;
    return teams.find(t => t.id === id) || null;
  };

  const a1 = getTeamById(tournamentState?.qualified_a1) || groupARankings[0]?.team;
  const a2 = getTeamById(tournamentState?.qualified_a2) || groupARankings[1]?.team;
  const b1 = getTeamById(tournamentState?.qualified_b1) || groupBRankings[0]?.team;
  const b2 = getTeamById(tournamentState?.qualified_b2) || groupBRankings[1]?.team;

  const sf1Winner = getTeamById(tournamentState?.sf1_winner);
  const sf2Winner = getTeamById(tournamentState?.sf2_winner);
  const champion = getTeamById(tournamentState?.final_winner);

  const isQualifiedA = (teamId: string) => 
    teamId === tournamentState?.qualified_a1 || teamId === tournamentState?.qualified_a2;
  const isQualifiedB = (teamId: string) => 
    teamId === tournamentState?.qualified_b1 || teamId === tournamentState?.qualified_b2;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <Navigation />
      <Header />
      <MultiMatchLiveBar />

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight">
            {currentTournament?.name || "Tournament"} Knockouts & Structure
          </h1>
          <Badge variant="outline" className="text-xs font-semibold">
            {currentTournament?.gender === 'women' ? '👑 Women\'s Division' : '🏏 Men\'s Division'}
          </Badge>
        </div>

        {/* Group Stage */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-primary" />
                Group A
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupARankings.map((item, index) => {
                const isSelected = isQualifiedA(item.team.id);
                return (
                  <div
                    key={item.team.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg transition-all',
                      isSelected ? 'bg-primary/20 border border-primary/30' : 
                      (index < 2 && !tournamentState?.qualified_a1) ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg w-6">{index + 1}</span>
                      <TeamBadge team={item.team} size="sm" />
                    </div>
                    {isSelected && (
                      <span className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        QUALIFIED
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-primary" />
                Group B
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupBRankings.map((item, index) => {
                const isSelected = isQualifiedB(item.team.id);
                return (
                  <div
                    key={item.team.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg transition-all',
                      isSelected ? 'bg-primary/20 border border-primary/30' : 
                      (index < 2 && !tournamentState?.qualified_b1) ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg w-6">{index + 1}</span>
                      <TeamBadge team={item.team} size="sm" />
                    </div>
                    {isSelected && (
                      <span className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        QUALIFIED
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Knockout Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Knockout Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-8">
              {/* Semi Finals */}
              <div className="w-full">
                <h3 className="text-center font-semibold text-muted-foreground mb-4">SEMI-FINALS</h3>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* SF1: A1 vs B2 */}
                  <div className={cn(
                    "rounded-xl p-4 transition-all",
                    sf1Winner ? "bg-primary/10 border border-primary/30" : "bg-muted"
                  )}>
                    <p className="text-xs text-muted-foreground mb-3 text-center">Semi-Final 1</p>
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "text-center flex-1 p-2 rounded-lg",
                        sf1Winner?.id === a1?.id && "bg-green-500/20"
                      )}>
                        {a1 ? (
                          <TeamBadge team={a1} size="md" showName={true} className="justify-center flex-col" />
                        ) : (
                          <span className="text-muted-foreground">A1</span>
                        )}
                        <span className="text-xs text-muted-foreground block mt-1">Group A #1</span>
                      </div>
                      <span className="text-xl font-bold px-4">vs</span>
                      <div className={cn(
                        "text-center flex-1 p-2 rounded-lg",
                        sf1Winner?.id === b2?.id && "bg-green-500/20"
                      )}>
                        {b2 ? (
                          <TeamBadge team={b2} size="md" showName={true} className="justify-center flex-col" />
                        ) : (
                          <span className="text-muted-foreground">B2</span>
                        )}
                        <span className="text-xs text-muted-foreground block mt-1">Group B #2</span>
                      </div>
                    </div>
                    {sf1Winner && (
                      <p className="text-center text-sm font-semibold text-green-600 mt-3">
                        Winner: {sf1Winner.name}
                      </p>
                    )}
                  </div>

                  {/* SF2: B1 vs A2 */}
                  <div className={cn(
                    "rounded-xl p-4 transition-all",
                    sf2Winner ? "bg-primary/10 border border-primary/30" : "bg-muted"
                  )}>
                    <p className="text-xs text-muted-foreground mb-3 text-center">Semi-Final 2</p>
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "text-center flex-1 p-2 rounded-lg",
                        sf2Winner?.id === b1?.id && "bg-green-500/20"
                      )}>
                        {b1 ? (
                          <TeamBadge team={b1} size="md" showName={true} className="justify-center flex-col" />
                        ) : (
                          <span className="text-muted-foreground">B1</span>
                        )}
                        <span className="text-xs text-muted-foreground block mt-1">Group B #1</span>
                      </div>
                      <span className="text-xl font-bold px-4">vs</span>
                      <div className={cn(
                        "text-center flex-1 p-2 rounded-lg",
                        sf2Winner?.id === a2?.id && "bg-green-500/20"
                      )}>
                        {a2 ? (
                          <TeamBadge team={a2} size="md" showName={true} className="justify-center flex-col" />
                        ) : (
                          <span className="text-muted-foreground">A2</span>
                        )}
                        <span className="text-xs text-muted-foreground block mt-1">Group A #2</span>
                      </div>
                    </div>
                    {sf2Winner && (
                      <p className="text-center text-sm font-semibold text-green-600 mt-3">
                        Winner: {sf2Winner.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Connector Lines */}
              <div className="w-px h-8 bg-border" />

              {/* Final */}
              <div className="w-full max-w-md">
                <h3 className="text-center font-semibold text-cricket-accent mb-4">🏆 FINAL</h3>
                <div className={cn(
                  "rounded-xl p-6",
                  champion 
                    ? "bg-gradient-to-r from-yellow-500 to-amber-500" 
                    : "bg-gradient-to-r from-cricket-primary to-cricket-secondary"
                )}>
                  <div className="flex items-center justify-between text-white">
                    <div className={cn(
                      "text-center flex-1 p-2 rounded-lg",
                      champion?.id === sf1Winner?.id && "bg-white/30"
                    )}>
                      {sf1Winner ? (
                        <>
                          <div 
                            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 text-2xl"
                            style={{ backgroundColor: sf1Winner.primaryColor + '40' }}
                          >
                            {sf1Winner.logo || sf1Winner.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{sf1Winner.name}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-2">
                            <span className="text-sm font-bold">SF1</span>
                          </div>
                          <span className="text-sm">Winner SF1</span>
                        </>
                      )}
                    </div>
                    <span className="text-2xl font-bold px-4">vs</span>
                    <div className={cn(
                      "text-center flex-1 p-2 rounded-lg",
                      champion?.id === sf2Winner?.id && "bg-white/30"
                    )}>
                      {sf2Winner ? (
                        <>
                          <div 
                            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2 text-2xl"
                            style={{ backgroundColor: sf2Winner.primaryColor + '40' }}
                          >
                            {sf2Winner.logo || sf2Winner.name.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{sf2Winner.name}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-2">
                            <span className="text-sm font-bold">SF2</span>
                          </div>
                          <span className="text-sm">Winner SF2</span>
                        </>
                      )}
                    </div>
                  </div>
                  {champion && (
                    <div className="text-center mt-4 pt-4 border-t border-white/30">
                      <p className="text-lg font-bold text-white flex items-center justify-center gap-2">
                        <Trophy className="h-5 w-5" />
                        Champion: {champion.name}
                        <Trophy className="h-5 w-5" />
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}