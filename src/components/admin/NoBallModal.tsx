import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Sparkles, CheckCircle2 } from 'lucide-react';

interface NoBallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strikerName?: string;
  onConfirm: (batRuns: number, isBye: boolean, boundaryDeclared: boolean) => void;
}

export function NoBallModal({
  open,
  onOpenChange,
  strikerName = 'Striker',
  onConfirm,
}: NoBallModalProps) {
  const [batRuns, setBatRuns] = useState<number>(0);
  const [isBye, setIsBye] = useState<boolean>(false);
  const [boundaryDeclared, setBoundaryDeclared] = useState<boolean>(false);

  const totalRuns = 1 + batRuns;

  const handleSelectRuns = (runs: number) => {
    setBatRuns(runs);
    if (runs === 4 || runs === 6) {
      setIsBye(false);
    }
  };

  const handleConfirm = () => {
    onConfirm(batRuns, isBye, boundaryDeclared);
    onOpenChange(false);
    // Reset state for next use
    setBatRuns(0);
    setIsBye(false);
    setBoundaryDeclared(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold px-2.5 py-1 text-xs uppercase tracking-wider">
              No Ball Delivery
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">+1 Penalty Run</span>
          </div>
          <DialogTitle className="text-xl font-black flex items-center gap-2 pt-2">
            Record No-Ball Delivery
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            1 extra run is automatically awarded to the batting team. Specify any additional runs scored off this delivery.
          </DialogDescription>
        </DialogHeader>

        {/* Free Hit Alert Banner */}
        <div className="flex items-center gap-2.5 bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border border-amber-500/40 rounded-xl p-3 text-amber-500">
          <Zap className="w-5 h-5 text-amber-400 animate-bounce shrink-0" />
          <div className="text-xs">
            <span className="font-bold uppercase tracking-wider block text-amber-400">Next Delivery = FREE HIT!</span>
            <span className="text-muted-foreground">Batsman cannot be dismissed bowled, caught, or lbw.</span>
          </div>
        </div>

        {/* Additional Runs Selection */}
        <div className="space-y-3 pt-1">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            Runs Scored on Delivery
          </label>
          <div className="grid grid-cols-6 gap-1.5">
            {[0, 1, 2, 3, 4, 6].map((r) => (
              <Button
                key={r}
                type="button"
                variant={batRuns === r ? 'default' : 'outline'}
                className={`h-12 text-base font-extrabold ${
                  batRuns === r
                    ? r === 4
                      ? 'bg-cricket-four text-white ring-2 ring-primary'
                      : r === 6
                      ? 'bg-cricket-six text-white ring-2 ring-primary'
                      : 'bg-primary text-primary-foreground ring-2 ring-primary'
                    : ''
                }`}
                onClick={() => handleSelectRuns(r)}
              >
                {r === 0 ? 'Dot' : `+${r}`}
              </Button>
            ))}
          </div>
        </div>

        {/* Run Source: Bat vs Byes */}
        {batRuns > 0 && (
          <div className="space-y-2 pt-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Run Source
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!isBye ? 'default' : 'outline'}
                size="sm"
                className="text-xs font-semibold"
                onClick={() => setIsBye(false)}
              >
                Off the Bat ({strikerName})
              </Button>
              <Button
                type="button"
                variant={isBye ? 'default' : 'outline'}
                size="sm"
                className="text-xs font-semibold"
                onClick={() => setIsBye(true)}
              >
                Bye / Leg-Bye
              </Button>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-muted/50 border rounded-xl p-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">Total Runs for Ball:</span>
          <div className="flex items-center gap-1.5 font-bold">
            <span className="text-amber-500 font-extrabold">1 NB</span>
            <span>+</span>
            <span>{batRuns} {isBye ? 'Byes' : 'Off Bat'}</span>
            <span>=</span>
            <span className="text-sm font-black text-foreground bg-primary/20 px-2 py-0.5 rounded-md">
              {totalRuns} Runs
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2 font-bold bg-amber-500 hover:bg-amber-600 text-black shadow-md"
            onClick={handleConfirm}
          >
            <CheckCircle2 className="w-4 h-4" />
            Record No-Ball (+{totalRuns})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

