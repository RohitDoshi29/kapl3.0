import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy, AlertCircle, Home, LogOut, Shield, KeyRound, UserCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const VALID_EMERGENCY_PINS = ['kapl2026', 'admin2026', 'scorer2026', 'kapl3', 'rohit2026'];

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const {
    isAuthenticated,
    isLoading,
    userRole,
    isAdmin,
    isSuperAdmin,
    isMainAdmin,
    isScorer,
    user,
    signOut,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Ground override check from local or session storage
  const hasGroundAccess = typeof window !== 'undefined' && (
    localStorage.getItem('kapl_ground_override') === 'admin' ||
    sessionStorage.getItem('kapl_ground_override') === 'admin'
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center animate-pulse shadow-lg shadow-primary/20">
          <Trophy className="w-8 h-8 text-primary-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Verifying KAPL permissions...</p>
      </div>
    );
  }

  // Mandatory Authentication Check (allow if ground override active)
  if (!isAuthenticated && !hasGroundAccess) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check if current user is Main Admin (unconditional bypass)
  const isMain = Boolean(
    isMainAdmin ||
    (user?.email && user.email.toLowerCase().trim() === 'rohit.doshi2007@gmail.com')
  );

  // Admins and Co-Admins have access to administrative routes
  const isElevatedAdmin = isMain || isAdmin || isSuperAdmin || hasGroundAccess;

  // Role-Based Authorization Check (if allowedRoles specified)
  const hasRole = Boolean(
    !allowedRoles ||
    allowedRoles.length === 0 ||
    isElevatedAdmin ||
    (userRole && (allowedRoles.includes(userRole) || userRole === 'admin'))
  );

  if (!hasRole) {
    const handleSwitchToMainAdmin = async () => {
      try {
        await signOut();
      } catch {}
      navigate('/auth', {
        state: {
          from: location,
          message: 'Sign in with Administrator credentials',
        },
      });
    };

    const handleUnlockWithPin = (e: React.FormEvent) => {
      e.preventDefault();
      setPinError('');
      const cleanPin = pin.trim().toLowerCase();

      if (!cleanPin) {
        setPinError('Please enter an emergency passcode');
        return;
      }

      if (VALID_EMERGENCY_PINS.includes(cleanPin)) {
        setIsUnlocking(true);
        try {
          localStorage.setItem('kapl_ground_override', 'admin');
          sessionStorage.setItem('kapl_ground_override', 'admin');
          toast.success('Emergency Ground Admin access unlocked!');
          setTimeout(() => {
            window.location.reload();
          }, 300);
        } catch (err) {
          toast.error('Could not save ground access token');
          setIsUnlocking(false);
        }
      } else {
        setPinError('Invalid passcode. Contact Rohit Doshi for ground access.');
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/40 to-background p-4">
        <Card className="w-full max-w-lg shadow-2xl border-destructive/20 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-destructive via-amber-500 to-primary" />
          <CardHeader className="text-center pb-3">
            <div className="w-16 h-16 mx-auto mb-2 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center shadow-inner">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div className="flex justify-center mb-1">
              <Badge variant="outline" className="text-xs uppercase tracking-wider border-destructive/30 text-destructive bg-destructive/5 font-semibold">
                Access Restricted
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Privileged Area</CardTitle>
            <CardDescription className="text-xs md:text-sm max-w-sm mx-auto">
              This tournament section requires elevated privileges ({allowedRoles?.join(' / ')}).
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            {/* Account Diagnostic Card */}
            <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 text-xs space-y-2">
              <div className="flex items-center justify-between text-muted-foreground border-b border-border/50 pb-2">
                <span>Currently Signed In:</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]" title={user?.email || 'Anonymous'}>
                  {user?.email || 'Anonymous / Guest'}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground border-b border-border/50 pb-2">
                <span>Account Role:</span>
                <Badge variant="secondary" className="capitalize text-[11px] font-medium">
                  {userRole || 'player'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Privilege Level:
                </span>
                <span className="font-mono text-primary font-medium">
                  Administrator
                </span>
              </div>
            </div>

            {/* Switch to Administrator Action */}
            <Button
              onClick={handleSwitchToMainAdmin}
              className="w-full h-11 gap-2 font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-95 shadow-md shadow-primary/20 text-primary-foreground"
            >
              <UserCheck className="w-4 h-4" />
              Sign In with Admin Account
            </Button>

            {/* Ground Organizer Emergency Passcode Form */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <KeyRound className="w-4 h-4 shrink-0" />
                <span>Ground Official Emergency Unlock</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                If you are a tournament official or administrator on ground, enter the emergency passcode to unlock access on this device:
              </p>
              <form onSubmit={handleUnlockWithPin} className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Enter passcode (e.g. kapl2026)"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      setPinError('');
                    }}
                    className={`h-9 pl-8 text-xs ${pinError ? 'border-destructive' : 'border-amber-500/30'}`}
                    disabled={isUnlocking}
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  className="h-9 px-3 text-xs font-semibold shrink-0"
                  disabled={isUnlocking}
                >
                  {isUnlocking ? 'Unlocking...' : 'Unlock'}
                </Button>
              </form>
              {pinError && <p className="text-[11px] text-destructive font-medium">{pinError}</p>}
            </div>

            {/* Standard Return & Sign Out Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button asChild variant="outline" className="h-10 text-xs gap-1.5">
                <a href="/">
                  <Home className="w-3.5 h-3.5" />
                  Scoreboard
                </a>
              </Button>
              <Button
                variant="ghost"
                className="h-10 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  await signOut();
                  navigate('/auth');
                }}
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
