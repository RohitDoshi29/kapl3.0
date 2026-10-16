import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserMinus, UserPlus } from 'lucide-react';
import { Team, Innings } from '@/lib/cricketTypes';

interface PlayerReplacementDialogProps {
  battingTeam: Team;
  bowlingTeam: Team;
  currentInnings: Innings;
  battingPlayingPlayers: string[];
  bowlingPlayingPlayers: string[];
  onReplace: (oldPlayerId: string, newPlayerId: string, teamId: string) => void;
}

export function PlayerReplacementDialog({
  battingTeam,
  bowlingTeam,
  currentInnings,
  battingPlayingPlayers,
  bowlingPlayingPlayers,
  onReplace,
}: PlayerReplacementDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<'batting' | 'bowling'>('batting');
  const [oldPlayerId, setOldPlayerId] = useState<string>('');
  const [newPlayerId, setNewPlayerId] = useState<string>('');

  const activeTeam = selectedTeam === 'batting' ? battingTeam : bowlingTeam;
  const playingPlayerIds = selectedTeam === 'batting' ? battingPlayingPlayers : bowlingPlayingPlayers;
  
  // Get the 7 playing players for the selected team
  const getPlayingPlayers = () => {
    if (playingPlayerIds.length === 0) return activeTeam.players; // Fallback
    return activeTeam.players.filter(p => playingPlayerIds.includes(p.id));
  };
  
  // Get players currently on field (batsmen or current bowler)
  const getActivePlayers = () => {
    const playing = getPlayingPlayers();
    if (selectedTeam === 'batting') {
      // Batsmen who are currently on field or have batted but not out
      return playing.filter(p => {
        const stats = currentInnings.batterStats[p.id];
        // Either on strike, non-striker, or has batted but not out
        return (
          p.id === currentInnings.currentBatsmanId ||
          p.id === currentInnings.nonStrikerBatsmanId ||
          (stats && !stats.isOut)
        );
      });
    } else {
      // Current bowler
      return playing.filter(p => p.id === currentInnings.currentBowlerId);
    }
  };

  // Get replacement options (players from the 7 who are not currently active)
  const getReplacementOptions = () => {
    const playing = getPlayingPlayers();
    const activePlayers = getActivePlayers();
    const activeIds = activePlayers.map(p => p.id);
    
    if (selectedTeam === 'batting') {
      // Players from the 7 who haven't batted yet or are out
      return playing.filter(p => {
        const stats = currentInnings.batterStats[p.id];
        const isActive = activeIds.includes(p.id);
        // Not active and either hasn't batted or is out
        return !isActive && (!stats || stats.isOut);
      });
    } else {
      // Any bowler from the 7 not currently bowling
      return playing.filter(p => 
        !activeIds.includes(p.id)
      );
    }
  };

  const handleReplace = () => {
    if (oldPlayerId && newPlayerId) {
      onReplace(oldPlayerId, newPlayerId, activeTeam.id);
      setOpen(false);
      setOldPlayerId('');
      setNewPlayerId('');
    }
  };

  const activePlayers = getActivePlayers();
  const replacementOptions = getReplacementOptions();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-12 gap-2">
          <UserMinus className="w-5 h-5" />
          Replace Player (Retired/Injured)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace Player</DialogTitle>
          <DialogDescription>
            Replace a player who has retired or is injured with another player from the playing 7.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Team Selection */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Select Team</label>
            <Select
              value={selectedTeam}
              onValueChange={(value: 'batting' | 'bowling') => {
                setSelectedTeam(value);
                setOldPlayerId('');
                setNewPlayerId('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="batting">
                  {battingTeam.name} (Batting)
                </SelectItem>
                <SelectItem value="bowling">
                  {bowlingTeam.name} (Bowling)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Player to Replace */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              Player to Replace
            </label>
            <Select value={oldPlayerId} onValueChange={setOldPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select player to replace" />
              </SelectTrigger>
              <SelectContent>
                {activePlayers.map((player) => {
                  const stats = selectedTeam === 'batting' 
                    ? currentInnings.batterStats[player.id]
                    : currentInnings.bowlerStats[player.id];
                  const isStriker = player.id === currentInnings.currentBatsmanId;
                  const isNonStriker = player.id === currentInnings.nonStrikerBatsmanId;
                  const isBowling = player.id === currentInnings.currentBowlerId;
                  
                  return (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                      {isStriker && ' (Striker)'}
                      {isNonStriker && ' (Non-striker)'}
                      {isBowling && ' (Bowling)'}
                      {stats && selectedTeam === 'batting' && ` - ${(stats as any).runs} runs`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Replacement Player */}
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">
              <UserPlus className="w-4 h-4 inline mr-1" />
              Replacement Player
            </label>
            <Select value={newPlayerId} onValueChange={setNewPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select replacement player" />
              </SelectTrigger>
              <SelectContent>
                {replacementOptions.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    No replacement players available
                  </div>
                ) : (
                  replacementOptions.map((player) => (
                    <SelectItem key={player.id} value={player.id}>
                      {player.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleReplace}
            disabled={!oldPlayerId || !newPlayerId || replacementOptions.length === 0}
          >
            Replace Player
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
