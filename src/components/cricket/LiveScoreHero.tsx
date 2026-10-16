import { Team, Innings, Match } from '@/lib/cricketTypes';
import { TeamBadge } from './TeamBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Zap, TrendingUp, Flame, MessageCircle } from 'lucide-react';
import { MatchPredictionWidget } from './MatchPredictionWidget';
import { WhatsAppMatchCardModal } from './WhatsAppMatchCardModal';

interface LiveScoreHeroProps {
  match: Match;
  battingTeam: Team;
  bowlingTeam: Team;
  currentInnings: Innings;
  team1: Team;
  team2: Team;
}

export function LiveScoreHero({
  match,
  battingTeam,
  bowlingTeam,
  currentInnings,
  team1,
  team2,
}: LiveScoreHeroProps) {
  const isSecondInnings = match.currentInnings === 2;
  const firstInnings = match.innings1;
  const target = isSecondInnings && firstInnings ? firstInnings.runs + 1 : null;
  const runsNeeded = target !== null ? target - currentInnings.runs : null;

  // Calculate total legal balls bowled
  const legalBallsBowled = currentInnings.overs.reduce((acc, over) => {
    return acc + over.balls.filter(b => !b.isWide && !b.isNoBall).length;
  }, 0);

  const totalMatchBalls = 7 * 6; // 42 balls in a 7-over match
  const remainingBalls = Math.max(0, totalMatchBalls - legalBallsBowled);

  // Current Run Rate (CRR)
  const oversDecimal = currentInnings.currentOver + (currentInnings.currentBall / 6);
  const crr = oversDecimal > 0 ? (currentInnings.runs / oversDecimal).toFixed(2) : '0.00';

  // Required Run Rate (RRR)
  const remainingOversDecimal = remainingBalls / 6;
  const rrr = runsNeeded !== null && runsNeeded > 0 && remainingOversDecimal > 0
    ? (runsNeeded / remainingOversDecimal).toFixed(2)
    : null;

  return (
    <div className="w-full space-y-3">
      {/* 1st Innings Quick Summary Pill (Only when in 2nd Innings - No Split Screen!) */}
      {isSecondInnings && firstInnings && (
        <div className="flex items-center justify-between bg-muted/60 border rounded-xl px-4 py-2 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">1st Innings:</span>
            <span className="font-bold text-foreground">{team1.name}</span>
            <Badge variant="secondary" className="font-bold">
              {firstInnings.runs}/{firstInnings.wickets} ({firstInnings.currentOver}.{firstInnings.currentBall} ov)
            </Badge>
          </div>
          <div className="flex items-center gap-1 font-semibold text-primary text-xs">
            <Target className="w-3.5 h-3.5" />
            <span>Target: {target}</span>
          </div>
        </div>
      )}

      {/* Free Hit Alert Banner */}
      {currentInnings.isFreeHit && (
        <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-black font-black px-4 py-2.5 rounded-2xl shadow-lg border-2 border-yellow-300 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 fill-black text-black animate-bounce shrink-0" />
            <span className="text-sm md:text-base tracking-wider uppercase font-black">
              ⚡ FREE HIT ACTIVE!
            </span>
          </div>
          <span className="text-[11px] md:text-xs font-extrabold bg-black/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Run Out Only
          </span>
        </div>
      )}

      {/* Main Single-Focus Hero Scoreboard */}
      <Card
        className="relative overflow-hidden border-2 shadow-xl rounded-3xl"
        style={{
          background: `linear-gradient(135deg, hsl(${battingTeam.primaryColor} / 0.95), hsl(${battingTeam.primaryColor} / 0.75))`,
        }}
      >
        {/* Glow & Texture */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <CardContent className="p-5 md:p-8 relative z-10 text-white">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Batting Team Info */}
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-cricket-accent border border-white/10">
                <Flame className="w-3.5 h-3.5 text-yellow-400 animate-pulse" />
                NOW BATTING • INNINGS {match.currentInnings}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <TeamBadge team={battingTeam} size="lg" showName={false} />
                <div>
                  <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight drop-shadow-sm">
                    {battingTeam.name}
                  </h2>
                  <p className="text-xs md:text-sm text-white/80 font-medium">
                    vs {bowlingTeam.name} • Group {battingTeam.group}
                  </p>
                </div>
              </div>
            </div>

            {/* Giant Live Score Display */}
            <div className="text-left md:text-right w-full md:w-auto bg-black/20 md:bg-transparent p-4 md:p-0 rounded-2xl">
              <div className="flex items-baseline md:justify-end gap-1.5">
                <span className="text-5xl md:text-7xl font-black tracking-tight text-white drop-shadow-md">
                  {currentInnings.runs}
                </span>
                <span className="text-2xl md:text-4xl font-bold text-white/80">
                  /{currentInnings.wickets}
                </span>
              </div>
              <div className="text-lg md:text-2xl font-bold text-white/90 mt-0.5">
                {currentInnings.currentOver}.{currentInnings.currentBall}{' '}
                <span className="text-sm md:text-base font-normal text-white/70">/ 7.0 overs</span>
              </div>
            </div>
          </div>

          {/* Chase Status Bar (For 2nd Innings Chases) */}
          {isSecondInnings && runsNeeded !== null && (
            <div className="mt-5 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-300" />
                <span>
                  {runsNeeded <= 0 ? (
                    <span className="text-green-300 font-bold">Target Reached! Winning Runs!</span>
                  ) : (
                    <>
                      Need <span className="text-yellow-300 font-extrabold text-base">{runsNeeded} runs</span> from{' '}
                      <span className="text-white font-bold">{remainingBalls} balls</span>
                    </>
                  )}
                </span>
              </div>

              {rrr && (
                <div className="flex items-center gap-1.5 text-xs md:text-sm text-white/90">
                  <span className="text-white/70">RRR:</span>
                  <span className="bg-black/30 px-2 py-0.5 rounded-md font-bold text-yellow-300">{rrr}</span>
                </div>
              )}
            </div>
          )}

          {/* Run Rates Bar (1st Innings or General) */}
          {!isSecondInnings && (
            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs md:text-sm text-white/80">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-cricket-accent" />
                <span>Current Run Rate:</span>
                <span className="font-bold text-white">{crr}</span>
              </div>
              <div>
                <span>Projected Score: </span>
                <span className="font-bold text-white">
                  {Math.round(parseFloat(crr) * 7)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Match Action Bar (WhatsApp Share) */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          🏏 Live Match Feed
        </span>
        <WhatsAppMatchCardModal match={match} team1={team1} team2={team2} />
      </div>

      {/* Fan Zone: Match Winner Prediction Poll */}
      <MatchPredictionWidget match={match} team1={team1} team2={team2} />
    </div>
  );
}

