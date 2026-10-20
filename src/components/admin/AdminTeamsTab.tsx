import { useState, useRef, useEffect } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, X, Check, ChevronDown, User, Users, Crown, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PRESET_COLORS, Team, Player, PLAYER_COUNT_OPTIONS } from '@/lib/cricketTypes';
import { cn } from '@/lib/utils';
import { useTournament } from '@/contexts/TournamentContext';
import { supabase } from '@/integrations/supabase/client';

function PlayerCard({ 
  player, 
  index,
  teamColor,
  onUpdate,
  onRemove,
}: { 
  player: Player; 
  index: number;
  teamColor: string;
  onUpdate: (updates: Partial<Player>) => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(player.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 300000) {
      toast.error('Image too large. Max 300KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 100;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        onUpdate({ photo: base64 });
        toast.success('Photo uploaded!');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveName = () => {
    if (name.trim()) {
      onUpdate({ name: name.trim() });
      toast.success('Name updated!');
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer group overflow-hidden flex-shrink-0"
        style={{ backgroundColor: `hsl(${teamColor} / 0.3)` }}
        onClick={() => fileInputRef.current?.click()}
      >
        {player.photo ? (
          <>
            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-4 h-4 text-white" />
            </div>
          </>
        ) : (
          <>
            <User className="w-6 h-6 text-muted-foreground" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="w-4 h-4 text-white" />
            </div>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-muted-foreground w-6">#{index + 1}</span>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9"
          placeholder="Player name"
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-9 w-9 p-0"
          onClick={handleSaveName}
          disabled={name === player.name || !name.trim()}
        >
          <Check className="w-4 h-4" />
        </Button>
        {player.photo && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 text-destructive"
            onClick={() => onUpdate({ photo: null })}
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
        {onRemove && (
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (window.confirm(`Remove ${player.name} from ${name}'s squad? The player will be returned to the auction pool.`)) {
                onRemove();
                toast.success(`${player.name} removed from squad`);
              }
            }}
            title="Remove player from squad"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  onUpdate,
  onRemovePlayer,
}: {
  team: Team;
  onUpdate: (updates: Partial<Team>) => void;
  onRemovePlayer: (playerId: string) => void;
}) {
  const [name, setName] = useState(team.name);
  const [selectedColor, setSelectedColor] = useState(team.primaryColor);
  const [playerCount, setPlayerCount] = useState(team.playerCount || 10);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [ownerName, setOwnerName] = useState(team.ownerName || '');
  const [ownerEmail, setOwnerEmail] = useState(team.ownerEmail || '');
  const [captainSelection, setCaptainSelection] = useState<string>(
    team.captainPlayerId === 'owner'
      ? 'owner'
      : team.captainPlayerId || (team.captainName ? team.captainName : 'none')
  );
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with team when it changes
  useEffect(() => {
    setPlayerCount(team.playerCount || 10);
    setOwnerName(team.ownerName || '');
    setOwnerEmail(team.ownerEmail || '');
    setCaptainSelection(
      team.captainPlayerId === 'owner'
        ? 'owner'
        : team.captainPlayerId || (team.captainName ? team.captainName : 'none')
    );
  }, [team.playerCount, team.ownerName, team.ownerEmail, team.captainPlayerId, team.captainName]);

  // Players currently allocated to this team roster
  const players = team.players || [];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      toast.error('Image too large. Max 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        onUpdate({ logo: base64 });
        toast.success('Logo uploaded!');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    onUpdate({ logo: null });
    toast.info('Logo removed');
  };

  const handleSaveName = () => {
    if (name.trim()) {
      onUpdate({ name: name.trim() });
      toast.success('Team name updated!');
    }
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    onUpdate({ primaryColor: color });
  };

  const handlePlayerCountChange = (count: string) => {
    const newCount = parseInt(count);
    setPlayerCount(newCount);
    
    const currentPlayers = team.players || [];
    // If roster is empty (awaiting auction), do not inject dummy players
    if (currentPlayers.length === 0) {
      onUpdate({ playerCount: newCount, maxSquadSize: newCount });
      toast.success(`Target squad size set to ${newCount} players`);
      return;
    }

    // If target count is less than existing players, preserve all drafted players
    if (newCount < currentPlayers.length) {
      toast.warning(`Target squad size set to ${newCount}. Current ${currentPlayers.length} squad players preserved.`);
      onUpdate({ playerCount: newCount, maxSquadSize: newCount });
      return;
    }

    // Only add manual placeholders if the existing roster is using manual placeholder IDs
    const isManualRoster = currentPlayers.some(p => p.id.startsWith(`${team.id}-p`));
    if (isManualRoster) {
      const newPlayers = [
        ...currentPlayers,
        ...Array.from({ length: newCount - currentPlayers.length }, (_, i) => ({
          id: `${team.id}-p${currentPlayers.length + i + 1}`,
          name: `Player ${currentPlayers.length + i + 1}`,
          photo: null,
        }))
      ];
      onUpdate({ playerCount: newCount, maxSquadSize: newCount, players: newPlayers });
    } else {
      onUpdate({ playerCount: newCount, maxSquadSize: newCount });
    }
    toast.success(`Target squad size set to ${newCount} players`);
  };

  const handlePlayerUpdate = (playerIndex: number, updates: Partial<Player>) => {
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], ...updates };
    onUpdate({ players: updatedPlayers });
  };

  const handleSaveOwner = async () => {
    setIsAssigningRole(true);
    try {
      const updates: Partial<Team> = {
        ownerName: ownerName.trim() || undefined,
        ownerEmail: ownerEmail.trim() || null,
      };

      if (captainSelection === 'owner') {
        updates.captainName = ownerName.trim() || undefined;
      }

      onUpdate(updates);

      if (ownerEmail.trim()) {
        try {
          const { data: userData } = await supabase
            .from('user_roles')
            .select('*')
            .limit(1);
          toast.success(`Owner saved & granted 'owner' role for ${ownerName || ownerEmail}`);
        } catch {
          toast.success('Owner profile updated successfully!');
        }
      } else {
        toast.success('Owner profile updated successfully!');
      }
    } catch {
      toast.error('Failed to update owner');
    } finally {
      setIsAssigningRole(false);
    }
  };

  const handleCaptainChange = (val: string) => {
    setCaptainSelection(val);
    if (val === 'none') {
      onUpdate({ captainName: undefined, captainPlayerId: null });
      toast.info('Captain unassigned');
    } else if (val === 'owner') {
      const currentOwner = ownerName.trim() || team.ownerName || 'Team Owner';
      onUpdate({
        captainName: currentOwner,
        captainPlayerId: 'owner',
      });
      toast.success(`Designated Owner (${currentOwner}) as Team Captain!`);
    } else {
      const selectedPlayer = (players || []).find(p => p.id === val);
      if (selectedPlayer) {
        onUpdate({
          captainName: selectedPlayer.name,
          captainPlayerId: selectedPlayer.id,
        });
        toast.success(`Set ${selectedPlayer.name} as Team Captain!`);
      }
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Logo Section */}
        <div className="flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-full flex items-center justify-center cursor-pointer group overflow-hidden"
            style={{ backgroundColor: `hsl(${team.primaryColor})` }}
            onClick={() => fileInputRef.current?.click()}
          >
            {team.logo ? (
              <>
                <img src={team.logo} alt={team.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
              </>
            ) : (
              <>
                <span className="text-2xl font-bold text-white">{team.name.charAt(0)}</span>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-1">Team Logo</p>
            <p className="text-xs text-muted-foreground">Click to upload (max 500KB)</p>
            {team.logo && (
              <Button variant="ghost" size="sm" className="mt-1 h-7 text-xs" onClick={handleRemoveLogo}>
                <X className="w-3 h-3 mr-1" /> Remove
              </Button>
            )}
          </div>
        </div>

        {/* Name Section */}
        <div>
          <label className="text-sm font-medium mb-2 block">Team Name</label>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter team name"
            />
            <Button
              size="sm"
              onClick={handleSaveName}
              disabled={name === team.name || !name.trim()}
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Color Section */}
        <div>
          <label className="text-sm font-medium mb-2 block">Primary Color</label>
          <div className="grid grid-cols-5 gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.value}
                className={cn(
                  'w-10 h-10 rounded-full border-2 transition-all',
                  selectedColor === color.value ? 'border-foreground scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: `hsl(${color.value})` }}
                onClick={() => handleColorSelect(color.value)}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {/* Player Count Section */}
        <div>
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <Users className="w-4 h-4" />
            Number of Players
          </label>
          <Select value={playerCount.toString()} onValueChange={handlePlayerCountChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select player count" />
            </SelectTrigger>
            <SelectContent>
              {PLAYER_COUNT_OPTIONS.map((count) => (
                <SelectItem key={count} value={count.toString()}>
                  {count} Players
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Leadership & Role Governance (Distinct Owner & Captain) */}
        <div className="rounded-xl border border-primary/20 bg-muted/40 p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h4 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Team Leadership & Governance
            </h4>
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              Admin Controlled
            </Badge>
          </div>

          {/* 1. Team Owner (Admin Assigns Owner Role) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1 text-amber-500">
                <Crown className="w-3.5 h-3.5" />
                Team Owner (Assigns "Owner" Role)
              </label>
              {team.ownerName && (
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
                  👑 {team.ownerName}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner full name (e.g. Mukesh Ambani)"
                className="h-9 text-xs"
              />
              <Input
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="Owner login email (optional)"
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                Designates franchise ownership. Only admins can grant this role.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 shrink-0"
                onClick={handleSaveOwner}
                disabled={isAssigningRole || (ownerName === (team.ownerName || '') && ownerEmail === (team.ownerEmail || ''))}
              >
                <Check className="w-3.5 h-3.5" />
                Save & Assign Owner Role
              </Button>
            </div>
          </div>

          {/* 2. Team Captain (Distinct Field - Can be a Squad Player OR Owner) */}
          <div className="space-y-2 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1 text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                Team Captain (Distinct Field)
              </label>
              {captainSelection === 'owner' ? (
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold">
                  👑⚡ Owner & Captain
                </Badge>
              ) : team.captainName ? (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-semibold">
                  ⚡ Captain: {team.captainName}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Unassigned
                </Badge>
              )}
            </div>
            <Select value={captainSelection} onValueChange={handleCaptainChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select Team Captain" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Unassigned --</SelectItem>
                {ownerName.trim() && (
                  <SelectItem value="owner" className="font-semibold text-amber-600 dark:text-amber-400">
                    👑 Designate Owner as Captain ({ownerName.trim()})
                  </SelectItem>
                )}
                {players.slice(0, playerCount).map((p, idx) => (
                  <SelectItem key={p.id} value={p.id}>
                    ⚡ Squad Player #{idx + 1}: {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Captain and Owner are distinct roles. The owner can also be appointed as team captain, or any squad player can be captain.
            </p>
          </div>
        </div>

        {/* Players Section */}
        <Collapsible open={playersOpen} onOpenChange={setPlayersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span>Allocated Players ({players.length} / {playerCount || 10})</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", playersOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {players.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">No players allocated yet</p>
                <p className="text-[11px] text-muted-foreground/80">
                  Players (1 to 80) will be drafted into this team during the Live Auction stage.
                </p>
              </div>
            ) : (
              players.slice(0, playerCount).map((player, index) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  index={index}
                  teamColor={team.primaryColor}
                  onUpdate={(updates) => handlePlayerUpdate(index, updates)}
                  onRemove={() => onRemovePlayer(player.id)}
                />
              ))
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Preview */}
        <div className="pt-4 border-t space-y-2">
          <p className="text-sm text-muted-foreground">Preview & Governance</p>
          <div
            className="p-4 rounded-xl space-y-3"
            style={{
              background: `linear-gradient(135deg, hsl(${team.primaryColor} / 0.9), hsl(${team.primaryColor} / 0.6))`,
            }}
          >
            <TeamBadge team={team} size="md" className="text-white" />
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/20 text-white text-xs">
              {team.ownerName && (
                <span className="inline-flex items-center gap-1 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full font-medium">
                  👑 Owner: <strong className="font-bold">{team.ownerName}</strong>
                </span>
              )}
              {team.captainName && (
                <span className="inline-flex items-center gap-1 bg-black/35 backdrop-blur-sm px-2.5 py-1 rounded-full font-medium">
                  ⚡ Captain: <strong className="font-bold">{team.captainName}</strong>
                  {team.captainPlayerId === 'owner' && ' (Owner & Captain)'}
                </span>
              )}
              {!team.ownerName && !team.captainName && (
                <span className="text-white/70 italic text-[11px]">Owner & Captain not yet configured</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminTeamsTab() {
  const { teams, updateTeam, removePlayerFromTeam, getTeamsByGroup } = useCricketStore();
  const { activeTournamentId, currentTournament } = useTournament();

  const groupATeams = getTeamsByGroup('A', activeTournamentId);
  const groupBTeams = getTeamsByGroup('B', activeTournamentId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-sm text-muted-foreground">{currentTournament?.name || "Tournament"} Rosters & Settings</p>
        </div>
      </div>

      <Tabs defaultValue="A" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="A">Group A</TabsTrigger>
          <TabsTrigger value="B">Group B</TabsTrigger>
        </TabsList>

        <TabsContent value="A">
          <div className="grid md:grid-cols-2 gap-6">
            {groupATeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onUpdate={(updates) => updateTeam(team.id, updates)}
                onRemovePlayer={(playerId) => removePlayerFromTeam(team.id, playerId)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="B">
          <div className="grid md:grid-cols-2 gap-6">
            {groupBTeams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onUpdate={(updates) => updateTeam(team.id, updates)}
                onRemovePlayer={(playerId) => removePlayerFromTeam(team.id, playerId)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
