import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, Trophy, Flame, Gavel, UserPlus, ArrowRight, ShieldCheck, X } from 'lucide-react';

interface PlayerRegistrationPopupProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function PlayerRegistrationPopup({ forceOpen, onClose }: PlayerRegistrationPopupProps) {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }

    // Do not show automatically if user is already logged in
    if (isAuthenticated && user) {
      return;
    }

    // Check if dismissed in this browser session
    const isDismissed = sessionStorage.getItem('kapl_registration_popup_dismissed');
    if (!isDismissed) {
      // Small delay for smooth entry after home page loads
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, forceOpen]);

  const handleDismiss = () => {
    sessionStorage.setItem('kapl_registration_popup_dismissed', 'true');
    setIsOpen(false);
    onClose?.();
  };

  const handleRegisterClick = () => {
    sessionStorage.setItem('kapl_registration_popup_dismissed', 'true');
    setIsOpen(false);
    onClose?.();
    navigate('/auth?tab=signup&role=player');
  };

  const handleSignInClick = () => {
    sessionStorage.setItem('kapl_registration_popup_dismissed', 'true');
    setIsOpen(false);
    onClose?.();
    navigate('/auth?tab=signin');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDismiss();
      else setIsOpen(true);
    }}>
      <DialogContent className="max-w-[94vw] sm:max-w-md md:max-w-lg max-h-[90dvh] overflow-y-auto p-0 border border-amber-500/40 bg-card/95 backdrop-blur-2xl shadow-2xl shadow-amber-500/20 rounded-3xl">
        {/* Glow Header Background */}
        <div className="relative p-6 pb-4 bg-gradient-to-b from-amber-500/15 via-yellow-500/5 to-transparent border-b border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              REGISTRATION OPEN • KAPL 3.0
            </span>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-3xl shadow-lg shadow-amber-500/25 border border-amber-300/40 animate-bounce">
              🏏
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl sm:text-2xl font-black font-display text-foreground tracking-tight">
                Player Registration is OPEN!
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Step onto the pitch! Register now to enter the Mega Auction pool before bidding commences and claim your spot on tournament squads.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Perks & Highlights */}
        <div className="p-6 pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/30 transition-colors text-center sm:text-left space-y-1">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto sm:mx-0">
                <Gavel className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-foreground">Auction Pool</div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                Enter the live bidding room to get drafted by team owners.
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/30 transition-colors text-center sm:text-left space-y-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center mx-auto sm:mx-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-foreground">Official Profile</div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                Showcase batting style, bowling style, & jersey number.
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-yellow-500/30 transition-colors text-center sm:text-left space-y-1">
              <div className="w-7 h-7 rounded-lg bg-yellow-500/20 text-yellow-300 flex items-center justify-center mx-auto sm:mx-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="text-xs font-bold text-foreground">Cap Honors</div>
              <div className="text-[11px] text-muted-foreground leading-snug">
                Compete for Orange Cap, Purple Cap & Player of the Match.
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleRegisterClick}
              className="w-full h-12 text-sm font-black rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black shadow-lg shadow-amber-500/25 transition-all duration-300 gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Register as Player Now
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>

            <div className="flex items-center justify-between px-1 pt-1 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={handleSignInClick}
                className="hover:text-amber-400 font-semibold underline underline-offset-2 transition-colors"
              >
                Already registered? Sign In
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="hover:text-foreground transition-colors"
              >
                Remind me later
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

