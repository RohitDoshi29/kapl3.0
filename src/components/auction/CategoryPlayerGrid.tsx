import { PlayerRecord, Team, PlayerRole } from '@/lib/cricketTypes';
import { AUCTION_CATEGORIES } from '@/hooks/useAuction';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';

interface CategoryPlayerGridProps {
  players: PlayerRecord[];
  teams: Team[];
  selectedCategory: PlayerRole;
  selectedPlayerId?: string;
  onSelectCategory: (role: PlayerRole) => void;
  onSelectPlayer: (player: PlayerRecord) => void;
}

export function CategoryPlayerGrid({
  players,
  teams,
  selectedCategory,
  selectedPlayerId,
  onSelectCategory,
  onSelectPlayer,
}: CategoryPlayerGridProps) {
  const formatMoney = (val: number) => `₹${val.toLocaleString('en-IN')}`;

  const categoryPlayers = players.filter((p) => p.role === selectedCategory);

  return (
    <div className="space-y-4">
      {/* Category Selection Tabs / Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {AUCTION_CATEGORIES.map((cat) => {
          const catPlayers = players.filter((p) => p.role === cat.id);
          const soldCount = catPlayers.filter((p) => p.auctionStatus === 'sold').length;
          const isSelected = selectedCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-2 ring-primary shadow-md'
                  : 'border-muted bg-card hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-2xl">{cat.icon}</span>
                <Badge variant={isSelected ? 'default' : 'secondary'} className="text-[10px] font-bold">
                  {soldCount}/{catPlayers.length} Sold
                </Badge>
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">{cat.label}</h4>
                <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Players List in Selected Category */}
      <Card className="border shadow-sm rounded-2xl">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <span>{AUCTION_CATEGORIES.find((c) => c.id === selectedCategory)?.icon}</span>
            <span>{AUCTION_CATEGORIES.find((c) => c.id === selectedCategory)?.label} Pool</span>
            <Badge variant="outline" className="text-xs font-semibold">
              {categoryPlayers.length} Players
            </Badge>
          </CardTitle>
          <span className="text-xs text-muted-foreground">Click any player to put on hammer</span>
        </CardHeader>

        <CardContent className="p-4">
          {categoryPlayers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              No players found in this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {categoryPlayers.map((player) => {
                const isSelected = player.id === selectedPlayerId;
                const assignedTeam = teams.find((t) => t.id === player.teamId);
                const isSold = player.auctionStatus === 'sold';
                const isUnsold = player.auctionStatus === 'unsold';

                return (
                  <div
                    key={player.id}
                    onClick={() => onSelectPlayer(player)}
                    className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/60 bg-primary/5 shadow-md'
                        : isSold
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isUnsold
                        ? 'border-destructive/30 bg-destructive/5 opacity-75'
                        : 'border-muted bg-card hover:border-primary/40 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-11 h-11 border shrink-0">
                        <AvatarImage src={player.photoUrl || undefined} alt={player.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                          {player.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <span className="font-bold text-sm text-foreground block truncate">
                          {player.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground block truncate">
                          {player.battingStyle || player.bowlingStyle || 'All-Rounder'} • Base:{' '}
                          {formatMoney(player.basePrice)}
                        </span>
                        {isSold && assignedTeam && (
                          <span className="text-[11px] text-emerald-500 font-bold block truncate">
                            Sold: {assignedTeam.name} ({formatMoney(player.soldPrice || player.basePrice)})
                          </span>
                        )}
                        {isUnsold && (
                          <span className="text-[11px] text-destructive font-semibold block">
                            Unsold
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isSold ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : isUnsold ? (
                        <XCircle className="w-5 h-5 text-destructive" />
                      ) : isSelected ? (
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                          ACTIVE
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          PENDING
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

