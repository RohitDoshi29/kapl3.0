import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Player, BowlerStats } from '@/lib/cricketTypes';
import { MATCH_CONSTANTS } from '@/lib/matchConstants';
import { ArrowLeftRight, CheckCircle2, ShieldAlert } from 'lucide-react';

interface OverTransitionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overNumber: number;
  totalRuns: number;
  totalWickets: number;
  bowlingTeamPlayers: Player[];
  bowlerStats: Record<string, BowlerStats>;
  lastBowlerId?: string | null;
  onSelectNextBowler: (bowlerId: string) => void;
}

export function OverTransitionDialog({
  open,
  onOpenChange,
  overNumber,
  totalRuns,
  totalWickets,
  bowlingTeamPlayers,
  bowlerStats,
  lastBowlerId,
  onSelectNextBowler,
}: OverTransitionDialogProps) {
  const handleSelect = (playerId: string) => {
    onSelectNextBowler(playerId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge className="bg-primary text-primary-foreground font-extrabold uppercase tracking-wider text-xs">
              Over {overNumber} Completed
            </Badge>
            <span className="text-sm font-black text-foreground">
              Score: {totalRuns}/{totalWickets}
            </span>
          </div>
          <DialogTitle className="text-xl font-black pt-2">
            End of Over {overNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Strike has automatically rotated. Select the bowler for Over {overNumber + 1}.
          </DialogDescription>
        </DialogHeader>

        {/* Strike Rotated Notice */}
        <div className="flex items-center gap-2 bg-muted/60 border rounded-xl p-2.5 text-xs text-muted-foreground">
          <ArrowLeftRight className="w-4 h-4 text-primary shrink-0" />
          <span>Striker and Non-Striker have changed ends for the new over.</span>
        </div>

        {/* Bowler Selection */}
        <div className="space-y-2 pt-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            Select Bowler for Over {overNumber + 1}
          </label>

          <div className="grid grid-cols-1 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {bowlingTeamPlayers.map((player) => {
              const stats = bowlerStats[player.id];
              const oversBowled = stats?.overs || 0;
              const hasReachedQuota = oversBowled >= MATCH_CONSTANTS.MAX_OVERS_PER_BOWLER;
              const isConsecutiveBowler = player.id === lastBowlerId;
              const isDisabled = hasReachedQuota || isConsecutiveBowler;

              return (
                <Button
                  key={player.id}
                  type="button"
                  variant={isDisabled ? 'ghost' : 'outline'}
                  disabled={isDisabled}
                  className={`w-full justify-between h-11 text-xs font-semibold ${
                    isDisabled ? 'opacity-50 cursor-not-allowed bg-muted/20' : 'hover:border-primary'
                  }`}
                  onClick={() => handleSelect(player.id)}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-foreground truncate">{player.name}</span>
                    {stats && (
                      <span className="text-muted-foreground text-[11px]">
                        ({stats.overs}.{stats.balls} ov • {stats.runs} r • {stats.wickets} w)
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {isConsecutiveBowler && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20">
                        Consecutive
                      </Badge>
                    )}
                    {hasReachedQuota && (
                      <Badge variant="destructive" className="text-[10px]">
                        Quota Full
                      </Badge>
                    )}
                    {!isDisabled && (
                      <span className="text-primary font-bold text-xs flex items-center gap-1">
                        Select <CheckCircle2 className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                </Button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
            Max {MATCH_CONSTANTS.MAX_OVERS_PER_BOWLER} overs per bowler. Bowlers cannot bowl back-to-back overs.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

