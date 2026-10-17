import { useState } from 'react';
import { useAuction } from '@/hooks/useAuction';
import { useTournament } from '@/contexts/TournamentContext';
import { Navigation } from '@/components/cricket/Navigation';
import { Header } from '@/components/cricket/Header';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { SinglePlayerAuctionStage } from '@/components/auction/SinglePlayerAuctionStage';
import { CategoryPlayerGrid } from '@/components/auction/CategoryPlayerGrid';
import { TeamPurseList } from '@/components/auction/TeamPurseList';
import { AdminAuctionDesk } from '@/components/auction/AdminAuctionDesk';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Gavel, Wallet, Users, Radio, Sparkles, RotateCcw, Zap } from 'lucide-react';

export default function Auction() {
  const { activeTournamentId, setActiveTournamentId } = useTournament();
  const [activeTab, setActiveTab] = useState<'spotlight' | 'categories' | 'teams' | 'admin'>('spotlight');
  const [isResetting, setIsResetting] = useState(false);

  const {
    currentPlayer,
    playerPool,
    teams,
    isLoading,
    isAdmin,
    selectedCategory,
    setSelectedCategory,
    spotlightPlayer,
    nextPlayer,
    adminDecideSold,
    adminDecideUnsold,
    revertPlayerStatus,
    salesHistory,
    initializeAuctionData,
  } = useAuction(activeTournamentId);

  const handleResetAuctionData = async () => {
    setIsResetting(true);
    try {
      const res = await initializeAuctionData();
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
    } catch (e: any) {
      toast.error('Failed to reset auction data: ' + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background pb-20 md:pb-8">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />
      <MultiMatchLiveBar />

      <main className="relative z-10 container mx-auto px-4 py-4 md:py-6 space-y-6">
        {/* Tournament Switcher & Live Status Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-white/[0.08] bg-card/85 backdrop-blur-xl rounded-3xl p-4 md:p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/15 border border-amber-500/30 flex items-center justify-center shadow-xs">
              <Gavel className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black text-foreground flex items-center gap-2 font-display tracking-tight">
                Live Player <span className="text-gradient-gold">Auction Room</span>
                <Badge variant="gold" className="text-[10px] font-black tracking-wider">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5 text-amber-300" /> KAPL 3.0
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Category-wise bidding • Single player spotlight hammer • Team purse management
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isResetting}
                    className="h-8 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 gap-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                    Reset & Seed 80 Players
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset Auction & Seed 80 Players?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will:
                      <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                        <li>Purge existing players and insert 80 structured players (Player 1 to 80)</li>
                        <li>Distribute roles (25 Batters, 25 Bowlers, 20 All-rounders, 10 Keepers)</li>
                        <li>Clear all team rosters (0 players allocated)</li>
                        <li>Restore each team's purse to full ₹10,000</li>
                        <li>Set auction spotlight to Player 1 ready for live bidding</li>
                      </ul>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetAuctionData}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                    >
                      Confirm Reset & Seed
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* Live Indicator */}
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black shadow-xs tracking-wider">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              LIVE AUCTION
            </span>

            {/* Division Switcher */}
            <div className="flex items-center bg-white/[0.04] border border-white/10 p-1 rounded-xl text-xs font-semibold backdrop-blur-sm">
              <button
                onClick={() => setActiveTournamentId('kapl-3-mens')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTournamentId === 'kapl-3-mens'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Men's
              </button>
              <button
                onClick={() => setActiveTournamentId('kapl-3-womens')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTournamentId === 'kapl-3-womens'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Women's
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'max-w-2xl grid-cols-2 sm:grid-cols-4' : 'max-w-md grid-cols-3'} mx-auto bg-white/[0.04] border border-white/10 rounded-2xl p-1 backdrop-blur-md`}>
            <TabsTrigger value="spotlight" className="gap-1.5 text-xs md:text-sm font-bold rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/35">
              <Gavel className="w-4 h-4 text-amber-400" />
              Spotlight Stage
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 text-xs md:text-sm font-bold rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/35">
              <Users className="w-4 h-4 text-amber-400" />
              Categories ({playerPool.length})
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-1.5 text-xs md:text-sm font-bold rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/35">
              <Wallet className="w-4 h-4 text-amber-400" />
              Team Purses ({teams.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="admin"
                className="gap-1.5 text-xs md:text-sm font-black rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/25 data-[state=active]:to-yellow-500/20 data-[state=active]:text-amber-300 data-[state=active]:border data-[state=active]:border-amber-500/40 text-amber-400/90"
              >
                <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                Admin Desk
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB 1: Single Player Spotlight Stage */}
          <TabsContent value="spotlight" className="space-y-6">
            <SinglePlayerAuctionStage
              player={currentPlayer}
              playerPool={playerPool}
              teams={teams}
              isAdmin={isAdmin}
              onNext={() => nextPlayer('next')}
              onPrev={() => nextPlayer('prev')}
              onSpotlightPlayer={spotlightPlayer}
              onDecideSold={adminDecideSold}
              onDecideUnsold={adminDecideUnsold}
              onRevert={revertPlayerStatus}
              salesHistory={salesHistory}
            />

            {/* Category Players Bar Below Spotlight for Quick Navigation */}
            <div>
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Browse Category Players
              </h3>
              <CategoryPlayerGrid
                players={playerPool}
                teams={teams}
                selectedCategory={selectedCategory}
                selectedPlayerId={currentPlayer?.id}
                onSelectCategory={setSelectedCategory}
                onSelectPlayer={(p) => spotlightPlayer(p)}
              />
            </div>
          </TabsContent>

          {/* TAB 2: Full Category-Wise Players Display */}
          <TabsContent value="categories" className="space-y-4">
            <CategoryPlayerGrid
              players={playerPool}
              teams={teams}
              selectedCategory={selectedCategory}
              selectedPlayerId={currentPlayer?.id}
              onSelectCategory={setSelectedCategory}
              onSelectPlayer={(p) => {
                spotlightPlayer(p);
                setActiveTab('spotlight');
              }}
            />
          </TabsContent>

          {/* TAB 3: Team Purses & Quotas */}
          <TabsContent value="teams">
            <TeamPurseList teams={teams} playerPool={playerPool} />
          </TabsContent>

          {/* TAB 4: Admin Auction Desk (Set Auction Player-by-Player) */}
          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminAuctionDesk
                playerPool={playerPool}
                teams={teams}
                currentPlayer={currentPlayer}
                onSpotlightPlayer={spotlightPlayer}
                onDecideSold={adminDecideSold}
                onDecideUnsold={adminDecideUnsold}
                onRevertStatus={revertPlayerStatus}
                onResetAuction={handleResetAuctionData}
                salesHistory={salesHistory}
              />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
