import { useEffect, useState } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Medal, Sparkles } from 'lucide-react';
import { TournamentCeremonyModal } from '@/components/cricket/TournamentCeremonyModal';
import { useTournamentHonors } from '@/hooks/useTournamentHonors';

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
  const [ceremonyOpen, setCeremonyOpen] = useState(false);
  const honors = useTournamentHonors(activeTournamentId);

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
      .map(team => {
        const teamStats = (stats || []).find(s => s.teamId === team.id);
        const points = teamStats?.points ?? (teamStats?.wins ? teamStats.wins * 2 : 0);
        return {
          team,
          points,
          wins: teamStats?.wins || 0,
          nrr: teamStats?.nrr || 0,
          totalRuns: teamStats?.totalRuns || 0,
        };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.nrr !== a.nrr) return b.nrr - a.nrr;
        return b.totalRuns - a.totalRuns;
      });
  };

  const groupARankings = getGroupRankings('A');
  const groupBRankings = getGroupRankings('B');

  // Get teams from tournament state (admin selected) or fallback to rankings
  const getTeamById = (id: string | null) => {
    if (!id) return null;
    return (teams || []).find(t => t.id === id) || null;
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
    <div className="relative min-h-screen bg-background pb-20 md:pb-8">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />
      <MultiMatchLiveBar />

      <main className="relative z-10 container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground font-display tracking-tight">
              {currentTournament?.name || "Tournament"} <span className="text-gradient-gold">Knockouts & Playoffs</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Qualification paths, Semi-Final matchups, and Championship Final bracket
            </p>
          </div>
          <Badge variant="gold" className="self-start sm:self-auto text-xs font-bold px-3 py-1">
            {currentTournament?.gender === 'women' ? '👑 Women\'s Division' : '🏏 Men\'s Division'}
          </Badge>
        </div>

        {/* Group Stage */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-xl">
            <CardHeader className="border-b border-white/[0.06] pb-3 bg-white/[0.01]">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg font-display">
                <Medal className="h-5 w-5 text-amber-400" />
                Group A Standings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {groupARankings.map((item, index) => {
                const isSelected = isQualifiedA(item.team.id);
                return (
                  <div
                    key={item.team.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl transition-all duration-200 border',
                      isSelected ? 'bg-amber-500/15 border-amber-500/40 shadow-sm shadow-amber-500/10' : 
                      (index < 2 && !tournamentState?.qualified_a1) ? 'bg-white/[0.04] border-emerald-500/30' : 'bg-white/[0.02] border-white/[0.05]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("font-black text-sm w-6 text-center", index < 2 ? "text-amber-400 font-display" : "text-muted-foreground")}>
                        {index + 1}
                      </span>
                      <TeamBadge team={item.team} size="sm" className="font-semibold" />
                    </div>
                    {isSelected && (
                      <span className="text-[11px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                        <Trophy className="h-3 w-3 text-amber-400" />
                        QUALIFIED
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-xl">
            <CardHeader className="border-b border-white/[0.06] pb-3 bg-white/[0.01]">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg font-display">
                <Medal className="h-5 w-5 text-amber-400" />
                Group B Standings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {groupBRankings.map((item, index) => {
                const isSelected = isQualifiedB(item.team.id);
                return (
                  <div
                    key={item.team.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-xl transition-all duration-200 border',
                      isSelected ? 'bg-amber-500/15 border-amber-500/40 shadow-sm shadow-amber-500/10' : 
                      (index < 2 && !tournamentState?.qualified_b1) ? 'bg-white/[0.04] border-emerald-500/30' : 'bg-white/[0.02] border-white/[0.05]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("font-black text-sm w-6 text-center", index < 2 ? "text-amber-400 font-display" : "text-muted-foreground")}>
                        {index + 1}
                      </span>
                      <TeamBadge team={item.team} size="sm" className="font-semibold" />
                    </div>
                    {isSelected && (
                      <span className="text-[11px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                        <Trophy className="h-3 w-3 text-amber-400" />
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
        <Card className="border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-xl">
          <CardHeader className="border-b border-white/[0.06] pb-4 bg-white/[0.01]">
            <CardTitle className="text-center font-display text-xl md:text-2xl text-gradient-gold">
              Playoffs & Championship Bracket
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col items-center space-y-8">
              {/* Semi Finals */}
              <div className="w-full">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="h-px w-12 bg-amber-500/30" />
                  <h3 className="text-center font-display text-xs md:text-sm tracking-wider uppercase text-amber-400 font-bold">
                    SEMI-FINALS
                  </h3>
                  <span className="h-px w-12 bg-amber-500/30" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* SF1: A1 vs B2 */}
                  <div className={cn(
                    "rounded-2xl p-5 transition-all duration-200 border",
                    sf1Winner ? "bg-emerald-500/10 border-emerald-500/30 shadow-md" : "bg-white/[0.02] border-white/[0.08]"
                  )}>
                    <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Semi-Final 1</span>
                      <Badge variant="outline" className="text-[10px]">A1 vs B2</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className={cn(
                        "text-center flex-1 p-3 rounded-xl border border-transparent transition-all",
                        sf1Winner?.id === a1?.id && "bg-emerald-500/15 border-emerald-500/30 font-bold"
                      )}>
                        {a1 ? (
                          <TeamBadge team={a1} size="md" showName={true} className="justify-center flex-col gap-1.5" />
                        ) : (
                          <span className="text-muted-foreground font-bold">A1</span>
                        )}
                        <span className="text-[10px] text-muted-foreground block mt-1">Group A Winner</span>
                      </div>
                      <span className="text-lg font-black text-amber-400/80 font-display">VS</span>
                      <div className={cn(
                        "text-center flex-1 p-3 rounded-xl border border-transparent transition-all",
                        sf1Winner?.id === b2?.id && "bg-emerald-500/15 border-emerald-500/30 font-bold"
                      )}>
                        {b2 ? (
                          <TeamBadge team={b2} size="md" showName={true} className="justify-center flex-col gap-1.5" />
                        ) : (
                          <span className="text-muted-foreground font-bold">B2</span>
                        )}
                        <span className="text-[10px] text-muted-foreground block mt-1">Group B Runner-up</span>
                      </div>
                    </div>
                    {sf1Winner && (
                      <div className="text-center text-xs font-bold text-emerald-400 mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> Advanced: {sf1Winner.name}
                      </div>
                    )}
                  </div>

                  {/* SF2: B1 vs A2 */}
                  <div className={cn(
                    "rounded-2xl p-5 transition-all duration-200 border",
                    sf2Winner ? "bg-emerald-500/10 border-emerald-500/30 shadow-md" : "bg-white/[0.02] border-white/[0.08]"
                  )}>
                    <div className="flex items-center justify-between mb-3 border-b border-white/[0.06] pb-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Semi-Final 2</span>
                      <Badge variant="outline" className="text-[10px]">B1 vs A2</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className={cn(
                        "text-center flex-1 p-3 rounded-xl border border-transparent transition-all",
                        sf2Winner?.id === b1?.id && "bg-emerald-500/15 border-emerald-500/30 font-bold"
                      )}>
                        {b1 ? (
                          <TeamBadge team={b1} size="md" showName={true} className="justify-center flex-col gap-1.5" />
                        ) : (
                          <span className="text-muted-foreground font-bold">B1</span>
                        )}
                        <span className="text-[10px] text-muted-foreground block mt-1">Group B Winner</span>
                      </div>
                      <span className="text-lg font-black text-amber-400/80 font-display">VS</span>
                      <div className={cn(
                        "text-center flex-1 p-3 rounded-xl border border-transparent transition-all",
                        sf2Winner?.id === a2?.id && "bg-emerald-500/15 border-emerald-500/30 font-bold"
                      )}>
                        {a2 ? (
                          <TeamBadge team={a2} size="md" showName={true} className="justify-center flex-col gap-1.5" />
                        ) : (
                          <span className="text-muted-foreground font-bold">A2</span>
                        )}
                        <span className="text-[10px] text-muted-foreground block mt-1">Group A Runner-up</span>
                      </div>
                    </div>
                    {sf2Winner && (
                      <div className="text-center text-xs font-bold text-emerald-400 mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> Advanced: {sf2Winner.name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Connector */}
              <div className="flex flex-col items-center">
                <div className="w-px h-6 bg-gradient-to-b from-amber-500/40 to-amber-500" />
                <div className="w-2.5 h-2.5 rotate-45 border border-amber-400 bg-amber-400/20" />
              </div>

              {/* Grand Final */}
              <div className="w-full max-w-lg">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="h-px w-16 bg-amber-500/40" />
                  <h3 className="text-center font-display text-sm tracking-wider uppercase text-gradient-gold font-black">
                    🏆 THE GRAND FINAL
                  </h3>
                  <span className="h-px w-16 bg-amber-500/40" />
                </div>
                <div className={cn(
                  "rounded-3xl p-6 border transition-all duration-300 shadow-2xl relative overflow-hidden",
                  champion 
                    ? "bg-gradient-to-b from-amber-500/25 via-card to-yellow-500/15 border-amber-400/50 shadow-amber-500/20" 
                    : "bg-white/[0.03] border-amber-500/30 shadow-black/40"
                )}>
                  <div className="flex items-center justify-between text-foreground">
                    <div className={cn(
                      "text-center flex-1 p-3 rounded-2xl transition-all",
                      champion?.id === sf1Winner?.id && "bg-amber-500/20 border border-amber-400/40"
                    )}>
                      {sf1Winner ? (
                        <>
                          <div 
                            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-2 text-2xl shadow-md border border-white/10"
                            style={{ backgroundColor: sf1Winner.primaryColor + '40' }}
                          >
                            {sf1Winner.logo || sf1Winner.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold block">{sf1Winner.name}</span>
                          <span className="text-[10px] text-muted-foreground">SF1 Champion</span>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-2">
                            <span className="text-sm font-bold text-muted-foreground font-display">SF1</span>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">Winner SF1</span>
                        </>
                      )}
                    </div>

                    <div className="px-4 text-center">
                      <span className="text-xl md:text-2xl font-black text-amber-400 font-display">VS</span>
                      <span className="block text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5 font-bold">Championship</span>
                    </div>

                    <div className={cn(
                      "text-center flex-1 p-3 rounded-2xl transition-all",
                      champion?.id === sf2Winner?.id && "bg-amber-500/20 border border-amber-400/40"
                    )}>
                      {sf2Winner ? (
                        <>
                          <div 
                            className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-2 text-2xl shadow-md border border-white/10"
                            style={{ backgroundColor: sf2Winner.primaryColor + '40' }}
                          >
                            {sf2Winner.logo || sf2Winner.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold block">{sf2Winner.name}</span>
                          <span className="text-[10px] text-muted-foreground">SF2 Champion</span>
                        </>
                      ) : (
                        <>
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mb-2">
                            <span className="text-sm font-bold text-muted-foreground font-display">SF2</span>
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">Winner SF2</span>
                        </>
                      )}
                    </div>
                  </div>

                  {champion && (
                    <div className="text-center mt-5 pt-4 border-t border-amber-500/30 space-y-3">
                      <p className="text-xl font-black text-gradient-gold flex items-center justify-center gap-2 font-display">
                        <Trophy className="h-6 w-6 text-amber-400 animate-bounce" />
                        KAPL CHAMPIONS: {champion.name}
                        <Trophy className="h-6 w-6 text-amber-400 animate-bounce" />
                      </p>

                      <Button
                        variant="glow"
                        size="default"
                        onClick={() => setCeremonyOpen(true)}
                        className="font-bold text-xs md:text-sm gap-2 rounded-xl shadow-lg shadow-amber-500/25"
                      >
                        <Trophy className="w-4 h-4 text-slate-950" />
                        🏆 View Championship Ceremony & Honors
                      </Button>
                    </div>
                  )}

                  {!champion && (sf1Winner || sf2Winner) && (
                    <div className="text-center mt-4 pt-3 border-t border-white/10">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCeremonyOpen(true)}
                        className="text-xs gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 rounded-xl"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Preview Presentation Ceremony
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Grand Champions Presentation Ceremony Modal */}
      {(champion || sf1Winner || sf2Winner || tournamentTeams[0]) && (
        <TournamentCeremonyModal
          isOpen={ceremonyOpen}
          onClose={() => setCeremonyOpen(false)}
          tournamentName={currentTournament?.name || "KAPL 3.0 Championship"}
          championTeam={champion || sf1Winner || sf2Winner || tournamentTeams[0]}
          runnerUpTeam={champion?.id === sf1Winner?.id ? sf2Winner : sf1Winner}
          orangeCapWinner={honors.orangeCap}
          purpleCapWinner={honors.purpleCap}
          maxSixesWinner={honors.maxSixes}
          mvpWinner={honors.mvp}
        />
      )}
    </div>
  );
}