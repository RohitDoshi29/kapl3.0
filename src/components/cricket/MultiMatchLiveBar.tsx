import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight, Radio } from 'lucide-react';

export function MultiMatchLiveBar() {
  const { allTournamentMatches, matchState, getTeam } = useCricketStore();
  const { activeTournamentId, setActiveTournamentId, isMens } = useTournament();

  const otherTournamentId = activeTournamentId === 'kapl-3-mens' ? 'kapl-3-womens' : 'kapl-3-mens';
  const match = allTournamentMatches?.[otherTournamentId] || 
    (matchState.currentMatch && matchState.currentMatch.tournamentId === otherTournamentId ? matchState.currentMatch : null);

  if (!match || (match.status !== 'live' && match.status !== 'super_over')) return null;

  // Determine which tournament this live match belongs to
  const matchTournamentId = match.tournamentId || otherTournamentId;

  // If match belongs to the tournament currently active, we don't need a crossover alert
  if (matchTournamentId === activeTournamentId) {
    return null;
  }

  const team1 = getTeam(match.team1Id);
  const team2 = getTeam(match.team2Id);
  const currentInnings = match.currentInnings === 1 ? match.innings1 : match.innings2;
  const otherLeagueName = matchTournamentId === 'kapl-3-womens' ? "Women's KAPL" : "Men's KAPL";
  const otherIcon = matchTournamentId === 'kapl-3-womens' ? '👑' : '🏏';

  return (
    <div className="w-full bg-gradient-to-r from-destructive/20 via-primary/20 to-accent/20 border-y border-primary/30 py-2 px-3 sm:px-4 shadow-sm animate-pulse">
      <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs md:text-sm">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 font-bold min-w-0">
          <Badge variant="destructive" className="flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 shrink-0">
            <Radio className="w-3 h-3 animate-ping" />
            Live in {otherLeagueName}
          </Badge>
          <span className="text-foreground truncate">
            {otherIcon} {team1?.name || 'Team 1'} vs {team2?.name || 'Team 2'}
          </span>
          {currentInnings && (
            <span className="font-extrabold text-primary shrink-0">
              • {currentInnings.runs}/{currentInnings.wickets} ({currentInnings.currentOver}.{currentInnings.currentBall} ov)
            </span>
          )}
        </div>

        <Button
          size="sm"
          variant="default"
          className="h-7 text-xs font-extrabold gap-1 px-3 shadow-md bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto justify-center touch-manipulation"
          onClick={() => {
            setActiveTournamentId(matchTournamentId);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <span>Switch to {otherLeagueName}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

