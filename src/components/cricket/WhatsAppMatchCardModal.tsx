import { useState } from 'react';
import { Match, Team, Innings } from '@/lib/cricketTypes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Share2, Copy, Check, MessageCircle, Sparkles, Trophy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppMatchCardModalProps {
  match: Match;
  team1: Team;
  team2: Team;
  triggerButton?: React.ReactNode;
}

export function WhatsAppMatchCardModal({
  match,
  team1,
  team2,
  triggerButton,
}: WhatsAppMatchCardModalProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const inn1 = match.innings1 as Innings | null;
  const inn2 = match.innings2 as Innings | null;

  // Determine top scorer in match
  let topScorer = { name: '-', runs: 0, balls: 0 };
  let topBowler = { name: '-', wickets: 0, runsConceded: 0, overs: 0 };

  [inn1, inn2].forEach(inn => {
    if (!inn) return;
    Object.values(inn.batterStats || {}).forEach(b => {
      if (b.runs > topScorer.runs) {
        topScorer = { name: b.name, runs: b.runs, balls: b.balls };
      }
    });
    Object.values(inn.bowlerStats || {}).forEach(bw => {
      if (bw.wickets > topBowler.wickets || (bw.wickets === topBowler.wickets && bw.runsConceded < topBowler.runsConceded)) {
        topBowler = { name: bw.name, wickets: bw.wickets, runsConceded: bw.runsConceded, overs: bw.overs };
      }
    });
  });

  const winnerTeam = match.winner ? (match.winner === team1.id ? team1 : team2) : null;
  const matchResultText = winnerTeam
    ? `${winnerTeam.name} won the match! 🏆`
    : match.status === 'live'
    ? 'Match currently LIVE! ⚡'
    : 'Match Tied / In Progress';

  const shareText = `🏏 *KAPL 3.0 TOURNAMENT UPDATE* 🏆
━━━━━━━━━━━━━━━━━━━━━
⚔️ *${team1.name}* vs *${team2.name}*
${winnerTeam ? `🎉 *RESULT:* ${winnerTeam.name} won the match!` : `⚡ *STATUS:* Match In Progress`}

📊 *SCORECARD:*
• *${team1.name}:* ${inn1 ? `${inn1.runs}/${inn1.wickets} (${inn1.currentOver}.${inn1.currentBall} ov)` : 'Yet to bat'}
• *${team2.name}:* ${inn2 ? `${inn2.runs}/${inn2.wickets} (${inn2.currentOver}.${inn2.currentBall} ov)` : 'Yet to bat'}

⭐ *KEY HIGHLIGHTS:*
${topScorer.runs > 0 ? `• 🔥 Top Scorer: *${topScorer.name}* ${topScorer.runs} (${topScorer.balls}b)` : ''}
${topBowler.wickets > 0 ? `• ⚡ Top Bowler: *${topBowler.name}* ${topBowler.wickets}/${topBowler.runsConceded}` : ''}

📲 View full live ball-by-ball scorecard & bracket:
${window.location.origin}/
━━━━━━━━━━━━━━━━━━━━━`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success('WhatsApp scorecard text copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(shareText);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-xl border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-xs font-bold"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Share to WhatsApp</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-md p-5 rounded-3xl bg-card border border-border shadow-xl">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-black flex items-center gap-2">
            <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-500">
              <MessageCircle className="w-4 h-4" />
            </span>
            <span>Share Match Card to WhatsApp</span>
          </DialogTitle>
        </DialogHeader>

        {/* Digital Scorecard Preview */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-card via-card/90 to-background p-4 shadow-sm text-foreground space-y-3">
          {/* Header pill */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🏏</span>
              <span className="font-display font-black text-xs tracking-wider uppercase text-primary">
                KAPL 3.0 MATCH SUMMARY
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold">
              {match.status === 'live' ? '⚡ LIVE' : 'OFFICIAL'}
            </Badge>
          </div>

          {/* Teams & Scores */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: team1.primaryColor
                      ? `hsl(${team1.primaryColor})`
                      : '#3b82f6',
                  }}
                />
                <span className="font-bold text-xs">{team1.name}</span>
              </div>
              <span className="font-mono font-black text-sm">
                {inn1 ? `${inn1.runs}/${inn1.wickets}` : '-'}
                {inn1 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({inn1.currentOver}.{inn1.currentBall} ov)
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{
                    backgroundColor: team2.primaryColor
                      ? `hsl(${team2.primaryColor})`
                      : '#10b981',
                  }}
                />
                <span className="font-bold text-xs">{team2.name}</span>
              </div>
              <span className="font-mono font-black text-sm">
                {inn2 ? `${inn2.runs}/${inn2.wickets}` : '-'}
                {inn2 && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    ({inn2.currentOver}.{inn2.currentBall} ov)
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Result banner */}
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-2 text-center">
            <p className="text-xs font-black text-primary truncate">
              {matchResultText}
            </p>
          </div>

          {/* Highlights */}
          {(topScorer.runs > 0 || topBowler.wickets > 0) && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/50 text-[11px]">
              {topScorer.runs > 0 && (
                <div className="bg-muted/40 p-1.5 rounded-lg">
                  <span className="text-[10px] text-muted-foreground block font-medium">TOP BATTER</span>
                  <span className="font-bold text-foreground truncate block">{topScorer.name}</span>
                  <span className="font-mono text-amber-500 font-bold">{topScorer.runs} ({topScorer.balls}b)</span>
                </div>
              )}
              {topBowler.wickets > 0 && (
                <div className="bg-muted/40 p-1.5 rounded-lg">
                  <span className="text-[10px] text-muted-foreground block font-medium">TOP BOWLER</span>
                  <span className="font-bold text-foreground truncate block">{topBowler.name}</span>
                  <span className="font-mono text-emerald-500 font-bold">{topBowler.wickets}/{topBowler.runsConceded}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="rounded-xl h-10 text-xs font-bold gap-1.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Text'}</span>
          </Button>

          <Button
            onClick={handleOpenWhatsApp}
            className="rounded-xl h-10 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Open WhatsApp</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

