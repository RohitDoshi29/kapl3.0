import { useEffect, useRef, useMemo } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { ScoreCard } from '@/components/cricket/ScoreCard';
import { LiveScoreHero } from '@/components/cricket/LiveScoreHero';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { BallTicker } from '@/components/cricket/BallTicker';
import { OverTable } from '@/components/cricket/OverTable';
import { LiveMatchInfo, LastMatchResult } from '@/components/cricket/LiveMatchInfo';
import { MatchHistory } from '@/components/cricket/MatchHistory';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MATCH_TYPE_LABELS, Match, DEFAULT_TEAMS, DEFAULT_WOMENS_TEAMS } from '@/lib/cricketTypes';
import { CricketAnimation, useCricketAnimation } from '@/components/cricket/CricketAnimations';
import { TournamentHonors } from '@/components/cricket/TournamentHonors';
import { LiveCommentaryFeed } from '@/components/cricket/LiveCommentaryFeed';
import { MatchFixturesCalendar } from '@/components/cricket/MatchFixturesCalendar';
import { PlayerRegistrationPopup } from '@/components/cricket/PlayerRegistrationPopup';
import { PlayerRegistrationHero } from '@/components/cricket/PlayerRegistrationHero';

const Index = () => {
  const { activeTournamentId, currentTournament } = useTournament();
  const { matchState, allTournamentMatches, matchHistory, getTeam, isLoaded } = useCricketStore(activeTournamentId);
  const { animation, triggerFour, triggerSix, triggerWicket, triggerWinner, clearAnimation } = useCricketAnimation();
  const lastProcessedBallRef = useRef<string | null>(null);
  
  let rawMatch = matchState.currentMatch;
  if (!rawMatch && allTournamentMatches?.[activeTournamentId]) {
    rawMatch = allTournamentMatches[activeTournamentId];
  }
  if (!rawMatch) {
    try {
      const cached = localStorage.getItem(`kapl_local_match_state_${activeTournamentId}`) || localStorage.getItem('kapl_local_match_state');
      if (cached) {
        const parsed = JSON.parse(cached);
        const m = parsed.current_match;
        if (m && (m.status === 'live' || m.status === 'super_over')) {
          const tId = m.tournamentId || (getTeam(m.team1Id)?.tournamentId) || 'kapl-3-mens';
          if (tId === activeTournamentId) {
            rawMatch = m;
          }
        }
      }
    } catch (e) {}
  }

  const matchTournId = rawMatch?.tournamentId || (rawMatch ? (getTeam(rawMatch.team1Id)?.tournamentId || DEFAULT_TEAMS.find(t => t.id === rawMatch.team1Id)?.tournamentId || DEFAULT_WOMENS_TEAMS.find(t => t.id === rawMatch.team1Id)?.tournamentId) : null) || 'kapl-3-mens';
  const isMatchInActiveTournament = Boolean(rawMatch && (matchTournId === activeTournamentId || (!rawMatch.tournamentId && activeTournamentId === 'kapl-3-mens')));
  const match = isMatchInActiveTournament ? rawMatch : null;

  const team1 = match ? (getTeam(match.team1Id) || DEFAULT_TEAMS.find(t => t.id === match.team1Id) || DEFAULT_WOMENS_TEAMS.find(t => t.id === match.team1Id)) : null;
  const team2 = match ? (getTeam(match.team2Id) || DEFAULT_TEAMS.find(t => t.id === match.team2Id) || DEFAULT_WOMENS_TEAMS.find(t => t.id === match.team2Id)) : null;
  const currentInnings = match ? (
    match.currentInnings === 1 
      ? (match.innings1 || { battingTeamId: match.team1Id, bowlingTeamId: match.team2Id, runs: 0, wickets: 0, overs: [{ number: 1, balls: [] }], currentOver: 0, currentBall: 0, batterStats: {}, bowlerStats: {}, battingOrder: [] }) 
      : (match.innings2 || { battingTeamId: match.team2Id, bowlingTeamId: match.team1Id, runs: 0, wickets: 0, overs: [{ number: 1, balls: [] }], currentOver: 0, currentBall: 0, batterStats: {}, bowlerStats: {}, battingOrder: [] })
  ) : null;
  const battingTeam = match?.currentInnings === 1 ? team1 : team2;
  const bowlingTeam = match?.currentInnings === 1 ? team2 : team1;
  const allBalls = useMemo(() => {
    return currentInnings?.overs.flatMap(o => o.balls) || [];
  }, [currentInnings?.overs]);

  // Filter tournament-specific match history
  const tournamentMatches = matchHistory.filter(m => {
    const tId = m.tournamentId || getTeam(m.team1Id)?.tournamentId || 'kapl-3-mens';
    return tId === activeTournamentId;
  });

  // Get last completed match
  const completedMatches = tournamentMatches.filter(m => m.status === 'completed');
  const lastCompletedMatch = completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;

  // Trigger animations for viewers based on last ball
  useEffect(() => {
    if (!allBalls.length) return;
    
    const lastBall = allBalls[allBalls.length - 1];
    if (!lastBall || lastBall.id === lastProcessedBallRef.current) return;
    
    lastProcessedBallRef.current = lastBall.id;
    
    if (lastBall.isWicket) {
      triggerWicket();
    } else if (lastBall.runs === 6 && !lastBall.isExtra) {
      triggerSix();
    } else if (lastBall.runs === 4 && !lastBall.isExtra) {
      triggerFour();
    }
  }, [allBalls, triggerFour, triggerSix, triggerWicket]);

  // Trigger winner animation when match is completed
  useEffect(() => {
    if (match?.status === 'completed' && match.winner) {
      const winnerTeam = getTeam(match.winner);
      if (winnerTeam) {
        triggerWinner(winnerTeam.name);
      }
    }
  }, [match?.status, match?.winner, getTeam, triggerWinner]);

  if (!isLoaded && (!team1 || !team2) && completedMatches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <CricketAnimation
        type={animation.type}
        teamName={animation.teamName}
        onComplete={clearAnimation}
      />
      <div className="relative min-h-screen bg-background pb-24 md:pb-8">
        {/* Ambient Stadium Lighting Mesh */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
        </div>

        <Header />
        <Navigation />
        <MultiMatchLiveBar />

        {/* Player Registration Announcement Popup Modal */}
        <PlayerRegistrationPopup />

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 md:py-6 space-y-5 md:space-y-6">
        {match && team1 && team2 ? (
          <>
            {/* Match Status */}
            <div className="text-center space-y-2">
              {match.status === 'super_over' ? (
                <span className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-500/40 px-4 py-1.5 rounded-full text-xs font-black tracking-wider animate-pulse shadow-sm">
                  <span className="text-sm">⚡</span>
                  SUPER OVER
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-1.5 rounded-full text-xs font-black tracking-wider animate-pulse shadow-sm">
                  <span className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  LIVE MATCH
                </span>
              )}
              <div className="text-lg font-bold text-foreground font-display tracking-tight">
                {MATCH_TYPE_LABELS[match.matchType]} {match.matchType === 'group' && `- Group ${match.group}`}
              </div>
            </div>

            {/* Super Over Score Display */}
            {match.superOver && (
              <Card className="border-amber-500/50 bg-gradient-to-r from-amber-500/15 via-card to-yellow-500/10 shadow-lg shadow-amber-500/10">
                <CardContent className="p-5">
                  <div className="text-center mb-3">
                    <Badge variant="gold">⚡ Super Over</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <div className="font-bold text-sm text-foreground">{team1.name}</div>
                      <div className="text-3xl font-black text-amber-400 font-display">
                        {match.superOver.innings1?.runs || 0}/{match.superOver.innings1?.wickets || 0}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ({match.superOver.innings1?.currentOver || 0}.{match.superOver.innings1?.currentBall || 0} ov)
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-foreground">{team2.name}</div>
                      <div className="text-3xl font-black text-amber-400 font-display">
                        {match.superOver.innings2?.runs || 0}/{match.superOver.innings2?.wickets || 0}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        ({match.superOver.innings2?.currentOver || 0}.{match.superOver.innings2?.currentBall || 0} ov)
                      </div>
                    </div>
                  </div>
                  {match.superOver.currentInnings === 2 && match.superOver.innings1 && (
                    <div className="text-center mt-3 text-sm font-semibold">
                      <span className="text-muted-foreground">Target: </span>
                      <span className="text-amber-400 font-black">{match.superOver.innings1.runs + 1}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Single-Focus Hero Scoreboard */}
            {currentInnings && battingTeam && bowlingTeam && (
              <LiveScoreHero
                match={match}
                battingTeam={battingTeam}
                bowlingTeam={bowlingTeam}
                currentInnings={currentInnings}
                team1={team1}
                team2={team2}
              />
            )}

            {/* Live Match Info - Batsmen, Bowler, Run Rates, Full Scorecard */}
            {currentInnings && battingTeam && bowlingTeam && (
              <LiveMatchInfo
                match={match}
                battingTeam={battingTeam}
                bowlingTeam={bowlingTeam}
                currentInnings={currentInnings}
                team1={team1}
                team2={team2}
              />
            )}

            {/* Ball Ticker */}
            <div className="rounded-2xl border border-white/[0.08] bg-card/85 backdrop-blur-md p-4 shadow-lg shadow-black/20">
              <BallTicker balls={allBalls} />
            </div>

            {/* Live Ball-by-Ball Commentary Feed */}
            {currentInnings && battingTeam && bowlingTeam && (
              <LiveCommentaryFeed
                currentInnings={currentInnings}
                battingTeam={battingTeam}
                bowlingTeam={bowlingTeam}
                inningsNumber={match.currentInnings}
              />
            )}

            {/* Over Table */}
            {currentInnings && <OverTable overs={currentInnings.overs} />}

            {/* Tournament Fixtures & Schedule */}
            <MatchFixturesCalendar />

            {/* Tournament Honors & Caps */}
            <TournamentHonors tournamentId={activeTournamentId} />

            {/* Match History */}
            <MatchHistory matchHistory={tournamentMatches} getTeam={getTeam} limit={5} />
          </>
        ) : (
          <div className="space-y-8">
            {/* Show last match result if available */}
            {lastCompletedMatch && (
              <LastMatchResult
                match={lastCompletedMatch}
                team1={getTeam(lastCompletedMatch.team1Id)!}
                team2={getTeam(lastCompletedMatch.team2Id)!}
                winnerTeam={lastCompletedMatch.winner ? getTeam(lastCompletedMatch.winner) || null : null}
              />
            )}
            
            {/* Player Registration Hero Banner (Before Mega Auction & Matches) */}
            <PlayerRegistrationHero tournamentName={currentTournament?.name || "KAPL 3.0"} />

            {/* Tournament Fixtures & Schedule (When No Live Match) */}
            <MatchFixturesCalendar />

            {/* Tournament Honors & Caps */}
            <TournamentHonors tournamentId={activeTournamentId} />
            
            {/* Match History when no live match */}
            <MatchHistory matchHistory={tournamentMatches} getTeam={getTeam} limit={10} />
          </div>
        )}
      </main>
      </div>
    </>
  );
};

export default Index;
