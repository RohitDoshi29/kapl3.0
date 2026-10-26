import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UserPlus, 
  ArrowRight, 
  Gavel, 
  Trophy, 
  ShieldCheck, 
  Sparkles, 
  Flame, 
  Users, 
  Calendar,
  Radio
} from 'lucide-react';

interface PlayerRegistrationHeroProps {
  tournamentName?: string;
  onOpenPopup?: () => void;
}

export function PlayerRegistrationHero({ tournamentName = 'KAPL 3.0', onOpenPopup }: PlayerRegistrationHeroProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user, profile, userRole } = useAuth();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-card/95 via-card/80 to-background/90 backdrop-blur-2xl p-6 sm:p-8 md:p-10 shadow-2xl shadow-amber-500/10">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center space-y-6">
        {/* Status Pill */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            REGISTRATION OPEN • {tournamentName}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Mega Auction & Tournament
          </span>
        </div>

        {/* Big Icon & Main Heading */}
        <div className="space-y-3">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-600 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/25 border border-amber-300/40 animate-bounce">
            🏏
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-foreground tracking-tight leading-tight">
            Player Registration is <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">OPEN!</span>
          </h1>

          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Step onto the pitch! Register now to enter the Mega Auction pool before bidding commences. Create your verified tournament player profile to get drafted by franchise owners and compete for glory.
          </p>
        </div>

        {/* 3 Value Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-left">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/40 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Gavel className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-foreground mb-1">Mega Auction Pool</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enter the draft pool where franchise owners bid live with paddles and purse budgets.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/40 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-foreground mb-1">Official Player Card</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Set your batting style, bowling style, jersey number, and career cricket achievements.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-yellow-500/40 transition-all group">
            <div className="w-9 h-9 rounded-xl bg-yellow-500/20 text-yellow-300 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
              <Trophy className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-foreground mb-1">Championship Honors</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Real-time match scoring, Orange Cap, Purple Cap, and Player of the Match awards.
            </p>
          </div>
        </div>

        {/* Action Button Strip */}
        <div className="pt-3 space-y-3">
          {isAuthenticated && user ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-semibold text-foreground">
                <span className="text-amber-400">✓</span>
                Logged in as <span className="font-bold text-amber-300">{profile?.name || user.email}</span> ({userRole || 'Player'})
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => navigate('/profile')}
                  className="h-12 px-6 rounded-2xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/20 hover:opacity-95 gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  View & Edit My Player Profile
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/auction')}
                  className="h-12 px-5 rounded-2xl font-bold border-white/15 bg-white/[0.04] hover:bg-white/[0.08] gap-2"
                >
                  <Gavel className="w-4 h-4 text-amber-400" />
                  Live Auction Room
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => navigate('/register')}
                className="h-13 px-8 text-base font-black rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black shadow-xl shadow-amber-500/25 hover:from-amber-600 hover:to-yellow-600 hover:scale-[1.02] active:scale-[0.98] transition-all gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Register as Player Now
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <Button
                variant="outline"
                onClick={() => navigate('/auction')}
                className="h-13 px-6 rounded-2xl font-bold border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-foreground gap-2"
              >
                <Gavel className="w-4 h-4 text-amber-400" />
                View Auction Pool
              </Button>

              <Button
                variant="ghost"
                onClick={() => navigate('/players')}
                className="h-13 px-5 rounded-2xl font-bold text-muted-foreground hover:text-foreground hover:bg-white/[0.06] gap-2"
              >
                <Users className="w-4 h-4 text-emerald-400" />
                Registered Players
              </Button>
            </div>
          )}

          {/* Friendly Note on Match Status */}
          <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>No live match right now. Matches begin immediately after the Mega Player Auction!</span>
          </div>
        </div>
      </div>
    </div>
  );
}

