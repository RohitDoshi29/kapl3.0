import { useState } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { RefreshCcw, Trash2, Database, History, Gavel, Sparkles, CheckCircle2 } from 'lucide-react';
import { resetTeamsAndSeed80Players, autoCompleteAuctionForAll80Players } from '@/lib/mockPlayersData';
import { useTournament } from '@/contexts/TournamentContext';
import { supabase } from '@/integrations/supabase/client';

export default function AdminSettingsTab() {
  const { matchHistory, resetSeason, resetEverything, teams } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();
  const [isResetting, setIsResetting] = useState(false);

  const handleSeed80Players = async () => {
    const res = await resetTeamsAndSeed80Players(supabase, activeTournamentId);
    if (res.success) {
      toast.success(`🎉 Successfully populated 80 auction players for ${currentTournament?.name || 'tournament'} and emptied all team squads!`);
      try {
        const channel = supabase.channel(`auction-room-${activeTournamentId}`);
        await channel.send({
          type: 'broadcast',
          event: 'auction_sync',
          payload: {
            event: 'auction_reset',
            tournamentId: activeTournamentId,
          }
        });
      } catch (e) {}
    } else {
      toast.error('Failed to seed auction players: ' + res.error);
    }
  };

  const handleAutoCompleteAuction = async () => {
    const res = await autoCompleteAuctionForAll80Players(supabase, activeTournamentId);
    if (res.success) {
      toast.success(res.message);
      try {
        const channel = supabase.channel(`auction-room-${activeTournamentId}`);
        await channel.send({
          type: 'broadcast',
          event: 'auction_sync',
          payload: {
            event: 'auction_auto_completed',
            teams: res.teams,
            players: res.players,
            salesHistory: res.salesHistory,
            tournamentId: activeTournamentId,
            auctionState: { status: 'completed', tournamentId: activeTournamentId }
          }
        });
      } catch (e) {}
    } else {
      toast.error('Failed to auto-complete auction: ' + res.message);
    }
  };

  const handleResetSeason = async () => {
    try {
      await resetSeason();
      toast.success('Season reset! Match history cleared.');
    } catch (e: any) {
      toast.error('Failed to reset season: ' + (e?.message || e));
    }
  };

  const handleResetEverything = async () => {
    setIsResetting(true);
    try {
      await resetEverything();
      toast.success('All data permanently deleted! Players, match records, and squads have been reset to zero.');
    } catch (err: any) {
      toast.error('Failed to reset all data: ' + (err?.message || err));
    } finally {
      setIsResetting(false);
    }
  };

  // Calculate storage usage
  const getStorageSize = () => {
    let total = 0;
    for (const key in localStorage) {
      if (key.startsWith('kapl_')) {
        total += localStorage.getItem(key)?.length || 0;
      }
    }
    return (total / 1024).toFixed(2);
  };

  const completedMatches = matchHistory.filter(m => m.status === 'completed').length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Settings & Data</h2>

      {/* Storage Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Storage Information
          </CardTitle>
          <CardDescription>Current data usage in browser storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground">Teams</p>
              <p className="text-2xl font-bold">{teams.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-muted-foreground">Matches Played</p>
              <p className="text-2xl font-bold">{completedMatches}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted col-span-2">
              <p className="text-muted-foreground">Storage Used</p>
              <p className="text-2xl font-bold">{getStorageSize()} KB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reset Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCcw className="w-5 h-5" />
            Reset Options
          </CardTitle>
          <CardDescription>Reset data for new season or fresh start</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seed 80 Auction Players & Empty Squads */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 gap-3">
            <div>
              <h4 className="font-bold flex items-center gap-2 text-amber-500">
                <Gavel className="w-4 h-4" />
                Initialize 80 Auction Players & Empty Team Squads
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generates 80 structured fake players (25 Batters, 25 Bowlers, 20 All-Rounders, 10 Keepers) with batting/bowling styles and ₹100-₹500 base prices. Removes all players from all 8 teams and replenishes each franchise purse to ₹10,000 for the Live Auction.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shrink-0 gap-1.5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  Seed 80 Players & Reset Squads
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Initialize 80 Auction Players?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                      <li>Generate Player 1 to Player 80 as unassigned auction candidates</li>
                      <li>Distribute roles (25 Batters, 25 Bowlers, 20 All-rounders, 10 Keepers)</li>
                      <li>Empty all 8 franchise squads (0 players currently allocated)</li>
                      <li>Replenish each team's remaining purse to full ₹10,000</li>
                      <li>Reset the auction spotlight to Player 1 ready for bidding</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleSeed80Players}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                  >
                    Confirm & Initialize 80 Players
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Auto-Complete Auction (80 Players) for Testing */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 gap-3">
            <div>
              <h4 className="font-bold flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Auto-Complete Auction (All 80 Players Drafted for Testing)
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Drafts all 80 auction players into balanced 10-player franchise squads across all 8 teams with realistic bid amounts within their ₹10,000 purse limit.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shrink-0 gap-1.5 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-Complete 80 Players
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Auto-Complete 80 Players Auction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This testing action will:
                    <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                      <li>Draft all 80 players across all 8 franchise squads (10 players per team)</li>
                      <li>Evenly balance batters, bowlers, all-rounders, and wicket-keepers</li>
                      <li>Simulate realistic bidding prices within each team's ₹10,000 purse</li>
                      <li>Compute remaining purses and mark the live auction as completed</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAutoCompleteAuction}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
                  >
                    Confirm & Complete Auction
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Reset Season */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div>
              <h4 className="font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Reset Season
              </h4>
              <p className="text-sm text-muted-foreground">
                Clears match history and current match. Keeps teams, logos, and players.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">Reset Season</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Season?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all match history ({completedMatches} matches) and the current match.
                    Team names, logos, colors, and players will be preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetSeason}>
                    Reset Season
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Reset Everything */}
          <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/50">
            <div>
              <h4 className="font-medium flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" />
                Reset Everything
              </h4>
              <p className="text-sm text-muted-foreground">
                Deletes ALL data including teams, players, logos, and match history.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset All</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete ALL data:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All team customizations (names, logos, colors)</li>
                      <li>All player information and photos</li>
                      <li>All match history ({completedMatches} matches)</li>
                      <li>Current match progress</li>
                    </ul>
                    <span className="block mt-2 font-medium">This cannot be undone!</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetEverything}
                    disabled={isResetting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isResetting ? 'Deleting Everything...' : 'Delete Everything'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
