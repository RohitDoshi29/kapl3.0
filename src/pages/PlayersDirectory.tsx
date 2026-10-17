import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/cricket/Header';
import { Navigation } from '@/components/cricket/Navigation';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { TournamentSwitcher } from '@/components/cricket/TournamentSwitcher';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { useTournament } from '@/contexts/TournamentContext';
import { usePlayersDirectory, PlayerDirectoryItem } from '@/hooks/usePlayerStats';
import { PlayerRole } from '@/lib/cricketTypes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Users,
  Trophy,
  Flame,
  Coins,
  ArrowRight,
  LayoutGrid,
  List,
  Sparkles,
  RotateCcw,
  Shield,
  Zap,
} from 'lucide-react';

const ROLE_LABELS: Record<PlayerRole, { label: string; icon: string; badgeClass: string }> = {
  all_rounder: {
    label: 'All-Rounder',
    icon: '👑',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  batter: {
    label: 'Batter',
    icon: '🏏',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  bowler: {
    label: 'Bowler',
    icon: '⚡',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  wicket_keeper: {
    label: 'Wicket-Keeper',
    icon: '🧤',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
};

type SortOption = 'name' | 'runs' | 'strikeRate' | 'wickets' | 'economy' | 'price' | 'matches';

export default function PlayersDirectory() {
  const { activeTournamentId } = useTournament();
  const [selectedTournament, setSelectedTournament] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('runs');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Determine query tournament filter
  const filterTournamentId =
    selectedTournament === 'active'
      ? activeTournamentId
      : selectedTournament === 'all'
      ? 'all'
      : selectedTournament;

  const { players, isLoading } = usePlayersDirectory(filterTournamentId);

  // Extract unique teams for dropdown filter
  const uniqueTeams = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    players.forEach(p => {
      if (p.teamId && p.teamName) {
        map.set(p.teamId, { id: p.teamId, name: p.teamName });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  // Aggregate high-level tournament statistics
  const summary = useMemo(() => {
    let totalRuns = 0;
    let totalWickets = 0;
    let soldCount = 0;
    let topScorer: PlayerDirectoryItem | null = null;
    let topWicketTaker: PlayerDirectoryItem | null = null;

    players.forEach(p => {
      totalRuns += p.runs;
      totalWickets += p.wickets;
      if (p.auctionStatus === 'sold' || p.soldPrice) soldCount++;

      if (!topScorer || p.runs > topScorer.runs) {
        topScorer = p;
      }
      if (!topWicketTaker || p.wickets > topWicketTaker.wickets) {
        topWicketTaker = p;
      }
    });

    return {
      totalPlayers: players.length,
      soldCount,
      totalRuns,
      totalWickets,
      topScorer: topScorer && (topScorer as PlayerDirectoryItem).runs > 0 ? topScorer : null,
      topWicketTaker: topWicketTaker && (topWicketTaker as PlayerDirectoryItem).wickets > 0 ? topWicketTaker : null,
    };
  }, [players]);

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return players
      .filter(p => {
        // Name search
        if (query) {
          const matchName = p.name.toLowerCase().includes(query);
          const matchTeam = p.teamName?.toLowerCase().includes(query);
          if (!matchName && !matchTeam) return false;
        }

        // Role filter
        if (selectedRole !== 'all' && p.role !== selectedRole) {
          return false;
        }

        // Team filter
        if (selectedTeam !== 'all') {
          if (selectedTeam === 'unassigned') {
            if (p.teamId) return false;
          } else if (p.teamId !== selectedTeam) {
            return false;
          }
        }

        // Auction status filter
        if (selectedStatus !== 'all') {
          if (selectedStatus === 'sold' && p.auctionStatus !== 'sold' && !p.soldPrice) return false;
          if (selectedStatus === 'unsold' && p.auctionStatus !== 'unsold') return false;
          if (selectedStatus === 'pending' && p.auctionStatus !== 'pending' && (p.auctionStatus === 'sold' || p.soldPrice)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name);
          case 'runs':
            return b.runs !== a.runs ? b.runs - a.runs : b.strikeRate - a.strikeRate;
          case 'wickets':
            return b.wickets !== a.wickets ? b.wickets - a.wickets : a.economy - b.economy;
          case 'strikeRate':
            return b.strikeRate - a.strikeRate;
          case 'economy':
            // Lower economy is better if overs bowled > 0
            if (a.overs === 0 && b.overs === 0) return 0;
            if (a.overs === 0) return 1;
            if (b.overs === 0) return -1;
            return a.economy - b.economy;
          case 'price':
            const priceA = a.soldPrice || a.basePrice || 0;
            const priceB = b.soldPrice || b.basePrice || 0;
            return priceB - priceA;
          case 'matches':
            return b.matchesPlayed - a.matchesPlayed;
          default:
            return 0;
        }
      });
  }, [players, searchQuery, selectedRole, selectedTeam, selectedStatus, sortBy]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedRole('all');
    setSelectedTeam('all');
    setSelectedStatus('all');
    setSortBy('runs');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedRole !== 'all' ||
    selectedTeam !== 'all' ||
    selectedStatus !== 'all' ||
    sortBy !== 'runs';

  return (
    <div className="relative min-h-screen bg-background pb-20 md:pb-10">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />
      <MultiMatchLiveBar />

      <main className="relative z-10 container mx-auto px-4 py-4 md:py-6 max-w-7xl">
        {/* Top bar with Tournament Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/15 border border-amber-500/30 text-amber-400 shadow-xs">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
                Player <span className="text-gradient-gold">Directory</span>
              </h1>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Explore player rosters, career performance metrics, auction prices, and match records.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <TournamentSwitcher />
          </div>
        </div>

        {/* Quick Highlights / KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="border-white/[0.08] bg-card/85 backdrop-blur-xl shadow-lg">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Total Players
                </p>
                <p className="text-xl md:text-2xl font-black text-foreground mt-0.5">
                  {summary.totalPlayers}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {summary.soldCount} drafted in squads
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Users className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border border-border/80 shadow-xs">
            <CardContent className="p-3 md:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Tournament Runs
                </p>
                <p className="text-xl md:text-2xl font-black text-amber-500 mt-0.5">
                  {summary.totalRuns.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[110px]">
                  Top: {summary.topScorer ? `${summary.topScorer.name} (${summary.topScorer.runs})` : '-'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Flame className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border border-border/80 shadow-xs">
            <CardContent className="p-3 md:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Wickets Taken
                </p>
                <p className="text-xl md:text-2xl font-black text-emerald-500 mt-0.5">
                  {summary.totalWickets}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[110px]">
                  Top: {summary.topWicketTaker ? `${summary.topWicketTaker.name} (${summary.topWicketTaker.wickets})` : '-'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Zap className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border border-border/80 shadow-xs">
            <CardContent className="p-3 md:p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Squad Draft Rate
                </p>
                <p className="text-xl md:text-2xl font-black text-primary mt-0.5">
                  {summary.totalPlayers > 0
                    ? `${Math.round((summary.soldCount / summary.totalPlayers) * 100)}%`
                    : '0%'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {summary.totalPlayers - summary.soldCount} available/free
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Coins className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-2xl p-4 mb-6 shadow-lg shadow-black/20 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search players by name, team, or skills..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-white/[0.04] rounded-xl border-white/[0.08] focus-visible:ring-amber-400/40 text-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* League Scope Toggle */}
            <Select value={selectedTournament} onValueChange={setSelectedTournament}>
              <SelectTrigger className="w-full md:w-[170px] h-10 bg-background/60 rounded-xl">
                <SelectValue placeholder="Tournament" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active League</SelectItem>
                <SelectItem value="kapl-3-mens">🏏 Men's KAPL</SelectItem>
                <SelectItem value="kapl-3-womens">👑 Women's KAPL</SelectItem>
                <SelectItem value="all">All Tournaments</SelectItem>
              </SelectContent>
            </Select>

            {/* Role Filter */}
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full md:w-[160px] h-10 bg-background/60 rounded-xl">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="all_rounder">👑 All-Rounders</SelectItem>
                <SelectItem value="batter">🏏 Batters</SelectItem>
                <SelectItem value="bowler">⚡ Bowlers</SelectItem>
                <SelectItem value="wicket_keeper">🧤 Wicket-Keepers</SelectItem>
              </SelectContent>
            </Select>

            {/* Team Filter */}
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full md:w-[170px] h-10 bg-background/60 rounded-xl">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {uniqueTeams.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
                <SelectItem value="unassigned">Free Agents / Unassigned</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={val => setSortBy(val as SortOption)}>
              <SelectTrigger className="w-full md:w-[170px] h-10 bg-background/60 rounded-xl font-medium">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="runs">🔥 Most Runs</SelectItem>
                <SelectItem value="wickets">⚡ Most Wickets</SelectItem>
                <SelectItem value="strikeRate">💥 Strike Rate</SelectItem>
                <SelectItem value="economy">🎯 Best Economy</SelectItem>
                <SelectItem value="price">💰 Auction Price</SelectItem>
                <SelectItem value="matches">🏟️ Matches Played</SelectItem>
                <SelectItem value="name">🔤 Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Switcher */}
            <div className="hidden lg:flex items-center border border-border/80 rounded-xl p-0.5 bg-background/50">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 px-2.5 rounded-lg"
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8 px-2.5 rounded-lg"
                title="Table View"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Filter Status Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-foreground">{filteredPlayers.length}</strong> of{' '}
                {players.length} players
              </span>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-6 px-2 text-xs text-primary hover:text-primary gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset Filters
                </Button>
              )}
            </div>

            {/* Auction Status Pills */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium mr-1">Auction:</span>
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'sold' ? 'all' : 'sold')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  selectedStatus === 'sold'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Sold
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'unsold' ? 'all' : 'unsold')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  selectedStatus === 'unsold'
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Unsold
              </button>
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === 'pending' ? 'all' : 'pending')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                  selectedStatus === 'pending'
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {/* Players Loading State */}
        {isLoading && players.length === 0 && (
          <div className="py-20 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent mb-3" />
            <p className="text-sm text-muted-foreground">Loading player directory & stats...</p>
          </div>
        )}

        {/* Empty State */}
        {(!isLoading || players.length > 0) && filteredPlayers.length === 0 && (
          <div className="py-16 text-center bg-card border border-border/70 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No players found</h3>
            <p className="text-xs md:text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
              No players matched your current search and filter criteria. Try adjusting your search term or clearing filters.
            </p>
            <Button variant="outline" size="sm" onClick={resetFilters} className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> Clear All Filters
            </Button>
          </div>
        )}

        {/* View Mode: Card Grid */}
        {filteredPlayers.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPlayers.map(player => {
              const roleMeta = ROLE_LABELS[player.role] || ROLE_LABELS.all_rounder;
              const isSold = player.auctionStatus === 'sold' || Boolean(player.soldPrice);
              const isUnsold = player.auctionStatus === 'unsold';

              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className="group block transition-all"
                >
                  <Card className="h-full overflow-hidden border border-white/[0.08] hover:border-amber-400/40 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-300 bg-card/85 backdrop-blur-md rounded-2xl group-hover:-translate-y-1">
                    {/* Card Top: Avatar, Role & Auction Price */}
                    <div className="p-4 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="relative">
                          {player.photoUrl ? (
                            <img
                              src={player.photoUrl}
                              alt={player.name}
                              className="w-14 h-14 rounded-2xl object-cover border border-white/10 group-hover:border-amber-400/50 transition-colors shadow-sm"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-muted flex items-center justify-center font-black text-lg text-amber-400 border border-white/10 group-hover:border-amber-400/50 transition-colors shadow-sm">
                              {player.name
                                .split(' ')
                                .map(n => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>
                          )}
                          <span
                            className="absolute -bottom-1 -right-1 text-sm bg-background/90 rounded-full p-0.5 border shadow-xs"
                            title={roleMeta.label}
                          >
                            {roleMeta.icon}
                          </span>
                        </div>

                        {/* Auction Price / Status Pill */}
                        <div className="text-right">
                          {isSold ? (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2 py-0.5">
                              Sold ₹{player.soldPrice ? player.soldPrice.toLocaleString() : player.basePrice}
                            </Badge>
                          ) : isUnsold ? (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-2 py-0.5">
                              Unsold
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground px-2 py-0.5">
                              Base ₹{player.basePrice}
                            </Badge>
                          )}

                          <div className="mt-1">
                            <span className="text-[10px] text-muted-foreground block">
                              {player.tournamentId === 'kapl-3-womens' ? '👑 Women’s' : '🏏 Men’s'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Name & Jersey */}
                      <div className="mt-3">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {player.name}
                          </h3>
                          {player.jerseyNumber && (
                            <span className="text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              #{player.jerseyNumber}
                            </span>
                          )}
                        </div>

                        {/* Team Assignment */}
                        <div className="flex items-center gap-1.5 mt-1">
                          {player.teamName ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: player.teamColor
                                    ? `hsl(${player.teamColor})`
                                    : '#3b82f6',
                                }}
                              />
                              <span className="truncate max-w-[170px] font-medium text-foreground/80">
                                {player.teamName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Free Agent
                            </span>
                          )}
                        </div>

                        {/* Role & Styles */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.label}
                          </span>
                          {player.battingStyle && (
                            <span className="text-[10px] text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded-full">
                              {player.battingStyle.includes('Left') ? 'LHB' : 'RHB'}
                            </span>
                          )}
                          {player.bowlingStyle && (
                            <span className="text-[10px] text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
                              {player.bowlingStyle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid Pills */}
                    <div className="bg-muted/30 border-t border-border/50 px-4 py-2.5">
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            RUNS
                          </span>
                          <span className="text-xs font-black text-foreground">
                            {player.runs}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            SR
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            {player.strikeRate > 0 ? player.strikeRate.toFixed(1) : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            WKTS
                          </span>
                          <span className="text-xs font-black text-foreground">
                            {player.wickets}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block font-medium">
                            ECON
                          </span>
                          <span className="text-xs font-bold text-foreground">
                            {player.overs > 0 ? player.economy.toFixed(1) : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Link */}
                      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                        <span>View Full Profile</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* View Mode: Dense Table View */}
        {filteredPlayers.length > 0 && viewMode === 'table' && (
          <div className="bg-card border border-border/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Player</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Team</th>
                    <th className="py-3 px-3 text-right">Price</th>
                    <th className="py-3 px-3 text-center">Mat</th>
                    <th className="py-3 px-3 text-right">Runs</th>
                    <th className="py-3 px-3 text-right">HS</th>
                    <th className="py-3 px-3 text-right">SR</th>
                    <th className="py-3 px-3 text-right">Wkts</th>
                    <th className="py-3 px-3 text-right">Econ</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredPlayers.map(player => {
                    const roleMeta = ROLE_LABELS[player.role] || ROLE_LABELS.all_rounder;
                    const isSold = player.auctionStatus === 'sold' || Boolean(player.soldPrice);

                    return (
                      <tr
                        key={player.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-2.5 px-4">
                          <Link
                            to={`/players/${player.id}`}
                            className="flex items-center gap-2.5 group font-bold text-foreground hover:text-primary"
                          >
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs flex-shrink-0">
                              {player.photoUrl ? (
                                <img
                                  src={player.photoUrl}
                                  alt={player.name}
                                  className="w-full h-full object-cover rounded-lg"
                                />
                              ) : (
                                player.name[0]
                              )}
                            </div>
                            <span className="truncate max-w-[180px]">{player.name}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleMeta.badgeClass}`}
                          >
                            {roleMeta.icon} {roleMeta.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {player.teamName ? (
                            <span className="font-medium text-foreground">{player.teamName}</span>
                          ) : (
                            <span className="italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {isSold ? (
                            <span className="text-emerald-500 font-bold">
                              ₹{player.soldPrice ? player.soldPrice.toLocaleString() : player.basePrice}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">₹{player.basePrice}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-muted-foreground">
                          {player.matchesPlayed}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-foreground">
                          {player.runs}
                        </td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground font-mono">
                          {player.highestScore}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {player.strikeRate > 0 ? player.strikeRate.toFixed(1) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-foreground">
                          {player.wickets}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {player.overs > 0 ? player.economy.toFixed(2) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/players/${player.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                          >
                            Profile <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

