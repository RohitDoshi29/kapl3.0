import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  ShieldAlert,
  Crown,
  UserPlus,
  Trash2,
  CheckCircle2,
  Users,
  Sparkles,
  Lock,
  Mail,
  UserCheck,
  Building,
  Award,
  Star,
  Shield,
} from 'lucide-react';
import { Team } from '@/lib/cricketTypes';

export interface CoAdminEntry {
  id: string;
  email: string;
  name: string;
  title: string;
  addedAt: string;
}

const DEFAULT_CO_ADMINS: CoAdminEntry[] = [
  {
    id: 'co-admin-1',
    email: 'admin.operations@kapl.com',
    name: 'Tournament Director',
    title: 'Match Operations & Umpiring',
    addedAt: '2026-10-01',
  },
];

export function AdminRolesGovernanceTab() {
  const { user, isSuperAdmin, assignRoleByEmail } = useAuth();
  const { teams, updateTeam } = useCricketStore();
  const { activeTournamentId, setActiveTournamentId } = useTournament();

  const [activeGovernanceTab, setActiveGovernanceTab] = useState<'co_admins' | 'owners' | 'scorers_officials'>('co_admins');

  // Direct Role Assigner form state
  const [directEmail, setDirectEmail] = useState('');
  const [directRole, setDirectRole] = useState<UserRole>('scorer');
  const [directTitle, setDirectTitle] = useState('');
  const [directTeamId, setDirectTeamId] = useState('');
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, any>>(() => {
    try {
      return JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
    } catch {
      return {};
    }
  });

  // Co-Admin form state
  const [coAdmins, setCoAdmins] = useState<CoAdminEntry[]>(() => {
    try {
      const stored = localStorage.getItem('kapl_co_admins');
      return stored ? JSON.parse(stored) : DEFAULT_CO_ADMINS;
    } catch {
      return DEFAULT_CO_ADMINS;
    }
  });
  const [coAdminEmail, setCoAdminEmail] = useState('');
  const [coAdminName, setCoAdminName] = useState('');
  const [coAdminTitle, setCoAdminTitle] = useState('');
  const [isSubmittingCoAdmin, setIsSubmittingCoAdmin] = useState(false);

  // Owner form state
  const [selectedTournament, setSelectedTournament] = useState<string>(activeTournamentId || 'kapl-3-mens');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [alsoCaptain, setAlsoCaptain] = useState(false);
  const [isSubmittingOwner, setIsSubmittingOwner] = useState(false);

  // Sync tournament
  useEffect(() => {
    if (activeTournamentId) {
      setSelectedTournament(activeTournamentId);
    }
  }, [activeTournamentId]);

  // Persist co-admins
  useEffect(() => {
    try {
      localStorage.setItem('kapl_co_admins', JSON.stringify(coAdmins));
    } catch (e) {
      console.warn('Failed to save co_admins:', e);
    }
  }, [coAdmins]);

  // Filter teams by currently selected tournament
  const tournamentTeams = teams.filter(
    (t) => (t.tournamentId || 'kapl-3-mens') === selectedTournament
  );

  // When selected team changes, auto-populate the form
  useEffect(() => {
    if (selectedTeamId) {
      const team = teams.find((t) => t.id === selectedTeamId);
      if (team) {
        setOwnerName(team.ownerName || '');
        setOwnerEmail(team.ownerEmail || '');
        const isOwnerCaptain =
          team.captainPlayerId === 'owner' ||
          (team.ownerName && team.captainName && team.ownerName === team.captainName);
        setAlsoCaptain(!!isOwnerCaptain);
      }
    } else {
      setOwnerName('');
      setOwnerEmail('');
      setAlsoCaptain(false);
    }
  }, [selectedTeamId, teams]);

  // Handle adding new Co-Admin
  const handleAddCoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = coAdminEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid Co-Admin email address');
      return;
    }

    if (coAdmins.some((c) => c.email.toLowerCase() === cleanEmail)) {
      toast.error('This email is already registered as a Co-Admin');
      return;
    }

    setIsSubmittingCoAdmin(true);
    try {
      // 1. Assign role by email in Auth system with audit details
      await assignRoleByEmail(cleanEmail, 'co_admin', {
        title: coAdminTitle.trim() || 'Co-Admin Staff',
        assignedBy: 'Rohit Doshi (Main Admin)',
      });

      // 2. Add to co-admin directory
      const newEntry: CoAdminEntry = {
        id: `co-admin-${Date.now()}`,
        email: cleanEmail,
        name: coAdminName.trim() || 'Co-Admin Staff',
        title: coAdminTitle.trim() || 'Tournament Official',
        addedAt: new Date().toISOString().split('T')[0],
      };

      setCoAdmins((prev) => [newEntry, ...prev]);
      setCoAdminEmail('');
      setCoAdminName('');
      setCoAdminTitle('');
      toast.success(`Successfully appointed ${cleanEmail} as Co-Admin!`);
    } catch {
      toast.error('Failed to appoint Co-Admin');
    } finally {
      setIsSubmittingCoAdmin(false);
    }
  };

  // Handle revoking Co-Admin
  const handleRevokeCoAdmin = async (id: string, email: string) => {
    try {
      await assignRoleByEmail(email, 'player');
      setCoAdmins((prev) => prev.filter((c) => c.id !== id));
      toast.info(`Revoked Co-Admin privileges for ${email}`);
    } catch {
      toast.error('Failed to revoke role');
    }
  };

  // Handle assigning Franchise Owner
  const handleSaveOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) {
      toast.error('Please select a team to assign the owner to');
      return;
    }

    if (!ownerName.trim()) {
      toast.error('Please enter the owner’s full name');
      return;
    }

    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return;

    setIsSubmittingOwner(true);
    try {
      const cleanOwnerName = ownerName.trim();
      const cleanOwnerEmail = ownerEmail.trim().toLowerCase() || null;

      const updates: Partial<Team> = {
        ownerName: cleanOwnerName,
        ownerEmail: cleanOwnerEmail,
      };

      if (alsoCaptain) {
        updates.captainName = cleanOwnerName;
        updates.captainPlayerId = 'owner';
      } else if (team.captainPlayerId === 'owner') {
        // If they were previously captain and now unticked, revert to unassigned captain
        updates.captainName = undefined;
        updates.captainPlayerId = null;
      }

      // Update team in store & local/DB storage
      await updateTeam(selectedTeamId, updates);

      // If email provided, assign 'owner' role in Auth system with audit details
      if (cleanOwnerEmail) {
        await assignRoleByEmail(cleanOwnerEmail, 'owner', {
          teamName: team.name,
          teamId: team.id,
          title: alsoCaptain ? 'Team Owner & Captain' : 'Team Owner',
          assignedBy: 'Rohit Doshi (Main Admin)',
        });
      }

      toast.success(
        alsoCaptain
          ? `Assigned ${cleanOwnerName} as Owner & Captain of ${team.name}!`
          : `Assigned ${cleanOwnerName} as Owner of ${team.name}!`
      );
      setSelectedTeamId('');
    } catch {
      toast.error('Failed to assign team owner');
    } finally {
      setIsSubmittingOwner(false);
    }
  };

  // Handle unassigning owner
  const handleUnassignOwner = async (teamId: string) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    if (team.ownerEmail) {
      await assignRoleByEmail(team.ownerEmail, 'player');
    }

    const updates: Partial<Team> = {
      ownerName: undefined,
      ownerEmail: null,
      ownerUserId: null,
    };

    if (team.captainPlayerId === 'owner') {
      updates.captainName = undefined;
      updates.captainPlayerId = null;
    }

    await updateTeam(teamId, updates);
    toast.info(`Unassigned owner for ${team.name}`);
  };

  // Handle direct role appointment (Scorers, Captains, Custom Roles)
  const handleAssignDirectRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = directEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!directRole) {
      toast.error('Please select a role to assign');
      return;
    }

    setIsSubmittingDirect(true);
    try {
      const targetTeam = teams.find((t) => t.id === directTeamId);
      await assignRoleByEmail(cleanEmail, directRole, {
        title: directTitle.trim() || undefined,
        teamName: targetTeam?.name,
        teamId: targetTeam?.id,
        assignedBy: 'Rohit Doshi (Main Admin)',
      });

      // If assigning owner or captain and a team is selected, also sync with team
      if (directTeamId && (directRole === 'owner' || directRole === 'captain')) {
        const teamUpdates: Partial<Team> = {};
        if (directRole === 'owner') {
          teamUpdates.ownerEmail = cleanEmail;
          if (directTitle.trim()) teamUpdates.ownerName = directTitle.trim();
        }
        if (directRole === 'captain') {
          if (directTitle.trim()) teamUpdates.captainName = directTitle.trim();
        }
        await updateTeam(directTeamId, teamUpdates);
      }

      const updated = JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
      setRoleAssignments(updated);
      setDirectEmail('');
      setDirectTitle('');
      setDirectTeamId('');
      toast.success(`Assigned ${directRole} role to ${cleanEmail}! Player can now see this verified role in their profile.`);
    } catch {
      toast.error('Failed to assign role');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

  // Handle revoking direct role
  const handleRevokeRole = async (email: string) => {
    try {
      await assignRoleByEmail(email, 'player');
      const updated = JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
      delete updated[email.toLowerCase().trim()];
      localStorage.setItem('kapl_role_assignments', JSON.stringify(updated));
      setRoleAssignments(updated);
      toast.info(`Reset ${email} to default Player role`);
    } catch {
      toast.error('Failed to revoke role');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-amber-500/10 border border-amber-500/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground">
              Admin Governance & Roles
            </h2>
            <Badge className="bg-destructive text-destructive-foreground font-bold text-xs">
              <Lock className="w-3 h-3 mr-1" /> Admin Only
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Designate elevated tournament administrators (Co-Admins) and franchise team owners.
          </p>
        </div>

        {/* Super Admin Pill */}
        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm border border-border/80 px-3.5 py-1.5 rounded-full text-xs shadow-xs">
          <Crown className="w-4 h-4 text-amber-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Main Admin</span>
            <span className="font-semibold text-foreground truncate max-w-[170px]">
              rohit.doshi2007@gmail.com
            </span>
          </div>
        </div>
      </div>

      {/* Main Governance Tabs */}
      <Tabs
        value={activeGovernanceTab}
        onValueChange={(val) => setActiveGovernanceTab(val as any)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
          <TabsTrigger value="co_admins" className="gap-2 font-bold text-xs sm:text-sm">
            <UserCheck className="w-4 h-4 text-purple-500" />
            Co-Admins ({coAdmins.length})
          </TabsTrigger>
          <TabsTrigger value="owners" className="gap-2 font-bold text-xs sm:text-sm">
            <Crown className="w-4 h-4 text-amber-500" />
            Franchise Owners ({teams.filter((t) => !!t.ownerName).length})
          </TabsTrigger>
          <TabsTrigger value="scorers_officials" className="gap-2 font-bold text-xs sm:text-sm">
            <Award className="w-4 h-4 text-emerald-500" />
            Scorers & Directory
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CO-ADMIN MANAGEMENT */}
        <TabsContent value="co_admins" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Co-Admin Form */}
            <Card className="lg:col-span-1 shadow-md border-purple-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <UserPlus className="w-4 h-4 text-purple-500" />
                  Appoint New Co-Admin
                </CardTitle>
                <CardDescription className="text-xs">
                  Grant elevated administrator access to match operations, setup, and tournament scoring.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCoAdmin} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="coadmin-email" className="text-xs font-semibold">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                      <Input
                        id="coadmin-email"
                        type="email"
                        placeholder="official@kapl.com"
                        value={coAdminEmail}
                        onChange={(e) => setCoAdminEmail(e.target.value)}
                        className="pl-9 h-9 text-xs"
                        required
                        disabled={isSubmittingCoAdmin}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="coadmin-name" className="text-xs font-semibold">
                      Full Name
                    </Label>
                    <Input
                      id="coadmin-name"
                      type="text"
                      placeholder="e.g. Suresh Kumar"
                      value={coAdminName}
                      onChange={(e) => setCoAdminName(e.target.value)}
                      className="h-9 text-xs"
                      disabled={isSubmittingCoAdmin}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="coadmin-title" className="text-xs font-semibold">
                      Role / Designation
                    </Label>
                    <Input
                      id="coadmin-title"
                      type="text"
                      placeholder="e.g. Match Commissioner"
                      value={coAdminTitle}
                      onChange={(e) => setCoAdminTitle(e.target.value)}
                      className="h-9 text-xs"
                      disabled={isSubmittingCoAdmin}
                    />
                  </div>

                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[11px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-purple-600 dark:text-purple-400">Co-Admin Privileges:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Full access to `/admin` dashboard</li>
                      <li>Live Match Scorer & Setup controls</li>
                      <li>Bracket & Tournament rule management</li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-9 font-semibold text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                    disabled={isSubmittingCoAdmin}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {isSubmittingCoAdmin ? 'Appointing...' : 'Grant Co-Admin Role'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Co-Admins Directory */}
            <Card className="lg:col-span-2 shadow-md">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-purple-500" />
                    Active Administrators & Co-Admins
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Users authorized with administrator privileges in KAPL 3.0.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-400 font-semibold text-xs">
                  {coAdmins.length + 1} Authorized
                </Badge>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Official</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Privilege</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Permanent Super Admin Row */}
                      <TableRow className="bg-amber-500/5">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">
                              👑
                            </span>
                            <div>
                              <p className="font-bold text-xs text-foreground flex items-center gap-1">
                                Rohit Doshi
                                <Badge className="bg-amber-500 text-black text-[9px] px-1 py-0 h-4 font-black">MAIN ADMIN</Badge>
                              </p>
                              <p className="text-[10px] text-muted-foreground">Tournament Owner & Creator</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          rohit.doshi2007@gmail.com
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                            Full Control
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground italic">
                          Permanent
                        </TableCell>
                      </TableRow>

                      {/* Appointed Co-Admins */}
                      {coAdmins.map((coAdmin) => (
                        <TableRow key={coAdmin.id} className="hover:bg-muted/50">
                          <TableCell className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-full bg-purple-500/20 text-purple-600 flex items-center justify-center font-bold text-xs">
                                🛡️
                              </span>
                              <div>
                                <p className="font-bold text-xs text-foreground">{coAdmin.name}</p>
                                <p className="text-[10px] text-muted-foreground">{coAdmin.title}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {coAdmin.email}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-purple-600 text-white text-[10px] font-semibold">
                              Co-Admin
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => handleRevokeCoAdmin(coAdmin.id, coAdmin.email)}
                              title="Revoke Co-Admin Access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}

                      {coAdmins.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground italic">
                            No additional Co-Admins configured yet. Use the form on the left to appoint.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: FRANCHISE OWNER MANAGEMENT */}
        <TabsContent value="owners" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Assign Franchise Owner Form */}
            <Card className="lg:col-span-1 shadow-md border-amber-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Assign Franchise Owner
                </CardTitle>
                <CardDescription className="text-xs">
                  Admin assigns the official Owner role to a team franchise.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveOwner} className="space-y-3.5">
                  {/* Tournament Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Tournament Division</Label>
                    <Select
                      value={selectedTournament}
                      onValueChange={(val) => {
                        setSelectedTournament(val);
                        setSelectedTeamId('');
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Select Tournament" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kapl-3-mens">KAPL 3.0 Men's Tournament</SelectItem>
                        <SelectItem value="kapl-3-womens">KAPL 3.0 Women's Tournament</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Team Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">
                      Select Franchise Team <span className="text-destructive">*</span>
                    </Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Choose a Team" />
                      </SelectTrigger>
                      <SelectContent>
                        {tournamentTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name} (Grp {team.group}) {team.ownerName ? `• 👑 ${team.ownerName}` : '• No Owner'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Owner Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-name" className="text-xs font-semibold">
                      Owner Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="owner-name"
                      placeholder="e.g. Rajesh Shah"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      className="h-9 text-xs"
                      disabled={isSubmittingOwner}
                      required
                    />
                  </div>

                  {/* Owner Login Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-email" className="text-xs font-semibold">
                      Owner Login Email (Optional)
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                      <Input
                        id="owner-email"
                        type="email"
                        placeholder="owner@franchise.com"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        className="pl-9 h-9 text-xs"
                        disabled={isSubmittingOwner}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Grants the 'owner' role badge upon logging in.
                    </p>
                  </div>

                  {/* Dual Role: Appoint Owner as Captain */}
                  <div className="flex items-start space-x-2 pt-2 pb-1 border-t border-border/60">
                    <Checkbox
                      id="also-captain"
                      checked={alsoCaptain}
                      onCheckedChange={(checked) => setAlsoCaptain(!!checked)}
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor="also-captain" className="text-xs font-bold cursor-pointer flex items-center gap-1 text-primary">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Also designate Owner as Team Captain?
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Captain and Owner are distinct roles. Enabling this appoints the owner to serve in both capacities.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-9 font-semibold text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-bold"
                    disabled={isSubmittingOwner || !selectedTeamId}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    {isSubmittingOwner ? 'Assigning...' : 'Assign Franchise Owner'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Franchise Teams Roster & Governance Table */}
            <Card className="lg:col-span-2 shadow-md">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Building className="w-4 h-4 text-amber-500" />
                    Franchise Governance Directory
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Franchise ownership and captaincy overview for {tournamentTeams.length} teams.
                  </CardDescription>
                </div>

                {/* Quick division switcher */}
                <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => {
                      setSelectedTournament('kapl-3-mens');
                      setActiveTournamentId('kapl-3-mens');
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      selectedTournament === 'kapl-3-mens'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Men's
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTournament('kapl-3-womens');
                      setActiveTournamentId('kapl-3-womens');
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      selectedTournament === 'kapl-3-womens'
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Women's
                  </button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Team</TableHead>
                        <TableHead className="text-xs">Franchise Owner</TableHead>
                        <TableHead className="text-xs">Team Captain</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tournamentTeams.map((team) => {
                        const isOwnerCaptain =
                          team.captainPlayerId === 'owner' ||
                          (team.ownerName && team.captainName && team.ownerName === team.captainName);

                        return (
                          <TableRow key={team.id} className="hover:bg-muted/50">
                            <TableCell className="py-2.5">
                              <div className="flex items-center gap-2">
                                <TeamBadge team={team} size="sm" showName={true} />
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  Grp {team.group}
                                </Badge>
                              </div>
                            </TableCell>

                            {/* Owner */}
                            <TableCell>
                              {team.ownerName ? (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                                    <Crown className="w-3 h-3 text-amber-500" />
                                    {team.ownerName}
                                  </span>
                                  {team.ownerEmail && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      {team.ownerEmail}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>

                            {/* Captain */}
                            <TableCell>
                              {isOwnerCaptain ? (
                                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
                                  👑⚡ Owner & Captain
                                </Badge>
                              ) : team.captainName ? (
                                <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] font-semibold">
                                  ⚡ {team.captainName}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] px-2"
                                onClick={() => setSelectedTeamId(team.id)}
                              >
                                Edit
                              </Button>
                              {team.ownerName && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleUnassignOwner(team.id)}
                                  title="Unassign Owner"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 3: SCORERS & ROLE DIRECTORY */}
        <TabsContent value="scorers_officials" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Direct Role Assignment Card */}
            <Card className="lg:col-span-1 shadow-md border-emerald-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Award className="w-4 h-4 text-emerald-500" />
                  Appoint Official / Assign Role
                </CardTitle>
                <CardDescription className="text-xs">
                  Appoint Match Scorers, Team Captains, or assign official roles. Players will immediately see their verified role in their profile.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAssignDirectRole} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="direct-email" className="text-xs font-semibold">
                      Account Email Address <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                      <Input
                        id="direct-email"
                        type="email"
                        placeholder="user@example.com"
                        value={directEmail}
                        onChange={(e) => setDirectEmail(e.target.value)}
                        className="pl-9 h-9 text-xs"
                        required
                        disabled={isSubmittingDirect}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="direct-role" className="text-xs font-semibold">
                      Role to Assign <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={directRole || 'scorer'}
                      onValueChange={(val) => setDirectRole(val as UserRole)}
                      disabled={isSubmittingDirect}
                    >
                      <SelectTrigger id="direct-role" className="h-9 text-xs">
                        <SelectValue placeholder="Select official role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scorer">⚖️ Official Match Scorer</SelectItem>
                        <SelectItem value="captain">🦁 Franchise Team Captain</SelectItem>
                        <SelectItem value="owner">👑 Franchise Team Owner</SelectItem>
                        <SelectItem value="co_admin">🛡️ Tournament Co-Admin</SelectItem>
                        <SelectItem value="player">🏏 Standard Player</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="direct-title" className="text-xs font-semibold">
                      Official Title / Name
                    </Label>
                    <Input
                      id="direct-title"
                      type="text"
                      placeholder="e.g. Lead Ground Scorer or Captain Name"
                      value={directTitle}
                      onChange={(e) => setDirectTitle(e.target.value)}
                      className="h-9 text-xs"
                      disabled={isSubmittingDirect}
                    />
                  </div>

                  {/* Team association (Optional / for Captain & Owner) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="direct-team" className="text-xs font-semibold">
                      Associated Team (Optional)
                    </Label>
                    <Select
                      value={directTeamId}
                      onValueChange={setDirectTeamId}
                      disabled={isSubmittingDirect}
                    >
                      <SelectTrigger id="direct-team" className="h-9 text-xs">
                        <SelectValue placeholder="Select team (if applicable)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None / General Official</SelectItem>
                        {teams.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} (Group {t.group})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-9 text-xs font-bold gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    disabled={isSubmittingDirect}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isSubmittingDirect ? 'Assigning Role...' : 'Assign Role & Verify'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Official Role Directory Table */}
            <Card className="lg:col-span-2 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between text-foreground">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    Official Appointments Directory
                  </span>
                  <Badge variant="outline" className="text-xs font-semibold">
                    {Object.keys(roleAssignments).length} Assigned
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  All active role designations. Players can view these verified credentials in their profile page.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-bold">Email / User</TableHead>
                        <TableHead className="text-xs font-bold">Assigned Role</TableHead>
                        <TableHead className="text-xs font-bold">Franchise / Title</TableHead>
                        <TableHead className="text-xs font-bold">Appointed By</TableHead>
                        <TableHead className="text-xs font-bold text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Permanent Main Admin Entry */}
                      <TableRow className="bg-amber-500/5 hover:bg-amber-500/10">
                        <TableCell className="py-2.5">
                          <span className="font-mono text-xs font-bold text-foreground">
                            rohit.doshi2007@gmail.com
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-destructive text-destructive-foreground font-black text-[10px] gap-1">
                            <Crown className="w-3 h-3 text-amber-300" /> Main Admin
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold text-foreground">Tournament Director</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">Permanent Super Admin</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Protected</Badge>
                        </TableCell>
                      </TableRow>

                      {/* Dynamic Role Assignments */}
                      {Object.keys(roleAssignments).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                            No custom role appointments yet. Use the form on the left to appoint Scorers or Captains.
                          </TableCell>
                        </TableRow>
                      ) : (
                        Object.keys(roleAssignments).map((emailKey) => {
                          const item = roleAssignments[emailKey];
                          return (
                            <TableRow key={emailKey} className="hover:bg-muted/50">
                              <TableCell className="py-2.5">
                                <span className="font-mono text-xs font-semibold text-foreground">
                                  {item.email}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`text-[10px] font-bold capitalize ${
                                    item.role === 'owner'
                                      ? 'bg-amber-500 text-black'
                                      : item.role === 'captain'
                                      ? 'bg-blue-600 text-white'
                                      : item.role === 'co_admin'
                                      ? 'bg-purple-600 text-white'
                                      : item.role === 'scorer'
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-muted text-foreground'
                                  }`}
                                >
                                  {item.role}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-foreground">
                                  {item.teamName ? `${item.teamName}` : item.title || '—'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {item.assignedBy || 'Rohit Doshi'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRevokeRole(item.email)}
                                  title="Reset to player"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  Reset
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
export default AdminRolesGovernanceTab;

