import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCricketStore } from '@/hooks/useCricketStore';
import { useTournament } from '@/contexts/TournamentContext';
import { useSunlightMode } from '@/hooks/useSunlightMode';
import { isSoundEnabled, setSoundEnabled, playBoundaryFour } from '@/lib/soundEffects';
import { Navigation } from '@/components/cricket/Navigation';
import { Header } from '@/components/cricket/Header';
import { MultiMatchLiveBar } from '@/components/cricket/MultiMatchLiveBar';
import { TeamBadge } from '@/components/cricket/TeamBadge';
import { PlayerRole } from '@/lib/cricketTypes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Camera,
  Shield,
  Trophy,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  LogOut,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Sparkles,
  Phone,
  Award,
  Flame,
  Zap,
  Save,
  RotateCcw,
  Upload,
  ExternalLink,
  Users,
  Crown,
  Star,
  Check,
  Gavel,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';

// Preset avatar options for quick cricket personalization
const PRESET_AVATARS = [
  { id: 'batter', label: 'Power Batter', emoji: '🏏', bg: 'bg-blue-500/20 text-blue-500 border-blue-500/40' },
  { id: 'bowler', label: 'Express Pacer', emoji: '⚡', bg: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40' },
  { id: 'allrounder', label: 'All-Rounder', emoji: '👑', bg: 'bg-amber-500/20 text-amber-500 border-amber-500/40' },
  { id: 'keeper', label: 'Wicket-Keeper', emoji: '🧤', bg: 'bg-purple-500/20 text-purple-500 border-purple-500/40' },
  { id: 'spinner', label: 'Spin Maestro', emoji: '🎯', bg: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/40' },
  { id: 'captain', label: 'Franchise Leader', emoji: '🦁', bg: 'bg-red-500/20 text-red-500 border-red-500/40' },
  { id: 'trophy', label: 'Gold Champion', emoji: '🏆', bg: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40' },
  { id: 'fire', label: 'Match Finisher', emoji: '🔥', bg: 'bg-orange-500/20 text-orange-500 border-orange-500/40' },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, userRole, isAuthenticated, isLoading: authLoading, profile, updateProfile, signOut, changePassword } = useAuth();
  const { teams } = useCricketStore();
  const { currentTournament } = useTournament();
  const { isSunlightMode, toggleSunlightMode } = useSunlightMode();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile Form States
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [role, setRole] = useState<PlayerRole>('all_rounder');
  const [battingStyle, setBattingStyle] = useState('Right-hand bat');
  const [bowlingStyle, setBowlingStyle] = useState('Right-arm medium');
  const [jerseyNumber, setJerseyNumber] = useState<string>('');
  const [tournamentId, setTournamentId] = useState('kapl-3-mens');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bio, setBio] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // Change Password States
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sync state when profile is loaded
  useEffect(() => {
    if (profile) {
      setName(profile.name || user?.email?.split('@')[0] || '');
      setMobileNumber(profile.mobileNumber || '');
      setRole((profile.role as PlayerRole) || 'all_rounder');
      setBattingStyle(profile.battingStyle || 'Right-hand bat');
      setBowlingStyle(profile.bowlingStyle || 'Right-arm medium');
      setJerseyNumber(profile.jerseyNumber !== null && profile.jerseyNumber !== undefined ? String(profile.jerseyNumber) : '');
      setTournamentId(profile.tournamentId || 'kapl-3-mens');
      setPhotoUrl(profile.photoUrl || '');
      setBio(profile.bio || '');
    } else if (user) {
      setName(user.user_metadata?.name || user.email?.split('@')[0] || '');
    }
  }, [profile, user]);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  // Role assignment details from Admin
  const roleAssignment = useMemo(() => {
    if (!user?.email) return null;
    try {
      const stored = JSON.parse(localStorage.getItem('kapl_role_assignments') || '{}');
      return stored[user.email.toLowerCase().trim()] || null;
    } catch {
      return null;
    }
  }, [user]);

  // Find if user is drafted in any team or assigned as Owner/Captain
  const userTeam = useMemo(() => {
    if (!user) return null;
    const cleanEmail = user.email?.toLowerCase().trim();
    const cleanName = (profile?.name || name || '').trim().toLowerCase();

    // Check by captain / owner or in players list
    for (const team of (teams || [])) {
      const isOwner = team.ownerEmail && cleanEmail && team.ownerEmail.toLowerCase().trim() === cleanEmail;
      const isCaptain = (team.captainUserId && team.captainUserId === user.id) ||
                        (cleanName && team.captainName?.toLowerCase() === cleanName) ||
                        (isOwner && team.captainPlayerId === 'owner');

      if (isOwner && isCaptain) {
        return { team, relationship: 'Owner & Captain' };
      }
      if (isOwner) {
        return { team, relationship: 'Owner' };
      }
      if (isCaptain) {
        return { team, relationship: 'Captain' };
      }
      const playerInTeam = (team.players || []).find(
        (p) =>
          (cleanName && p.name.toLowerCase() === cleanName) ||
          (profile?.playerId && p.id === profile.playerId)
      );
      if (playerInTeam) {
        return { team, relationship: 'Squad Member', player: playerInTeam };
      }
    }
    return null;
  }, [teams, user, profile, name]);

  // Handle local image file upload and convert to base64 data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image is too large. Please select an image under 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setPhotoUrl(result);
        setSelectedPreset(null);
        toast.success('Profile photo ready! Remember to save changes.');
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPreset = (preset: typeof PRESET_AVATARS[0]) => {
    setSelectedPreset(preset.id);
    // Create an inline SVG-backed avatar URL or marker
    setPhotoUrl('');
    toast.info(`Selected ${preset.label} badge! Remember to save changes.`);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setIsSubmitting(true);
    try {
      const jerseyNum = jerseyNumber.trim() ? parseInt(jerseyNumber.trim(), 10) : null;
      if (jerseyNum !== null && (isNaN(jerseyNum) || jerseyNum < 0 || jerseyNum > 99)) {
        toast.error('Jersey number must be between 0 and 99');
        setIsSubmitting(false);
        return;
      }

      const { error } = await updateProfile({
        name: name.trim(),
        mobileNumber: mobileNumber.trim() || null,
        role,
        battingStyle,
        bowlingStyle,
        jerseyNumber: jerseyNum,
        tournamentId,
        photoUrl: photoUrl.trim() || undefined,
        bio: bio.trim(),
      });

      if (error) {
        toast.error(`Failed to update profile: ${error.message}`);
      } else {
        toast.success('Your profile has been updated successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (profile) {
      setName(profile.name || user?.email?.split('@')[0] || '');
      setMobileNumber(profile.mobileNumber || '');
      setRole((profile.role as PlayerRole) || 'all_rounder');
      setBattingStyle(profile.battingStyle || 'Right-hand bat');
      setBowlingStyle(profile.bowlingStyle || 'Right-arm medium');
      setJerseyNumber(profile.jerseyNumber !== null && profile.jerseyNumber !== undefined ? String(profile.jerseyNumber) : '');
      setTournamentId(profile.tournamentId || 'kapl-3-mens');
      setPhotoUrl(profile.photoUrl || '');
      setBio(profile.bio || '');
    }
    toast.info('Form reset to last saved state');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await changePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully! Keep your new password safe.');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (err: any) {
      toast.error('Failed to update password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSoundToggle = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playBoundaryFour();
    toast.success(next ? 'Sound effects turned ON 🔊' : 'Sound effects muted 🔇');
  };

  const getRoleBadge = (r: string | null) => {
    if (user?.email?.toLowerCase().trim() === 'rohit.doshi2007@gmail.com') {
      return (
        <Badge className="bg-destructive text-destructive-foreground font-black text-xs gap-1.5 py-1 px-3 shadow-md border border-amber-400/50">
          <Crown className="w-3.5 h-3.5 text-amber-300" /> Main Tournament Admin
        </Badge>
      );
    }
    if (userTeam?.relationship === 'Owner & Captain') {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xs gap-1 py-1 px-3 shadow-md border border-amber-400/50">
          <Crown className="w-3.5 h-3.5" /> Team Owner & Captain ({userTeam.team.name})
        </Badge>
      );
    }
    if (r === 'owner' || userTeam?.relationship === 'Owner') {
      return (
        <Badge className="bg-amber-500 text-black font-black text-xs gap-1 py-1 px-2.5 shadow-sm">
          <Crown className="w-3.5 h-3.5" /> Team Owner {userTeam ? `(${userTeam.team.name})` : ''}
        </Badge>
      );
    }
    if (r === 'captain' || userTeam?.relationship === 'Captain') {
      return (
        <Badge className="bg-blue-600 text-white font-bold text-xs gap-1 py-1 px-2.5 shadow-sm">
          <Star className="w-3.5 h-3.5" /> Team Captain {userTeam ? `(${userTeam.team.name})` : ''}
        </Badge>
      );
    }
    switch (r) {
      case 'admin':
        return (
          <Badge className="bg-destructive text-destructive-foreground font-bold text-xs gap-1 py-0.5 px-2.5">
            <Shield className="w-3 h-3" /> Admin
          </Badge>
        );
      case 'co_admin':
        return (
          <Badge className="bg-purple-600 text-white font-bold text-xs gap-1 py-0.5 px-2.5">
            <Shield className="w-3 h-3" /> Co-Admin
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-semibold text-xs gap-1 py-0.5 px-2.5">
            🏏 Official Player
          </Badge>
        );
    }
  };

  // If user is not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background pb-20 md:pb-10">
        <Navigation />
        <Header />
        <MultiMatchLiveBar />

        <main className="container mx-auto px-4 py-12 max-w-lg">
          <Card className="text-center shadow-xl border-primary/20 backdrop-blur-sm">
            <CardHeader className="space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <User className="w-8 h-8" />
              </div>
              <CardTitle className="text-2xl font-black">Tournament Profile & Settings</CardTitle>
              <CardDescription>
                Sign in or create an account with your complete player details to manage playing styles, team assignments, and match preferences.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button asChild className="w-full h-11 text-sm font-bold gap-2">
                <Link to="/auth" state={{ tab: 'signin' }}>
                  <LogIn className="w-4 h-4" />
                  Sign In to Existing Account
                </Link>
              </Button>
              <Button
                asChild
                className="w-full h-11 text-sm font-black gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black hover:opacity-95 shadow-md shadow-amber-500/20"
              >
                <Link to="/auth" state={{ tab: 'signup' }}>
                  <UserPlus className="w-4 h-4" />
                  Create New Account with All Details
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full h-11 text-sm font-semibold">
                <Link to="/">Return to Live Scoreboard</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const activePresetItem = PRESET_AVATARS.find((p) => p.id === selectedPreset);

  return (
    <div className="relative min-h-screen bg-background pb-24 md:pb-12">
      {/* Ambient Stadium Lighting Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/10 via-emerald-500/5 to-transparent blur-3xl opacity-60" />
      </div>

      <Header />
      <Navigation />
      <MultiMatchLiveBar />

      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 md:py-6 max-w-4xl space-y-5 md:space-y-6">
        {/* Top Breadcrumb Navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/players"
            className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-muted-foreground hover:text-amber-400 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Players Directory</span>
          </Link>

          {profile?.playerId && (
            <Link
              to={`/players/${profile.playerId}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:underline"
            >
              <span>View My Public Stats Card</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Hero Profile Overview Card */}
        <Card className="relative overflow-hidden border border-white/[0.08] shadow-2xl bg-card/85 backdrop-blur-xl rounded-3xl">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-emerald-500 to-cyan-500 opacity-80" />
          <CardContent className="p-5 md:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar with Upload trigger */}
              <div className="relative group shrink-0">
                <Avatar className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-background shadow-lg">
                  {photoUrl ? (
                    <AvatarImage src={photoUrl} alt={name || 'Player'} className="object-cover" />
                  ) : activePresetItem ? (
                    <div className={`w-full h-full flex items-center justify-center text-4xl ${activePresetItem.bg}`}>
                      <span>{activePresetItem.emoji}</span>
                    </div>
                  ) : null}
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 via-accent/20 to-primary/10 text-primary font-black text-3xl">
                    {name
                      ? name.slice(0, 2).toUpperCase()
                      : user?.email
                      ? user.email.slice(0, 2).toUpperCase()
                      : <User className="w-10 h-10" />}
                  </AvatarFallback>
                </Avatar>

                {/* Camera upload overlay badge */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 rounded-xl bg-primary text-primary-foreground shadow-md hover:scale-105 transition-all"
                  title="Change photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Identity details */}
              <div className="text-center sm:text-left flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {getRoleBadge(userRole)}
                  {jerseyNumber && (
                    <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      #{jerseyNumber}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground font-medium bg-muted/60 px-2 py-0.5 rounded-md">
                    {tournamentId === 'kapl-3-womens' ? "👑 Women's KAPL" : "🏏 Men's KAPL"}
                  </span>
                </div>

                <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground truncate">
                    {name || 'My Player Profile'}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {user?.email}
                  </p>
                </div>

                {/* Team & Franchise Tag */}
                {userTeam ? (
                  <div className="inline-flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-medium">
                    <TeamBadge team={userTeam.team} size="sm" showName={false} />
                    <span className="font-bold text-foreground">{userTeam.team.name}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary/40 text-primary">
                      {userTeam.relationship}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Free Agent — Available for KAPL 3.0 draft & tournament play
                  </p>
                )}

                {bio && (
                  <p className="text-xs text-muted-foreground line-clamp-2 max-w-xl italic pt-1">
                    "{bio}"
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Official Governance & Admin Role Verification Card */}
        <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card via-card/95 to-primary/5 shadow-lg">
          <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-primary via-accent to-primary" />
          <CardHeader className="pb-3 pl-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base md:text-lg font-black flex items-center gap-2 text-foreground">
                    Official Tournament Designation
                    <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold gap-1">
                      <CheckCircle2 className="w-3 h-3" /> VERIFIED BY ADMIN
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Roles and franchise appointments assigned by Main Tournament Administration.
                  </CardDescription>
                </div>
              </div>

              {/* Quick Status Tag */}
              <div className="self-start sm:self-auto">
                {getRoleBadge(userRole)}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 pl-6 pt-1">
            {/* Role Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-muted/60 border border-border/70 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Assigned Role
                </span>
                <p className="font-black text-sm text-foreground flex items-center gap-1.5">
                  {user?.email?.toLowerCase().trim() === 'rohit.doshi2007@gmail.com' ? (
                    <>👑 Main Tournament Admin</>
                  ) : userTeam?.relationship === 'Owner & Captain' ? (
                    <>👑 Franchise Owner & Captain</>
                  ) : userRole === 'owner' || userTeam?.relationship === 'Owner' ? (
                    <>👑 Franchise Team Owner</>
                  ) : userRole === 'captain' || userTeam?.relationship === 'Captain' ? (
                    <>🦁 Franchise Team Captain</>
                  ) : userRole === 'co_admin' ? (
                    <>🛡️ Tournament Co-Admin</>
                  ) : (
                    <>🏏 Official Registered Player</>
                  )}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/60 border border-border/70 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Appointed By
                </span>
                <p className="font-bold text-sm text-primary flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" />
                  {roleAssignment?.assignedBy || 'Rohit Doshi (Main Admin)'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/60 border border-border/70 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Tournament Division
                </span>
                <p className="font-bold text-sm text-foreground">
                  {tournamentId === 'kapl-3-womens' ? "Women's KAPL 3.0" : "Men's KAPL 3.0"}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-muted/60 border border-border/70 space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Governance Status
                </span>
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Active & Confirmed
                </p>
              </div>
            </div>

            {/* Franchise Team Spotlight (If Owner or Captain) */}
            {userTeam && (
              <div className="p-4 rounded-2xl bg-card border border-primary/20 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <TeamBadge team={userTeam.team} size="md" showName={false} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-base md:text-lg text-foreground">
                        {userTeam.team.name}
                      </h4>
                      <Badge variant="outline" className="text-[10px] border-primary/40 text-primary font-bold">
                        Group {userTeam.team.group}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your officially designated franchise • {userTeam.relationship}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Team Wallet (Purse Left)
                    </span>
                    <span className="font-mono font-black text-base md:text-lg text-primary">
                      ₹{(userTeam.team.remainingPurse ?? 10000).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-border hidden md:block" />

                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Squad Size
                    </span>
                    <span className="font-mono font-black text-base md:text-lg text-foreground">
                      {userTeam.team.players?.length || 0} / {userTeam.team.maxSquadSize || 10}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Privileges & Direct Action CTAs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-border/60">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  {userRole === 'owner' || userTeam?.relationship === 'Owner' || userTeam?.relationship === 'Owner & Captain'
                    ? 'You have official franchise bidding rights in the Auction Spotlight Stage and oversight of the team purse.'
                    : userRole === 'captain' || userTeam?.relationship === 'Captain'
                    ? 'You are designated to lead team tactics, match toss, and Playing XI selection.'
                    : userRole === 'admin' || userRole === 'co_admin'
                    ? 'You hold elevated administrative and scoring privileges for all tournament fixtures.'
                    : 'You are registered in the official tournament player pool for team selection.'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(userRole === 'owner' || userTeam?.relationship === 'Owner' || userTeam?.relationship === 'Owner & Captain') && (
                  <Button asChild size="sm" className="h-9 text-xs font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-primary text-primary-foreground shadow-sm hover:opacity-95">
                    <Link to="/auction">
                      <Gavel className="w-3.5 h-3.5" />
                      Auction Spotlight Stage & Wallet
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </Link>
                  </Button>
                )}

                {(userRole === 'admin' || userRole === 'co_admin') && (
                  <Button asChild size="sm" variant="secondary" className="h-9 text-xs font-bold gap-1.5">
                    <Link to="/admin">
                      <Shield className="w-3.5 h-3.5" />
                      Admin Console
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Profile Management */}
        <Tabs defaultValue="edit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="edit" className="text-xs font-semibold gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs font-semibold gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>My Team</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="text-xs font-semibold gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Preferences</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EDIT PROFILE */}
          <TabsContent value="edit">
            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Avatar Selection Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    Profile Photo & Avatar
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload your match photo or select an official cricket avatar badge.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Photo Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 h-9 text-xs font-semibold"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo from Device
                    </Button>
                    {photoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPhotoUrl('');
                          setSelectedPreset(null);
                        }}
                        className="text-xs text-destructive hover:bg-destructive/10 h-9"
                      >
                        Remove Photo
                      </Button>
                    )}
                  </div>

                  {/* Or Direct Image URL */}
                  <div className="space-y-1.5">
                    <Label htmlFor="photo-url" className="text-xs font-medium">
                      Or Paste Image URL
                    </Label>
                    <Input
                      id="photo-url"
                      type="url"
                      placeholder="https://example.com/my-photo.jpg"
                      value={photoUrl}
                      onChange={(e) => {
                        setPhotoUrl(e.target.value);
                        setSelectedPreset(null);
                      }}
                      className="text-xs h-9"
                    />
                  </div>

                  {/* Preset Cricket Badges */}
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground block mb-2">
                      Quick Cricket Avatar Badges
                    </Label>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {PRESET_AVATARS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPreset(preset)}
                          className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all hover:scale-105 ${
                            selectedPreset === preset.id
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/10'
                              : 'border-border/80 hover:bg-muted/60'
                          }`}
                        >
                          <span className="text-2xl">{preset.emoji}</span>
                          <span className="text-[10px] font-semibold text-center truncate max-w-full">
                            {preset.label}
                          </span>
                          {selectedPreset === preset.id && (
                            <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Personal & Cricket Attributes Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    Player Attributes & Information
                  </CardTitle>
                  <CardDescription className="text-xs">
                    These details will be displayed across tournament rosters, leaderboards, and scoring audits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="player-name" className="text-xs font-bold">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="player-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Rohit Doshi"
                        required
                        className="h-10 text-sm font-medium"
                      />
                    </div>

                    {/* Mobile / Phone Number */}
                    <div className="space-y-1.5">
                      <Label htmlFor="player-mobile" className="text-xs font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        Mobile / WhatsApp Number
                      </Label>
                      <Input
                        id="player-mobile"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="h-10 text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Primary Role */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Primary Playing Role</Label>
                      <Select value={role} onValueChange={(val) => setRole(val as PlayerRole)}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_rounder">👑 All-Rounder</SelectItem>
                          <SelectItem value="batter">🏏 Pure Batter</SelectItem>
                          <SelectItem value="bowler">⚡ Strike Bowler</SelectItem>
                          <SelectItem value="wicket_keeper">🧤 Wicket-Keeper</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Batting Style */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Batting Style</Label>
                      <Select value={battingStyle} onValueChange={setBattingStyle}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Right-hand bat">Right-hand bat</SelectItem>
                          <SelectItem value="Left-hand bat">Left-hand bat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bowling Style */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Bowling Style</Label>
                      <Select value={bowlingStyle} onValueChange={setBowlingStyle}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select bowling" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Right-arm medium">Right-arm medium</SelectItem>
                          <SelectItem value="Right-arm fast">Right-arm fast</SelectItem>
                          <SelectItem value="Left-arm fast">Left-arm fast</SelectItem>
                          <SelectItem value="Right-arm off break">Right-arm off break</SelectItem>
                          <SelectItem value="Right-arm leg break">Right-arm leg break</SelectItem>
                          <SelectItem value="Left-arm orthodox">Left-arm orthodox</SelectItem>
                          <SelectItem value="Left-arm chinaman">Left-arm chinaman</SelectItem>
                          <SelectItem value="Non-bowler">None / Non-bowler</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Preferred Jersey Number */}
                    <div className="space-y-1.5">
                      <Label htmlFor="jersey-num" className="text-xs font-bold">
                        Preferred Jersey Number
                      </Label>
                      <Input
                        id="jersey-num"
                        type="number"
                        min="0"
                        max="99"
                        placeholder="e.g. 7, 18, 45, 99"
                        value={jerseyNumber}
                        onChange={(e) => setJerseyNumber(e.target.value)}
                        className="h-10 text-sm font-medium"
                      />
                    </div>

                    {/* Tournament Division */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Tournament Division</Label>
                      <Select value={tournamentId} onValueChange={setTournamentId}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select tournament" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kapl-3-mens">🏏 KAPL 3.0 Men's Tournament</SelectItem>
                          <SelectItem value="kapl-3-womens">👑 KAPL 3.0 Women's Tournament</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Player Bio */}
                  <div className="space-y-1.5">
                    <Label htmlFor="player-bio" className="text-xs font-bold">
                      Bio / Playing Motto
                    </Label>
                    <Textarea
                      id="player-bio"
                      rows={3}
                      placeholder="Share a short summary about your cricket journey, strengths, favorite shots, or team motto..."
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="text-xs resize-none"
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-3 pt-2 pb-5 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs gap-1.5"
                    disabled={isSubmitting}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </Button>

                  <Button
                    type="submit"
                    size="default"
                    className="gap-2 font-bold px-6"
                    disabled={isSubmitting}
                  >
                    <Save className="w-4 h-4" />
                    {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </TabsContent>

          {/* TAB 2: MY TEAM & TOURNAMENT STATUS */}
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Franchise & Squad Membership
                </CardTitle>
                <CardDescription className="text-xs">
                  Details of the franchise you represent in KAPL Season 3.0.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userTeam ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-2xl bg-muted/60 border border-border/80 gap-4">
                      <div className="flex items-center gap-3">
                        <TeamBadge team={userTeam.team} size="lg" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-foreground">
                              {userTeam.team.name}
                            </h3>
                            <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px]">
                              Group {userTeam.team.group}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Status: <span className="font-semibold text-foreground">{userTeam.relationship}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" variant="outline" className="text-xs font-bold gap-1.5">
                          <Link to="/points">
                            <Trophy className="w-3.5 h-3.5" />
                            View Group Standings
                          </Link>
                        </Button>
                      </div>
                    </div>

                    {/* Squad Members */}
                    <div>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Team Squad Roster ({userTeam.team.players?.length || 0} Players)
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {userTeam.team.players?.map((squadPlayer, idx) => (
                          <div
                            key={squadPlayer.id || idx}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs ${
                              squadPlayer.name.toLowerCase() === (name || '').toLowerCase()
                                ? 'bg-primary/15 border-primary/40 font-bold'
                                : 'bg-card border-border/60'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {idx + 1}
                            </span>
                            <span className="truncate flex-1">{squadPlayer.name}</span>
                            {squadPlayer.name.toLowerCase() === (name || '').toLowerCase() && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary text-primary">
                                You
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h3 className="text-base font-bold text-foreground">Free Agent / Not Yet Drafted</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        You are currently in the open player pool for {currentTournament?.name || "KAPL 3.0"}. During the live auction, team owners will place bids to draft you into their franchises!
                      </p>
                    </div>
                    <Button asChild size="sm" className="gap-2 font-bold text-xs">
                      <Link to="/auction">
                        <Gavel className="w-3.5 h-3.5" />
                        Visit Live Auction Stage
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: SETTINGS & PREFERENCES */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Stadium Audio & Outdoor Sunlight Mode
                </CardTitle>
                <CardDescription className="text-xs">
                  Tailor your match viewing and ground scoring experience.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Sunlight Mode Setting */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {isSunlightMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-xs font-bold text-foreground">High-Contrast Outdoor Sunlight Mode</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Optimizes scoreboard contrast for bright direct sunlight on the cricket ground.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isSunlightMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleSunlightMode}
                    className="h-8 text-xs font-bold"
                  >
                    {isSunlightMode ? 'Active (Sunlight)' : 'Standard (Night)'}
                  </Button>
                </div>

                {/* Stadium Audio Setting */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-muted/40">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      {soundOn ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
                      <span className="text-xs font-bold text-foreground">Crowd Cheers & Boundary Sound Effects</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Plays audio celebrations on boundaries, wickets, and match outcomes.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={soundOn ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleSoundToggle}
                    className="h-8 text-xs font-bold"
                  >
                    {soundOn ? 'Enabled 🔊' : 'Muted 🔇'}
                  </Button>
                </div>

                {/* Account Security Information & Password Change */}
                <div className="pt-3 border-t border-border/60 space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-foreground">Account Credentials</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Signed in as: <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] text-foreground font-mono">{user?.email}</code>
                    </p>
                  </div>

                  {/* Change Password Form */}
                  <div className="p-3.5 rounded-xl bg-card border border-border/70 space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-foreground">Update Password</span>
                    </div>

                    <form onSubmit={handlePasswordChange} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="profile-new-pass" className="text-xs font-medium">New Password (min 8 chars)</Label>
                          <div className="relative">
                            <Input
                              id="profile-new-pass"
                              type={showNewPassword ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="text-xs h-9 pr-10"
                              disabled={isChangingPassword}
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="profile-confirm-pass" className="text-xs font-medium">Confirm New Password</Label>
                          <Input
                            id="profile-confirm-pass"
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="text-xs h-9"
                            disabled={isChangingPassword}
                          />
                        </div>
                      </div>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={isChangingPassword || !newPassword}
                        className="h-8.5 text-xs font-bold gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:opacity-95"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {isChangingPassword ? 'Updating Password...' : 'Update Password'}
                      </Button>
                    </form>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 pb-5 border-t border-border/60 flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Secured by Supabase Authentication
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                    toast.success('Signed out successfully');
                  }}
                  className="gap-1.5 text-xs font-bold h-9"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
