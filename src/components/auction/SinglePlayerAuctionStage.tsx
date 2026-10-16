import { useState, useEffect } from 'react';
import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import {
  Gavel,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  TrendingUp,
  Wallet,
  RotateCcw,
  User,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface SinglePlayerAuctionStageProps {
  player: PlayerRecord | null;
  teams: Team[];
  isAdmin: boolean;
  onNext: () => void;
  onPrev: () => void;
  onDecideSold: (playerId: string, teamId: string, amount: number) => void;
  onDecideUnsold: (playerId: string) => void;
  onRevert: (playerId: string) => void;
}

export function SinglePlayerAuctionStage({
  player,
  teams,
  isAdmin,
  onNext,
  onPrev,
  onDecideSold,
  onDecideUnsold,
  onRevert,
}: SinglePlayerAuctionStageProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [soldAmount, setSoldAmount] = useState<number>(100);

  // Sync price when player changes
  useEffect(() => {
    if (player) {
      setSoldAmount(player.soldPrice || player.basePrice);
      if (player.teamId) {
        setSelectedTeamId(player.teamId);
      } else if (teams.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teams[0].id);
      }
    }
  }, [player, teams]);

  if (!player) {
    return (
      <Card className="p-8 text-center border-dashed border-2 rounded-3xl bg-card/60">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-1">No Player Selected</h3>
        <p className="text-muted-foreground text-xs">
          Select a player from the categories below to start the spotlight auction.
        </p>
      </Card>
    );
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];
  const assignedTeam = teams.find((t) => t.id === player.teamId);
  const isSold = player.auctionStatus === 'sold';
  const isUnsold = player.auctionStatus === 'unsold';

  const formatMoney = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const getRoleBadge = (role: PlayerRole) => {
    switch (role) {
      case 'all_rounder':
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 font-bold">👑 ALL-ROUNDER</Badge>;
      case 'batter':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 font-bold">🏏 BATTER</Badge>;
      case 'bowler':
        return <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 font-bold">⚡ BOWLER</Badge>;
      case 'wicket_keeper':
        return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 font-bold">🧤 WICKET-KEEPER</Badge>;
    }
  };

  const handleConfirmSale = () => {
    if (!selectedTeamId) {
      toast.error('Please select a team for this player');
      return;
    }
    if (soldAmount < player.basePrice) {
      toast.error(`Sold amount cannot be less than base price (${formatMoney(player.basePrice)})`);
      return;
    }
    onDecideSold(player.id, selectedTeamId, soldAmount);
  };

  return (
    <div className="space-y-4">
      {/* Top Navigation between players */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-2.5 px-4 shadow-sm">
        <Button variant="ghost" size="sm" onClick={onPrev} className="gap-1 text-xs font-semibold">
          <ChevronLeft className="w-4 h-4" /> Previous Player
        </Button>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Single Player Spotlight
        </span>
        <Button variant="ghost" size="sm" onClick={onNext} className="gap-1 text-xs font-semibold">
          Next Player <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Single Player Spotlight Card */}
      <Card className="relative overflow-hidden border-2 border-primary/30 rounded-3xl shadow-xl bg-gradient-to-b from-card via-card to-muted/20">
        {/* SOLD Celebratory Ribbon */}
        {isSold && assignedTeam && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white p-3 text-center font-black tracking-wide text-sm md:text-base flex items-center justify-center gap-2 shadow-md">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            SOLD TO {assignedTeam.name.toUpperCase()} FOR {formatMoney(player.soldPrice || player.basePrice)}!
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
        )}

        {/* UNSOLD Ribbon */}
        {isUnsold && (
          <div className="bg-destructive text-destructive-foreground p-2.5 text-center font-bold tracking-wide text-xs md:text-sm">
            ❌ PLAYER MARKED UNSOLD
          </div>
        )}

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Player Profile & Bio (Left) */}
            <div className="lg:col-span-5 flex flex-col items-center text-center space-y-4 border-b lg:border-b-0 lg:border-r pb-6 lg:pb-0 lg:pr-6">
              <div className="relative">
                <Avatar className="w-36 h-36 md:w-48 md:h-48 border-4 border-primary/30 shadow-2xl rounded-full">
                  <AvatarImage src={player.photoUrl || undefined} alt={player.name} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl md:text-5xl font-black">
                    {player.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div>
                <div className="mb-2">{getRoleBadge(player.role)}</div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                  {player.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                  {player.battingStyle && (
                    <span className="bg-muted px-2.5 py-1 rounded-md font-medium">
                      🏏 {player.battingStyle}
                    </span>
                  )}
                  {player.bowlingStyle && (
                    <span className="bg-muted px-2.5 py-1 rounded-md font-medium">
                      ⚡ {player.bowlingStyle}
                    </span>
                  )}
                </div>
              </div>

              {/* Base Price Card */}
              <div className="w-full bg-muted/60 border rounded-2xl p-3 flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Base Price</span>
                  <span className="text-lg font-black text-foreground">{formatMoney(player.basePrice)}</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status</span>
                  <span className={`text-xs font-black uppercase ${isSold ? 'text-emerald-500' : isUnsold ? 'text-destructive' : 'text-amber-500'}`}>
                    {player.auctionStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Admin Decision Console (Right) */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <Gavel className="w-5 h-5 text-primary" />
                  Auction Decision Panel
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Decide whether {player.name} is SOLD or UNSOLD, choose the team, and specify the final amount.
                </p>
              </div>

              {isAdmin ? (
                <div className="space-y-5 bg-card/80 border rounded-2xl p-5 shadow-sm">
                  {/* Step 1: Select Team */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>1. Select Winning Team</span>
                      {selectedTeam && (
                        <span className="text-primary font-bold">
                          Purse Left: {formatMoney(selectedTeam.remainingPurse)}
                        </span>
                      )}
                    </Label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {teams.map((t) => {
                        const isSelected = t.id === selectedTeamId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTeamId(t.id)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-2 ring-primary text-primary font-bold shadow-sm'
                                : 'border-muted bg-popover hover:bg-muted text-foreground'
                            }`}
                          >
                            <span className="text-xs font-bold truncate max-w-full">{t.name}</span>
                            <span className="text-[10px] opacity-75 font-mono">{formatMoney(t.remainingPurse)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 2: Final Sold Price */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      2. Final Sold Amount
                    </Label>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          type="number"
                          value={soldAmount}
                          onChange={(e) => setSoldAmount(Number(e.target.value) || 0)}
                          className="pl-8 text-lg font-black tracking-tight h-12"
                          min={player.basePrice}
                          step={50}
                        />
                      </div>

                      {/* Quick Increments */}
                      <div className="flex gap-1">
                        {[50, 100, 250, 500].map((inc) => (
                          <Button
                            key={inc}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-12 px-2.5 font-bold text-xs"
                            onClick={() => setSoldAmount((prev) => prev + inc)}
                          >
                            +{inc}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Decision Action Buttons */}
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      size="lg"
                      className="h-14 font-black text-base gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                      onClick={handleConfirmSale}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      SOLD TO TEAM ({formatMoney(soldAmount)})
                    </Button>

                    <Button
                      type="button"
                      size="lg"
                      variant="destructive"
                      className="h-14 font-black text-base gap-2 shadow-lg shadow-destructive/20"
                      onClick={() => onDecideUnsold(player.id)}
                    >
                      <XCircle className="w-5 h-5" />
                      MARK UNSOLD
                    </Button>
                  </div>

                  {/* Revert / Reset Option if already auctioned */}
                  {(isSold || isUnsold) && (
                    <div className="pt-2 border-t flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onRevert(player.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Revert to Pending (Refund Team)
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                /* Spectator View of Decision */
                <div className="bg-muted/40 border rounded-2xl p-6 text-center space-y-3">
                  <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
                  <h4 className="font-bold text-foreground">Auctioneer Decision Pending</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    The tournament admin is currently conducting the live bidding and will finalize the team and price.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

