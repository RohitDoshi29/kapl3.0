import { useState, useEffect, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Match, Team, Player, MatchAward, PlayerOfTheMatchData } from '@/lib/cricketTypes';
import { calculateMatchPerformances, PlayerPerformance } from '@/lib/playerOfTheMatchCalculator';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import { playVictoryFanfare } from '@/lib/soundEffects';
import { TeamBadge } from './TeamBadge';
import {
  Trophy,
  Award,
  Medal,
  Star,
  Sparkles,
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

interface PlayerOfTheMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match | null;
  team1: Team | undefined;
  team2: Team | undefined;
  onConfirm: (data: PlayerOfTheMatchData) => void;
  onSkip?: () => void;
  isPostMatchReview?: boolean;
}

export function PlayerOfTheMatchModal({
  open,
  onOpenChange,
  match,
  team1,
  team2,
  onConfirm,
  onSkip,
  isPostMatchReview = false,
}: PlayerOfTheMatchModalProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [showAdditionalAwards, setShowAdditionalAwards] = useState<boolean>(false);
  
  // Additional match awards
  const [bestBatterId, setBestBatterId] = useState<string>('');
  const [bestBowlerId, setBestBowlerId] = useState<string>('');
  const [maxSixesId, setMaxSixesId] = useState<string>('');

  // Calculate performances
  const {
    recommendedCandidate,
    candidates,
    bestBatter,
    bestBowler,
    mostSixes,
    allSquadPlayers,
  } = useMemo(() => {
    return calculateMatchPerformances(match, team1, team2);
  }, [match, team1, team2]);

  // Synchronize initial selections when modal opens
  useEffect(() => {
    if (open && match) {
      // 1. Initial Player of the Match
      const initialPlayerId = match.playerOfTheMatchId || recommendedCandidate?.player.id || candidates[0]?.player.id || '';
      setSelectedPlayerId(initialPlayerId);

      // 2. Initial Citation Reason
      const existingCandidate = candidates.find(c => c.player.id === initialPlayerId);
      const initialReason = match.playerOfTheMatchReason || existingCandidate?.suggestedReason || recommendedCandidate?.suggestedReason || '';
      setReason(initialReason);

      // 3. Additional awards initialization
      const existingAwards = match.awards || [];
      const batterAward = existingAwards.find(a => a.id === 'best_batter')?.playerId || bestBatter?.player.id || '';
      const bowlerAward = existingAwards.find(a => a.id === 'best_bowler')?.playerId || bestBowler?.player.id || '';
      const sixesAward = existingAwards.find(a => a.id === 'max_sixes')?.playerId || mostSixes?.player.id || '';
      
      setBestBatterId(batterAward);
      setBestBowlerId(bowlerAward);
      setMaxSixesId(sixesAward);

      // Trigger victory effects if closing a live match
      if (!isPostMatchReview) {
        triggerCelebrationConfetti(3500);
        playVictoryFanfare();
      }
    }
  }, [open, match, recommendedCandidate, candidates, bestBatter, bestBowler, mostSixes, isPostMatchReview]);

  // Selected player record
  const selectedCandidate = candidates.find(c => c.player.id === selectedPlayerId);
  const selectedSquadMember = allSquadPlayers.find(p => p.player.id === selectedPlayerId);
  const selectedPlayer = selectedCandidate?.player || selectedSquadMember?.player;
  const selectedTeam = selectedCandidate?.team || selectedSquadMember?.team;

  const handleSelectCandidate = (candidate: PlayerPerformance) => {
    setSelectedPlayerId(candidate.player.id);
    setReason(candidate.suggestedReason);
  };

  const handleSelectSquadMember = (playerId: string) => {
    setSelectedPlayerId(playerId);
    const candidate = candidates.find(c => c.player.id === playerId);
    if (candidate) {
      setReason(candidate.suggestedReason);
    } else {
      const member = allSquadPlayers.find(p => p.player.id === playerId);
      setReason(`Awarded Player of the Match for impactful ground contribution with ${member?.team.name || 'the team'}.`);
    }
  };

  const handleConfirm = () => {
    if (!selectedPlayer || !selectedTeam) {
      toast.error('Please select a Player of the Match');
      return;
    }

    const awardsList: MatchAward[] = [];

    // Best Batter award
    if (bestBatterId) {
      const p = allSquadPlayers.find(s => s.player.id === bestBatterId);
      const c = candidates.find(s => s.player.id === bestBatterId);
      if (p) {
        awardsList.push({
          id: 'best_batter',
          title: 'Best Batter of the Match',
          playerId: p.player.id,
          playerName: p.player.name,
          playerTeamId: p.team.id,
          detail: c?.battingSummary || `${c?.runs || 0} Runs`,
        });
      }
    }

    // Best Bowler award
    if (bestBowlerId) {
      const p = allSquadPlayers.find(s => s.player.id === bestBowlerId);
      const c = candidates.find(s => s.player.id === bestBowlerId);
      if (p) {
        awardsList.push({
          id: 'best_bowler',
          title: 'Best Bowler of the Match',
          playerId: p.player.id,
          playerName: p.player.name,
          playerTeamId: p.team.id,
          detail: c?.bowlingSummary || `${c?.wickets || 0} Wickets`,
        });
      }
    }

    // Max Sixes award
    if (maxSixesId) {
      const p = allSquadPlayers.find(s => s.player.id === maxSixesId);
      const c = candidates.find(s => s.player.id === maxSixesId);
      if (p && (c?.sixes || 0) > 0) {
        awardsList.push({
          id: 'max_sixes',
          title: 'Maximum Sixes Award',
          playerId: p.player.id,
          playerName: p.player.name,
          playerTeamId: p.team.id,
          detail: `${c?.sixes} Sixes`,
        });
      }
    }

    const payload: PlayerOfTheMatchData = {
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      playerTeamId: selectedTeam.id,
      reason: reason.trim(),
      awards: awardsList,
    };

    onConfirm(payload);
    onOpenChange(false);
  };

  const winnerTeam = match?.winner
    ? (team1?.id === match.winner ? team1 : team2?.id === match.winner ? team2 : null)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] overflow-y-auto bg-slate-950/95 backdrop-blur-xl border border-amber-500/40 text-slate-100 shadow-2xl p-4 md:p-6 rounded-2xl">
        {/* Header */}
        <DialogHeader className="space-y-2 text-center pb-2 border-b border-white/10">
          <div className="flex items-center justify-center gap-2">
            <span className="p-2 rounded-full bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30">
              <Trophy className="w-6 h-6 animate-pulse" />
            </span>
            <DialogTitle className="text-xl md:text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 uppercase">
              Player of the Match
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400">
            {isPostMatchReview
              ? 'Update or assign official match honors and presentation awards'
              : 'Select the official Player of the Match and finalize tournament records'}
          </DialogDescription>

          {/* Match Score Summary */}
          {match && team1 && team2 && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <TeamBadge team={team1} size="sm" showName={false} />
                <span className="font-semibold text-slate-200">{team1.name}</span>
                <span className="font-mono text-slate-400">
                  {match.innings1?.runs ?? 0}/{match.innings1?.wickets ?? 0}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold border-amber-500/30 text-amber-300">
                vs
              </Badge>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-400">
                  {match.innings2?.runs ?? 0}/{match.innings2?.wickets ?? 0}
                </span>
                <span className="font-semibold text-slate-200">{team2.name}</span>
                <TeamBadge team={team2} size="sm" showName={false} />
              </div>
            </div>
          )}

          {winnerTeam && (
            <div className="pt-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{winnerTeam.name} Won</span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Spotlight Hero Card for Current Selection */}
          {selectedPlayer && selectedTeam && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-amber-500/15 via-slate-900/90 to-slate-950 border-2 border-amber-500/50 p-4 shadow-lg shadow-amber-500/10">
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                {selectedCandidate?.player.id === recommendedCandidate?.player.id && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-2 py-0.5 shadow">
                    ⭐ AI Top Pick
                  </Badge>
                )}
                {selectedCandidate?.impactPoints !== undefined && (
                  <Badge variant="outline" className="border-amber-400/40 text-amber-300 font-bold text-[10px]">
                    🔥 {selectedCandidate.impactPoints} pts
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-md">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-amber-300 font-black text-xl overflow-hidden">
                      {(selectedPlayer.photo || (selectedPlayer as any).photoUrl) ? (
                        <img src={selectedPlayer.photo || (selectedPlayer as any).photoUrl} alt={selectedPlayer.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{selectedPlayer.name.charAt(0)}</span>
                      )}
                    </div>
                  </div>
                  <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 text-slate-950">
                    <Trophy className="w-3 h-3" />
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-white tracking-wide">
                      {selectedPlayer.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <TeamBadge team={selectedTeam} size="sm" />
                    {selectedPlayer.role && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        • {selectedPlayer.role}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-amber-300">
                    {selectedCandidate?.summary || 'Squad Member'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Picks / Top Contenders */}
          {candidates.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Top Match Performers ({candidates.length})</span>
                <span className="text-[10px] text-amber-400 font-normal">Click card to select</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {candidates.slice(0, 4).map((c) => {
                  const isSelected = c.player.id === selectedPlayerId;
                  return (
                    <button
                      key={c.player.id}
                      type="button"
                      onClick={() => handleSelectCandidate(c)}
                      className={`text-left p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                          : 'bg-slate-900/60 border-white/10 hover:border-white/20 hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5 truncate pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-100 truncate">
                            {c.player.name}
                          </span>
                          {c.isWinningTeam && (
                            <span className="text-[9px] text-emerald-400 font-bold">✓ Win</span>
                          )}
                        </div>
                        <p className="text-[11px] text-amber-300/90 font-medium truncate">
                          {c.summary}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <Badge
                          variant={isSelected ? 'default' : 'secondary'}
                          className={`text-[9px] px-1.5 py-0 font-bold ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {c.impactPoints} pt
                        </Badge>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Squad Browser / Manual Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Or Choose from All Players
            </label>
            <Select value={selectedPlayerId} onValueChange={handleSelectSquadMember}>
              <SelectTrigger className="w-full bg-slate-900 border-white/10 text-slate-200 rounded-xl h-10">
                <SelectValue placeholder="Select player from squads" />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-slate-900 border-slate-700 text-slate-100">
                {team1 && (
                  <>
                    <div className="px-2 py-1.5 text-[11px] font-black uppercase text-amber-400">
                      {team1.name}
                    </div>
                    {(team1.players || []).map(p => {
                      const cand = candidates.find(c => c.player.id === p.id);
                      return (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} {cand ? `(${cand.summary})` : ''}
                        </SelectItem>
                      );
                    })}
                  </>
                )}
                {team2 && (
                  <>
                    <div className="px-2 py-1.5 text-[11px] font-black uppercase text-amber-400 border-t border-slate-700 mt-1">
                      {team2.name}
                    </div>
                    {(team2.players || []).map(p => {
                      const cand = candidates.find(c => c.player.id === p.id);
                      return (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.name} {cand ? `(${cand.summary})` : ''}
                        </SelectItem>
                      );
                    })}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Award Citation / Reason */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Award Citation & Match Note
              </label>
              {selectedCandidate && (
                <button
                  type="button"
                  onClick={() => setReason(selectedCandidate.suggestedReason)}
                  className="text-[10px] text-amber-400 hover:underline font-semibold"
                >
                  Reset to Auto-Note
                </button>
              )}
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Sensational match-winning innings under pressure..."
              className="bg-slate-900 border-white/10 text-xs text-slate-200 rounded-xl resize-none h-18"
            />
          </div>

          {/* Collapsible Additional Match Awards */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/40">
            <button
              type="button"
              onClick={() => setShowAdditionalAwards(!showAdditionalAwards)}
              className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                <span>Additional Match Honors (Batter, Bowler, Max Sixes)</span>
              </div>
              {showAdditionalAwards ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {showAdditionalAwards && (
              <div className="p-3 pt-0 space-y-3 border-t border-white/5">
                {/* Best Batter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <span>🏏 Best Batter of the Match</span>
                    {bestBatter && (
                      <span className="text-amber-400 text-[10px]">
                        (Auto: {bestBatter.player.name} - {bestBatter.battingSummary})
                      </span>
                    )}
                  </label>
                  <Select value={bestBatterId} onValueChange={setBestBatterId}>
                    <SelectTrigger className="bg-slate-900 border-white/10 text-xs h-8">
                      <SelectValue placeholder="Select Best Batter" />
                    </SelectTrigger>
                    <SelectContent className="max-h-50 bg-slate-900 border-slate-700 text-xs">
                      {allSquadPlayers.map(s => (
                        <SelectItem key={s.player.id} value={s.player.id}>
                          {s.player.name} ({s.team.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Best Bowler */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <span>🎯 Best Bowler of the Match</span>
                    {bestBowler && (
                      <span className="text-amber-400 text-[10px]">
                        (Auto: {bestBowler.player.name} - {bestBowler.bowlingSummary})
                      </span>
                    )}
                  </label>
                  <Select value={bestBowlerId} onValueChange={setBestBowlerId}>
                    <SelectTrigger className="bg-slate-900 border-white/10 text-xs h-8">
                      <SelectValue placeholder="Select Best Bowler" />
                    </SelectTrigger>
                    <SelectContent className="max-h-50 bg-slate-900 border-slate-700 text-xs">
                      {allSquadPlayers.map(s => (
                        <SelectItem key={s.player.id} value={s.player.id}>
                          {s.player.name} ({s.team.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Sixes */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                    <span>💥 Maximum Sixes Award</span>
                    {mostSixes && (
                      <span className="text-amber-400 text-[10px]">
                        (Auto: {mostSixes.player.name} - {mostSixes.sixes} Sixes)
                      </span>
                    )}
                  </label>
                  <Select value={maxSixesId} onValueChange={setMaxSixesId}>
                    <SelectTrigger className="bg-slate-900 border-white/10 text-xs h-8">
                      <SelectValue placeholder="Select Sixes King" />
                    </SelectTrigger>
                    <SelectContent className="max-h-50 bg-slate-900 border-slate-700 text-xs">
                      {allSquadPlayers.map(s => (
                        <SelectItem key={s.player.id} value={s.player.id}>
                          {s.player.name} ({s.team.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white"
          >
            Cancel
          </Button>

          {!isPostMatchReview && onSkip && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onSkip();
              }}
              className="border-white/10 text-slate-300 hover:bg-slate-900"
            >
              Skip Award & End Match
            </Button>
          )}

          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25 px-5"
          >
            <Trophy className="w-4 h-4 mr-2" />
            {isPostMatchReview ? 'Save Match Honors' : 'Confirm & Finalize Match 🏆'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

