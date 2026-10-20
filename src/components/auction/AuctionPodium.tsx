import { useState } from 'react';
import { PlayerRecord, Team, AuctionState } from '@/lib/cricketTypes';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import {
  Gavel,
  Clock,
  Sparkles,
  TrendingUp,
  User,
  AlertTriangle,
  History,
  ShieldAlert,
} from 'lucide-react';

interface AuctionPodiumProps {
  auctionState: AuctionState | null;
  currentPlayer: PlayerRecord | null;
  teams: Team[];
  userTeam: Team | null;
  timeLeft: number;
  isAdmin: boolean;
  onPlaceBid: (teamId: string, increment: number) => void;
  onTriggerWarning: () => void;
  onHammerSold: () => void;
  onHammerUnsold: () => void;
  onReset: () => void;
}

export function AuctionPodium({
  auctionState,
  currentPlayer,
  teams = [],
  userTeam,
  timeLeft,
  isAdmin,
  onPlaceBid,
  onTriggerWarning,
  onHammerSold,
  onHammerUnsold,
  onReset,
}: AuctionPodiumProps) {
  const [selectedBidTeamId, setSelectedBidTeamId] = useState<string>(userTeam?.id || teams?.[0]?.id || '');

  const highestBidderTeam = (teams || []).find((t) => t.id === auctionState?.highestBidderTeamId);
  const isSold = auctionState?.status === 'sold';
  const isUnsold = auctionState?.status === 'unsold';
  const isWarning = auctionState?.status === 'fair_warning';
  const isIdle = !currentPlayer || auctionState?.status === 'idle';

  // Format currency
  const formatMoney = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'batter':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'bowler':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'wicket_keeper':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const getTimerColor = (sec: number) => {
    if (sec > 10) return 'text-primary border-primary';
    if (sec > 5) return 'text-amber-400 border-amber-400 animate-pulse';
    return 'text-destructive border-destructive animate-ping';
  };

  if (isIdle) {
    return (
      <Card className="border-2 border-dashed border-muted p-8 text-center bg-card/60 rounded-3xl">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Gavel className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl md:text-2xl font-bold mb-2">Auction Podium is Idle</h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
          The auctioneer will bring the next player to the hammer shortly. Check the Player Pool tab below to browse available players.
        </p>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* SOLD Celebratory Banner */}
      {isSold && highestBidderTeam && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white rounded-2xl p-4 text-center shadow-lg animate-bounce">
          <div className="flex items-center justify-center gap-2 text-xl md:text-2xl font-black tracking-wide">
            <Sparkles className="w-6 h-6 text-yellow-300" />
            SOLD TO {highestBidderTeam.name.toUpperCase()} FOR {formatMoney(auctionState.currentBid)}!
            <Sparkles className="w-6 h-6 text-yellow-300" />
          </div>
        </div>
      )}

      {/* UNSOLD Banner */}
      {isUnsold && (
        <div className="bg-destructive/90 text-destructive-foreground rounded-2xl p-4 text-center shadow-md">
          <span className="text-lg md:text-xl font-bold tracking-wide">
            PLAYER UNSOLD • MOVED TO ACCELERATED ROUND
          </span>
        </div>
      )}

      {/* Main Podium Card */}
      <Card className="relative overflow-hidden border-2 border-primary/30 rounded-3xl shadow-2xl bg-gradient-to-b from-card to-muted/30">
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Player Profile Left Section */}
            <div className="lg:col-span-5 flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <Avatar className="w-32 h-32 md:w-44 md:h-44 border-4 border-primary/40 shadow-xl rounded-full">
                  <AvatarImage src={currentPlayer.photoUrl || undefined} alt={currentPlayer.name} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-primary text-4xl font-black">
                    {currentPlayer.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Role Pill */}
                <Badge
                  variant="outline"
                  className={`absolute -bottom-2 left-1/2 -translate-x-1/2 font-bold px-3 py-1 shadow-md border ${getRoleColor(
                    currentPlayer.role
                  )}`}
                >
                  {currentPlayer.role.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>

              <div className="pt-2">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                  {currentPlayer.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  {currentPlayer.battingStyle && <span>🏏 {currentPlayer.battingStyle}</span>}
                  {currentPlayer.bowlingStyle && <span>⚡ {currentPlayer.bowlingStyle}</span>}
                </div>
              </div>

              <div className="bg-muted/80 border rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                Base Price:{' '}
                <span className="text-foreground font-bold">{formatMoney(currentPlayer.basePrice)}</span>
              </div>
            </div>

            {/* Bidding Status Center & Right Section */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              {/* Header Status & Countdown Timer */}
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {isWarning ? '⚠️ FINAL CALL' : 'LIVE HAMMER'}
                  </span>
                </div>

                {/* Animated Timer */}
                {!isSold && !isUnsold && (
                  <div
                    className={`flex items-center gap-1.5 border-2 rounded-full px-3 py-1 font-mono font-bold text-sm ${getTimerColor(
                      timeLeft
                    )}`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{timeLeft}s</span>
                  </div>
                )}
              </div>

              {/* Huge Bid Display */}
              <div className="space-y-1 text-center lg:text-left">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Current Highest Bid
                </p>
                <div className="text-5xl md:text-7xl font-black text-primary tracking-tight">
                  {formatMoney(auctionState?.currentBid || currentPlayer.basePrice)}
                </div>

                {highestBidderTeam ? (
                  <div className="flex items-center justify-center lg:justify-start gap-2 pt-2">
                    <TeamBadge team={highestBidderTeam} size="sm" showName={false} />
                    <span className="text-sm md:text-base font-bold text-foreground">
                      Held by <span className="text-primary">{highestBidderTeam.name}</span>
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pt-1">
                    No bids yet. Opening at base price.
                  </p>
                )}
              </div>

              {/* Bidding Keypad for Captains / Admins */}
              {!isSold && !isUnsold && (
                <div className="space-y-3 pt-2">
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Bid as team:</span>
                      <select
                        value={selectedBidTeamId}
                        onChange={(e) => setSelectedBidTeamId(e.target.value)}
                        className="bg-card border rounded-lg px-2.5 py-1 text-xs font-semibold"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Purse: {formatMoney(t.remainingPurse)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                    {[50, 100, 250, 500].map((inc) => (
                      <Button
                        key={inc}
                        size="lg"
                        className="h-12 md:h-14 font-extrabold text-base md:text-lg flex flex-col items-center justify-center gap-0 shadow-md"
                        onClick={() => onPlaceBid(isAdmin ? selectedBidTeamId : userTeam?.id || teams[0]?.id, inc)}
                      >
                        <span>+{inc}</span>
                        <span className="text-[10px] font-normal opacity-70">
                          {formatMoney((auctionState?.currentBid || currentPlayer.basePrice) + inc)}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Auctioneer Quick Actions (Admins only) */}
              {isAdmin && (
                <div className="border-t pt-4 flex flex-wrap items-center gap-2 justify-end">
                  {!isSold && !isUnsold && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                        onClick={onTriggerWarning}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Fair Warning
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-1"
                        onClick={onHammerUnsold}
                      >
                        Unsold
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={onHammerSold}
                        disabled={!auctionState?.highestBidderTeamId}
                      >
                        <Gavel className="w-3.5 h-3.5" />
                        SOLD! 🔨
                      </Button>
                    </>
                  )}

                  {(isSold || isUnsold) && (
                    <Button size="sm" variant="default" className="gap-1" onClick={onReset}>
                      Clear Podium / Next Player ⏭️
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Bids Ticker */}
        {auctionState?.bidHistory && auctionState.bidHistory.length > 0 && (
          <div className="border-t bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2">
              <History className="w-3.5 h-3.5" />
              Live Bid Ticker
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {auctionState.bidHistory.slice(0, 8).map((bid, i) => (
                <Badge
                  key={i}
                  variant={i === 0 ? 'default' : 'outline'}
                  className={`text-xs px-2.5 py-1 whitespace-nowrap gap-1 ${
                    i === 0 ? 'bg-primary text-primary-foreground font-bold' : ''
                  }`}
                >
                  <span>{bid.teamName}:</span>
                  <span className="font-extrabold">{formatMoney(bid.amount)}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

