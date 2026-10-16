import { useState, useEffect } from 'react';
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
import { Ball } from '@/lib/cricketTypes';
import { Edit3, Trash2, Undo2, CheckCircle2 } from 'lucide-react';

interface BallAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overIndex: number;
  ballIndex: number;
  ball: Ball | null;
  batsmanName?: string;
  bowlerName?: string;
  onEditBall: (overIndex: number, ballIndex: number, updated: Partial<Ball>) => void;
  onDeleteBall: (overIndex: number, ballIndex: number) => void;
  onUndoToBall: (overIndex: number, ballIndex: number) => void;
}

export function BallAuditModal({
  open,
  onOpenChange,
  overIndex,
  ballIndex,
  ball,
  batsmanName = 'Batsman',
  bowlerName = 'Bowler',
  onEditBall,
  onDeleteBall,
  onUndoToBall,
}: BallAuditModalProps) {
  const [runs, setRuns] = useState<number>(0);
  const [isWicket, setIsWicket] = useState<boolean>(false);
  const [ballType, setBallType] = useState<'normal' | 'wide' | 'no_ball'>('normal');

  useEffect(() => {
    if (ball) {
      setRuns(ball.runs);
      setIsWicket(ball.isWicket);
      if (ball.isWide) setBallType('wide');
      else if (ball.isNoBall) setBallType('no_ball');
      else setBallType('normal');
    }
  }, [ball]);

  if (!ball) return null;

  const handleSave = () => {
    const isWide = ballType === 'wide';
    const isNoBall = ballType === 'no_ball';
    const isExtra = isWide || isNoBall;

    onEditBall(overIndex, ballIndex, {
      runs,
      isWicket,
      isWide,
      isNoBall,
      isExtra,
      extraType: isWide ? 'wide' : isNoBall ? 'no_ball' : null,
      runsOffBat: !isWide && !isNoBall ? runs : isNoBall ? Math.max(0, runs - 1) : 0,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    onDeleteBall(overIndex, ballIndex);
    onOpenChange(false);
  };

  const handleRollback = () => {
    onUndoToBall(overIndex, ballIndex);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs font-bold">
              Over {overIndex + 1}, Ball {ballIndex + 1}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {batsmanName} vs {bowlerName}
            </span>
          </div>
          <DialogTitle className="text-lg font-black pt-1 flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-primary" />
            Audit & Edit Ball
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Modify this ball's runs or type. The scorecard and player figures will recalculate immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Runs Selection */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Runs Scored
            </label>
            <div className="grid grid-cols-7 gap-1.5">
              {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                <Button
                  key={r}
                  type="button"
                  variant={runs === r ? 'default' : 'outline'}
                  size="sm"
                  className={`font-bold text-xs h-10 ${
                    runs === r ? 'bg-primary text-primary-foreground ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setRuns(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          {/* Delivery Type */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Delivery Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={ballType === 'normal' ? 'default' : 'outline'}
                size="sm"
                className="text-xs font-bold"
                onClick={() => setBallType('normal')}
              >
                Normal (Bat)
              </Button>
              <Button
                type="button"
                variant={ballType === 'wide' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-bold ${ballType === 'wide' ? 'bg-amber-500 text-black hover:bg-amber-600' : ''}`}
                onClick={() => setBallType('wide')}
              >
                Wide (+1)
              </Button>
              <Button
                type="button"
                variant={ballType === 'no_ball' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs font-bold ${ballType === 'no_ball' ? 'bg-amber-500 text-black hover:bg-amber-600' : ''}`}
                onClick={() => setBallType('no_ball')}
              >
                No Ball (+1)
              </Button>
            </div>
          </div>

          {/* Wicket Toggle */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Wicket Outcome
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={!isWicket ? 'default' : 'outline'}
                size="sm"
                className="text-xs font-bold"
                onClick={() => setIsWicket(false)}
              >
                Not Out
              </Button>
              <Button
                type="button"
                variant={isWicket ? 'destructive' : 'outline'}
                size="sm"
                className="text-xs font-bold"
                onClick={() => setIsWicket(true)}
              >
                Out (Wicket)
              </Button>
            </div>
          </div>

          {/* Destructive Actions Row */}
          <div className="pt-2 border-t flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
              onClick={handleDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Ball
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-muted-foreground hover:bg-muted gap-1.5"
              onClick={handleRollback}
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo From Here
            </Button>
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
            className="gap-2 font-bold shadow-md"
            onClick={handleSave}
          >
            <CheckCircle2 className="w-4 h-4" />
            Apply Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

