import { useState, useEffect, useMemo } from 'react';
import { MatchFixture, Team, MATCH_TYPE_LABELS } from '@/lib/cricketTypes';
import { getStoredFixtures, resetToDefaultFixtures } from '@/lib/fixturesData';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TeamBadge } from './TeamBadge';
import { Calendar, Clock, MapPin, Play, Trophy, RotateCcw, Filter, CheckCircle2, Radio } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface MatchFixturesCalendarProps {
  onSelectFixtureForScoring?: (fixture: MatchFixture) => void;
  isAdminView?: boolean;
  className?: string;
}

export function MatchFixturesCalendar({
  onSelectFixtureForScoring,
  isAdminView = false,
  className,
}: MatchFixturesCalendarProps) {
  const { teams, getTeam, matchState } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState<'all' | 'A' | 'B' | 'knockout'>('all');
  const [activeDayFilter, setActiveDayFilter] = useState<string>('all');
  const navigate = useNavigate();

  // Load fixtures
  useEffect(() => {
    setFixtures(getStoredFixtures(activeTournamentId));

    const handleUpdate = (e: any) => {
      if (e.detail?.tournamentId === activeTournamentId) {
        setFixtures(e.detail.fixtures);
      }
    };

    window.addEventListener('kapl-fixtures-updated', handleUpdate);
    return () => window.removeEventListener('kapl-fixtures-updated', handleUpdate);
  }, [activeTournamentId]);

  // Extract unique days
  const availableDays = useMemo(() => {
    const days = new Set<string>();
    fixtures.forEach((f) => {
      if (f.scheduledDate) days.add(f.scheduledDate);
    });
    return Array.from(days);
  }, [fixtures]);

  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      if (activeGroupTab === 'A' && f.group !== 'A') return false;
      if (activeGroupTab === 'B' && f.group !== 'B') return false;
      if (activeGroupTab === 'knockout' && f.matchType === 'group') return false;
      if (activeDayFilter !== 'all' && f.scheduledDate !== activeDayFilter) return false;
      return true;
    });
  }, [fixtures, activeGroupTab, activeDayFilter]);

  const handleReset = () => {
    const defaults = resetToDefaultFixtures(activeTournamentId);
    setFixtures(defaults);
    toast.success('Fixtures reset to official schedule');
  };

  const getStatusBadge = (fixture: MatchFixture) => {
    // Check if currently active match matches this fixture
    const currentMatch = matchState.currentMatch;
    const isActuallyLive =
      currentMatch &&
      currentMatch.status === 'live' &&
      ((currentMatch.team1Id === fixture.team1Id && currentMatch.team2Id === fixture.team2Id) ||
        (currentMatch.team1Id === fixture.team2Id && currentMatch.team2Id === fixture.team1Id));

    if (isActuallyLive || fixture.status === 'live') {
      return (
        <Badge className="bg-rose-600 text-white font-black text-xs gap-1.5 animate-pulse border border-rose-400/50 shadow-md shadow-rose-600/30">
          <Radio className="w-3 h-3 animate-ping" /> LIVE NOW
        </Badge>
      );
    }

    if (fixture.status === 'completed') {
      return (
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 font-bold text-xs gap-1 border-emerald-500/30">
          <CheckCircle2 className="w-3 h-3" /> COMPLETED
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-300 font-bold text-xs border-amber-500/30">
        TO BE DECIDED (TBD)
      </Badge>
    );
  };

  return (
    <Card className={cn('overflow-hidden rounded-2xl border-white/[0.08] bg-card/90 backdrop-blur-md shadow-xl', className)}>
      <CardHeader className="pb-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg font-bold flex flex-wrap items-center gap-2">
                Tournament Fixtures & Schedule
                <Badge variant="outline" className="bg-amber-500/15 border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  ⏳ TO BE DECIDED (TBD)
                </Badge>
                <Badge variant="gold" className="text-[10px]">
                  {currentTournament?.name || 'KAPL 3.0'}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Match schedule, timings, and team matchups are To Be Decided following the Mega Player Auction
              </p>
            </div>
          </div>

          {isAdminView && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs h-8 gap-1.5 border-white/10"
              title="Reset schedule to default official fixtures"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Schedule
            </Button>
          )}
        </div>

        {/* Tab filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3">
          {/* Stage Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <Button
              variant={activeGroupTab === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('all')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold"
            >
              All Matches ({fixtures.length})
            </Button>
            <Button
              variant={activeGroupTab === 'A' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('A')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold"
            >
              Group A
            </Button>
            <Button
              variant={activeGroupTab === 'B' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('B')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold"
            >
              Group B
            </Button>
            <Button
              variant={activeGroupTab === 'knockout' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveGroupTab('knockout')}
              className="h-7 text-xs px-2.5 rounded-lg font-bold gap-1"
            >
              <Trophy className="w-3 h-3 text-amber-400" />
              Knockouts
            </Button>
          </div>

          {/* Day Filter */}
          {availableDays.length > 1 && (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground font-medium hidden sm:inline">Day:</span>
              <div className="flex items-center gap-1">
                <Button
                  variant={activeDayFilter === 'all' ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setActiveDayFilter('all')}
                  className="h-6 text-[11px] px-2 rounded-md"
                >
                  All Days
                </Button>
                {availableDays.map((d) => (
                  <Button
                    key={d}
                    variant={activeDayFilter === d ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDayFilter(d)}
                    className="h-6 text-[11px] px-2 rounded-md"
                  >
                    {d.split(' ')[0]}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 md:p-6 space-y-4">
        {/* TBD Notice Banner */}
        <div className="flex items-start sm:items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/5 border border-amber-500/30 text-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-md">
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-bold text-amber-300">
              <span className="text-sm font-black">Official Schedule: To Be Decided (TBD)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 border border-amber-400/40 text-amber-200">
                Pending Mega Auction & Group Draws
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Official match dates, timings, venues, and team fixtures are currently being finalized and will be confirmed after the Mega Player Auction. Below is the provisional tournament draft structure.
            </p>
          </div>
        </div>

        {filteredFixtures.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No fixtures found for the selected category.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFixtures.map((fixture) => {
              const team1 = getTeam(fixture.team1Id);
              const team2 = getTeam(fixture.team2Id);

              const isKnockout = fixture.matchType !== 'group';

              return (
                <div
                  key={fixture.id}
                  className={cn(
                    'p-4 rounded-2xl border transition-all hover:border-white/[0.18] relative flex flex-col justify-between gap-3 shadow-md',
                    isKnockout
                      ? 'bg-gradient-to-br from-amber-500/[0.08] via-card to-card border-amber-500/30'
                      : 'bg-card/70 border-white/[0.08]'
                  )}
                >
                  {/* Top Header: Match Number + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black tracking-wider uppercase text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {isKnockout ? MATCH_TYPE_LABELS[fixture.matchType] : `Match ${fixture.matchNumber}`}
                      </span>
                      {fixture.group && (
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          Group {fixture.group}
                        </span>
                      )}
                    </div>
                    {getStatusBadge(fixture)}
                  </div>

                  {/* Teams Matchup Center */}
                  <div className="py-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    {/* Team 1 */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      {team1 && <TeamBadge team={team1} size="md" showName={false} />}
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground truncate">
                          {team1 ? team1.name : fixture.team1Id}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Team 1
                        </div>
                      </div>
                    </div>

                    {/* VS Pill */}
                    <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center font-bold text-[11px] text-muted-foreground">
                      VS
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center justify-end gap-2.5 min-w-0 text-right">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground truncate">
                          {team2 ? team2.name : fixture.team2Id}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Team 2
                        </div>
                      </div>
                      {team2 && <TeamBadge team={team2} size="md" showName={false} />}
                    </div>
                  </div>

                  {/* Summary / Notes */}
                  {fixture.notes && (
                    <div className="text-xs text-amber-300/80 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 italic">
                      ✨ {fixture.notes}
                    </div>
                  )}

                  {fixture.summary && (
                    <div className="text-xs text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold">
                      🏆 {fixture.summary}
                    </div>
                  )}

                  {/* Bottom Footer: Timing & Action */}
                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 font-medium text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>To Be Decided (TBD) • Post Auction</span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{fixture.venue}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    {onSelectFixtureForScoring ? (
                      <Button
                        variant="glow"
                        size="sm"
                        onClick={() => onSelectFixtureForScoring(fixture)}
                        className="h-8 text-xs font-bold gap-1 shadow-sm"
                      >
                        <Play className="w-3 h-3" /> Launch Match
                      </Button>
                    ) : fixture.status === 'live' ? (
                      <Link to="/">
                        <Button variant="destructive" size="sm" className="h-8 text-xs font-bold gap-1">
                          <Radio className="w-3 h-3" /> Watch Live
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

