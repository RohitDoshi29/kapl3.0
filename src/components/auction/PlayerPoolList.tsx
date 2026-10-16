import { useState } from 'react';
import { PlayerRecord, Team } from '@/lib/cricketTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Gavel, CheckCircle2, XCircle, Clock, User } from 'lucide-react';

interface PlayerPoolListProps {
  players: PlayerRecord[];
  teams: Team[];
  isAdmin: boolean;
  onBringToHammer: (player: PlayerRecord) => void;
}

export function PlayerPoolList({ players, teams, isAdmin, onBringToHammer }: PlayerPoolListProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'sold' | 'unsold'>('all');
  const [search, setSearch] = useState('');

  const formatMoney = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const filteredPlayers = players.filter((player) => {
    const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    if (filter === 'all') return true;
    return player.auctionStatus === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sold':
        return (
          <Badge className="bg-emerald-600 text-white gap-1 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" /> SOLD
          </Badge>
        );
      case 'unsold':
        return (
          <Badge variant="destructive" className="gap-1 text-[10px] font-bold">
            <XCircle className="w-3 h-3" /> UNSOLD
          </Badge>
        );
      case 'bidding':
        return (
          <Badge className="bg-amber-500 text-white gap-1 text-[10px] font-bold animate-pulse">
            <Clock className="w-3 h-3" /> ON HAMMER
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-semibold">
            PENDING
          </Badge>
        );
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 border-b flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-bold">Player Auction Pool</CardTitle>
          <Badge variant="secondary" className="font-bold">
            {filteredPlayers.length} / {players.length} Players
          </Badge>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs font-medium">
            {(['all', 'pending', 'sold', 'unsold'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  filter === tab
                    ? 'bg-background text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {filteredPlayers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No players found matching your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredPlayers.map((player) => {
              const team = teams.find((t) => t.id === player.teamId);

              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-xl border bg-card/60 hover:bg-card hover:border-primary/40 transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-11 h-11 border">
                      <AvatarImage src={player.photoUrl || undefined} alt={player.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                        {player.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-foreground">{player.name}</span>
                        {getStatusBadge(player.auctionStatus)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        <span>Role: {player.role.replace('_', ' ')}</span> •{' '}
                        <span>Base: {formatMoney(player.basePrice)}</span>
                      </div>
                      {team && player.auctionStatus === 'sold' && (
                        <div className="text-[11px] text-emerald-500 font-semibold mt-0.5">
                          Sold to {team.name} for {formatMoney(player.soldPrice || player.basePrice)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Admin Action: Bring to Hammer */}
                  {isAdmin && player.auctionStatus !== 'sold' && player.auctionStatus !== 'bidding' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 h-8 text-xs font-semibold hover:border-primary hover:text-primary shrink-0"
                      onClick={() => onBringToHammer(player)}
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      Hammer
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

