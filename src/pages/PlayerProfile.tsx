import { useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { usePlayerStats } from '@/hooks/usePlayerStats';
import { PlayerRole } from '@/lib/cricketTypes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import {
  ArrowLeft,
  Share2,
  Trophy,
  Flame,
  Zap,
  Target,
  Shield,
  Activity,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

const ROLE_META: Record<
  PlayerRole,
  { label: string; icon: string; badgeClass: string; desc: string }
> = {
  all_rounder: {
    label: 'All-Rounder',
    icon: '👑',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    desc: 'Dual-threat player capable of winning matches with both bat and ball',
  },
  batter: {
    label: 'Batter',
    icon: '🏏',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    desc: 'Top-order or middle-order anchor and boundary accumulator',
  },
  bowler: {
    label: 'Bowler',
    icon: '⚡',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    desc: 'Strike weapon specializing in tight overs and breakthrough wickets',
  },
  wicket_keeper: {
    label: 'Wicket-Keeper',
    icon: '🧤',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    desc: 'Specialist behind the stumps with aggressive lower-order finishing',
  },
};

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { player, team, battingStats, bowlingStats, matchLogs, radarData, isLoading } =
    usePlayerStats(id);

  const roleInfo = player ? ROLE_META[player.role] || ROLE_META.all_rounder : ROLE_META.all_rounder;
  const isSold = player?.auctionStatus === 'sold' || Boolean(player?.soldPrice);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Player profile link copied to clipboard!');
    } else {
      toast.info(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Navigation />
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mb-4" />
          <p className="text-muted-foreground text-sm">Loading player profile & career record...</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <Navigation />
        <Header />
        <div className="container mx-auto px-4 py-16 max-w-lg text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Player Not Found</h2>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            We couldn't locate a player matching ID <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{id}</code>. They might have been removed or the link is incorrect.
          </p>
          <Button onClick={() => navigate('/players')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Player Directory
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-24 md:pb-12">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />
      <MultiMatchLiveBar />

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 md:py-6 max-w-6xl space-y-5 md:space-y-6">
        {/* Breadcrumb / Top Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/players"
            className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-muted-foreground hover:text-amber-400 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Players Directory</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-8.5 text-xs gap-1.5 rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Share Profile</span>
          </Button>
        </div>

        {/* Hero Section Card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-2xl">
          {/* Decorative backdrop glow */}
          <div
            className="absolute top-0 left-0 right-0 h-40 opacity-25 pointer-events-none blur-3xl"
            style={{
              backgroundColor: team?.primaryColor ? `hsl(${team.primaryColor})` : 'hsl(var(--primary))',
            }}
          />

          <div className="relative p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Left Column: Avatar & Core Identity */}
              <div className="flex items-center gap-4 md:gap-6">
                <div className="relative flex-shrink-0">
                  {player.photoUrl ? (
                    <img
                      src={player.photoUrl}
                      alt={player.name}
                      className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-3xl object-cover border-4 border-background shadow-md"
                    />
                  ) : (
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary/25 via-primary/10 to-muted flex items-center justify-center font-black text-2xl md:text-3xl text-primary border-4 border-background shadow-md">
                      {player.name
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                  <span
                    className="absolute -bottom-2 -right-2 text-xl bg-background rounded-full p-1 border shadow-xs"
                    title={roleInfo.label}
                  >
                    {roleInfo.icon}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-semibold tracking-wider uppercase border-border/80"
                    >
                      {player.tournamentId === 'kapl-3-womens' ? '👑 Women’s KAPL' : '🏏 Men’s KAPL'}
                    </Badge>
                    {player.jerseyNumber && (
                      <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        #{player.jerseyNumber}
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
                    {player.name}
                  </h1>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${roleInfo.badgeClass}`}
                    >
                      {roleInfo.label}
                    </span>

                    {player.battingStyle && (
                      <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                        {player.battingStyle}
                      </span>
                    )}

                    {player.bowlingStyle && (
                      <span className="text-xs text-muted-foreground bg-muted/60 px-2.5 py-0.5 rounded-full">
                        {player.bowlingStyle}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Team Banner & Auction Badge */}
              <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border/60">
                {/* Team Badge */}
                {team ? (
                  <div className="flex items-center gap-2 bg-background/80 border border-border/80 rounded-2xl px-3.5 py-2 shadow-xs">
                    <span
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: team.primaryColor
                          ? `hsl(${team.primaryColor})`
                          : '#3b82f6',
                      }}
                    />
                    <div className="text-left md:text-right">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                        {team.group ? `Group ${team.group}` : 'Squad'}
                      </p>
                      <p className="text-xs md:text-sm font-bold text-foreground">
                        {team.name}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/40 border border-dashed border-border rounded-xl px-3 py-1.5 text-xs text-muted-foreground italic">
                    Free Agent / Unassigned
                  </div>
                )}

                {/* Auction Badge */}
                <div className="text-right">
                  {isSold ? (
                    <div className="inline-flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                        Auction Sold Price
                      </span>
                      <span className="text-lg md:text-xl font-black text-emerald-500">
                        ₹{player.soldPrice ? player.soldPrice.toLocaleString() : player.basePrice}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex flex-col items-end">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Base Price
                      </span>
                      <span className="text-base font-bold text-foreground">
                        ₹{player.basePrice}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="bg-muted/40 border-t border-border/60 px-5 py-3 grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                Matches
              </span>
              <span className="text-base md:text-lg font-black text-foreground">
                {battingStats.matches}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                Total Runs
              </span>
              <span className="text-base md:text-lg font-black text-amber-500">
                {battingStats.runs}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                High Score
              </span>
              <span className="text-base md:text-lg font-black text-foreground">
                {battingStats.highestScore}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                Strike Rate
              </span>
              <span className="text-base md:text-lg font-black text-foreground">
                {battingStats.balls > 0 ? battingStats.strikeRate.toFixed(1) : '-'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                Wickets
              </span>
              <span className="text-base md:text-lg font-black text-emerald-500">
                {bowlingStats.wickets}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase block">
                Economy
              </span>
              <span className="text-base md:text-lg font-black text-foreground">
                {bowlingStats.ballsBowled > 0 ? bowlingStats.economy.toFixed(2) : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Middle Section: Performance Radar & Skill Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recharts Performance Radar Card */}
          <Card className="lg:col-span-5 border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Performance Radar
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  6-Axis Profile
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="currentColor" className="text-border/60" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: 'currentColor', fontSize: 11 }}
                      className="text-muted-foreground font-medium"
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Radar
                      name="Attributes"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.35}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border px-3 py-1.5 rounded-lg shadow-md text-xs">
                              <p className="font-bold text-foreground">{data.subject}</p>
                              <p className="text-primary font-mono">{data.value} / 100 pts</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Radar Metric Legend Badges */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                {radarData.map(metric => (
                  <div key={metric.subject} className="text-center bg-muted/30 rounded-lg p-1.5">
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {metric.subject}
                    </span>
                    <span className="text-xs font-bold font-mono text-foreground">
                      {metric.value}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Career Batting & Bowling Summary Cards */}
          <div className="lg:col-span-7 space-y-4">
            {/* Batting Card */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  Career Batting Record
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">INNINGS</span>
                    <span className="text-sm font-black text-foreground">{battingStats.innings}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">RUNS</span>
                    <span className="text-sm font-black text-amber-500">{battingStats.runs}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">BALLS</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.balls}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">AVG</span>
                    <span className="text-sm font-bold text-foreground">
                      {battingStats.average > 0 ? battingStats.average.toFixed(1) : '-'}
                    </span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">SR</span>
                    <span className="text-sm font-bold text-foreground">
                      {battingStats.balls > 0 ? battingStats.strikeRate.toFixed(1) : '-'}
                    </span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">HS</span>
                    <span className="text-sm font-black text-foreground">{battingStats.highestScore}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">FOURS</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.fours}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">SIXES</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.sixes}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">50s</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.fifties}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">30s</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.thirties}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">NOT OUTS</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.notOuts}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">DUCKS</span>
                    <span className="text-sm font-bold text-foreground">{battingStats.ducks}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bowling Card */}
            <Card className="border border-border/80 shadow-xs">
              <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  Career Bowling Record
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">OVERS</span>
                    <span className="text-sm font-black text-foreground">{bowlingStats.overs}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">MAIDENS</span>
                    <span className="text-sm font-bold text-foreground">{bowlingStats.maidens}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">RUNS</span>
                    <span className="text-sm font-bold text-foreground">{bowlingStats.runsGiven}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">WKTS</span>
                    <span className="text-sm font-black text-emerald-500">{bowlingStats.wickets}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">ECON</span>
                    <span className="text-sm font-bold text-foreground">
                      {bowlingStats.ballsBowled > 0 ? bowlingStats.economy.toFixed(2) : '-'}
                    </span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">AVG</span>
                    <span className="text-sm font-bold text-foreground">
                      {bowlingStats.wickets > 0 ? bowlingStats.bowlingAverage.toFixed(1) : '-'}
                    </span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">BEST</span>
                    <span className="text-sm font-black text-foreground">
                      {bowlingStats.wickets > 0
                        ? `${bowlingStats.bestBowling.wickets}/${bowlingStats.bestBowling.runs}`
                        : '-'}
                    </span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">BALLS</span>
                    <span className="text-sm font-bold text-foreground">{bowlingStats.ballsBowled}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">WIDES</span>
                    <span className="text-sm font-bold text-foreground">{bowlingStats.wides}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">NO BALLS</span>
                    <span className="text-sm font-bold text-foreground">{bowlingStats.noBalls}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">3-WKT HAULS</span>
                    <span className="text-sm font-bold text-foreground">{bowlingStats.threeWicketHauls}</span>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-xl">
                    <span className="text-[10px] text-muted-foreground block font-medium">BOWLING SR</span>
                    <span className="text-sm font-bold text-foreground">
                      {bowlingStats.wickets > 0 ? bowlingStats.strikeRate.toFixed(1) : '-'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Section: Match-by-Match Breakdown */}
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="py-4 px-5 border-b border-border/60">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Match-by-Match Innings Breakdown
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {matchLogs.length} match appearances
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {matchLogs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground px-4">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No official match appearances recorded yet.</p>
                <p className="text-xs mt-1">
                  Performance figures will automatically log here ball-by-ball once live scoring starts.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-3 px-4">Match / Opponent</th>
                      <th className="py-3 px-3">Stage</th>
                      <th className="py-3 px-4">Batting Performance</th>
                      <th className="py-3 px-3">Dismissal</th>
                      <th className="py-3 px-4">Bowling Figures</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {matchLogs.map(log => (
                      <tr key={log.matchId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">
                            vs {log.opponentTeam?.name || 'Opponent'}
                          </div>
                          {log.playerTeam && (
                            <span className="text-[10px] text-muted-foreground">
                              For {log.playerTeam.name}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {log.matchTypeLabel}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {log.didBat ? (
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-foreground text-sm">
                                {log.runs}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">
                                ({log.balls}b)
                              </span>
                              <div className="text-[10px] text-muted-foreground">
                                {log.fours}×4, {log.sixes}×6 • SR {log.strikeRate.toFixed(1)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Did not bat</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-muted-foreground max-w-[160px]">
                          {log.didBat ? (
                            log.isOut ? (
                              <span className="text-foreground/90 font-medium">
                                {log.dismissalDescription || log.dismissalType || 'out'}
                              </span>
                            ) : (
                              <span className="text-emerald-500 font-bold">not out</span>
                            )
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {log.didBowl ? (
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-emerald-500 text-sm">
                                {log.wickets}-{log.runsConceded}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">
                                ({log.overs}.{log.ballsInOver} ov)
                              </span>
                              <div className="text-[10px] text-muted-foreground">
                                Econ {log.economy.toFixed(2)} • {log.maidens}M
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">Did not bowl</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {log.isLive ? (
                            <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-[10px] animate-pulse">
                              LIVE
                            </Badge>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {log.resultLabel}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

