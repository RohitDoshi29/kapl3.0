import { useState, useEffect } from 'react';
import { Team, Match } from '@/lib/cricketTypes';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Flame, Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface MatchPredictionWidgetProps {
  match: Match;
  team1: Team;
  team2: Team;
}

export function MatchPredictionWidget({ match, team1, team2 }: MatchPredictionWidgetProps) {
  const storageKey = `kapl_fan_vote_${match.id}`;

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(storageKey);
  });

  // Default baseline vote distribution based on hash of match ID for deterministic community feel
  const [votes, setVotes] = useState<{ team1: number; team2: number }>(() => {
    const seed = match.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const base1 = 30 + (seed % 40);
    const base2 = 30 + ((seed * 7) % 40);
    return { team1: base1, team2: base2 };
  });

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setSelectedTeamId(saved);
    }
  }, [match.id, storageKey]);

  const handleVote = (teamId: string) => {
    if (selectedTeamId === teamId) return;

    setVotes(prev => {
      const next = { ...prev };
      if (selectedTeamId === team1.id) next.team1 = Math.max(0, next.team1 - 1);
      if (selectedTeamId === team2.id) next.team2 = Math.max(0, next.team2 - 1);

      if (teamId === team1.id) next.team1 += 1;
      if (teamId === team2.id) next.team2 += 1;
      return next;
    });

    setSelectedTeamId(teamId);
    localStorage.setItem(storageKey, teamId);

    const chosenTeam = teamId === team1.id ? team1.name : team2.name;
    toast.success(`Vote cast for ${chosenTeam}! 🏏`);
  };

  const totalVotes = votes.team1 + votes.team2;
  const team1Pct = totalVotes > 0 ? Math.round((votes.team1 / totalVotes) * 100) : 50;
  const team2Pct = 100 - team1Pct;

  return (
    <Card className="border border-border/80 bg-card/90 shadow-sm overflow-hidden rounded-2xl">
      <CardContent className="p-3.5 md:p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-amber-500/15 text-amber-500">
              <Flame className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              Fan Zone: Match Winner Prediction
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Users className="w-3 h-3" />
            <span>{totalVotes} fan votes</span>
          </div>
        </div>

        {/* Voting Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Team 1 Button */}
          <button
            type="button"
            onClick={() => handleVote(team1.id)}
            className={`relative flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
              selectedTeamId === team1.id
                ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                : 'border-border/80 bg-background/60 hover:bg-muted/70'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: team1.primaryColor
                    ? `hsl(${team1.primaryColor})`
                    : '#3b82f6',
                }}
              />
              <span className="font-bold text-xs truncate text-foreground">
                {team1.name}
              </span>
            </div>

            {selectedTeamId === team1.id && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 ml-1 flex-shrink-0 font-bold">
                <Check className="w-2.5 h-2.5 mr-0.5" /> Pick
              </Badge>
            )}
          </button>

          {/* Team 2 Button */}
          <button
            type="button"
            onClick={() => handleVote(team2.id)}
            className={`relative flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
              selectedTeamId === team2.id
                ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/40'
                : 'border-border/80 bg-background/60 hover:bg-muted/70'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: team2.primaryColor
                    ? `hsl(${team2.primaryColor})`
                    : '#10b981',
                }}
              />
              <span className="font-bold text-xs truncate text-foreground">
                {team2.name}
              </span>
            </div>

            {selectedTeamId === team2.id && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 ml-1 flex-shrink-0 font-bold">
                <Check className="w-2.5 h-2.5 mr-0.5" /> Pick
              </Badge>
            )}
          </button>
        </div>

        {/* Dynamic Percentage Bar */}
        <div className="space-y-1">
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${team1Pct}%` }}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${team2Pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-primary font-mono">{team1Pct}%</span>
            <span className="text-[10px] text-muted-foreground font-normal">Live Audience Split</span>
            <span className="text-emerald-500 font-mono">{team2Pct}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

