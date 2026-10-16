import { useState, useEffect, useMemo } from 'react';
import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  Crown,
  Users,
  Shield,
  ArrowUpRight,
  Flame,
  Star,
  AlertCircle,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import { playAuctionGavel } from '@/lib/soundEffects';
import { triggerQuickBurst } from '@/lib/confetti';

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
  const { user } = useAuth();
  const cleanUserEmail = user?.email?.toLowerCase().trim();

  // Find user-owned franchise if the logged in user is a Team Owner
  const userOwnedTeam = useMemo(() => {
    if (!cleanUserEmail) return null;
    return teams.find((t) => t.ownerEmail && t.ownerEmail.toLowerCase().trim() === cleanUserEmail) || null;
  }, [teams, cleanUserEmail]);

  // Selected team for Admin decision
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  const [soldAmount, setSoldAmount] = useState<number>(100);

  // Selected team for Owner / Franchise Hub inspection
  const [activeOwnerTeamId, setActiveOwnerTeamId] = useState<string>(() => {
    return userOwnedTeam ? userOwnedTeam.id : teams[0]?.id || '';
  });

  // Keep activeOwnerTeamId synced if user owns a team
  useEffect(() => {
    if (userOwnedTeam) {
      setActiveOwnerTeamId(userOwnedTeam.id);
    } else if (teams.length > 0 && !activeOwnerTeamId) {
      setActiveOwnerTeamId(teams[0].id);
    }
  }, [userOwnedTeam, teams]);

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
  const inspectedTeam = teams.find((t) => t.id === activeOwnerTeamId) || userOwnedTeam || selectedTeam || teams[0];
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

  // Compute live wallet & squad statistics for inspected team
  const initialPurse = inspectedTeam.initialPurse || 10000;
  const remainingPurse = inspectedTeam.remainingPurse !== undefined && inspectedTeam.remainingPurse !== null ? inspectedTeam.remainingPurse : 10000;
  const spentPurse = Math.max(0, initialPurse - remainingPurse);
  const spentPercent = Math.min(100, Math.round((spentPurse / initialPurse) * 100));

  const maxSquadSize = inspectedTeam.maxSquadSize || 10;
  const currentSquadCount = inspectedTeam.players?.length || 0;
  const openSlots = Math.max(0, maxSquadSize - currentSquadCount);

  // Maximum safe bid reserving ₹100 for each other open slot
  const reserveForOtherSlots = Math.max(0, (openSlots - 1) * 100);
  const maxSafeBid = Math.max(0, remainingPurse - reserveForOtherSlots);

  // Squad role breakdown
  const squadPlayers = inspectedTeam.players || [];
  const battersCount = squadPlayers.filter((p: any) => p.role === 'batter').length;
  const bowlersCount = squadPlayers.filter((p: any) => p.role === 'bowler').length;
  const allRoundersCount = squadPlayers.filter((p: any) => p.role === 'all_rounder').length;
  const keepersCount = squadPlayers.filter((p: any) => p.role === 'wicket_keeper').length;

  // Affordability & Fit for current player
  const canAffordBase = remainingPurse >= player.basePrice;
  const isViewerTheOwner = Boolean(
    inspectedTeam.ownerEmail && cleanUserEmail && inspectedTeam.ownerEmail.toLowerCase().trim() === cleanUserEmail
  );

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

  // Owner Quick-Bid intent handler
  const handleOwnerExpressBid = (amount: number) => {
    playAuctionGavel();
    triggerQuickBurst();

    if (isAdmin) {
      setSelectedTeamId(inspectedTeam.id);
      setSoldAmount(amount);
      toast.success(`Set winning bid to ${formatMoney(amount)} for ${inspectedTeam.name}!`);
    } else {
      toast.success(`🔨 ${inspectedTeam.name} announced bid of ${formatMoney(amount)} for ${player.name}!`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation between players */}
      <div className="flex items-center justify-between bg-card border rounded-2xl p-2.5 px-4 shadow-sm">
        <Button variant="ghost" size="sm" onClick={onPrev} className="gap-1 text-xs font-semibold">
          <ChevronLeft className="w-4 h-4" /> Previous Player
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Spotlight Stage
          </span>
          {userOwnedTeam && (
            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold gap-1">
              <Crown className="w-3 h-3 text-amber-500" />
              Owner: {userOwnedTeam.name}
            </Badge>
          )}
        </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Player Profile & Bio (Left 5 cols) */}
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

              {/* Base Price & Status Badge */}
              <div className="w-full bg-muted/60 border rounded-2xl p-3.5 flex items-center justify-around text-center">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Base Price</span>
                  <span className="text-xl font-black text-foreground">{formatMoney(player.basePrice)}</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status</span>
                  <span className={`text-xs font-black uppercase ${isSold ? 'text-emerald-500' : isUnsold ? 'text-destructive' : 'text-amber-500'}`}>
                    {player.auctionStatus}
                  </span>
                </div>
              </div>

              {/* Quick Summary Pill */}
              <div className="w-full text-xs text-muted-foreground bg-card/80 p-3 rounded-xl border text-left space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span>Tournament:</span>
                  <span className="font-semibold text-foreground">KAPL Season 3.0</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Bidding Category:</span>
                  <span className="font-semibold text-primary capitalize">{player.role.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Right Side: Admin Decision Panel OR Team Owner Command Hub */}
            <div className="lg:col-span-7 space-y-6">
              {isAdmin ? (
                /* ADMIN DECISION CONSOLE */
                <div className="space-y-5 bg-card/80 border rounded-2xl p-5 shadow-sm">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                      <Gavel className="w-5 h-5 text-primary" />
                      Auctioneer Decision Console
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select winning franchise, specify sold price, and finalize player auction status.
                    </p>
                  </div>

                  {/* Step 1: Select Team */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>1. Select Winning Team</span>
                      {selectedTeam && (
                        <span className="text-primary font-bold">
                          Purse Left: {formatMoney(selectedTeam.remainingPurse ?? 10000)}
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
                            onClick={() => {
                              setSelectedTeamId(t.id);
                              setActiveOwnerTeamId(t.id);
                            }}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 ring-2 ring-primary text-primary font-bold shadow-sm'
                                : 'border-muted bg-popover hover:bg-muted text-foreground'
                            }`}
                          >
                            <span className="text-xs font-bold truncate max-w-full">{t.name}</span>
                            <span className="text-[10px] opacity-75 font-mono">
                              {formatMoney(t.remainingPurse ?? 10000)}
                            </span>
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
              ) : null}

              {/* TEAM OWNER COMMAND & LIVE WALLET HUB */}
              <div className="space-y-4 bg-gradient-to-br from-card via-card/95 to-primary/5 border-2 border-primary/20 rounded-2xl p-5 shadow-md">
                {/* Hub Header & Team Selector */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b">
                  <div className="flex items-center gap-3">
                    <TeamBadge team={inspectedTeam} size="md" showName={false} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-lg text-foreground">
                          {inspectedTeam.name}
                        </h4>
                        {isViewerTheOwner ? (
                          <Badge className="bg-amber-500 text-black font-black text-[10px] gap-1 shadow-xs">
                            <Crown className="w-3 h-3" /> YOUR FRANCHISE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold">
                            Group {inspectedTeam.group}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Owner: <span className="font-semibold text-foreground">{inspectedTeam.ownerName || 'Designated by Admin'}</span>
                        {inspectedTeam.captainName && ` • Captain: ${inspectedTeam.captainName}`}
                      </p>
                    </div>
                  </div>

                  {/* Switch Team to inspect (for non-owners or admin testing) */}
                  {!userOwnedTeam && teams.length > 1 && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-[11px] text-muted-foreground">Franchise:</span>
                      <select
                        value={activeOwnerTeamId}
                        onChange={(e) => setActiveOwnerTeamId(e.target.value)}
                        className="bg-muted text-xs font-bold rounded-lg px-2.5 py-1.5 border border-border"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Live Wallet & Financial Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Remaining Purse */}
                  <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 text-left space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-primary" />
                      Wallet Purse Left
                    </span>
                    <p className="font-mono font-black text-xl text-primary">
                      {formatMoney(remainingPurse)}
                    </p>
                    <span className="text-[10px] text-muted-foreground block">
                      Initial: {formatMoney(initialPurse)}
                    </span>
                  </div>

                  {/* Purse Spent & Budget Progress */}
                  <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 text-left space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                      <span>Purse Spent</span>
                      <span>{spentPercent}%</span>
                    </div>
                    <p className="font-mono font-black text-lg text-foreground">
                      {formatMoney(spentPurse)}
                    </p>
                    <Progress value={spentPercent} className="h-1.5" />
                  </div>

                  {/* Max Allowable Bid */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left space-y-1">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      Max Safe Bid
                    </span>
                    <p className="font-mono font-black text-xl text-amber-600 dark:text-amber-400">
                      {formatMoney(maxSafeBid)}
                    </p>
                    <span className="text-[10px] text-muted-foreground block">
                      Reserves ₹100/unfilled slot
                    </span>
                  </div>
                </div>

                {/* Squad Composition Breakdown */}
                <div className="p-3.5 rounded-xl bg-muted/40 border text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      Squad Quota: {currentSquadCount} / {maxSquadSize} Players
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {openSlots} Slots Open
                    </Badge>
                  </div>

                  {/* Role composition chips */}
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    <div className="p-1.5 rounded-lg bg-card border text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">🏏 Batters</span>
                      <span className="font-bold text-foreground">{battersCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card border text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">⚡ Bowlers</span>
                      <span className="font-bold text-foreground">{bowlersCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card border text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">👑 All-Round</span>
                      <span className="font-bold text-foreground">{allRoundersCount}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-card border text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">🧤 Keepers</span>
                      <span className="font-bold text-foreground">{keepersCount}</span>
                    </div>
                  </div>
                </div>

                {/* Spotlight Player Fit Analysis & Owner Bidding Controls */}
                <div className="p-4 rounded-xl bg-card border border-primary/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="font-bold text-foreground">
                        Spotlight Player Fit for {inspectedTeam.name}
                      </span>
                    </div>
                    {canAffordBase ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                        ✅ Within Purse
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] font-bold">
                        ⚠️ Exceeds Wallet Purse
                      </Badge>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {canAffordBase ? (
                      <>
                        {inspectedTeam.name} can bid up to <strong className="text-foreground">{formatMoney(maxSafeBid)}</strong> safely for <strong className="text-foreground">{player.name}</strong> while keeping guaranteed reserve funds for remaining squad slots.
                      </>
                    ) : (
                      <>
                        Current player base price ({formatMoney(player.basePrice)}) exceeds {inspectedTeam.name}'s remaining wallet purse ({formatMoney(remainingPurse)}).
                      </>
                    )}
                  </p>

                  {/* Owner Quick Bidding Buttons */}
                  <div className="pt-1 space-y-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                      Quick Bidding Action ({inspectedTeam.name})
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10 text-xs font-bold gap-1 border-primary/30 hover:bg-primary/10"
                        disabled={!canAffordBase}
                        onClick={() => handleOwnerExpressBid(player.basePrice)}
                      >
                        <Gavel className="w-3.5 h-3.5 text-primary" />
                        Base ({formatMoney(player.basePrice)})
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10 text-xs font-bold gap-1 border-primary/30 hover:bg-primary/10"
                        disabled={remainingPurse < player.basePrice + 50}
                        onClick={() => handleOwnerExpressBid(player.basePrice + 50)}
                      >
                        +₹50 ({formatMoney(player.basePrice + 50)})
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10 text-xs font-bold gap-1 border-primary/30 hover:bg-primary/10"
                        disabled={remainingPurse < player.basePrice + 100}
                        onClick={() => handleOwnerExpressBid(player.basePrice + 100)}
                      >
                        +₹100 ({formatMoney(player.basePrice + 100)})
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-10 text-xs font-bold gap-1"
                        disabled={remainingPurse < player.basePrice + 250}
                        onClick={() => handleOwnerExpressBid(player.basePrice + 250)}
                      >
                        +₹250 ({formatMoney(player.basePrice + 250)})
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Team's Recent Purchases in this Auction */}
                {squadPlayers.length > 0 && (
                  <div className="pt-2 border-t text-xs space-y-2">
                    <span className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                      <span>Players Acquired by {inspectedTeam.name} ({squadPlayers.length}):</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {squadPlayers.map((p: any, idx: number) => (
                        <span
                          key={p.id || idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-[11px] font-medium border"
                        >
                          <span className="font-bold text-foreground">{p.name}</span>
                          {p.soldPrice && (
                            <span className="text-[10px] text-primary font-mono">{formatMoney(p.soldPrice)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ALL FRANCHISES LIVE WALLET & SQUAD COMPARISON DECK */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            All Franchise Purses & Squad Status
          </h3>
          <span className="text-xs text-muted-foreground">
            Click any team to inspect their wallet & squad breakdown
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {teams.map((t) => {
            const isCurrentInspected = t.id === inspectedTeam.id;
            const isUserOwner = t.ownerEmail && cleanUserEmail && t.ownerEmail.toLowerCase().trim() === cleanUserEmail;
            const tRemaining = t.remainingPurse !== undefined && t.remainingPurse !== null ? t.remainingPurse : 10000;
            const tSquadCount = t.players?.length || 0;
            const tMaxSquad = t.maxSquadSize || 10;
            const tCanAfford = tRemaining >= player.basePrice;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveOwnerTeamId(t.id);
                  if (isAdmin) setSelectedTeamId(t.id);
                }}
                className={`relative flex flex-col p-3 rounded-2xl border text-left transition-all ${
                  isCurrentInspected
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/40 shadow-md'
                    : 'border-border bg-card hover:bg-muted/60'
                }`}
              >
                {/* User Owner Marker */}
                {isUserOwner && (
                  <Badge className="absolute -top-2 right-2 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0 shadow-xs">
                    MY FRANCHISE
                  </Badge>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <TeamBadge team={t} size="sm" showName={false} />
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs truncate text-foreground">{t.name}</h5>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {t.ownerName || 'No Owner'}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-border/50 text-xs">
                  <span className="font-mono font-black text-sm text-primary">
                    {formatMoney(tRemaining)}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {tSquadCount}/{tMaxSquad}
                  </span>
                </div>

                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className={`font-semibold ${tCanAfford ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                    {tCanAfford ? 'Can Bid' : 'Low Funds'}
                  </span>
                  <span className="text-muted-foreground">Grp {t.group}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
