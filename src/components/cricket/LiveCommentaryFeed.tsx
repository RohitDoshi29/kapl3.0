import { useState, useMemo } from 'react';
import { Innings, Team, Ball } from '@/lib/cricketTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Radio, Flame, Sparkles, Filter, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { generateBallCommentary, generateOverSummary } from '@/lib/commentaryGenerator';
import { cn } from '@/lib/utils';

interface LiveCommentaryFeedProps {
  currentInnings: Innings;
  battingTeam: Team;
  bowlingTeam: Team;
  inningsNumber?: 1 | 2;
  className?: string;
}

interface CommentaryItem {
  id: string;
  type: 'ball' | 'over_end';
  overNumber: number;
  ballNumber?: number;
  ball?: Ball;
  badgeText?: string;
  badgeClass?: string;
  bowlerToBatsman?: string;
  text: string;
  isImportant?: boolean;
}

export function LiveCommentaryFeed({
  currentInnings,
  battingTeam,
  bowlingTeam,
  inningsNumber = 1,
  className,
}: LiveCommentaryFeedProps) {
  const [filter, setFilter] = useState<'all' | 'boundaries' | 'wickets'>('all');
  const [isExpanded, setIsExpanded] = useState(true);

  // Helper to resolve player names
  const getPlayerName = (team: Team, playerId?: string) => {
    if (!playerId) return 'Player';
    const player = (team?.players || []).find((p) => p.id === playerId);
    return player ? player.name : 'Player';
  };

  // Compile all ball events into commentary items in reverse order
  const commentaryItems = useMemo(() => {
    const items: CommentaryItem[] = [];
    let runningTotalRuns = 0;
    let runningTotalWickets = 0;

    currentInnings.overs.forEach((over) => {
      let overRuns = 0;
      let overWickets = 0;
      let legalBallCount = 0;

      over.balls.forEach((ball, ballIdx) => {
        overRuns += ball.runs;
        runningTotalRuns += ball.runs;
        if (ball.isWicket) {
          overWickets += 1;
          runningTotalWickets += 1;
        }
        if (!ball.isWide && !ball.isNoBall) {
          legalBallCount += 1;
        }

        const ballDisplayNumber = legalBallCount > 0 ? legalBallCount : ballIdx + 1;
        const bowlerName = getPlayerName(bowlingTeam, ball.bowlerId || over.bowlerId || currentInnings.currentBowlerId);
        const batsmanName = getPlayerName(battingTeam, ball.batsmanId || currentInnings.currentBatsmanId);

        let badgeText = ball.runs.toString();
        let badgeClass = 'bg-slate-800 text-slate-200 border-white/10';

        if (ball.isWicket) {
          badgeText = 'W';
          badgeClass = 'bg-gradient-to-r from-rose-600 to-red-600 text-white font-black shadow-md shadow-rose-600/30 border-rose-500/40';
        } else if (ball.runs === 6) {
          badgeText = '6';
          badgeClass = 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white font-black shadow-md shadow-emerald-500/30 border-emerald-400/40';
        } else if (ball.runs === 4) {
          badgeText = '4';
          badgeClass = 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black shadow-md shadow-blue-500/30 border-blue-400/40';
        } else if (ball.isWide) {
          badgeText = `${ball.runs}Wd`;
          badgeClass = 'bg-amber-500/20 text-amber-300 font-bold border-amber-500/40';
        } else if (ball.isNoBall) {
          badgeText = `${ball.runs}Nb`;
          badgeClass = 'bg-amber-500 text-slate-950 font-black shadow-sm';
        } else if (ball.runs === 0) {
          badgeText = '•';
          badgeClass = 'bg-white/[0.06] text-slate-400 border-white/10';
        }

        const commentaryText = generateBallCommentary({
          ball,
          overNumber: over.number,
          ballNumber: ballDisplayNumber,
          batsmanName,
          bowlerName,
          battingTeamName: battingTeam.name,
          inningsRuns: runningTotalRuns,
          inningsWickets: runningTotalWickets,
        });

        items.push({
          id: ball.id || `ball-${over.number}-${ballIdx}`,
          type: 'ball',
          overNumber: over.number,
          ballNumber: ballDisplayNumber,
          ball,
          badgeText,
          badgeClass,
          bowlerToBatsman: `${bowlerName} to ${batsmanName}`,
          text: commentaryText,
          isImportant: ball.isWicket || ball.runs === 4 || ball.runs === 6 || ball.isNoBall,
        });
      });

      // If over is completed (6 legal balls), insert over summary
      if (legalBallCount >= 6 && over.balls.length > 0) {
        const bowlerName = getPlayerName(bowlingTeam, over.bowlerId || currentInnings.currentBowlerId);
        items.push({
          id: `over-end-${over.number}`,
          type: 'over_end',
          overNumber: over.number,
          text: generateOverSummary(
            over.number,
            overRuns,
            overWickets,
            runningTotalRuns,
            runningTotalWickets,
            bowlerName,
            battingTeam.name
          ),
          isImportant: true,
        });
      }
    });

    // Reverse items so latest is on top (Cricbuzz style)
    return items.reverse();
  }, [currentInnings, battingTeam, bowlingTeam]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filter === 'all') return commentaryItems;
    if (filter === 'boundaries') {
      return commentaryItems.filter(
        (item) => item.type === 'over_end' || (item.ball && (item.ball.runs === 4 || item.ball.runs === 6))
      );
    }
    if (filter === 'wickets') {
      return commentaryItems.filter((item) => item.type === 'over_end' || item.ball?.isWicket);
    }
    return commentaryItems;
  }, [commentaryItems, filter]);

  return (
    <Card className={cn('overflow-hidden rounded-2xl border-white/[0.08] bg-card/90 backdrop-blur-md shadow-xl', className)}>
      <CardHeader className="pb-3 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
              <Radio className="w-4 h-4 animate-pulse text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                Live Ball-by-Ball Commentary
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold bg-amber-500/10 text-amber-400 border-amber-500/30">
                  Innings {inningsNumber}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Broadcast feed for {battingTeam.name} vs {bowlingTeam.name}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 rounded-lg hover:bg-white/10"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>

        {/* Filter controls */}
        {isExpanded && (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className="h-7 text-xs px-2.5 rounded-lg"
              >
                All Balls
              </Button>
              <Button
                variant={filter === 'boundaries' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('boundaries')}
                className="h-7 text-xs px-2.5 rounded-lg gap-1"
              >
                <Flame className="w-3 h-3 text-amber-400" />
                Boundaries (4s & 6s)
              </Button>
              <Button
                variant={filter === 'wickets' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('wickets')}
                className="h-7 text-xs px-2.5 rounded-lg gap-1"
              >
                <Zap className="w-3 h-3 text-rose-400" />
                Wickets
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0">
          <div className="max-h-[460px] overflow-y-auto divide-y divide-white/[0.04]">
            {filteredItems.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-30 animate-pulse" />
                No deliveries recorded yet. Commentary will generate automatically as balls are bowled.
              </div>
            ) : (
              filteredItems.map((item) => {
                if (item.type === 'over_end') {
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-y border-amber-500/20 flex items-center gap-3 text-xs md:text-sm font-semibold text-amber-300"
                    >
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 uppercase text-[10px] tracking-wider">
                        Over Break
                      </span>
                      <span>{item.text}</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'p-3 md:p-4 flex items-start gap-3 md:gap-4 transition-colors hover:bg-white/[0.02]',
                      item.isImportant && 'bg-white/[0.015]'
                    )}
                  >
                    {/* Ball outcome badge */}
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <div
                        className={cn(
                          'w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-xs md:text-sm font-extrabold border shrink-0',
                          item.badgeClass
                        )}
                      >
                        {item.badgeText}
                      </div>
                      <span className="font-mono text-[11px] font-bold text-muted-foreground">
                        {item.overNumber - 1}.{item.ballNumber}
                      </span>
                    </div>

                    {/* Commentary narrative */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs md:text-sm font-bold text-foreground truncate">
                          {item.bowlerToBatsman}
                        </span>
                        {item.ball?.isFreeHit && (
                          <Badge variant="outline" className="text-[10px] bg-yellow-400/20 text-yellow-300 border-yellow-400/40 shrink-0">
                            ⚡ Free Hit
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-normal">
                        {item.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

