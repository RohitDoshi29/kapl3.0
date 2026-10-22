import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Trophy,
  LogIn,
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  Sparkles,
  UserCheck,
  User,
  Phone,
  Award,
  Crown,
  Star,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { cn } from '@/lib/utils';
import { PlayerRole } from '@/lib/cricketTypes';

const emailSchema = z.string().trim().email({ message: 'Please enter a valid email address' });
const passwordSchema = z.string().min(8, { message: 'Password must be at least 8 characters' });

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signInWithPassword, signUp, signInWithGoogle, isAuthenticated } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const prefillEmail = (location.state as any)?.prefillEmail || searchParams.get('email') || '';
  const initialMessage = (location.state as any)?.message;
  const queryTab = searchParams.get('tab');
  const queryMode = searchParams.get('mode');
  const initialTab =
    (location.state as any)?.tab === 'signup' || queryTab === 'signup' || queryMode === 'register'
      ? 'signup'
      : 'signin';

  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(initialTab);

  // Sign In states
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Create Account states
  const [signupFullName, setSignupFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState(prefillEmail);
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const initialRole = searchParams.get('role');
  const [accountType, setAccountType] = useState<'player' | 'spectator'>(
    initialRole === 'spectator' ? 'spectator' : 'player'
  );
  const [playingRole, setPlayingRole] = useState<PlayerRole>('all_rounder');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [battingStyle, setBattingStyle] = useState('Right-hand bat');
  const [bowlingStyle, setBowlingStyle] = useState('Right-arm medium');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [tournamentId, setTournamentId] = useState('kapl-3-mens');
  const [bio, setBio] = useState('');
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/profile';

  // Synchronize activeTab and role if URL search params change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const modeParam = params.get('mode');
    if (tabParam === 'signup' || modeParam === 'register') {
      setActiveTab('signup');
    } else if (tabParam === 'signin') {
      setActiveTab('signin');
    }

    const roleParam = params.get('role');
    if (roleParam === 'spectator' || roleParam === 'player') {
      setAccountType(roleParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (initialMessage) {
      toast.info(initialMessage);
    }
  }, [initialMessage]);

  // If already authenticated, redirect safely via useEffect
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  if (isAuthenticated) {
    return null;
  }

  const validateSignIn = () => {
    const errs: { email?: string; password?: string } = {};
    const emailRes = emailSchema.safeParse(email);
    if (!emailRes.success) {
      errs.email = emailRes.error.errors[0].message;
    }
    const passRes = passwordSchema.safeParse(password);
    if (!passRes.success) {
      errs.password = passRes.error.errors[0].message;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignIn()) return;
    setIsSubmitting(true);

    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password. Please try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Welcome back to KAPL 3.0!');
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateSignUp = () => {
    const errs: Record<string, string> = {};

    if (!signupFullName.trim() || signupFullName.trim().length < 2) {
      errs.fullName = 'Please enter your full name (at least 2 characters)';
    }

    const emailRes = emailSchema.safeParse(signupEmail);
    if (!emailRes.success) {
      errs.email = emailRes.error.errors[0].message;
    }

    const passRes = passwordSchema.safeParse(signupPassword);
    if (!passRes.success) {
      errs.password = passRes.error.errors[0].message;
    }

    if (signupPassword !== signupConfirmPassword) {
      errs.confirmPassword = 'Passwords do not match';
    }

    setSignupErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUp()) return;
    setIsSubmitting(true);

    try {
      const { error } = await signUp(signupEmail, signupPassword, {
        name: signupFullName.trim(),
        mobileNumber: signupPhone.trim() || undefined,
        accountType,
        role: playingRole,
        battingStyle,
        bowlingStyle,
        jerseyNumber: jerseyNumber.trim() ? Number(jerseyNumber) : null,
        tournamentId,
        gender,
        bio: bio.trim() || undefined,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('This email is already registered. Please sign in instead.');
          setActiveTab('signin');
          setEmail(signupEmail);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Account created and activated immediately! Welcome to your Profile page.');
        navigate('/profile', { replace: true });
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred while creating your account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-8 relative overflow-hidden">
      {/* Decorative Stadium Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <Card
        className={cn(
          'w-full shadow-2xl border border-white/[0.1] backdrop-blur-2xl bg-card/90 relative z-10 rounded-3xl transition-all duration-300',
          activeTab === 'signup' ? 'max-w-2xl' : 'max-w-md'
        )}
      >
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/30 text-black">
            <Trophy className="w-8 h-8 text-black animate-bounce" />
          </div>
          <div>
            <Badge variant="gold" className="mb-2 px-3 py-1 text-xs font-black tracking-wider">
              <Sparkles className="w-3 h-3 mr-1 text-amber-300" />
              KAPL SEASON 3.0
            </Badge>
            <CardTitle className="text-2xl md:text-3xl font-black tracking-tight font-display text-foreground">
              {activeTab === 'signin' ? (
                <>
                  Tournament <span className="text-gradient-gold">Sign In</span>
                </>
              ) : (
                <>
                  Create Your <span className="text-gradient-gold">Account</span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-xs md:text-sm mt-1 text-muted-foreground">
              {activeTab === 'signin'
                ? 'Sign in to access your player profile, team management, or admin controls'
                : 'Register with complete player details — customize anytime in your Profile page'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'signin' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/[0.04] border border-white/10 p-1 rounded-2xl">
              <TabsTrigger
                value="signin"
                className="rounded-xl font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                Sign In
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-xl font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/20 data-[state=active]:to-yellow-500/15 data-[state=active]:text-amber-300"
              >
                <UserPlus className="w-4 h-4 mr-1.5" />
                Create Account
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SIGN IN */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signin-email" className="font-semibold text-xs">
                    Email Address
                  </Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="player@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    className={errors.email ? 'border-destructive bg-white/[0.03]' : 'bg-white/[0.03] border-white/10'}
                    disabled={isSubmitting}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                      disabled={isSubmitting}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full h-11 gap-2 font-semibold" disabled={isSubmitting}>
                  <LogIn className="w-4 h-4" />
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>

                <div className="pt-2 text-center border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('signup')}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Don't have an account?</span>
                    <span className="text-white underline font-extrabold">Create an Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </TabsContent>

            {/* TAB 2: CREATE ACCOUNT WITH ALL DETAILS */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* 1. Personal & Contact Details */}
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Personal & Contact Information
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-name" className="text-xs font-bold">
                        Full Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="e.g. Rohit Doshi"
                        value={signupFullName}
                        onChange={(e) => {
                          setSignupFullName(e.target.value);
                          setSignupErrors((prev) => ({ ...prev, fullName: '' }));
                        }}
                        className={signupErrors.fullName ? 'border-destructive' : ''}
                        disabled={isSubmitting}
                        autoComplete="name"
                      />
                      {signupErrors.fullName && (
                        <p className="text-[11px] text-destructive">{signupErrors.fullName}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-email" className="text-xs font-bold">
                        Email Address <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="player@example.com"
                        value={signupEmail}
                        onChange={(e) => {
                          setSignupEmail(e.target.value);
                          setSignupErrors((prev) => ({ ...prev, email: '' }));
                        }}
                        className={signupErrors.email ? 'border-destructive' : ''}
                        disabled={isSubmitting}
                        autoComplete="email"
                      />
                      {signupErrors.email && (
                        <p className="text-[11px] text-destructive">{signupErrors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Mobile, Gender & Account Type */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-phone" className="text-xs font-bold flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        Mobile / WhatsApp
                      </Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="e.g. +91 98765 43210"
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        disabled={isSubmitting}
                        autoComplete="tel"
                      />
                    </div>

                    {/* Gender Selection */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">
                        Gender <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setGender('male');
                            setTournamentId('kapl-3-mens');
                          }}
                          className={cn(
                            "h-10 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                            gender === 'male'
                              ? "bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-sm"
                              : "bg-white/[0.03] border-white/10 text-muted-foreground hover:bg-white/[0.06]"
                          )}
                        >
                          <span>🏏</span>
                          <span>Male</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGender('female');
                            setTournamentId('kapl-3-womens');
                          }}
                          className={cn(
                            "h-10 px-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                            gender === 'female'
                              ? "bg-pink-500/20 border-pink-500/60 text-pink-300 shadow-sm"
                              : "bg-white/[0.03] border-white/10 text-muted-foreground hover:bg-white/[0.06]"
                          )}
                        >
                          <span>👑</span>
                          <span>Female</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Account Type / Role</Label>
                      <Select
                        value={accountType}
                        onValueChange={(val: any) => setAccountType(val)}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger className="h-10 text-xs font-medium">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="player">🏏 Tournament Player</SelectItem>
                          <SelectItem value="spectator">🎟️ Fan / Spectator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 2. Cricket Playing Attributes (Only for Players) */}
                {accountType === 'player' && (
                  <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Cricket Playing Attributes
                        </h3>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 bg-amber-500/10">
                        Dual League Eligible
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Primary Role */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Playing Role</Label>
                        <Select
                          value={playingRole}
                          onValueChange={(val: any) => setPlayingRole(val)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-10 text-xs">
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
                        <Select
                          value={battingStyle}
                          onValueChange={setBattingStyle}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select batting style" />
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
                        <Select
                          value={bowlingStyle}
                          onValueChange={setBowlingStyle}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select bowling style" />
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Jersey Number */}
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-jersey" className="text-xs font-bold">
                          Preferred Jersey Number
                        </Label>
                        <Input
                          id="signup-jersey"
                          type="number"
                          min="0"
                          max="99"
                          placeholder="e.g. 7, 18, 45, 99"
                          value={jerseyNumber}
                          onChange={(e) => setJerseyNumber(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>

                      {/* Tournament Division */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Primary Division Preference</Label>
                        <Select
                          value={tournamentId}
                          onValueChange={setTournamentId}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="h-10 text-xs">
                            <SelectValue placeholder="Select division" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kapl-3-mens">🏏 KAPL 3.0 Men's Tournament</SelectItem>
                            <SelectItem value="kapl-3-womens">👑 KAPL 3.0 Women's Tournament</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                      <span>✨</span>
                      <span>Player profile will automatically sync to both <strong>Men's</strong> and <strong>Women's</strong> auction pools for complete team franchise accessibility.</span>
                    </p>

                    {/* Bio */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-bio" className="text-xs font-bold">
                        Bio / Playing Experience
                      </Label>
                      <Textarea
                        id="signup-bio"
                        rows={2}
                        placeholder="Short note about your batting strengths, bowling pace, past cricket achievements..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        disabled={isSubmitting}
                        className="text-xs resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* 3. Password & Security */}
                <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Password & Security
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-password">
                        Choose Password (min 8 chars) <span className="text-destructive">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignupPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={signupPassword}
                          onChange={(e) => {
                            setSignupPassword(e.target.value);
                            setSignupErrors((prev) => ({ ...prev, password: '' }));
                          }}
                          className={signupErrors.password ? 'border-destructive pr-10' : 'pr-10'}
                          disabled={isSubmitting}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {signupErrors.password && (
                        <p className="text-[11px] text-destructive">{signupErrors.password}</p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-confirm-password">
                        Confirm Password <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="signup-confirm-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={signupConfirmPassword}
                        onChange={(e) => {
                          setSignupConfirmPassword(e.target.value);
                          setSignupErrors((prev) => ({ ...prev, confirmPassword: '' }));
                        }}
                        className={signupErrors.confirmPassword ? 'border-destructive' : ''}
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      {signupErrors.confirmPassword && (
                        <p className="text-[11px] text-destructive">{signupErrors.confirmPassword}</p>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 gap-2 font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-black hover:opacity-95 shadow-md shadow-amber-500/20"
                  disabled={isSubmitting}
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Creating Account...' : 'Create Account & Open Profile'}
                </Button>

                <div className="pt-2 text-center border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('signin')}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold hover:underline transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Already have an account?</span>
                    <span className="text-white underline font-extrabold">Sign In</span>
                  </button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center pt-2">
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              Secured by Supabase Authentication • KAPL Season 3.0
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


