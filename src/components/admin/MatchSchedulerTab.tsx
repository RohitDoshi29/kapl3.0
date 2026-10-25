import { useState, useEffect } from 'react';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, Clock, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { MatchFixture, MATCH_TYPE_LABELS } from '@/lib/cricketTypes';
import { getStoredFixtures, saveStoredFixtures } from '@/lib/fixturesData';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface MatchSchedulerTabProps {}

export default function MatchSchedulerTab({}: MatchSchedulerTabProps) {
  const { activeTournamentId } = useTournament();
  const { getTeam } = useCricketStore(activeTournamentId);
  const [fixtures, setFixtures] = useState<MatchFixture[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFixture, setEditingFixture] = useState<MatchFixture | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    team1Id: '',
    team2Id: '',
    scheduledDate: '',
    scheduledTime: '',
    venue: '',
    group: '' as 'A' | 'B' | '',
    matchType: 'group' as 'group' | 'knockout',
    knockoutType: '' as 'semi_final_1' | 'semi_final_2' | 'final' | '',
  });

  // Load fixtures
  useEffect(() => {
    setFixtures(getStoredFixtures(activeTournamentId));
  }, [activeTournamentId]);

  const resetForm = () => {
    setFormData({
      team1Id: '',
      team2Id: '',
      scheduledDate: '',
      scheduledTime: '',
      venue: '',
      group: '',
      matchType: 'group',
      knockoutType: '',
    });
    setEditingFixture(null);
  };

  const handleSaveMatch = () => {
    if (!formData.team1Id || !formData.team2Id || !formData.scheduledDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.team1Id === formData.team2Id) {
      toast.error('Teams must be different');
      return;
    }

    if (formData.matchType === 'group' && !formData.group) {
      toast.error('Please select a group for group matches');
      return;
    }

    if (formData.matchType === 'knockout' && !formData.knockoutType) {
      toast.error('Please select knockout type');
      return;
    }

    try {
      let updatedFixtures: MatchFixture[];

      if (editingFixture) {
        updatedFixtures = fixtures.map((f) =>
          f.id === editingFixture.id
            ? {
                ...f,
                team1Id: formData.team1Id,
                team2Id: formData.team2Id,
                scheduledDate: formData.scheduledDate,
                scheduledTime: formData.scheduledTime,
                venue: formData.venue,
                group: formData.matchType === 'group' ? formData.group : undefined,
                knockoutType: formData.matchType === 'knockout' ? formData.knockoutType : undefined,
              }
            : f
        );
        toast.success('Match updated successfully');
        logger.info('Match updated', { matchId: editingFixture.id, team1Id: formData.team1Id, team2Id: formData.team2Id });
      } else {
        const newFixture: MatchFixture = {
          id: `match_${Date.now()}`,
          team1Id: formData.team1Id,
          team2Id: formData.team2Id,
          scheduledDate: formData.scheduledDate,
          scheduledTime: formData.scheduledTime,
          venue: formData.venue,
          status: 'scheduled',
          team1Score: undefined,
          team2Score: undefined,
          winner: undefined,
          matchType: formData.matchType,
          group: formData.matchType === 'group' ? formData.group : undefined,
          knockoutType: formData.matchType === 'knockout' ? formData.knockoutType : undefined,
        };
        updatedFixtures = [...fixtures, newFixture];
        toast.success('Match scheduled successfully');
        logger.info('Match scheduled', { team1Id: formData.team1Id, team2Id: formData.team2Id, date: formData.scheduledDate });
      }

      saveStoredFixtures(activeTournamentId, updatedFixtures);
      setFixtures(updatedFixtures);

      // Broadcast change to all pages
      window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
        detail: { tournamentId: activeTournamentId, fixtures: updatedFixtures }
      }));

      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to save match');
      logger.error('Failed to save match', error);
    }
  };

  const handleEditMatch = (fixture: MatchFixture) => {
    setEditingFixture(fixture);
    setFormData({
      team1Id: fixture.team1Id,
      team2Id: fixture.team2Id,
      scheduledDate: fixture.scheduledDate || '',
      scheduledTime: fixture.scheduledTime || '',
      venue: fixture.venue || '',
      group: fixture.group || '',
      matchType: fixture.matchType || 'group',
      knockoutType: fixture.knockoutType || '',
    });
    setIsDialogOpen(true);
  };

  const handleDeleteMatch = (fixtureId: string) => {
    try {
      const updatedFixtures = fixtures.filter((f) => f.id !== fixtureId);
      saveStoredFixtures(activeTournamentId, updatedFixtures);
      setFixtures(updatedFixtures);

      // Broadcast change to all pages
      window.dispatchEvent(new CustomEvent('kapl-fixtures-updated', {
        detail: { tournamentId: activeTournamentId, fixtures: updatedFixtures }
      }));

      toast.success('Match deleted');
      logger.info('Match deleted', { matchId: fixtureId });
    } catch (error) {
      toast.error('Failed to delete match');
      logger.error('Failed to delete match', error);
    }
  };

  const getMatchTypeLabel = (fixture: MatchFixture) => {
    if (fixture.matchType === 'group' && fixture.group) {
      return `Group ${fixture.group}`;
    }
    if (fixture.knockoutType) {
      return MATCH_TYPE_LABELS[fixture.knockoutType] || fixture.knockoutType;
    }
    return 'Unknown';
  };

  const sortedFixtures = [...fixtures].sort((a, b) => {
    const dateA = new Date(`${a.scheduledDate}T${a.scheduledTime || '00:00'}`).getTime();
    const dateB = new Date(`${b.scheduledDate}T${b.scheduledTime || '00:00'}`).getTime();
    return dateA - dateB;
  });

  return (
    <div className="space-y-6">
      <Card className="border border-white/10 bg-white/[0.04]">
        <CardHeader className="border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-black">
                <Calendar className="w-5 h-5 text-amber-400" />
                Match Scheduler
              </CardTitle>
              <CardDescription>Create and manage tournament match schedules</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={() => {
                    resetForm();
                    setIsDialogOpen(true);
                  }}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600"
                >
                  <Plus className="w-4 h-4" />
                  Schedule Match
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingFixture ? 'Edit Match' : 'Schedule New Match'}</DialogTitle>
                  <DialogDescription>
                    {editingFixture ? 'Update match details' : 'Create a new tournament match'}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  {/* Match Type Selection */}
                  <div>
                    <Label className="text-sm font-bold">Match Type</Label>
                    <Select
                      value={formData.matchType}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, matchType: value as 'group' | 'knockout' }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="group">Group Match</SelectItem>
                        <SelectItem value="knockout">Knockout Match</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Group Selection (for group matches) */}
                  {formData.matchType === 'group' && (
                    <div>
                      <Label className="text-sm font-bold">Group</Label>
                      <Select
                        value={formData.group}
                        onValueChange={(value) => setFormData((prev) => ({ ...prev, group: value as 'A' | 'B' }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Group A</SelectItem>
                          <SelectItem value="B">Group B</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Knockout Type (for knockout matches) */}
                  {formData.matchType === 'knockout' && (
                    <div>
                      <Label className="text-sm font-bold">Knockout Stage</Label>
                      <Select
                        value={formData.knockoutType}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, knockoutType: value as any }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semi_final_1">Semi Final 1</SelectItem>
                          <SelectItem value="semi_final_2">Semi Final 2</SelectItem>
                          <SelectItem value="final">Final</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Team 1 */}
                  <div>
                    <Label className="text-sm font-bold">Team 1</Label>
                    <Select value={formData.team1Id} onValueChange={(value) => setFormData((prev) => ({ ...prev, team1Id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team 1" />
                      </SelectTrigger>
                      <SelectContent>
                        {fixtures
                          .flatMap((f) => [f.team1Id, f.team2Id])
                          .filter((id, idx, arr) => arr.indexOf(id) === idx)
                          .map((teamId) => {
                            const team = getTeam(teamId);
                            return (
                              <SelectItem key={teamId} value={teamId}>
                                {team?.name || teamId}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Team 2 */}
                  <div>
                    <Label className="text-sm font-bold">Team 2</Label>
                    <Select value={formData.team2Id} onValueChange={(value) => setFormData((prev) => ({ ...prev, team2Id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team 2" />
                      </SelectTrigger>
                      <SelectContent>
                        {fixtures
                          .flatMap((f) => [f.team1Id, f.team2Id])
                          .filter((id, idx, arr) => arr.indexOf(id) === idx)
                          .filter((id) => id !== formData.team1Id)
                          .map((teamId) => {
                            const team = getTeam(teamId);
                            return (
                              <SelectItem key={teamId} value={teamId}>
                                {team?.name || teamId}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div>
                    <Label className="text-sm font-bold">Match Date</Label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                    />
                  </div>

                  {/* Time */}
                  <div>
                    <Label className="text-sm font-bold">Match Time</Label>
                    <Input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                    />
                  </div>

                  {/* Venue */}
                  <div>
                    <Label className="text-sm font-bold">Venue</Label>
                    <Input
                      placeholder="e.g., Cricket Ground 1"
                      value={formData.venue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, venue: e.target.value }))}
                    />
                  </div>
                </div>

                <DialogFooter className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveMatch} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Check className="w-4 h-4" />
                    {editingFixture ? 'Update' : 'Schedule'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {sortedFixtures.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No matches scheduled yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedFixtures.map((fixture) => {
                const team1 = getTeam(fixture.team1Id);
                const team2 = getTeam(fixture.team2Id);

                return (
                  <div
                    key={fixture.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-300 text-xs font-bold">
                          {getMatchTypeLabel(fixture)}
                        </Badge>
                        {fixture.status === 'completed' && (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 text-xs font-bold">
                            <Check className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <TeamBadge team={team1} />
                        <span className="text-xs text-muted-foreground font-bold">vs</span>
                        <TeamBadge team={team2} />
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {fixture.scheduledDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-amber-400" />
                            {new Date(fixture.scheduledDate).toLocaleDateString()}
                          </div>
                        )}
                        {fixture.scheduledTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            {fixture.scheduledTime}
                          </div>
                        )}
                        {fixture.venue && <div>📍 {fixture.venue}</div>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditMatch(fixture)}
                        className="gap-1 h-8 rounded-lg border-white/10"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteMatch(fixture.id)}
                        className="gap-1 h-8 rounded-lg border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
