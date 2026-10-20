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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DismissalType, Player } from '@/lib/cricketTypes';
import { AlertCircle, UserCheck, CheckCircle2 } from 'lucide-react';

interface DismissalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  striker: Player | undefined;
  nonStriker: Player | undefined;
  bowler: Player | undefined;
  bowlingTeamPlayers: Player[];
  availableNextBatsmen: Player[];
  isFreeHit?: boolean;
  onConfirm: (payload: {
    type: DismissalType;
    outBatsmanId: string;
    fielderId?: string;
    fielderName?: string;
    runsCompleted?: number;
    nextBatsmanId?: string;
  }) => void;
}

export function DismissalModal({
  open,
  onOpenChange,
  striker,
  nonStriker,
  bowler,
  bowlingTeamPlayers,
  availableNextBatsmen,
  isFreeHit = false,
  onConfirm,
}: DismissalModalProps) {
  const [selectedType, setSelectedType] = useState<DismissalType>(isFreeHit ? 'run_out' : 'bowled');
  const [outBatsmanId, setOutBatsmanId] = useState<string>(striker?.id || '');
  const [selectedFielderId, setSelectedFielderId] = useState<string>('');
  const [runsCompleted, setRunsCompleted] = useState<number>(0);
  const [nextBatsmanId, setNextBatsmanId] = useState<string>('');

  // Synchronize state when dialog opens or mode changes
  useEffect(() => {
    if (open) {
      if (isFreeHit) {
        setSelectedType('run_out');
      } else {
        setSelectedType('bowled');
      }
      setOutBatsmanId(striker?.id || '');
      setSelectedFielderId('');
      setRunsCompleted(0);
      setNextBatsmanId('');
    }
  }, [open, isFreeHit, striker?.id]);

  // Synchronize outBatsmanId when dialog opens or striker changes
  const currentOutBatsmanId = outBatsmanId || striker?.id || '';

  const requiresFielder = selectedType === 'caught' || selectedType === 'stumped' || selectedType === 'run_out';

  const handleTypeSelect = (type: DismissalType) => {
    setSelectedType(type);
    if (type !== 'run_out' && striker) {
      setOutBatsmanId(striker.id);
    }
    if (type === 'bowled' || type === 'lbw' || type === 'hit_wicket' || type === 'retired') {
      setSelectedFielderId('');
    }
  };

  const handleCaughtAndBowled = () => {
    if (bowler) {
      setSelectedFielderId(bowler.id);
    }
  };

  const handleSubmit = () => {
    const selectedFielder = (bowlingTeamPlayers || []).find(p => p.id === selectedFielderId);
    onConfirm({
      type: selectedType,
      outBatsmanId: currentOutBatsmanId,
      fielderId: selectedFielderId || undefined,
      fielderName: selectedFielder?.name || undefined,
      runsCompleted: selectedType === 'run_out' ? runsCompleted : 0,
      nextBatsmanId: nextBatsmanId || undefined,
    });

    onOpenChange(false);
    // Reset defaults
    setSelectedType('bowled');
    setSelectedFielderId('');
    setRunsCompleted(0);
    setNextBatsmanId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="destructive" className="font-extrabold uppercase tracking-wider text-xs">
              Wicket Event
            </Badge>
            <span className="text-xs font-semibold text-muted-foreground">
              Bowler: {bowler?.name || 'Current Bowler'}
            </span>
          </div>
          <DialogTitle className="text-xl font-black pt-1">
            Record Batsman Dismissal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select the dismissal method, involved fielder, and incoming batsman.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Free Hit Alert Banner */}
          {isFreeHit && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-semibold">
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
              <span>⚡ FREE HIT IN PLAY: Under MCC Law 21.18, batsmen cannot be bowled, caught, lbw, or stumped. Only RUN OUT is allowed!</span>
            </div>
          )}

          {/* Dismissal Type Grid */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
              1. Dismissal Mode {isFreeHit && '(Locked to Run Out on Free Hit)'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'bowled', label: '🎯 Bowled' },
                { type: 'caught', label: '🧤 Caught' },
                { type: 'lbw', label: '⚡ LBW' },
                { type: 'run_out', label: '🏃 Run Out' },
                { type: 'stumped', label: '🧤 Stumped' },
                { type: 'hit_wicket', label: '💥 Hit Wkt' },
              ].map((item) => {
                const isTypeDisabled = isFreeHit && item.type !== 'run_out';
                return (
                  <Button
                    key={item.type}
                    type="button"
                    variant={selectedType === item.type ? 'default' : 'outline'}
                    size="sm"
                    disabled={isTypeDisabled}
                    className={`font-bold text-xs h-10 ${
                      selectedType === item.type
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 ring-2 ring-destructive'
                        : isTypeDisabled
                        ? 'opacity-30 cursor-not-allowed bg-muted/20'
                        : ''
                    }`}
                    onClick={() => handleTypeSelect(item.type as DismissalType)}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* If Run Out: Choose who is out and completed runs */}
          {selectedType === 'run_out' && (
            <div className="space-y-3 bg-muted/40 p-3 rounded-xl border">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Which Batsman is Run Out?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={currentOutBatsmanId === striker?.id ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs font-bold"
                    onClick={() => setOutBatsmanId(striker?.id || '')}
                  >
                    {striker?.name || 'Striker'} (Striker)
                  </Button>
                  <Button
                    type="button"
                    variant={currentOutBatsmanId === nonStriker?.id ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs font-bold"
                    onClick={() => setOutBatsmanId(nonStriker?.id || '')}
                  >
                    {nonStriker?.name || 'Non-Striker'} (Non-Striker)
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Completed Runs Before Wicket
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map((r) => (
                    <Button
                      key={r}
                      type="button"
                      variant={runsCompleted === r ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs font-bold"
                      onClick={() => setRunsCompleted(r)}
                    >
                      {r} Run{r === 1 ? '' : 's'}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fielder Selection (Caught, Stumped, Run Out) */}
          {requiresFielder && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  2. Fielder Involved
                </label>
                {selectedType === 'caught' && bowler && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-primary px-2 font-bold"
                    onClick={handleCaughtAndBowled}
                  >
                    Caught & Bowled?
                  </Button>
                )}
              </div>
              <Select
                value={selectedFielderId}
                onValueChange={setSelectedFielderId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select fielder from fielding team" />
                </SelectTrigger>
                <SelectContent>
                  {bowlingTeamPlayers.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name} {player.id === bowler?.id ? '(Bowler)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Next Incoming Batsman Selection */}
          <div className="space-y-2 bg-primary/5 p-3 rounded-xl border border-primary/20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
              <UserCheck className="w-4 h-4" />
              <span>3. Next Batsman (Optional - Or Pick Later)</span>
            </div>
            {availableNextBatsmen.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No more batsmen available (Innings completed or all out).
              </p>
            ) : (
              <Select
                value={nextBatsmanId}
                onValueChange={setNextBatsmanId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose next batsman to come in" />
                </SelectTrigger>
                <SelectContent>
                  {availableNextBatsmen.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
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
            variant="destructive"
            className="gap-2 font-bold shadow-md"
            onClick={handleSubmit}
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

