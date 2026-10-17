import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSunlightMode } from '@/hooks/useSunlightMode';
import { isSoundEnabled, setSoundEnabled, playBoundaryFour } from '@/lib/soundEffects';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Sparkles, Sun, Moon, Volume2, VolumeX, Crown } from 'lucide-react';
import { toast } from 'sonner';

import { TournamentSwitcher } from './TournamentSwitcher';

export function Header({ className }: { className?: string }) {
  const { user, userRole, signOut, isAuthenticated, profile } = useAuth();
  const { isSunlightMode, toggleSunlightMode } = useSunlightMode();
  const [soundOn, setSoundOn] = useState<boolean>(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    const handleToggle = (e: any) => {
      setSoundOn(e.detail?.enabled ?? isSoundEnabled());
    };
    window.addEventListener('kapl-sound-toggle', handleToggle);
    return () => window.removeEventListener('kapl-sound-toggle', handleToggle);
  }, []);

  const handleSoundToggle = () => {
    const nextState = !soundOn;
    setSoundEnabled(nextState);
    setSoundOn(nextState);
    if (nextState) {
      playBoundaryFour();
      toast.success('Sound effects active 🔊');
    } else {
      toast.info('Sound effects muted 🔇');
    }
  };

  const handleSunlightToggle = () => {
    toggleSunlightMode();
    if (!isSunlightMode) {
      toast.success('Outdoor Sunlight Mode active (High Contrast) ☀️');
    } else {
      toast.info('Stadium Obsidian Mode active 🌙');
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Failed to sign out');
    } else {
      toast.success('Signed out successfully');
    }
  };

  const getRoleBadge = (role: string | null) => {
    if (user?.email?.toLowerCase() === 'rohit.doshi2007@gmail.com') {
      return (
        <Badge className="bg-destructive text-destructive-foreground font-black text-[10px] px-2 py-0 shadow-xs flex items-center gap-1 border-amber-400/40">
          <Crown className="w-2.5 h-2.5 text-amber-300" />
          Main Admin
        </Badge>
      );
    }
    switch (role) {
      case 'admin':
        return <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 font-bold">Admin</Badge>;
      case 'co_admin':
        return <Badge className="bg-purple-600 text-white font-bold text-[10px] px-1.5 py-0 shadow-xs">Co-Admin</Badge>;
      case 'scorer':
      case 'primary_scorer':
      case 'secondary_scorer':
        return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 font-bold">Scorer</Badge>;
      case 'owner':
        return <Badge className="bg-amber-500 text-black font-bold text-[10px] px-1.5 py-0 shadow-xs">Owner</Badge>;
      case 'captain':
        return <Badge className="bg-accent text-accent-foreground text-[10px] px-1.5 py-0">Captain</Badge>;
      case 'player':
      default:
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Player</Badge>;
    }
  };

  return (
    <header className={cn('relative overflow-hidden py-3 md:py-4 bg-card/85 backdrop-blur-xl border-b border-white/[0.08] shadow-md shadow-black/20', className)}>
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-emerald-500/5 to-cyan-500/10 opacity-70 pointer-events-none" />

      <div className="relative container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Title & Branding */}
        <div className="text-center md:text-left flex items-center gap-3">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/25 group-hover:scale-105 group-hover:shadow-amber-500/40 transition-all text-black font-black">
              <span className="text-xl">🏏</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl md:text-2xl font-black tracking-tight text-foreground font-display">
                  KAPL
                </span>
                <Badge variant="gold" className="text-[11px] px-2 py-0.5 tracking-wider font-black">
                  <Sparkles className="w-2.5 h-2.5 mr-1 text-amber-300" /> 3.0
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium tracking-wide">
                Premier Cricket League
              </p>
            </div>
          </Link>
        </div>

        {/* Global Tournament Switcher (Men's vs Women's) */}
        <div className="my-1 md:my-0 flex items-center gap-2">
          <TournamentSwitcher size="md" />
        </div>

        {/* Controls & User Account Bar */}
        <div className="flex items-center gap-2">
          {/* Quick Audio Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleSoundToggle}
            className="h-8.5 w-8.5 rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/[0.08] shadow-xs"
            title={soundOn ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {soundOn ? (
              <Volume2 className="w-4 h-4 text-amber-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>

          {/* High-Contrast Outdoor Sunlight Mode Toggle */}
          <Button
            variant={isSunlightMode ? 'default' : 'outline'}
            size="icon"
            onClick={handleSunlightToggle}
            className={cn(
              'h-8.5 w-8.5 rounded-xl shadow-xs transition-all',
              isSunlightMode
                ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400'
                : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]'
            )}
            title={isSunlightMode ? 'Switch to Stadium Night Mode' : 'Switch to Outdoor High-Contrast Sunlight Mode'}
          >
            {isSunlightMode ? (
              <Sun className="w-4 h-4 text-black animate-spin-slow" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </Button>

          {/* User Account / Auth */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.07] backdrop-blur-md border border-white/10 rounded-2xl pl-2 pr-2.5 py-1 shadow-sm transition-all">
              <Link
                to="/profile"
                className="flex items-center gap-2 group"
                title="View & Edit My Profile"
              >
                <Avatar className="w-7 h-7 border border-amber-500/40 group-hover:border-amber-400 transition-colors shadow-xs">
                  {profile?.photoUrl && (
                    <AvatarImage src={profile.photoUrl} alt={profile.name || 'User avatar'} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {profile?.name
                      ? profile.name.slice(0, 2).toUpperCase()
                      : user.email
                      ? user.email.slice(0, 2).toUpperCase()
                      : <User className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-bold text-foreground max-w-[100px] md:max-w-[140px] truncate leading-tight group-hover:text-amber-400 transition-colors">
                    {profile?.name || user.email}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {getRoleBadge(userRole)}
                  </div>
                </div>
              </Link>

              <div className="h-4 w-px bg-white/10 mx-0.5" />

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-xl text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                onClick={handleSignOut}
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button size="sm" variant="default" className="h-8.5 rounded-xl text-xs font-bold shadow-md shadow-amber-500/20">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}