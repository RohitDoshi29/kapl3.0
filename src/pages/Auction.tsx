import { useState } from 'react';
import { useAuction } from '@/hooks/useAuction';
import { useTournament } from '@/contexts/TournamentContext';
import { Navigation } from '@/components/cricket/Navigation';
import { Header } from '@/components/cricket/Header';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { SinglePlayerAuctionStage } from '@/components/auction/SinglePlayerAuctionStage';
import { CategoryPlayerGrid } from '@/components/auction/CategoryPlayerGrid';
import { TeamPurseList } from '@/components/auction/TeamPurseList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Gavel, Wallet, Users, Radio, Sparkles } from 'lucide-react';

export default function Auction() {
  const { activeTournamentId, setActiveTournamentId } = useTournament();
  const [activeTab, setActiveTab] = useState<'spotlight' | 'categories' | 'teams'>('spotlight');

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
  } = useAuction(activeTournamentId);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <Navigation />
      <Header />
      <MultiMatchLiveBar />

      <main className="container mx-auto px-4 py-4 md:py-6 space-y-6">
        {/* Tournament Switcher & Live Status Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border rounded-2xl p-3.5 md:p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Gavel className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
                Live Player Auction (Bidding Round)
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-bold">
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" /> KAPL 3.0
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Category-wise bidding • Single player spotlight • Team purse management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Live Indicator */}
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              AUCTION ROOM
            </span>

            {/* Division Switcher */}
            <div className="flex items-center bg-muted p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTournamentId('kapl-3-mens')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTournamentId === 'kapl-3-mens'
                    ? 'bg-background text-foreground shadow font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Men's
              </button>
              <button
                onClick={() => setActiveTournamentId('kapl-3-womens')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTournamentId === 'kapl-3-womens'
                    ? 'bg-background text-foreground shadow font-bold'
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
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="spotlight" className="gap-1.5 text-xs md:text-sm font-semibold">
              <Gavel className="w-4 h-4" />
              Spotlight Stage
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-1.5 text-xs md:text-sm font-semibold">
              <Users className="w-4 h-4" />
              Categories ({playerPool.length})
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-1.5 text-xs md:text-sm font-semibold">
              <Wallet className="w-4 h-4" />
              Team Purses ({teams.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Single Player Spotlight Stage */}
          <TabsContent value="spotlight" className="space-y-6">
            <SinglePlayerAuctionStage
              player={currentPlayer}
              teams={teams}
              isAdmin={isAdmin}
              onNext={() => nextPlayer('next')}
              onPrev={() => nextPlayer('prev')}
              onDecideSold={adminDecideSold}
              onDecideUnsold={adminDecideUnsold}
              onRevert={revertPlayerStatus}
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
        </Tabs>
      </main>
    </div>
  );
}
