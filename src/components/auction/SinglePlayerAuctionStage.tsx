import { useState, useEffect, useMemo } from 'react';
import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Sparkles,
  Wallet,
  RotateCcw,
  User,
  Crown,
  Users,
  Clock,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { AuctionSaleLog } from '@/hooks/useAuction';

interface SinglePlayerAuctionStageProps {
  player: PlayerRecord | null;
  playerPool?: PlayerRecord[];
  teams: Team[];
  isAdmin: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSpotlightPlayer?: (player: PlayerRecord) => void;
  onDecideSold: (playerId: string, teamId: string, amount: number) => void;
  onDecideUnsold: (playerId: string) => void;
  onRevert: (playerId: string) => void;
  salesHistory?: AuctionSaleLog[];
}

export function SinglePlayerAuctionStage({
  player,
  playerPool = [],
  teams,
  isAdmin,
  onNext,
  onPrev,
  onSpotlightPlayer,
  onDecideSold,
  onDecideUnsold,
  onRevert,
  salesHistory = [],
}: SinglePlayerAuctionStageProps) {
  const { user } = useAuth();
  const cleanUserEmail = user?.email?.toLowerCase().trim();

  // Find user-owned franchise if logged in user is a Team Owner
  const userOwnedTeam = useMemo(() => {
    if (!cleanUserEmail) return null;
    return teams.find((t) => t.ownerEmail && t.ownerEmail.toLowerCase().trim() === cleanUserEmail) || null;
  }, [teams, cleanUserEmail]);

  // Selected team for Admin hammer decision
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

  // Sync sold amount when spotlight player changes
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

  const fallbackTeam: Team = {
    id: 'placeholder',
    name: 'Franchise Hub',
    group: 'A',
    logo: null,
    primaryColor: '0 84% 60%',
    players: [],
    playerCount: 0,
    initialPurse: 10000,
    remainingPurse: 10000,
    maxSquadSize: 10,
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0] || fallbackTeam;
  const inspectedTeam = teams.find((t) => t.id === activeOwnerTeamId) || userOwnedTeam || selectedTeam || teams[0] || fallbackTeam;
  const assignedTeam = teams.find((t) => t.id === player?.teamId);
  const isSold = player?.auctionStatus === 'sold';
  const isUnsold = player?.auctionStatus === 'unsold';

  const formatMoney = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const getRoleBadge = (role: PlayerRole) => {
    switch (role) {
      case 'all_rounder':
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">👑 ALL-ROUNDER</Badge>;
      case 'batter':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">🏏 BATTER</Badge>;
      case 'bowler':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">⚡ BOWLER</Badge>;
      case 'wicket_keeper':
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold">🧤 WICKET-KEEPER</Badge>;
    }
  };

  // Squad role breakdown for team analytics
  const squadPlayers = inspectedTeam?.players || [];
  const initialPurse = inspectedTeam?.initialPurse || 10000;
  const spentFromSquad = squadPlayers.reduce((acc: number, p: any) => acc + (Number(p.soldPrice) || 0), 0);
  const remainingPurse = inspectedTeam?.remainingPurse !== undefined && inspectedTeam?.remainingPurse !== null
    ? (squadPlayers.length === 0 ? initialPurse : inspectedTeam.remainingPurse)
    : Math.max(0, initialPurse - spentFromSquad);
  const spentPurse = Math.max(0, initialPurse - remainingPurse);
  const spentPercent = Math.min(100, Math.round((spentPurse / initialPurse) * 100));

  const maxSquadSize = inspectedTeam?.maxSquadSize || 10;
  const currentSquadCount = squadPlayers.length;
  const openSlots = Math.max(0, maxSquadSize - currentSquadCount);

  const battersCount = squadPlayers.filter((p: any) => p.role === 'batter').length;
  const bowlersCount = squadPlayers.filter((p: any) => p.role === 'bowler').length;
  const allRoundersCount = squadPlayers.filter((p: any) => p.role === 'all_rounder').length;
  const keepersCount = squadPlayers.filter((p: any) => p.role === 'wicket_keeper').length;

  const isViewerTheOwner = Boolean(
    inspectedTeam?.ownerEmail && cleanUserEmail && inspectedTeam.ownerEmail.toLowerCase().trim() === cleanUserEmail
  );

  // Upcoming candidates in queue (who are coming next)
  const upcomingCandidates = useMemo(() => {
    if (!playerPool || playerPool.length === 0) return [];
    return playerPool
      .filter((p) => p.auctionStatus === 'pending' && p.id !== player?.id)
      .slice(0, 5);
  }, [playerPool, player?.id]);

  const handleConfirmSale = () => {
    if (!player) return;
    if (!selectedTeamId) {
      toast.error('Please select a winning franchise for this candidate');
      return;
    }
    if (soldAmount < player.basePrice) {
      toast.error(`Sold amount cannot be less than base price (${formatMoney(player.basePrice)})`);
      return;
    }
    onDecideSold(player.id, selectedTeamId, soldAmount);
  };

  if (!player) {
    return (
      <Card className="p-8 text-center border-dashed border-2 rounded-3xl bg-card/60">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-1">No Player Selected</h3>
        <p className="text-muted-foreground text-xs">
          Select any candidate from the queue below to start the spotlight auction.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. TOP STAGE BAR */}
      <div className="flex items-center justify-between bg-card/85 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 px-4 shadow-sm">
        <Button variant="ghost" size="sm" onClick={onPrev} className="gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4" /> Previous Candidate
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">
            Spotlight Podium
          </span>
          {userOwnedTeam && (
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black gap-1">
              <Crown className="w-3 h-3 text-amber-400" />
              My Franchise: {userOwnedTeam.name} (Purse: {formatMoney(userOwnedTeam.remainingPurse ?? 10000)})
            </Badge>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={onNext} className="gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Next Candidate <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* 2. MAIN SINGLE PLAYER SPOTLIGHT CARD */}
      <Card className="relative overflow-hidden border-2 border-amber-500/30 rounded-3xl shadow-2xl bg-gradient-to-b from-card via-card to-amber-950/10">
        {/* SOLD Celebratory Banner */}
        {isSold && assignedTeam && (
          <div className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 text-white p-3 text-center font-black tracking-wide text-sm md:text-base flex items-center justify-center gap-2 shadow-md">
            <Sparkles className="w-4 h-4 text-yellow-300" />
            SOLD TO {assignedTeam.name.toUpperCase()} FOR {formatMoney(player.soldPrice || player.basePrice)}!
            <Sparkles className="w-4 h-4 text-yellow-300" />
          </div>
        )}

        {/* UNSOLD Banner */}
        {isUnsold && (
          <div className="bg-destructive text-destructive-foreground p-2.5 text-center font-black tracking-wide text-xs md:text-sm">
            ❌ PLAYER MARKED UNSOLD
          </div>
        )}

        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Player Profile & Base Value (Left 5 cols) */}
            <div className="lg:col-span-5 flex flex-col items-center text-center space-y-4 border-b lg:border-b-0 lg:border-r border-white/10 pb-6 lg:pb-0 lg:pr-6">
              <div className="relative">
                <Avatar className="w-36 h-36 md:w-44 md:h-44 border-4 border-amber-500/30 shadow-2xl rounded-full">
                  <AvatarImage src={player.photoUrl || undefined} alt={player.name} className="object-cover" />
                  <AvatarFallback className="bg-amber-500/10 text-amber-400 text-4xl md:text-5xl font-black">
                    {player.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {player.jerseyNumber && (
                  <Badge className="absolute bottom-1 right-2 bg-slate-950 border border-amber-400 text-amber-300 font-mono text-xs font-black px-2 py-0.5 rounded-full">
                    #{player.jerseyNumber}
                  </Badge>
                )}
              </div>

              <div>
                <div className="mb-2">{getRoleBadge(player.role)}</div>
                <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                  {player.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground mt-2">
                  {player.battingStyle && (
                    <span className="bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-md font-medium">
                      🏏 {player.battingStyle}
                    </span>
                  )}
                  {player.bowlingStyle && (
                    <span className="bg-white/[0.04] border border-white/10 px-2.5 py-1 rounded-md font-medium">
                      ⚡ {player.bowlingStyle}
                    </span>
                  )}
                </div>
              </div>

              {/* BASE VALUE / PRICE PROMINENT DISPLAY */}
              <div className="w-full bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex items-center justify-around text-center shadow-inner">
                <div>
                  <span className="text-[10px] text-amber-400/90 uppercase font-bold tracking-wider block">
                    Current Player Base Value
                  </span>
                  <span className="text-2xl md:text-3xl font-black text-amber-400 font-mono">
                    {formatMoney(player.basePrice)}
                  </span>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                    Auction Status
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-wider ${
                      isSold ? 'text-emerald-400' : isUnsold ? 'text-destructive' : 'text-amber-400'
                    }`}
                  >
                    {player.auctionStatus}
                  </span>
                </div>
              </div>

              {/* Tournament Meta Pill */}
              <div className="w-full text-xs text-muted-foreground bg-white/[0.02] p-3 rounded-xl border border-white/5 text-left space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span>Tournament League:</span>
                  <span className="font-semibold text-foreground">KAPL Season 3.0</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Candidate Pool:</span>
                  <span className="font-semibold text-amber-400 capitalize">{player.role.replace('_', ' ')} (80 Roster)</span>
                </div>
              </div>
            </div>

            {/* Right Side: Admin Decision Panel (Admin Only) + Franchise Status & Analytics Hub (Owner + Admin) */}
            <div className="lg:col-span-7 space-y-6">
              {/* ADMIN DECISION CONSOLE (Only Visible to Admin) */}
              {isAdmin && (
                <div className="space-y-4 bg-card/90 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
                  <div>
                    <h3 className="text-lg font-black flex items-center gap-2 text-foreground">
                      <Gavel className="w-5 h-5 text-amber-400" />
                      Auctioneer Decision Console
                      <Badge className="bg-amber-500/20 text-amber-400 text-[10px] font-black">
                        Admin Only
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Award the player to the winning franchise or pass as unsold. Real-time syncs to all devices.
                    </p>
                  </div>

                  {/* Step 1: Select Winning Team */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                      <span>1. Select Winning Team</span>
                      {selectedTeam && (
                        <span className="text-amber-400 font-bold font-mono">
                          Purse: {formatMoney(selectedTeam.remainingPurse ?? 10000)} • Squad: {selectedTeam.players?.length || 0}/10
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
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                              isSelected
                                ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400 text-amber-300 font-bold shadow-sm'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-foreground'
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
                          className="pl-8 text-lg font-black tracking-tight h-11 bg-white/[0.03] border-white/10 rounded-xl"
                          min={player.basePrice}
                          step={50}
                        />
                      </div>

                      {/* Quick Increments */}
                      <div className="flex gap-1">
                        {[50, 100, 250, 500, 1000].map((inc) => (
                          <Button
                            key={inc}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-11 px-2.5 font-bold text-xs rounded-xl"
                            onClick={() => setSoldAmount((prev) => prev + inc)}
                          >
                            +{inc}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Hammer Actions */}
                  <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      type="button"
                      size="lg"
                      className="h-12 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm gap-2 rounded-xl shadow-lg"
                      onClick={handleConfirmSale}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Hammer SOLD to {selectedTeam?.name} ({formatMoney(soldAmount)})
                    </Button>

                    <Button
                      type="button"
                      size="lg"
                      variant="destructive"
                      className="h-12 font-black text-sm gap-2 rounded-xl"
                      onClick={() => onDecideUnsold(player.id)}
                    >
                      <XCircle className="w-5 h-5" />
                      Mark UNSOLD
                    </Button>
                  </div>

                  {/* Revert Option */}
                  {(isSold || isUnsold) && (
                    <div className="pt-2 border-t border-white/10 flex justify-end">
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
              )}

              {/* OWNER FRANCHISE COMMAND & LIVE ANALYTICS HUB (Display & Analytics Only - NO BIDDING) */}
              <div className="space-y-4 bg-gradient-to-br from-card via-card/95 to-amber-950/10 border border-white/10 rounded-2xl p-5 shadow-md">
                {/* Hub Header & Franchise Selector */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <TeamBadge team={inspectedTeam} size="md" showName={false} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-lg text-foreground">
                          {inspectedTeam.name}
                        </h4>
                        {isViewerTheOwner ? (
                          <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] gap-1 shadow-xs">
                            <Crown className="w-3 h-3" /> YOUR FRANCHISE
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-semibold border-white/20">
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

                  {/* Switch Team to inspect */}
                  {teams.length > 1 && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <span className="text-[11px] text-muted-foreground">Inspect:</span>
                      <select
                        value={activeOwnerTeamId}
                        onChange={(e) => setActiveOwnerTeamId(e.target.value)}
                        className="bg-white/[0.04] text-xs font-bold rounded-lg px-2.5 py-1.5 border border-white/10 text-foreground"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id} className="bg-slate-900 text-foreground">
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 1. Live Wallet & Money Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Remaining Purse */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      Wallet Purse Left
                    </span>
                    <p className="font-mono font-black text-xl text-amber-400">
                      {formatMoney(remainingPurse)}
                    </p>
                    <span className="text-[10px] text-muted-foreground block">
                      Initial: {formatMoney(initialPurse)}
                    </span>
                  </div>

                  {/* Purse Spent */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                      <span>Purse Spent</span>
                      <span>{spentPercent}%</span>
                    </div>
                    <p className="font-mono font-black text-lg text-foreground">
                      {formatMoney(spentPurse)}
                    </p>
                    <Progress value={spentPercent} className="h-1.5" />
                  </div>

                  {/* Squad Count */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      Squad Quota
                    </span>
                    <p className="font-mono font-black text-xl text-foreground">
                      {currentSquadCount} / {maxSquadSize}
                    </p>
                    <span className="text-[10px] text-emerald-400 font-semibold block">
                      {openSlots} Slots Open
                    </span>
                  </div>
                </div>

                {/* 2. Team Analytics & Squad Composition Breakdown */}
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                      📊 Team Composition Analytics
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Target: Balance across Batters, Bowlers & All-rounders
                    </span>
                  </div>

                  {/* Role composition chips */}
                  <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">🏏 Batters</span>
                      <span className="font-black text-sm text-foreground">{battersCount}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">⚡ Bowlers</span>
                      <span className="font-black text-sm text-foreground">{bowlersCount}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">👑 All-Round</span>
                      <span className="font-black text-sm text-foreground">{allRoundersCount}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/5 text-[11px]">
                      <span className="text-muted-foreground block text-[10px]">🧤 Keepers</span>
                      <span className="font-black text-sm text-foreground">{keepersCount}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Players Acquired by this Franchise */}
                <div className="pt-2 border-t border-white/10 text-xs space-y-2">
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                    <span>Acquired Players ({squadPlayers.length}):</span>
                    <span className="text-[10px] text-muted-foreground">Signed from auction</span>
                  </span>
                  {squadPlayers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic text-center py-2 bg-white/[0.01] rounded-lg border border-dashed border-white/10">
                      No players drafted yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {squadPlayers.map((p: any, idx: number) => (
                        <span
                          key={p.id || idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] text-[11px] font-medium border border-white/10"
                        >
                          <span className="font-bold text-foreground">{p.name}</span>
                          {p.soldPrice && (
                            <span className="text-[10px] text-amber-400 font-mono font-bold">{formatMoney(p.soldPrice)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. UPCOMING CANDIDATES QUEUE (WHO ARE COMING NEXT) */}
      {upcomingCandidates.length > 0 && (
        <Card className="border border-white/10 bg-card/85 backdrop-blur-md p-4 rounded-3xl shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                On Deck • Next Up in Auction
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
                Next {upcomingCandidates.length} Pending
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              Upcoming candidates queued for the live hammer
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {upcomingCandidates.map((c, idx) => (
              <div
                key={c.id}
                className="p-3 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all flex flex-col justify-between space-y-2 relative"
              >
                <Badge
                  variant="outline"
                  className="absolute top-2 right-2 text-[9px] font-mono text-muted-foreground border-white/15 px-1.5 py-0"
                >
                  +{idx + 1}
                </Badge>

                <div className="flex items-center gap-2">
                  <Avatar className="w-9 h-9 border border-white/10">
                    <AvatarImage src={c.photoUrl || undefined} alt={c.name} />
                    <AvatarFallback className="bg-amber-500/10 text-amber-400 text-xs font-bold">
                      {c.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-foreground block truncate">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground capitalize block truncate">
                      {c.role.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                  <span className="text-muted-foreground text-[10px]">Base:</span>
                  <span className="font-mono font-black text-amber-400 text-xs">{formatMoney(c.basePrice)}</span>
                </div>

                {isAdmin && onSpotlightPlayer && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSpotlightPlayer(c)}
                    className="h-7 text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 p-0 w-full mt-1"
                  >
                    Spotlight Now
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. ALL FRANCHISE PURSES, QUOTAS & ACQUIRED PLAYERS (WHAT OTHER TEAMS HAVE & WHO WAS SOLD TO WHO) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-400" />
            All Franchise Purses, Quotas & Acquired Rosters
          </h3>
          <span className="text-xs text-muted-foreground">
            Click any team to inspect their wallet & squad breakdown
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {teams.map((t) => {
            const isCurrentInspected = t.id === inspectedTeam.id;
            const isUserOwner = Boolean(t.ownerEmail && cleanUserEmail && t.ownerEmail.toLowerCase().trim() === cleanUserEmail);
            const tSquadCount = t.players?.length || 0;
            const tRemaining = t.remainingPurse !== undefined && t.remainingPurse !== null
              ? (tSquadCount === 0 ? 10000 : t.remainingPurse)
              : 10000;
            const tMaxSquad = t.maxSquadSize || 10;
            const teamSquadList = t.players || [];

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveOwnerTeamId(t.id);
                  if (isAdmin) setSelectedTeamId(t.id);
                }}
                className={`relative flex flex-col p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                  isCurrentInspected
                    ? 'border-amber-400 bg-amber-500/15 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/15'
                    : 'border-white/[0.08] bg-card/85 backdrop-blur-md hover:bg-white/[0.06] hover:border-white/20'
                }`}
              >
                {/* User Owner Marker */}
                {isUserOwner && (
                  <Badge variant="gold" className="absolute -top-2.5 right-2 text-[9px] font-black px-2 py-0.5 tracking-wider">
                    👑 MY FRANCHISE
                  </Badge>
                )}

                <div className="flex items-center gap-2.5 mb-2">
                  <TeamBadge team={t} size="sm" showName={false} />
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs truncate text-foreground">{t.name}</h5>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      {t.ownerName ? `Owner: ${t.ownerName}` : 'No Owner'}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline justify-between pt-1 border-t border-white/5 text-xs">
                  <div>
                    <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Purse Left</span>
                    <span className="font-mono font-black text-sm text-amber-400">
                      {formatMoney(tRemaining)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-muted-foreground uppercase block font-semibold">Squad</span>
                    <span className="text-xs text-foreground font-black">
                      {tSquadCount} / {tMaxSquad}
                    </span>
                  </div>
                </div>

                {/* Acquired Players Summary */}
                <div className="mt-2 pt-2 border-t border-white/5 text-[10px]">
                  <span className="text-muted-foreground block mb-1">
                    Players Signed ({teamSquadList.length}):
                  </span>
                  {teamSquadList.length === 0 ? (
                    <span className="text-muted-foreground italic text-[10px]">None signed yet</span>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-12 overflow-hidden">
                      {teamSquadList.slice(0, 3).map((p: any, idx: number) => (
                        <span key={p.id || idx} className="bg-white/[0.04] px-1.5 py-0.5 rounded text-[10px] font-medium border border-white/5 truncate max-w-[120px]">
                          {p.name} ({formatMoney(p.soldPrice || 100)})
                        </span>
                      ))}
                      {teamSquadList.length > 3 && (
                        <span className="text-muted-foreground font-mono">+{teamSquadList.length - 3} more</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. REAL-TIME LIVE AUCTION SALES LEDGER */}
      {salesHistory.length > 0 && (
        <Card className="border border-white/10 bg-card/85 backdrop-blur-md p-4 rounded-3xl shadow-md">
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Live Auction Ledger • Completed Sales
            </span>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              ● Live Realtime Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {salesHistory.slice(0, 6).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl border border-white/5 bg-background/50 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-foreground block text-xs">{log.playerName}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">
                    {log.playerRole.replace('_', ' ')} • {log.status === 'sold' ? <strong className="text-foreground">{log.teamName}</strong> : 'Unsold'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-xs text-emerald-400 block">{formatMoney(log.amount)}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
