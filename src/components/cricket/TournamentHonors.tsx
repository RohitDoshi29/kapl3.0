import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Zap, Award, Trophy, ArrowRight, Shield } from 'lucide-react';

interface CapLeader {
  playerId: string;
  name: string;
  photoUrl: string | null;
  teamId: string | null;
  teamName: string | null;
  teamColor: string | null;
  primaryStat: number;
  primaryStatLabel: string;
  secondaryStat: string;
  secondaryStatLabel: string;
  matchesPlayed: number;
}

export function TournamentHonors({ tournamentId }: { tournamentId?: string }) {
  const { teams, matchHistory, matchState, getTeam } = useCricketStore();
  const { activeTournamentId } = useTournament();

  const currentTournamentId = tournamentId || activeTournamentId;

  const { orangeCap, purpleCap, maxSixes } = useMemo(() => {
    const allMatches = [...matchHistory];
    if (matchState.currentMatch) {
      allMatches.push(matchState.currentMatch);
    }

    // Filter by active tournament
    const tournamentMatches = allMatches.filter(
      m => (m.tournamentId || 'kapl-3-mens') === currentTournamentId
    );

    interface PlayerAccumulator {
      playerId: string;
      name: string;
      photo: string | null;
      teamId: string | null;
      teamName: string | null;
      teamColor: string | null;
      matchIds: Set<string>;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      wickets: number;
      overs: number;
      runsConceded: number;
    }

    const map = new Map<string, PlayerAccumulator>();

    const getOrCreate = (playerId: string, name: string, teamId: string): PlayerAccumulator => {
      let acc = map.get(playerId);
      if (!acc) {
        const team = getTeam(teamId) || teams.find(t => t.id === teamId);
        const playerObj = team?.players?.find(p => p.id === playerId);

        acc = {
          playerId,
          name: playerObj?.name || name || 'Player',
          photo: playerObj?.photo || null,
          teamId: team?.id || null,
          teamName: team?.name || null,
          teamColor: team?.primaryColor || null,
          matchIds: new Set(),
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          overs: 0,
          runsConceded: 0,
        };
        map.set(playerId, acc);
      }
      return acc;
    };

    tournamentMatches.forEach(match => {
      const inningsList = [match.innings1, match.innings2].filter(Boolean);
      inningsList.forEach(innings => {
        if (!innings) return;

        // Batters
        Object.values(innings.batterStats || {}).forEach(b => {
          if (!b?.id) return;
          const acc = getOrCreate(b.id, b.name, innings.battingTeamId);
          acc.matchIds.add(match.id);
          acc.runs += b.runs || 0;
          acc.balls += b.balls || 0;
          acc.fours += b.fours || 0;
          acc.sixes += b.sixes || 0;
        });

        // Bowlers
        Object.values(innings.bowlerStats || {}).forEach(bowler => {
          if (!bowler?.id) return;
          const acc = getOrCreate(bowler.id, bowler.name, innings.bowlingTeamId);
          acc.matchIds.add(match.id);
          acc.wickets += bowler.wickets || 0;
          acc.overs += bowler.overs || 0;
          acc.runsConceded += bowler.runsConceded || 0;
        });
      });
    });

    const playerList = Array.from(map.values());

    // 1. Orange Cap: Most Runs
    const orangeLeader = [...playerList].sort((a, b) => b.runs - a.runs)[0];
    const orange: CapLeader | null =
      orangeLeader && orangeLeader.runs > 0
        ? {
            playerId: orangeLeader.playerId,
            name: orangeLeader.name,
            photoUrl: orangeLeader.photo,
            teamId: orangeLeader.teamId,
            teamName: orangeLeader.teamName,
            teamColor: orangeLeader.teamColor,
            primaryStat: orangeLeader.runs,
            primaryStatLabel: 'Runs',
            secondaryStat: orangeLeader.balls > 0 ? ((orangeLeader.runs / orangeLeader.balls) * 100).toFixed(1) : '0',
            secondaryStatLabel: 'Strike Rate',
            matchesPlayed: orangeLeader.matchIds.size,
          }
        : null;

    // 2. Purple Cap: Most Wickets
    const purpleLeader = [...playerList].sort((a, b) => {
      if (b.wickets !== a.wickets) return b.wickets - a.wickets;
      return a.runsConceded - b.runsConceded;
    })[0];

    const purple: CapLeader | null =
      purpleLeader && purpleLeader.wickets > 0
        ? {
            playerId: purpleLeader.playerId,
            name: purpleLeader.name,
            photoUrl: purpleLeader.photo,
            teamId: purpleLeader.teamId,
            teamName: purpleLeader.teamName,
            teamColor: purpleLeader.teamColor,
            primaryStat: purpleLeader.wickets,
            primaryStatLabel: 'Wickets',
            secondaryStat: purpleLeader.overs > 0 ? (purpleLeader.runsConceded / purpleLeader.overs).toFixed(2) : '-',
            secondaryStatLabel: 'Economy',
            matchesPlayed: purpleLeader.matchIds.size,
          }
        : null;

    // 3. Maximum Sixes Award
    const sixesLeader = [...playerList].sort((a, b) => b.sixes - a.sixes)[0];
    const maxSix: CapLeader | null =
      sixesLeader && sixesLeader.sixes > 0
        ? {
            playerId: sixesLeader.playerId,
            name: sixesLeader.name,
            photoUrl: sixesLeader.photo,
            teamId: sixesLeader.teamId,
            teamName: sixesLeader.teamName,
            teamColor: sixesLeader.teamColor,
            primaryStat: sixesLeader.sixes,
            primaryStatLabel: 'Sixes',
            secondaryStat: `${sixesLeader.fours} Fours`,
            secondaryStatLabel: 'Boundaries',
            matchesPlayed: sixesLeader.matchIds.size,
          }
        : null;

    return { orangeCap: orange, purpleCap: purple, maxSixes: maxSix };
  }, [matchHistory, matchState.currentMatch, currentTournamentId, teams, getTeam]);

  if (!orangeCap && !purpleCap && !maxSixes) {
    return null;
  }

  return (
    <div className="w-full space-y-3 my-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg md:text-xl font-black tracking-tight text-foreground font-display">
            Tournament Honors & Caps
          </h2>
        </div>
        <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider">
          {currentTournamentId === 'kapl-3-womens' ? '👑 Women’s Division' : '🏏 Men’s Division'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Orange Cap Card */}
        {orangeCap ? (
          <Link to={`/players/${orangeCap.playerId}`} className="group block">
            <Card className="relative overflow-hidden border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/15 via-card to-card hover:border-orange-500 transition-all shadow-sm group-hover:shadow-md">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🧢</span>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-orange-500 block leading-tight">
                        ORANGE CAP
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Leading Run Scorer
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-orange-500 text-black font-extrabold text-xs px-2 py-0.5">
                    {orangeCap.primaryStat} {orangeCap.primaryStatLabel}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 border-2 border-orange-500/30 flex items-center justify-center font-black text-orange-500 text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                    {orangeCap.photoUrl ? (
                      <img
                        src={orangeCap.photoUrl}
                        alt={orangeCap.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      orangeCap.name[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-foreground text-sm truncate group-hover:text-orange-500 transition-colors">
                      {orangeCap.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {orangeCap.teamName || 'Tournament Squad'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>SR {orangeCap.secondaryStat}</span>
                      <span>•</span>
                      <span>{orangeCap.matchesPlayed} matches</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ) : (
          <Card className="border border-dashed border-border/80 bg-card/40 p-5 text-center">
            <span className="text-2xl mb-1 block">🧢</span>
            <p className="text-xs font-bold text-muted-foreground uppercase">Orange Cap</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting tournament runs</p>
          </Card>
        )}

        {/* Purple Cap Card */}
        {purpleCap ? (
          <Link to={`/players/${purpleCap.playerId}`} className="group block">
            <Card className="relative overflow-hidden border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/15 via-card to-card hover:border-purple-500 transition-all shadow-sm group-hover:shadow-md">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🧢</span>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-purple-400 block leading-tight">
                        PURPLE CAP
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Leading Wicket Taker
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-purple-500 text-white font-extrabold text-xs px-2 py-0.5">
                    {purpleCap.primaryStat} {purpleCap.primaryStatLabel}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/20 border-2 border-purple-500/30 flex items-center justify-center font-black text-purple-400 text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                    {purpleCap.photoUrl ? (
                      <img
                        src={purpleCap.photoUrl}
                        alt={purpleCap.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      purpleCap.name[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-foreground text-sm truncate group-hover:text-purple-400 transition-colors">
                      {purpleCap.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {purpleCap.teamName || 'Tournament Squad'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>Econ {purpleCap.secondaryStat}</span>
                      <span>•</span>
                      <span>{purpleCap.matchesPlayed} matches</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ) : (
          <Card className="border border-dashed border-border/80 bg-card/40 p-5 text-center">
            <span className="text-2xl mb-1 block">🧢</span>
            <p className="text-xs font-bold text-muted-foreground uppercase">Purple Cap</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting tournament wickets</p>
          </Card>
        )}

        {/* Maximum Sixes Award Card */}
        {maxSixes ? (
          <Link to={`/players/${maxSixes.playerId}`} className="group block">
            <Card className="relative overflow-hidden border-2 border-amber-400/40 bg-gradient-to-br from-amber-400/15 via-card to-card hover:border-amber-400 transition-all shadow-sm group-hover:shadow-md">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💥</span>
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 block leading-tight">
                        MAXIMUM SIXES
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Tournament Power Hitter
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-amber-400 text-black font-extrabold text-xs px-2 py-0.5">
                    {maxSixes.primaryStat} {maxSixes.primaryStatLabel}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-400/20 border-2 border-amber-400/30 flex items-center justify-center font-black text-amber-400 text-lg flex-shrink-0 group-hover:scale-105 transition-transform">
                    {maxSixes.photoUrl ? (
                      <img
                        src={maxSixes.photoUrl}
                        alt={maxSixes.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      maxSixes.name[0]
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-foreground text-sm truncate group-hover:text-amber-400 transition-colors">
                      {maxSixes.name}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {maxSixes.teamName || 'Tournament Squad'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                      <span>{maxSixes.secondaryStat}</span>
                      <span>•</span>
                      <span>{maxSixes.matchesPlayed} matches</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ) : (
          <Card className="border border-dashed border-border/80 bg-card/40 p-5 text-center">
            <span className="text-2xl mb-1 block">💥</span>
            <p className="text-xs font-bold text-muted-foreground uppercase">Max Sixes</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting tournament maximums</p>
          </Card>
        )}
      </div>
    </div>
  );
}

