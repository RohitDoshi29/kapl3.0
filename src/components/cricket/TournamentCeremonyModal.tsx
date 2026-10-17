import { useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TeamBadge } from './TeamBadge';
import { Team } from '@/lib/cricketTypes';
import { triggerCelebrationConfetti } from '@/lib/confetti';
import { playVictoryFanfare } from '@/lib/soundEffects';
import { Trophy, Medal, Award, Flame, Zap, Crown, Share2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';

export interface CeremonyAwardWinner {
  playerId: string;
  name: string;
  teamName: string;
  teamColor?: string;
  photoUrl?: string | null;
  primaryStat: string | number;
  primaryLabel: string;
  secondaryStat?: string | number;
  secondaryLabel?: string;
}

interface TournamentCeremonyModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentName?: string;
  championTeam: Team;
  runnerUpTeam?: Team | null;
  orangeCapWinner?: CeremonyAwardWinner | null;
  purpleCapWinner?: CeremonyAwardWinner | null;
  maxSixesWinner?: CeremonyAwardWinner | null;
  mvpWinner?: CeremonyAwardWinner | null;
}

export function TournamentCeremonyModal({
  isOpen,
  onClose,
  tournamentName = 'KAPL 3.0 Championship',
  championTeam,
  runnerUpTeam,
  orangeCapWinner,
  purpleCapWinner,
  maxSixesWinner,
  mvpWinner,
}: TournamentCeremonyModalProps) {
  useEffect(() => {
    if (isOpen) {
      triggerCelebrationConfetti(5000);
      playVictoryFanfare();
    }
  }, [isOpen]);

  const handleShare = () => {
    const text = `🏆 *KAPL 3.0 GRAND CHAMPIONS!* 🏆\n\n🎉 Heartiest congratulations to *${championTeam.name}* for lifting the prestigious KAPL 3.0 Championship Trophy!\n\n🥈 Runner-Up: ${runnerUpTeam?.name || 'Grand Finalist'}\n\n🏅 TOURNAMENT HONORS:\n🧡 Orange Cap: ${orangeCapWinner ? `${orangeCapWinner.name} (${orangeCapWinner.primaryStat} Runs)` : 'N/A'}\n💜 Purple Cap: ${purpleCapWinner ? `${purpleCapWinner.name} (${purpleCapWinner.primaryStat} Wkts)` : 'N/A'}\n⚡ Max Sixes: ${maxSixesWinner ? `${maxSixesWinner.name} (${maxSixesWinner.primaryStat} Sixes)` : 'N/A'}\n🌟 Tournament MVP: ${mvpWinner ? mvpWinner.name : 'N/A'}\n\n#KAPL #Champions #CricketCarnival`;

    if (navigator.share) {
      navigator.share({ title: `${tournamentName} Champions`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Championship proclamation copied to clipboard!');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border border-amber-500/40 bg-slate-950 text-white rounded-3xl shadow-2xl shadow-amber-500/20 max-h-[92vh] flex flex-col">
        {/* Ambient Stadium Lighting Mesh */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-amber-500/25 via-yellow-500/10 to-transparent blur-3xl pointer-events-none -z-10" />

        {/* Modal Header */}
        <div className="relative p-6 pb-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  Official Presentation Ceremony
                </span>
                <span className="text-xs text-muted-foreground">• KAPL 3.0</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-400 font-display">
                {tournamentName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs h-9 gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 rounded-xl"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Proclamation
            </Button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Main Champion Pedestal Card */}
          <div className="relative overflow-hidden rounded-3xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-500/20 via-slate-900/90 to-slate-950 p-6 md:p-8 text-center shadow-2xl shadow-amber-500/20">
            {/* Crown decoration */}
            <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 mb-4 shadow-xl shadow-amber-500/40 animate-bounce">
              <Crown className="w-9 h-9 fill-slate-950" />
            </div>

            <span className="inline-block text-xs md:text-sm font-black uppercase tracking-widest text-amber-300 bg-amber-500/20 px-4 py-1 rounded-full border border-amber-400/40 mb-3 shadow-inner">
              👑 Undisputed Tournament Champions 👑
            </span>

            <h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 font-display tracking-tight mb-2">
              {championTeam.name}
            </h1>

            <div className="flex items-center justify-center gap-3 text-sm text-slate-300 mb-6">
              {championTeam.captainName && (
                <span className="font-semibold text-amber-300">
                  Captain: {championTeam.captainName}
                </span>
              )}
              {championTeam.ownerName && (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-slate-400">Franchise Owner: {championTeam.ownerName}</span>
                </>
              )}
            </div>

            {/* Runner up mention */}
            {runnerUpTeam && (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 text-xs text-slate-300">
                <Medal className="w-4 h-4 text-slate-400" />
                <span>Runner-Up: <strong className="text-white">{runnerUpTeam.name}</strong></span>
              </div>
            )}
          </div>

          {/* Tournament Honors & Awards Grid */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-base md:text-lg font-bold text-foreground">
                Individual Honors & Tournament Caps
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Orange Cap */}
              <div className="p-4 rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-950 flex flex-col justify-between gap-3 shadow-lg shadow-amber-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400 fill-amber-400" /> Orange Cap
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold">
                    Top Run Scorer
                  </Badge>
                </div>
                <div>
                  <div className="text-lg font-black text-foreground truncate">
                    {orangeCapWinner ? orangeCapWinner.name : 'Leaderboard Pending'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {orangeCapWinner?.teamName || championTeam.name}
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-medium">Runs Scored</span>
                  <span className="text-2xl font-black text-amber-400 font-display">
                    {orangeCapWinner ? orangeCapWinner.primaryStat : '—'}
                  </span>
                </div>
              </div>

              {/* Purple Cap */}
              <div className="p-4 rounded-2xl border border-purple-500/40 bg-gradient-to-b from-purple-500/15 via-slate-900 to-slate-950 flex flex-col justify-between gap-3 shadow-lg shadow-purple-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-purple-400 fill-purple-400" /> Purple Cap
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold">
                    Top Wicket Taker
                  </Badge>
                </div>
                <div>
                  <div className="text-lg font-black text-foreground truncate">
                    {purpleCapWinner ? purpleCapWinner.name : 'Leaderboard Pending'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {purpleCapWinner?.teamName || championTeam.name}
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-medium">Wickets</span>
                  <span className="text-2xl font-black text-purple-400 font-display">
                    {purpleCapWinner ? purpleCapWinner.primaryStat : '—'}
                  </span>
                </div>
              </div>

              {/* Maximum Sixes */}
              <div className="p-4 rounded-2xl border border-blue-500/40 bg-gradient-to-b from-blue-500/15 via-slate-900 to-slate-950 flex flex-col justify-between gap-3 shadow-lg shadow-blue-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-blue-400 fill-blue-400" /> Maximum Sixes
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold">
                    Power Hitter
                  </Badge>
                </div>
                <div>
                  <div className="text-lg font-black text-foreground truncate">
                    {maxSixesWinner ? maxSixesWinner.name : 'Leaderboard Pending'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {maxSixesWinner?.teamName || championTeam.name}
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-medium">Total Sixes</span>
                  <span className="text-2xl font-black text-blue-400 font-display">
                    {maxSixesWinner ? maxSixesWinner.primaryStat : '—'}
                  </span>
                </div>
              </div>

              {/* Tournament MVP */}
              <div className="p-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/15 via-slate-900 to-slate-950 flex flex-col justify-between gap-3 shadow-lg shadow-emerald-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-emerald-400 fill-emerald-400" /> Tournament MVP
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold">
                    Golden Player
                  </Badge>
                </div>
                <div>
                  <div className="text-lg font-black text-foreground truncate">
                    {mvpWinner ? mvpWinner.name : (orangeCapWinner?.name || championTeam.captainName || 'Leaderboard')}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {mvpWinner?.teamName || championTeam.name}
                  </div>
                </div>
                <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
                  <span className="text-xs text-slate-400 font-medium">Impact Rating</span>
                  <span className="text-2xl font-black text-emerald-400 font-display">
                    {mvpWinner ? mvpWinner.primaryStat : '98.5'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerCelebrationConfetti(3000)}
            className="text-xs border-amber-500/30 text-amber-300 hover:bg-amber-500/10 rounded-xl"
          >
            ✨ Trigger Fireworks
          </Button>

          <Button
            variant="glow"
            size="sm"
            onClick={onClose}
            className="font-bold text-xs rounded-xl px-6"
          >
            Close Ceremony
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

